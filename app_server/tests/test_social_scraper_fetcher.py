"""Tests for services/social_scraper/post_metadata_fetcher.py — fetch_page
is always mocked, never touches the real network."""
from bs4 import BeautifulSoup

from services.brand_discovery.crawler import ParsedPage
from services.social_scraper.post_metadata_fetcher import fetch_preview


def _page(html: str, url: str = "https://facebook.com/acme/posts/123") -> ParsedPage:
    soup = BeautifulSoup(html, "lxml")
    return ParsedPage(url=url, soup=soup, text=soup.get_text(" ", strip=True))


def test_fetch_preview_returns_none_values_when_page_unreachable(mocker):
    mocker.patch("services.social_scraper.post_metadata_fetcher.fetch_page", return_value=None)
    result = fetch_preview("facebook", "https://facebook.com/acme/posts/123")
    assert result == {"caption": None, "image_url": None, "source": None}


def test_fetch_preview_extracts_og_description_and_image(mocker):
    html = (
        '<html><head>'
        '<meta property="og:description" content="50% off everything this weekend!">'
        '<meta property="og:image" content="https://scontent.example.com/photo.jpg">'
        '</head></html>'
    )
    mocker.patch("services.social_scraper.post_metadata_fetcher.fetch_page", return_value=_page(html))
    result = fetch_preview("facebook", "https://facebook.com/acme/posts/123")
    assert result == {
        "caption": "50% off everything this weekend!",
        "image_url": "https://scontent.example.com/photo.jpg",
        "source": "post_metadata",
    }


def test_fetch_preview_falls_back_to_og_title_when_no_description(mocker):
    html = '<html><head><meta property="og:title" content="Acme Store"></head></html>'
    mocker.patch("services.social_scraper.post_metadata_fetcher.fetch_page", return_value=_page(html))
    result = fetch_preview("facebook", "https://facebook.com/acme")
    assert result["caption"] == "Acme Store"


def test_fetch_preview_returns_none_values_when_no_og_tags_present(mocker):
    # Common for Instagram — most content is gated behind a login wall.
    mocker.patch("services.social_scraper.post_metadata_fetcher.fetch_page", return_value=_page("<html><body>Login required</body></html>"))
    result = fetch_preview("instagram", "https://instagram.com/p/abc123")
    assert result == {"caption": None, "image_url": None, "source": None}
