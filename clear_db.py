"""Delete all rows from every table, preserving the schema."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from database.db import get_session
from database.models import Offer, Email


def clear_all(confirm: bool = False) -> None:
    if not confirm:
        answer = input("This will delete ALL emails and offers. Type 'yes' to continue: ")
        if answer.strip().lower() != "yes":
            print("Aborted.")
            return

    with get_session() as session:
        offers_deleted = session.query(Offer).delete()
        emails_deleted = session.query(Email).delete()

    print(f"Deleted {offers_deleted} offer(s) and {emails_deleted} email(s).")


if __name__ == "__main__":
    force = "--yes" in sys.argv or "-y" in sys.argv
    clear_all(confirm=force)
