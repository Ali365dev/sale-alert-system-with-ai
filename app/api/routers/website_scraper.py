"""Website Sale Scraper endpoints — brand dashboard summary, on-demand scrape
trigger (per-brand or ad-hoc URL), scraped-page inspection/reprocess, active
website offers, per-brand URL configuration, and manual offer closure. See
services/website_scraper/ for the extraction/detection/AI pipeline and
services/jobs/website_scrape_brand.py for the background job that runs it.
Mirrors app/api/routers/social_scraper.py's shape."""
import json
import threading
from datetime import datetime

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func

from app.core.security import require_admin
from database.db import get_session
from database.models import Brand, Offer, WebsiteScrapeLog
from services import job_runner, job_service
from services.website_scraper import services as website_scraper_services

router = APIRouter(prefix="/api/website-scraper", tags=["website_scraper"], dependencies=[Depends(require_admin)])


def _start_job(job_type: str, payload: dict) -> dict:
    job = job_service.create_job(job_type, payload=payload)
    config = job_runner.get_runner(job_type)
    threading.Thread(target=config.run, args=(job["id"], job["payload"]), daemon=True).start()
    return job


@router.post("/scrape-now")
def scrape_now(body: dict = Body(default={})):
    body = body or {}
    brand_id = body.get("brand_id")
    url = (body.get("url") or "").strip() or None

    if brand_id is None and url is None:
        return JSONResponse({"error": "brand_id or url is required"}, status_code=400)
    brand_name = None
    if brand_id is not None:
        with get_session() as session:
            brand = session.query(Brand).filter(Brand.id == brand_id).first()
            if brand is None:
                return JSONResponse({"error": "brand not found"}, status_code=404)
            brand_name = brand.name

    payload: dict = {}
    if brand_id is not None:
        payload["brand_id"] = brand_id
        payload["brand_name"] = brand_name
    if url is not None:
        payload["url"] = url

    job = _start_job("website_scrape_brand", payload)
    return JSONResponse({"jobId": job["id"]}, status_code=202)


@router.get("/brands")
def list_brands():
    """Dashboard summary (spec §10): every brand with website scraping
    enabled, joined with its scrape log and offer counts."""
    with get_session() as session:
        brands = session.query(Brand).filter(Brand.is_active == True).order_by(Brand.name).all()  # noqa: E712
        logs = {log.brand_id: log for log in session.query(WebsiteScrapeLog).all()}

        # Single grouped query instead of two COUNT(*) round-trips per brand —
        # this remote DB has enough per-query latency that an N+1 pattern
        # here made the endpoint take minutes for ~140 brands.
        total_counts: dict[str, int] = dict(
            session.query(Offer.brand, func.count(Offer.id)).filter(Offer.source == "website").group_by(Offer.brand).all()
        )
        active_counts: dict[str, int] = dict(
            session.query(Offer.brand, func.count(Offer.id))
            .filter(Offer.source == "website", Offer.is_active == True)  # noqa: E712
            .group_by(Offer.brand)
            .all()
        )

        rows = []
        for brand in brands:
            homepage = brand.homepage_url or brand.website
            if not homepage:
                continue
            log = logs.get(brand.id)
            active_offers = active_counts.get(brand.name, 0)
            total_offers = total_counts.get(brand.name, 0)
            rows.append({
                "brand_id": brand.id,
                "brand_name": brand.name,
                "website": homepage,
                "scraping_enabled": brand.website_scraping_enabled,
                "last_scraped_at": log.last_scraped_at.isoformat() if log and log.last_scraped_at else None,
                "last_successful_scrape_at": log.last_successful_scrape_at.isoformat() if log and log.last_successful_scrape_at else None,
                "last_content_change_at": log.last_content_change_at.isoformat() if log and log.last_content_change_at else None,
                "pages_discovered": log.pages_discovered if log else 0,
                "active_offers": active_offers,
                "total_offers": total_offers,
                "status": log.status if log else "never_run",
                "last_error": log.error_message if log else None,
            })
        return {"brands": rows}


