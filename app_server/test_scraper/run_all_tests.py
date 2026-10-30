#!/usr/bin/env python3
"""Run every isolated scraper probe. One failure does not stop the rest."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

TESTS = [
    ("httpx + selectolax", "Facebook", "httpx_selectolax_facebook.py", 60),
    ("httpx + selectolax", "Instagram", "httpx_selectolax_instagram.py", 60),
    ("Scrapling", "Facebook", "scrapling_facebook.py", 180),
    ("Scrapling", "Instagram", "scrapling_instagram.py", 180),
    ("Camoufox", "Facebook", "camoufox_facebook.py", 180),
    ("Camoufox", "Instagram", "camoufox_instagram.py", 180),
    ("Scrapy", "Facebook", "scrapy_facebook.py", 90),
    ("Scrapy", "Instagram", "scrapy_instagram.py", 90),
    ("Playwright", "Facebook", "playwright_facebook.py", 120),
    ("Playwright", "Instagram", "playwright_instagram.py", 120),
    ("facebook-scraper", "Facebook", "facebook_scraper_test.py", 90),
    ("Apify", "Facebook", "apify_facebook.py", 240),
    ("Apify", "Instagram", "apify_instagram.py", 240),
]


def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parent / ".env")
    if not os.environ.get("APIFY_TOKEN") and os.environ.get("APIFY_API_TOKEN"):
        os.environ["APIFY_TOKEN"] = os.environ["APIFY_API_TOKEN"]


def _parse(output: str) -> tuple[str, float]:
    status_match = re.search(r"^Status:\s+(\S+)", output, re.M)
    time_match = re.search(r"Execution time:\s+([0-9.]+)\s+seconds", output)
    status = status_match.group(1) if status_match else "FAILED"
    elapsed = float(time_match.group(1)) if time_match else 0.0
    return status, elapsed


def main() -> int:
    _load_env()
    python = sys.executable
    rows = []
    print("Running isolated scraper probes…\n")
    for method, platform, script, timeout in TESTS:
        path = ROOT / script
        print(f"--- {method} / {platform} ({script}) ---")
        try:
            proc = subprocess.run(
                [python, str(path)],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=os.environ.copy(),
            )
            output = (proc.stdout or "") + (("\n" + proc.stderr) if proc.stderr else "")
            print(proc.stdout or "")
            if proc.stderr:
                print(proc.stderr, file=sys.stderr)
            status, elapsed = _parse(output)
            if status not in ("SUCCESS", "FAILED", "NOT APPLICABLE") and proc.returncode != 0:
                status = "FAILED"
                if elapsed == 0.0:
                    elapsed = 0.0
        except subprocess.TimeoutExpired:
            status, elapsed = "FAILED", float(timeout)
            print(f"Status: FAILED\nReason:\nTimed out after {timeout}s\n")
        except Exception as exc:
            status, elapsed = "FAILED", 0.0
            print(f"Status: FAILED\nReason:\n{type(exc).__name__}: {exc}\n")
        rows.append((method, platform, status, elapsed))
        print()

    print("=" * 61)
    print("FINAL SCRAPER TEST RESULTS")
    print("=" * 61)
    print()
    print(f"{'METHOD':<26} {'PLATFORM':<13} {'RESULT':<12} {'TIME'}")
    print("-" * 61)
    for method, platform, status, elapsed in rows:
        print(f"{method:<26} {platform:<13} {status:<12} {elapsed:.1f}s")
    print("=" * 61)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
