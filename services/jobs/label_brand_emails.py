"""Scan the Gmail inbox and apply config.GMAIL_BRAND_LABEL to any message
whose sender matches a known Brand email — see database.models.Brand.emails.

Idempotent by construction: list_candidate_message_ids excludes messages
that already carry the label (server-side, via Gmail search), so re-running
this job never re-labels or re-processes anything already handled.
"""
import json

from config import GMAIL_BRAND_LABEL as _GMAIL_BRAND_LABEL_DEFAULT, logger
from database.db import get_session
from database.models import Brand
from gmail.gmail_labels import apply_label, get_message_sender_and_labels, get_or_create_label_id, list_candidate_message_ids
from gmail.gmail_service import _get_session
from services.jobs.base import BackgroundJob, CriticalError, WorkItem
from services.settings_service import get_setting

# Per-run scratch state (label id, brand lookup, open session) — safe as a
# module dict because get_active_job's dedupe guard only allows one instance
# of this job type to run at a time (same pattern as fetch_sales_web.py).
_state: dict = {}


def _normalize(email: str) -> str:
    return (email or "").strip().lower()


def _load_brand_email_lookup() -> dict[str, str]:
    """Build the sender-email -> brand-name lookup once per run — O(1)
    matching per message afterward, regardless of brand count."""
    lookup: dict[str, str] = {}
    with get_session() as session:
        for b in session.query(Brand).all():
            if not b.emails:
                continue
            try:
                addresses = json.loads(b.emails)
            except (json.JSONDecodeError, TypeError):
                continue
            for addr in addresses:
                norm = _normalize(addr)
                if norm:
                    lookup.setdefault(norm, b.name)
    return lookup


class LabelBrandEmailsJob(BackgroundJob):
    job_type = "label_brand_emails"

    def before_run(self, job_id: int, job: dict) -> None:
        from services import job_service

        lookup = _load_brand_email_lookup()
        if not lookup:
            raise CriticalError("No brand emails found — populate brands.emails before running this job.")

        label_name = get_setting("gmail_brand_label", default=_GMAIL_BRAND_LABEL_DEFAULT)
        session = _get_session()
        label_id = get_or_create_label_id(session, label_name)

        _state.update({
            "lookup": lookup,
            "session": session,
            "label_id": label_id,
            "label_name": label_name,
            "labeled": 0,
            "skipped_no_match": 0,
            "skipped_already_labeled": 0,
        })
        job_service.append_log(job_id, f"Loaded {len(lookup)} brand email(s).", severity="success", category="brands")

    def collect_work(self, job: dict) -> list[WorkItem]:
        from services import job_service

        job_service.append_log(job_id=job["id"], message="Scanning inbox for unlabeled candidates…", category="gmail")
        ids = list_candidate_message_ids(_state["session"], _state["label_name"])
        return [WorkItem(id=mid, label=mid) for mid in ids]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        session = _state["session"]
        label_id = _state["label_id"]
        lookup = _state["lookup"]

        try:
            sender, existing_labels = get_message_sender_and_labels(session, item.id)
        except Exception as exc:
            job_service.append_log(job_id, f"⚠ Could not read message {item.id} — {exc}", severity="warning", category="gmail")
            return "failed"

        if label_id in existing_labels:
            _state["skipped_already_labeled"] += 1
            job_service.append_log(job_id, f"Sender: {sender} — already labeled, skipped", category="gmail")
            return "skipped"

        brand_name = lookup.get(sender)
        if not brand_name:
            _state["skipped_no_match"] += 1
            return "skipped"

        try:
            apply_label(session, item.id, label_id)
        except Exception as exc:
            job_service.append_log(job_id, f"⚠ Failed to label message from {sender} ({brand_name}) — {exc}", severity="warning", category="gmail")
            return "failed"

        _state["labeled"] += 1
        job_service.append_log(job_id, f"✓ {sender} matched \"{brand_name}\" — labeled {_state['label_name']}", severity="success", category="gmail")
        return "successful"

    def after_run(self, job_id: int, job: dict) -> None:
        from services import job_service

        job_service.set_result(job_id, {
            "labeled": _state.get("labeled", 0),
            "skipped_no_match": _state.get("skipped_no_match", 0),
            "skipped_already_labeled": _state.get("skipped_already_labeled", 0),
        })
