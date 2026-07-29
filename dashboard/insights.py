"""AI Insights page — best deals today, expiring offers, and a Gemini daily summary."""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import streamlit as st

from google import genai

from config import GEMINI_API_KEY, GEMINI_MODEL
from database.db import get_session
from database.models import Email, Offer

logger = logging.getLogger(__name__)

_genai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def _load_offers() -> pd.DataFrame:
    logger.info("Insights: loading offers with highlights from database")
    with get_session() as session:
        rows = (
            session.query(Offer, Email.subject, Email.received_date)
            .join(Email, Offer.email_id == Email.id)
            .all()
        )
        logger.info("Insights: DB returned %d rows", len(rows))
        data = []
        for o, subject, received_date in rows:
            highlights = []
            try:
                highlights = json.loads(o.key_highlights or "[]")
            except Exception:
                pass
            data.append({
                "id": o.id,
                "brand": o.brand,
                "category": o.category,
                "offer_type": o.offer_type,
                "discount_percentage": o.discount_percentage,
                "coupon_code": o.coupon_code,
                "expiry_date": o.expiry_date,
                "priority_score": o.priority_score,
                "sentiment": o.sentiment,
                "summary": o.summary,
                "key_highlights": highlights,
                "recommended_action": o.recommended_action,
                "website": o.website,
                "is_active": o.is_active,
                "subject": subject,
                "received_date": received_date,
                "created_at": o.created_at,
            })
    logger.info("Insights: processed %d offer rows into DataFrame", len(data))
    return pd.DataFrame(data)


def _gemini_daily_summary(top_offers: list[dict]) -> Optional[str]:
    """Ask Gemini to produce a friendly daily digest from the top offers."""
    if not _genai_client or not top_offers:
        logger.warning("Insights: skipping Gemini summary — no API key or no offers")
        return None
    logger.info("Insights: sending %d offers to Gemini for daily summary", len(top_offers[:10]))
    offers_text = "\n".join(
        f"- {o.get('brand','?')} | {o.get('category','?')} | "
        f"{o.get('discount_percentage') or '?'}% off | {o.get('summary','')}"
        for o in top_offers[:10]
    )
    prompt = (
        "You are a helpful shopping assistant. Based on these sales offers, "
        "write a friendly, enthusiastic 3-4 sentence daily digest for today "
        f"({datetime.utcnow().strftime('%B %d, %Y')}). "
        "Highlight the best deals and any urgent expiry dates. Keep it concise.\n\n"
        f"{offers_text}"
    )
    try:
        resp = _genai_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        logger.info("Insights: Gemini summary received (%d chars)", len(resp.text))
        return resp.text
    except Exception as exc:
        logger.error("Insights: Gemini summary failed — %s", exc)
        return f"(AI summary unavailable: {exc})"


def _offer_card(o: dict, highlight_color: str = "#1a1a2e"):
    """Render a compact offer card using Streamlit columns."""
    with st.container():
        st.markdown(
            f"""
            <div style="background:{highlight_color};border-radius:10px;padding:16px;margin-bottom:10px;border-left:4px solid #00b4d8;">
            <strong style="font-size:1.1rem">{o.get('brand') or 'Unknown Brand'}</strong>
            &nbsp;<span style="color:#aaa;font-size:0.85rem">{o.get('category') or ''}</span><br/>
            <span style="color:#00b4d8;font-size:1.3rem;font-weight:bold">
              {f"{o['discount_percentage']:.0f}% OFF" if o.get('discount_percentage') else o.get('offer_type','Offer')}
            </span>
            &nbsp;&nbsp;
            {"<code style='background:#333;padding:2px 6px;border-radius:4px'>"+o['coupon_code']+"</code>" if o.get('coupon_code') else ""}
            <br/><span style="font-size:0.9rem;color:#ddd">{o.get('summary') or ''}</span>
            {"<br/><span style='color:#f39c12;font-size:0.8rem'>⏰ Expires: "+str(o['expiry_date'].strftime('%b %d, %Y'))+"</span>" if o.get('expiry_date') else ""}
            {"<br/><span style='color:#2ecc71;font-size:0.8rem'>💡 "+o['recommended_action']+"</span>" if o.get('recommended_action') else ""}
            {"<br/><a href='"+o['website']+"' target='_blank' style='color:#58a6ff;font-size:0.8rem'>🔗 View Offer</a>" if o.get('website') else ""}
            </div>
            """,
            unsafe_allow_html=True,
        )


