"""Sale alert trigger/match service tests (mocked DB + analyze)."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from services import sale_alert_service as svc


def test_match_brand_alerts_for_offer(mocker, mock_get_session, mock_session):
    mocker.patch.object(svc, "get_session", mock_get_session)
    mocker.patch.object(svc.fcm_client, "is_configured", return_value=False)

    offer = SimpleNamespace(
        id=9,
        brand="Nike",
        discount_percentage=40,
        coupon_code=None,
        website="https://nike.com/sale",
        image_url=None,
        title="Air Max weekend",
        summary=None,
        is_active=True,
    )
    alert = SimpleNamespace(
        id=3,
        device_id="dev-1",
        alert_type="brand",
        status="active",
        brand_name="Nike",
        product_name=None,
        condition_type="pct_20",
        custom_pct=None,
        image_url=None,
        notify_push=True,
        notify_in_app=True,
        triggered_message=None,
        triggered_deal_url=None,
    )

    def query_side_effect(model):
        q = MagicMock()
        name = getattr(model, "__name__", str(model))
        if name == "Offer":
            q.filter.return_value.first.return_value = offer
        elif name == "SaleAlert":
            q.filter.return_value.all.return_value = [alert]
        else:
            q.filter.return_value.all.return_value = []
        return q

    mock_session.query.side_effect = query_side_effect

    result = svc.match_brand_alerts_for_offer(9, notify=False)
    assert result["ok"] is True
    assert result["matched"] == 1
    assert alert.status == "triggered"
    assert "Nike" in (alert.triggered_message or "")


def test_check_product_alert_triggers(mocker, mock_get_session, mock_session):
    mocker.patch.object(svc, "get_session", mock_get_session)
    mocker.patch.object(
        svc,
        "analyze_product_url",
        return_value={
            "ok": True,
            "product_name": "GLOVES",
            "brand_name": "Breakout",
            "current_price": 699.0,
            "original_price": 6599.0,
            "image_url": "https://example.com/g.jpg",
            "product_url": "https://www.breakout.com.pk/products/26wmg030-blk",
            "sku": "26WMG030",
        },
    )
    mocker.patch.object(svc.fcm_client, "is_configured", return_value=False)

    alert = SimpleNamespace(
        id=1,
        device_id="dev-1",
        alert_type="product",
        status="active",
        product_name="GLOVES",
        brand_name="Breakout",
        product_url="https://www.breakout.com.pk/products/26wmg030-blk",
        image_url=None,
        current_price=None,
        original_price=None,
        sku=None,
        condition_type="pct_30",
        custom_pct=None,
        target_price=None,
        notify_push=True,
        notify_in_app=True,
        triggered_message=None,
        triggered_deal_url=None,
        last_checked_at=None,
        last_triggered_at=None,
    )

    def query_side_effect(model):
        q = MagicMock()
        q.filter.return_value.first.return_value = alert
        q.filter.return_value.all.return_value = []
        return q

    mock_session.query.side_effect = query_side_effect

    result = svc.check_product_alert(1, notify=False)
    assert result["ok"] is True
    assert result["triggered"] is True
    assert alert.status == "triggered"
    assert alert.current_price == 699.0
