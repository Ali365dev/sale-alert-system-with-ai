"""
One-click launcher — sequential, one-email-at-a-time pipeline.

For each new Gmail email:
    1. Fetch email from Gmail
    2. Save email to Supabase
    3. Send to AI
    4. Save offer to Supabase
    5. Move to next email

Then launches the Streamlit dashboard.
"""
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

from config import logger, GMAIL_LABEL
from database.db import init_db, get_session
from database.models import Email, Offer
from gmail.gmail_service import _get_session as gmail_session, _get_label_id, _decode_body, _parse_date
from ai.analyzer import analyze_email

try:
    from gmail.gmail_service import REQUEST_TIMEOUT
except ImportError:
    REQUEST_TIMEOUT = 30

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def _parse_expiry(date_str) -> datetime | None:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _fetch_email(session, msg_id: str) -> dict | None:
    """Download a single Gmail message and return its fields, or None on error."""
    try:
        resp = session.get(
            f"{GMAIL_API_BASE}/messages/{msg_id}",
            params={"format": "full"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        msg = resp.json()
    except Exception as exc:
        logger.error("Could not fetch message %s: %s", msg_id, exc)
        return None

    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    return {
        "gmail_message_id": msg_id,
        "sender":        headers.get("From", "unknown"),
        "subject":       headers.get("Subject", "(no subject)"),
        "body":          _decode_body(msg.get("payload", {}))[:50_000],
        "received_date": _parse_date(headers.get("Date")),
    }


def run_pipeline() -> None:
    t0 = datetime.now(timezone.utc)

    # 1. Init DB
    print("[1/3] Initialising database …", flush=True)
    init_db()

    # 2. Get new Gmail message IDs
    print("[2/3] Fetching Gmail message list …", flush=True)
    http = gmail_session()
    label_id = _get_label_id(http, GMAIL_LABEL)
    if not label_id:
        print(f"      Label '{GMAIL_LABEL}' not found — nothing to do.")
        return

    all_ids: list[str] = []
    page_token = None
    while True:
        params = {"labelIds": label_id, "maxResults": 500}
        if page_token:
            params["pageToken"] = page_token
        resp = http.get(f"{GMAIL_API_BASE}/messages", params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        all_ids.extend(m["id"] for m in data.get("messages", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    with get_session() as db:
        existing = {row[0] for row in db.query(Email.gmail_message_id).all()}

    new_ids = [mid for mid in all_ids if mid not in existing]
    print(f"      {len(all_ids)} total, {len(new_ids)} new to process.", flush=True)
    if not new_ids:
        print("      Nothing new — launching dashboard.")
        return

    # 3. Process each email: fetch → save email → AI → save offer
    print(f"[3/3] Processing {len(new_ids)} email(s) one by one …", flush=True)
    saved, failed = 0, 0

    for i, mid in enumerate(new_ids, 1):
        print(f"  [{i}/{len(new_ids)}] {mid}", flush=True)

        # Step A: fetch from Gmail
        raw = _fetch_email(http, mid)
        if not raw:
            failed += 1
            continue

        # Step B: save email to Supabase
        try:
            with get_session() as db:
                email_row = Email(
                    gmail_message_id=raw["gmail_message_id"],
                    sender=raw["sender"],
                    subject=raw["subject"],
                    body=raw["body"],
                    received_date=raw["received_date"],
                    processed_at=datetime.now(timezone.utc).replace(tzinfo=None),
                )
                db.add(email_row)
                db.flush()
                email_id = email_row.id
        except Exception as exc:
            logger.error("Failed to save email %s: %s", mid, exc)
            failed += 1
            continue

        # Step C: send to AI
        result = analyze_email(raw["subject"], raw["body"])
        if result is None:
            logger.warning("AI returned no result for email %s", mid)
            failed += 1
            continue

        # Step D: save offer to Supabase
        try:
            with get_session() as db:
                db.add(Offer(
                    email_id=email_id,
                    brand=result.get("brand"),
                    company=result.get("company"),
                    category=result.get("category"),
                    subcategory=result.get("subcategory"),
                    offer_type=result.get("offer_type"),
                    discount_percentage=result.get("discount_percentage"),
                    coupon_code=result.get("coupon_code"),
                    expiry_date=_parse_expiry(result.get("expiry_date")),
                    offer_value=result.get("offer_value"),
                    website=result.get("website_url") or None,
                    summary=result.get("summary"),
                    key_highlights=json.dumps(result.get("key_highlights", [])),
                    is_active=True,
                    source="email",
                ))
            saved += 1
            print(f"      ✓ brand={result.get('brand')!r} category={result.get('category')!r}", flush=True)
        except Exception as exc:
            logger.error("Failed to save offer for email %s: %s", mid, exc)
            failed += 1

    elapsed = (datetime.now(timezone.utc) - t0).total_seconds()
    print(f"\n  Done in {elapsed:.1f}s — {saved} offer(s) saved, {failed} failed.", flush=True)


def main() -> None:
    print("=" * 55)
    print("  Gmail AI Dashboard — Launcher")
    print("=" * 55 + "\n")

    run_pipeline()

    print("\nStarting Streamlit dashboard …")
    print("Open http://localhost:8501 in your browser.")
    print("Press Ctrl+C to stop.\n")

    streamlit_bin = ROOT / ".venv" / "bin" / "streamlit"
    if not streamlit_bin.exists():
        streamlit_bin = "streamlit"

    subprocess.run(
        [str(streamlit_bin), "run", str(ROOT / "app.py")],
        cwd=str(ROOT),
        check=False,
    )


if __name__ == "__main__":
    main()
