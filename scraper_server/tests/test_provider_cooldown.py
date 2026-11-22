import threading
import time

from ai import providers


def _manager(mocker, order=("groq", "gemini")):
    m = object.__new__(providers.ProviderManager)
    m._lock = threading.RLock()
    m._cooldown_until = {}
    m._active_name = order[0]
    m._last_error = None
    m._last_failure_info = None
    mocker.patch.object(m, "_sync_order", return_value=(list(order), {n: True for n in order}))
    mocker.patch.object(m, "_save_state")
    return m


def test_advance_benches_a_provider_only_as_long_as_it_asked(mocker):
    """Regression: a Groq 429 says "retry in a few seconds", but the provider
    was benched for 300s — every email in that window failed."""
    m = _manager(mocker)

    m._advance(retry_in=4)

    remaining = m._cooldown_until["groq"] - time.monotonic()
    assert 3 < remaining <= 4
    assert m._active_name == "gemini"


def test_advance_without_retry_after_keeps_the_default_cooldown(mocker):
    m = _manager(mocker)
    m._advance()
    assert m._cooldown_until["groq"] - time.monotonic() > providers._COOLDOWN_SECONDS - 5


def test_call_waits_out_a_short_cooldown_instead_of_failing(mocker):
    m = _manager(mocker, order=("groq",))
    m._cooldown_until["groq"] = time.monotonic() + 3
    sleep = mocker.patch.object(providers.time, "sleep", side_effect=lambda s: m._cooldown_until.clear())
    groq = mocker.Mock()
    groq.name = "groq"
    groq.call.return_value = '{"ok": true}'
    mocker.patch.dict(providers._REGISTRY, {"groq": groq})

    assert m.call("prompt") == '{"ok": true}'
    assert 2 < sleep.call_args.args[0] <= 3


def test_call_still_fails_fast_on_a_long_cooldown(mocker):
    m = _manager(mocker, order=("gemini",))
    m._cooldown_until["gemini"] = time.monotonic() + 3600  # e.g. daily quota gone
    sleep = mocker.patch.object(providers.time, "sleep")

    assert m.call("prompt") is None
    sleep.assert_not_called()


def test_key_tracker_reports_when_the_first_key_comes_back():
    tracker = providers._KeyCooldowns()
    a, b = {"id": 1, "name": "a"}, {"id": 2, "name": "b"}
    tracker.cool_down("groq", a, 10, "429")
    tracker.cool_down("groq", b, 3, "429")
    assert 2 < tracker.seconds_until_available("groq", [a, b]) <= 3
    tracker.clear("groq", b)
    assert tracker.seconds_until_available("groq", [a, b]) == 0
