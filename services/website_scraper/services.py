"""Orchestrates the Website Sale Scraper pipeline end to end. Mirrors
services/social_scraper/content_pipeline.py's shape: this module owns
per-page processing (`process_page`) and per-brand finalization
(`finalize_brand_scrape`); services/jobs/website_scrape_brand.py wires these
into the standard BackgroundJob machinery so the frontend gets stage/log/
cancel/retry UI for free, exactly like every other pipeline action."""
from __future__ import annotations

import json
import time
from typing import Optional
from urllib.parse import urlparse

from config import WEBSITE_SCRAPE_AI_ON_WEAK_SIGNAL
from database.db import get_session
from database.models import Brand, WebsiteScrapeLog, WebsiteScrapedPage
from database.offer_retention import utcnow
from services.website_scraper import closure_detector, crawler, deduplicator, detectors, normalizer, sale_matcher
from services.website_scraper.extractor import extract_page
from services.website_scraper.models import DiscoveredUrl, ExtractedSaleCandidate

_JOB_OUTCOME = {
    "ERROR": "failed",
    "BLOCKED": "failed",
    "UNCHANGED": "skipped",
    "DUPLICATE": "skipped",
}


def _configured_urls(brand: Brand) -> list[tuple[str, str]]:
    urls: list[tuple[str, str]] = []
    if brand.sale_page_url:
        urls.append((brand.sale_page_url, "sale"))
    if brand.offers_page_url:
        urls.append((brand.offers_page_url, "offers"))
    if brand.promotions_page_url:
        urls.append((brand.promotions_page_url, "promotions"))
    if brand.custom_scrape_urls:
        try:
            for url in json.loads(brand.custom_scrape_urls) or []:
                if url:
                    urls.append((url, "custom"))
        except (json.JSONDecodeError, TypeError):
            pass
    return urls


def discover_pages_for_brand(brand: Brand) -> tuple[list[DiscoveredUrl], list[str]]:
    homepage = brand.homepage_url or brand.website
    if not homepage:
        return [], ["Brand has no homepage_url or website configured"]
    return crawler.discover_pages(homepage, _configured_urls(brand))


