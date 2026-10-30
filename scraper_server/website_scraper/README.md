# Isolated So Kamal website scraper lab

This folder is **not** part of the dashboard application. It only tests which HTTP/browser method can extract sale and product data from:

```text
https://www.sokamal.com/
```

Do not wire this into the API, database, jobs, OCR, or AI pipeline.

## Install

Use a **separate** virtualenv:

```bash
cd website_scraper
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python -m camoufox fetch
```

Optional: change `MAX_PAGES` and `REQUEST_DELAY_SECONDS` in `config.py`.

## Run one test

```bash
source .venv/bin/activate
python httpx_selectolax_scraper.py
python scrapling_scraper.py
python camoufox_scraper.py
python scrapy_scraper.py
python playwright_scraper.py
```

## Run all tests

```bash
source .venv/bin/activate
python run_all_tests.py
```

Each run writes the full extract to `payloads/<scraper>.json` (gitignored).

A failed scraper does not stop the rest. Scrapy is an HTTP crawler only. Sale detection here is keyword + price comparison, not the production AI pipeline.

Requests skip cart/checkout/account paths listed in `config.py` and Scrapy obeys `robots.txt`.
