"""HTML + plain-text templates for transactional account emails."""
from __future__ import annotations

import html
from dataclasses import dataclass

# Deals More brand (matches dealplusApp theme primary).
_BRAND = "#F20D38"
_BRAND_DARK = "#D90832"
_INK = "#10233F"
_MUTED = "#6B7C93"
_BORDER = "#E8EDF3"
_BG = "#FAF8F9"
_CARD = "#FFFFFF"
_SOFT = "#FFF0F3"


@dataclass(frozen=True)
class EmailContent:
    subject: str
    text: str
    html: str


def _shell(*, preheader: str, title: str, body_html: str, footer_note: str) -> str:
    pre = html.escape(preheader)
    ttl = html.escape(title)
    note = html.escape(footer_note)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>{ttl}</title>
</head>
<body style="margin:0;padding:0;background:{_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{_INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{pre}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:{_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:{_CARD};border:1px solid {_BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,{_BRAND} 0%,{_BRAND_DARK} 100%);padding:28px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="display:inline-block;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.2);text-align:center;line-height:36px;font-size:18px;color:#fff;font-weight:700;">%</div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.2px;">Deals More</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">Savings alerts &amp; deals</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:800;color:{_INK};">{ttl}</h1>
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:{_MUTED};">{note}</p>
            </td>
          </tr>
          <tr>
            <td style="background:{_BG};border-top:1px solid {_BORDER};padding:18px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:{_MUTED};">© Deals More · This is an automated message — please don’t reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def password_reset_email(*, code: str, ttl_minutes: int) -> EmailContent:
    safe_code = html.escape(str(code))
    subject = "Your Deals More password reset code"
    text = (
        f"Reset your Deals More password\n\n"
        f"Your verification code is: {code}\n\n"
        f"This code expires in {ttl_minutes} minutes.\n\n"
        f"Enter it in the app to choose a new password.\n\n"
        f"If you didn’t request this, you can ignore this email — "
        f"your password will stay the same.\n"
    )
    body_html = f"""
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:{_MUTED};">
                Use this one-time code to reset your password. It expires in
                <strong style="color:{_INK};">{ttl_minutes} minutes</strong>.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="background:{_SOFT};border:1px solid {_BORDER};border-radius:14px;padding:22px 16px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:{_MUTED};margin-bottom:10px;">Verification code</div>
                    <div style="font-size:36px;font-weight:800;letter-spacing:0.28em;color:{_BRAND};font-family:'SF Mono',Menlo,Consolas,monospace;">{safe_code}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:1.55;color:{_MUTED};">
                Open Deals More → Forgot password → enter this code → set a new password.
              </p>
"""
    html_body = _shell(
        preheader=f"Your password reset code is {code}",
        title="Reset your password",
        body_html=body_html,
        footer_note="If you didn’t request a password reset, you can safely ignore this email. Your account stays secure.",
    )
    return EmailContent(subject=subject, text=text, html=html_body)


def google_only_account_email() -> EmailContent:
    """Sent when reset is requested for a social-only account (Google or Apple)."""
    subject = "Sign in with Google or Apple — Deals More"
    text = (
        "Someone requested a password reset for this email on Deals More.\n\n"
        "This account signs in with Google or Apple, so there is no password to reset. "
        "Open the app and tap Continue with Google or Continue with Apple.\n\n"
        "If you didn’t request this, you can ignore this email.\n"
    )
    body_html = f"""
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:{_MUTED};">
                Someone asked to reset a password for this email on Deals More.
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:{_MUTED};">
                This account uses <strong style="color:{_INK};">Google</strong> or
                <strong style="color:{_INK};">Apple Sign-In</strong>,
                so there isn’t a password to reset. Open the app and tap
                <strong style="color:{_INK};">Continue with Google</strong> or
                <strong style="color:{_INK};">Continue with Apple</strong>.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px 0;">
                <tr>
                  <td style="background:{_SOFT};border-radius:10px;padding:12px 14px;font-size:13px;color:{_MUTED};line-height:1.5;">
                    Tip: use the same Google or Apple account you originally signed up with.
                  </td>
                </tr>
              </table>
"""
    html_body = _shell(
        preheader="This account uses Google or Apple Sign-In — no password to reset.",
        title="No password on this account",
        body_html=body_html,
        footer_note="If you didn’t request this, you can ignore this email.",
    )
    return EmailContent(subject=subject, text=text, html=html_body)
