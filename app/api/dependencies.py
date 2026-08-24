"""Shared FastAPI dependencies. Currently just pagination — extracted here
because api/emails.py and api/unknown_emails.py duplicated near-identical
page/page_size parsing (see migration plan's cross-cutting notes).

Deliberately parses page/page_size as raw strings and falls back silently on
invalid input, rather than using FastAPI's built-in `int` query-param
coercion (which would 422 on bad input) — this matches the original Flask
routes' forgiving `try/except (TypeError, ValueError)` behavior exactly."""
from dataclasses import dataclass

from fastapi import Query

PAGE_SIZES = (10, 25, 50, 100)
DEFAULT_PAGE_SIZE = 25


@dataclass
class Pagination:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def pagination(
    page: str | None = Query(None),
    page_size: str | None = Query(None),
) -> Pagination:
    try:
        p = max(1, int(page)) if page is not None else 1
    except (TypeError, ValueError):
        p = 1

    try:
        ps = int(page_size) if page_size is not None else DEFAULT_PAGE_SIZE
    except (TypeError, ValueError):
        ps = DEFAULT_PAGE_SIZE
    if ps not in PAGE_SIZES:
        ps = DEFAULT_PAGE_SIZE

    return Pagination(page=p, page_size=ps)
