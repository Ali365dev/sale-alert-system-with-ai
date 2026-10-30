"""Research each active brand via Tavily + Llama and save/update its offers.

Per-brand failures are recoverable (ResearchRunner._process_brand already
never raises — ties to a ResearchResult.error instead); only missing
TAVILY_API_KEY / no active brands are treated as critical, job-level problems.
"""
from services.jobs.base import BackgroundJob, CriticalError, WorkItem

_state: dict = {}


class ResearchBrandsJob(BackgroundJob):
    job_type = "research_brands"

    def collect_work(self, job: dict) -> list[WorkItem]:
        from research.config import TAVILY_API_KEY

        if not TAVILY_API_KEY:
            raise CriticalError("TAVILY_API_KEY is not set in .env")

        from research.runner import ResearchRunner

        runner = ResearchRunner()
        brands = runner._db.get_active_brands()
        if not brands:
            raise CriticalError("No active brands found.")

        _state["runner"] = runner
        _state["brands_by_id"] = {b.id: b for b in brands}
        _state["inserted"] = 0
        _state["updated"] = 0
        _state["failed_brands"] = []
        return [WorkItem(id=b.id, label=b.name) for b in brands]

    def after_run(self, job_id: int, job: dict) -> None:
        from services import job_service

        job_service.set_result(job_id, {
            "inserted": _state.get("inserted", 0),
            "updated": _state.get("updated", 0),
            "failed_brands": _state.get("failed_brands", []),
        })

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        job_service.set_stage(job_id, "researching_brand")
        runner = _state["runner"]
        brand = _state["brands_by_id"][item.id]

        result = runner._process_brand(brand)
        _state["inserted"] += result.inserted
        _state["updated"] += result.updated

        if not result.success:
            _state["failed_brands"].append(result.brand_name)
            job_service.append_log(job_id, f"✗ \"{item.label}\" — {result.error}", severity="warning", category="research")
            return "failed"

        job_service.append_log(
            job_id,
            f"✓ \"{item.label}\" — found={result.offers_found} inserted={result.inserted} updated={result.updated}",
            severity="success", category="research",
        )
        return "successful"
