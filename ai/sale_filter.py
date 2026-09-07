"""Pre-AI sale-content relevance filter.

Scores an email's combined content (subject + body + OCR text) against
known sale/discount/promo signals *before* it reaches the AI offer-
extraction call (ai.analyzer.analyze_email) — so obviously non-sale mail
(newsletters, receipts, account notices, forum digests, generic brand
updates with no actual deal) never spends an AI call.

Deliberately keyword/regex-based, not an AI classifier itself — that's the
point: it has to be cheap enough to run on every email with no API cost.

Only the low-confidence bucket ("not_sale_related") skips the AI call.
"needs_review" (medium confidence) still goes to full analysis — missing a
real deal worded ambiguously is worse than one extra AI call — and is
recorded purely for visibility/reporting. See services/jobs/process_pending.py,
services/email_sync.py, and services/email_processing.py for how the three
statuses are used.
"""
import re
from typing import NamedTuple

# Weak on their own — generic marketing vocabulary any promotional email
# might use regardless of whether there's an actual discount. Each one
# corroborates a stronger signal but a handful of these alone must never
# clear the "eligible" bar (see the point cap below).
#
# Admin-editable from the dashboard's Settings -> Sale Filter tab (stored as
# setting key "sale_filter_weak_keywords" — see app/api/routers/settings.py's
# /sale-filter endpoints), so this list is only the fallback default, used
# when nothing's been saved yet or the stored value is malformed.
DEFAULT_WEAK_KEYWORDS = [
    "sale", "discount", "offer", "deal", "promotion", "save",
    "coupon", "promo code", "clearance",
]


def weak_keywords() -> list[str]:
    """Current effective weak-keyword list — admin override if one's been
    saved, else DEFAULT_WEAK_KEYWORDS. Re-read on every call (no caching),
    same as every other setting in this app (see services/settings_service.py's
    module docstring) — a saved change takes effect immediately."""
    try:
        from services.settings_service import get_setting

        keywords = get_setting("sale_filter_weak_keywords", default=DEFAULT_WEAK_KEYWORDS)
    except Exception:
        # A DB hiccup here should degrade to the default list, not break
        # email processing — this filter runs on every incoming email.
        return DEFAULT_WEAK_KEYWORDS
    if isinstance(keywords, list) and all(isinstance(k, str) and k.strip() for k in keywords):
        return keywords
    return DEFAULT_WEAK_KEYWORDS


# Strong on their own — specific enough as a plain phrase match that one hit
# is real evidence of a sale mechanic, not just marketing vocabulary (unlike
# DEFAULT_WEAK_KEYWORDS above). Admin-editable the same way, under setting
# key "sale_filter_strong_keywords" — plain substring/phrase matches only
# (no regex), so an admin typo here can never break scoring the way a bad
# regex could; the regex-based _STRONG_PATTERNS below stay code-only for
# that reason.
#
# Deliberately doesn't repeat concepts already caught by the _STRONG_PATTERNS
# regexes below (BOGO, "buy one get one", "free gift with purchase", "bundle
# deal") — that would just double-count the same signal.
DEFAULT_STRONG_KEYWORDS = [
    "flash sale", "doorbuster", "clearance sale", "final sale",
    "today only", "while supplies last", "black friday", "cyber monday",
    "members only sale", "exclusive discount",
]


def strong_keywords() -> list[str]:
    """Current effective strong-keyword list — same override/fallback/
    resilience behavior as weak_keywords() above."""
    try:
        from services.settings_service import get_setting

        keywords = get_setting("sale_filter_strong_keywords", default=DEFAULT_STRONG_KEYWORDS)
    except Exception:
        return DEFAULT_STRONG_KEYWORDS
    if isinstance(keywords, list) and all(isinstance(k, str) and k.strip() for k in keywords):
        return keywords
    return DEFAULT_STRONG_KEYWORDS


