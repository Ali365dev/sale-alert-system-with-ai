"""Keyword-matches scraped page text into a category + optional subcategory.

No AI call — mirrors the same style of matching dealplusApp/src/utils/
dealAdapters.js's CATEGORY_ICONS/CATEGORY_IMAGE_QUERIES already does
client-side (same category vocabulary), just run here against real scraped
website text instead of an offer's stored category string.
"""
SOURCE = "website_metadata"

_CATEGORY_KEYWORDS = {
    "Fashion": ("fashion", "apparel", "clothing", "boutique", "couture", "wear", "outfit"),
    "Electronics": ("electronic", "software", "tech", "gadget", "computer", "mobile phone", "smartphone"),
    "Beauty": ("beauty", "cosmetic", "skincare", "makeup", "fragrance", "perfume"),
    "Food": ("restaurant", "grocery", "cafe", "bakery", "cuisine", "kitchen", "food"),
    "Travel": ("travel", "tourism", "hotel", "airline", "vacation", "tour"),
    "Sport": ("sport", "fitness", "gym", "athletic", "workout"),
    "Home": ("furniture", "home décor", "home decor", "interior design", "homeware"),
    "Gaming": ("gaming", "esports", "console", "video game"),
}

_SUBCATEGORY_KEYWORDS = {
    "Fashion": {
        "Footwear": ("shoe", "shoes", "sneaker", "footwear", "boot", "sandal"),
        "Accessories": ("bag", "jewelry", "jewellery", "watch", "accessory", "accessories"),
        "Apparel": ("dress", "shirt", "clothing", "apparel", "jacket", "denim"),
    },
    "Electronics": {
        "Mobile & Accessories": ("smartphone", "mobile phone", "phone case", "charger"),
        "Computers": ("laptop", "computer", "pc ", "desktop"),
    },
    "Food": {
        "Restaurant": ("restaurant", "dine", "dining", "menu"),
        "Grocery": ("grocery", "supermarket", "grocer"),
    },
}


def detect_category(text: str) -> dict:
    """`text` should already combine title + description + visible page text.
    Returns the best single category (for compat) plus all matched categories
    ranked by hit count. Falls back to ["General"] when nothing matches."""
    lowered = f" {(text or '').lower()} "

    scores: list[tuple[int, str]] = []
    for category, keywords in _CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in lowered)
        if hits:
            scores.append((hits, category))

    scores.sort(reverse=True)
    matched = [cat for _, cat in scores]
    best_hits = scores[0][0] if scores else 0
    best_category = scores[0][1] if scores else "General"

    subcategory = None
    if best_category in _SUBCATEGORY_KEYWORDS:
        best_sub, best_sub_hits = None, 0
        for sub, keywords in _SUBCATEGORY_KEYWORDS[best_category].items():
            hits = sum(1 for kw in keywords if kw in lowered)
            if hits > best_sub_hits:
                best_sub, best_sub_hits = sub, hits
        subcategory = best_sub

    confidence = min(1.0, 0.3 + 0.15 * best_hits) if best_hits else 0.0

    return {
        "category": best_category,
        "categories": matched if matched else ["General"],
        "subcategory": subcategory,
        "source": SOURCE if best_hits else None,
        "confidence": round(confidence, 2),
    }
