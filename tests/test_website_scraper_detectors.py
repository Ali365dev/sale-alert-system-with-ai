from services.website_scraper.detectors import NOT_SALE, STRONG, WEAK, evaluate
from services.website_scraper.models import RawPage


def _page(url: str, body: str = "welcome to our store") -> RawPage:
    return RawPage(url=url, final_url=url, http_status=200, html="", body_text=body)


def test_sale_collection_url_reaches_at_least_weak():
    """Regression: /collections/sale only had weak keywords (score 15) which
    stayed under NOT_SALE_CEILING=20, so AI never ran and no Offer was saved."""
    result = evaluate(
        _page("https://shop.example/collections/sale", "shop our sale collection today"),
        page_type="discovered",
    )
    assert result.status in (WEAK, STRONG)
    assert result.score > 20


def test_configured_sale_page_type_boosts_emptyish_body():
    result = evaluate(
        _page("https://shop.example/promo", "welcome"),
        page_type="sale",
    )
    assert result.status in (WEAK, STRONG)


def test_generic_about_page_stays_not_sale():
    result = evaluate(
        _page("https://shop.example/about", "about our company history"),
        page_type="discovered",
    )
    assert result.status == NOT_SALE
