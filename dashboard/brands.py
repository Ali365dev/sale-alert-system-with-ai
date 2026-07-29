"""Brands Manager page — CRUD for brands table + single/bulk AI offer search."""
import json
import logging
from datetime import datetime, timezone

import pandas as pd
import streamlit as st

from database.db import get_session
from database.models import Brand, Offer

logger = logging.getLogger(__name__)

_ALL_FIELDS = ["id", "name", "website", "categories", "emails", "is_active", "last_searched", "created_at"]


def _parse_emails(raw: str) -> list[str]:
    """Comma/newline-separated text -> deduped, lowercased, sorted email list."""
    parts = [p.strip().lower() for p in raw.replace("\n", ",").split(",")]
    return sorted({p for p in parts if p})


def _load_brands() -> pd.DataFrame:
    with get_session() as session:
        rows = session.query(Brand).order_by(Brand.name.asc()).all()
        return pd.DataFrame([
            {
                "id": b.id,
                "name": b.name,
                "website": b.website or "",
                "categories": b.categories or "[]",
                "emails": b.emails or "[]",
                "is_active": b.is_active,
                "last_searched": b.last_searched,
                "created_at": b.created_at,
            }
            for b in rows
        ])


def _save_offers(offers_data: list[dict]) -> tuple[int, int]:
    saved, failed = 0, 0
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
        except Exception as exc:
            logger.error("Save offer failed: %s", exc)
            failed += 1
    return saved, failed


def _stamp_last_searched(brand_id: int) -> None:
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b:
            b.last_searched = datetime.now(timezone.utc).replace(tzinfo=None)


# ── SINGLE SEARCH ─────────────────────────────────────────────────────────────

def _render_single_search(df: pd.DataFrame):
    st.subheader("Single Brand Search")
    st.caption("Pick a brand and click Search to fetch its current promotions via AI.")

    if df.empty:
        st.info("No brands in the database.")
        return

    brand_names = df["name"].tolist()
    col_select, col_btn = st.columns([4, 1])
    selected_name = col_select.selectbox("Select Brand", brand_names, key="single_brand_sel")
    row = df[df["name"] == selected_name].iloc[0]

    col_btn.markdown("<br>", unsafe_allow_html=True)
    search_clicked = col_btn.button("🔍 Search", type="primary", width="stretch", key="single_search_btn")

    # Show last searched time
    if pd.notna(row["last_searched"]):
        st.caption(f"Last searched: {row['last_searched']}")

    # Show categories
    try:
        cats = json.loads(row["categories"])
        if cats:
            st.caption("Categories: " + ", ".join(cats))
    except (json.JSONDecodeError, TypeError):
        pass

    if search_clicked:
        brand_dict = {
            "name": row["name"],
            "website": row["website"],
            "categories": json.loads(row["categories"]) if row["categories"] else [],
        }
        with st.spinner(f"Searching promotions for {selected_name} …"):
            try:
                from ai.brand_fetcher import fetch_offers_for_brand
                offers_data = fetch_offers_for_brand(brand_dict, cache=None)
                if not offers_data:
                    st.warning(f"No active promotions found for {selected_name}.")
                else:
                    saved, failed = _save_offers(offers_data)
                    _stamp_last_searched(int(row["id"]))
                    active = sum(1 for o in offers_data if o.get("_is_sale"))
                    st.success(f"Found {len(offers_data)} offer(s) ({active} active) — {saved} saved, {failed} failed.")

                    # Preview results
                    preview = pd.DataFrame([
                        {
                            "Type": o.get("offer_type", "—"),
                            "Discount %": o.get("discount_percentage", "—"),
                            "Coupon": o.get("coupon_code") or "—",
                            "Summary": (o.get("summary") or "")[:120],
                        }
                        for o in offers_data
                    ])
                    st.dataframe(preview, width="stretch", hide_index=True)
            except Exception as exc:
                logger.error("Single brand search failed: %s", exc)
                st.error(f"Search failed: {exc}")


# ── BULK SEARCH ───────────────────────────────────────────────────────────────

