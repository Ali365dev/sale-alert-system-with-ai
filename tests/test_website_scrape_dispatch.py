"""Website scrape concurrency queue — enqueue instead of 429."""
from unittest.mock import MagicMock, patch

from services.website_scraper import dispatch


def test_dispatch_respects_concurrent_cap():
    dispatch._started_ids.clear()
    pending = [
        {"id": 1, "payload": {"brand_id": 1}},
        {"id": 2, "payload": {"brand_id": 2}},
        {"id": 3, "payload": {"brand_id": 3}},
        {"id": 4, "payload": {"brand_id": 4}},
    ]
    runner = MagicMock()
    started_threads = []

    def fake_thread(*, target, args, daemon, name):
        started_threads.append(args[1])  # job_id
        return MagicMock(start=lambda: None)

    with patch.object(dispatch, "WEBSITE_SCRAPE_MAX_CONCURRENT", 2):
        with patch.object(dispatch.job_service, "list_pending_jobs", return_value=pending):
            with patch.object(dispatch.job_runner, "get_runner", return_value=runner):
                with patch.object(dispatch.threading, "Thread", side_effect=fake_thread):
                    n = dispatch.dispatch_pending()

    assert n == 2
    assert started_threads == [1, 2]
    assert dispatch._started_ids == {1, 2}

    # Cap full — no more starts
    with patch.object(dispatch, "WEBSITE_SCRAPE_MAX_CONCURRENT", 2):
        with patch.object(dispatch.job_service, "list_pending_jobs", return_value=pending):
            with patch.object(dispatch.job_runner, "get_runner", return_value=runner):
                with patch.object(dispatch.threading, "Thread", side_effect=fake_thread) as thr:
                    assert dispatch.dispatch_pending() == 0
                    thr.assert_not_called()

    dispatch._started_ids.clear()


def test_reclaim_unowned_skips_owned_workers():
    dispatch._started_ids.clear()
    dispatch._started_ids.add(99)

    with patch.object(dispatch.job_service, "fail_jobs", return_value=[{"id": 1}]) as fail:
        n = dispatch.reclaim_unowned_workers()

    assert n == 1
    fail.assert_called_once()
    kwargs = fail.call_args.kwargs
    assert kwargs["exclude_ids"] == {99}
    assert kwargs["statuses"] == ("running", "cancelling")
    dispatch._started_ids.clear()
