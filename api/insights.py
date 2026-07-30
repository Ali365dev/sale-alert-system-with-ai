"""AI Insights endpoints — daily digest, best offers, expiring soon, recommended actions."""
import json
from datetime import datetime, timedelta

from flask import Blueprint, jsonify

from ai._llm import call_llm
from database.db import get_session
from database.models import Offer
from services.settings_service import get_prompt

bp = Blueprint("insights", __name__, url_prefix="/api")

PROMPT_KEY = "dashboard_digest"
_DIGEST_PROMPT = (
    "You are a helpful shopping assistant. Based on these sales offers, write a "
    "friendly, enthusiastic 3-4 sentence daily digest for today "
    "({today}). Highlight the best deals and "
    "any urgent expiry dates. Keep it concise.\n\n{offers_text}"
)


def _offer_dict(o: Offer) -> dict:
    try:
        highlights = json.loads(o.key_highlights or "[]")
    except Exception:
        highlights = []
    return {
        "id": o.id,
        "brand": o.brand,
        "category": o.category,
        "discount_percentage": o.discount_percentage,
        "coupon_code": o.coupon_code,
        "expiry_date": o.expiry_date.isoformat() if o.expiry_date else None,
        "verification_status": o.verification_status or "unverified",
        "summary": o.summary,
        "key_highlights": highlights,
    }


def _digest_text(top_offers: list[dict]) -> str | None:
    if not top_offers:
        return None
    offers_text = "\n".join(
        f"- {o['brand'] or '?'} | {o['category'] or '?'} | "
        f"{o['discount_percentage'] or '?'}% off | {o['summary'] or ''}"
        for o in top_offers[:10]
    )
    template = get_prompt(PROMPT_KEY, default=_DIGEST_PROMPT)
    prompt = template.format(today=datetime.utcnow().strftime("%B %d, %Y"), offers_text=offers_text)
    return call_llm(prompt)


@bp.get("/insights")
def insights():
    now = datetime.utcnow()
    soon = now + timedelta(days=7)

    with get_session() as session:
        offers = session.query(Offer).all()
        offer_dicts = [_offer_dict(o) for o in offers]

    verified_or_unverified = [o for o in offer_dicts if o["verification_status"] != "invalid"]
    best_offers = sorted(
        verified_or_unverified,
        key=lambda o: (o["verification_status"] == "verified", o["discount_percentage"] or 0),
        reverse=True,
    )[:6]

    expiring = sorted(
        (
            o
            for o in offer_dicts
            if o["expiry_date"] and now.isoformat() <= o["expiry_date"] <= soon.isoformat()
        ),
        key=lambda o: o["expiry_date"],
    )

    invalid = [o for o in offer_dicts if o["verification_status"] == "invalid"]
    suspicious = [o for o in offer_dicts if o["verification_status"] == "suspicious"]

    recommended_actions = []
    if best_offers:
        top = best_offers[0]
        recommended_actions.append({
            "id": f"use-{top['id']}",
            "title": f"Use {top['coupon_code'] or top['brand']} before it expires",
            "detail": top["summary"] or "Highest-value offer in the catalogue.",
            "done": False,
        })
    for o in invalid[:3]:
        recommended_actions.append({
            "id": f"invalid-{o['id']}",
            "title": f"Remove or archive invalid offer from {o['brand'] or 'unknown brand'}",
            "detail": o["summary"] or "Flagged invalid on verification.",
            "done": False,
        })
    for o in suspicious[:3]:
        recommended_actions.append({
            "id": f"suspicious-{o['id']}",
            "title": f"Re-verify {o['coupon_code'] or o['brand']}",
            "detail": o["summary"] or "Flagged suspicious on verification.",
            "done": False,
        })

    highlights_feed = []
    for o in sorted(offer_dicts, key=lambda o: o["id"], reverse=True)[:5]:
        for hl in o["key_highlights"]:
            highlights_feed.append({"brand": o["brand"], "text": hl})

    digest = _digest_text(sorted(offer_dicts, key=lambda o: o["discount_percentage"] or 0, reverse=True))

    return jsonify({
        "digest": digest,
        "stats": {
            "emails_read": len(offer_dicts),
            "new_offers": len(offer_dicts),
            "avg_discount": round(
                sum(o["discount_percentage"] or 0 for o in offer_dicts) / len(offer_dicts), 1
            ) if offer_dicts else 0,
            "flagged": len(invalid) + len(suspicious),
        },
        "best_offers": best_offers,
        "expiring_soon": expiring,
        "recommended_actions": recommended_actions[:5],
        "highlights": highlights_feed[:5],
    })
