"""Email Manager endpoints exercised over HTTP against a real (SQLite) DB."""
from contextlib import contextmanager
from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.models import Base, BrandCandidate, Email, Offer, OfferNotification, SocialPost, WebsiteScrapedPage
from routers import emails as emails_router


@pytest.fixture
def db(mocker):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    tables = [m.__table__ for m in (Email, Offer, OfferNotification, BrandCandidate, SocialPost, WebsiteScrapedPage)]
    referenced = {fk.column.table for t in tables for fk in t.foreign_keys}
    Base.metadata.create_all(engine, tables=list(referenced | set(tables)))
    Session = sessionmaker(engine)

    @contextmanager
    def get_session():
        session = Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    mocker.patch.object(emails_router, "get_session", get_session)
    return get_session


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(emails_router.router)
    return TestClient(app)


def _seed(db):
    with db() as s:
        rows = [
            Email(gmail_message_id="m1", sender='"Khaadi" <news@khaadi.com>', subject="Winter Sale 50% off",
                  body="Sale body", received_date=datetime(2026, 11, 20), processing_status="processed",
                  email_verification_status="legitimate", image_urls='["https://x/a.png", "https://x/b.png"]'),
            Email(gmail_message_id="m2", sender="deals@sapphire.pk", subject="New arrivals",
                  body="Hello", received_date=datetime(2026, 11, 21), processing_status="unprocessed"),
            Email(gmail_message_id="m3", sender="spam@junk.biz", subject="You won",
                  body="Click", received_date=datetime(2026, 11, 19), processing_status="failed",
                  processing_error="No matching brand", email_verification_status="spam", image_urls="not json"),
        ]
        s.add_all(rows)
        s.flush()
        s.add(Offer(email_id=rows[0].id, brand="Khaadi", title="50% off"))
        return [r.id for r in rows]


def test_list_summary_counts_and_brand(client, db):
    khaadi, _, _ = _seed(db)
    body = client.get("/api/emails").json()

    assert body["total"] == 3
    assert body["summary"] == {
        "total": 3, "unverified": 1, "legitimate": 1, "suspicious": 0, "spam": 1,
        "processed": 1, "unprocessed": 1, "failed": 1, "offers_found": 1,
    }
    first = body["emails"][0]
    assert first["subject"] == "New arrivals"  # newest first
    row = next(e for e in body["emails"] if e["id"] == khaadi)
    assert (row["brand"], row["offers_count"], row["image_count"]) == ("Khaadi", 1, 2)
    assert row["gmail_link"].endswith("#all/m1")


@pytest.mark.parametrize("params, expected", [
    ({"processing_status": "failed"}, ["You won"]),
    ({"status": "unverified"}, ["New arrivals"]),
    ({"status": "spam"}, ["You won"]),
    ({"brand": "Khaadi"}, ["Winter Sale 50% off"]),
    ({"q": "khaadi"}, ["Winter Sale 50% off"]),
    ({"q": "arrivals"}, ["New arrivals"]),
    ({"q": "junk.biz"}, ["You won"]),
    ({"sort": "subject", "sort_dir": "asc"}, ["New arrivals", "Winter Sale 50% off", "You won"]),
    ({"sort": "received_date", "sort_dir": "asc"}, ["You won", "Winter Sale 50% off", "New arrivals"]),
    ({"page_size": "10", "page": "2"}, []),
])
def test_filters_search_sort_and_paging(client, db, params, expected):
    _seed(db)
    body = client.get("/api/emails", params=params).json()
    assert [e["subject"] for e in body["emails"]] == expected


def test_detail_tolerates_bad_image_json(client, db):
    _, _, spam = _seed(db)
    body = client.get(f"/api/emails/{spam}").json()
    assert body["image_urls"] == [] and body["processing_error"] == "No matching brand"
    assert client.get("/api/emails/9999").status_code == 404


def test_process_returns_reprocess_result(client, db, mocker):
    _, new, _ = _seed(db)
    reprocess = mocker.patch(
        "services.email_processing.reprocess_email",
        return_value={"processing_status": "processed", "processing_error": None, "offer_id": 7},
    )
    assert client.post(f"/api/emails/{new}/process").json()["offer_id"] == 7
    reprocess.assert_called_once_with(new, apply_sale_filter=False)
    assert client.post("/api/emails/9999/process").status_code == 404


def test_verify_saves_classification(client, db, mocker):
    _, new, _ = _seed(db)
    mocker.patch("ai.verifier.verify_email_content",
                 return_value={"status": "suspicious", "reason": "odd link", "confidence": 70})
    assert client.post(f"/api/emails/{new}/verify").json()["status"] == "suspicious"
    assert client.get(f"/api/emails/{new}").json()["status"] == "suspicious"


def test_verify_all_runs_and_clears_running_flag(client, db, mocker):
    _seed(db)
    mocker.patch("ai.verifier.verify_email_content",
                 return_value={"status": "legitimate", "reason": "ok", "confidence": 90})
    mocker.patch.object(emails_router.threading, "Thread",
                        side_effect=lambda target, args, daemon: mocker.Mock(start=lambda: target(*args)))
    assert client.post("/api/emails/verify-all", json={}).status_code == 202
    assert client.get("/api/emails/verify-all/status").json() == {"running": False, "done": 1, "total": 1, "failed": 0}
    assert client.get("/api/emails").json()["summary"]["unverified"] == 0


def test_delete_pushed_email_with_brand_candidate(client, db):
    khaadi, _, spam = _seed(db)
    with db() as s:
        offer_id = s.query(Offer.id).filter(Offer.email_id == khaadi).scalar()
        s.add(OfferNotification(offer_id=offer_id, device_id="device-1"))
        s.add(BrandCandidate(email_id=spam))

    assert client.delete(f"/api/emails/{khaadi}").json() == {"status": "deleted"}
    assert client.delete(f"/api/emails/{spam}").json() == {"status": "deleted"}
    assert client.delete("/api/emails/9999").status_code == 404
    summary = client.get("/api/emails").json()["summary"]
    assert (summary["total"], summary["offers_found"]) == (1, 0)
