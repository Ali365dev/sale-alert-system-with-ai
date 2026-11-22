"""Delete an Offer (or an Email with its offers) and any rows that reference it.

Postgres rejects `DELETE FROM offers` while `offer_notifications` (and
nullable FKs on social/website scrape rows) still point at the offer, and
`DELETE FROM emails` while a `brand_candidates` row does. None of these FKs
cascade in the database, and the ORM's Email.offers cascade only deletes the
offers themselves — so every email or offer delete must go through here.
"""
from database.models import BrandCandidate, Email, Offer, OfferNotification, SocialPost, WebsiteScrapedPage


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


def delete_email_row(session, email: Email) -> None:
    for offer in session.query(Offer).filter(Offer.email_id == email.id).all():
        delete_offer_row(session, offer)
    session.query(BrandCandidate).filter(BrandCandidate.email_id == email.id).delete(synchronize_session=False)
    session.delete(email)
