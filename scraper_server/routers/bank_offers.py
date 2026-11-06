"""Admin endpoints for bank-card offers — triggering/inspecting the
takhfif.app scrape job, and saving rows the chrome extension's Bank Offers
mode extracted manually from some other, less-structured deal site. See
services/takhfif_scraper.py, jobs/scrape_takhfif.py, and
services/bank_offers_store.py (the write path both of these share)."""
import threading
from datetime import datetime

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse

from core.security import require_admin
from database.db import get_session
from database.models import BankCardOffer, Brand
from services import bank_offers_store, job_runner, job_service

router = APIRouter(prefix="/api/bank-offers", tags=["bank_offers"], dependencies=[Depends(require_admin)])


def _row_to_dict(row: BankCardOffer, brand_name: str | None) -> dict:
    return {
        "id": row.id,
        "source_url": row.source_url,
        "place_name": row.place_name,
        "place_website": row.place_website,
        "brand_id": row.brand_id,
        "brand_name": brand_name,
        "bank_name": row.bank_name,
        "card_name": row.card_name,
        "discount_percentage": row.discount_percentage,
        "currency": row.currency,
        "expiry_date": row.expiry_date.isoformat() if row.expiry_date else None,
        "description": row.description,
        "created_at": row.created_at.isoformat(),
    }


@router.post("/scrape")
def scrape_now(body: dict = Body(default={})):
    """Enqueue a takhfif.app scrape. Pass {"max_pages": N} to limit it while
    testing — defaults to the full 101-page catalog."""
    payload = {"max_pages": (body or {}).get("max_pages", 101)}
    job = job_service.create_job("scrape_takhfif_bank_offers", payload=payload)

    runner = job_runner.get_runner("scrape_takhfif_bank_offers")
    threading.Thread(target=runner.run, args=(job["id"], job["payload"]), daemon=True).start()

    return JSONResponse({"jobId": job["id"]}, status_code=202)


@router.post("/manual")
def save_manual_offers(body: dict = Body(...)):
    """Saves bank-card offer rows the chrome extension's Bank Offers mode
    extracted via its visual picker from one page. Re-saving the same
    source_url replaces its previous rows, same as the automated scrape."""
    source_url = (body.get("source_url") or "").strip()
    place_name = (body.get("place_name") or "").strip()
    place_website = (body.get("place_website") or "").strip() or None
    raw_offers = body.get("offers") or []

    if not source_url or not place_name:
        return JSONResponse({"error": "source_url and place_name are required"}, status_code=400)
    if not raw_offers:
        return JSONResponse({"error": "offers is required"}, status_code=400)

    offers = []
    for row in raw_offers:
        bank_name = (row.get("bank_name") or "").strip()
        if not bank_name:
            continue
        try:
            discount = float(row["discount_percentage"]) if row.get("discount_percentage") not in (None, "") else None
        except (TypeError, ValueError):
            discount = None
        expiry_raw = (row.get("expiry_date") or "").strip()
        try:
            expiry = datetime.fromisoformat(expiry_raw) if expiry_raw else None
        except ValueError:
            expiry = None  # free-text expiry the admin didn't edit into ISO form — left blank
        card_name = (row.get("card_name") or "").strip() or None
        offers.append({
            "bank_name": bank_name,
            "card_name": card_name,
            "discount_percentage": discount,
            "currency": None,
            "expiry_date": expiry,
            "description": card_name,
        })

    if not offers:
        return JSONResponse({"error": "no valid bank offer rows (bank_name is required on each)"}, status_code=400)

    count = bank_offers_store.upsert_place_offers(source_url, place_name, place_website, None, offers)
    return JSONResponse({"saved": count}, status_code=201)


@router.get("")
def list_bank_offers(
    brand_id: int | None = Query(default=None),
    bank_name: str | None = Query(default=None),
    matched_only: bool = Query(default=False),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    with get_session() as session:
        q = session.query(BankCardOffer)
        if brand_id is not None:
            q = q.filter(BankCardOffer.brand_id == brand_id)
        if bank_name:
            q = q.filter(BankCardOffer.bank_name == bank_name)
        if matched_only:
            q = q.filter(BankCardOffer.brand_id.isnot(None))

        total = q.count()
        rows = q.order_by(BankCardOffer.created_at.desc()).offset(offset).limit(limit).all()

        brand_ids = {r.brand_id for r in rows if r.brand_id is not None}
        brand_names = {}
        if brand_ids:
            for b in session.query(Brand).filter(Brand.id.in_(brand_ids)).all():
                brand_names[b.id] = b.name

        return {
            "total": total,
            "offers": [_row_to_dict(r, brand_names.get(r.brand_id)) for r in rows],
        }
