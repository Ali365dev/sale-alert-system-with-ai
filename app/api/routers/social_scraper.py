"""Social Media Offer Discovery endpoints — best-effort single-URL preview
fetch, post submission (brand-linked or ad-hoc), the review screen backing a
SocialPost row, manual offer save, and per-brand scrape history. See
services/social_scraper/ for the actual OCR/keyword/AI pipeline and
services/jobs/social_offer_scrape.py for the background job that runs it."""
import json
import threading
from datetime import datetime

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import Brand, Offer, SocialPost
from services import job_runner, job_service

router = APIRouter(prefix="/api/social-scraper", tags=["social_scraper"])


def _post_to_dict(post: SocialPost) -> dict:
    return {
        "id": post.id,
        "brand_id": post.brand_id,
        "platform": post.platform,
        "post_url": post.post_url,
        "caption": post.caption,
        "image_url": post.image_url,
        "post_date": post.post_date.isoformat() if post.post_date else None,
        "ocr_text": post.ocr_text,
        "keyword_score": post.keyword_score,
        "keyword_status": post.keyword_status,
        "keyword_reason": post.keyword_reason,
        "ai_result": json.loads(post.ai_result) if post.ai_result else None,
        "offer_id": post.offer_id,
        "status": post.status,
        "error": post.error,
        "job_id": post.job_id,
        "scraped_at": post.scraped_at.isoformat() if post.scraped_at else None,
        "created_at": post.created_at.isoformat() if post.created_at else None,
    }


@router.post("/fetch-preview")
def fetch_preview(body: dict = Body(default={})):
    """Best-effort auto-fill for the Scrape button — see
    services/social_scraper/post_metadata_fetcher.py's docstring for exactly
    what this can and can't do. No DB write."""
    from services.social_scraper.post_metadata_fetcher import fetch_preview as run_fetch_preview

    body = body or {}
    platform = body.get("platform")
    post_url = (body.get("post_url") or "").strip()
    if platform not in ("facebook", "instagram"):
        return JSONResponse({"error": "platform must be 'facebook' or 'instagram'"}, status_code=400)
    if not post_url:
        return JSONResponse({"error": "post_url is required"}, status_code=400)

    return run_fetch_preview(platform, post_url)


@router.post("/submit")
def submit_post(body: dict = Body(default={})):
    body = body or {}
    platform = body.get("platform")
    post_url = (body.get("post_url") or "").strip()
    brand_id = body.get("brand_id")

    if platform not in ("facebook", "instagram"):
        return JSONResponse({"error": "platform must be 'facebook' or 'instagram'"}, status_code=400)
    if not post_url:
        return JSONResponse({"error": "post_url is required"}, status_code=400)

    post_date = None
    if body.get("post_date"):
        try:
            post_date = datetime.fromisoformat(body["post_date"])
        except (ValueError, TypeError):
            return JSONResponse({"error": "post_date must be ISO-8601"}, status_code=400)

    with get_session() as session:
        if brand_id is not None and session.query(Brand).filter(Brand.id == brand_id).first() is None:
            return JSONResponse({"error": "brand not found"}, status_code=404)
        if session.query(SocialPost).filter(SocialPost.post_url == post_url).first() is not None:
            return JSONResponse({"error": "this post has already been submitted"}, status_code=409)

        post = SocialPost(
            brand_id=brand_id, platform=platform, post_url=post_url,
            caption=(body.get("caption") or "").strip() or None,
            image_url=(body.get("image_url") or "").strip() or None,
            post_date=post_date, status="pending",
        )
        session.add(post)
        session.flush()
        post_id = post.id

    job = job_service.create_job("social_offer_scrape", payload={"social_post_id": post_id})

    with get_session() as session:
        post = session.query(SocialPost).filter(SocialPost.id == post_id).first()
        if post is not None:
            post.job_id = job["id"]

    config = job_runner.get_runner("social_offer_scrape")
    threading.Thread(target=config.run, args=(job["id"], job["payload"]), daemon=True).start()

    return JSONResponse({"postId": post_id, "jobId": job["id"]}, status_code=202)


@router.get("/posts")
def list_posts(brand_id: int | None = Query(None)):
    with get_session() as session:
        q = session.query(SocialPost)
        if brand_id is not None:
            q = q.filter(SocialPost.brand_id == brand_id)
        posts = q.order_by(SocialPost.created_at.desc()).limit(50).all()
        return {"posts": [_post_to_dict(p) for p in posts]}


@router.get("/posts/{post_id}")
def get_post(post_id: int):
    with get_session() as session:
        post = session.query(SocialPost).filter(SocialPost.id == post_id).first()
        if post is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        result = _post_to_dict(post)
        if post.offer_id:
            offer = session.query(Offer).filter(Offer.id == post.offer_id).first()
            result["offer"] = (
                {"id": offer.id, "title": offer.title, "brand": offer.brand, "discount_percentage": offer.discount_percentage}
                if offer else None
            )
        return result


@router.post("/posts/{post_id}/save-offer")
def save_offer(post_id: int):
    """Manual override — the spec's always-available "Save as Offer" button
    on the Test page. No-ops (returns the existing offer) if the pipeline
    already created one; requires the post to have finished processing
    (ai_result populated) so there's real content to build an offer from."""
    from services.social_scraper.offer_builder import build_offer_from_social

    with get_session() as session:
        post = session.query(SocialPost).filter(SocialPost.id == post_id).first()
        if post is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        if post.offer_id:
            offer = session.query(Offer).filter(Offer.id == post.offer_id).first()
            return {"offer_id": post.offer_id, "brand": offer.brand if offer else None, "already_existed": True}
        if not post.ai_result:
            return JSONResponse({"error": "this post hasn't finished processing yet"}, status_code=400)

        brand = session.query(Brand).filter(Brand.id == post.brand_id).first() if post.brand_id else None
        offer = build_offer_from_social(post, json.loads(post.ai_result), brand)
        session.add(offer)
        session.flush()
        post.offer_id = offer.id
        return {"offer_id": offer.id, "brand": offer.brand, "already_existed": False}


@router.get("/scrape-history")
def scrape_history(brand_id: int = Query(...)):
    from services.social_scraper.history_service import get_history_for_brand

    return {"history": get_history_for_brand(brand_id)}
