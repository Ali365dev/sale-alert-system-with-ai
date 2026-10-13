"""Unit tests for sale-alerts helpers (no DB)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from app.api.routers import sale_alerts as sale_alerts_router
from services.sale_alert_analyze import analyze_product_url, friendly_fetch_error


def test_friendly_fetch_error_messages():
    assert "not be found" in friendly_fetch_error(404)
    assert "blocked" in friendly_fetch_error(403, blocked=True).lower()
    assert "couldn't load" in friendly_fetch_error(500).lower()


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
        notify_push=True,
        notify_email=False,
        notify_in_app=True,
        last_checked_at=None,
        last_triggered_at=None,
        triggered_message=None,
        triggered_deal_url=None,
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
    assert "couldn't load" in result["error"].lower()


def test_analyze_product_url_blocked():
    with patch(
        "services.sale_alert_analyze.crawler.fetch_html_with_fallback",
        return_value=(403, "", "https://example.com/product/1", False),
    ):
        result = analyze_product_url("https://example.com/product/1")
    assert result["ok"] is False
    assert "blocked" in result["error"].lower() or "manually" in result["error"].lower()
