"""Tests for the pure extractor services under services/brand_discovery/ —
website_info_extractor, logo_extractor, social_link_extractor,
category_detector. All built on canned HTML (BeautifulSoup), no network."""
from bs4 import BeautifulSoup

from services.brand_discovery.category_detector import detect_category
from services.brand_discovery.crawler import ParsedPage
from services.brand_discovery.logo_extractor import extract_logo
from services.brand_discovery.social_link_extractor import extract_social_links
from services.brand_discovery.website_info_extractor import extract_country, extract_description, extract_name


def _page(html: str, url: str = "https://acme.com/") -> ParsedPage:
    soup = BeautifulSoup(html, "lxml")
    return ParsedPage(url=url, soup=soup, text=soup.get_text(" ", strip=True))


# ── website_info_extractor ───────────────────────────────────────────────────

def test_extract_name_prefers_og_site_name():
    page = _page('<html><head><meta property="og:site_name" content="Acme Corp"><title>Ignored | Acme</title></head></html>')
    assert extract_name(page) == {"value": "Acme Corp", "source": "website_metadata"}


def test_extract_name_falls_back_to_title_before_separator():
    page = _page("<html><head><title>Acme Corp - Official Store</title></head></html>")
    assert extract_name(page)["value"] == "Acme Corp"


def test_extract_name_falls_back_to_domain_when_nothing_else_available():
    page = _page("<html><head></head></html>", url="https://cool-brand.com/")
    assert extract_name(page)["value"] == "Cool Brand"


def test_extract_description_from_og_description():
    page = _page('<html><head><meta property="og:description" content="Best shoes in town."></head></html>')
    assert extract_description(page) == {"value": "Best shoes in town.", "source": "website_metadata"}


def test_extract_description_none_when_missing():
    page = _page("<html><head></head></html>")
    assert extract_description(page) == {"value": None, "source": None}


def test_extract_country_from_html_lang():
    page = _page('<html lang="en-PK"><head></head></html>')
    assert extract_country(page) == {"value": "Pakistan", "source": "website_metadata"}


def test_extract_country_falls_back_to_tld():
    page = _page("<html><head></head></html>", url="https://acme.pk/")
    assert extract_country(page) == {"value": "Pakistan", "source": "website_metadata"}


def test_extract_country_none_when_no_signal():
    page = _page("<html><head></head></html>", url="https://acme.com/")
    assert extract_country(page) == {"value": None, "source": None}


# ── logo_extractor ───────────────────────────────────────────────────────────

def test_extract_logo_prefers_og_image():
    page = _page('<html><head><meta property="og:image" content="/images/logo.png"></head></html>')
    result = extract_logo(page)
    assert result["value"] == "https://acme.com/images/logo.png"
    assert result["source"] == "website_metadata"


def test_extract_logo_falls_back_to_apple_touch_icon():
    page = _page('<html><head><link rel="apple-touch-icon" href="/apple-icon.png"></head></html>')
    assert extract_logo(page)["value"] == "https://acme.com/apple-icon.png"


def test_extract_logo_falls_back_to_img_with_logo_in_class():
    page = _page('<html><body><img class="site-logo" src="/img/brand-logo.svg"></body></html>')
    assert extract_logo(page)["value"] == "https://acme.com/img/brand-logo.svg"


def test_extract_logo_falls_back_to_favicon_when_nothing_found():
    page = _page("<html><body>No logo here.</body></html>")
    assert extract_logo(page)["value"] == "https://acme.com/favicon.ico"


# ── social_link_extractor ────────────────────────────────────────────────────

def _pages_with_footer(footer_html: str) -> dict:
    home_html = f"<html><body><header>Home</header><footer>{footer_html}</footer></body></html>"
    return {"home": _page(home_html), "about": None, "contact": None}


def test_extract_social_links_finds_real_profile_links():
    pages = _pages_with_footer(
        '<a href="https://facebook.com/acmebrand">FB</a>'
        '<a href="https://instagram.com/acmebrand">IG</a>'
    )
    links = extract_social_links(pages)
    assert links["facebook"] == {"url": "https://facebook.com/acmebrand", "source": "home"}
    assert links["instagram"] == {"url": "https://instagram.com/acmebrand", "source": "home"}


def test_extract_social_links_ignores_share_buttons():
    pages = _pages_with_footer('<a href="https://facebook.com/sharer/sharer.php?u=https://acme.com">Share</a>')
    assert "facebook" not in extract_social_links(pages)


def test_extract_social_links_ignores_bare_root_platform_links():
    pages = _pages_with_footer('<a href="https://facebook.com/">Facebook</a>')
    assert "facebook" not in extract_social_links(pages)


def test_extract_social_links_ignores_generic_platform_pages():
    pages = _pages_with_footer('<a href="https://www.linkedin.com/legal/privacy-policy">Privacy</a>')
    assert "linkedin" not in extract_social_links(pages)


def test_extract_social_links_handles_x_com_as_twitter():
    pages = _pages_with_footer('<a href="https://x.com/acmebrand">X</a>')
    assert extract_social_links(pages)["twitter"]["url"] == "https://x.com/acmebrand"


def test_extract_social_links_home_page_wins_over_contact_page():
    pages = {
        "home": _page('<html><body><a href="https://facebook.com/real-brand">FB</a></body></html>'),
        "about": None,
        "contact": _page('<html><body><a href="https://facebook.com/wrong-one">FB</a></body></html>', url="https://acme.com/contact"),
    }
    assert extract_social_links(pages)["facebook"]["url"] == "https://facebook.com/real-brand"


def test_extract_social_links_empty_when_no_pages_crawled():
    assert extract_social_links({"home": None, "about": None, "contact": None}) == {}


# ── category_detector ────────────────────────────────────────────────────────

def test_detect_category_matches_fashion_and_footwear_subcategory():
    result = detect_category("Acme Sneakers is a footwear and apparel brand selling shoes and sneakers.")
    assert result["category"] == "Fashion"
    assert result["subcategory"] == "Footwear"
    assert result["confidence"] > 0


def test_detect_category_falls_back_to_general_with_no_keywords():
    result = detect_category("Just some words that mean nothing in particular.")
    assert result == {"category": "General", "subcategory": None, "source": None, "confidence": 0.0}


def test_detect_category_electronics():
    result = detect_category("Buy the latest smartphone, laptop and computer electronics gadgets.")
    assert result["category"] == "Electronics"
