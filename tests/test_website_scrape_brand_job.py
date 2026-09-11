"""Tests for services/jobs/website_scrape_brand.py::collect_work — in
particular spec item "discovery failure must never expire existing offers."

That guarantee isn't implemented inside closure_detector at all: it comes
from collect_work() returning [] on a fully-failed discovery, combined with
job_runner.run_sequential_job() skipping after_run() (and therefore
finalize_brand_scrape -> closure_detector.apply()) whenever collect_work()
returns no work items (services/job_runner.py, `if not items: ... return`
before `job.after_run(...)`). This test asserts the collect_work half of
that guarantee: zero discovered pages -> zero work items, and the failure is
recorded rather than silently swallowed."""
from services.jobs.website_scrape_brand import WebsiteScrapeBrandJob


def _brand(**overrides):
    from database.models import Brand

    b = Brand(id=1, name="Acme", website_scraping_enabled=True)
    for k, v in overrides.items():
        setattr(b, k, v)
    return b


def test_discovery_failure_yields_no_work_items_and_is_recorded(mocker, mock_get_session, mock_session):
    mocker.patch("services.jobs.website_scrape_brand.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _brand()

    mocker.patch("services.job_service.append_log")
    mocker.patch(
        "services.website_scraper.services.discover_pages_for_brand",
        return_value=([], ["https://acme.example: HTTP 403 (browser fallback also blocked)"]),
    )
    record_failure = mocker.patch("services.website_scraper.services.record_discovery_failure")

    job = WebsiteScrapeBrandJob()
    items = job.collect_work({"id": 99, "payload": {"brand_id": 1, "brand_name": "Acme"}})

    assert items == []
    record_failure.assert_called_once_with(1, ["https://acme.example: HTTP 403 (browser fallback also blocked)"])


def test_disabled_brand_yields_no_work_and_does_not_record_failure(mocker, mock_get_session, mock_session):
    """Brand exists but has website scraping turned off — not a discovery
    failure, just nothing to do; must not be conflated with the failure path."""
    mocker.patch("services.jobs.website_scrape_brand.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _brand(website_scraping_enabled=False)

    record_failure = mocker.patch("services.website_scraper.services.record_discovery_failure")
    discover = mocker.patch("services.website_scraper.services.discover_pages_for_brand")

    job = WebsiteScrapeBrandJob()
    items = job.collect_work({"id": 100, "payload": {"brand_id": 1, "brand_name": "Acme"}})

    assert items == []
    record_failure.assert_not_called()
    discover.assert_not_called()


def test_successful_discovery_returns_one_work_item_per_page(mocker, mock_get_session, mock_session):
    mocker.patch("services.jobs.website_scrape_brand.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _brand()
    mocker.patch("services.job_service.append_log")

    from services.website_scraper.models import DiscoveredUrl

    discovered = [
        DiscoveredUrl(url="https://acme.example/collections/sale", page_type="sale", score=21),
        DiscoveredUrl(url="https://acme.example", page_type="homepage", score=999),
    ]
    mocker.patch("services.website_scraper.services.discover_pages_for_brand", return_value=(discovered, []))
    record_failure = mocker.patch("services.website_scraper.services.record_discovery_failure")

    job = WebsiteScrapeBrandJob()
    items = job.collect_work({"id": 101, "payload": {"brand_id": 1, "brand_name": "Acme"}})

    assert len(items) == 2
    record_failure.assert_not_called()
