from services.jobs.notify_matching_offer import NotifyMatchingOfferJob


def test_collect_work_empty_without_offer_id():
    assert NotifyMatchingOfferJob().collect_work({"payload": {}}) == []


def test_collect_work_empty_when_offer_missing(mocker, mock_get_session, mock_session):
    mocker.patch("services.jobs.notify_matching_offer.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None
    assert NotifyMatchingOfferJob().collect_work({"payload": {"offer_id": 99}}) == []
