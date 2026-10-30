"""Hard fetch budget / deadline cancel for website scraper crawler."""
from unittest.mock import patch

import pytest

from services.website_scraper import crawler


def test_call_with_deadline_raises_when_fn_hangs():
    def hang():
        import time

        time.sleep(5)
        return "done"

    with pytest.raises(crawler.FetchDeadlineExceeded, match="timed out"):
        crawler._call_with_deadline(hang, seconds=0.2, label="hang test")


def test_fetch_html_with_fallback_skips_browsers_when_budget_exhausted():
    blocked_html = "<html>unable to give you access to our site</html>"

    with patch.object(crawler, "fetch_html", return_value=(403, blocked_html, "https://x.test")):
        with patch.object(crawler, "fetch_html_browser") as browser:
            with patch.object(crawler, "fetch_html_camoufox") as fox:
                status, html, url, attempted = crawler.fetch_html_with_fallback(
                    "https://x.test",
                    timeout=10,
                    budget_seconds=0.01,
                )

    assert status == 403
    assert html == blocked_html
    assert attempted is False
    browser.assert_not_called()
    fox.assert_not_called()


def test_fetch_html_with_fallback_abandons_hung_browser():
    blocked_html = "waffailover challenge page " + ("x" * 900)

    def slow_browser(*_a, **_k):
        import time

        time.sleep(5)
        return 200, "<html>ok</html>", "https://x.test"

    with patch.object(crawler, "fetch_html", return_value=(403, blocked_html, "https://x.test")):
        with patch.object(crawler, "fetch_html_browser", side_effect=slow_browser):
            with patch.object(
                crawler,
                "fetch_html_camoufox",
                return_value=(200, "<html>" + ("y" * 2000) + "</html>", "https://x.test/ok"),
            ):
                with patch.object(crawler, "WEBSITE_SCRAPE_BROWSER_TIMEOUT_SECONDS", 0.3):
                    status, html, url, attempted = crawler.fetch_html_with_fallback(
                        "https://x.test",
                        timeout=10,
                        budget_seconds=30,
                    )

    assert attempted is True
    assert status == 200
    assert "yyyy" in html
    assert url.endswith("/ok")