def process_page(
    job_id: Optional[int], brand_id: Optional[int], brand_name: Optional[str], url: str, page_type: str,
) -> dict:
    """Fetch -> extract -> normalize/hash -> compare -> rule-score -> AI ->
    dedup -> offer create/update. Always persists a WebsiteScrapedPage row,
    including failures (spec §8 — store every scrape attempt).

    Takes brand_id/brand_name as plain scalars, not a Brand ORM instance —
    the caller's session is long closed by the time this runs (each stage
    below opens its own short-lived session), so holding onto a Brand
    instance across that boundary would raise a "not bound to a Session"
    error the moment an un-eagerly-loaded attribute like .name is touched."""
    started = time.perf_counter()
    target_host = urlparse(url).netloc.lower()

    try:
        status, html, final_url, used_browser = crawler.fetch_html_with_fallback(url)
    except Exception as exc:
        return _save_page(
            brand_id=brand_id, job_id=job_id, url=url, final_url=url, page_type=page_type,
            scrape_status="ERROR", http_status=None, error_message=f"{type(exc).__name__}: {exc}",
            duration=time.perf_counter() - started,
        )

    browser_note = " (browser fallback also blocked)" if used_browser else ""
    if status in (404, 410):
        return _save_page(
            brand_id=brand_id, job_id=job_id, url=url, final_url=final_url, page_type=page_type,
            scrape_status="ERROR", http_status=status, error_message=f"HTTP {status}{browser_note}",
            duration=time.perf_counter() - started,
        )
    if status in (403, 429):
        return _save_page(
            brand_id=brand_id, job_id=job_id, url=url, final_url=final_url, page_type=page_type,
            scrape_status="BLOCKED", http_status=status, error_message=f"HTTP {status}{browser_note}",
            duration=time.perf_counter() - started,
        )
    if status >= 400 or not html:
        return _save_page(
            brand_id=brand_id, job_id=job_id, url=url, final_url=final_url, page_type=page_type,
            scrape_status="ERROR", http_status=status, error_message=f"HTTP {status}{browser_note}",
            duration=time.perf_counter() - started,
        )

    page = extract_page(html, url, final_url, status, target_host)
    page.important_text = detectors.extract_signals(page)

    page_hash = normalizer.page_content_hash(page)
    norm_hash = normalizer.normalized_content_hash(page)

    with get_session() as session:
        previous = deduplicator.previous_page_for(session, brand_id, url)
        # Extract plain scalars before the session closes below — get_session()
        # commits on exit, which expires every attribute by default, so
        # reading them off `previous` afterward would raise "not bound to a
        # Session" the same way an out-of-session Offer/Brand access does.
        previous_exists = previous is not None
        previous_hash = previous.normalized_content_hash if previous else None
        previous_sale_score = previous.sale_score if previous else None
        previous_offer_id = previous.offer_id if previous else None

    if previous_exists and previous_hash == norm_hash:
        return _save_page(
            brand_id=brand_id, job_id=job_id, url=url, final_url=final_url, page_type=page_type,
            scrape_status="UNCHANGED", http_status=status, page=page,
            page_hash=page_hash, norm_hash=norm_hash,
            sale_score=previous_sale_score, offer_id=previous_offer_id, ai_analyzed=False,
            duration=time.perf_counter() - started,
        )

    relevance = detectors.evaluate(page)
    ai_analyzed = False
    ai_result: dict | None = None
    offer_id = None
    scrape_status = "UPDATED" if previous_exists else "NEW"

    should_call_ai = relevance.status == detectors.STRONG or (
        relevance.status == detectors.WEAK and WEBSITE_SCRAPE_AI_ON_WEAK_SIGNAL
    )
    if relevance.status == detectors.NOT_SALE:
        scrape_status = "NOT_SALE"
    elif should_call_ai:
        candidate = ExtractedSaleCandidate(
            page=page, page_content_hash=page_hash, normalized_content_hash=norm_hash,
            sale_score=relevance.score, rule_status=relevance.status,
        )
        ai_result = sale_matcher.analyze(brand_name, candidate)
        ai_analyzed = True
        if ai_result and ai_result.get("is_offer"):
            scrape_status = "SALE_DETECTED"
            with get_session() as session:
                fresh_brand = session.query(Brand).filter(Brand.id == brand_id).first() if brand_id else None
                from services.website_scraper.offer_processor import create_or_update_offer

                temp_page = WebsiteScrapedPage(url=url, final_url=final_url)
                offer, _created = create_or_update_offer(session, temp_page, ai_result, fresh_brand)
                offer_id = offer.id
        else:
            scrape_status = "NOT_SALE"
    else:
        scrape_status = "NOT_SALE"

    return _save_page(
        brand_id=brand_id, job_id=job_id, url=url, final_url=final_url, page_type=page_type,
        scrape_status=scrape_status, http_status=status, page=page,
        page_hash=page_hash, norm_hash=norm_hash, sale_score=relevance.score,
        ai_analyzed=ai_analyzed, ai_result=ai_result, offer_id=offer_id,
        duration=time.perf_counter() - started,
    )


