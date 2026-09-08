"""Tests for app/api/routers/social_scraper.py's pure-DB endpoints —
save_offer (manual override + no-op-when-already-exists) and the validation
paths of fetch_preview/submit_post. submit_post's success path (job/thread
creation) is exercised via live manual verification instead, same convention
as tests/test_brand_discovery_router.py."""
import json
import types

from app.api.routers.social_scraper import fetch_preview, save_offer


def _post(**overrides):
    defaults = dict(
        id=1, brand_id=None, platform="facebook", post_url="https://facebook.com/acme/posts/1",
        caption="50% off", image_url=None, post_date=None, ocr_text=None,
        keyword_score=6.0, keyword_status="eligible_for_analysis", keyword_reason="test",
        ai_result=json.dumps({"is_offer": True, "title": "50% Off", "discount_percentage": 50}),
        offer_id=None, status="processed", error=None, job_id=1, scraped_at=None, created_at=None,
    )
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


def test_fetch_preview_rejects_invalid_platform():
    response = fetch_preview({"platform": "tiktok", "post_url": "https://tiktok.com/x"})
    assert response.status_code == 400


def test_fetch_preview_rejects_missing_post_url():
    response = fetch_preview({"platform": "facebook", "post_url": ""})
    assert response.status_code == 400


def test_save_offer_not_found_returns_404(mocker, mock_get_session, mock_session):
    mocker.patch("app.api.routers.social_scraper.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None

    response = save_offer(999)
    assert response.status_code == 404


def test_save_offer_requires_finished_processing(mocker, mock_get_session, mock_session):
    post = _post(ai_result=None)
    mocker.patch("app.api.routers.social_scraper.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = post

    response = save_offer(1)
    assert response.status_code == 400


def test_save_offer_is_a_noop_when_offer_already_exists(mocker, mock_get_session, mock_session):
    existing_offer = types.SimpleNamespace(id=555, brand="Acme")
    post = _post(offer_id=555)

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        else:
            q.filter.return_value.first.return_value = existing_offer
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("app.api.routers.social_scraper.get_session", mock_get_session)

    result = save_offer(1)
    assert result == {"offer_id": 555, "brand": "Acme", "already_existed": True}


def test_save_offer_creates_new_offer_when_none_exists_yet(mocker, mock_get_session, mock_session):
    post = _post(offer_id=None)

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        else:  # Brand — no brand_id on this post, but the code still queries defensively
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("app.api.routers.social_scraper.get_session", mock_get_session)
    mock_session.add.side_effect = lambda obj: setattr(obj, "id", 777)

    result = save_offer(1)

    assert result == {"offer_id": 777, "brand": None, "already_existed": False}
    assert post.offer_id == 777
