from types import SimpleNamespace
from unittest.mock import MagicMock

from services.offer_delete import delete_offer_row


def test_delete_offer_row_clears_notifications_and_scrape_links():
    session = MagicMock()
    offer = SimpleNamespace(id=42)

    delete_offer_row(session, offer)

    assert session.query.call_count == 3
    session.delete.assert_called_once_with(offer)
    # Notifications are removed; scrape rows keep history with offer_id nulled.
    deleted = session.query.return_value.filter.return_value.delete
    updated = session.query.return_value.filter.return_value.update
    deleted.assert_called_once()
    assert updated.call_count == 2
