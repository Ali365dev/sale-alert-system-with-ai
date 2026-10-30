"""Search the web for each active brand's current offers via AI and save them.

Per-brand failures are recoverable (one bad brand shouldn't block the rest —
matches the original api/actions.py behavior); only job-level problems
(e.g. brands.json/DB empty) are critical.
"""
from database.db import get_session
from database.models import Offer
from services.jobs.base import BackgroundJob, CriticalError, WorkItem

_cache_holder: dict = {}


class FetchSalesWebJob(BackgroundJob):
    job_type = "fetch_sales_web"

    def collect_work(self, job: dict) -> list[WorkItem]:
        from ai.brand_fetcher import load_brands

        brands = load_brands()
        if not brands:
            raise CriticalError("No active brands found (brands table empty or unreadable).")
        return [WorkItem(id=b["name"], label=b["name"]) for b in brands]

    def before_run(self, job_id: int, job: dict) -> None:
        from ai import cache as ai_cache

        _cache_holder["cache"] = ai_cache.load()
        _cache_holder["saved"] = 0
        _cache_holder["total_active"] = 0

    def after_run(self, job_id: int, job: dict) -> None:
        from ai import cache as ai_cache
        from services import job_service

        ai_cache.save(_cache_holder.get("cache", {}))
        job_service.set_result(job_id, {
            "saved": _cache_holder.get("saved", 0),
            "total_active": _cache_holder.get("total_active", 0),
        })

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from ai.brand_fetcher import fetch_offers_for_brand
        from services import job_service

        job_service.set_stage(job_id, "researching_brand")
        brand = {"name": item.id}
        try:
            offers_data = fetch_offers_for_brand(brand, cache=_cache_holder.get("cache"))
        except Exception as exc:
            job_service.append_log(job_id, f"✗ \"{item.label}\" — {exc}", severity="warning", category="research")
            return "failed"

        saved_any = False
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
                _cache_holder["saved"] = _cache_holder.get("saved", 0) + 1
                saved_any = True
                if o_data.get("_is_sale"):
                    _cache_holder["total_active"] = _cache_holder.get("total_active", 0) + 1
            except Exception as exc:
                job_service.append_log(job_id, f"⚠ Could not save an offer for \"{item.label}\" — {exc}", severity="warning", category="offer")

        if saved_any:
            job_service.append_log(job_id, f"✓ \"{item.label}\" — {len(offers_data)} offer(s) found", severity="success", category="research")
            return "successful"
        return "skipped"
