"""
Prompt templates for the research module.
"""
from datetime import datetime, timezone

from services.settings_service import get_prompt

PROMPT_KEY = "brand_research_tavily"

_PROMPT = """\
You are a JSON-only offer extraction engine. Today is {today}.

Analyse the search results below for {brand_name} and extract all active retail promotions, sales, discounts, or coupon codes.

Return ONLY a valid JSON object. No markdown. No explanation. No extra text.

Required JSON schema:
{{
  "offers": [
    {{
      "brand": "{brand_name}",
      "title": "<short offer title, e.g. 'Summer Sale 30% Off'>",
      "description": "<one sentence describing the promotion>",
      "discount_percentage": <number 0-100 or null>,
      "coupon_code": <"CODE" or null>,
      "offer_type": "<one of: percentage_discount | flat_discount | bogo | free_shipping | bundle | clearance | student_discount | member_only | cashback | gift_with_purchase | first_order | flash_sale | seasonal | no_sale>",
      "is_sale": <true | false>,
      "free_shipping": <true | false>,
      "student_discount": <true | false>,
      "member_only": <true | false>,
      "start_date": <"YYYY-MM-DD" or null>,
      "end_date": <"YYYY-MM-DD" or null>,
      "url": "<most relevant URL from search results for this offer>",
      "confidence": <0.0 to 1.0>,
      "source": "research"
    }}
  ]
}}

Rules:
- Return {{"offers": []}} if no real offers are found.
- Do NOT fabricate coupon codes. Only include codes explicitly mentioned in the results.
- discount_percentage must be a number between 0-100 or null.
- end_date must be YYYY-MM-DD format or null. Infer year as {today_year} if only month/day is given.
- confidence: 1.0 = code/percentage explicitly stated; 0.7 = sale mentioned without specific discount; 0.4 = uncertain.
- is_sale must be true only if there is an active, current promotion.
- Output ONLY the JSON object. Nothing else.

--- SEARCH RESULTS FOR {brand_name_upper} ---
{results_text}
--- END SEARCH RESULTS ---"""


def build_search_query(brand_name: str) -> str:
    """Generate a rich Tavily search query for a brand's current offers."""
    return (
        f"{brand_name} Pakistan "
        "Official Website "
        "Current Sale Discount Offer "
        "Coupon Promo Code "
        "Flash Sale Clearance Sale "
        "Limited Time Offer "
        "Latest Promotions 2025"
    )


def build_llm_prompt(brand_name: str, tavily_response: dict) -> str:
    """
    Build the full prompt sent to local Llama.
    The entire Tavily response is embedded so the LLM can extract offers.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Format Tavily results into a readable block
    results = tavily_response.get("results", [])
    results_text = ""
    for i, r in enumerate(results, 1):
        results_text += (
            f"\n[Result {i}]\n"
            f"Title:   {r.get('title', '')}\n"
            f"URL:     {r.get('url', '')}\n"
            f"Content: {r.get('content', '')}\n"
        )

    if not results_text:
        results_text = "(no search results available)"

    template = get_prompt(PROMPT_KEY, default=_PROMPT)
    return template.format(
        today=today,
        today_year=today[:4],
        brand_name=brand_name,
        brand_name_upper=brand_name.upper(),
        results_text=results_text,
    )
