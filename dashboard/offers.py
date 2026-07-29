"""Offers management page — filterable table with per-row actions and AI verification."""
import json
import logging
from datetime import datetime, date, timedelta

import pandas as pd
import streamlit as st

from database.db import get_session
from database.models import Offer

logger = logging.getLogger(__name__)

_ALL_FIELDS = [
    "id", "email_id", "brand", "company", "category", "subcategory", "offer_type",
    "discount_percentage", "coupon_code", "expiry_date", "offer_value", "website",
    "summary", "key_highlights", "is_active", "created_at",
    "verification_status", "verification_reason", "verification_confidence", "verified_at",
]

_EDITABLE = [
    "brand", "company", "category", "subcategory", "offer_type", "discount_percentage",
    "coupon_code", "expiry_date", "offer_value", "website", "summary", "key_highlights", "is_active",
]

_OFFER_TYPE_OPTIONS = ["Discount", "BOGO", "Free Shipping", "Flash Sale", "Bundle", "Loyalty", "Other"]

_STATUS_BADGE = {
    "verified": "✅ Verified",
    "suspicious": "⚠️ Suspicious",
    "invalid": "❌ Invalid",
}

_STATUS_COLOR = {
    "verified": "green",
    "suspicious": "orange",
    "invalid": "red",
}


def _load_offers() -> pd.DataFrame:
    with get_session() as session:
        rows = session.query(Offer).order_by(Offer.id.desc()).all()
        return pd.DataFrame([
            {f: getattr(o, f) for f in _ALL_FIELDS}
            for o in rows
        ])


# ── CREATE ────────────────────────────────────────────────────────────────────

def _render_create():
    st.subheader("Add New Offer")
    with st.form("create_offer_form", clear_on_submit=True):
        c1, c2 = st.columns(2)
        email_id    = c1.number_input("Email ID *", min_value=1, step=1)
        brand       = c2.text_input("Brand")
        company     = c1.text_input("Company")
        category    = c2.text_input("Category")
        subcategory = c1.text_input("Subcategory")
        offer_type  = c2.selectbox("Offer Type", _OFFER_TYPE_OPTIONS)
        discount    = c1.number_input("Discount %", min_value=0.0, max_value=100.0, value=0.0, step=0.5)
        coupon_code = c2.text_input("Coupon Code")
        expiry_date = c1.date_input("Expiry Date", value=None)
        offer_value = c2.text_input("Offer Value")
        is_active   = c1.checkbox("Is Active", value=True)
        website     = st.text_input("Website / Offer URL")
        summary     = st.text_area("Summary")
        key_highlights = st.text_area("Key Highlights (one per line)")

        if st.form_submit_button("Save Offer", type="primary", width="stretch"):
            highlights = [h.strip() for h in key_highlights.splitlines() if h.strip()]
            expiry_dt = datetime.combine(expiry_date, datetime.min.time()) if expiry_date else None
            new_offer = Offer(
                email_id=int(email_id),
                brand=brand or None,
                company=company or None,
                category=category or None,
                subcategory=subcategory or None,
                offer_type=offer_type,
                discount_percentage=float(discount) if discount else None,
                coupon_code=coupon_code or None,
                expiry_date=expiry_dt,
                offer_value=offer_value or None,
                website=website or None,
                summary=summary or None,
                key_highlights=json.dumps(highlights),
                is_active=is_active,
            )
            try:
                with get_session() as session:
                    session.add(new_offer)
                st.success("Offer created.")
                st.rerun()
            except Exception as exc:
                st.error(f"Failed to create offer: {exc}")


# ── VIEW ──────────────────────────────────────────────────────────────────────

