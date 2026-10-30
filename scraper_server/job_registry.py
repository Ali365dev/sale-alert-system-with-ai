"""Registers only the scraper-server job types.

App-side jobs (EmailSync, ProcessPending, CheckSaleAlerts, etc.) live in
app_server/job_registry.py and are not loaded here.
"""


def register_scraper_jobs() -> None:
    from services import job_runner
    from jobs.brand_discovery import BrandDiscoveryJob
    from jobs.discover_brand import DiscoverBrandJob
    from jobs.fetch_sales_web import FetchSalesWebJob
    from jobs.research_brands import ResearchBrandsJob
    from jobs.social_offer_scrape import SocialOfferScrapeJob
    from jobs.website_scrape_brand import WebsiteScrapeBrandJob

    job_runner.register(WebsiteScrapeBrandJob())
    job_runner.register(SocialOfferScrapeJob())
    job_runner.register(BrandDiscoveryJob())
    job_runner.register(DiscoverBrandJob())
    job_runner.register(FetchSalesWebJob())
    job_runner.register(ResearchBrandsJob())
