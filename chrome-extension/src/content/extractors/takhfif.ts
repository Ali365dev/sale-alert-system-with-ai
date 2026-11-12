import type { TakhfifListing, TakhfifPageResult } from "../../types/takhfif";

function absUrl(raw: string | null | undefined, base: string): string | undefined {
  if (!raw || raw.startsWith("data:")) return undefined;
  try { return new URL(raw, base).href; } catch { return raw || undefined; }
}

function imgSrc(img: HTMLImageElement | undefined, base: string): string | undefined {
  if (!img) return undefined;
  const raw = img.currentSrc
    || img.getAttribute("src")
    || img.getAttribute("data-src")
    || img.getAttribute("srcset")?.trim().split(/\s+/)[0]
    || "";
  return absUrl(raw, base);
}

/** Deal cards are anchors linking to /place/<slug> that contain an image.
 * Matched by href semantics, never by Tailwind class strings. */
function findCards(): HTMLAnchorElement[] {
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/place/"], a[href*="//takhfif.app/place/"]'),
  );
  const seen = new Set<string>();
  return anchors.filter((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!href || seen.has(href)) return false;
    if (!a.querySelector("img")) return false;
    if ((a.textContent ?? "").trim().length < 3) return false;
    seen.add(href);
    return true;
  });
}

/** Leaf-element texts only, so labels don't concatenate into one blob.
 * Elements whose only children are inline svg icons still count as leaves —
 * takhfif renders e.g. <span>4.4<svg star/></span> and
 * <span><svg card/>54 card offers</span>. */
function leafTexts(root: Element): string[] {
  return Array.from(root.querySelectorAll("span, p, div, h1, h2, h3, h4"))
    .filter((el) =>
      el.childElementCount === 0
      || Array.from(el.children).every((c) => c.tagName.toLowerCase() === "svg"))
    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractCard(card: HTMLAnchorElement, pageUrl: string, pageNum: number): TakhfifListing | null {
  const detailUrl = absUrl(card.getAttribute("href"), pageUrl);
  if (!detailUrl) return null;

  const imgs = Array.from(card.querySelectorAll("img"));
  const texts = leafTexts(card);

  const ratingText = texts.find((t) => /^[0-5](\.\d)?$/.test(t));
  const discountText = texts.find((t) => /\d+\s*%\s*off/i.test(t));
  const bankText = texts.find((t) => /^\d+\s*banks?$/i.test(t));
  const offersText = texts.find((t) => /^\d+\s*card\s*offers?$/i.test(t));
  const expiryText = texts.find((t) => /^(till|valid)\b/i.test(t));
  const metaText = texts.find((t) => t.includes("·"));

  let category: string | undefined;
  let location: string | undefined;
  let reviewCountText: string | undefined;
  if (metaText) {
    const parts = metaText.split("·").map((p) => p.trim()).filter(Boolean);
    category = parts[0] || undefined;
    const reviewIdx = parts.findIndex((p) => /review/i.test(p));
    if (reviewIdx > 0) {
      reviewCountText = parts[reviewIdx];
      location = parts.slice(1, reviewIdx).join(" · ") || undefined;
    } else {
      location = parts.slice(1).join(" · ") || undefined;
    }
  }

  const consumed = new Set([ratingText, discountText, bankText, offersText, expiryText, metaText]);
  let name = (imgs[0]?.alt ?? "").trim()
    || texts.find((t) => !consumed.has(t) && t.length > 2)
    || "";
  if (!name) {
    // Derive from the URL slug — actual source data, not invented.
    const slug = detailUrl.split("/place/")[1]?.split(/[/?#]/)[0] ?? "";
    name = slug.replace(/-/g, " ").trim();
  }
  if (!name) return null;

  const pct = discountText?.match(/(\d+)\s*%/);

  return {
    source: "takhfif",
    business_name: name,
    detail_url: detailUrl,
    cover_image: imgSrc(imgs[0], pageUrl),
    logo_url: imgs.length > 1 ? imgSrc(imgs[1], pageUrl) : undefined,
    rating: ratingText ? parseFloat(ratingText) : undefined,
    discount_text: discountText,
    discount_percentage: pct ? parseInt(pct[1], 10) : undefined,
    bank_count: bankText ? parseInt(bankText, 10) : undefined,
    category,
    location,
    review_count_text: reviewCountText,
    card_offer_count: offersText ? parseInt(offersText, 10) : undefined,
    expiry_text: expiryText,
    listing_page: pageNum,
    source_url: pageUrl,
    scraped_at: new Date().toISOString(),
  };
}

function extractPagination(pageUrl: string): { currentPage: number; totalPages: number | null; nextUrl: string | null } {
  let currentPage: number | null = null;
  let totalPages: number | null = null;

  for (const el of Array.from(document.querySelectorAll("span, p, div"))) {
    if (el.childElementCount > 0) continue;
    const m = (el.textContent ?? "").match(/page\s+(\d+)\s+of\s+(\d+)/i);
    if (m) { currentPage = parseInt(m[1], 10); totalPages = parseInt(m[2], 10); break; }
  }
  if (currentPage == null) {
    try { currentPage = parseInt(new URL(pageUrl).searchParams.get("page") ?? "1", 10) || 1; }
    catch { currentPage = 1; }
  }

  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
  const nextHref =
    anchors.find((a) => /next/i.test((a.textContent ?? "").trim()))?.getAttribute("href")
    ?? anchors.find((a) => new RegExp(`[?&]page=${currentPage! + 1}(&|$)`).test(a.getAttribute("href") ?? ""))?.getAttribute("href")
    ?? null;

  return { currentPage, totalPages, nextUrl: nextHref ? absUrl(nextHref, pageUrl) ?? null : null };
}

/** Extracts all deal cards + pagination from the current takhfif.app listing
 * page. Waits briefly for hydration if cards haven't rendered yet. */
export async function extractTakhfifListingPage(): Promise<TakhfifPageResult> {
  const pageUrl = window.location.href;

  let cards = findCards();
  for (let i = 0; i < 3 && cards.length === 0; i++) {
    await new Promise((res) => setTimeout(res, 1200));
    cards = findCards();
  }

  const { currentPage, totalPages, nextUrl } = extractPagination(pageUrl);
  const listings = cards
    .map((c) => extractCard(c, pageUrl, currentPage))
    .filter((l): l is TakhfifListing => l !== null);

  if (!listings.length) {
    return { listings: [], currentPage, totalPages, nextUrl, error: "No deal cards found on this page" };
  }
  return { listings, currentPage, totalPages, nextUrl };
}
