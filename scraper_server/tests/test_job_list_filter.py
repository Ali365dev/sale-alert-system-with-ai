from services import job_service


def _status_criterion(mocker, mock_get_session, mock_session, status):
    mocker.patch("services.job_service.get_session", mock_get_session)
    q = mock_session.query.return_value
    q.filter.return_value = q
    q.count.return_value = 0
    q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

    job_service.list_jobs(status=status)

    (criterion,) = q.filter.call_args.args
    return str(criterion.compile(compile_kwargs={"literal_binds": True}))


def test_active_matches_every_unfinished_status(mocker, mock_get_session, mock_session):
    """The Pipeline Center's Active Jobs list must include queued and
    cancelling jobs, not only `running` ones, so each can be cancelled."""
    sql = _status_criterion(mocker, mock_get_session, mock_session, "active")
    assert sql == "jobs.status IN ('pending', 'running', 'cancelling')"


def test_a_concrete_status_still_filters_exactly(mocker, mock_get_session, mock_session):
    sql = _status_criterion(mocker, mock_get_session, mock_session, "failed")
    assert sql == "jobs.status = 'failed'"