# Each of these is a strong, largely self-sufficient signal — a concrete
# discount/promo mechanic rather than just marketing language. Regex, so
# code-only — see strong_keywords() above for the admin-editable phrase list.
_STRONG_PATTERNS = [
    (re.compile(r"\bup to\s+\d{1,3}\s*%\s*off\b", re.I), "up-to-percent-off"),
    (re.compile(r"\d{1,3}\s*%\s*off\b", re.I), "percent-off"),
    (re.compile(r"\bsave\s+\d{1,3}\s*%", re.I), "save-percent"),
    (re.compile(r"\bsave\s+(?:[$€£]|sar|usd|aed|pkr|inr)\s?\d+", re.I), "save-currency"),
    (re.compile(r"\b(?:reduced|special|marked[\s-]?down)\s+price\b", re.I), "reduced-price"),
    (re.compile(r"\blimited[\s-]time\s+offer\b", re.I), "limited-time-offer"),
    (re.compile(r"\bbuy\s+one[,\s]+get\s+one\b", re.I), "bogo-phrase"),
    (re.compile(r"\bbogo\b", re.I), "bogo"),
    (re.compile(r"\bbuy\s+\d+[,\s]+get\s+\d+\b", re.I), "buy-x-get-y"),
    (re.compile(r"\bfree\s+gift\s+with\s+purchase\b", re.I), "free-gift-with-purchase"),
    (re.compile(r"\bbundle\s+deal\b", re.I), "bundle-deal"),
    (re.compile(r"\boriginal\s+price\b", re.I), "original-price"),
    (re.compile(r"\bwas\s+[$€£]\s?\d+(?:\.\d+)?\s+now\s+[$€£]\s?\d+(?:\.\d+)?\b", re.I), "was-now-price"),
    (re.compile(r"\bpromo\s*code\b", re.I), "promo-code-mention"),
]

# A price-comparison signal needing two numbers rather than a fixed phrase —
# e.g. "$120 -> $79", "$120 now $79", "PKR 5000 to PKR 3500".
_PRICE_PAIR = re.compile(
    r"(?:[$€£]|sar|usd|aed|pkr|inr)\s?\d+(?:\.\d+)?\s*(?:→|->|-|to|now)\s*(?:[$€£]|sar|usd|aed|pkr|inr)?\s?\d+(?:\.\d+)?",
    re.I,
)

# An actual coupon/promo *code* token (not just the word "coupon") — e.g.
# "code: SAVE20", "use SAVE20 at checkout".
_COUPON_CODE = re.compile(r"\b(?:code|coupon)[:\s]+[A-Z0-9]{3,15}\b")

WEAK_KEYWORD_POINTS = 0.5
WEAK_KEYWORD_CAP = 3  # at most this many weak keywords counted
STRONG_PATTERN_POINTS = 2.0
PRICE_PAIR_POINTS = 2.0
COUPON_CODE_POINTS = 1.5

HIGH_THRESHOLD = 5.0
MEDIUM_THRESHOLD = 2.0

ELIGIBLE = "eligible_for_analysis"
NEEDS_REVIEW = "needs_review"
NOT_SALE_RELATED = "not_sale_related"


class SaleRelevance(NamedTuple):
    score: float
    status: str  # ELIGIBLE | NEEDS_REVIEW | NOT_SALE_RELATED
    reason: str


def evaluate(subject: str, body: str, ocr_text: str) -> SaleRelevance:
    """Combines subject + body + OCR text and scores it for sale relevance.
    Never raises — worst case (no content) is a confident not_sale_related."""
    combined = " ".join(t for t in (subject or "", body or "", ocr_text or "") if t)
    if not combined.strip():
        return SaleRelevance(0.0, NOT_SALE_RELATED, "no content to evaluate")

    lowered = combined.lower()
    score = 0.0
    hits: list[str] = []

    weak_hits = [kw for kw in weak_keywords() if kw.lower() in lowered]
    if weak_hits:
        score += min(len(weak_hits), WEAK_KEYWORD_CAP) * WEAK_KEYWORD_POINTS
        hits.append(f"{len(weak_hits)} weak keyword(s): {', '.join(weak_hits[:5])}")

    strong_hits = [kw for kw in strong_keywords() if kw.lower() in lowered]
    for kw in strong_hits:
        score += STRONG_PATTERN_POINTS
        hits.append(f"strong keyword: {kw}")

    for pattern, label in _STRONG_PATTERNS:
        if pattern.search(combined):
            score += STRONG_PATTERN_POINTS
            hits.append(label)

    if _PRICE_PAIR.search(combined):
        score += PRICE_PAIR_POINTS
        hits.append("price-comparison-pair")

    if _COUPON_CODE.search(combined):
        score += COUPON_CODE_POINTS
        hits.append("coupon-code")

    if score >= HIGH_THRESHOLD:
        status = ELIGIBLE
    elif score >= MEDIUM_THRESHOLD:
        status = NEEDS_REVIEW
    else:
        status = NOT_SALE_RELATED

    reason = "; ".join(hits) if hits else "no sale-related signals found"
    return SaleRelevance(round(score, 2), status, reason[:500])
