"""Write/read path for ScrapedBusiness + its BankCardOffer rows.

The import payload is the chrome extension's native TakhfifBusinessDetail
JSON (camelCase, nested banks→tiers→cards) — normalization happens here so
the extension never has to duplicate schema-mapping code across its bundles.
Re-importing a slug updates the business row in place and fully replaces its
offer rows (offers are a snapshot of the last scrape, never merged)."""
import json
import re
from datetime import datetime
from typing import Optional

from database.db import get_session
from database.models import BankCardOffer, Brand, Offer, ScrapedBusiness
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


def _offer_rows(detail: dict) -> list[dict]:
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


def upsert_business(detail: dict) -> dict:
    """detail: the extension's TakhfifBusinessDetail JSON. Upserts the
    business by slug and replaces its offer rows in one transaction."""
    slug = (detail.get("slug") or "").strip()
    name = (detail.get("name") or "").strip()
    social = {
        "facebook": detail.get("facebookUrl") or "",
        "instagram": detail.get("instagramUrl") or "",
        "maps": detail.get("mapsUrl") or "",
    }
    brand_id, _score, _reason = find_brand_duplicate(name, detail.get("website"), social)
    source_url = detail.get("canonicalUrl") or detail.get("sourceUrl") or ""

    with get_session() as session:
        biz = session.query(ScrapedBusiness).filter(ScrapedBusiness.slug == slug).first()
        if biz is None:
            biz = ScrapedBusiness(slug=slug)
            session.add(biz)
        elif biz.brand_id is not None:
            brand_id = biz.brand_id  # keep an existing (possibly admin-set) match

        biz.name = name
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
        biz.brand_id = brand_id
        biz.branches = json.dumps(detail.get("branches") or [])
        biz.opening_hours = json.dumps(detail.get("openingHours") or [])
        biz.gallery = json.dumps([g.get("url") for g in (detail.get("gallery") or []) if g.get("url")])
        biz.social_links = json.dumps(social)
        biz.menu_pages = detail.get("menuPages")
        biz.is_active = True
        biz.last_scraped_at = datetime.utcnow()
        session.flush()  # assigns biz.id for new rows

        session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id).delete()
        # Also clear legacy rows for this place saved before business linking
        session.query(BankCardOffer).filter(
            BankCardOffer.source_url == source_url, BankCardOffer.business_id.is_(None),
        ).delete()

        rows = _offer_rows(detail)
        for row in rows:
            session.add(BankCardOffer(
                source_url=source_url, place_name=name,
                place_website=detail.get("website"),
                brand_id=brand_id, business_id=biz.id, **row,
            ))

        brand_name = None
        if brand_id is not None:
            brand = session.query(Brand).filter(Brand.id == brand_id).first()
            brand_name = brand.name if brand else None

        return {
            "business_id": biz.id, "slug": slug,
            "brand_id": brand_id, "brand_name": brand_name,
            "offers_saved": len(rows),
        }


def _biz_summary(biz: ScrapedBusiness, offers_count: int, banks_count: int, brand_name: Optional[str]) -> dict:
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
        "id": row.id, "bank_name": row.bank_name, "card_name": row.card_name,
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
        query = session.query(ScrapedBusiness)
        if q:
            query = query.filter(ScrapedBusiness.name.ilike(f"%{q}%"))
        if matched_only:
            query = query.filter(ScrapedBusiness.brand_id.isnot(None))
        total = query.count()
        rows = (query.order_by(ScrapedBusiness.last_scraped_at.desc().nullslast())
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
        biz = session.query(ScrapedBusiness).filter(ScrapedBusiness.id == business_id).first()
        if biz is None:
            return None
        offers = (session.query(BankCardOffer)
                  .filter(BankCardOffer.business_id == biz.id)
                  .order_by(BankCardOffer.bank_name, BankCardOffer.discount_percentage.desc())
                  .all())
        brand = session.query(Brand).filter(Brand.id == biz.brand_id).first() if biz.brand_id else None
        banks = {o.bank_name for o in offers}
        detail = _biz_summary(biz, len(offers), len(banks), brand.name if brand else None)
        detail.update({
            "description": biz.description, "phone": biz.phone, "website": biz.website,
            "cover_image_url": biz.cover_image_url,
            "branches": json.loads(biz.branches) if biz.branches else [],
            "opening_hours": json.loads(biz.opening_hours) if biz.opening_hours else [],
            "gallery": json.loads(biz.gallery) if biz.gallery else [],
            "social_links": json.loads(biz.social_links) if biz.social_links else {},
            "menu_pages": biz.menu_pages,
            "offers": [_offer_dict(o) for o in offers],
        })
        return detail


def set_business_brand(business_id: int, brand_id: Optional[int]) -> Optional[dict]:
    """Admin override of the brand match — cascades to the offer rows."""
    with get_session() as session:
        biz = session.query(ScrapedBusiness).filter(ScrapedBusiness.id == business_id).first()
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
        biz = session.query(ScrapedBusiness).filter(ScrapedBusiness.id == business_id).first()
        if biz is None:
            return False
        session.query(BankCardOffer).filter(BankCardOffer.business_id == biz.id).delete()
        session.delete(biz)
        return True


def combined_offers(brand_id: int) -> Optional[dict]:
    """The merged view: a brand's email/website sale offers + its scraped
    bank-card offers + the linked business record(s)."""
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
        businesses = session.query(ScrapedBusiness).filter(ScrapedBusiness.brand_id == brand_id).all()
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
