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
from database.models import BankCardOffer
from services import bank_offer_admin, bank_offers_store, job_runner, job_service, scraped_business_store
from services.scraped_business_store import offer_dict

router = APIRouter(prefix="/api/bank-offers", tags=["bank_offers"], dependencies=[Depends(require_admin)])


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


@router.post("/import")
def import_business(body: dict = Body(...)):
    """Imports businesses from the chrome extension.

    Accepts two formats:
      - Bulk standard: { "businesses": [{business_id, name, banks, branches}, ...] }
      - Legacy single: TakhfifBusinessDetail JSON (has "slug" key)
    """
    # Bulk standard format
    if "businesses" in body:
        businesses = body["businesses"]
        if not isinstance(businesses, list) or not businesses:
            return JSONResponse({"error": "businesses must be a non-empty list"}, status_code=400)
        result = scraped_business_store.upsert_businesses_bulk(businesses)
        return JSONResponse(result, status_code=201)

    # Legacy single format
    if not (body.get("slug") or body.get("business_id") or "").strip():
        return JSONResponse({"error": "slug/business_id and name are required"}, status_code=400)
    if not (body.get("name") or "").strip():
        return JSONResponse({"error": "name is required"}, status_code=400)
    result = scraped_business_store.upsert_business(body)
    if "error" in result:
        return JSONResponse(result, status_code=400)
    return JSONResponse(result, status_code=201)


