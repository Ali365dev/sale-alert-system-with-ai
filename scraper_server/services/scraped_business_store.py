"""Write/read path for Business + its BankCardOffer and BusinessBranch rows.

Accepts two import formats:
  - Standard (new): { business_id, name, banks: [{bank_name, bank_logo, cards: [...]}], branches: [...] }
  - Legacy (old):   TakhfifBusinessDetail camelCase JSON (detected by presence of "slug" key)

Re-importing by slug/business_id updates in place and fully replaces offer rows."""
import json
import re
from datetime import datetime
from typing import Optional

from database.db import get_session
from database.models import BankCardOffer, Brand, Business, BusinessBranch, Offer, ScrapedBusiness
from services.brand_discovery.duplicate_detector import find_brand_duplicate


def _parse_review_count(text: Optional[str]) -> Optional[int]:
    m = re.match(r"([\d.,]+)\s*([KM])?", text or "", re.I)
    if not m:
        return None
    try:
        n = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    mul = {"K": 1_000, "M": 1_000_000}.get((m.group(2) or "").upper(), 1)
    return int(n * mul)


def _parse_expiry(card: dict, bank: dict) -> Optional[datetime]:
    iso = (card.get("validThrough") or "").strip()
    if iso:
        try:
            return datetime.fromisoformat(iso)
        except ValueError:
            pass
    m = re.search(r"valid until\s+(.+)", bank.get("validityText") or "", re.I)
    if m:
        for fmt in ("%d %B %Y", "%B %d, %Y", "%d %b %Y"):
            try:
                return datetime.strptime(m.group(1).strip(), fmt)
            except ValueError:
                continue
    return None


# ── Legacy format (TakhfifBusinessDetail, camelCase, nested tiers) ────────────

def _offer_rows_legacy(detail: dict) -> list[dict]:
    rows: list[dict] = []
    for bank in detail.get("banks") or []:
        bank_name = (bank.get("bankName") or "").strip()
        if not bank_name:
            continue
        terms = json.dumps(bank.get("terms") or [])
        for tier in bank.get("tiers") or []:
            title = (tier.get("title") or "").strip()
            valid_days = json.dumps([title] if title and not re.search(r"%\s*off", title, re.I) else [])
            for card in tier.get("cards") or []:
                card_name = (card.get("cardName") or "").strip()
                if not card_name:
                    continue
                rows.append({
                    "bank_name": bank_name,
                    "bank_logo": None,
                    "card_name": card_name,
                    "discount_percentage": card.get("discountPercentage") or tier.get("discountPercentage"),
                    "currency": card.get("currency"),
                    "expiry_date": _parse_expiry(card, bank),
                    "description": card_name,
                    "max_discount_text": card.get("maxDiscountText"),
                    "max_discount_amount": card.get("maxDiscountAmount"),
                    "valid_days": valid_days,
                    "terms": terms,
                })
    return rows


# ── Standard format (new, snake_case, flat cards) ─────────────────────────────

def _offer_rows_standard(detail: dict) -> list[dict]:
    rows: list[dict] = []
    for bank in detail.get("banks") or []:
        bank_name = (bank.get("bank_name") or "").strip()
        if not bank_name:
            continue
        bank_logo = bank.get("bank_logo")
        for card in bank.get("cards") or []:
            card_name = (card.get("card_name") or "").strip()
            if not card_name:
                continue
            valid_days_raw = card.get("valid_days")
            valid_days = json.dumps([valid_days_raw] if isinstance(valid_days_raw, str) and valid_days_raw else
                                    valid_days_raw if isinstance(valid_days_raw, list) else [])
            terms_raw = card.get("terms_and_conditions")
            terms = json.dumps([terms_raw] if isinstance(terms_raw, str) and terms_raw else
                               terms_raw if isinstance(terms_raw, list) else [])
            rows.append({
                "bank_name": bank_name,
                "bank_logo": bank_logo,
                "card_name": card_name,
                "discount_percentage": card.get("discount_percentage"),
                "currency": card.get("currency"),
                "expiry_date": None,
                "description": card_name,
                "max_discount_text": None,
                "max_discount_amount": card.get("maximum_discount"),
                "valid_days": valid_days,
                "terms": terms,
            })
    return rows


