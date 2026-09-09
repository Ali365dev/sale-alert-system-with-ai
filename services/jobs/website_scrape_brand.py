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
            return [WorkItem(id=url, label=url)]

        if brand_id is None:
            return []

        from services import job_service

        with get_session() as session:
            brand = session.query(Brand).filter(Brand.id == brand_id).first()
            if brand is None or not brand.website_scraping_enabled:
                return []
            brand_name = brand.name
            job_service.append_log(job["id"], f"Scraping {brand_name}…", severity="info", category="website")
            discovered, errors = website_scraper_services.discover_pages_for_brand(brand)

        if not discovered:
            for err in errors[:5]:
                job_service.append_log(job["id"], f"⚠ {err}", severity="warning", category="website")
            if not errors:
                job_service.append_log(
                    job["id"], "⚠ No relevant sale/offer pages were discovered on this site.",
                    severity="warning", category="website",
                )
            website_scraper_services.record_discovery_failure(brand_id, errors)
            return []

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
