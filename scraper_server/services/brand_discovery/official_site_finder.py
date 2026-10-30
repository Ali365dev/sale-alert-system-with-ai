"""Method 1 (Search Brand): finds candidate official websites for a brand
name — free DuckDuckGo search only (same `ddgs` lib ai/search_provider.py
already uses), no LLM disambiguation. Filters out encyclopedias, social
platforms, marketplaces, and review/directory sites, which DuckDuckGo
results are otherwise full of for any well-known brand name.
"""
from config import logger
from services.brand_discovery.category_detector import detect_category
from services.brand_discovery.crawler import domain_of, fetch_page
from services.brand_discovery.logo_extractor import extract_logo
from services.brand_discovery.website_info_extractor import extract_description, extract_name

MAX_CANDIDATES = 5

# Never the brand's own official site, however highly it ranks for the
# brand's name — encyclopedias, social platforms, marketplaces/directories,
# app stores, and generic review/news sites.
NON_OFFICIAL_DOMAINS = {
    "wikipedia.org", "en.wikipedia.org",
    "facebook.com", "instagram.com", "tiktok.com", "twitter.com", "x.com", "youtube.com", "linkedin.com",
    "amazon.com", "ebay.com", "etsy.com", "walmart.com", "aliexpress.com",
    "yelp.com", "glassdoor.com", "crunchbase.com", "indeed.com", "tripadvisor.com", "trustpilot.com",
    "reddit.com", "pinterest.com", "quora.com",
    "apps.apple.com", "play.google.com", "g.co", "google.com", "maps.google.com",
    "bloomberg.com", "forbes.com", "businessinsider.com", "nytimes.com", "wsj.com",
}


def _is_official_candidate_domain(domain: str) -> bool:
    if not domain:
        return False
    return not any(domain == d or domain.endswith(f".{d}") for d in NON_OFFICIAL_DOMAINS)


def _search(brand_name: str) -> list[dict]:
    try:
        from ddgs import DDGS
    except ImportError:
        logger.error("ddgs not installed — run: pip install ddgs")
        return []

    queries = [f"{brand_name} official website", brand_name]
    seen_domains: set[str] = set()
    hits: list[dict] = []

    try:
        with DDGS() as ddgs:
            for query in queries:
                if len(hits) >= MAX_CANDIDATES:
                    break
                try:
                    results = ddgs.text(query, max_results=8) or []
                except Exception as exc:
                    logger.warning("Brand discovery search query %r failed: %s", query, exc)
                    continue
                for r in results:
                    url = (r.get("href") or "").strip()
                    if not url:
                        continue
                    domain = domain_of(url)
                    if not domain or domain in seen_domains or not _is_official_candidate_domain(domain):
                        continue
                    seen_domains.add(domain)
                    hits.append({"url": url, "title": (r.get("title") or "").strip(), "snippet": (r.get("body") or "").strip()})
                    if len(hits) >= MAX_CANDIDATES:
                        break
    except Exception as exc:
        logger.error("Brand discovery DDGS session failed for brand=%r: %s", brand_name, exc)

    return hits


def search_candidates(brand_name: str) -> list[dict]:
    """Returns up to MAX_CANDIDATES candidate brand profiles for the admin's
    picker list: [{name, website, domain, logo_url, description, category,
    source}]. Each candidate gets a shallow single-page fetch of its
    homepage (not the full home+about+contact crawl — that only happens
    once the admin picks one, via services/brand_discovery/pipeline.py)."""
    candidates = []
    for hit in _search(brand_name):
        domain = domain_of(hit["url"])
        home = fetch_page(hit["url"])

        if home is None:
            # Site unreachable right now — still worth showing so the admin
            # isn't blocked by a transient fetch failure; category/logo just
            # stay unknown, description falls back to the search snippet.
            candidates.append({
                "name": hit["title"] or domain, "website": hit["url"], "domain": domain,
                "logo_url": None, "description": hit["snippet"][:300] or None,
                "category": "General", "source": "search_result",
            })
            continue

        name = extract_name(home)["value"] or hit["title"] or domain
        description = extract_description(home)["value"] or hit["snippet"][:300] or None
        logo_url = extract_logo(home)["value"]
        category = detect_category(f"{name} {description or ''} {home.text}")["category"]

        candidates.append({
            "name": name, "website": home.url, "domain": domain,
            "logo_url": logo_url, "description": description, "category": category,
            "source": "search_result",
        })

    return candidates