def _branch_rows(detail: dict) -> list[dict]:
    out = []
    for b in detail.get("branches") or []:
        out.append({
            "name": b.get("name"),
            "address": b.get("address"),
            "city": b.get("city"),
            "area": b.get("area"),
            "latitude": b.get("latitude"),
            "longitude": b.get("longitude"),
            "phone": b.get("phone"),
            "opening_hours": b.get("opening_hours"),
            "directions_url": b.get("directions_url") or b.get("directionsUrl"),
            "place_id": b.get("place_id") or b.get("placeId"),
        })
    return out


# ── Public upsert ──────────────────────────────────────────────────────────────

def upsert_business(detail: dict) -> dict:
    """Upsert one business. Detects format by key presence:
      - legacy: has "slug" key (TakhfifBusinessDetail)
      - standard: has "business_id" key (new flat format)
    """
    is_legacy = "slug" in detail

    if is_legacy:
        slug = (detail.get("slug") or "").strip()
        name = (detail.get("name") or "").strip()
        source_url = detail.get("canonicalUrl") or detail.get("sourceUrl") or ""
        social = {
            "facebook": detail.get("facebookUrl") or "",
            "instagram": detail.get("instagramUrl") or "",
            "maps": detail.get("mapsUrl") or "",
        }
        brand_id, _score, _reason = find_brand_duplicate(name, detail.get("website"), social)
        offer_rows = _offer_rows_legacy(detail)
    else:
        slug = (detail.get("business_id") or "").strip()
        name = (detail.get("name") or "").strip()
        source_url = detail.get("source_url") or ""
        social = detail.get("social_links") or {}
        brand_id, _score, _reason = find_brand_duplicate(name, detail.get("website"), social)
        offer_rows = _offer_rows_standard(detail)

    if not slug or not name:
        return {"error": "business_id/slug and name are required"}

    with get_session() as session:
        biz = session.query(Business).filter(Business.slug == slug).first()
        if biz is None:
            # Try to find an existing record by normalised name before creating a new one.
            # This prevents duplicate rows when the same place arrives with a different slug
            # (e.g. "Bar.B.Q Tonight" vs "BBQ Tonight").
            norm = name.lower().replace(".", "").replace("-", "").replace("  ", " ").strip()
            candidates = (
                session.query(Business)
                .filter(Business.name.ilike(f"%{norm[:12]}%"))
                .all()
            )
            for c in candidates:
                c_norm = (c.name or "").lower().replace(".", "").replace("-", "").replace("  ", " ").strip()
                if c_norm == norm:
                    biz = c  # merge into existing record; slug stays as-is
                    break
        if biz is None:
            biz = Business(slug=slug)
            session.add(biz)
        elif biz.brand_id is not None:
            brand_id = biz.brand_id  # keep admin-set match

        biz.name = name
        biz.is_active = True
        biz.last_scraped_at = datetime.utcnow()

        if is_legacy:
            biz.category = detail.get("category")
            biz.city = detail.get("city")
            biz.description = detail.get("description")
            biz.rating = detail.get("rating")
            biz.review_count = _parse_review_count(detail.get("reviewCountText"))
            biz.phone = detail.get("phone")
            biz.website = detail.get("website")
            biz.logo_url = detail.get("logoImage")
            biz.cover_image_url = detail.get("coverImage")
            biz.source_url = source_url
            biz.branches = json.dumps(detail.get("branches") or [])
            biz.opening_hours = json.dumps(detail.get("openingHours") or [])
            biz.gallery = json.dumps([g.get("url") for g in (detail.get("gallery") or []) if g.get("url")])
            biz.social_links = json.dumps(social)
            biz.menu_pages = detail.get("menuPages")
        else:
            if detail.get("category") is not None:
                biz.category = detail["category"]
            if detail.get("city") is not None:
                biz.city = detail["city"]
            if detail.get("description") is not None:
                biz.description = detail["description"]
            if detail.get("rating") is not None:
                biz.rating = detail["rating"]
            if detail.get("review_count") is not None:
                biz.review_count = detail["review_count"]
            if detail.get("phone") is not None:
                biz.phone = detail["phone"]
            if detail.get("website") is not None:
                biz.website = detail["website"]
            if detail.get("logo_url") is not None:
                biz.logo_url = detail["logo_url"]
            if detail.get("cover_image_url") is not None:
                biz.cover_image_url = detail["cover_image_url"]
            if source_url:
                biz.source_url = source_url

        biz.brand_id = brand_id
        session.flush()

        # Replace offer rows
        session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id).delete()
        if source_url:
            session.query(BankCardOffer).filter(
                BankCardOffer.source_url == source_url, BankCardOffer.business_id.is_(None),
            ).delete()

        for row in offer_rows:
            session.add(BankCardOffer(
                source_url=source_url or None,
                place_name=name,
                place_website=detail.get("website") if is_legacy else detail.get("website"),
                brand_id=brand_id,
                business_id=biz.id,
                **row,
            ))

        # Replace branch rows in BusinessBranch table for both formats so the
        # read-path (which prefers this table) always sees fresh data.
        session.query(BusinessBranch).filter(BusinessBranch.business_id == biz.id).delete()
        for br in _branch_rows(detail):
            session.add(BusinessBranch(business_id=biz.id, **br))

        brand_name = None
        if brand_id is not None:
            brand = session.query(Brand).filter(Brand.id == brand_id).first()
            brand_name = brand.name if brand else None

        return {
            "business_id": biz.id, "slug": slug,
            "brand_id": brand_id, "brand_name": brand_name,
            "offers_saved": len(offer_rows),
        }


