"""Scrapes takhfif.app's public bank-card deal directory into
database.models.BankCardOffer rows. The site server-renders a clean
schema.org JSON-LD block on both the /deals listing (an ItemList of places)
and every /place/{slug} detail page (a LocalBusiness with a full offers[]
array of bank/card/discount data) — no HTML-class scraping needed. See
jobs/scrape_takhfif.py for the background job that drives this."""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Iterator, Optional

from services import bank_offers_store
from services.website_scraper.crawler import fetch_html

BASE_URL = "https://takhfif.app"

_LD_JSON_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)

# Max discount is rendered only in the page HTML per card, never in the
# JSON-LD offers[] block, so it has to be scraped from the markup.
_CARD_NAME_RE = re.compile(r'<span class="text-sm font-medium text-foreground">([^<]+)</span>')
_MAX_DISCOUNT_RE = re.compile(r'Max discount:</span>((?:<!-- -->|[^<])*)')

# The Next.js RSC payload embeds the full per-bank card list — including banks
# whose offer panel is NOT server-rendered (only the default bank's is), plus
# cap_amount_pkr and branchCoverage, which the visible HTML lacks for them.
_RSC_PUSH_RE = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')

_SOCIAL_DOMAIN_PLATFORMS = {
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "linkedin.com": "linkedin",
}


def _ld_json_blocks(html: str) -> list[dict]:
    blocks = []
    for raw in _LD_JSON_RE.findall(html):
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return blocks


def _extract_item_list(html: str) -> list[dict]:
    for data in _ld_json_blocks(html):
        if data.get("@type") == "ItemList":
            return [
                {"name": item.get("name"), "url": item.get("url")}
                for item in data.get("itemListElement", [])
                if item.get("url")
            ]
    return []


def _extract_local_business(html: str) -> Optional[dict]:
    for data in _ld_json_blocks(html):
        for node in data.get("@graph") or []:
            if node.get("@type") == "LocalBusiness":
                return node
    return None


def _split_same_as(same_as: list[str]) -> tuple[Optional[str], dict]:
    """Splits a LocalBusiness's sameAs[] into (website, social_links) —
    the first non-social-domain URL is the website, the rest become
    {"platform": {"url": ...}} entries matching BrandDiscovery.social_links'
    shape, for the duplicate-detector's social-link fallback match."""
    website = None
    social_links: dict = {}
    for url in same_as or []:
        platform = next((p for d, p in _SOCIAL_DOMAIN_PLATFORMS.items() if d in url), None)
        if platform:
            social_links[platform] = {"url": url}
        elif website is None:
            website = url
    return website, social_links


def _strip_description_prefix(description: str, discount, bank_name: str) -> str:
    prefix = f"{discount}% off with {bank_name} "
    if description.startswith(prefix):
        return description[len(prefix):].strip()
    return description


def _extract_max_discounts(html: str) -> dict[str, dict]:
    """Returns {card_name: {"text", "amount"}} parsed from the rendered
    card list markup."""
    result: dict[str, dict] = {}
    matches = list(_CARD_NAME_RE.finditer(html))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(html)
        md = _MAX_DISCOUNT_RE.search(html, m.end(), end)
        if not md:
            continue
        text = md.group(1).replace("<!-- -->", "").strip()
        amt = re.search(r"([\d,]+)", text)
        result[m.group(1).strip()] = {
            "text": text or None,
            "amount": float(amt.group(1).replace(",", "")) if amt else None,
        }
    return result