def render():
    st.title("🤖 AI Insights")
    st.caption("Gemini-powered daily digest, best deals, and expiry alerts.")

    logger.info("Insights render: fetching offers")
    df = _load_offers()
    logger.info("Insights render: loaded %d offers", len(df))

    if df.empty:
        st.info("No offers analysed yet. Run the scheduler first.", icon="📭")
        return

    now = datetime.utcnow()

    # ── Daily Summary (Gemini generated) ─────────────────────────────────────
    st.subheader("📰 Today's AI Digest")
    with st.spinner("Asking Gemini for a daily summary …"):
        top_for_summary = (
            df[df["priority_score"].notna()]
            .nlargest(10, "priority_score")
            .to_dict("records")
        )
        summary_text = _gemini_daily_summary(top_for_summary)

    if summary_text:
        st.info(summary_text, icon="🤖")
    else:
        st.warning("Daily summary not available (check GEMINI_API_KEY).")

    st.divider()

    # ── Best Offers Today ─────────────────────────────────────────────────────
    st.subheader("🌟 Best Offers (Top Priority)")
    best = (
        df[df["priority_score"].notna()]
        .nlargest(6, "priority_score")
        .to_dict("records")
    )
    logger.info("Insights: returning %d top-priority offers", len(best))
    cols = st.columns(2)
    for i, offer in enumerate(best):
        with cols[i % 2]:
            _offer_card(offer)

    st.divider()

    # ── Expiring Soon ─────────────────────────────────────────────────────────
    st.subheader("⏰ Expiring Within 7 Days")
    deadline = now + timedelta(days=7)
    expiring = df[
        (df["expiry_date"].notna())
        & (df["expiry_date"] >= now)
        & (df["expiry_date"] <= deadline)
    ].sort_values("expiry_date")
    logger.info("Insights: %d offers expiring within 7 days", len(expiring))

    if expiring.empty:
        st.success("No offers expiring within the next 7 days.")
    else:
        cols = st.columns(2)
        for i, offer in enumerate(expiring.to_dict("records")):
            with cols[i % 2]:
                _offer_card(offer, highlight_color="#1a0a00")

    st.divider()

    # ── Recommended Deals Table ───────────────────────────────────────────────
    st.subheader("💡 Recommended Actions")
    recommended = (
        df[df["recommended_action"].notna()]
        .nlargest(15, "priority_score")[
            ["brand", "category", "discount_percentage", "coupon_code",
             "priority_score", "recommended_action"]
        ]
        .rename(columns={
            "brand": "Brand", "category": "Category",
            "discount_percentage": "Disc %", "coupon_code": "Code",
            "priority_score": "Score", "recommended_action": "Action",
        })
    )
    st.dataframe(recommended, width="stretch", hide_index=True)

    st.divider()

    # ── AI Key Highlights ─────────────────────────────────────────────────────
    st.subheader("✨ AI Key Highlights from Latest Emails")
    recent = df.sort_values("created_at", ascending=False).head(5)
    for _, row in recent.iterrows():
        highlights = row.get("key_highlights") or []
        if highlights:
            brand = row.get("brand") or "Unknown"
            with st.expander(f"{brand} — {row.get('summary', '')[:80]}"):
                for hl in highlights:
                    st.markdown(f"- {hl}")
