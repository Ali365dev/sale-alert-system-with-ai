#!/usr/bin/env python3
"""Run every isolated So Kamal website scraper. One failure does not stop the rest."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

TESTS = [
    ("HTTPX + Selectolax", "httpx_selectolax_scraper.py", 180),
    ("Scrapling", "scrapling_scraper.py", 180),
    ("Camoufox", "camoufox_scraper.py", 240),
    ("Scrapy", "scrapy_scraper.py", 180),
    ("Playwright", "playwright_scraper.py", 240),
]


def _parse(output: str) -> dict:
    status_match = re.search(r"^Status:\s+(\S+)", output, re.M)
    time_match = re.search(r"Execution time:\s+([0-9.]+)\s+seconds", output)
    marker = output.rfind("RESULT_JSON")
    payload = {}
    if marker >= 0:
        raw = output[marker + len("RESULT_JSON") :].strip()
        try:
            payload = json.loads(raw.splitlines()[0] if raw.startswith("{") else raw)
        except json.JSONDecodeError:
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {}
    return {
        "status": status_match.group(1) if status_match else "FAILED",
        "elapsed": float(time_match.group(1)) if time_match else float(payload.get("execution_time_seconds") or 0),
        "signals": int(payload.get("sale_signal_count") or len(payload.get("sale_signals") or [])),
        "products": int(payload.get("product_count") or len(payload.get("products") or [])),
        "pages": payload.get("pages_checked"),
        "structured": payload.get("structured_data_found"),
    }


def main() -> int:
    python = sys.executable
    if len(sys.argv) > 1:
        os.environ["WEBSITE_TARGET_URL"] = sys.argv[1]
    target = os.environ.get("WEBSITE_TARGET_URL") or "https://www.sokamal.com/"
    env = os.environ.copy()
    env["WEBSITE_TARGET_URL"] = target
    rows = []
    print(f"Running isolated website scrapers for {target}\n")
    for method, script, timeout in TESTS:
        path = ROOT / script
        print(f"--- {method} ({script}) ---")
        try:
            proc = subprocess.run(
                [python, str(path)],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env,
            )
            output = (proc.stdout or "") + (("\n" + proc.stderr) if proc.stderr else "")
            print(proc.stdout or "")
            if proc.stderr:
                print(proc.stderr, file=sys.stderr)
            parsed = _parse(output)
            if parsed["status"] not in ("SUCCESS", "FAILED") and proc.returncode != 0:
                parsed["status"] = "FAILED"
        except subprocess.TimeoutExpired:
            parsed = {"status": "FAILED", "elapsed": float(timeout), "signals": 0, "products": 0, "pages": 0, "structured": False}
            print(f"Status: FAILED\nReason:\nTimed out after {timeout}s\n")
        except Exception as extra:
            parsed = {"status": "FAILED", "elapsed": 0.0, "signals": 0, "products": 0, "pages": 0, "structured": False}
            print(f"Status: FAILED\nReason:\n{type(extra).__name__}: {extra}\n")
        rows.append((method, parsed))
        print()

    print("=" * 64)
    print(f"WEBSITE SCRAPER TEST RESULTS  {target}")
    print("=" * 64)
    print()
    print(f"{'METHOD':<22} {'STATUS':<10} {'SALE SIGNALS':<14} {'PRODUCTS':<10} {'TIME'}")
    print("-" * 64)
    for method, parsed in rows:
        print(
            f"{method:<22} {parsed['status']:<10} {parsed['signals']:<14} {parsed['products']:<10} {parsed['elapsed']:.1f}s"
        )
    print("=" * 64)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
