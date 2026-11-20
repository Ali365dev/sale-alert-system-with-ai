"""Delete an Offer and any rows that reference it.

Postgres rejects `DELETE FROM offers` while `offer_notifications` (and
nullable FKs on social/website scrape rows) still point at the offer.
The Offers Manager row trash and checkbox bulk-delete both go through here.
"""
from database.models import Offer, OfferNotification, SocialPost, WebsiteScrapedPage


def delete_offer_row(session, offer: Offer) -> None:
    oid = offer.id
    session.query(OfferNotification).filter(OfferNotification.offer_id == oid).delete(synchronize_session=False)
    session.query(SocialPost).filter(SocialPost.offer_id == oid).update(
        {SocialPost.offer_id: None},
        synchronize_session=False,
    )
    session.query(WebsiteScrapedPage).filter(WebsiteScrapedPage.offer_id == oid).update(
        {WebsiteScrapedPage.offer_id: None},
        synchronize_session=False,
    )
    session.delete(offer)