def _render_view(offer_id: int):
    with get_session() as session:
        offer = session.query(Offer).filter(Offer.id == offer_id).first()
        if offer is None:
            st.error(f"Offer {offer_id} not found.")
            return
        snap = {f: getattr(offer, f) for f in _ALL_FIELDS}

    st.subheader(f"Offer #{offer_id} — {snap['brand'] or 'Unknown Brand'}")

    c1, c2, c3 = st.columns(3)
    c1.metric("Brand", snap["brand"] or "—")
    c2.metric("Category", snap["category"] or "—")
    c3.metric("Subcategory", snap["subcategory"] or "—")

    c4, c5, c6 = st.columns(3)
    c4.metric("Discount", f"{snap['discount_percentage']:.0f}%" if snap["discount_percentage"] else "—")
    c5.metric("Coupon Code", snap["coupon_code"] or "—")
    c6.metric("Offer Type", snap["offer_type"] or "—")

    if snap.get("website"):
        st.markdown(f"**Website:** [{snap['website']}]({snap['website']})")

    if snap["summary"]:
        st.markdown(f"**Summary:** {snap['summary']}")

    if snap["key_highlights"]:
        try:
            highlights = json.loads(snap["key_highlights"])
            if highlights:
                st.markdown("**Key Highlights:**")
                for h in highlights:
                    st.markdown(f"- {h}")
        except (json.JSONDecodeError, TypeError):
            pass

    # Verification status
    v_status = snap.get("verification_status")
    if v_status:
        badge = _STATUS_BADGE.get(v_status, v_status)
        color = _STATUS_COLOR.get(v_status, "gray")
        st.markdown(f"**Verification:** :{color}[{badge}]")
        if snap.get("verification_confidence") is not None:
            st.markdown(f"**Confidence:** {snap['verification_confidence']:.0f}%")
        if snap.get("verification_reason"):
            st.markdown(f"**Reason:** {snap['verification_reason']}")
    else:
        st.info("This offer has not been verified yet.")

    if st.button("Close", key=f"close_view_{offer_id}"):
        st.session_state.pop("action_offer_id", None)
        st.session_state.pop("active_action", None)
        st.rerun()


# ── EDIT ──────────────────────────────────────────────────────────────────────

def _render_edit(offer_id: int):
    with get_session() as session:
        offer = session.query(Offer).filter(Offer.id == offer_id).first()
        if offer is None:
            st.error(f"Offer {offer_id} not found.")
            return
        snap = {f: getattr(offer, f) for f in _EDITABLE}

    st.subheader(f"Edit Offer #{offer_id}")
    with st.form(f"edit_offer_{offer_id}"):
        c1, c2 = st.columns(2)
        brand       = c1.text_input("Brand",       value=snap["brand"] or "")
        company     = c2.text_input("Company",     value=snap["company"] or "")
        category    = c1.text_input("Category",    value=snap["category"] or "")
        subcategory = c2.text_input("Subcategory", value=snap["subcategory"] or "")
        offer_type  = c1.selectbox("Offer Type", _OFFER_TYPE_OPTIONS,
                                   index=_OFFER_TYPE_OPTIONS.index(snap["offer_type"])
                                   if snap["offer_type"] in _OFFER_TYPE_OPTIONS else 0)
        discount    = c2.number_input("Discount %", 0.0, 100.0,
                                      value=float(snap["discount_percentage"] or 0), step=0.5)
        coupon_code = c1.text_input("Coupon Code", value=snap["coupon_code"] or "")
        expiry_val  = snap["expiry_date"].date() if isinstance(snap["expiry_date"], datetime) else snap["expiry_date"]
        expiry_date = c2.date_input("Expiry Date", value=expiry_val)
        offer_value = c1.text_input("Offer Value", value=snap["offer_value"] or "")
        website     = c2.text_input("Website / Offer URL", value=snap["website"] or "")
        is_active   = c1.checkbox("Is Active",     value=bool(snap["is_active"]))
        summary     = st.text_area("Summary",      value=snap["summary"] or "")
        existing_highlights = ""
        if snap["key_highlights"]:
            try:
                existing_highlights = "\n".join(json.loads(snap["key_highlights"]))
            except (json.JSONDecodeError, TypeError):
                existing_highlights = snap["key_highlights"]
        key_highlights = st.text_area("Key Highlights (one per line)", value=existing_highlights)

        col_save, col_cancel = st.columns(2)
        if col_save.form_submit_button("Update Offer", type="primary", width="stretch"):
            highlights = [h.strip() for h in key_highlights.splitlines() if h.strip()]
            expiry_dt = datetime.combine(expiry_date, datetime.min.time()) if expiry_date else None
            try:
                with get_session() as session:
                    o = session.query(Offer).filter(Offer.id == offer_id).first()
                    if o:
                        o.brand = brand or None
                        o.company = company or None
                        o.category = category or None
                        o.subcategory = subcategory or None
                        o.offer_type = offer_type
                        o.discount_percentage = float(discount) if discount else None
                        o.coupon_code = coupon_code or None
                        o.expiry_date = expiry_dt
                        o.offer_value = offer_value or None
                        o.website = website or None
                        o.is_active = is_active
                        o.summary = summary or None
                        o.key_highlights = json.dumps(highlights)
                st.success(f"Offer #{offer_id} updated.")
                st.session_state.pop("action_offer_id", None)
                st.session_state.pop("active_action", None)
                st.rerun()
            except Exception as exc:
                st.error(f"Update failed: {exc}")
        if col_cancel.form_submit_button("Cancel", width="stretch"):
            st.session_state.pop("action_offer_id", None)
            st.session_state.pop("active_action", None)
            st.rerun()