@router.get("/activity")
def recent_activity():
    return {"activity": website_scraper_services.get_recent_activity()}


@router.get("/brands/{brand_id}/config")
def get_brand_config(brand_id: int):
    with get_session() as session:
        brand = session.query(Brand).filter(Brand.id == brand_id).first()
        if brand is None:
            return JSONResponse({"error": "brand not found"}, status_code=404)
        return {
            "brand_id": brand.id,
            "homepage_url": brand.homepage_url,
            "sale_page_url": brand.sale_page_url,
            "offers_page_url": brand.offers_page_url,
            "promotions_page_url": brand.promotions_page_url,
            "custom_scrape_urls": json.loads(brand.custom_scrape_urls) if brand.custom_scrape_urls else [],
            "website_scraping_enabled": brand.website_scraping_enabled,
        }


@router.get("/brands/{brand_id}/pages")
def brand_pages(brand_id: int):
    return {"pages": website_scraper_services.get_scraped_pages(brand_id)}


@router.get("/jobs/{job_id}/pages")
def job_pages(job_id: int):
    """Pages scraped by one job run — works for ad-hoc (no brand_id) test
    scrapes too, unlike /brands/{id}/pages."""
    return {"pages": website_scraper_services.get_pages_by_job(job_id)}


@router.get("/brands/{brand_id}/history")
def brand_history(brand_id: int):
    history = website_scraper_services.get_scrape_history(brand_id)
    if history is None:
        return {"history": None}
    return {"history": history}


@router.get("/brands/{brand_id}/offers")
def brand_offers(brand_id: int):
    with get_session() as session:
        brand = session.query(Brand).filter(Brand.id == brand_id).first()
        if brand is None:
            return JSONResponse({"error": "brand not found"}, status_code=404)
        offers = (
            session.query(Offer)
            .filter(Offer.source == "website", Offer.brand == brand.name)
            .order_by(Offer.id.desc())
            .all()
        )
        return {"offers": [_offer_to_dict(o) for o in offers]}


@router.post("/brands/{brand_id}/config")
def update_brand_config(brand_id: int, body: dict = Body(default={})):
    body = body or {}
    with get_session() as session:
        brand = session.query(Brand).filter(Brand.id == brand_id).first()
        if brand is None:
            return JSONResponse({"error": "brand not found"}, status_code=404)

        for field in ("homepage_url", "sale_page_url", "offers_page_url", "promotions_page_url"):
            if field in body:
                setattr(brand, field, (body[field] or "").strip() or None)
        if "custom_scrape_urls" in body:
            urls = [u.strip() for u in (body.get("custom_scrape_urls") or []) if u and u.strip()]
            brand.custom_scrape_urls = json.dumps(urls) if urls else None
        if "website_scraping_enabled" in body:
            brand.website_scraping_enabled = bool(body["website_scraping_enabled"])

        session.flush()
        return {
            "brand_id": brand.id,
            "homepage_url": brand.homepage_url,
            "sale_page_url": brand.sale_page_url,
            "offers_page_url": brand.offers_page_url,
            "promotions_page_url": brand.promotions_page_url,
            "custom_scrape_urls": json.loads(brand.custom_scrape_urls) if brand.custom_scrape_urls else [],
            "website_scraping_enabled": brand.website_scraping_enabled,
        }


@router.get("/pages/{page_id}")
def get_page(page_id: int):
    page = website_scraper_services.get_page(page_id)
    if page is None:
        return JSONResponse({"error": "page not found"}, status_code=404)
    return page


@router.post("/pages/{page_id}/reprocess")
def reprocess_page(page_id: int):
    """Re-fetches and re-runs the full pipeline for this page's URL —
    spawns a normal scrape-now job scoped to just that one URL."""
    with get_session() as session:
        from database.models import WebsiteScrapedPage

        row = session.query(WebsiteScrapedPage).filter(WebsiteScrapedPage.id == page_id).first()
        if row is None:
            return JSONResponse({"error": "page not found"}, status_code=404)
        url, brand_id = row.url, row.brand_id

    payload = {"url": url}
    if brand_id is not None:
        payload["brand_id"] = brand_id
    job = _start_job("website_scrape_brand", payload)
    return JSONResponse({"jobId": job["id"]}, status_code=202)


