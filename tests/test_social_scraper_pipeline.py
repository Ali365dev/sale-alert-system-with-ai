"""Tests for services/social_scraper/content_pipeline.py — every external
call (OCR, keyword scoring, AI analysis, DB, history) is mocked."""
import types

from services.social_scraper.content_pipeline import run as run_pipeline


def _post(**overrides):
    defaults = dict(
        id=1, platform="facebook", post_url="https://facebook.com/acme/posts/1",
        caption="50% off everything this weekend!", image_url=None, brand_id=None,
        ocr_text=None, keyword_score=None, keyword_status=None, keyword_reason=None,
        ai_result=None, offer_id=None, status="pending", error=None, post_date=None, scraped_at=None,
    )
    defaults.update(overrides)
    return types.SimpleNamespace(**defaults)


def _patch_common(mocker, post, sale_relevance, ai_result):
    mocker.patch("services.social_scraper.content_pipeline.job_service.set_stage")
    mocker.patch("ai.sale_filter.evaluate", return_value=sale_relevance)
    mocker.patch("ai.social_offer_analyzer.analyze_social_post", return_value=ai_result)
    return post


class _Relevance(types.SimpleNamespace):
    pass


def _relevance(score, status, reason="test"):
    return _Relevance(score=score, status=status, reason=reason)


def test_no_offer_created_when_ai_says_not_an_offer(mocker, mock_get_session, mock_session):
    post = _post()

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        else:
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("services.social_scraper.content_pipeline.get_session", mock_get_session)
    _patch_common(mocker, post, _relevance(1.0, "eligible_for_analysis"), {"is_offer": False})

    outcome = run_pipeline(job_id=1, social_post_id=1)

    assert outcome == "successful"
    assert post.offer_id is None
    assert post.status == "processed"
    assert post.keyword_status == "eligible_for_analysis"


def test_offer_created_when_ai_says_it_is_an_offer(mocker, mock_get_session, mock_session):
    post = _post()

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        else:
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("services.social_scraper.content_pipeline.get_session", mock_get_session)

    ai_result = {"is_offer": True, "title": "50% Off Sale", "discount_percentage": 50, "category": "Fashion"}
    _patch_common(mocker, post, _relevance(6.0, "eligible_for_analysis"), ai_result)

    created_offer = types.SimpleNamespace(id=None)

    def add_side_effect(obj):
        created_offer.id = 999
        obj.id = 999
    mock_session.add.side_effect = add_side_effect

    outcome = run_pipeline(job_id=1, social_post_id=1)

    assert outcome == "successful"
    assert post.offer_id == 999


def test_ai_call_skipped_when_keyword_status_is_not_sale_related(mocker, mock_get_session, mock_session):
    post = _post(caption="Check out our new office, we moved!")

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        else:
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("services.social_scraper.content_pipeline.get_session", mock_get_session)
    mocker.patch("services.social_scraper.content_pipeline.job_service.set_stage")
    mocker.patch("ai.sale_filter.evaluate", return_value=_relevance(0.0, "not_sale_related"))
    analyze = mocker.patch("ai.social_offer_analyzer.analyze_social_post")

    outcome = run_pipeline(job_id=1, social_post_id=1)

    analyze.assert_not_called()
    assert outcome == "successful"
    assert post.offer_id is None


def test_scrape_history_recorded_when_brand_linked(mocker, mock_get_session, mock_session):
    post = _post(brand_id=42)
    brand = types.SimpleNamespace(id=42, name="Acme")

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        elif "Brand" in str(model):
            q.filter.return_value.first.return_value = brand
        else:
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("services.social_scraper.content_pipeline.get_session", mock_get_session)

    ai_result = {"is_offer": True, "title": "BOGO Sale", "offer_type": "BOGO"}
    _patch_common(mocker, post, _relevance(6.0, "eligible_for_analysis"), ai_result)
    mock_session.add.side_effect = lambda obj: setattr(obj, "id", 555)

    record_scrape_result = mocker.patch("services.social_scraper.history_service.record_scrape_result")

    run_pipeline(job_id=1, social_post_id=1)

    record_scrape_result.assert_called_once_with(
        brand_id=42, platform="facebook", post_url=post.post_url,
        status="success", error_message=None, offer_created=True,
    )


def test_scrape_history_not_touched_for_ad_hoc_test_submission(mocker, mock_get_session, mock_session):
    post = _post(brand_id=None)

    def query_side_effect(model):
        q = mocker.Mock()
        if "SocialPost" in str(model):
            q.filter.return_value.first.return_value = post
        else:
            q.filter.return_value.first.return_value = None
        return q
    mock_session.query.side_effect = query_side_effect
    mocker.patch("services.social_scraper.content_pipeline.get_session", mock_get_session)
    _patch_common(mocker, post, _relevance(1.0, "eligible_for_analysis"), {"is_offer": False})

    record_scrape_result = mocker.patch("services.social_scraper.history_service.record_scrape_result")

    run_pipeline(job_id=1, social_post_id=1)

    record_scrape_result.assert_not_called()
