"""Search page — filter offers by brand, subject, category, subcategory, and more."""
import io
import logging
from datetime import datetime, date

import pandas as pd
import streamlit as st

from database.db import get_session
from database.models import Email, Offer

logger = logging.getLogger(__name__)


def _load_all() -> pd.DataFrame:
    with get_session() as session:
        rows = (
            session.query(Offer, Email.subject, Email.sender, Email.received_date)
            .join(Email, Offer.email_id == Email.id)
            .all()
        )
        data = []
        for o, subject, sender, received_date in rows:
            data.append({
                "offer_id": o.id,
                "email_id": o.email_id,
                "brand": o.brand or "",
                "company": o.company or "",
                "category": o.category or "",
                "subcategory": o.subcategory or "",
                "offer_type": o.offer_type or "",
                "discount_percentage": o.discount_percentage,
                "coupon_code": o.coupon_code or "",
                "expiry_date": o.expiry_date,
                "summary": o.summary or "",
                "is_active": o.is_active,
                "created_at": o.created_at,
                "verification_status": o.verification_status or "",
                "subject": subject or "",
                "sender": sender or "",
                "received_date": received_date,
            })
    return pd.DataFrame(data)


def render():
    st.title("🔍 Search Offers")
    st.caption("Filter and export your processed offers.")

    df = _load_all()

    if df.empty:
        st.info("No offers to search yet — process some emails first.", icon="📭")
        return

    # ── Search Controls ───────────────────────────────────────────────────────
    with st.form("search_form"):
        col1, col2 = st.columns(2)
        brand_query   = col1.text_input("Brand",   placeholder="e.g. Nike")
        subject_query = col2.text_input("Subject", placeholder="e.g. Flash Sale")

        col3, col4 = st.columns(2)
        category_options = ["All"] + sorted(df["category"].dropna().replace("", pd.NA).dropna().unique().tolist())
        category_sel = col3.selectbox("Category", category_options)

        subcat_options = ["All"] + sorted(df["subcategory"].dropna().replace("", pd.NA).dropna().unique().tolist())
        subcat_sel = col4.selectbox("Subcategory", subcat_options)

        col5, col6 = st.columns(2)
        offer_type_options = ["All"] + sorted(df["offer_type"].dropna().replace("", pd.NA).dropna().unique().tolist())
        offer_type_sel = col5.selectbox("Offer Type", offer_type_options)

        ver_options = ["All", "verified", "suspicious", "invalid", "unverified"]
        ver_sel = col6.selectbox("Verification Status", ver_options)

        col7, col8 = st.columns(2)
        min_discount = col7.slider("Min Discount %", 0, 100, 0)
        exp_from = col8.date_input("Expiry From", value=None)

        col9, col10 = st.columns(2)
        date_from = col9.date_input("Received From", value=date(2020, 1, 1))
        date_to   = col10.date_input("Received To",  value=date.today())

        submitted = st.form_submit_button("🔎 Search", width="stretch")

    # ── Apply Filters ─────────────────────────────────────────────────────────
    result = df.copy()

    if brand_query.strip():
        result = result[result["brand"].str.contains(brand_query.strip(), case=False, na=False)]
    if subject_query.strip():
        result = result[result["subject"].str.contains(subject_query.strip(), case=False, na=False)]
    if category_sel != "All":
        result = result[result["category"] == category_sel]
    if subcat_sel != "All":
        result = result[result["subcategory"] == subcat_sel]
    if offer_type_sel != "All":
        result = result[result["offer_type"] == offer_type_sel]
    if ver_sel == "unverified":
        result = result[result["verification_status"] == ""]
    elif ver_sel != "All":
        result = result[result["verification_status"] == ver_sel]
    result = result[result["discount_percentage"].fillna(0) >= min_discount]
    if exp_from:
        result = result[result["expiry_date"].isna() | (result["expiry_date"].dt.date >= exp_from)]

    # Date filter on received_date
    if result["received_date"].notna().any():
        result = result[
            result["received_date"].apply(
                lambda d: d is None or (d.date() >= date_from and d.date() <= date_to)
            )
        ]

    st.markdown(f"**{len(result):,}** offer(s) found.")

    # ── Results Table ─────────────────────────────────────────────────────────
    display_cols = [
        "brand", "category", "subcategory", "offer_type", "discount_percentage",
        "coupon_code", "expiry_date", "verification_status",
        "summary", "subject", "sender", "received_date",
    ]
    display_df = result[display_cols].rename(columns={
        "brand": "Brand", "category": "Category", "subcategory": "Subcategory",
        "offer_type": "Type", "discount_percentage": "Disc %",
        "coupon_code": "Code", "expiry_date": "Expires",
        "verification_status": "Verification", "summary": "Summary",
        "subject": "Subject", "sender": "Sender", "received_date": "Received",
    })

    st.dataframe(
        display_df,
        width="stretch",
        hide_index=True,
        column_config={
            "Disc %":  st.column_config.NumberColumn(format="%.1f%%"),
            "Expires": st.column_config.DatetimeColumn(format="YYYY-MM-DD"),
            "Received": st.column_config.DatetimeColumn(format="YYYY-MM-DD"),
        },
    )

    # ── Export ────────────────────────────────────────────────────────────────
    if not result.empty:
        csv_buf = io.StringIO()
        display_df.to_csv(csv_buf, index=False)
        st.download_button(
            "⬇️ Export to CSV",
            data=csv_buf.getvalue(),
            file_name=f"offers_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
        )
