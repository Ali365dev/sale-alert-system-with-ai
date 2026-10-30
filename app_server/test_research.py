"""
Test Tavily + Llama research pipeline for a single brand.

Run:
    python test_research.py
    python test_research.py --brand "Nike"
    python test_research.py --brand "Bata" --no-llama   # Tavily only
    python test_research.py --brand "Bata" --no-save    # skip Supabase write
"""
import sys
import argparse
from pathlib import Path

# Project root on path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from research.config import TAVILY_API_KEY, OLLAMA_MODEL
from research.tavily_client import TavilyClient
from research.llama_processor import LlamaProcessor
from research.supabase_service import SupabaseService
from research.models import BrandRecord
from research.prompts import build_search_query

SEP = "-" * 60


def test_tavily(brand_name: str) -> dict | None:
    print(f"\n{SEP}")
    print(f"STEP 1 — TAVILY SEARCH")
    print(f"Brand : {brand_name}")
    print(f"Query : {build_search_query(brand_name)}")
    print(SEP)

    if not TAVILY_API_KEY:
        print("✗ TAVILY_API_KEY not set in .env — cannot search.")
        return None

    try:
        client = TavilyClient()
        response = client.search(brand_name)

        results = response.get("results", [])
        print(f"\n✓ Tavily returned {len(results)} result(s)\n")

        for i, r in enumerate(results, 1):
            print(f"  [{i}] {r.get('title', '(no title)')}")
            print(f"       URL    : {r.get('url', '')}")
            print(f"       Snippet: {str(r.get('content', ''))[:200]}")
            print()

        return response

    except Exception as exc:
        print(f"\n✗ Tavily error: {exc}")
        return None


def test_llama(brand_name: str, tavily_response: dict) -> list:
    print(f"\n{SEP}")
    print(f"STEP 2 — LOCAL LLAMA PROCESSING  (model: {OLLAMA_MODEL})")
    print(SEP)

    try:
        processor = LlamaProcessor()
        offers = processor.process(brand_name, tavily_response)

        if not offers:
            print("\n✗ No offers extracted (empty list).")
            return []

        print(f"\n✓ Extracted {len(offers)} offer(s)\n")
        for i, o in enumerate(offers, 1):
            print(f"  [{i}] {o.title}")
            print(f"       Type       : {o.offer_type}")
            print(f"       Discount   : {f'{o.discount_percentage:.0f}%' if o.discount_percentage else '—'}")
            print(f"       Coupon     : {o.coupon_code or '—'}")
            print(f"       Is sale    : {o.is_sale}")
            print(f"       Expires    : {o.end_date or '—'}")
            print(f"       Confidence : {o.confidence:.0%}")
            print(f"       URL        : {o.url or '—'}")
            print(f"       Description: {o.description[:120] if o.description else '—'}")
            print()

        return offers

    except Exception as exc:
        print(f"\n✗ Llama processing error: {exc}")
        import traceback
        traceback.print_exc()
        return []


def test_save(brand_name: str, offers: list):
    print(f"\n{SEP}")
    print(f"STEP 3 — SAVE TO SUPABASE")
    print(SEP)

    try:
        db = SupabaseService()

        # Try to find the brand in Supabase to get its full record
        brands = db.get_active_brands()
        brand_record = next((b for b in brands if b.name.lower() == brand_name.lower()), None)

        if brand_record is None:
            # Brand not found in DB — create a minimal record just for testing
            print(f"\n⚠  Brand {brand_name!r} not found in Supabase. Using a test record (nothing will break).")
            brand_record = BrandRecord(id=0, name=brand_name, website="", categories=[])

        inserted, updated, failed = 0, 0, 0
        for offer in offers:
            status = db.save_offer(brand_record, offer)
            if status == "inserted":
                inserted += 1
            elif status == "updated":
                updated += 1
            else:
                failed += 1

        print(f"\n✓ Done — inserted: {inserted}  updated: {updated}  failed: {failed}")

    except Exception as exc:
        print(f"\n✗ Supabase error: {exc}")
        import traceback
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description="Test research pipeline for one brand")
    parser.add_argument("--brand",   default="Bata Pakistan", help="Brand name to research")
    parser.add_argument("--no-llama", action="store_true",    help="Stop after Tavily (skip Llama)")
    parser.add_argument("--no-save",  action="store_true",    help="Skip saving to Supabase")
    args = parser.parse_args()

    brand_name = args.brand

    print(f"\n{'=' * 60}")
    print(f"  Research Test — {brand_name}")
    print(f"{'=' * 60}")

    # Step 1: Tavily
    tavily_response = test_tavily(brand_name)
    if tavily_response is None:
        print("\nStopping — Tavily failed.")
        sys.exit(1)

    if args.no_llama:
        print("\n[--no-llama] Stopping after Tavily.")
        sys.exit(0)

    # Step 2: Llama
    offers = test_llama(brand_name, tavily_response)
    if not offers:
        print("\nStopping — no offers extracted.")
        sys.exit(0)

    if args.no_save:
        print("\n[--no-save] Skipping Supabase write.")
        sys.exit(0)

    # Step 3: Save
    test_save(brand_name, offers)

    print(f"\n{'=' * 60}")
    print("  Done.")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
