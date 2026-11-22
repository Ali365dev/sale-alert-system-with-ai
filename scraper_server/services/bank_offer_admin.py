"""Admin CRUD for businesses, bank-card offers, banks and cards — the manual
edit path behind the dashboard's Bank Offers page. Imports and scrapes write
through scraped_business_store / bank_offers_store instead.

Banks and cards have no table of their own: a bank is every BankCardOffer row
sharing a bank_name, a card is every row sharing (bank_name, card_name). Their
rename/delete operations therefore touch offer rows in bulk."""
import json
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import case, func

from database.db import get_session
from database.models import BankCardOffer, Brand, Business
from services.scraped_business_store import offer_dict

BUSINESS_FIELDS = (
    "name", "category", "city", "description", "phone", "website",
    "logo_url", "cover_image_url", "is_active",
)
OFFER_TEXT_FIELDS = ("bank_name", "bank_logo", "card_name", "max_discount_text", "currency", "description")
OFFER_FLOAT_FIELDS = ("discount_percentage", "max_discount_amount")
OFFER_LIST_FIELDS = ("valid_days", "terms")


def _clean_str(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_float(value) -> Optional[float]:
    if value in (None, ""):
        return None
    return float(value)


def _parse_date(value) -> Optional[datetime]:
    text = _clean_str(value)
    return datetime.fromisoformat(text) if text else None


def _unique_slug(session, name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "business"
    slug, n = base, 2
    while session.query(Business.id).filter(Business.slug == slug).first():
        slug, n = f"{base}-{n}", n + 1
    return slug


def _apply_business_fields(biz: Business, data: dict) -> None:
    for field in BUSINESS_FIELDS:
        if field not in data:
            continue
        value = bool(data[field]) if field == "is_active" else _clean_str(data[field])
        setattr(biz, field, value)


def create_business(data: dict) -> dict:
    name = _clean_str(data.get("name"))
    if not name:
        return {"error": "name is required"}
    with get_session() as session:
        slug = _unique_slug(session, name)
        biz = Business(slug=slug, name=name, source_url=_clean_str(data.get("source_url")) or f"manual:{slug}")
        _apply_business_fields(biz, data)
        session.add(biz)
        session.flush()
        return {"id": biz.id, "slug": biz.slug, "name": biz.name}


def update_business(business_id: int, data: dict) -> Optional[dict]:
    if "name" in data and not _clean_str(data.get("name")):
        return {"error": "name cannot be empty"}
    with get_session() as session:
        biz = session.query(Business).filter(Business.id == business_id).first()
        if biz is None:
            return None
        _apply_business_fields(biz, data)
        if "name" in data:
            session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id) \
                .update({BankCardOffer.place_name: biz.name})
        if "is_active" in data:
            session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id) \
                .update({BankCardOffer.is_active: biz.is_active})
        return {"id": biz.id, "name": biz.name, "is_active": biz.is_active}


def _apply_offer_fields(row: BankCardOffer, data: dict) -> None:
    for field in OFFER_TEXT_FIELDS:
        if field in data:
            setattr(row, field, _clean_str(data[field]))
    for field in OFFER_FLOAT_FIELDS:
        if field in data:
            setattr(row, field, _parse_float(data[field]))
    for field in OFFER_LIST_FIELDS:
        if field in data:
            items = [s for s in (_clean_str(v) for v in (data[field] or [])) if s]
            setattr(row, field, json.dumps(items) if items else None)
    if "expiry_date" in data:
        row.expiry_date = _parse_date(data["expiry_date"])
    if "is_active" in data:
        row.is_active = bool(data["is_active"])


def _attach_business(session, row: BankCardOffer, business_id: int) -> Optional[str]:
    biz = session.query(Business).filter(Business.id == business_id).first()
    if biz is None:
        return "business not found"
    row.business_id = biz.id
    row.place_name = biz.name
    row.source_url = biz.source_url
    row.brand_id = biz.brand_id
    return None


def create_offer(data: dict) -> dict:
    if not _clean_str(data.get("bank_name")):
        return {"error": "bank_name is required"}
    if data.get("business_id") in (None, ""):
        return {"error": "business_id is required"}
    try:
        with get_session() as session:
            row = BankCardOffer(bank_name="")
            error = _attach_business(session, row, int(data["business_id"]))
            if error:
                return {"error": error}
            _apply_offer_fields(row, data)
            session.add(row)
            session.flush()
            return offer_dict(row)
    except ValueError as exc:
        return {"error": f"invalid value: {exc}"}


def update_offer(offer_id: int, data: dict) -> Optional[dict]:
    if "bank_name" in data and not _clean_str(data.get("bank_name")):
        return {"error": "bank_name cannot be empty"}
    try:
        with get_session() as session:
            row = session.query(BankCardOffer).filter(BankCardOffer.id == offer_id).first()
            if row is None:
                return None
            if data.get("business_id") not in (None, "") and int(data["business_id"]) != row.business_id:
                error = _attach_business(session, row, int(data["business_id"]))
                if error:
                    return {"error": error}
            _apply_offer_fields(row, data)
            session.flush()
            return offer_dict(row)
    except ValueError as exc:
        return {"error": f"invalid value: {exc}"}