def _render_bulk_search(df: pd.DataFrame):
    st.subheader("Bulk Brand Search")
    st.caption("Search all active brands at once. This may take a few minutes.")

    if df.empty:
        st.info("No brands in the database.")
        return

    active_df = df[df["is_active"] == True]
    st.info(f"{len(active_df)} active brand(s) will be searched.")

    col_btn, col_skip = st.columns([2, 3])
    skip_cache = col_skip.checkbox("Skip cache — re-search all brands", value=False)

    if col_btn.button("🌐 Search All Active Brands", type="primary", width="stretch", key="bulk_search_btn"):
        brands_list = [
            {
                "name": row["name"],
                "website": row["website"],
                "categories": json.loads(row["categories"]) if row["categories"] else [],
            }
            for _, row in active_df.iterrows()
        ]

        progress = st.progress(0, text="Starting bulk search …")
        total_offers, total_saved, total_save_failed = 0, 0, 0
        total_active = 0
        ok_brands, fail_brands = 0, 0

        try:
            from ai.brand_fetcher import fetch_offers_for_brand
            from ai import cache as _cache

            cache = _cache.load()
            for i, (brand_dict, (_, brand_row)) in enumerate(zip(brands_list, active_df.iterrows())):
                name = brand_dict["name"]
                progress.progress((i + 1) / len(brands_list), text=f"Searching {name} ({i+1}/{len(brands_list)}) …")
                try:
                    offers = fetch_offers_for_brand(brand_dict, cache=cache)
                    if offers:
                        b_saved, b_failed = _save_offers(offers)
                        total_offers += len(offers)
                        total_saved += b_saved
                        total_save_failed += b_failed
                        total_active += sum(1 for o in offers if o.get("_is_sale"))
                    _stamp_last_searched(int(brand_row["id"]))
                    ok_brands += 1
                except Exception as exc:
                    logger.error("Bulk search failed for %s: %s", name, exc)
                    fail_brands += 1

            _cache.save(cache)
        except Exception as exc:
            st.error(f"Bulk search error: {exc}")
            return
        finally:
            progress.empty()

        st.success(
            f"Done — {ok_brands} brand(s) searched, {fail_brands} failed. "
            f"{total_offers} offer(s) found ({total_active} active), {total_saved} saved."
        )
        st.rerun()


# ── ADD BRAND ─────────────────────────────────────────────────────────────────

def _render_add():
    st.subheader("Add New Brand")
    with st.form("add_brand_form", clear_on_submit=True):
        c1, c2 = st.columns(2)
        name = c1.text_input("Brand Name *")
        website = c2.text_input("Website URL")
        categories_raw = st.text_input("Categories (comma-separated)")
        emails_raw = st.text_area(
            "Sender Emails (comma or newline separated)",
            placeholder="info@bata.com, offers@bata.com",
        )
        is_active = st.checkbox("Active", value=True)

        if st.form_submit_button("Add Brand", type="primary", width="stretch"):
            if not name.strip():
                st.error("Brand name is required.")
                return
            cats = [c.strip() for c in categories_raw.split(",") if c.strip()]
            emails = _parse_emails(emails_raw)
            try:
                with get_session() as session:
                    session.add(Brand(
                        name=name.strip(),
                        website=website.strip() or None,
                        categories=json.dumps(cats),
                        emails=json.dumps(emails) if emails else None,
                        is_active=is_active,
                    ))
                st.success(f"Brand '{name}' added.")
                st.rerun()
            except Exception as exc:
                st.error(f"Failed to add brand: {exc}")


# ── EDIT BRAND ────────────────────────────────────────────────────────────────

def _render_edit(brand_id: int):
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            st.error(f"Brand {brand_id} not found.")
            return
        snap = {f: getattr(b, f) for f in _ALL_FIELDS}

    st.subheader(f"Edit Brand — {snap['name']}")
    try:
        cats_list = json.loads(snap["categories"] or "[]")
        cats_str = ", ".join(cats_list)
    except (json.JSONDecodeError, TypeError):
        cats_str = ""

    try:
        emails_list = json.loads(snap["emails"] or "[]")
        emails_str = "\n".join(emails_list)
    except (json.JSONDecodeError, TypeError):
        emails_str = ""

    with st.form(f"edit_brand_{brand_id}"):
        c1, c2 = st.columns(2)
        name = c1.text_input("Brand Name", value=snap["name"])
        website = c2.text_input("Website", value=snap["website"] or "")
        categories_raw = st.text_input("Categories (comma-separated)", value=cats_str)
        emails_raw = st.text_area(
            "Sender Emails (comma or newline separated)",
            value=emails_str,
            placeholder="info@bata.com, offers@bata.com",
        )
        is_active = st.checkbox("Active", value=bool(snap["is_active"]))

        col_save, col_cancel = st.columns(2)
        if col_save.form_submit_button("Update", type="primary", width="stretch"):
            cats = [c.strip() for c in categories_raw.split(",") if c.strip()]
            emails = _parse_emails(emails_raw)
            try:
                with get_session() as session:
                    o = session.query(Brand).filter(Brand.id == brand_id).first()
                    if o:
                        o.name = name.strip()
                        o.website = website.strip() or None
                        o.categories = json.dumps(cats)
                        o.emails = json.dumps(emails) if emails else None
                        o.is_active = is_active
                st.success("Brand updated.")
                st.session_state.pop("brand_action", None)
                st.session_state.pop("brand_action_id", None)
                st.rerun()
            except Exception as exc:
                st.error(f"Update failed: {exc}")
        if col_cancel.form_submit_button("Cancel", width="stretch"):
            st.session_state.pop("brand_action", None)
            st.session_state.pop("brand_action_id", None)
            st.rerun()


