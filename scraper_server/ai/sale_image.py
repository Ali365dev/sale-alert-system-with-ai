"""Pick the one email image to show on the offer.

Email HTML often has many images (logo, tracking pixel, footer). The image
whose OCR text is most sale-related wins, scored with the same sale filter
used for the email body. When no image has sale text, the biggest
banner-shaped image (often the campaign hero, GIFs included) is used instead.
"""
from __future__ import annotations

from ai.sale_filter import NOT_SALE_RELATED, evaluate


# Fallback only: smaller images are logos/icons/buttons, and very long or
# very flat ones are dividers, footer strips or whole-email screenshots.
_MIN_FALLBACK_SIDE = 200
_MAX_FALLBACK_ASPECT = 4.0


def select_sale_image(ocr_items: list[dict] | None, images: list[dict] | None = None) -> str | None:
    """Return one image URL, or None if no image qualifies.

    `ocr_items` is `extract_and_merge()["items"]`: dicts with url, text,
    confidence. Scoring uses OCR text only (not the email subject/body), so a
    footer logo is not chosen just because the email itself is a sale.
    `images` is `extract_and_merge()["images"]` (every loaded image with its
    width/height) for the biggest-image fallback.
    """
    best: tuple[float, float, str] | None = None
    for item in ocr_items or []:
        url = (item.get("url") or "").strip()
        text = (item.get("text") or "").strip()
        if not url or not text:
            continue
        relevance = evaluate("", "", text)
        if relevance.status == NOT_SALE_RELATED:
            continue
        confidence = float(item.get("confidence") or 0)
        key = (relevance.score, confidence)
        if best is None or key > (best[0], best[1]):
            best = (relevance.score, confidence, url)
    if best:
        return best[2]
    return _biggest_image(images)


def _biggest_image(images: list[dict] | None) -> str | None:
    best: tuple[int, str] | None = None
    for image in images or []:
        url = (image.get("url") or "").strip()
        width, height = image.get("width") or 0, image.get("height") or 0
        if not url or min(width, height) < _MIN_FALLBACK_SIDE:
            continue
        if max(width, height) / min(width, height) > _MAX_FALLBACK_ASPECT:
            continue
        if best is None or width * height > best[0]:
            best = (width * height, url)
    return best[1] if best else None
