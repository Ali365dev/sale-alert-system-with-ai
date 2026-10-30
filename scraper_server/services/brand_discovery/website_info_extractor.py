"""Pulls brand name / description / country out of a crawled homepage's
metadata — no AI call, pure tag lookup with a few plain fallbacks."""
import re

from services.brand_discovery.crawler import ParsedPage, domain_of

SOURCE = "website_metadata"

# Country hints from a page's own <html lang="..">/hreflang, not TLD alone —
# TLD is a weaker signal (plenty of .com sites are Pakistani/UK/etc brands)
# so it's used only as a last-resort fallback below.
_TLD_COUNTRY = {
    "pk": "Pakistan", "uk": "United Kingdom", "ae": "United Arab Emirates",
    "in": "India", "us": "United States", "ca": "Canada", "au": "Australia",
    "de": "Germany", "fr": "France", "sa": "Saudi Arabia", "eg": "Egypt",
    "tr": "Turkey", "bd": "Bangladesh", "lk": "Sri Lanka",
}
_LANG_COUNTRY = {
    "en-us": "United States", "en-gb": "United Kingdom", "en-pk": "Pakistan",
    "en-in": "India", "en-ae": "United Arab Emirates", "en-au": "Australia",
    "en-ca": "Canada", "ar-sa": "Saudi Arabia", "ar-ae": "United Arab Emirates",
}


def _meta(soup, **attrs) -> str | None:
    tag = soup.find("meta", attrs=attrs)
    if not tag:
        return None
    content = (tag.get("content") or "").strip()
    return content or None


def extract_name(page: ParsedPage) -> dict:
    og_site_name = _meta(page.soup, property="og:site_name")
    if og_site_name:
        return {"value": og_site_name, "source": SOURCE}

    title_tag = page.soup.find("title")
    if title_tag and title_tag.get_text(strip=True):
        # Titles are often "Brand Name | Tagline" or "Brand Name - Tagline" —
        # the part before the first separator is usually just the brand name.
        title = title_tag.get_text(strip=True)
        name = re.split(r"\s*[|\-–—]\s*", title, maxsplit=1)[0].strip()
        if name:
            return {"value": name[:255], "source": SOURCE}

    domain = domain_of(page.url)
    if domain:
        guess = domain.split(".")[0].replace("-", " ").title()
        return {"value": guess, "source": "website_metadata"}

    return {"value": None, "source": None}


def extract_description(page: ParsedPage) -> dict:
    description = _meta(page.soup, property="og:description") or _meta(page.soup, name="description")
    if description:
        return {"value": description.strip()[:2000], "source": SOURCE}
    return {"value": None, "source": None}


def extract_country(page: ParsedPage) -> dict:
    html_tag = page.soup.find("html")
    lang = (html_tag.get("lang") if html_tag else "") or ""
    lang = lang.strip().lower()
    if lang in _LANG_COUNTRY:
        return {"value": _LANG_COUNTRY[lang], "source": SOURCE}

    hreflang_tag = page.soup.find("link", attrs={"hreflang": True})
    if hreflang_tag:
        hreflang = (hreflang_tag.get("hreflang") or "").strip().lower()
        if hreflang in _LANG_COUNTRY:
            return {"value": _LANG_COUNTRY[hreflang], "source": SOURCE}

    domain = domain_of(page.url)
    tld = domain.rsplit(".", 1)[-1] if "." in domain else ""
    if tld in _TLD_COUNTRY:
        return {"value": _TLD_COUNTRY[tld], "source": SOURCE}

    return {"value": None, "source": None}