@router.get("/businesses")
def list_businesses(
    q: str | None = Query(default=None),
    matched_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    return scraped_business_store.list_businesses(limit, offset, q, matched_only)


@router.get("/businesses/{business_id}")
def get_business(business_id: int):
    detail = scraped_business_store.get_business(business_id)
    if detail is None:
        return JSONResponse({"error": "business not found"}, status_code=404)
    return detail


@router.patch("/businesses/{business_id}/brand")
def set_business_brand(business_id: int, body: dict = Body(...)):
    """Admin override of the brand match. {"brand_id": N} links, null clears."""
    result = scraped_business_store.set_business_brand(business_id, body.get("brand_id"))
    if result is None:
        return JSONResponse({"error": "business not found"}, status_code=404)
    if "error" in result:
        return JSONResponse(result, status_code=400)
    return result


@router.delete("/businesses/{business_id}")
def delete_business(business_id: int):
    if not scraped_business_store.delete_business(business_id):
        return JSONResponse({"error": "business not found"}, status_code=404)
    return {"deleted": True}


@router.get("/combined/{brand_id}")
def combined_offers(brand_id: int):
    """Merged view for a catalog brand: its sale offers + bank-card offers
    + linked scraped businesses."""
    result = scraped_business_store.combined_offers(brand_id)
    if result is None:
        return JSONResponse({"error": "brand not found"}, status_code=404)
    return result


@router.get("")
def list_bank_offers(
    q: str | None = Query(default=None),
    brand_id: int | None = Query(default=None),
    business_id: int | None = Query(default=None),
    bank_name: str | None = Query(default=None),
    card_name: str | None = Query(default=None),
    status: str | None = Query(default=None, pattern="^(active|inactive|expired)$"),
    matched_only: bool = Query(default=False),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    with get_session() as session:
        base = session.query(BankCardOffer)
        if q:
            pattern = f"%{q}%"
            base = base.filter(BankCardOffer.place_name.ilike(pattern) | BankCardOffer.card_name.ilike(pattern))
        if brand_id is not None:
            base = base.filter(BankCardOffer.brand_id == brand_id)
        if business_id is not None:
            base = base.filter(BankCardOffer.business_id == business_id)
        if bank_name:
            base = base.filter(BankCardOffer.bank_name == bank_name)
        if card_name:
            base = base.filter(BankCardOffer.card_name == card_name)
        if status == "active":
            base = base.filter(BankCardOffer.is_active.is_(True))
        elif status == "inactive":
            base = base.filter(BankCardOffer.is_active.is_(False))
        elif status == "expired":
            base = base.filter(BankCardOffer.expiry_date < datetime.utcnow())
        if matched_only:
            base = base.filter(BankCardOffer.brand_id.isnot(None))

        total = base.count()
        matched_count = base.filter(BankCardOffer.brand_id.isnot(None)).count()
        active_count = base.filter(BankCardOffer.is_active.is_(True)).count()
        with_expiry_count = base.filter(BankCardOffer.expiry_date.isnot(None)).count()
        with_max_disc_count = base.filter(BankCardOffer.max_discount_amount.isnot(None)).count()

        rows = base.order_by(BankCardOffer.created_at.desc()).offset(offset).limit(limit).all()
        brand_map = bank_offer_admin.brand_names(session, {r.brand_id for r in rows if r.brand_id is not None})

        all_banks = [
            r[0] for r in session.query(BankCardOffer.bank_name)
            .filter(BankCardOffer.bank_name.isnot(None))
            .distinct().order_by(BankCardOffer.bank_name).all()
        ]

        return {
            "total": total,
            "matched_count": matched_count,
            "active_count": active_count,
            "with_expiry_count": with_expiry_count,
            "with_max_disc_count": with_max_disc_count,
            "offers": [{**offer_dict(r), "brand_name": brand_map.get(r.brand_id)} for r in rows],
            "bank_names": all_banks,
        }


def _not_found_or(result: dict | None, what: str, status_code: int = 200):
    if result is None:
        return JSONResponse({"error": f"{what} not found"}, status_code=404)
    if "error" in result:
        return JSONResponse(result, status_code=400)
    return JSONResponse(result, status_code=status_code)


@router.post("/businesses")
def create_business(body: dict = Body(...)):
    return _not_found_or(bank_offer_admin.create_business(body), "business", status_code=201)


@router.patch("/businesses/{business_id}")
def update_business(business_id: int, body: dict = Body(...)):
    return _not_found_or(bank_offer_admin.update_business(business_id, body), "business")


@router.post("/offers")
def create_offer(body: dict = Body(...)):
    return _not_found_or(bank_offer_admin.create_offer(body), "offer", status_code=201)


@router.patch("/offers/{offer_id}")
def update_offer(offer_id: int, body: dict = Body(...)):
    return _not_found_or(bank_offer_admin.update_offer(offer_id, body), "offer")


@router.delete("/offers/{offer_id}")
def delete_offer(offer_id: int):
    if not bank_offer_admin.delete_offers([offer_id]):
        return JSONResponse({"error": "offer not found"}, status_code=404)
    return {"deleted": 1}


@router.post("/offers/bulk")
def bulk_offers(body: dict = Body(...)):
    """{"ids": [...], "action": "delete" | "activate" | "deactivate"}"""
    ids = [int(i) for i in body.get("ids") or []]
    action = body.get("action")
    if not ids:
        return JSONResponse({"error": "ids is required"}, status_code=400)
    if action == "delete":
        return {"affected": bank_offer_admin.delete_offers(ids)}
    if action in ("activate", "deactivate"):
        return {"affected": bank_offer_admin.set_offers_active(ids, action == "activate")}
    return JSONResponse({"error": "action must be delete, activate or deactivate"}, status_code=400)


@router.get("/banks")
def list_banks():
    return {"banks": bank_offer_admin.list_banks()}


@router.patch("/banks")
def update_bank(bank_name: str = Query(...), body: dict = Body(...)):
    """Renames a bank / sets its logo / toggles all its offers, across every row."""
    return bank_offer_admin.update_bank(bank_name, body)


@router.delete("/banks")
def delete_bank(bank_name: str = Query(...)):
    return {"deleted": bank_offer_admin.delete_bank(bank_name)}


@router.patch("/cards")
def update_card(bank_name: str = Query(...), card_name: str | None = Query(default=None), body: dict = Body(...)):
    """Omitting card_name targets the bank's rows with no card name."""
    return _not_found_or(bank_offer_admin.update_card(bank_name, card_name, body), "card")


@router.delete("/cards")
def delete_card(bank_name: str = Query(...), card_name: str | None = Query(default=None)):
    return {"deleted": bank_offer_admin.delete_card(bank_name, card_name)}
