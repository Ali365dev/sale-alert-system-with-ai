"""Password-reset / account email HTML templates."""
from services.email_templates import google_only_account_email, password_reset_email


def test_password_reset_template_includes_code_and_branding():
    content = password_reset_email(code="482910", ttl_minutes=15)
    assert "482910" in content.subject or "reset" in content.subject.lower()
    assert "482910" in content.text
    assert "482910" in content.html
    assert "Deals More" in content.html
    assert "#F20D38" in content.html
    assert "15 minutes" in content.html
    assert "<!DOCTYPE html>" in content.html


def test_google_only_template_mentions_google_sign_in():
    content = google_only_account_email()
    assert "Google" in content.subject
    assert "Google" in content.text
    assert "Continue with Google" in content.html
    assert "Deals More" in content.html
