"""Brand logo fallback + BrandRequest demand signal for sale alerts."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from services import sale_alert_brand as brand_svc


def test_enrich_uses_brand_logo_when_image_missing(mocker):
    brand = SimpleNamespace(name="Outfitters", logo_url="https://cdn.example/logo.png", website="https://outfitters.com.pk")
    session = MagicMock()
    mocker.patch.object(brand_svc, "get_session")
    brand_svc.get_session.return_value.__enter__.return_value = session
    mocker.patch.object(brand_svc, "find_matching_brand", return_value=brand)

    result = brand_svc.enrich_analyze_with_brand(
        {
            "ok": True,
            "brand_name": "Outfitters",
            "product_name": "Shirt",
            "current_price": 2490,
            "image_url": None,
            "product_url": "https://outfitters.com.pk/products/x",
            "partial": True,
        },
        record_missing=False,
    )

    assert result["image_url"] == "https://cdn.example/logo.png"
    assert result["image_from_brand_logo"] is True
    assert result["brand_matched"] is True
    assert result["brand_logo_url"] == "https://cdn.example/logo.png"


def test_enrich_upgrades_http_image_and_logo_to_https(mocker):
    brand = SimpleNamespace(
        name="Outfitters",
        logo_url="http://outfitters.com.pk/cdn/shop/files/logo.jpg",
        website="https://outfitters.com.pk",
    )
    session = MagicMock()
    mocker.patch.object(brand_svc, "get_session")
    brand_svc.get_session.return_value.__enter__.return_value = session
    mocker.patch.object(brand_svc, "find_matching_brand", return_value=brand)

    result = brand_svc.enrich_analyze_with_brand(
        {
            "ok": True,
            "brand_name": "Outfitters",
            "product_name": "Shirt",
            "current_price": 2190,
            "image_url": "http://outfitters.com.pk/cdn/shop/files/product.jpg",
            "product_url": "https://outfitters.com.pk/products/x",
        },
        record_missing=False,
    )

    assert result["image_url"] == "https://outfitters.com.pk/cdn/shop/files/product.jpg"
    assert result["brand_logo_url"] == "https://outfitters.com.pk/cdn/shop/files/logo.jpg"
    assert result["image_from_brand_logo"] is False


def test_enrich_records_brand_request_when_unknown(mocker):
    session = MagicMock()
    mocker.patch.object(brand_svc, "get_session")
    brand_svc.get_session.return_value.__enter__.return_value = session
    mocker.patch.object(brand_svc, "find_matching_brand", return_value=None)
    recorded = SimpleNamespace(id=9)
    mocker.patch.object(brand_svc, "record_missing_brand_interest", return_value=recorded)

    result = brand_svc.enrich_analyze_with_brand(
        {
            "ok": True,
            "brand_name": "Unknown Co",
            "product_name": "Item",
            "current_price": 100,
            "image_url": "https://cdn.example/p.jpg",
            "product_url": "https://unknown.example/p",
        },
        device_id="dev-1",
        record_missing=True,
    )

    assert result["brand_matched"] is False
    assert result["brand_request_recorded"] is True
    brand_svc.record_missing_brand_interest.assert_called_once()


def test_enrich_skips_brand_request_on_recheck(mocker):
    session = MagicMock()
    mocker.patch.object(brand_svc, "get_session")
    brand_svc.get_session.return_value.__enter__.return_value = session
    mocker.patch.object(brand_svc, "find_matching_brand", return_value=None)
    mocker.patch.object(brand_svc, "record_missing_brand_interest")

    brand_svc.enrich_analyze_with_brand(
        {
            "ok": True,
            "brand_name": "Unknown Co",
            "product_name": "Item",
            "current_price": 100,
            "image_url": None,
            "product_url": "https://unknown.example/p",
        },
        record_missing=False,
    )

    brand_svc.record_missing_brand_interest.assert_not_called()