# ── DELETE BRAND ──────────────────────────────────────────────────────────────

def _render_delete(brand_id: int):
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        name = b.name if b else f"#{brand_id}"

    st.warning(f"Delete brand **{name}**? This cannot be undone.")
    col_yes, col_no = st.columns(2)
    if col_yes.button("Yes, Delete", type="primary", key=f"del_brand_yes_{brand_id}"):
        try:
            with get_session() as session:
                b = session.query(Brand).filter(Brand.id == brand_id).first()
                if b:
                    session.delete(b)
            st.success(f"Brand '{name}' deleted.")
        except Exception as exc:
            st.error(f"Delete failed: {exc}")
        st.session_state.pop("brand_action", None)
        st.session_state.pop("brand_action_id", None)
        st.rerun()
    if col_no.button("Cancel", key=f"del_brand_no_{brand_id}"):
        st.session_state.pop("brand_action", None)
        st.session_state.pop("brand_action_id", None)
        st.rerun()


# ── MAIN RENDER ───────────────────────────────────────────────────────────────

def render():
    st.title("🏷️ Brands Manager")
    st.caption("Manage brands stored in Supabase and search their current promotions via AI.")

    tab_search, tab_bulk, tab_brands, tab_add = st.tabs([
        "🔍 Single Search", "🌐 Bulk Search", "📋 All Brands", "➕ Add Brand"
    ])

    df = _load_brands()

    with tab_search:
        _render_single_search(df)

    with tab_bulk:
        _render_bulk_search(df)

    with tab_brands:
        if df.empty:
            st.info("No brands in the database.", icon="📭")
        else:
            # Summary metrics
            total = len(df)
            active_count = int(df["is_active"].sum())
            searched = int(df["last_searched"].notna().sum())
            total_emails = int(df["emails"].apply(lambda e: len(json.loads(e)) if e else 0).sum())
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Total Brands", total)
            m2.metric("Active", active_count)
            m3.metric("Ever Searched", searched)
            m4.metric("Known Sender Emails", total_emails)

            st.divider()

            # Display table
            display = df[["id", "name", "website", "is_active", "last_searched"]].copy()
            display["categories"] = df["categories"].apply(
                lambda c: ", ".join(json.loads(c)) if c else ""
            )
            display["emails"] = df["emails"].apply(
                lambda e: ", ".join(json.loads(e)) if e else ""
            )
            st.dataframe(
                display.rename(columns={
                    "id": "ID", "name": "Name", "website": "Website",
                    "is_active": "Active", "last_searched": "Last Searched",
                    "categories": "Categories", "emails": "Emails",
                }),
                width="stretch",
                hide_index=True,
                column_config={
                    "Active": st.column_config.CheckboxColumn(),
                    "Last Searched": st.column_config.DatetimeColumn(format="YYYY-MM-DD HH:mm"),
                    "Website": st.column_config.LinkColumn(),
                },
            )

            st.divider()
            st.subheader("Row Actions")

            valid_ids = df["id"].tolist()
            col_id, col_edit, col_del = st.columns([2, 1, 1])
            selected_id = col_id.number_input(
                "Brand ID",
                min_value=int(df["id"].min()),
                max_value=int(df["id"].max()),
                step=1,
                value=int(valid_ids[0]),
                key="brand_row_id",
            )
            if col_edit.button("Edit", type="primary", width="stretch", key="brand_edit_btn"):
                st.session_state["brand_action"] = "edit"
                st.session_state["brand_action_id"] = selected_id
            if col_del.button("Delete", width="stretch", key="brand_del_btn"):
                st.session_state["brand_action"] = "delete"
                st.session_state["brand_action_id"] = selected_id

            action = st.session_state.get("brand_action")
            action_id = st.session_state.get("brand_action_id")
            if action and action_id:
                st.divider()
                if action == "edit":
                    _render_edit(action_id)
                elif action == "delete":
                    _render_delete(action_id)

    with tab_add:
        _render_add()
