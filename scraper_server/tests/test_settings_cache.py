from services import settings_service as svc


def test_get_setting_is_cached_and_set_setting_invalidates(mocker):
    load = mocker.patch.object(svc, "_load_setting_value", side_effect=['"a"', '"b"'])
    mocker.patch.object(svc, "get_session")
    mocker.patch.object(svc, "write_audit")

    assert svc.get_setting("gmail_label") == "a"
    assert svc.get_setting("gmail_label") == "a"
    assert load.call_count == 1

    svc.set_setting("gmail_label", "b")
    assert svc.get_setting("gmail_label") == "b"
    assert load.call_count == 2


def test_missing_setting_returns_default_and_is_cached(mocker):
    load = mocker.patch.object(svc, "_load_setting_value", return_value=svc._MISSING)

    assert svc.get_setting("nope", default=7) == 7
    assert svc.get_setting("nope", default=8) == 8
    assert load.call_count == 1


def test_cache_expires_after_ttl(mocker):
    load = mocker.patch.object(svc, "_load_setting_value", return_value='"x"')
    clock = mocker.patch.object(svc.time, "monotonic", return_value=100.0)

    svc.get_setting("k")
    clock.return_value = 100.0 + svc._CACHE_TTL_SECONDS + 1
    svc.get_setting("k")

    assert load.call_count == 2
