"""Analytics page — interactive charts for offer trends and distributions."""
import logging

import pandas as pd
import plotly.express as px
import streamlit as st

from database.db import get_session
from database.models import Offer, Email

logger = logging.getLogger(__name__)


def _load_offers() -> pd.DataFrame:
    with get_session() as session:
        rows = (
            session.query(Offer, Email.received_date)
            .join(Email, Offer.email_id == Email.id)
            .all()
        )
        data = []
        for o, received_date in rows:
            data.append({
                "brand": o.brand,
                "company": o.company,
                "category": o.category,
                "subcategory": o.subcategory,
                "offer_type": o.offer_type,
                "discount_percentage": o.discount_percentage,
                "coupon_code": o.coupon_code,
                "expiry_date": o.expiry_date,
                "is_active": o.is_active,
                "created_at": o.created_at,
                "received_date": received_date,
                "verification_status": o.verification_status,
                "verification_confidence": o.verification_confidence,
            })
    return pd.DataFrame(data)


def render():
    st.title("📈 Analytics")
    st.caption("Visualise offer patterns, discount trends, and brand performance.")

    df = _load_offers()

    if df.empty:
        st.info("No data yet — process some emails first.", icon="📭")
        return

    # ── Filters ───────────────────────────────────────────────────────────────
    with st.expander("🔧 Filters", expanded=False):
        col1, col2, col3 = st.columns(3)
        selected_cats = col1.multiselect(
            "Category", sorted(df["category"].dropna().unique())
        )
        selected_subcats = col2.multiselect(
            "Subcategory", sorted(df["subcategory"].dropna().unique())
        )
        selected_types = col3.multiselect(
            "Offer Type", sorted(df["offer_type"].dropna().unique())
        )
        if selected_cats:
            df = df[df["category"].isin(selected_cats)]
        if selected_subcats:
            df = df[df["subcategory"].isin(selected_subcats)]
        if selected_types:
            df = df[df["offer_type"].isin(selected_types)]

    # ── Row 1: Offers by Brand / Category ────────────────────────────────────
    col_l, col_r = st.columns(2)

    with col_l:
        st.subheader("Offers by Brand")
        brand_counts = df["brand"].dropna().value_counts().head(12).reset_index()
        brand_counts.columns = ["Brand", "Count"]
        fig = px.bar(
            brand_counts, x="Brand", y="Count",
            color="Count", color_continuous_scale="Teal",
            template="plotly_dark",
        )
        fig.update_layout(coloraxis_showscale=False, xaxis_tickangle=-35, height=350)
        st.plotly_chart(fig, width="stretch")

    with col_r:
        st.subheader("Offers by Category")
        cat_counts = df["category"].dropna().value_counts().reset_index()
        cat_counts.columns = ["Category", "Count"]
        fig = px.pie(
            cat_counts, values="Count", names="Category",
            hole=0.4, template="plotly_dark",
            color_discrete_sequence=px.colors.sequential.Viridis,
        )
        fig.update_traces(textposition="inside", textinfo="percent+label")
        fig.update_layout(showlegend=False, height=350)
        st.plotly_chart(fig, width="stretch")

    # ── Row 2: Subcategories / Offer Types ───────────────────────────────────
    col_l2, col_r2 = st.columns(2)

    with col_l2:
        st.subheader("Top Subcategories")
        if df["subcategory"].notna().any():
            subcat_counts = df["subcategory"].dropna().value_counts().head(12).reset_index()
            subcat_counts.columns = ["Subcategory", "Count"]
            fig = px.bar(
                subcat_counts, x="Count", y="Subcategory", orientation="h",
                color="Count", color_continuous_scale="Purples",
                template="plotly_dark",
            )
            fig.update_layout(coloraxis_showscale=False, height=350)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("No subcategory data available.")

    with col_r2:
        st.subheader("Offer Types Breakdown")
        type_counts = df["offer_type"].dropna().value_counts().reset_index()
        type_counts.columns = ["Type", "Count"]
        fig = px.bar(
            type_counts, x="Count", y="Type", orientation="h",
            color="Count", color_continuous_scale="RdYlGn",
            template="plotly_dark",
        )
        fig.update_layout(coloraxis_showscale=False, height=350)
        st.plotly_chart(fig, width="stretch")

    # ── Row 3: Discount Distribution / Verification Status ───────────────────
    col_l3, col_r3 = st.columns(2)

    with col_l3:
        st.subheader("Discount % Distribution")
        disc = df[df["discount_percentage"].notna()]["discount_percentage"]
        if not disc.empty:
            fig = px.histogram(
                disc, nbins=20, template="plotly_dark",
                labels={"value": "Discount %", "count": "Number of Offers"},
                color_discrete_sequence=["#00b4d8"],
            )
            fig.update_layout(showlegend=False, height=320)
            st.plotly_chart(fig, width="stretch")
        else:
            st.info("No discount data available.")

    with col_r3:
        st.subheader("Verification Status")
        ver_data = df["verification_status"].fillna("unverified").value_counts().reset_index()
        ver_data.columns = ["Status", "Count"]
        color_map = {
            "verified": "#2ecc71",
            "suspicious": "#f39c12",
            "invalid": "#e74c3c",
            "unverified": "#95a5a6",
        }
        fig = px.bar(
            ver_data, x="Status", y="Count",
            color="Status", color_discrete_map=color_map,
            template="plotly_dark",
        )
        fig.update_layout(showlegend=False, height=320)
        st.plotly_chart(fig, width="stretch")

    # ── Monthly Trend ─────────────────────────────────────────────────────────
    st.subheader("📅 Monthly Email Trend")
    df_time = df[df["received_date"].notna()].copy()
    if not df_time.empty:
        df_time["month"] = pd.to_datetime(df_time["received_date"]).dt.to_period("M").astype(str)
        monthly = df_time.groupby("month").size().reset_index(name="Emails")
        fig = px.line(
            monthly, x="month", y="Emails",
            markers=True, template="plotly_dark",
            color_discrete_sequence=["#90e0ef"],
        )
        fig.update_layout(xaxis_title="Month", height=300)
        st.plotly_chart(fig, width="stretch")
    else:
        st.info("Not enough date data for trend chart.")

    # ── Top Discounted Brands ─────────────────────────────────────────────────
    st.subheader("💸 Top Discounted Brands (avg %)")
    top_disc = (
        df[df["discount_percentage"].notna()]
        .groupby("brand")["discount_percentage"]
        .mean()
        .sort_values(ascending=False)
        .head(10)
        .reset_index()
    )
    top_disc.columns = ["Brand", "Avg Discount %"]
    if not top_disc.empty:
        fig = px.bar(
            top_disc, x="Brand", y="Avg Discount %",
            color="Avg Discount %", color_continuous_scale="Oranges",
            template="plotly_dark",
        )
        fig.update_layout(coloraxis_showscale=False, height=300, xaxis_tickangle=-30)
        st.plotly_chart(fig, width="stretch")

    # ── Brand Performance (offers + avg discount + verification) ─────────────
    st.subheader("📊 Brand Performance")
    if not df.empty and df["brand"].notna().any():
        bp = df.groupby("brand").agg(
            Offers=("brand", "count"),
            Avg_Discount=("discount_percentage", "mean"),
            Verified=("verification_status", lambda x: (x == "verified").sum()),
        ).reset_index()
        bp.columns = ["Brand", "Offers", "Avg Discount %", "Verified"]
        bp = bp.sort_values("Offers", ascending=False).head(15)
        bp["Avg Discount %"] = bp["Avg Discount %"].round(1)
        st.dataframe(bp, width="stretch", hide_index=True)