def upsert_businesses_bulk(businesses: list[dict]) -> dict:
    """Import a list of business dicts. Returns aggregated counts."""
    saved = 0
    errors = []
    for item in businesses:
        result = upsert_business(item)
        if "error" in result:
            errors.append(result["error"])
        else:
            saved += 1
    return {"saved": saved, "errors": errors}


def _biz_summary(biz: Business, offers_count: int, banks_count: int, brand_name: Optional[str]) -> dict:
    return {
        "id": biz.id, "slug": biz.slug, "name": biz.name,
        "category": biz.category, "city": biz.city,
        "rating": biz.rating, "review_count": biz.review_count,
        "logo_url": biz.logo_url, "source_url": biz.source_url,
        "brand_id": biz.brand_id, "brand_name": brand_name,
        "offers_count": offers_count, "banks_count": banks_count,
        "is_active": biz.is_active,
        "last_scraped_at": biz.last_scraped_at.isoformat() if biz.last_scraped_at else None,
    }


def _offer_dict(row: BankCardOffer) -> dict:
    return {
        "id": row.id, "bank_name": row.bank_name, "bank_logo": row.bank_logo,
        "card_name": row.card_name,
        "discount_percentage": row.discount_percentage,
        "max_discount_text": row.max_discount_text,
        "max_discount_amount": row.max_discount_amount,
        "valid_days": json.loads(row.valid_days) if row.valid_days else [],
        "terms": json.loads(row.terms) if row.terms else [],
        "currency": row.currency,
        "expiry_date": row.expiry_date.isoformat() if row.expiry_date else None,
        "place_name": row.place_name, "source_url": row.source_url,
        "brand_id": row.brand_id, "business_id": row.business_id,
    }


def list_businesses(limit: int, offset: int, q: Optional[str], matched_only: bool) -> dict:
    with get_session() as session:
        query = session.query(Business)
        if q:
            query = query.filter(Business.name.ilike(f"%{q}%"))
        if matched_only:
            query = query.filter(Business.brand_id.isnot(None))
        total = query.count()
        rows = (query.order_by(Business.last_scraped_at.desc().nullslast())
                .offset(offset).limit(limit).all())

        ids = [b.id for b in rows]
        counts: dict[int, tuple[int, set]] = {i: (0, set()) for i in ids}
        if ids:
            for o in session.query(BankCardOffer).filter(BankCardOffer.business_id.in_(ids)).all():
                n, banks = counts[o.business_id]
                banks.add(o.bank_name)
                counts[o.business_id] = (n + 1, banks)

        brand_ids = {b.brand_id for b in rows if b.brand_id is not None}
        brand_names = {b.id: b.name for b in
                       session.query(Brand).filter(Brand.id.in_(brand_ids)).all()} if brand_ids else {}

        return {
            "total": total,
            "businesses": [
                _biz_summary(b, counts[b.id][0], len(counts[b.id][1]), brand_names.get(b.brand_id))
                for b in rows
            ],
        }


