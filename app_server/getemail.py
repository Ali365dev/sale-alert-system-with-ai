"""
Prints all distinct sender email addresses from the `emails` table as a
comma-separated string (for reference) and as a Gmail-filter-ready
`from:(...) OR from:(...)` query you can paste into Gmail's search bar
to create a filter that applies the sales_offers label.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from database.db import engine

QUERY_COMMA_LIST = """
SELECT string_agg(DISTINCT lower(regexp_replace(sender, '.*<([^>]+)>.*', '\\1')), ', ')
FROM emails;
"""

QUERY_GMAIL_FILTER = """
SELECT string_agg(DISTINCT
         'from:(' || lower(regexp_replace(sender, '.*<([^>]+)>.*', '\\1')) || ')',
         ' OR '
       )
FROM emails;
"""


def main() -> None:
    with engine.connect() as conn:
        comma_list = conn.execute(text(QUERY_COMMA_LIST)).scalar()
        gmail_filter = conn.execute(text(QUERY_GMAIL_FILTER)).scalar()

    print("Comma-separated sender list:")
    print(comma_list or "(no emails found)")
    print()
    print("Gmail filter query (paste into Gmail search bar):")
    print(gmail_filter or "(no emails found)")


if __name__ == "__main__":
    main()
