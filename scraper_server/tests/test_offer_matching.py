from types import SimpleNamespace

from services.offer_matching import offer_matches_preferences
from services.offer_notifications import notification_copy


def _offer(**kwargs):
    defaults = dict(brand="Nike", category="Shoes", subcategory=None, summary=None, title=None, discount_percentage=40, id=9)
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_and_mode_requires_brand_and_category():
    offer = {"brand": "Nike", "category": "Shoes"}
    assert offer_matches_preferences(offer, ["Nike"], ["Shoes"], mode="and") is True
    assert offer_matches_preferences(offer, ["Nike"], ["Clothing"], mode="and") is False
    assert offer_matches_preferences(offer, ["Adidas"], ["Shoes"], mode="and") is False
    assert offer_matches_preferences({"brand": "Adidas", "category": "Clothing"}, ["Nike"], ["Shoes"], mode="and") is False


def test_and_mode_empty_preferences_never_match():
    offer = {"brand": "Nike", "category": "Shoes"}
    assert offer_matches_preferences(offer, [], [], mode="and") is False
    assert offer_matches_preferences(offer, ["Nike"], [], mode="and") is False
    assert offer_matches_preferences(offer, [], ["Shoes"], mode="and") is False


def test_brand_mismatch_and_category_mismatch():
    assert offer_matches_preferences({"brand": "Adidas", "category": "Shoes"}, ["Nike"], ["Shoes"], mode="and") is False
    assert offer_matches_preferences({"brand": "Nike", "category": "Watches"}, ["Nike"], ["Shoes"], mode="and") is False


def test_matching_is_case_insensitive():
    assert offer_matches_preferences({"brand": "NIKE", "category": "shoes"}, ["Nike"], ["Shoes"], mode="and") is True


def test_offer_matches_if_any_category_hits():
    offer = {"brand": "Nike", "category": "Shoes", "subcategory": "Sports"}
    assert offer_matches_preferences(offer, ["Nike"], ["Sports"], mode="and") is True
    assert offer_matches_preferences(offer, ["Nike"], ["Watches"], mode="and") is False


def test_or_mode_allows_either_dimension():
    offer = {"brand": "Nike", "category": "Watches"}
    assert offer_matches_preferences(offer, ["Nike"], ["Shoes"], mode="or") is True
    assert offer_matches_preferences({"brand": "Apple", "category": "Shoes"}, ["Nike"], ["Shoes"], mode="or") is True
    assert offer_matches_preferences({"brand": "Apple", "category": "Watches"}, ["Nike"], ["Shoes"], mode="or") is False
    assert offer_matches_preferences(offer, [], [], mode="or") is False


def test_notification_copy_includes_offer_id_for_deep_link():
    title, body, data = notification_copy(_offer())
    assert "Nike" in title
    assert data["dealId"] == "9"
    assert data["offerId"] == "9"
    assert body