def delete_offers(ids: list[int]) -> int:
    if not ids:
        return 0
    with get_session() as session:
        return session.query(BankCardOffer).filter(BankCardOffer.id.in_(ids)) \
            .delete(synchronize_session=False)


def set_offers_active(ids: list[int], active: bool) -> int:
    if not ids:
        return 0
    with get_session() as session:
        return session.query(BankCardOffer).filter(BankCardOffer.id.in_(ids)) \
            .update({BankCardOffer.is_active: active}, synchronize_session=False)


def list_banks() -> list[dict]:
    """One entry per bank_name with its cards, offer/business counts and
    discount range — computed from offer rows since banks have no table."""
    now = datetime.utcnow()
    with get_session() as session:
        rows = session.query(
            BankCardOffer.bank_name,
            BankCardOffer.card_name,
            func.count(BankCardOffer.id),
            func.max(BankCardOffer.discount_percentage),
            func.avg(BankCardOffer.discount_percentage),
            func.sum(case((BankCardOffer.is_active.is_(True), 1), else_=0)),
            func.sum(case((BankCardOffer.expiry_date < now, 1), else_=0)),
            func.max(BankCardOffer.bank_logo),
        ).group_by(BankCardOffer.bank_name, BankCardOffer.card_name).all()

        business_counts = dict(session.query(
            BankCardOffer.bank_name, func.count(func.distinct(BankCardOffer.business_id)),
        ).group_by(BankCardOffer.bank_name).all())

    banks: dict[str, dict] = {}
    for bank, card, n, max_disc, avg_disc, active, expired, logo in rows:
        entry = banks.setdefault(bank, {
            "bank_name": bank, "bank_logo": None, "offers_count": 0, "active_count": 0,
            "expired_count": 0, "businesses_count": business_counts.get(bank, 0),
            "max_discount": None, "cards": [],
        })
        entry["bank_logo"] = entry["bank_logo"] or logo
        entry["offers_count"] += n
        entry["active_count"] += int(active or 0)
        entry["expired_count"] += int(expired or 0)
        if max_disc is not None:
            entry["max_discount"] = max(entry["max_discount"] or 0, max_disc)
        entry["cards"].append({
            "card_name": card, "offers_count": n, "max_discount": max_disc,
            "avg_discount": round(avg_disc, 1) if avg_disc is not None else None,
        })

    for entry in banks.values():
        entry["cards"].sort(key=lambda c: -c["offers_count"])
    return sorted(banks.values(), key=lambda b: -b["offers_count"])


def update_bank(bank_name: str, data: dict) -> dict:
    new_name = _clean_str(data.get("new_name")) or bank_name
    values: dict = {BankCardOffer.bank_name: new_name}
    if "bank_logo" in data:
        values[BankCardOffer.bank_logo] = _clean_str(data["bank_logo"])
    if "is_active" in data:
        values[BankCardOffer.is_active] = bool(data["is_active"])
    with get_session() as session:
        updated = session.query(BankCardOffer).filter(BankCardOffer.bank_name == bank_name) \
            .update(values, synchronize_session=False)
    return {"updated": updated, "bank_name": new_name}


def delete_bank(bank_name: str) -> int:
    with get_session() as session:
        return session.query(BankCardOffer).filter(BankCardOffer.bank_name == bank_name) \
            .delete(synchronize_session=False)


def _card_filter(query, bank_name: str, card_name: Optional[str]):
    query = query.filter(BankCardOffer.bank_name == bank_name)
    if card_name is None:
        return query.filter(BankCardOffer.card_name.is_(None))
    return query.filter(BankCardOffer.card_name == card_name)


def update_card(bank_name: str, card_name: Optional[str], data: dict) -> dict:
    values: dict = {}
    if "new_card_name" in data:
        values[BankCardOffer.card_name] = _clean_str(data["new_card_name"])
    if "is_active" in data:
        values[BankCardOffer.is_active] = bool(data["is_active"])
    if not values:
        return {"error": "nothing to update"}
    with get_session() as session:
        updated = _card_filter(session.query(BankCardOffer), bank_name, card_name) \
            .update(values, synchronize_session=False)
    return {"updated": updated}


def delete_card(bank_name: str, card_name: Optional[str]) -> int:
    with get_session() as session:
        return _card_filter(session.query(BankCardOffer), bank_name, card_name) \
            .delete(synchronize_session=False)


def brand_names(session, brand_ids: set[int]) -> dict[int, str]:
    if not brand_ids:
        return {}
    return {b.id: b.name for b in session.query(Brand).filter(Brand.id.in_(brand_ids)).all()}
