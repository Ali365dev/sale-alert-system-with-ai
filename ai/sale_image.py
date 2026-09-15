"""Pick the single email image whose OCR text is sale-related.

Email HTML often has many images (logo, tracking pixel, footer). OCR already
skips tiny/empty ones; this scores remaining OCR text with the same sale
filter used for the email body and keeps only the strongest match.
"""
from __future__ import annotations

from ai.sale_filter import NOT_SALE_RELATED, evaluate


def select_sale_image(ocr_items: list[dict] | None) -> str | None:
    """Return one image URL, or None if no image has sale-related text.

    `ocr_items` is `extract_and_merge()["items"]`: dicts with url, text,
    confidence. Scoring uses OCR text only (not the email subject/body), so a
    footer logo is not chosen just because the email itself is a sale.
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
    return best[2] if best else None
