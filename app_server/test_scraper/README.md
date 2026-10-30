# Isolated scraper probes

This folder is **not** part of the dashboard application. It only answers: can a given library fetch useful public data from two live profiles?

- Facebook: https://www.facebook.com/SoKamalOfficial
- Instagram: https://www.instagram.com/beechtree_pk/

Do not wire this into the API, database, jobs, OCR, or AI pipeline.

## Install

Use a **separate** virtualenv so the main app is untouched:

```bash
cd test_scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python -m camoufox fetch
scrapling install
```

Optional `.env` (see `.env.example`):

```bash
export APIFY_TOKEN=...          # required for Apify tests
export FACEBOOK_COOKIES_FILE=...  # optional Netscape file for facebook-scraper
```

`run_all_tests.py` will also read `APIFY_API_TOKEN` from a parent `.env` and expose it as `APIFY_TOKEN` if `APIFY_TOKEN` is unset.

## Run one test

```bash
source .venv/bin/activate
python httpx_selectolax_facebook.py
python httpx_selectolax_instagram.py
python scrapling_facebook.py
python scrapling_instagram.py
python camoufox_facebook.py
python camoufox_instagram.py
python scrapy_facebook.py
python scrapy_instagram.py
python playwright_facebook.py
python playwright_instagram.py
python facebook_scraper_test.py
python apify_facebook.py
python apify_instagram.py
```

## Run all tests

```bash
source .venv/bin/activate
python run_all_tests.py
```

A failed probe does not stop the rest. Scrapy is included only as a raw HTTP crawler — it is not a Facebook/Instagram scraper.
