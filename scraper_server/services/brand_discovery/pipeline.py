"""Orchestrates one Brand Discovery run: given a BrandDiscovery row already
created (services/jobs/brand_discovery.py's collect_work), crawls the site,
extracts logo/description/category/socials, checks for a possible
duplicate, and writes every result onto that row.

Zero AI/LLM calls and zero paid search API — pure web scraping +
deterministic heuristics, by design (this feature's explicit scope: "no
price, just scrape the website and get brand information").
"""
import json
from datetime import datetime, timezone

from database.db import get_session
from database.models import BrandDiscovery
from services import job_service
from services.brand_discovery.category_detector import detect_category
from services.brand_discovery.crawler import crawl_site
from services.brand_discovery.duplicate_detector import find_brand_duplicate
from services.brand_discovery.logo_extractor import extract_logo
from services.brand_discovery.social_link_extractor import extract_social_links
from services.brand_discovery.website_info_extractor import extract_country, extract_description, extract_name


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def run(job_id: int, discovery_id: int) -> str:
    """Returns "successful" | "failed" — a BackgroundJob.process_item outcome."""
    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is None:
            return "failed"
        website = row.website
        seed_name = row.name
        row.status = "discovering"

    # crawl_site() fetches (and by succeeding, verifies the reachability of)
    # the homepage plus an about/contact page if either can be found —
    # covers both "identifying the official website" and the initial half
    # of "extracting website information" in one call.
    job_service.set_stage(job_id, "identifying_website")
    pages = crawl_site(website)
    home = pages.get("home")

    if home is None:
        with get_session() as session:
            row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
            if row is not None:
                row.status = "failed"
                row.error = "Could not reach that website — check the URL and try again."
        return "failed"

    job_service.set_stage(job_id, "extracting_website_info")
    name_result = extract_name(home)
    description_result = extract_description(home)
    country_result = extract_country(home)
    category_result = detect_category(f"{name_result['value']} {description_result['value'] or ''} {home.text}")

    job_service.set_stage(job_id, "finding_logo")
    logo_result = extract_logo(home)

    job_service.set_stage(job_id, "discovering_social_accounts")
    social_links = extract_social_links(pages)

    # Verification is folded into the extractors' own filtering (social_link_
    # extractor's share-button/generic-page exclusion, official_site_finder's
    # domain blocklist for Method 1) — this stage exists for progress-UI
    # visibility, nothing further to compute here.
    job_service.set_stage(job_id, "verifying_results")

    job_service.set_stage(job_id, "checking_duplicates")
    final_name = seed_name or name_result["value"]
    duplicate_brand_id, duplicate_score, duplicate_reason = find_brand_duplicate(final_name, home.url, social_links)

    field_sources = {
        "name": "official_website" if seed_name else (name_result["source"] or "manual_entry"),
        "website": "official_website",
        "logo_url": logo_result["source"],
        "description": description_result["source"],
        "category": category_result["source"],
        "subcategory": category_result["source"],
        "country": country_result["source"],
    }

    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is None:
            return "failed"
        row.name = final_name
        row.website = home.url
        row.logo_url = logo_result["value"]
        row.description = description_result["value"]
        row.category = category_result["category"]
        row.subcategory = category_result["subcategory"]
        row.country = country_result["value"]
        row.field_sources = json.dumps(field_sources)
        row.social_links = json.dumps(social_links)
        row.confidence = category_result["confidence"]
        row.duplicate_brand_id = duplicate_brand_id
        row.duplicate_score = duplicate_score
        row.duplicate_reason = duplicate_reason
        row.status = "review"
        row.updated_at = _utcnow()

    return "successful"
