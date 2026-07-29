"""Email verification dashboard page — classify raw emails as legitimate/suspicious/spam."""
import logging
from datetime import datetime, timezone

import pandas as pd
import streamlit as st

from database.db import get_session
from database.models import Email

logger = logging.getLogger(__name__)

_STATUS_BADGE = {
    "legitimate": "✅ Legitimate",
    "suspicious":  "⚠️ Suspicious",
    "spam":        "❌ Spam",
}
_STATUS_COLOR = {
    "legitimate": "green",
    "suspicious":  "orange",
    "spam":        "red",
}


def _load_emails() -> pd.DataFrame:
    with get_session() as session:
        rows = session.query(Email).order_by(Email.id.desc()).all()
        return pd.DataFrame([
            {
                "id":          e.id,
                "sender":      e.sender,
                "subject":     e.subject,
                "body":        e.body or "",
                "received_date": e.received_date,
                "status":      e.email_verification_status,
                "note":        e.email_verification_note,
                "verified_at": e.email_verified_at,
            }
            for e in rows
        ])


def _save_result(email_id: int, result: dict) -> None:
    with get_session() as session:
        email = session.query(Email).filter(Email.id == email_id).first()
        if email:
            email.email_verification_status = result["status"]
            email.email_verification_note   = result["reason"]
            email.email_verified_at         = datetime.now(timezone.utc).replace(tzinfo=None)


def _verify_all_unverified(df: pd.DataFrame) -> tuple[int, int]:
    from ai.verifier import verify_email_content
    pending = df[df["status"].isna()]
    ok, failed = 0, 0
    for _, row in pending.iterrows():
        result = verify_email_content(row["sender"], row["subject"], row["body"])
        if result:
            _save_result(int(row["id"]), result)
            ok += 1
        else:
            failed += 1
    return ok, failed


def render():
    st.title("🔎 Email Verification")
    st.caption("Use AI to classify each email as Legitimate, Suspicious, or Spam.")

    df = _load_emails()

    if df.empty:
        st.info("No emails in the database yet.", icon="📭")
        return

    # ── Summary metrics ───────────────────────────────────────────────────────
    total      = len(df)
    verified   = int(df["status"].notna().sum())
    unverified = total - verified
    legit      = int((df["status"] == "legitimate").sum())
    suspicious = int((df["status"] == "suspicious").sum())
    spam       = int((df["status"] == "spam").sum())

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total Emails",   total)
    c2.metric("Unverified",     unverified)
    c3.metric("✅ Legitimate",  legit)
    c4.metric("⚠️ Suspicious", suspicious)
    c5.metric("❌ Spam",        spam)

    st.divider()

    # ── Bulk verify button ────────────────────────────────────────────────────
    col_btn, col_info = st.columns([2, 5])
    if col_btn.button("🤖 Verify All Unverified", type="primary", width="stretch"):
        if unverified == 0:
            st.info("All emails are already verified.")
        else:
            with st.spinner(f"Verifying {unverified} email(s) …"):
                ok, failed = _verify_all_unverified(df)
            st.success(f"Done — {ok} verified, {failed} failed.")
            st.rerun()
    col_info.caption(f"{unverified} email(s) not yet verified.")

    st.divider()

    # ── Email table ───────────────────────────────────────────────────────────
    display = df[[
        "id", "sender", "subject", "received_date", "status", "verified_at"
    ]].copy()
    display["status"] = display["status"].map(
        lambda s: _STATUS_BADGE.get(s, "— Unverified") if pd.notna(s) else "— Unverified"
    )
    st.dataframe(
        display.rename(columns={
            "id": "ID", "sender": "Sender", "subject": "Subject",
            "received_date": "Received", "status": "Status", "verified_at": "Verified At",
        }),
        width="stretch",
        hide_index=True,
        column_config={
            "Received":    st.column_config.DatetimeColumn(format="YYYY-MM-DD HH:mm"),
            "Verified At": st.column_config.DatetimeColumn(format="YYYY-MM-DD HH:mm"),
        },
    )

    st.divider()

    # ── Per-email verify ──────────────────────────────────────────────────────
    st.subheader("Verify a Single Email")

    valid_ids = df["id"].tolist()
    col_sel, col_run = st.columns([3, 1])
    selected_id = col_sel.number_input(
        "Email ID",
        min_value=int(df["id"].min()),
        max_value=int(df["id"].max()),
        step=1,
        value=int(valid_ids[0]),
    )

    if col_run.button("▶️ Verify", type="primary", width="stretch"):
        row = df[df["id"] == selected_id].iloc[0]
        with st.spinner("Asking AI to classify this email …"):
            from ai.verifier import verify_email_content
            result = verify_email_content(row["sender"], row["subject"], row["body"])

        if result is None:
            st.error("Verification failed — AI did not return a result.")
        else:
            _save_result(int(selected_id), result)
            status = result["status"]
            color  = _STATUS_COLOR.get(status, "gray")
            badge  = _STATUS_BADGE.get(status, status)
            st.markdown(f"### Result: :{color}[{badge}]")
            st.markdown(f"**Confidence:** {result['confidence']}%")
            st.markdown(f"**Reason:** {result['reason']}")
            st.success("Result saved.")
            st.rerun()

    # Show existing result for selected email
    row = df[df["id"] == selected_id].iloc[0]
    if pd.notna(row["status"]):
        status = row["status"]
        color  = _STATUS_COLOR.get(status, "gray")
        badge  = _STATUS_BADGE.get(status, status)
        st.markdown(f"**Current status:** :{color}[{badge}]")
        if pd.notna(row["note"]):
            st.markdown(f"**Note:** {row['note']}")
