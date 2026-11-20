"""Registers every background job type. All pipeline execution — email
ingestion, AI analysis, notifications, scraping, research — runs on this
server. app_server is pure CRUD (auth, brands, offers, search, …) and never
imports anything under jobs/ or job_runner/job_service; see
.claude/rules/server-routing.md.
"""


def register_scraper_jobs() -> None:
    from services import job_runner

    # Email ingestion + AI pipeline (moved here from app_server)
    from jobs.email_sync import EmailSyncJob
    from jobs.process_pending import ProcessPendingJob
    from jobs.label_brand_emails import LabelBrandEmailsJob
    from jobs.verify_offers import VerifyOffersJob
    from jobs.cleanup_expired_offers import CleanupExpiredOffersJob
    from jobs.check_sale_alerts import CheckSaleAlertsJob
    from jobs.notify_matching_offer import NotifyMatchingOfferJob
    from jobs.send_push_notification import SendPushNotificationJob
    from jobs.email_automation import EmailAutomationJob

    # Scraping / research jobs
    from jobs.brand_discovery import BrandDiscoveryJob
    from jobs.discover_brand import DiscoverBrandJob
    from jobs.fetch_sales_web import FetchSalesWebJob
    from jobs.research_brands import ResearchBrandsJob
    from jobs.scrape_takhfif import ScrapeTakhfifJob
    from jobs.social_offer_scrape import SocialOfferScrapeJob
    from jobs.website_scrape_brand import WebsiteScrapeBrandJob

    job_runner.register(EmailSyncJob())
    job_runner.register(ProcessPendingJob())
    job_runner.register(LabelBrandEmailsJob())
    job_runner.register(VerifyOffersJob())
    job_runner.register(CleanupExpiredOffersJob())
    job_runner.register(CheckSaleAlertsJob())
    job_runner.register(NotifyMatchingOfferJob())
    job_runner.register(SendPushNotificationJob())
    job_runner.register(EmailAutomationJob())

    job_runner.register(WebsiteScrapeBrandJob())
    job_runner.register(SocialOfferScrapeJob())
    job_runner.register(BrandDiscoveryJob())
    job_runner.register(DiscoverBrandJob())
    job_runner.register(FetchSalesWebJob())
    job_runner.register(ResearchBrandsJob())
    job_runner.register(ScrapeTakhfifJob())
