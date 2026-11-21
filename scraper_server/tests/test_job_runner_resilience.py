from routers import automation
from services import job_runner, job_service


def test_runner_survives_when_recording_the_failure_also_fails(mocker):
    """A DB outage used to kill the job thread from inside its own error
    handler, leaving the row 'running' and blocking automation for hours."""
    job = mocker.Mock()
    job.collect_work.side_effect = RuntimeError("could not receive data from server")
    mocker.patch.object(job_service, "get_job", return_value={"id": 1})
    mocker.patch.object(job_service, "set_stage")
    mocker.patch.object(job_service, "append_log", side_effect=RuntimeError("no route to host"))
    finish = mocker.patch.object(job_service, "finish_job")

    job_runner.run_sequential_job(1, job, {})  # must not raise

    finish.assert_not_called()


def test_start_automation_reclaims_dead_runs_first(mocker):
    mocker.patch.object(automation, "get_setting", return_value=True)
    calls = []
    mocker.patch.object(job_service, "reclaim_stale_jobs", side_effect=lambda *a, **k: calls.append("reclaim") or [])
    mocker.patch.object(job_service, "get_active_job", side_effect=lambda *a: calls.append("active") or None)
    mocker.patch.object(job_service, "create_job", return_value={"id": 9})
    mocker.patch.object(job_runner, "get_runner", return_value=mocker.Mock())
    mocker.patch.object(automation.threading, "Thread")

    assert automation._start_automation_job_if_needed() == {"id": 9}
    assert calls == ["reclaim", "active"]
