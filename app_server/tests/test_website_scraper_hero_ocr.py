"""Homepage hero OCR folds into the existing process_page sale path."""
from services.website_scraper.models import RawPage
from services.website_scraper import services as website_services


def test_enrich_homepage_merges_ocr_text(mocker):
    page = RawPage(
        url="https://acme.example/",
        final_url="https://acme.example/",
        http_status=200,
        html="<html></html>",
        body_text="Welcome",
        headline_text="",
    )
    mocker.patch(
        "services.website_scraper.services.extract_hero_banner_images",
        return_value=["https://acme.example/banner.jpg"],
    )
    mocker.patch(
        "ai.ocr.run_ocr_for_urls",
        return_value={
            "image_texts": ["FLAT 40% OFF this weekend"],
            "gif_texts": [],
            "items": [{"url": "https://acme.example/banner.jpg", "text": "FLAT 40% OFF this weekend", "is_gif": False}],
        },
    )
    log = mocker.patch("services.website_scraper.services._job_log")

    website_services._enrich_homepage_with_hero_ocr(
        42, page, "<html></html>", "https://acme.example/",
    )

    assert "FLAT 40% OFF" in page.body_text
    assert "FLAT 40% OFF" in page.headline_text
    assert log.called


def test_enrich_homepage_ocr_failure_does_not_raise(mocker):
    page = RawPage(
        url="https://acme.example/",
        final_url="https://acme.example/",
        http_status=200,
        html="<html></html>",
        body_text="Welcome",
    )
    mocker.patch(
        "services.website_scraper.services.extract_hero_banner_images",
        side_effect=RuntimeError("boom"),
    )
    website_services._enrich_homepage_with_hero_ocr(1, page, "<html></html>", "https://acme.example/")
    assert page.body_text == "Welcome"
