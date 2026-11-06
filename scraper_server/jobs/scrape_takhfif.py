"""Scrapes takhfif.app's bank-card deal directory (services/takhfif_scraper.py)
into BankCardOffer rows, matched to existing Brands. Same shape as
jobs/website_scrape_brand.py: goes through the normal BackgroundJob
machinery so the dashboard gets stage/log/cancel/retry UI for free."""
from services.jobs.base import BackgroundJob, WorkItem
from services import takhfif_scraper


class ScrapeTakhfifJob(BackgroundJob):
    job_type = "scrape_takhfif_bank_offers"

    def collect_work(self, job: dict) -> list[WorkItem]:
        from services import job_service

        payload = job.get("payload") or {}
        max_pages = max(1, min(int(payload.get("max_pages", 101)), 101))

        job_service.append_log(
            job["id"], f"Listing takhfif.app/deals (up to {max_pages} page(s))…",
            severity="info", category="takhfif",
        )

        seen_urls: set[str] = set()
        items: list[WorkItem] = []
        pages_fetched = 0
        for page_items in takhfif_scraper.list_deal_pages(max_pages):
            pages_fetched += 1
            for place in page_items:
                url = place.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                items.append(WorkItem(id=url, label=place.get("name") or url))

        job_service.append_log(
            job["id"], f"✓ Found {len(items)} place(s) across {pages_fetched} page(s).",
            severity="success", category="takhfif",
        )
        return items

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        try:
            place = takhfif_scraper.scrape_place(item.id)
            count = takhfif_scraper.upsert_place_offers(item.id, place)
        except Exception as exc:
            job_service.append_log(
                job_id, f"✗ Failed to scrape \"{item.label}\": {exc}",
                severity="warning", category="takhfif",
            )
            return "failed"

        if count:
            job_service.append_log(
                job_id, f"✓ {item.label}: {count} bank offer(s)",
                severity="success", category="takhfif",
            )
        else:
            job_service.append_log(
                job_id, f"○ {item.label}: no bank offers found",
                severity="info", category="takhfif",
            )
        return "successful"
