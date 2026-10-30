"""
Read-only audit: for each brand, find every sender email in the `emails`
table that resolves to it (same matching rules as sync_brand_emails.py) and
compare against what's already stored in brands.emails.

Does NOT write to the database — use sync_brand_emails.py for that.
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))

from database.db import get_session
from database.models import Brand, Offer
from sync_brand_emails import (
    domain_of,
    domain_root,
    fetch_emails_batched,
    is_generic_sender_domain,
    load_emails_json,
    normalize_sender,
    website_domain_root,
)


def check() -> tuple[dict, list]:
    """Returns (per_brand_report, unmatched) where per_brand_report is
    {brand_id: {"name": str, "found": set, "stored": set, "missing": set}}."""
    per_brand = {}
    unmatched = []

    with get_session() as session:
        brands = session.query(Brand).all()

        domain_root_index = defaultdict(list)   # domain root -> [brand.id, ...]
        name_index = []                          # [(brand name lower, brand.id), ...]
        email_index = {}                         # known email -> brand.id

        for b in brands:
            stored = load_emails_json(b.emails)
            per_brand[b.id] = {
                "name": b.name,
                "found": set(),
                "stored": stored,
            }

            root = website_domain_root(b.website)
            if root:
                domain_root_index[root].append(b.id)

            name_index.append((b.name.lower(), b.id))

            for e in stored:
                email_index.setdefault(e, b.id)

        brand_id_by_name_lower = {b.name.lower(): b.id for b in brands}

        # offers.brand lookup, keyed by the email it came from
        offer_brand_by_email_id = {}
        offer_rows = (
            session.query(Offer.email_id, Offer.brand)
            .filter(Offer.email_id.isnot(None))
            .all()
        )
        for email_id, brand_name in offer_rows:
            if brand_name and email_id not in offer_brand_by_email_id:
                offer_brand_by_email_id[email_id] = brand_name.strip().lower()

        for email_id, raw_sender, subject in fetch_emails_batched(session):
            sender_name, sender_email = normalize_sender(raw_sender)
            subject = subject or ""

            if not sender_email:
                unmatched.append({
                    "email_id": email_id,
                    "sender": (raw_sender or "").strip(),
                    "subject": subject,
                })
                continue

            sender_domain = domain_of(sender_email)
            sender_root = domain_root(sender_domain)
            matched_brand_id = None

            # Priority 1: offers.brand for this email
            offer_brand = offer_brand_by_email_id.get(email_id)
            if offer_brand:
                matched_brand_id = brand_id_by_name_lower.get(offer_brand)

            # Priority 2: sender domain vs brand website domain
            if matched_brand_id is None and sender_root:
                candidates = domain_root_index.get(sender_root)
                if candidates:
                    matched_brand_id = candidates[0]

            # Priority 3: brand name in sender name or subject
            if matched_brand_id is None and not is_generic_sender_domain(sender_domain):
                haystack = f"{sender_name} {subject}".lower()
                for name_lower, bid in name_index:
                    if name_lower and name_lower in haystack:
                        matched_brand_id = bid
                        break

            # Priority 4: sender email already known to a brand
            if matched_brand_id is None:
                matched_brand_id = email_index.get(sender_email)

            if matched_brand_id is None:
                unmatched.append({
                    "email_id": email_id,
                    "sender": sender_email,
                    "subject": subject,
                })
                continue

            per_brand[matched_brand_id]["found"].add(sender_email)

    for report in per_brand.values():
        report["missing"] = report["found"] - report["stored"]

    return per_brand, unmatched


def print_report(per_brand: dict, unmatched: list) -> None:
    for report in sorted(per_brand.values(), key=lambda r: r["name"].lower()):
        if not report["found"]:
            continue  # nothing to report for brands with no matched senders

        print(f"Brand: {report['name']}")
        print()
        print("Senders found:")
        for sender in sorted(report["found"]):
            print(sender)
        print()

        if report["missing"]:
            print("Missing from brands.emails:")
            for sender in sorted(report["missing"]):
                print(sender)
        else:
            print("✓ All senders already in brands.emails")
        print()
        print("-" * 36)
        print()

    if unmatched:
        print("=" * 36)
        print("Unmatched senders (no brand at all):")
        print()
        seen = set()
        for row in unmatched:
            sender = row["sender"]
            if sender in seen:
                continue
            seen.add(sender)
            print(f'{sender} (email_id={row["email_id"]}, subject="{row["subject"]}")')


def main():
    per_brand, unmatched = check()
    print_report(per_brand, unmatched)


if __name__ == "__main__":
    main()