def _extract_rsc_data(html: str) -> tuple[dict[tuple, dict], dict[str, Optional[datetime]]]:
    """Returns (cards_by_key, bank_expiries) from the page's RSC payload.
    cards_by_key: {(bank_lower, card_lower, discount_percent): card} — each
      card carries cap_amount_pkr and branchCoverage.
    bank_expiries: {bank_name_lower: expiry_datetime} — the "Valid until" date
      shown per-bank in the UI (bankExpiry field), used as fallback when the
      JSON-LD offer lacks validThrough."""
    chunks = []
    for m in _RSC_PUSH_RE.finditer(html):
        try:
            chunks.append(json.loads(f'"{m.group(1)}"'))
        except json.JSONDecodeError:
            continue
    text = "".join(chunks)

    decoder = json.JSONDecoder()
    by_key: dict[tuple, dict] = {}
    ambiguous: set[tuple] = set()
    bank_expiries: dict[str, Optional[datetime]] = {}

    for m in re.finditer(r'\{"bankName":', text):
        try:
            bank, _ = decoder.raw_decode(text, m.start())
        except json.JSONDecodeError:
            continue
        bank_name = (bank.get("bankName") or "").strip()
        bank_lower = bank_name.lower()
        if not bank_lower or not isinstance(bank.get("cards"), list):
            continue
        if bank_lower not in bank_expiries:
            bank_expiries[bank_lower] = _parse_date(bank.get("bankExpiry"))
        for card in bank["cards"]:
            card_name = (card.get("card_name") or "").strip().lower()
            if not card_name:
                continue
            by_key[(bank_lower, card_name, card.get("discount_percent"))] = card
            short = (bank_lower, card_name)
            if short in by_key:
                ambiguous.add(short)
            else:
                by_key[short] = card
    for short in ambiguous:
        by_key.pop(short, None)
    return by_key, bank_expiries


def _parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def list_deal_pages(max_pages: int) -> Iterator[list[dict]]:
    """Yields each /deals page's place list ({"name", "url"}), in order,
    until max_pages is reached or a page comes back with no items."""
    for page in range(1, max_pages + 1):
        status, html, _ = fetch_html(f"{BASE_URL}/deals?page={page}")
        if status != 200:
            break
        items = _extract_item_list(html)
        if not items:
            break
        yield items


def scrape_place(place_url: str) -> dict:
    """Fetches one /place/{slug} page and returns
    {name, website, social_links, offers: [...]}. Raises ValueError on a
    non-200 response or a missing LocalBusiness node — the job treats that
    as a per-place failure, not a critical one."""
    status, html, _ = fetch_html(place_url)
    if status != 200:
        raise ValueError(f"HTTP {status} fetching {place_url}")

    business = _extract_local_business(html)
    if business is None:
        raise ValueError(f"No LocalBusiness data found on {place_url}")

    name = business.get("name") or ""
    website, social_links = _split_same_as(business.get("sameAs") or [])

    max_discounts = _extract_max_discounts(html)
    rsc_cards, bank_expiries = _extract_rsc_data(html)

    offers = []
    for raw in business.get("offers") or []:
        bank_name = ((raw.get("offeredBy") or {}).get("name") or "").strip()
        if not bank_name:
            continue
        description = raw.get("description") or ""
        card_name = _strip_description_prefix(description, raw.get("discount"), bank_name) or None
        md = (max_discounts.get(card_name or "")
              or max_discounts.get(f"{bank_name} {card_name}" if card_name else "")
              or {})
        rsc = {}
        if card_name:
            rsc = (rsc_cards.get((bank_name.lower(), card_name.lower(), raw.get("discount")))
                   or rsc_cards.get((bank_name.lower(), card_name.lower()))
                   or {})
        cap = rsc.get("cap_amount_pkr")
        coverage = rsc.get("branchCoverage") or {}
        expiry = _parse_date(raw.get("validThrough")) or bank_expiries.get(bank_name.lower())
        offers.append({
            "bank_name": bank_name,
            "card_name": card_name,
            "discount_percentage": raw.get("discount"),
            "currency": raw.get("priceCurrency"),
            "expiry_date": expiry,
            "description": description or None,
            "max_discount_text": f"Rs {cap:,.0f}" if cap else md.get("text"),
            "max_discount_amount": float(cap) if cap else md.get("amount"),
            "branch_valid_count": coverage.get("c"),
            "branch_total_count": coverage.get("t"),
            "valid_branches": coverage.get("n") or None,
        })

    return {"name": name, "website": website, "social_links": social_links, "offers": offers}


def upsert_place_offers(place_url: str, place: dict) -> int:
    """Thin wrapper around services.bank_offers_store — see there for the
    actual brand-matching + replace-by-source-url write path, shared with
    the chrome extension's manual Bank Offers save."""
    return bank_offers_store.upsert_place_offers(
        place_url, place["name"], place["website"], place["social_links"], place["offers"],
    )
