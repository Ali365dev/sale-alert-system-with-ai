"""Forgot-password OTP issue + redeem."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from services import password_reset as pr
from services import user_auth


def test_request_password_reset_issues_code_for_password_user(mocker):
    session = MagicMock()
    user = SimpleNamespace(email="a@b.com", password_hash="hashed")
    session.query.return_value.filter.return_value.first.return_value = user
    mocker.patch.object(pr, "send_email", return_value=True)
    mocker.patch.object(pr, "email_delivery_available", return_value=True)
    mocker.patch.object(pr, "PASSWORD_RESET_DEV_ECHO", True)

    result = pr.request_password_reset(session, "a@b.com")

    assert result["ok"] is True
    assert "dev_code" in result
    assert len(result["dev_code"]) == 6
    session.add.assert_called_once()
    pr.send_email.assert_called_once()


def test_request_password_reset_hides_unknown_email(mocker):
    session = MagicMock()
    session.query.return_value.filter.return_value.first.return_value = None
    mocker.patch.object(pr, "send_email")
    mocker.patch.object(pr, "PASSWORD_RESET_DEV_ECHO", False)

    result = pr.request_password_reset(session, "missing@b.com")

    assert result["ok"] is True
    assert "dev_code" not in result
    session.add.assert_not_called()
    pr.send_email.assert_not_called()


def test_reset_password_with_valid_code(mocker):
    session = MagicMock()
    user = SimpleNamespace(email="a@b.com", password_hash="old")
    session.query.return_value.filter.return_value.first.return_value = user

    code = "123456"
    row = SimpleNamespace(
        code_hash=user_auth.hash_password(code),
        used_at=None,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10),
    )
    session.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
        row
    ]

    # first() for User, then the chain for PasswordResetCode
    def query_side_effect(model):
        q = MagicMock()
        name = getattr(model, "__name__", str(model))
        if "User" in name:
            q.filter.return_value.first.return_value = user
        else:
            q.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [row]
        return q

    session.query.side_effect = query_side_effect

    ok, message = pr.reset_password_with_code(
        session, email="a@b.com", code=code, new_password="newpass12"
    )

    assert ok is True
    assert "updated" in message.lower()
    assert row.used_at is not None
    assert user.password_hash != "old"
