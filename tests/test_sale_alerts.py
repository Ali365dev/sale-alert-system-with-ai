"""Unit tests for sale-alerts helpers (no DB)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from app.api.routers import sale_alerts as sale_alerts_router
from services.sale_alert_analyze import analyze_product_url, friendly_fetch_error
from services.sale_alert_validation import (
    is_http_url,
    validate_create_payload,
    validate_patch_payload,
)


def test_friendly_fetch_error_messages():
    assert "not be found" in friendly_fetch_error(404)
    assert "blocked" in friendly_fetch_error(403, blocked=True).lower()
    assert "could not be loaded" in friendly_fetch_error(500).lower()


def test_summary_counts():
    alerts = [
        SimpleNamespace(status="active", alert_type="product"),
        SimpleNamespace(status="paused", alert_type="product"),
        SimpleNamespace(status="active", alert_type="brand"),
        SimpleNamespace(status="triggered", alert_type="product"),
    ]
    assert sale_alerts_router._summary_counts(alerts) == {
        "active": 2,
        "products": 3,
        "brands": 1,
        "triggered": 1,
    }


def test_alert_to_dict_shape():
    a = SimpleNamespace(
        id=1,
        device_id="d1",
        alert_type="product",
        status="active",
        product_name="Air Max",
        brand_name="Nike",
        product_url="https://example.com/p",
        image_url=None,
        current_price=120.0,
        original_price=150.0,
        sku=None,
        variant=None,
        condition_type="pct_20",
        custom_pct=None,
        target_price=None,
        watch_below_price=None,
        notify_push=True,
        notify_email=False,
        notify_in_app=True,
        last_checked_at=None,
        last_triggered_at=None,
        triggered_message=None,
        triggered_deal_url=None,
        check_fail_count=0,
        last_check_error=None,
        created_at=None,
        updated_at=None,
    )
    d = sale_alerts_router._alert_to_dict(a)
    assert d["id"] == 1
    assert d["product_name"] == "Air Max"
    assert d["condition_type"] == "pct_20"
    assert d["notify_push"] is True


def test_analyze_product_url_requires_url():
    result = analyze_product_url("")
    assert result["ok"] is False
    assert "required" in result["error"].lower()


def test_analyze_product_url_fetch_failure():
    with patch("services.sale_alert_analyze.crawler.fetch_html_with_fallback", side_effect=RuntimeError("boom")):
        result = analyze_product_url("https://example.com/product/1")
    assert result["ok"] is False
    assert "could not be loaded" in result["error"].lower()


def test_analyze_product_url_blocked():
    with patch(
        "services.sale_alert_analyze.crawler.fetch_html_with_fallback",
        return_value=(403, "", "https://example.com/product/1", False),
    ):
        result = analyze_product_url("https://example.com/product/1")
    assert result["ok"] is False
    assert "blocked" in result["error"].lower() or "manually" in result["error"].lower()


_PDP_FIXTURE = """
<html><body>
<h1>GLOVES</h1>
<form action="/cart/add">
  <div>GLOVES Rs. 2,999 Pay in 3 installments of RS. 999 SKU: X Add to cart</div>
</form>
<div class="related">BOYS TEE Rs. 699 Rs. 1,399 OTHER Rs. 3,599</div>
<script type="application/ld+json">
{"@type":"Product","name":"GLOVES","url":"https://www.breakout.com.pk/products/26wmg030-blk",
 "offers":{"@type":"Offer","priceCurrency":"PKR","price":"2999.0"}}
</script>
<meta property="og:site_name" content="Breakout" />
</body></html>
"""


def test_analyze_prefers_schema_price_over_related_product_noise():
    """Full-page min/max used to return 699/3599 from related cards instead of 2999."""
    with patch(
        "services.sale_alert_analyze.crawler.fetch_html_with_fallback",
        return_value=(200, _PDP_FIXTURE, "https://www.breakout.com.pk/products/26wmg030-blk", False),
    ):
        result = analyze_product_url("https://www.breakout.com.pk/products/26wmg030-blk")
    assert result["ok"] is True
    assert result["product_name"] == "GLOVES"
    assert result["current_price"] == 2999.0
    assert result["brand_name"] == "Breakout"


_OUTFITTERS_CENTS_FIXTURE = """
<html><body>
<h1>Checkered Shirt</h1>
<form action="/cart/add">
  <div data-sp="249000" data-scp="499000">Sale price PKR 2,490 Regular price PKR 4,990 -50%</div>
</form>
<script type="application/json">
{"price":{"amount":2490.0,"currencyCode":"PKR"},"compare_at_price":499000}
</script>
<meta property="og:site_name" content="Outfitters" />
</body></html>
"""


def test_analyze_normalizes_shopify_cents_compare_at():
    """Outfitters-style compare_at_price:499000 must become Rs. 4,990 — not 499,000."""
    with patch(
        "services.sale_alert_analyze.crawler.fetch_html_with_fallback",
        return_value=(200, _OUTFITTERS_CENTS_FIXTURE, "https://outfitters.com.pk/products/f1065-103", False),
    ):
        result = analyze_product_url("https://outfitters.com.pk/products/f1065-103")
    assert result["ok"] is True
    assert result["current_price"] == 2490.0
    assert result["original_price"] == 4990.0
    assert result["discount_pct"] == 50.1  # (1 - 2490/4990)*100
    assert result["already_on_sale"] is True


def test_is_http_url():
    assert is_http_url("https://shop.example.com/p/1")
    assert is_http_url("shop.example.com/p/1")
    assert not is_http_url("not a url")
    assert not is_http_url("ftp://example.com/x")


def test_validate_create_payload_product_requires_fields():
    ok, err = validate_create_payload(
        {
            "device_id": "dev-1",
            "alert_type": "product",
            "product_name": "Shoes",
            "brand_name": "Nike",
            "product_url": "https://example.com/shoes",
            "condition_type": "any_sale",
            "notify_push": True,
        }
    )
    assert err is None
    assert ok["product_url"] == "https://example.com/shoes"

    _, err = validate_create_payload(
        {
            "device_id": "dev-1",
            "alert_type": "product",
            "product_name": "Shoes",
            "brand_name": "Nike",
            "condition_type": "any_sale",
        }
    )
    assert "product_url" in err


def test_validate_create_payload_target_price_and_notifications():
    _, err = validate_create_payload(
        {
            "device_id": "dev-1",
            "alert_type": "product",
            "product_name": "Shoes",
            "brand_name": "Nike",
            "product_url": "https://example.com/shoes",
            "condition_type": "target_price",
        }
    )
    assert "target_price" in err

    _, err = validate_create_payload(
        {
            "device_id": "dev-1",
            "alert_type": "brand",
            "brand_name": "Nike",
            "condition_type": "any_sale",
            "notify_push": False,
            "notify_email": False,
            "notify_in_app": False,
        }
    )
    assert "notification" in err


def test_validate_create_rejects_brand_target_price():
    _, err = validate_create_payload(
        {
            "device_id": "dev-1",
            "alert_type": "brand",
            "brand_name": "Nike",
            "condition_type": "target_price",
            "target_price": 50,
        }
    )
    assert err is not None


def test_validate_patch_status_only():
    patch, err = validate_patch_payload({"status": "paused"}, current_alert_type="product")
    assert err is None
    assert patch == {"status": "paused"}
