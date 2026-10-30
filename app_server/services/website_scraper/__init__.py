"""Website Sale Scraper — HTTPX+Selectolax fetch/parse of a brand's own
website (sale/offers/promotions pages) to detect and create Offers with
source="website". See services.py for the pipeline entrypoint.

Kept entirely separate from services/social_scraper/ (Facebook/Instagram) and
ai/analyzer.py (Gmail) — same "don't couple independent call sites"
convention used throughout this codebase.

The isolated research spike at the repo root (`website_scraper/`, its own
venv) validated the fetch/extraction approach against real storefronts before
this package existed; see that folder's README. This package ports the
validated logic (crawl prioritization, HTML/structured-data extraction,
rule-based sale detection, compact AI payload) into the production
architecture — it does not import from that lab folder."""