@router.post("/pages/{page_id}/reanalyze")
def reanalyze_page(page_id: int):
    """Re-runs AI analysis on already-stored extracted content, without
    refetching the page — cheap re-check after tuning the prompt/thresholds."""
    from database.models import WebsiteScrapedPage
    from services.website_scraper import detectors, sale_matcher
    from services.website_scraper.models import ExtractedSaleCandidate, PriceInfo, RawPage

    with get_session() as session:
        row = session.query(WebsiteScrapedPage).filter(WebsiteScrapedPage.id == page_id).first()
        if row is None:
            return JSONResponse({"error": "page not found"}, status_code=404)
        brand = session.query(Brand).filter(Brand.id == row.brand_id).first() if row.brand_id else None

        page = RawPage(
            url=row.url, final_url=row.final_url or row.url, http_status=row.http_status or 200, html="",
            page_title=row.page_title, meta_description=row.meta_description, canonical_url=row.canonical_url,
            headline_text=row.headline_text or "", body_text=row.body_text or "",
            important_text=json.loads(row.important_text) if row.important_text else [],
            images=json.loads(row.images) if row.images else [],
            image_alt_text=json.loads(row.image_alt_text) if row.image_alt_text else [],
            detected_prices=[PriceInfo(**p) for p in (json.loads(row.detected_prices) if row.detected_prices else [])],
            discount_percentages=json.loads(row.discount_percentages) if row.discount_percentages else [],
            coupon_codes=json.loads(row.coupon_codes) if row.coupon_codes else [],
            links=json.loads(row.links) if row.links else [],
        )
        relevance = detectors.evaluate(page)
        candidate = ExtractedSaleCandidate(
            page=page, page_content_hash=row.page_content_hash or "", normalized_content_hash=row.normalized_content_hash or "",
            sale_score=relevance.score, rule_status=relevance.status,
        )
        ai_result = sale_matcher.analyze(brand.name if brand else None, candidate)

        row.sale_score = relevance.score
        row.ai_analyzed = True
        row.ai_result = json.dumps(ai_result) if ai_result is not None else None
        if ai_result and ai_result.get("is_offer"):
            from services.website_scraper.offer_processor import create_or_update_offer

            offer, _created = create_or_update_offer(session, row, ai_result, brand)
            row.offer_id = offer.id
            row.scrape_status = "SALE_DETECTED"
        else:
            row.scrape_status = "NOT_SALE"
        session.flush()
        page_id_for_lookup = row.id
    return website_scraper_services.get_page(page_id_for_lookup)


@router.patch("/offers/{offer_id}/close")
def close_offer(offer_id: int):
    from services.website_scraper import closure_detector

    with get_session() as session:
        offer = session.query(Offer).filter(Offer.id == offer_id, Offer.source == "website").first()
        if offer is None:
            return JSONResponse({"error": "website offer not found"}, status_code=404)
        closure_detector.close_manually(session, offer)
        session.flush()
        return _offer_to_dict(offer)


def _offer_to_dict(o: Offer) -> dict:
    return {
        "id": o.id,
        "title": o.title,
        "brand": o.brand,
        "discount_percentage": o.discount_percentage,
        "coupon_code": o.coupon_code,
        "offer_type": o.offer_type,
        "summary": o.summary,
        "website": o.website,
        "source": o.source,
        "source_url": o.source_url,
        "closure_status": o.closure_status,
        "missing_count": o.missing_count,
        "is_active": o.is_active,
        "expiry_date": o.expiry_date.isoformat() if isinstance(o.expiry_date, datetime) else o.expiry_date,
        "first_seen_at": o.first_seen_at.isoformat() if o.first_seen_at else None,
        "last_seen_at": o.last_seen_at.isoformat() if o.last_seen_at else None,
        "last_verified_at": o.last_verified_at.isoformat() if o.last_verified_at else None,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }
