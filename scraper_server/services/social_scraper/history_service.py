"""Per (brand, platform) scrape-history bookkeeping — SocialScrapeLog rows.
Never touched for ad-hoc Social Scraper Test submissions (no brand_id)."""
from datetime import datetime, timezone

from database.db import get_session
from database.models import SocialScrapeLog


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def record_scrape_result(
    brand_id: int, platform: str, post_url: str, status: str, error_message: str | None, offer_created: bool
) -> None:
    """Upserts the (brand_id, platform) row — one call per processed post."""
    with get_session() as session:
        log = (
            session.query(SocialScrapeLog)
            .filter(SocialScrapeLog.brand_id == brand_id, SocialScrapeLog.platform == platform)
            .first()
        )
        if log is None:
            log = SocialScrapeLog(brand_id=brand_id, platform=platform, posts_checked=0, offers_created=0)
            session.add(log)

        log.last_scraped_at = _utcnow()
        log.last_post_url = post_url
        log.status = status
        log.error_message = error_message
        log.posts_checked = (log.posts_checked or 0) + 1
        if offer_created:
            log.offers_created = (log.offers_created or 0) + 1


def get_history_for_brand(brand_id: int) -> list[dict]:
    with get_session() as session:
        logs = session.query(SocialScrapeLog).filter(SocialScrapeLog.brand_id == brand_id).all()
        return [
            {
                "id": log.id,
                "brand_id": log.brand_id,
                "platform": log.platform,
                "last_scraped_at": log.last_scraped_at.isoformat() if log.last_scraped_at else None,
                "last_post_url": log.last_post_url,
                "status": log.status,
                "error_message": log.error_message,
                "posts_checked": log.posts_checked,
                "offers_created": log.offers_created,
                "updated_at": log.updated_at.isoformat() if log.updated_at else None,
            }
            for log in logs
        ]
