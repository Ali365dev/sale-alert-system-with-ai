"""Runs the Website Sale Scraper pipeline (services/website_scraper/) for one
brand — discovers relevant pages, scrapes each, then runs closure detection.
Also supports an ad-hoc single-URL mode (payload has "url" but no
discovery), used by the manual test page. Same shape as
services/jobs/social_offer_scrape.py: goes through the normal BackgroundJob
machinery so the frontend gets stage/log/cancel/retry UI for free."""
from database.db import get_session
from database.models import Brand
from services.jobs.base import BackgroundJob, WorkItem
from services.website_scraper import services as website_scraper_services


class WebsiteScrapeBrandJob(BackgroundJob):
    job_type = "website_scrape_brand"

    def collect_work(self, job: dict) -> list[WorkItem]:
        payload = job.get("payload") or {}
        brand_id = payload.get("brand_id")
        url = payload.get("url")

        if url:
            from services import job_service
            job_service.append_log(
                job["id"], f"Scraping single URL: {url}", severity="info", category="website",
            )
            return [WorkItem(id=url, label=url)]

        if brand_id is None:
            return []

        from services import job_service

        with get_session() as session:
            brand = session.query(Brand).filter(Brand.id == brand_id).first()
            if brand is None:
                job_service.append_log(
                    job["id"], f"⚠ Brand #{brand_id} not found — nothing to scrape.",
                    severity="warning", category="website",
                )
                return []
            if not brand.website_scraping_enabled:
                job_service.append_log(
                    job["id"], f"⚠ Scraping disabled for {brand.name} — skipped.",
                    severity="warning", category="website",
                )
                return []
            brand_name = brand.name
            homepage = brand.homepage_url or brand.website
            job_service.set_stage(job["id"], "discovering")
            job_service.append_log(
                job["id"],
                f"Scraping {brand_name}… discovering pages from {homepage or '(no homepage)'}",
                severity="info", category="website",
            )
            discovered, errors = website_scraper_services.discover_pages_for_brand(brand)

        if not discovered:
            for err in errors[:5]:
                job_service.append_log(job["id"], f"⚠ {err}", severity="warning", category="website")
            if not errors:
                job_service.append_log(
                    job["id"], "⚠ No relevant sale/offer pages were discovered on this site.",
                    severity="warning", category="website",
                )
            else:
                job_service.append_log(
                    job["id"],
                    f"⚠ Discovery failed for {brand_name} ({len(errors)} error(s)).",
                    severity="error", category="website",
                )
            website_scraper_services.record_discovery_failure(brand_id, errors)
            return []

        promos = [d for d in discovered if d.page_type in {"sale", "offers", "promotions", "custom"}]
        navish = [d for d in discovered if d.page_type in {"discovered", "nav_footer"}]
        homes = [d for d in discovered if d.page_type == "homepage"]
        job_service.append_log(
            job["id"],
            f"✓ Discovery plan: {len(homes)} homepage + {len(promos)} DB promo URL(s) "
            f"+ {len(navish)} nav/footer/sale link(s) = {len(discovered)} page(s)"
            + (f" ({len(errors)} warning(s))" if errors else ""),
            severity="success", category="website",
        )
        for d in promos[:6]:
            job_service.append_log(
                job["id"], f"  promo [{d.page_type}]: {d.url}", severity="info", category="website",
            )
        for d in navish[:5]:
            job_service.append_log(
                job["id"],
                f"  top link [{d.page_type} score={d.score}]: {d.url}",
                severity="info", category="website",
            )
        for err in errors[:5]:
            job_service.append_log(job["id"], f"⚠ {err}", severity="warning", category="website")

        return [WorkItem(id=(d.url, d.page_type), label=d.url) for d in discovered]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        payload = job_service.get_job(job_id).get("payload") or {}
        brand_id = payload.get("brand_id")

        if isinstance(item.id, tuple):
            url, page_type = item.id
        else:
            url, page_type = item.id, "custom"

        brand_name = None
        if brand_id is not None:
            with get_session() as session:
                brand = session.query(Brand).filter(Brand.id == brand_id).first()
                brand_name = brand.name if brand else None

        try:
            page = website_scraper_services.process_page(job_id, brand_id, brand_name, url, page_type)
        except Exception as exc:
            job_service.append_log(job_id, f"✗ Failed to scrape \"{item.label}\": {exc}", severity="warning", category="website")
            return "failed"

        outcome = website_scraper_services.job_outcome_for(page["scrape_status"])
        if page["scrape_status"] == "SALE_DETECTED":
            job_service.append_log(job_id, f"✓ Sale detected on \"{item.label}\"", severity="success", category="website")
        elif outcome == "failed":
            job_service.append_log(job_id, f"⚠ Could not scrape \"{item.label}\" ({page['error_message']})", severity="warning", category="website")
        else:
            job_service.append_log(job_id, f"○ {page['scrape_status']} — \"{item.label}\"", severity="info", category="website")
        return outcome

    def after_run(self, job_id: int, job: dict) -> None:
        payload = job.get("payload") or {}
        brand_id = payload.get("brand_id")
        if brand_id is not None:
            website_scraper_services.finalize_brand_scrape(job_id, brand_id)

    def on_failure(self, job_id: int, error: Exception) -> None:
        self._safe_finalize(job_id)

    def on_cancel(self, job_id: int) -> None:
        self._safe_finalize(job_id)

    def _safe_finalize(self, job_id: int) -> None:
        from services import job_service

        job = job_service.get_job(job_id) or {}
        brand_id = (job.get("payload") or {}).get("brand_id")
        if brand_id is None:
            return
        try:
            website_scraper_services.finalize_brand_scrape(job_id, brand_id)
        except Exception:
            from config import logger
            logger.exception("finalize_brand_scrape failed after job %s ended early", job_id)
