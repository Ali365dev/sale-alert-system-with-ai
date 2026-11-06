"""Extracts promotional/newsletter email addresses from crawled brand pages.
Looks for email addresses likely used for marketing (newsletter, deals, promo,
sales, offers) and filters out generic support/info/admin addresses.
"""
import re

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.I)

# Path hints in mailto: href or surrounding text that suggest a promo email
_PROMO_HINTS = (
    "newsletter", "promo", "promotion", "deals", "offer", "sale", "discount",
    "marketing", "updates", "subscribe", "coupon", "alert", "notify",
)

# Addresses to exclude — generic/non-promo
_SKIP_PREFIXES = (
    "support", "help", "admin", "webmaster", "postmaster", "abuse",
    "noreply", "no-reply", "donotreply", "do-not-reply", "bounce",
    "privacy", "legal", "dmca", "press", "media", "career", "jobs",
)

_SKIP_DOMAINS = (
    "example.com", "sentry.io", "w3.org", "schema.org",
    "cloudflare.com", "googleapis.com", "gstatic.com",
)


def _is_promo(addr: str, context: str) -> bool:
    local = addr.split("@")[0].lower()
    domain = addr.split("@")[1].lower() if "@" in addr else ""

    if any(domain.endswith(d) for d in _SKIP_DOMAINS):
        return False
    if any(local.startswith(p) for p in _SKIP_PREFIXES):
        return False
    # Explicit promo prefix wins immediately
    if any(hint in local for hint in _PROMO_HINTS):
        return True
    # Promo keyword nearby in surrounding text
    ctx = context.lower()
    if any(hint in ctx for hint in _PROMO_HINTS):
        return True
    return False


def extract_promo_emails(pages: dict) -> list[str]:
    """Returns a deduplicated list of likely promotional email addresses found
    across the crawled pages (home/about/contact)."""
    found: dict[str, None] = {}  # preserves insertion order, deduplicates

    for page in pages.values():
        if page is None:
            continue

        soup = page.soup
        text = page.text

        # mailto: links — highest confidence
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href.lower().startswith("mailto:"):
                continue
            addr = href[7:].split("?")[0].strip().lower()
            if not _EMAIL_RE.fullmatch(addr):
                continue
            # Context = link text + 100 chars of surrounding page text
            link_text = a.get_text(" ", strip=True)
            idx = text.find(addr)
            ctx = text[max(0, idx - 100): idx + 100] + " " + link_text
            if _is_promo(addr, ctx):
                found[addr] = None

        # Plain text — lower confidence, skip if no promo hint
        for m in _EMAIL_RE.finditer(text):
            addr = m.group(0).lower()
            if addr in found:
                continue
            ctx = text[max(0, m.start() - 120): m.end() + 120]
            if _is_promo(addr, ctx):
                found[addr] = None

    return list(found)[:10]  # cap at 10