# ── DELETE ────────────────────────────────────────────────────────────────────

def _render_delete_confirm(offer_id: int):
    st.warning(f"Are you sure you want to delete Offer #{offer_id}?")
    col_yes, col_no = st.columns(2)
    if col_yes.button("Yes, Delete", type="primary", key=f"confirm_del_{offer_id}"):
        try:
            with get_session() as session:
                o = session.query(Offer).filter(Offer.id == offer_id).first()
                if o:
                    session.delete(o)
            st.success(f"Offer #{offer_id} deleted.")
        except Exception as exc:
            st.error(f"Delete failed: {exc}")
        st.session_state.pop("action_offer_id", None)
        st.session_state.pop("active_action", None)
        st.rerun()
    if col_no.button("Cancel", key=f"cancel_del_{offer_id}"):
        st.session_state.pop("action_offer_id", None)
        st.session_state.pop("active_action", None)
        st.rerun()


# ── AI VERIFY ─────────────────────────────────────────────────────────────────

def _render_verify(offer_id: int):
    with get_session() as session:
        offer = session.query(Offer).filter(Offer.id == offer_id).first()
        if offer is None:
            st.error(f"Offer {offer_id} not found.")
            return
        offer_data = {f: getattr(offer, f) for f in _ALL_FIELDS}

    st.subheader(f"AI Verification — Offer #{offer_id}")

    existing_status = offer_data.get("verification_status")
    if existing_status:
        badge = _STATUS_BADGE.get(existing_status, existing_status)
        color = _STATUS_COLOR.get(existing_status, "gray")
        st.markdown(f"**Current Status:** :{color}[{badge}]  "
                    f"(Confidence: {offer_data.get('verification_confidence', 0):.0f}%)")
        st.markdown(f"**Reason:** {offer_data.get('verification_reason', '—')}")
        st.markdown("---")

    col_run, col_cancel = st.columns(2)
    if col_run.button("Run AI Verification", type="primary", key=f"run_verify_{offer_id}"):
        with st.spinner("Asking Gemini to verify this offer…"):
            try:
                from ai.verifier import verify_offer
                result = verify_offer(offer_data)
                if result is None:
                    st.error("Verification failed — Gemini did not return a result.")
                else:
                    with get_session() as session:
                        o = session.query(Offer).filter(Offer.id == offer_id).first()
                        if o:
                            o.verification_status = result["status"]
                            o.verification_reason = result["reason"]
                            o.verification_confidence = float(result["confidence"])
                            o.verified_at = datetime.utcnow()

                    badge = _STATUS_BADGE.get(result["status"], result["status"])
                    color = _STATUS_COLOR.get(result["status"], "gray")
                    st.markdown(f"### Result: :{color}[{badge}]")
                    st.markdown(f"**Confidence:** {result['confidence']}%")
                    st.markdown(f"**Reason:** {result['reason']}")
                    st.success("Verification saved.")
                    st.session_state.pop("action_offer_id", None)
                    st.session_state.pop("active_action", None)
                    st.rerun()
            except Exception as exc:
                st.error(f"Verification error: {exc}")

    if col_cancel.button("Cancel", key=f"cancel_verify_{offer_id}"):
        st.session_state.pop("action_offer_id", None)
        st.session_state.pop("active_action", None)
        st.rerun()


