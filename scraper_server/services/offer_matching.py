"""One matching rule for personalized offer feeds and FCM eligibility.

Default mode is AND: the offer's brand must be in the user's selected brands
AND at least one of the offer's categories must be in the user's selected
categories. Empty selections never mean "everything". Override with
OFFER_MATCH_MODE=or.
"""
from __future__ import annotations

from typing import Iterable

from sqlalchemy import bindparam, false, func, or_, text
from sqlalchemy.orm import Query

from config import OFFER_MATCH_MODE
from database.models import Offer


def normalize_name(value: str | None) -> str:
    return (value or "").strip().lower()


def preference_lists(brands: Iterable[str] | None, categories: Iterable[str] | None) -> tuple[list[str], list[str]]:
    brand_list = [normalize_name(b) for b in (brands or []) if normalize_name(b)]
    category_list = [normalize_name(c) for c in (categories or []) if normalize_name(c)]
    return brand_list, category_list


def offer_category_names(offer: Offer | dict) -> list[str]:
    if isinstance(offer, dict):
        raw = [offer.get("category"), offer.get("subcategory")]
        extra = offer.get("categories") or []
        if isinstance(extra, list):
            raw.extend(extra)
    else:
        raw = [offer.category, offer.subcategory]
    names = [normalize_name(v) for v in raw if normalize_name(v)]
    return list(dict.fromkeys(names))


def offer_brand_name(offer: Offer | dict) -> str:
    if isinstance(offer, dict):
        return normalize_name(offer.get("brand"))
    return normalize_name(offer.brand)


def offer_matches_preferences(
    offer: Offer | dict,
    brands: Iterable[str] | None,
    categories: Iterable[str] | None,
    *,
    mode: str | None = None,
) -> bool:
    """Pure matcher used by tests and any non-SQL call site."""
    selected_brands, selected_categories = preference_lists(brands, categories)
    match_mode = (mode or OFFER_MATCH_MODE).lower()
    brand = offer_brand_name(offer)
    offer_cats = offer_category_names(offer)

    brand_ok = bool(brand) and brand in selected_brands
    category_ok = bool(offer_cats) and any(c in selected_categories for c in offer_cats)

    if match_mode == "or":
        if not selected_brands and not selected_categories:
            return False
        return (bool(selected_brands) and brand_ok) or (bool(selected_categories) and category_ok)

    if not selected_brands or not selected_categories:
        return False
    return brand_ok and category_ok


def apply_personalized_offer_filter(
    query: Query,
    brands: Iterable[str] | None,
    categories: Iterable[str] | None,
    *,
    mode: str | None = None,
) -> Query:
    """Restrict an Offer query to rows matching the user's preferences."""
    selected_brands, selected_categories = preference_lists(brands, categories)
    match_mode = (mode or OFFER_MATCH_MODE).lower()

    brand_clause = func.lower(Offer.brand).in_(selected_brands) if selected_brands else false()
    category_clause = (
        or_(
            func.lower(Offer.category).in_(selected_categories),
            func.lower(Offer.subcategory).in_(selected_categories),
        )
        if selected_categories
        else false()
    )

    if match_mode == "or":
        if not selected_brands and not selected_categories:
            return query.filter(false())
        clauses = []
        if selected_brands:
            clauses.append(brand_clause)
        if selected_categories:
            clauses.append(category_clause)
        return query.filter(or_(*clauses))

    if not selected_brands or not selected_categories:
        return query.filter(false())
    return query.filter(brand_clause, category_clause)


def matching_profile_rows(session, offer: Offer, *, mode: str | None = None) -> list[tuple[str, str | None]]:
    """Return (device_id, user_id) for profiles that match `offer`, via SQL.

    Does not load every user into Python — JSON arrays stay in Postgres.
    """
    brand = offer_brand_name(offer)
    cats = offer_category_names(offer)
    match_mode = (mode or OFFER_MATCH_MODE).lower()

    if match_mode == "and" and (not brand or not cats):
        return []
    if match_mode == "or" and not brand and not cats:
        return []

    cat_params = cats or ["__no_category__"]
    if match_mode == "or":
        sql = text("""
            SELECT p.device_id, p.user_id
            FROM user_profiles p
            WHERE (
                (
                    :brand <> ''
                    AND jsonb_array_length(COALESCE(p.brands::jsonb, '[]'::jsonb)) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.brands::jsonb, '[]'::jsonb)) AS b(val)
                        WHERE lower(b.val) = :brand
                    )
                )
                OR
                (
                    :has_cats
                    AND jsonb_array_length(COALESCE(p.categories::jsonb, '[]'::jsonb)) > 0
                    AND EXISTS (
                        SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.categories::jsonb, '[]'::jsonb)) AS c(val)
                        WHERE lower(c.val) IN :cats
                    )
                )
            )
        """).bindparams(bindparam("cats", expanding=True))
    else:
        sql = text("""
            SELECT p.device_id, p.user_id
            FROM user_profiles p
            WHERE jsonb_array_length(COALESCE(p.brands::jsonb, '[]'::jsonb)) > 0
              AND jsonb_array_length(COALESCE(p.categories::jsonb, '[]'::jsonb)) > 0
              AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.brands::jsonb, '[]'::jsonb)) AS b(val)
                  WHERE lower(b.val) = :brand
              )
              AND EXISTS (
                  SELECT 1 FROM jsonb_array_elements_text(COALESCE(p.categories::jsonb, '[]'::jsonb)) AS c(val)
                  WHERE lower(c.val) IN :cats
              )
        """).bindparams(bindparam("cats", expanding=True))

    result = session.execute(sql, {"brand": brand, "cats": cat_params, "has_cats": bool(cats)})
    return [(row[0], row[1]) for row in result]
