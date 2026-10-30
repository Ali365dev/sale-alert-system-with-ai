"""Orchestrates one submitted SocialPost: OCR its image (if any) -> keyword-
score the combined caption+OCR text -> AI-analyze it (skipped only when the
keyword pass already confidently rules it out) -> create an Offer if it's a
genuine offer -> record scrape history. Mirrors services/brand_discovery/
pipeline.py's shape (same app, same conventions) — see that module if this
one looks unfamiliar.

No automated fetch happens here — see services/social_scraper/
post_metadata_fetcher.py's docstring for why. This module starts from a
SocialPost row that already has its platform/post_url/caption/image_url set
(admin-submitted, optionally best-effort auto-filled for that one URL)."""
import json
from datetime import datetime, timezone

from database.db import get_session
from database.models import Brand, Offer, SocialPost
from services import job_service
from services.social_scraper.offer_builder import build_offer_from_social

# Keyword pass is skipped from AI analysis only at this floor — mirrors
# ai/sale_filter.py's NOT_SALE_RELATED bucket exactly (see that module: only
# the clearly-not-a-sale bucket skips the AI call, "needs_review" still goes
# to full analysis since missing a real offer is worse than one extra call).
from ai.sale_filter import NOT_SALE_RELATED


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def run(job_id: int, social_post_id: int) -> str:
    """Returns "successful" | "failed" — a BackgroundJob.process_item outcome."""
    with get_session() as session:
        post = session.query(SocialPost).filter(SocialPost.id == social_post_id).first()
        if post is None:
            return "failed"
        platform, post_url, caption, image_url, brand_id = (
            post.platform, post.post_url, post.caption, post.image_url, post.brand_id,
        )
        post.status = "processing"

    ocr_text = ""
    if image_url:
        job_service.set_stage(job_id, "downloading_image")
        job_service.set_stage(job_id, "running_ocr")
        ocr_text = _run_ocr(image_url)

    job_service.set_stage(job_id, "detecting_keywords")
    from ai.sale_filter import evaluate

    relevance = evaluate(caption or "", "", ocr_text)

    ai_result = None
    if relevance.status != NOT_SALE_RELATED:
        job_service.set_stage(job_id, "ai_analysis")
        from ai.social_offer_analyzer import analyze_social_post

        ai_result = analyze_social_post(caption or "", ocr_text, platform)

    job_service.set_stage(job_id, "checking_duplicate")
    # Real dedup already happened at submit time (SocialPost.post_url is
    # unique) — this stage exists so the progress UI matches the spec's step
    # list; nothing further to check here.

    job_service.set_stage(job_id, "creating_offer")
    offer_id = None
    is_offer = bool(ai_result and ai_result.get("is_offer"))

    with get_session() as session:
        post = session.query(SocialPost).filter(SocialPost.id == social_post_id).first()
        if post is None:
            return "failed"

        post.ocr_text = ocr_text or None
        post.keyword_score = relevance.score
        post.keyword_status = relevance.status
        post.keyword_reason = relevance.reason
        post.ai_result = json.dumps(ai_result) if ai_result is not None else None

        if is_offer:
            brand = session.query(Brand).filter(Brand.id == brand_id).first() if brand_id else None
            offer = build_offer_from_social(post, ai_result, brand)
            session.add(offer)
            session.flush()
            offer_id = offer.id
            post.offer_id = offer_id

        post.status = "processed"
        post.error = None

    if brand_id is not None:
        from services.social_scraper.history_service import record_scrape_result

        record_scrape_result(
            brand_id=brand_id, platform=platform, post_url=post_url,
            status="success", error_message=None, offer_created=is_offer,
        )

    return "successful"


def _run_ocr(image_url: str) -> str:
    from ai import ocr_cache
    from ai.ocr import process_image_url

    cache = ocr_cache.load()
    try:
        result = process_image_url(image_url, cache)
    finally:
        ocr_cache.save(cache)
    return result["text"] if result else ""


def mark_failed(job_id: int, social_post_id: int, error: str) -> None:
    """Called by the job on an unexpected exception — records the failure on
    both the SocialPost row and (if brand-linked) the scrape history, same
    fail-soft-per-item convention as every other job in this app."""
    with get_session() as session:
        post = session.query(SocialPost).filter(SocialPost.id == social_post_id).first()
        if post is None:
            return
        post.status = "failed"
        post.error = error[:2000]
        brand_id, platform, post_url = post.brand_id, post.platform, post.post_url

    if brand_id is not None:
        from services.social_scraper.history_service import record_scrape_result

        record_scrape_result(
            brand_id=brand_id, platform=platform, post_url=post_url,
            status="failed", error_message=error[:2000], offer_created=False,
        )
