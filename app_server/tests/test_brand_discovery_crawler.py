"""Tests for services/brand_discovery/crawler.py — requests.get is always
mocked, never touches the real network."""
import requests

from services.brand_discovery.crawler import crawl_site, domain_of, fetch_page


class _FakeResponse:
    def __init__(self, status_code=200, html="", content_type="text/html", url="https://acme.com/"):
        self.status_code = status_code
        self.headers = {"content-type": content_type}
        self.encoding = "utf-8"
        self.url = url
        self._body = html.encode("utf-8")

    def iter_content(self, chunk_size=8192):
        yield self._body

    def close(self):
        pass


def test_fetch_page_returns_none_on_request_exception(mocker):
    mocker.patch("requests.get", side_effect=requests.RequestException("boom"))
    assert fetch_page("https://acme.com") is None


def test_fetch_page_returns_none_on_4xx_5xx(mocker):
    mocker.patch("requests.get", return_value=_FakeResponse(status_code=404))
    assert fetch_page("https://acme.com") is None


def test_fetch_page_returns_none_for_non_html_content_type(mocker):
    mocker.patch("requests.get", return_value=_FakeResponse(content_type="application/json"))
    assert fetch_page("https://acme.com") is None


def test_fetch_page_parses_html_on_success(mocker):
    html = "<html><head><title>Acme</title></head><body>Hello <script>evil()</script></body></html>"
    mocker.patch("requests.get", return_value=_FakeResponse(html=html))
    page = fetch_page("https://acme.com")
    assert page is not None
    assert page.soup.find("title").get_text() == "Acme"
    assert "evil()" not in page.text  # <script> content stripped


def test_fetch_page_adds_https_scheme_when_missing(mocker):
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        return _FakeResponse(html="<html></html>")

    mocker.patch("requests.get", side_effect=fake_get)
    fetch_page("acme.com")
    assert captured["url"] == "https://acme.com"


def test_crawl_site_returns_all_none_when_homepage_unreachable(mocker):
    mocker.patch("requests.get", side_effect=requests.RequestException("down"))
    result = crawl_site("https://dead-site.com")
    assert result == {"home": None, "about": None, "contact": None}


def test_crawl_site_finds_and_fetches_about_page(mocker):
    home_html = '<html><body><a href="/about-us">About Us</a></body></html>'
    about_html = "<html><body>About Acme</body></html>"

    def fake_get(url, **kwargs):
        if "about" in url:
            return _FakeResponse(html=about_html, url=url)
        return _FakeResponse(html=home_html, url="https://acme.com/")

    mocker.patch("requests.get", side_effect=fake_get)
    result = crawl_site("https://acme.com")
    assert result["home"] is not None
    assert result["about"] is not None
    assert "About Acme" in result["about"].text
    assert result["contact"] is None


def test_domain_of_strips_www_and_scheme():
    assert domain_of("https://www.acme.com/path") == "acme.com"
    assert domain_of("acme.com") == "acme.com"
    assert domain_of("") == ""
