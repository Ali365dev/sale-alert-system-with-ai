"""
Builds the LLM prompt from brand metadata and search result snippets.
No raw HTML — only titles, snippets, and URLs are included.
"""
from services.settings_service import get_prompt

PROMPT_KEY = "brand_research_duckduckgo"

_PROMPT = """\
You are an e-commerce promotion research assistant.

For the given brand, determine whether there are any currently active promotions
based on the search results provided below.

Brand: {brand_name}
Website: {website}
Categories: {categories}
Today: {today}

--- SEARCH RESULTS ---
{search_block}
--- END SEARCH RESULTS ---

Based on the search results above, identify all currently active promotions for {brand_name}.

Find:
- Active sale / discount
- Coupon or promo code
- Clearance or end-of-season sale
- Flash sale
- Free shipping offer
- Student discount
- Membership / loyalty offer
- Bundle deal
- Buy One Get One (BOGO)
- Gift with purchase
- Cashback
- First order discount

Rules:
- Ignore expired promotions (today is {today}).
- If no active promotion is found, return one entry with is_sale=false and offer_type="no_sale".
- Base confidence on how clearly the search results confirm the promotion.
- Your entire response MUST be a single valid JSON object starting with {{ and ending with }}.
- Do NOT include any text, explanation, or markdown before or after the JSON.
- Do NOT wrap the JSON in ```json``` code fences.

Return exactly this schema:
{{
  "offers": [
    {{
      "brand": "{brand_name}",
      "title": "<short offer title>",
      "description": "<one sentence describing the promotion>",
      "discount_percentage": <number 0-100 or null>,
      "coupon_code": <"CODE" or null>,
      "offer_type": "<percentage_discount | flat_discount | bogo | free_shipping | bundle | clearance | student_discount | member_only | cashback | gift_with_purchase | first_order | flash_sale | seasonal | no_sale>",
      "is_sale": <true | false>,
      "free_shipping": <true | false>,
      "student_discount": <true | false>,
      "member_only": <true | false>,
      "start_date": <"YYYY-MM-DD" or null>,
      "end_date": <"YYYY-MM-DD" or null>,
      "url": "<most relevant URL from search results>",
      "confidence": <0.0–1.0>,
      "source": "ai"
    }}
  ]
}}
"""


def _format_search_block(search_results: list[dict]) -> str:
    if not search_results:
        return "(no search results available)"
    lines = []
    for i, r in enumerate(search_results, 1):
        lines.append(f"[{i}] {r.get('title', '')}")
        if r.get("snippet"):
            lines.append(f"    {r['snippet']}")
        if r.get("url"):
            lines.append(f"    URL: {r['url']}")
        lines.append("")
    return "\n".join(lines).strip()


def build(brand: dict, search_results: list[dict], today: str) -> str:
    """
    Build the full LLM prompt.

    Args:
        brand:          Brand dict with name, website, categories.
        search_results: List of {title, snippet, url} from search_provider.
        today:          Today's date string "YYYY-MM-DD".

    Returns:
        Complete prompt string ready to send to the LLM.
    """
    categories = ", ".join(brand.get("categories") or []) or "General"
    template = get_prompt(PROMPT_KEY, default=_PROMPT)
    return template.format(
        brand_name=brand["name"],
        website=brand.get("website", "N/A"),
        categories=categories,
        today=today,
        search_block=_format_search_block(search_results),
    )
