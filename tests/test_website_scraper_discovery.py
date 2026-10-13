"""Nav/footer top-N discovery + hero image helpers — must not drop DB promo URLs."""
from services.website_scraper import crawler
from services.website_scraper.extractor import extract_hero_banner_images, extract_nav_footer_links


_HOME_HTML = """
<html><body>
  <header><nav>
    <a href="/sale">Sale</a>
    <a href="/collections/offers">Offers</a>
    <a href="/about">About</a>
  </nav></header>
  <div class="hero"><img src="/cdn/banner-sale.jpg" alt="50% off" width="1200"/></div>
  <main><a href="/products/shoe-1">Product</a></main>
  <footer><a href="/promotions">Promotions</a><a href="/contact">Contact</a></footer>
</body></html>
"""


def test_extract_nav_footer_links_skips_product_main_only(mocker):
    links = extract_nav_footer_links(_HOME_HTML, "https://acme.example/", "acme.example")
    assert "https://acme.example/sale" in links
    assert "https://acme.example/promotions" in links
    assert "https://acme.example/products/shoe-1" not in links


def test_extract_hero_banner_images_prefers_hero():
    images = extract_hero_banner_images(_HOME_HTML, "https://acme.example/")
    assert images == ["https://acme.example/cdn/banner-sale.jpg"]


def test_discover_pages_keeps_promos_and_top_nav_links(mocker):
    mocker.patch(
        "services.website_scraper.crawler.fetch_html_with_fallback",
        return_value=(200, _HOME_HTML, "https://acme.example/", False),
    )
    configured = [
        ("https://acme.example/sale", "sale"),
        ("https://acme.example/custom-deal", "custom"),
    ]
    discovered, errors = crawler.discover_pages(
        "https://acme.example/",
        configured,
        max_pages=8,
        top_discovered=5,
    )
    assert errors == []
    types = {d.page_type: d.url for d in discovered}
    assert types.get("homepage") == "https://acme.example/"
    promo_urls = {d.url for d in discovered if d.page_type in {"sale", "custom"}}
    assert "https://acme.example/sale" in promo_urls
    assert "https://acme.example/custom-deal" in promo_urls
    # Product PDP must not consume a top-5 slot.
    assert all("/products/" not in d.url for d in discovered if d.page_type != "homepage")
    navish = [d for d in discovered if d.page_type in {"discovered", "nav_footer"}]
    assert 1 <= len(navish) <= 5
    assert any("offer" in d.url or "promo" in d.url or "sale" in d.url for d in navish)


def test_discover_pages_homepage_fetch_error_still_queues_promos(mocker):
    mocker.patch(
        "services.website_scraper.crawler.fetch_html_with_fallback",
        return_value=(403, "", "https://acme.example/", True),
    )
    discovered, errors = crawler.discover_pages(
        "https://acme.example/",
        [("https://acme.example/sale", "sale")],
        top_discovered=5,
    )
    assert any("403" in e for e in errors)
    assert [d for d in discovered if d.page_type == "homepage"] == []
    assert any(d.url.endswith("/sale") for d in discovered)
