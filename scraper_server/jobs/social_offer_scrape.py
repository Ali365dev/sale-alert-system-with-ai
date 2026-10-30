"""Runs one Social Media Offer Discovery pipeline (services/social_scraper/
content_pipeline.py) for a single submitted post. Same shape as
services/jobs/brand_discovery.py — exactly one WorkItem per run, still goes
through the normal BackgroundJob machinery so the frontend gets stage/log/
cancel/retry UI for free."""
from database.db import get_session
from database.models import SocialPost
from services.jobs.base import BackgroundJob, WorkItem


class SocialOfferScrapeJob(BackgroundJob):
    job_type = "social_offer_scrape"

    def collect_work(self, job: dict) -> list[WorkItem]:
        social_post_id = (job.get("payload") or {}).get("social_post_id")
        if social_post_id is None:
            return []
        with get_session() as session:
            post = session.query(SocialPost).filter(SocialPost.id == social_post_id).first()
            if post is None:
                return []
            return [WorkItem(id=post.id, label=post.post_url)]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service
        from services.social_scraper.content_pipeline import mark_failed, run as run_pipeline

        try:
            outcome = run_pipeline(job_id, item.id)
        except Exception as exc:
            mark_failed(job_id, item.id, str(exc))
            job_service.append_log(job_id, f"⚠ Failed to process \"{item.label}\": {exc}", severity="warning", category="social")
            return "failed"

        if outcome == "successful":
            job_service.append_log(job_id, f"✓ Processed \"{item.label}\"", severity="success", category="social")
        else:
            job_service.append_log(job_id, f"⚠ Could not process \"{item.label}\"", severity="warning", category="social")
        return outcome
