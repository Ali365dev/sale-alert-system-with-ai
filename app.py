"""
Gmail Sales Offers AI Dashboard
================================
Entry point for Streamlit.

Run:  streamlit run app.py
"""
import sys
from pathlib import Path

# Ensure project root is on sys.path when running via `streamlit run app.py`
sys.path.insert(0, str(Path(__file__).parent))

import streamlit as st
from config import APP_TITLE, logger
from database.db import init_db

# ── Page config (must be first Streamlit call) ────────────────────────────────
st.set_page_config(
    page_title=APP_TITLE,
    page_icon="📧",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={"About": f"# {APP_TITLE}\nPowered by Gemini AI + Gmail API"},
)

# ── Dark-mode friendly global CSS ─────────────────────────────────────────────
st.markdown(
    """
    <style>
    /* Sidebar header */
    [data-testid="stSidebar"] { background: #0d1117; }
    [data-testid="stSidebar"] .block-container { padding-top: 1rem; }

    /* Main content */
    .main .block-container { padding-top: 1.5rem; max-width: 1400px; }

    /* Metric cards */
    [data-testid="metric-container"] {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 10px;
        padding: 12px 20px;
    }
    [data-testid="stMetricValue"] { font-size: 2rem !important; }

    /* Buttons */
    .stButton > button { border-radius: 8px; font-weight: 600; }
    .stDownloadButton > button { border-radius: 8px; font-weight: 600; }

    /* Dataframe */
    [data-testid="stDataFrame"] { border-radius: 10px; }

    /* Dividers */
    hr { border-color: #30363d; margin: 0.75rem 0; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Ensure DB tables exist ─────────────────────────────────────────────────────
init_db()

# ── Lazy imports of dashboard pages ───────────────────────────────────────────
from dashboard import overview, analytics, search, insights, offers, email_verify, brands

# ── Sidebar navigation ────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown(f"## 📧 {APP_TITLE}")
    st.markdown("---")

    page = st.radio(
        "Navigation",
        ["📊 Overview", "📈 Analytics", "🔍 Search", "🤖 AI Insights", "🗂 Offers Manager", "🏷️ Brands Manager", "🔎 Email Verification"],
        label_visibility="collapsed",
    )

    st.markdown("---")
    st.markdown("### ⚙️ Actions")

    # ── Button 1: Fetch emails only ───────────────────────────────────────────
    if st.button("📥 Fetch Emails from Gmail", width="stretch"):
        with st.spinner("Fetching new emails …"):
            try:
                from scheduler.jobs import fetch_emails_only
                count = fetch_emails_only()
                st.success(f"Fetched {count} new email(s). Click 'Process → Offers' to analyse them.")
            except Exception as exc:
                logger.error("Fetch failed: %s", exc)
                st.error(f"Error: {exc}")

    # ── Button 2: Process pending emails → offers ─────────────────────────────
    if st.button("🤖 Process Pending Emails → Offers", width="stretch"):
        with st.spinner("Running AI on emails without offers …"):
            try:
                from scheduler.jobs import process_emails_without_offers
                processed, failed = process_emails_without_offers()
                if processed == 0 and failed == 0:
                    st.info("No pending emails — all emails already have offers.")
                else:
                    st.success(f"Done! {processed} offer(s) created, {failed} failed.")
            except Exception as exc:
                logger.error("Process failed: %s", exc)
                st.error(f"Error: {exc}")

    # ── Button 3: Do both in one click ────────────────────────────────────────
    if st.button("▶️ Fetch & Analyse All", width="stretch"):
        with st.spinner("Fetching emails and running AI analysis …"):
            try:
                from scheduler.jobs import process_emails
                process_emails()
                st.success("Done! Refresh to see updated data.")
            except Exception as exc:
                logger.error("Manual run failed: %s", exc)
                st.error(f"Error: {exc}")

    # ── Button 4: Fetch sales from search + AI (no scraping) ─────────────────
    if st.button("🌐 Fetch Sales from Web (AI)", width="stretch"):
        from ai.brand_fetcher import load_brands, fetch_offers_for_brand
        from ai import cache as _ai_cache
        from database.db import get_session
        from database.models import Offer

        brands = load_brands()
        if not brands:
            st.error("brands.json is empty or missing.")
        else:
            saved, failed, total_active = 0, 0, 0
            cache = _ai_cache.load()
            with st.spinner(f"Searching promotions for {len(brands)} brand(s) …"):
                for brand in brands:
                    try:
                        offers_data = fetch_offers_for_brand(brand, cache=cache)
                        for o_data in offers_data:
                            try:
                                offer = Offer(
                                    email_id=None,
                                    brand=o_data.get("brand"),
                                    company=o_data.get("company"),
                                    category=o_data.get("category"),
                                    subcategory=o_data.get("subcategory"),
                                    offer_type=o_data.get("offer_type"),
                                    discount_percentage=o_data.get("discount_percentage"),
                                    coupon_code=o_data.get("coupon_code"),
                                    expiry_date=o_data.get("expiry_date"),
                                    offer_value=o_data.get("offer_value"),
                                    website=o_data.get("website") or o_data.get("_url") or None,
                                    summary=o_data.get("summary"),
                                    key_highlights=o_data.get("key_highlights"),
                                    is_active=bool(o_data.get("is_active", False)),
                                    source="ai",
                                )
                                with get_session() as session:
                                    session.add(offer)
                                saved += 1
                                if o_data.get("_is_sale"):
                                    total_active += 1
                            except Exception as exc:
                                logger.error("Save offer failed: %s", exc)
                                failed += 1
                    except Exception as exc:
                        logger.error("Brand fetch failed for %r: %s", brand.get("name"), exc)
                        failed += 1
            _ai_cache.save(cache)
            st.success(f"Done — {saved} offer(s) saved ({total_active} active sales), {failed} failed.")

    # ── Button 5: Bulk verify all unverified offers ───────────────────────────
    if st.button("✅ Verify All Unverified Offers", width="stretch"):
        from ai.verifier import verify_offer
        from datetime import datetime, timezone
        from database.db import get_session
        from database.models import Offer
        with get_session() as session:
            unverified = (
                session.query(Offer)
                .filter(Offer.verification_status.is_(None))
                .all()
            )
            unverified_ids = [o.id for o in unverified]

        if not unverified_ids:
            st.info("All offers are already verified.")
        else:
            ok, failed = 0, 0
            with st.spinner(f"Verifying {len(unverified_ids)} offer(s) …"):
                for offer_id in unverified_ids:
                    try:
                        with get_session() as session:
                            o = session.query(Offer).filter(Offer.id == offer_id).first()
                            if o is None:
                                continue
                            offer_data = {c.name: getattr(o, c.name) for c in o.__table__.columns}

                        result = verify_offer(offer_data)
                        if result:
                            with get_session() as session:
                                o = session.query(Offer).filter(Offer.id == offer_id).first()
                                if o:
                                    o.verification_status     = result["status"]
                                    o.verification_reason     = result["reason"]
                                    o.verification_confidence = float(result["confidence"])
                                    o.verified_at             = datetime.now(timezone.utc).replace(tzinfo=None)
                            ok += 1
                        else:
                            failed += 1
                    except Exception as exc:
                        logger.error("Verify failed for offer %s: %s", offer_id, exc)
                        failed += 1
            st.success(f"Done — {ok} verified, {failed} failed.")

    # ── Button 6: Tavily + Llama brand research ───────────────────────────────
    if st.button("🔬 Research Brands (Tavily + Llama)", width="stretch"):
        from research.config import TAVILY_API_KEY as _TAVILY_KEY
        if not _TAVILY_KEY:
            st.error("TAVILY_API_KEY is not set in .env — cannot run research.")
        else:
            from research.runner import ResearchRunner
            runner = ResearchRunner()
            brands_count = len(runner._db.get_active_brands())
            if brands_count == 0:
                st.info("No active brands found in Supabase.")
            else:
                with st.spinner(f"Researching {brands_count} brand(s) via Tavily + Llama … (this may take a while)"):
                    try:
                        results = runner.run()
                        total_inserted = sum(r.inserted for r in results)
                        total_updated  = sum(r.updated  for r in results)
                        failed_brands  = [r.brand_name for r in results if not r.success]
                        st.success(
                            f"Done — {len(results)} brand(s) researched · "
                            f"{total_inserted} inserted · {total_updated} updated"
                            + (f" · {len(failed_brands)} skipped" if failed_brands else "")
                        )
                        if failed_brands:
                            st.warning("Skipped: " + ", ".join(failed_brands))
                    except Exception as exc:
                        logger.error("Research run failed: %s", exc)
                        st.error(f"Research error: {exc}")

    st.markdown("---")
    st.caption("Powered by **Gemini AI** · **Groq** · **Tavily** · **Gmail API** · **Streamlit**")

# ── Route to selected page ────────────────────────────────────────────────────
match page:
    case "📊 Overview":
        overview.render()
    case "📈 Analytics":
        analytics.render()
    case "🔍 Search":
        search.render()
    case "🤖 AI Insights":
        insights.render()
    case "🗂 Offers Manager":
        offers.render()
    case "🏷️ Brands Manager":
        brands.render()
    case "🔎 Email Verification":
        email_verify.render()
