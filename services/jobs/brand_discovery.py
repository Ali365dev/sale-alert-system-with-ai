"""Runs one Brand Discovery pipeline (services/brand_discovery/pipeline.py)
for a single admin-initiated discovery run. Unlike every other job type,
this always has exactly one "item" — the BrandDiscovery row created by
app/api/routers/brand_discovery.py's `POST /start` right before the job is
created — but still goes through the normal BackgroundJob/job progress
machinery so the frontend gets the same stage/log/cancel/retry UI for free.
"""
from database.db import get_session
from database.models import BrandDiscovery
from services.jobs.base import BackgroundJob, WorkItem


class BrandDiscoveryJob(BackgroundJob):
    job_type = "brand_discovery"

    def collect_work(self, job: dict) -> list[WorkItem]:
        discovery_id = (job.get("payload") or {}).get("discovery_id")
        if discovery_id is None:
            return []
        with get_session() as session:
            row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
            if row is None:
                return []
            return [WorkItem(id=row.id, label=row.query)]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service
        from services.brand_discovery.pipeline import run as run_pipeline

        outcome = run_pipeline(job_id, item.id)
        if outcome == "successful":
            job_service.append_log(job_id, f"✓ Discovered brand info for \"{item.label}\"", severity="success", category="brand")
        else:
            job_service.append_log(job_id, f"⚠ Could not discover brand info for \"{item.label}\"", severity="warning", category="brand")
        return outcome
