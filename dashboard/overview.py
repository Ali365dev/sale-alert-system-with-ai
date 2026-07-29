"""Overview page — headline metrics and latest offers table."""
import json
import logging
from datetime import datetime, timedelta

import pandas as pd
import plotly.express as px
import streamlit as st

from database.db import get_session
from database.models import Email, Offer

logger = logging.getLogger(__name__)


def _load_data():
    logger.info("Loading emails and offers from database")
    with get_session() as session:
        emails = session.query(Email).all()
        offers = session.query(Offer).all()
        logger.info("DB returned %d emails and %d offers", len(emails), len(offers))

        email_rows = [
            {"id": e.id, "sender": e.sender, "subject": e.subject, "received_date": e.received_date}
            for e in emails
        ]
        offer_rows = [
            {
                "id": o.id,
                "email_id": o.email_id,
                "brand": o.brand,
                "company": o.company,
                "category": o.category,
                "subcategory": o.subcategory,
                "offer_type": o.offer_type,
                "discount_percentage": o.discount_percentage,
                "coupon_code": o.coupon_code,
                "expiry_date": o.expiry_date,
                "summary": o.summary,
                "is_active": o.is_active,
                "created_at": o.created_at,
                "verification_status": o.verification_status,
                "verification_confidence": o.verification_confidence,
            }
            for o in offers
        ]
    return pd.DataFrame(email_rows), pd.DataFrame(offer_rows)


def render():
    st.title("📊 Overview")
    st.caption("Real-time summary of your Gmail sales offers inbox.")

    emails_df, offers_df = _load_data()

    if emails_df.empty:
        st.info(
            "No emails processed yet. Run the scheduler or click **Run Now** in the sidebar.",
            icon="📭",
        )
        return

    # ── Headline Metrics ─────────────────────────────────────────────────────
    now = datetime.utcnow()
    soon = now + timedelta(days=7)

    total_offers = len(offers_df)

    verified_offers = 0
    invalid_offers = 0
    expiring_soon = 0

    if not offers_df.empty:
        if "verification_status" in offers_df.columns:
            verified_offers = int((offers_df["verification_status"] == "verified").sum())
            invalid_offers = int((offers_df["verification_status"] == "invalid").sum())

        if "expiry_date" in offers_df.columns:
            expiring_soon = offers_df[
                (offers_df["expiry_date"].notna())
                & (offers_df["expiry_date"] >= now)
                & (offers_df["expiry_date"] <= soon)
            ].shape[0]

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Offers", f"{total_offers:,}")
    c2.metric("Verified Offers ✅", f"{verified_offers:,}")
    c3.metric("Invalid Offers ❌", f"{invalid_offers:,}")
    c4.metric("Expiring in 7 days", f"{expiring_soon:,}", delta_color="inverse")

    st.divider()

    if offers_df.empty:
        st.info("No offers extracted yet.")
        return

    # ── Brand Performance / Top Categories ────────────────────────────────────
    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("🏆 Top Brands by Offer Count")
        if offers_df["brand"].notna().any():
            top_brands = (
                offers_df["brand"]
                .dropna()
                .value_counts()
                .head(8)
                .reset_index()
            )
            top_brands.columns = ["Brand", "Count"]
            fig = px.bar(
                top_brands, x="Count", y="Brand", orientation="h",
                color="Count", color_continuous_scale="Blues",
                template="plotly_dark",
            )
            fig.update_layout(showlegend=False, coloraxis_showscale=False, height=300)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("No brand data available.")

    with col_right:
        st.subheader("📂 Top Categories")
        if "category" in offers_df.columns and offers_df["category"].notna().any():
            top_cats = (
                offers_df["category"]
                .dropna()
                .value_counts()
                .head(8)
                .reset_index()
            )
            top_cats.columns = ["Category", "Count"]
            fig = px.bar(
                top_cats, x="Count", y="Category", orientation="h",
                color="Count", color_continuous_scale="Greens",
                template="plotly_dark",
            )
            fig.update_layout(showlegend=False, coloraxis_showscale=False, height=300)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("No category data available.")

    st.divider()

    # ── Top Subcategories / Verification Status ───────────────────────────────
    col_l2, col_r2 = st.columns(2)

    with col_l2:
        st.subheader("🏷 Top Subcategories")
        if "subcategory" in offers_df.columns and offers_df["subcategory"].notna().any():
            top_subcats = (
                offers_df["subcategory"]
                .dropna()
                .value_counts()
                .head(8)
                .reset_index()
            )
            top_subcats.columns = ["Subcategory", "Count"]
            fig = px.bar(
                top_subcats, x="Count", y="Subcategory", orientation="h",
                color="Count", color_continuous_scale="Purples",
                template="plotly_dark",
            )
            fig.update_layout(showlegend=False, coloraxis_showscale=False, height=300)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("No subcategory data available.")

    with col_r2:
        st.subheader("🔍 Verification Status")
        if "verification_status" in offers_df.columns and offers_df["verification_status"].notna().any():
            ver_counts = (
                offers_df["verification_status"]
                .fillna("unverified")
                .value_counts()
                .reset_index()
            )
            ver_counts.columns = ["Status", "Count"]
            color_map = {
                "verified": "#2ecc71",
                "suspicious": "#f39c12",
                "invalid": "#e74c3c",
                "unverified": "#95a5a6",
            }
            fig = px.pie(
                ver_counts, values="Count", names="Status",
                hole=0.4, template="plotly_dark",
                color="Status", color_discrete_map=color_map,
            )
            fig.update_traces(textposition="inside", textinfo="percent+label")
            fig.update_layout(showlegend=True, height=300)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("No verification data yet — use 'Verify AI' on the Offers Manager page.")

    st.divider()

    # ── Latest Offers ─────────────────────────────────────────────────────────
    st.subheader("🕐 Latest Offers")
    latest = (
        offers_df.sort_values("created_at", ascending=False)
        .head(20)[[
            "brand", "category", "subcategory", "offer_type",
            "discount_percentage", "coupon_code", "expiry_date",
            "verification_status", "summary",
        ]]
        .rename(columns={
            "brand": "Brand", "category": "Category", "subcategory": "Subcategory",
            "offer_type": "Type", "discount_percentage": "Disc %",
            "coupon_code": "Code", "expiry_date": "Expires",
            "verification_status": "Verification", "summary": "Summary",
        })
    )
    st.dataframe(latest, width="stretch", hide_index=True,
                 column_config={"Disc %": st.column_config.NumberColumn(format="%.1f%%"),
                                "Expires": st.column_config.DatetimeColumn(format="YYYY-MM-DD")})
