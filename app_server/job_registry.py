"""Registers only the app-server job types.

Scraping/research jobs (WebsiteScrapeBrand, SocialOfferScrape, BrandDiscovery,
DiscoverBrand, FetchSalesWeb, ResearchBrands) live in scraper_server/job_registry.py
and are not loaded here — they run exclusively on the scraper server process.
"""


def register_app_jobs() -> None:
    from services import job_runner
    from jobs.check_sale_alerts import CheckSaleAlertsJob
    from jobs.cleanup_expired_offers import CleanupExpiredOffersJob
    from jobs.email_automation import EmailAutomationJob
    from jobs.email_sync import EmailSyncJob
    from jobs.label_brand_emails import LabelBrandEmailsJob
    from jobs.notify_matching_offer import NotifyMatchingOfferJob
    from jobs.process_pending import ProcessPendingJob
    from jobs.send_push_notification import SendPushNotificationJob
    from jobs.verify_offers import VerifyOffersJob

    job_runner.register(EmailSyncJob())
    job_runner.register(ProcessPendingJob())
    job_runner.register(LabelBrandEmailsJob())
    job_runner.register(VerifyOffersJob())
    job_runner.register(CleanupExpiredOffersJob())
    job_runner.register(CheckSaleAlertsJob())
    job_runner.register(NotifyMatchingOfferJob())
    job_runner.register(SendPushNotificationJob())
    job_runner.register(EmailAutomationJob())