def _save_page(
    *, brand_id, job_id, url, final_url, page_type, scrape_status, http_status,
    page=None, page_hash=None, norm_hash=None, sale_score=None, ai_analyzed=False,
    ai_result=None, offer_id=None, error_message=None, duration=0.0,
) -> dict:
    """Returns a plain dict, not the ORM row — get_session()'s commit expires
    every attribute by default, so returning the row itself would raise
    "not bound to a Session" the moment any field is read after this
    function returns (SQLAlchemy's expire_on_commit=True default)."""
    with get_session() as session:
        row = WebsiteScrapedPage(
            brand_id=brand_id, job_id=job_id, url=url, final_url=final_url, page_type=page_type,
            page_title=page.page_title if page else None,
            meta_description=page.meta_description if page else None,
            canonical_url=page.canonical_url if page else None,
            headline_text=page.headline_text if page else None,
            body_text=(page.body_text[:8000] if page else None),
            important_text=json.dumps(page.important_text) if page else None,
            images=json.dumps(page.images) if page else None,
            image_alt_text=json.dumps(page.image_alt_text) if page else None,
            detected_prices=json.dumps([{"original": p.original, "current": p.current} for p in page.detected_prices]) if page else None,
            discount_percentages=json.dumps(page.discount_percentages) if page else None,
            coupon_codes=json.dumps(page.coupon_codes) if page else None,
            links=json.dumps(page.links) if page else None,
            page_content_hash=page_hash,
            normalized_content_hash=norm_hash,
            sale_score=sale_score,
            scrape_status=scrape_status,
            ai_analyzed=ai_analyzed,
            ai_result=json.dumps(ai_result) if ai_result is not None else None,
            offer_id=offer_id,
            http_status=http_status,
            error_message=error_message,
            processing_duration=round(duration, 3),
        )
        session.add(row)
        session.flush()
        return _page_to_dict(row)


def job_outcome_for(scrape_status: str) -> str:
    return _JOB_OUTCOME.get(scrape_status, "successful")


def finalize_brand_scrape(job_id: int, brand_id: int) -> None:
    """Runs closure detection for the brand's other open offers and updates
    WebsiteScrapeLog — called once after every page in the job has been
    processed (services/jobs/website_scrape_brand.py's after_run)."""
    with get_session() as session:
        brand = session.query(Brand).filter(Brand.id == brand_id).first()
        if brand is None:
            return
        rows = session.query(WebsiteScrapedPage).filter(WebsiteScrapedPage.job_id == job_id).all()

        fetched_ok = {r.final_url or r.url for r in rows if r.http_status and r.http_status < 400}
        fetched_gone = {r.final_url or r.url for r in rows if r.http_status in (404, 410)}
        matched_offer_ids = {r.offer_id for r in rows if r.offer_id}

        closure_detector.apply(
            session, brand.name,
            fetched_ok_urls=fetched_ok, fetched_gone_urls=fetched_gone, matched_offer_ids=matched_offer_ids,
        )

        now = utcnow()
        log = session.query(WebsiteScrapeLog).filter(WebsiteScrapeLog.brand_id == brand_id).first()
        if log is None:
            log = WebsiteScrapeLog(brand_id=brand_id, first_scraped_at=now)
            session.add(log)

        any_ok = bool(fetched_ok)
        any_change = any(r.scrape_status in ("NEW", "UPDATED", "SALE_DETECTED") for r in rows)
        any_sale = any(r.scrape_status == "SALE_DETECTED" for r in rows)
        errors = [r.error_message for r in rows if r.error_message]

        log.last_scraped_at = now
        log.total_scrape_count = (log.total_scrape_count or 0) + 1
        log.pages_discovered = len(rows)
        log.status = "success" if any_ok else "failed"
        log.error_message = None if any_ok else "; ".join(errors[:3]) or "No pages could be fetched"
        if any_ok:
            log.last_successful_scrape_at = now
        if any_change:
            log.last_content_change_at = now
        if any_sale:
            log.last_detected_sale_at = now


def get_scrape_history(brand_id: int) -> dict | None:
    with get_session() as session:
        log = session.query(WebsiteScrapeLog).filter(WebsiteScrapeLog.brand_id == brand_id).first()
        if log is None:
            return None
        return {
            "brand_id": log.brand_id,
            "first_scraped_at": log.first_scraped_at.isoformat() if log.first_scraped_at else None,
            "last_scraped_at": log.last_scraped_at.isoformat() if log.last_scraped_at else None,
            "last_successful_scrape_at": log.last_successful_scrape_at.isoformat() if log.last_successful_scrape_at else None,
            "last_content_change_at": log.last_content_change_at.isoformat() if log.last_content_change_at else None,
            "last_detected_sale_at": log.last_detected_sale_at.isoformat() if log.last_detected_sale_at else None,
            "total_scrape_count": log.total_scrape_count,
            "pages_discovered": log.pages_discovered,
            "status": log.status,
            "error_message": log.error_message,
        }