def get_business(business_id: int) -> Optional[dict]:
    with get_session() as session:
        biz = session.query(Business).filter(Business.id == business_id).first()
        if biz is None:
            return None
        offers = (session.query(BankCardOffer)
                  .filter(BankCardOffer.business_id == biz.id)
                  .order_by(BankCardOffer.bank_name, BankCardOffer.discount_percentage.desc())
                  .all())
        branches = (session.query(BusinessBranch)
                    .filter(BusinessBranch.business_id == biz.id)
                    .all())
        brand = session.query(Brand).filter(Brand.id == biz.brand_id).first() if biz.brand_id else None
        banks = {o.bank_name for o in offers}
        detail = _biz_summary(biz, len(offers), len(banks), brand.name if brand else None)
        detail.update({
            "description": biz.description, "phone": biz.phone, "website": biz.website,
            "cover_image_url": biz.cover_image_url,
            "branches": [
                {
                    "id": br.id, "name": br.name, "address": br.address, "city": br.city,
                    "area": br.area, "latitude": br.latitude, "longitude": br.longitude,
                    "phone": br.phone, "opening_hours": br.opening_hours,
                    "directions_url": br.directions_url, "place_id": br.place_id,
                }
                for br in branches
            ] or (json.loads(biz.branches) if biz.branches else []),
            "opening_hours": json.loads(biz.opening_hours) if biz.opening_hours else [],
            "gallery": json.loads(biz.gallery) if biz.gallery else [],
            "social_links": json.loads(biz.social_links) if biz.social_links else {},
            "menu_pages": biz.menu_pages,
            "offers": [_offer_dict(o) for o in offers],
        })
        return detail


def set_business_brand(business_id: int, brand_id: Optional[int]) -> Optional[dict]:
    with get_session() as session:
        biz = session.query(Business).filter(Business.id == business_id).first()
        if biz is None:
            return None
        brand_name = None
        if brand_id is not None:
            brand = session.query(Brand).filter(Brand.id == brand_id).first()
            if brand is None:
                return {"error": "brand not found"}
            brand_name = brand.name
        biz.brand_id = brand_id
        session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id) \
            .update({BankCardOffer.brand_id: brand_id})
        return {"business_id": biz.id, "brand_id": brand_id, "brand_name": brand_name}


def delete_business(business_id: int) -> bool:
    with get_session() as session:
        biz = session.query(Business).filter(Business.id == business_id).first()
        if biz is None:
            return False
        session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id).delete()
        session.query(BusinessBranch).filter(BusinessBranch.business_id == biz.id).delete()
        session.delete(biz)
        return True


def combined_offers(brand_id: int) -> Optional[dict]:
    with get_session() as session:
        brand = session.query(Brand).filter(Brand.id == brand_id).first()
        if brand is None:
            return None
        sale_offers = (session.query(Offer)
                       .filter(Offer.brand == brand.name, Offer.is_active.is_(True))
                       .order_by(Offer.created_at.desc()).limit(100).all())
        bank_offers = (session.query(BankCardOffer)
                       .filter(BankCardOffer.brand_id == brand_id)
                       .order_by(BankCardOffer.bank_name).all())
        businesses = session.query(Business).filter(Business.brand_id == brand_id).all()
        return {
            "brand": {"id": brand.id, "name": brand.name, "logo_url": brand.logo_url,
                      "website": brand.website},
            "sale_offers": [{
                "id": o.id, "title": o.title, "offer_type": o.offer_type,
                "discount_percentage": o.discount_percentage, "coupon_code": o.coupon_code,
                "expiry_date": o.expiry_date.isoformat() if o.expiry_date else None,
                "source": o.source, "offer_value": o.offer_value,
            } for o in sale_offers],
            "bank_offers": [_offer_dict(o) for o in bank_offers],
            "businesses": [{"id": b.id, "slug": b.slug, "name": b.name, "city": b.city}
                           for b in businesses],
        }
