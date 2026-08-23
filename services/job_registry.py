"""Single place that imports and registers every job type. Called once from
api/__init__.py::create_app(). Adding a new pipeline action means adding one
import+register line here — nothing else in the framework needs to change."""


def register_all() -> None:
    from services import job_runner
    from services.jobs.email_sync import EmailSyncJob
    from services.jobs.verify_offers import VerifyOffersJob
    from services.jobs.process_pending import ProcessPendingJob
    from services.jobs.fetch_sales_web import FetchSalesWebJob
    from services.jobs.research_brands import ResearchBrandsJob
    from services.jobs.label_brand_emails import LabelBrandEmailsJob
    from services.jobs.discover_brand import DiscoverBrandJob
    from services.jobs.cleanup_expired_offers import CleanupExpiredOffersJob
    from services.jobs.send_push_notification import SendPushNotificationJob

    job_runner.register(EmailSyncJob())
    job_runner.register(VerifyOffersJob())
    job_runner.register(ProcessPendingJob())
    job_runner.register(FetchSalesWebJob())
    job_runner.register(ResearchBrandsJob())
    job_runner.register(LabelBrandEmailsJob())
    job_runner.register(DiscoverBrandJob())
    job_runner.register(CleanupExpiredOffersJob())
    job_runner.register(SendPushNotificationJob())