def get_scraped_pages(brand_id: int, limit: int = 100) -> list[dict]:
    with get_session() as session:
        rows = (
            session.query(WebsiteScrapedPage)
            .filter(WebsiteScrapedPage.brand_id == brand_id)
            .order_by(WebsiteScrapedPage.id.desc())
            .limit(limit)
            .all()
        )
        return [_page_to_dict(r) for r in rows]


def record_discovery_failure(brand_id: int, errors: list[str]) -> None:
    """Called when discover_pages_for_brand() returns zero pages (e.g. the
    homepage itself returned a WAF/bot-detection block) — without this, the
    BackgroundJob machinery treats "no work items" as a plain success
    ("Nothing to do.") and never calls after_run/finalize_brand_scrape, so a
    brand that's actually fully blocked would otherwise show status
    "never_run" forever with zero indication anything was even attempted."""
    with get_session() as session:
        log = session.query(WebsiteScrapeLog).filter(WebsiteScrapeLog.brand_id == brand_id).first()
        now = utcnow()
        if log is None:
            log = WebsiteScrapeLog(brand_id=brand_id, first_scraped_at=now)
            session.add(log)
        log.last_scraped_at = now
        log.total_scrape_count = (log.total_scrape_count or 0) + 1
        log.status = "failed"
        log.error_message = "; ".join(errors[:3]) if errors else "No relevant pages could be discovered"


def get_recent_activity(limit: int = 15) -> list[dict]:
    """Recent job-log lines across every website-scrape job run — powers the
    dashboard's "Recent Scraping Activity" feed with real events (already
    written by services/jobs/website_scrape_brand.py), not synthetic data."""
    from database.models import JobLog

    with get_session() as session:
        rows = (
            session.query(JobLog)
            .filter(JobLog.category == "website")
            .order_by(JobLog.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {"id": r.id, "message": r.message, "severity": r.severity, "time": r.created_at.isoformat()}
            for r in rows
        ]


def get_pages_by_job(job_id: int) -> list[dict]:
    with get_session() as session:
        rows = (
            session.query(WebsiteScrapedPage)
            .filter(WebsiteScrapedPage.job_id == job_id)
            .order_by(WebsiteScrapedPage.id.desc())
            .all()
        )
        return [_page_to_dict(r) for r in rows]


def get_page(page_id: int) -> dict | None:
    with get_session() as session:
        row = session.query(WebsiteScrapedPage).filter(WebsiteScrapedPage.id == page_id).first()
        return _page_to_dict(row) if row else None


def _loads(value):
    if not value:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def _page_to_dict(row: WebsiteScrapedPage) -> dict:
    return {
        "id": row.id,
        "brand_id": row.brand_id,
        "url": row.url,
        "final_url": row.final_url,
        "page_type": row.page_type,
        "page_title": row.page_title,
        "meta_description": row.meta_description,
        "canonical_url": row.canonical_url,
        "headline_text": row.headline_text,
        "body_text": row.body_text,
        "important_text": _loads(row.important_text) or [],
        "images": _loads(row.images) or [],
        "image_alt_text": _loads(row.image_alt_text) or [],
        "detected_prices": _loads(row.detected_prices) or [],
        "discount_percentages": _loads(row.discount_percentages) or [],
        "coupon_codes": _loads(row.coupon_codes) or [],
        "links": _loads(row.links) or [],
        "page_content_hash": row.page_content_hash,
        "normalized_content_hash": row.normalized_content_hash,
        "sale_score": row.sale_score,
        "scrape_status": row.scrape_status,
        "ai_analyzed": row.ai_analyzed,
        "ai_result": _loads(row.ai_result),
        "offer_id": row.offer_id,
        "http_status": row.http_status,
        "error_message": row.error_message,
        "scraped_at": row.scraped_at.isoformat() if row.scraped_at else None,
        "processing_duration": row.processing_duration,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
