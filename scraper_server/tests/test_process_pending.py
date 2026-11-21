from types import SimpleNamespace

from jobs.process_pending import ProcessPendingJob


def test_only_unprocessed_adds_a_status_filter(mocker, mock_get_session, mock_session):
    """The Email Manager button must not pick up failed emails or processed
    ones whose offer retention already removed — that recreated old offers."""
    mocker.patch("jobs.process_pending.get_session", mock_get_session)
    base = mock_session.query.return_value.filter.return_value
    base.filter.return_value.order_by.return_value.all.return_value = [SimpleNamespace(id=7, subject="Sale")]

    items = ProcessPendingJob().collect_work({"payload": {"only_unprocessed": True}})

    assert [i.id for i in items] == [7]
    (criterion,) = base.filter.call_args.args
    assert str(criterion.compile(compile_kwargs={"literal_binds": True})) == "emails.processing_status = 'unprocessed'"


def test_default_run_keeps_its_original_scope(mocker, mock_get_session, mock_session):
    mocker.patch("jobs.process_pending.get_session", mock_get_session)
    base = mock_session.query.return_value.filter.return_value
    base.order_by.return_value.all.return_value = []

    ProcessPendingJob().collect_work({"payload": {}})

    base.filter.assert_not_called()


def test_skips_an_email_that_got_an_offer_meanwhile(mocker, mock_get_session, mock_session):
    mocker.patch("jobs.process_pending.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = SimpleNamespace(id=7)
    mock_session.query.return_value.scalar.return_value = True
    analyze = mocker.patch("ai.analyzer.analyze_email")

    assert ProcessPendingJob().process_item(1, SimpleNamespace(id=7, label="Sale")) == "skipped"
    analyze.assert_not_called()
