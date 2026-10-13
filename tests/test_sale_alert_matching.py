from types import SimpleNamespace

from services.sale_alert_matching import (
    brand_condition_met,
    discount_pct,
    product_condition_met,
    product_trigger_message,
)


def test_discount_pct():
    assert round(discount_pct(699, 6599)) == 89
    assert discount_pct(100, 100) is None
    assert discount_pct(None, 100) is None


def test_product_any_sale_and_pct():
    assert product_condition_met("any_sale", current_price=699, original_price=6599) is True
    assert product_condition_met("pct_30", current_price=699, original_price=6599) is True
    assert product_condition_met("pct_30", current_price=70, original_price=100) is True
    assert product_condition_met("pct_30", current_price=90, original_price=100) is False
    assert product_condition_met("custom_pct", current_price=70, original_price=100, custom_pct=25) is True
    assert product_condition_met("custom_pct", current_price=80, original_price=100, custom_pct=25) is False
    assert product_condition_met("target_price", current_price=90, original_price=150, target_price=100) is True
    assert product_condition_met("target_price", current_price=120, original_price=150, target_price=100) is False


def test_brand_conditions():
    assert brand_condition_met("any_sale", alert_brand="Nike", offer_brand="nike") is True
    assert brand_condition_met("any_sale", alert_brand="Nike", offer_brand="Adidas") is False
    assert brand_condition_met("pct_20", alert_brand="Nike", offer_brand="Nike", discount_percentage=25) is True
    assert brand_condition_met("pct_20", alert_brand="Nike", offer_brand="Nike", discount_percentage=10) is False
    assert brand_condition_met("new_code", alert_brand="Nike", offer_brand="Nike", coupon_code="SAVE20") is True
    assert brand_condition_met("new_code", alert_brand="Nike", offer_brand="Nike", coupon_code="") is False


def test_product_trigger_message():
    msg = product_trigger_message("GLOVES", current_price=699, original_price=6599)
    assert "GLOVES" in msg
    assert "OFF" in msg
