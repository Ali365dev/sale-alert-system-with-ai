"""
Sync sender email addresses from the `emails` table into `brands.emails`.

Matching priority for each sender email:
    1. offers.brand for that email
    2. sender domain vs brand website domain
    3. brand name found in sender name or subject
    4. sender email already present in brands.emails

Senders that cannot be matched to any brand are written to
unmatched_emails.csv and printed to the console.
"""
import csv
import json
import os
import sys
from collections import defaultdict
from email.utils import parseaddr
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(__file__))

from database.db import get_session
from database.models import Brand, Email, Offer

EMAIL_BATCH_SIZE = 500
CSV_PATH = Path(__file__).parent / "unmatched_emails.csv"

# Generic infra/relay domains that must never be matched by the "brand name
# in sender/subject" heuristic — otherwise a shared relay (e.g. Google Forms
# notifications) gets pinned to whichever brand happens to be named in a
# given email's subject line.
GENERIC_SENDER_DOMAINS = {
    "google.com", "gmail.com", "googlemail.com",
    "shopifyemail.com", "replit.com", "stackblitz.com",
    "newsdata.io", "metamail.com",
}


def is_generic_sender_domain(domain: str) -> bool:
    domain = (domain or "").lower().strip()
    labels = domain.split(".")
    return any(".".join(labels[i:]) in GENERIC_SENDER_DOMAINS for i in range(len(labels)))


def normalize_sender(raw_sender: str) -> tuple[str, str]:
    """Parse a raw From header like 'Bata Pakistan <info@bata.com>' into
    (sender_name, normalized_email)."""
    name, addr = parseaddr(raw_sender or "")
    return name.strip(), addr.strip().lower()


def domain_of(email_addr: str) -> str:
    return email_addr.split("@", 1)[1] if "@" in email_addr else ""


_TLD_LABELS = {"com", "net", "org", "io", "co", "pk", "biz", "info", "shop", "store", "online"}


def domain_root(domain: str) -> str:
    """Second-level domain name, stripping common TLD suffixes and any
    leading subdomain — e.g. 'www.bata.com.pk' -> 'bata',
    'email.fossil.com' -> 'fossil', 'n.nishatlinen.com' -> 'nishatlinen'."""
    domain = (domain or "").lower().strip()
    labels = [l for l in domain.split(".") if l]
    while len(labels) > 1 and labels[-1] in _TLD_LABELS:
        labels.pop()
    return labels[-1] if labels else ""


def website_domain_root(website: str) -> str:
    if not website:
        return ""
    parsed = urlparse(website if "//" in website else f"//{website}")
    return domain_root(parsed.netloc or parsed.path)


def load_emails_json(raw) -> set:
    if not raw:
        return set()
    try:
        data = json.loads(raw)
        return {e.strip().lower() for e in data if e}
    except (json.JSONDecodeError, TypeError):
        return set()


def fetch_emails_batched(session, batch_size=EMAIL_BATCH_SIZE):
    offset = 0
    while True:
        rows = (
            session.query(Email.id, Email.sender, Email.subject)
            .order_by(Email.id)
            .offset(offset)
            .limit(batch_size)
            .all()
        )
        if not rows:
            break
        yield from rows
        offset += batch_size


def sync() -> dict:
    stats = {
        "brands_processed": 0,
        "existing_emails_skipped": 0,
        "new_emails_added": 0,
    }
    unmatched = []

    with get_session() as session:
        brands = session.query(Brand).all()
        stats["brands_processed"] = len(brands)

        brand_emails = {}          # brand.id -> set of known emails (working copy)
        domain_root_index = defaultdict(list)   # domain root -> [brand.id, ...]
        name_index = []             # [(brand name lower, brand.id), ...]
        email_index = {}            # known email -> brand.id
        name_by_id = {}

        for b in brands:
            emails_set = load_emails_json(b.emails)
            brand_emails[b.id] = emails_set
            name_by_id[b.id] = b.name

            root = website_domain_root(b.website)
            if root:
                domain_root_index[root].append(b.id)

            name_index.append((b.name.lower(), b.id))

            for e in emails_set:
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
                    "domain": "",
                    "subject": subject,
                    "reason": "Could not parse sender email address",
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
                    "domain": sender_domain,
                    "subject": subject,
                    "reason": "No matching brand found",
                })
                continue

            emails_set = brand_emails[matched_brand_id]
            if sender_email in emails_set:
                stats["existing_emails_skipped"] += 1
            else:
                emails_set.add(sender_email)
                email_index.setdefault(sender_email, matched_brand_id)
                stats["new_emails_added"] += 1

        # Only write brands whose email set actually changed
        for b in brands:
            updated_set = brand_emails[b.id]
            if updated_set != load_emails_json(b.emails):
                b.emails = json.dumps(sorted(updated_set))

        stats["brand_emails_added"] = sum(len(s) for s in brand_emails.values())

    stats["unmatched_senders"] = len(unmatched)
    return stats, unmatched


def write_unmatched_csv(unmatched: list) -> None:
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["email_id", "sender", "domain", "subject", "reason"])
        writer.writeheader()
        writer.writerows(unmatched)


def print_summary(stats: dict, unmatched: list) -> None:
    print("=" * 36)
    print("Brand Email Synchronization Complete")
    print("=" * 36)
    print()
    print(f"Brands Processed: {stats['brands_processed']:,}")
    print(f"Brand Emails Added: {stats['brand_emails_added']:,}")
    print(f"Existing Emails Skipped: {stats['existing_emails_skipped']:,}")
    print(f"New Emails Added: {stats['new_emails_added']:,}")
    print(f"Unmatched Senders: {stats['unmatched_senders']:,}")
    print()
    print("CSV Saved:")
    print(CSV_PATH.name)

    if unmatched:
        print()
        print("Unmatched Senders")
        print()
        seen = set()
        for row in unmatched:
            sender = row["sender"]
            if sender not in seen:
                seen.add(sender)
                print(sender)


def main():
    stats, unmatched = sync()
    write_unmatched_csv(unmatched)
    print_summary(stats, unmatched)


if __name__ == "__main__":
    main()