# ── MAIN RENDER ───────────────────────────────────────────────────────────────

def render():
    st.title("🗂 Offers Manager")
    st.caption("View, add, edit, delete, and AI-verify extracted offer records.")

    tab_table, tab_create = st.tabs(["📋 All Offers", "➕ Add Offer"])

    with tab_create:
        _render_create()

    with tab_table:
        df = _load_offers()

        if df.empty:
            st.info("No offers in the database yet.", icon="📭")
            return

        # ── Filters ───────────────────────────────────────────────────────────
        with st.expander("Filters", expanded=False):
            fc1, fc2, fc3 = st.columns(3)
            brands = ["All"] + sorted(df["brand"].dropna().unique().tolist())
            sel_brand = fc1.selectbox("Brand", brands)

            cats = ["All"] + sorted(df["category"].dropna().unique().tolist())
            sel_cat = fc2.selectbox("Category", cats)

            subcats = ["All"] + sorted(df["subcategory"].dropna().unique().tolist())
            sel_subcat = fc3.selectbox("Subcategory", subcats)

            fc4, fc5, fc6 = st.columns(3)
            offer_types = ["All"] + sorted(df["offer_type"].dropna().unique().tolist())
            sel_type = fc4.selectbox("Offer Type", offer_types)

            ver_options = ["All", "verified", "suspicious", "invalid", "unverified"]
            sel_ver = fc5.selectbox("Verification Status", ver_options)

            sel_active = fc6.selectbox("Status", ["All", "Active", "Inactive"])

            fc7, fc8 = st.columns(2)
            exp_from = fc7.date_input("Expiry From", value=None)
            exp_to   = fc8.date_input("Expiry To",   value=None)

        fdf = df.copy()
        if sel_brand != "All":
            fdf = fdf[fdf["brand"] == sel_brand]
        if sel_cat != "All":
            fdf = fdf[fdf["category"] == sel_cat]
        if sel_subcat != "All":
            fdf = fdf[fdf["subcategory"] == sel_subcat]
        if sel_type != "All":
            fdf = fdf[fdf["offer_type"] == sel_type]
        if sel_ver == "unverified":
            fdf = fdf[fdf["verification_status"].isna()]
        elif sel_ver != "All":
            fdf = fdf[fdf["verification_status"] == sel_ver]
        if sel_active == "Active":
            fdf = fdf[fdf["is_active"] == True]
        elif sel_active == "Inactive":
            fdf = fdf[fdf["is_active"] == False]
        if exp_from:
            fdf = fdf[fdf["expiry_date"].isna() | (fdf["expiry_date"].dt.date >= exp_from)]
        if exp_to:
            fdf = fdf[fdf["expiry_date"].isna() | (fdf["expiry_date"].dt.date <= exp_to)]

        # ── Bulk Verify ───────────────────────────────────────────────────────
        unverified_ids = df[df["verification_status"].isna()]["id"].tolist()
        col_btn, col_cap = st.columns([2, 5])
        if col_btn.button("🤖 Verify All Unverified Offers", type="primary", width="stretch"):
            if not unverified_ids:
                st.info("All offers are already verified.")
            else:
                from ai.verifier import verify_offer
                from datetime import datetime, timezone
                ok, failed = 0, 0
                progress = st.progress(0, text="Verifying offers …")
                total = len(unverified_ids)
                for i, offer_id in enumerate(unverified_ids):
                    try:
                        with get_session() as session:
                            o = session.query(Offer).filter(Offer.id == offer_id).first()
                            if o is None:
                                continue
                            offer_data = {f: getattr(o, f) for f in _ALL_FIELDS}

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
                        logger.error("Bulk verify failed for offer %s: %s", offer_id, exc)
                        failed += 1
                    progress.progress((i + 1) / total, text=f"Verified {i + 1}/{total} …")
                progress.empty()
                st.success(f"Done — {ok} verified, {failed} failed.")
                st.rerun()
        col_cap.caption(f"{len(unverified_ids)} unverified offer(s) · {len(df)} total")

        st.caption(f"Showing {len(fdf)} of {len(df)} offers")

        # ── Table ─────────────────────────────────────────────────────────────
        display_df = fdf[[
            "id", "brand", "category", "subcategory", "offer_type",
            "discount_percentage", "expiry_date", "is_active", "verification_status",
        ]].copy()

        display_df["verification_status"] = display_df["verification_status"].map(
            lambda s: _STATUS_BADGE.get(s, "— Unverified") if pd.notna(s) else "— Unverified"
        )

        st.dataframe(
            display_df.rename(columns={
                "id": "ID", "brand": "Brand", "category": "Category",
                "subcategory": "Subcategory", "offer_type": "Type",
                "discount_percentage": "Disc %", "expiry_date": "Expiry",
                "is_active": "Active", "verification_status": "Verification",
            }),
            width="stretch",
            hide_index=True,
            column_config={
                "Disc %":  st.column_config.NumberColumn(format="%.1f%%"),
                "Active":  st.column_config.CheckboxColumn(),
                "Expiry":  st.column_config.DatetimeColumn(format="YYYY-MM-DD"),
            },
        )

        st.divider()

        # ── Per-row Action Controls ───────────────────────────────────────────
        st.subheader("Row Actions")
        st.caption("Select an offer ID and choose an action.")

        valid_ids = fdf["id"].tolist()
        if not valid_ids:
            st.info("No offers match the current filters.")
            return

        col_id, col_view, col_edit, col_del, col_verify = st.columns([2, 1, 1, 1, 1])
        selected_id = col_id.number_input(
            "Offer ID",
            min_value=int(df["id"].min()),
            max_value=int(df["id"].max()),
            step=1,
            value=int(valid_ids[0]),
        )

        if col_view.button("View", width="stretch", key="btn_view"):
            st.session_state["action_offer_id"] = selected_id
            st.session_state["active_action"] = "view"

        if col_edit.button("Edit", width="stretch", type="primary", key="btn_edit"):
            st.session_state["action_offer_id"] = selected_id
            st.session_state["active_action"] = "edit"

        if col_del.button("Delete", width="stretch", type="secondary", key="btn_del"):
            st.session_state["action_offer_id"] = selected_id
            st.session_state["active_action"] = "delete"

        if col_verify.button("Verify AI", width="stretch", key="btn_verify"):
            st.session_state["action_offer_id"] = selected_id
            st.session_state["active_action"] = "verify"

        # ── Action Panel ─────────────────────────────────────────────────────
        action = st.session_state.get("active_action")
        action_id = st.session_state.get("action_offer_id")

        if action and action_id:
            st.divider()
            if action == "view":
                _render_view(action_id)
            elif action == "edit":
                _render_edit(action_id)
            elif action == "delete":
                _render_delete_confirm(action_id)
            elif action == "verify":
                _render_verify(action_id)
