"""Stdout format for isolated website scraper tests."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ai_brief import ai_brief
PAYLOAD_DIR = ROOT / "payloads"


def emit(result: dict[str, Any]) -> int:
    status = (result.get("status") or "failed").upper()
    elapsed = float(result.get("execution_time_seconds") or 0.0)
    payload_path = _write_payload(result)
    brief = ai_brief(result)
    brief_path = payload_path.with_name(payload_path.stem + "_brief.json")
    brief_path.write_text(json.dumps(brief, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print("=" * 48)
    print(f"SCRAPER: {result.get('scraper')}")
    print(f"URL: {result.get('url')}")
    print("=" * 48)
    print()
    print(f"Status: {status}")
    print()
    if status == "SUCCESS":
        print("Data extracted:")
        print(f"- Pages checked: {result.get('pages_checked')}")
        print(f"- Sale signals: {result.get('sale_signal_count', len(result.get('sale_signals') or []))}")
        print(f"- Products: {result.get('product_count', len(result.get('products') or []))}")
        print(f"- Structured data found: {result.get('structured_data_found')}")
        products = result.get("products") or []
        if products:
            sample = products[0]
            print(f"- Sample product: {sample.get('name')} @ {sample.get('current_price')} (was {sample.get('original_price')})")
        if result.get("notes"):
            print(f"- Notes: {result['notes']}")
    else:
        print("Reason:")
        print(result.get("reason") or "No useful data extracted")
        if result.get("notes"):
            print(f"Notes: {result['notes']}")
    print()
    print(f"Execution time: {elapsed:.1f} seconds")
    print(f"JSON payload: {payload_path}")
    print(f"AI brief (use this for LLM): {brief_path}")
    print()
    print("RESULT_JSON")
    print(json.dumps(brief, ensure_ascii=False, default=str))
    return 0 if status == "SUCCESS" else 1


def _write_payload(result: dict[str, Any]) -> Path:
    from urllib.parse import urlparse

    PAYLOAD_DIR.mkdir(exist_ok=True)
    name = str(result.get("scraper") or "unknown").replace(" ", "_")
    host = urlparse(str(result.get("url") or "")).netloc.replace("www.", "") or "site"
    path = PAYLOAD_DIR / f"{host}_{name}.json"
    path.write_text(json.dumps(compact_payload(result), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return path


def compact_payload(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "scraper": result.get("scraper"),
        "url": result.get("url"),
        "status": result.get("status"),
        "execution_time_seconds": result.get("execution_time_seconds"),
        "pages_checked": result.get("pages_checked"),
        "sale_signals": result.get("sale_signals") or [],
        "products": result.get("products") or [],
        "product_count": result.get("product_count"),
        "structured_data_found": result.get("structured_data_found"),
        "reason": result.get("reason"),
    }
