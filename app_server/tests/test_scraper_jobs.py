import json

from services import scraper_jobs


def test_post_sends_payload_and_internal_secret(mocker, monkeypatch):
    """Regression: the notify trigger used to POST "{}" — no offer_id, so the
    scraper job had nothing to notify about."""
    monkeypatch.setenv("SCRAPER_SERVER_URL", "http://scraper.test/")
    mocker.patch.object(scraper_jobs, "get_setting", return_value="s3cret")
    urlopen = mocker.patch.object(scraper_jobs.urllib.request, "urlopen")

    scraper_jobs._post("notify_matching_offer", {"offer_id": 12})

    req = urlopen.call_args.args[0]
    assert req.full_url == "http://scraper.test/api/jobs/notify_matching_offer/start"
    assert json.loads(req.data) == {"offer_id": 12}
    assert req.get_header("X-internal-secret") == "s3cret"


def test_post_skips_without_scraper_url(mocker, monkeypatch):
    monkeypatch.delenv("SCRAPER_SERVER_URL", raising=False)
    urlopen = mocker.patch.object(scraper_jobs.urllib.request, "urlopen")

    scraper_jobs._post("evaluate_sale_alert", {"alert_id": 1})

    urlopen.assert_not_called()
