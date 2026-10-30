"""Shared crawl + result assembly for the isolated website scrape lab."""
from __future__ import annotations

import time
from typing import Any, Callable

from config import BASE_URL, MAX_PAGES, REQUEST_DELAY_SECONDS
from extractors.html_page import extract_links, extract_products, extract_visible_text, is_product_url, prioritize_urls
from extractors.structured_data import extract_structured
from sale_detector import enrich_product, is_relevant_product, keyword_signals, slim_product

FetchFn = Callable[[str], tuple[int, str, str]]


def crawl_and_analyze(
    scraper: str,
    fetch_html: FetchFn,
    *,
    start_url: str = BASE_URL,
    max_pages: int = MAX_PAGES,
    delay: float = REQUEST_DELAY_SECONDS,
    notes: str | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    pages: list[dict[str, Any]] = []
    errors: list[str] = []
    queued = [start_url]
    seen: set[str] = set()
    discovered: list[str] = []

    while queued and len(pages) < max_pages:
        url = queued.pop(0)
        if url in seen:
            continue
        seen.add(url)
        if pages:
            time.sleep(delay)
        try:
            status, html, final_url = fetch_html(url)
        except Exception as extra:
            errors.append(f"{url}: {type(extra).__name__}: {extra}")
            continue
        if status >= 400 or not html:
            errors.append(f"{final_url or url}: HTTP {status}")
            continue
        pages.append({"url": final_url or url, "html": html, "status": status})
        discovered.extend(extract_links(html, final_url or url))
        remaining = [u for u in discovered if u not in seen]
        extra_urls = prioritize_urls(remaining, limit=max_pages * 3)
        product_urls = [u for u in remaining if is_product_url(u)]
        mixed: list[str] = []
        for item in extra_urls:
            if item not in mixed:
                mixed.append(item)
        for item in product_urls[:2]:
            if item not in mixed:
                mixed.insert(1, item)
        for item in mixed:
            if item not in seen and item not in queued:
                queued.append(item)

    return assemble_result(scraper, pages, errors=errors, elapsed=time.perf_counter() - started, notes=notes)


def assemble_result(
    scraper: str,
    pages: list[dict[str, Any]],
    *,
    errors: list[str],
    elapsed: float,
    notes: str | None = None,
) -> dict[str, Any]:
    sale_signals: list[dict[str, Any]] = []
    products: list[dict[str, Any]] = []
    seen_products: set[str] = set()
    seen_headlines: set[str] = set()
    structured_any = False
    js_hint = False

    for page in pages:
        url = page["url"]
        html = page["html"]
        text = extract_visible_text(html)
        for signal in keyword_signals(text, url):
            key = (signal.get("text") or "").lower()
            if key in seen_headlines:
                continue
            seen_headlines.add(key)
            sale_signals.append(signal)
        structured = extract_structured(html, url)
        structured_any = structured_any or bool(structured.get("found"))
        for product in extract_products(html, url) + (structured.get("products") or []):
            product = enrich_product(dict(product))
            if not is_relevant_product(product):
                continue
            key = (product.get("url") or "") + "|" + (product.get("name") or "")
            if key in seen_products:
                continue
            seen_products.add(key)
            slim = slim_product(product)
            products.append(slim)
        if len(html) < 8000 and "application/json" in html and not extract_products(html, url):
            js_hint = True

    status = "success" if pages else "failed"
    reason = None
    if not pages:
        reason = "; ".join(errors) if errors else "No pages retrieved"
    elif not sale_signals and not products:
        status = "failed"
        reason = "Pages loaded but no sale-related headlines or discounted products were found."
        if js_hint:
            reason += " JavaScript-rendered content may be missing from the initial HTML."

    merged_notes = notes
    if errors and pages:
        merged_notes = ((notes + "; ") if notes else "") + f"{len(errors)} follow-up error(s)"

    return {
        "scraper": scraper,
        "url": BASE_URL,
        "status": status,
        "execution_time_seconds": round(elapsed, 2),
        "pages_checked": len(pages),
        "sale_signals": sale_signals,
        "products": products,
        "sale_signal_count": len(sale_signals),
        "product_count": len(products),
        "structured_data_found": structured_any,
        "reason": reason,
        "notes": merged_notes,
        "errors": errors[:8],
    }
