"""One-off pipeline action endpoints — mirrors the Streamlit sidebar action buttons."""
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify

bp = Blueprint("actions", __name__, url_prefix="/api/actions")

_web_sales_state = {"running": False, "saved": 0, "failed": 0, "total_active": 0, "done": 0, "total": 0}
_research_state = {"running": False, "done": 0, "total": 0, "inserted": 0, "updated": 0, "failed_brands": []}
_process_pending_state = {"running": False, "processed": 0, "failed": 0, "error": None}

_FETCH_LOG_LIMIT = 40
_fetch_emails_state = {
    "running": False,
    "phase": "idle",  # idle | listing | fetching | done | cancelled | error
    "done": 0,
    "total": 0,
    "fetched": 0,
    "error": None,
    "logs": [],
}
_fetch_cancel_event = threading.Event()


def _fetch_log(message: str) -> None:
    _fetch_emails_state["logs"].append({
        "time": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
        "message": message,
    })
    del _fetch_emails_state["logs"][:-_FETCH_LOG_LIMIT]


def _fetch_progress(event: str, data: dict) -> None:
    if event == "listing":
        _fetch_emails_state["phase"] = "listing"
        _fetch_log("Listing messages under the Gmail label…")
    elif event == "found":
        _fetch_emails_state["phase"] = "fetching"
        _fetch_emails_state["total"] = data["total"]
        _fetch_log(f"Found {data['total']} new message(s) to fetch.")
    elif event == "message":
        _fetch_emails_state["done"] = data["done"]
        if data.get("error"):
            _fetch_log(f"[{data['done']}/{data['total']}] failed: {data['error']}")
        else:
            _fetch_emails_state["fetched"] += 1
            subject = (data.get("subject") or "")[:70]
            _fetch_log(f"[{data['done']}/{data['total']}] fetched — {subject}")
    elif event == "cancelled":
        _fetch_emails_state["phase"] = "cancelled"
        _fetch_log(f"Cancelled after {data['done']}/{data['total']} message(s).")


def _run_fetch_emails():
    from gmail.gmail_service import fetch_and_store_emails

    try:
        saved = fetch_and_store_emails(on_progress=_fetch_progress, cancel_event=_fetch_cancel_event)
        _fetch_emails_state["fetched"] = len(saved)
        if _fetch_emails_state["phase"] != "cancelled":
            _fetch_emails_state["phase"] = "done"
            _fetch_log(f"Done — {len(saved)} new email(s) saved.")
    except Exception as exc:
        _fetch_emails_state["phase"] = "error"
        _fetch_emails_state["error"] = str(exc)
        _fetch_log(f"Error: {exc}")
    finally:
        _fetch_emails_state["running"] = False


@bp.post("/fetch-emails")
def fetch_emails():
    if _fetch_emails_state["running"]:
        return jsonify({"status": "already_running"}), 409

    _fetch_cancel_event.clear()
    _fetch_emails_state.update({
        "running": True, "phase": "listing", "done": 0, "total": 0, "fetched": 0, "error": None, "logs": [],
    })
    threading.Thread(target=_run_fetch_emails, daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/fetch-emails/status")
def fetch_emails_status():
    return jsonify(_fetch_emails_state)


@bp.post("/fetch-emails/cancel")
def fetch_emails_cancel():
    if not _fetch_emails_state["running"]:
        return jsonify({"status": "not_running"}), 409
    _fetch_cancel_event.set()
    _fetch_log("Cancellation requested…")
    return jsonify({"status": "cancelling"})


def _run_process_pending():
    from scheduler.jobs import process_emails_without_offers

    try:
        processed, failed = process_emails_without_offers()
        _process_pending_state.update({"processed": processed, "failed": failed, "error": None})
    except Exception as exc:
        _process_pending_state["error"] = str(exc)
    finally:
        _process_pending_state["running"] = False


@bp.post("/process-pending")
def process_pending():
    if _process_pending_state["running"]:
        return jsonify({"status": "already_running"}), 409

    _process_pending_state.update({"running": True, "processed": 0, "failed": 0, "error": None})
    threading.Thread(target=_run_process_pending, daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/process-pending/status")
def process_pending_status():
    return jsonify(_process_pending_state)


def _run_fetch_sales_web():
    from ai import cache as _ai_cache
    from ai.brand_fetcher import fetch_offers_for_brand, load_brands
    from database.db import get_session
    from database.models import Offer

    brands = load_brands()
    _web_sales_state.update({
        "running": True, "saved": 0, "failed": 0, "total_active": 0, "done": 0, "total": len(brands),
    })

    cache = _ai_cache.load()
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
                    _web_sales_state["saved"] += 1
                    if o_data.get("_is_sale"):
                        _web_sales_state["total_active"] += 1
                except Exception:
                    _web_sales_state["failed"] += 1
        except Exception:
            _web_sales_state["failed"] += 1
        finally:
            _web_sales_state["done"] += 1

    _ai_cache.save(cache)
    _web_sales_state["running"] = False


@bp.post("/fetch-sales-web")
def fetch_sales_web():
    from ai.brand_fetcher import load_brands

    if _web_sales_state["running"]:
        return jsonify({"status": "already_running"}), 409

    if not load_brands():
        return jsonify({"error": "brands.json is empty or missing"}), 400

    threading.Thread(target=_run_fetch_sales_web, daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/fetch-sales-web/status")
def fetch_sales_web_status():
    return jsonify(_web_sales_state)


def _run_research_brands():
    from research.runner import ResearchRunner

    runner = ResearchRunner()
    active_brands = runner._db.get_active_brands()
    _research_state.update({
        "running": True, "done": 0, "total": len(active_brands), "inserted": 0, "updated": 0, "failed_brands": [],
    })

    results = runner.run()
    _research_state["inserted"] = sum(r.inserted for r in results)
    _research_state["updated"] = sum(r.updated for r in results)
    _research_state["failed_brands"] = [r.brand_name for r in results if not r.success]
    _research_state["done"] = len(results)
    _research_state["running"] = False


@bp.post("/research-brands")
def research_brands():
    from research.config import TAVILY_API_KEY

    if not TAVILY_API_KEY:
        return jsonify({"error": "TAVILY_API_KEY is not set in .env"}), 400
    if _research_state["running"]:
        return jsonify({"status": "already_running"}), 409

    threading.Thread(target=_run_research_brands, daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/research-brands/status")
def research_brands_status():
    return jsonify(_research_state)
