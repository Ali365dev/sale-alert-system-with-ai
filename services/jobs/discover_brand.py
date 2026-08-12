"""Unknown Emails / Brand Discovery support.

Two independent pieces live here:

1. Domain-matching helpers (extract_domain, find_known_brand_by_domain,
   route_to_candidate_queue) — used by the pipeline hook in
   services/jobs/process_pending.py and api/emails.py to decide, cheaply and
   deterministically, whether an email's sender is already known before
   spending any OCR/LLM budget on it.

2. DiscoverBrandJob — the BackgroundJob that runs AI brand identification
   (ai/brand_identifier.py) + the deterministic duplicate-check
   (find_possible_duplicate) for one or more pending BrandCandidate rows.
   Registered in services/job_registry.py.
"""
import json
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Optional
from urllib.parse import urlparse

from database.db import get_session
from database.models import Brand, BrandCandidate, Email
from services.jobs.base import BackgroundJob, WorkItem

FUZZY_NAME_MATCH_THRESHOLD = 0.82


def extract_domain(sender: str) -> str:
    """'Fossil <fossil@email.fossil.com>' -> 'email.fossil.com'. Best-effort —
    returns '' for anything that doesn't look like it has an @ address."""
    if not sender:
        return ""
    addr = sender.strip()
    if "<" in addr and ">" in addr:
        addr = addr[addr.rfind("<") + 1 : addr.rfind(">")]
    if "@" not in addr:
        return ""
    return addr.rsplit("@", 1)[-1].strip().rstrip(">").lower()


def _normalize_domain(domain: str) -> str:
    domain = (domain or "").lower().strip()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _domain_of(url: str) -> str:
    try:
        netloc = urlparse(url if "//" in (url or "") else f"//{url or ''}").netloc
    except ValueError:
        return ""
    return _normalize_domain(netloc)


def _domains_match(a: str, b: str) -> bool:
    if not a or not b:
        return False
    return a == b or a.endswith(f".{b}") or b.endswith(f".{a}")


def find_known_brand_by_domain(sender_domain: str) -> Optional[Brand]:
    """Does this sender domain already belong to a known Brand? Checks
    Brand.emails (JSON list of known sender emails/domains, populated as
    admins resolve BrandCandidates) and Brand.website's domain."""
    norm = _normalize_domain(sender_domain)
    if not norm:
        return None

    with get_session() as session:
        for b in session.query(Brand).all():
            known_domains = set()
            if b.emails:
                try:
                    for entry in json.loads(b.emails):
                        known_domains.add(_normalize_domain(entry.split("@")[-1] if "@" in entry else entry))
                except (json.JSONDecodeError, TypeError, AttributeError):
                    pass
            if b.website:
                known_domains.add(_domain_of(b.website))

            if any(_domains_match(norm, known) for known in known_domains if known):
                # Detach the id/name we need before the session closes.
                return Brand(id=b.id, name=b.name, website=b.website, emails=b.emails)
        return None


def route_to_candidate_queue(email_id: int, sender: str, sender_domain: str) -> None:
    """Upsert a pending BrandCandidate row for this email. No AI call here —
    identification happens later, on-demand, via DiscoverBrandJob."""
    with get_session() as session:
        existing = session.query(BrandCandidate).filter(BrandCandidate.email_id == email_id).first()
        if existing is not None:
            return
        session.add(BrandCandidate(email_id=email_id, sender_domain=sender_domain or None, status="pending"))


def find_possible_duplicate(
    suggested_name: Optional[str], suggested_website: Optional[str], sender_domain: Optional[str]
) -> tuple[Optional[int], Optional[float], Optional[str]]:
    """Deterministic duplicate check against existing Brand rows.
    Returns (brand_id, score, reason) — reason is "domain_match" |
    "name_fuzzy_match" | None. No LLM call."""
    norm_sender = _normalize_domain(sender_domain or "")
    norm_website = _domain_of(suggested_website or "")

    with get_session() as session:
        brands = session.query(Brand).all()

        # 1. Domain match — strong signal.
        for b in brands:
            known_domains = set()
            if b.emails:
                try:
                    for entry in json.loads(b.emails):
                        known_domains.add(_normalize_domain(entry.split("@")[-1] if "@" in entry else entry))
                except (json.JSONDecodeError, TypeError, AttributeError):
                    pass
            if b.website:
                known_domains.add(_domain_of(b.website))
            known_domains.discard("")

            if any(_domains_match(norm_sender, k) or _domains_match(norm_website, k) for k in known_domains):
                return b.id, 1.0, "domain_match"

        # 2. Fuzzy name match — fallback.
        if not suggested_name:
            return None, None, None
        best_id, best_score = None, 0.0
        for b in brands:
            score = SequenceMatcher(None, suggested_name.lower(), b.name.lower()).ratio()
            if score > best_score:
                best_id, best_score = b.id, score
        if best_score >= FUZZY_NAME_MATCH_THRESHOLD:
            return best_id, round(best_score, 3), "name_fuzzy_match"
        return None, None, None


class DiscoverBrandJob(BackgroundJob):
    job_type = "discover_brand_candidates"

    def collect_work(self, job: dict) -> list[WorkItem]:
        payload = job.get("payload") or {}
        candidate_ids = payload.get("candidate_ids")

        with get_session() as session:
            q = session.query(BrandCandidate, Email).join(Email, BrandCandidate.email_id == Email.id)
            if candidate_ids:
                q = q.filter(BrandCandidate.id.in_(candidate_ids))
            else:
                q = q.filter(BrandCandidate.status == "pending")
            rows = q.all()
            return [WorkItem(id=c.id, label=e.subject) for c, e in rows]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from ai.brand_identifier import identify_brand
        from services import job_service

        with get_session() as session:
            c = session.query(BrandCandidate).filter(BrandCandidate.id == item.id).first()
            if c is None:
                return "skipped"
            e = session.query(Email).filter(Email.id == c.email_id).first()
            if e is None:
                return "skipped"
            subject, body, sender = e.subject, (e.ocr_text_clean or e.body or ""), e.sender or ""
            sender_domain = c.sender_domain

        job_service.set_stage(job_id, "ai_identification")
        result = identify_brand(subject, body, sender)

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        if result is None or not result.get("brand_name"):
            with get_session() as session:
                c = session.query(BrandCandidate).filter(BrandCandidate.id == item.id).first()
                if c is not None:
                    c.analysis_error = "AI could not identify a brand"
                    c.analyzed_at = now
            job_service.append_log(job_id, f"⚠ Could not identify brand for \"{item.label[:60]}\"", severity="warning", category="ai")
            return "failed"

        dup_id, dup_score, dup_reason = find_possible_duplicate(result["brand_name"], result.get("website"), sender_domain)

        with get_session() as session:
            c = session.query(BrandCandidate).filter(BrandCandidate.id == item.id).first()
            if c is not None:
                c.suggested_name = result.get("brand_name")
                c.suggested_website = result.get("website")
                c.suggested_category = result.get("category")
                c.suggested_logo_url = result.get("logo_url")
                c.suggested_country = result.get("country")
                c.suggested_socials = json.dumps(result.get("social_links") or {})
                c.confidence = result.get("confidence")
                c.reasoning = result.get("reasoning")
                c.analyzed_at = now
                c.analysis_error = None
                c.status = "analyzed"
                c.possible_duplicate_brand_id = dup_id
                c.duplicate_match_score = dup_score
                c.duplicate_match_reason = dup_reason

        job_service.append_log(
            job_id, f"✓ Identified \"{result['brand_name']}\" for \"{item.label[:60]}\"", severity="success", category="ai"
        )
        return "successful"
