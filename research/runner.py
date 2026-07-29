"""
Research runner — orchestrates the full pipeline for every active brand.

Execution flow (strictly one brand at a time):

    Fetch brands from Supabase
        ↓
    For each brand:
        Search Tavily
            ↓
        Send to Local Llama
            ↓
        Validate JSON
            ↓
        Check existing offers
            ↓
        Insert or Update Supabase
            ↓
        Move to next brand

Run:
    python research/runner.py
    python -m research.runner
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is on sys.path (needed when run directly)
_ROOT = Path(__file__).parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from research.config import TAVILY_API_KEY, logger
from research.llama_processor import LlamaProcessor
from research.models import BrandRecord, ResearchResult
from research.supabase_service import SupabaseService
from research.tavily_client import TavilyClient
from research.utils import separator


class ResearchRunner:
    """
    Orchestrates the full Tavily → Llama → Supabase pipeline.
    Processes exactly one brand at a time.
    Never raises — all errors are caught and logged.
    """

    def __init__(self) -> None:
        self._db = SupabaseService()
        self._tavily = TavilyClient()
        self._llama = LlamaProcessor()

    # ── Single brand ──────────────────────────────────────────────────────────

    def _process_brand(self, brand: BrandRecord) -> ResearchResult:
        result = ResearchResult(brand_id=brand.id, brand_name=brand.name)

        # ── Step 1: Tavily search ─────────────────────────────────────────────
        logger.info("Searching %r via Tavily …", brand.name)
        try:
            tavily_response = self._tavily.search(brand.name)
        except Exception as exc:
            logger.error("Tavily failed for %r — skipping. Error: %s", brand.name, exc)
            result.error = f"Tavily error: {exc}"
            return result

        logger.info("Tavily completed for %r.", brand.name)

        # ── Step 2: Local Llama processing ────────────────────────────────────
        logger.info("Processing %r with Local Llama …", brand.name)
        offers = self._llama.process(brand.name, tavily_response)
        result.offers_found = len(offers)

        if not offers:
            logger.info("No offers found for %r.", brand.name)
            return result

        logger.info("Found %d offer(s) for %r.", len(offers), brand.name)

        # ── Step 3: Save each offer individually ──────────────────────────────
        logger.info("Checking duplicates and saving to Supabase …")
        for offer in offers:
            try:
                status = self._db.save_offer(brand, offer)
                if status == "inserted":
                    result.inserted += 1
                elif status == "updated":
                    result.updated += 1
                else:
                    result.skipped += 1
            except Exception as exc:
                logger.error(
                    "  ✗ Unexpected error saving offer %r for brand %r: %s",
                    offer.title, brand.name, exc,
                )
                result.skipped += 1

        return result

    # ── Full run ──────────────────────────────────────────────────────────────

    def run(self) -> list[ResearchResult]:
        """
        Run the research pipeline for all active brands — one at a time.
        Returns a list of ResearchResult (one per brand).
        """
        start = datetime.now(timezone.utc)

        logger.info(separator("RESEARCH STARTED"))
        logger.info("Fetching brands …")

        brands = self._db.get_active_brands()
        if not brands:
            logger.warning("No active brands found in Supabase. Exiting.")
            return []

        logger.info("Processing %d brand(s) — one at a time.\n", len(brands))

        results: list[ResearchResult] = []

        for i, brand in enumerate(brands, 1):
            logger.info(separator(f"{brand.name}  [{i}/{len(brands)}]"))

            result = self._process_brand(brand)
            results.append(result)

            # Summary for this brand
            if result.success:
                logger.info(
                    "Finished %r — found=%d  inserted=%d  updated=%d  skipped=%d",
                    brand.name,
                    result.offers_found,
                    result.inserted,
                    result.updated,
                    result.skipped,
                )
            else:
                logger.warning("Skipped %r — %s", brand.name, result.error)

            logger.info("")  # blank line between brands

        # ── Final summary ─────────────────────────────────────────────────────
        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        total_inserted = sum(r.inserted for r in results)
        total_updated = sum(r.updated for r in results)
        total_found = sum(r.offers_found for r in results)
        failed_brands = [r.brand_name for r in results if not r.success]

        logger.info(separator("RESEARCH COMPLETE"))
        logger.info(
            "Brands: %d processed, %d skipped",
            len(brands) - len(failed_brands),
            len(failed_brands),
        )
        logger.info("Offers found: %d  |  inserted: %d  |  updated: %d", total_found, total_inserted, total_updated)
        logger.info("Total time: %.1fs", elapsed)

        if failed_brands:
            logger.warning("Failed brands: %s", ", ".join(failed_brands))

        return results


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    if not TAVILY_API_KEY:
        logger.error(
            "TAVILY_API_KEY is not set. "
            "Add it to your .env file and restart."
        )
        sys.exit(1)

    runner = ResearchRunner()
    runner.run()


if __name__ == "__main__":
    main()
