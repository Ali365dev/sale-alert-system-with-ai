import type {
  TakhfifBankOffers, TakhfifBranch, TakhfifBusinessDetail, TakhfifCard,
  TakhfifDetailResult, TakhfifGalleryImage, TakhfifOfferTier,
} from "../../types/takhfif";
import { classifyPageHealth } from "./takhfif";
import { banksFromJsonLd, enrichBanks } from "./takhfif-jsonld";

const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function imgUrl(img: HTMLImageElement | null | undefined): string | undefined {
  if (!img) return undefined;
  const raw = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "";
  if (!raw || raw.startsWith("data:")) return undefined;
  try { return new URL(raw, window.location.href).href; } catch { return raw; }
}

function findHeading(re: RegExp): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>("h2, h3"))
    .find((h) => re.test(norm(h.textContent))) ?? null;
}

// ── Business info ─────────────────────────────────────────────────────────────

function extractBusinessInfo(detail: TakhfifBusinessDetail): void {
  const h1 = document.querySelector("h1");
  detail.name = norm(h1?.textContent);

  const meta = norm(h1?.parentElement?.querySelector("p")?.textContent);
  if (meta.includes("·")) {
    const parts = meta.split("·").map(norm).filter(Boolean);
    detail.category = parts[0];
    detail.city = parts[1];
  }

  const namedImgs = detail.name
    ? Array.from(document.querySelectorAll<HTMLImageElement>("img"))
        .filter((i) => norm(i.alt) === detail.name)
    : [];
  detail.coverImage = imgUrl(namedImgs.find((i) => !i.getAttribute("width")) ?? namedImgs[0]);
  detail.logoImage = imgUrl(namedImgs.find((i) => i.getAttribute("width")));

  for (const el of Array.from(document.querySelectorAll("p, span"))) {
    if (el.childElementCount > 1) continue;
    const t = norm(el.textContent);
    if (detail.rating == null && /^[0-5]\.\d$/.test(t)) detail.rating = parseFloat(t);
    if (!detail.reviewCountText) {
      const m = t.match(/^([\d.,]+[KM]?\+?)\s*reviews$/i);
      if (m) detail.reviewCountText = m[1];
    }
  }

  // Stats <dl>: dt labels are semantic ("Top discount" / "Banks" / "Cards")
  for (const row of Array.from(document.querySelectorAll("dl div"))) {
    const label = norm(row.querySelector("dt")?.textContent).toLowerCase();
    const value = norm(row.querySelector("dd")?.textContent);
    if (label.includes("discount")) detail.topDiscountText = value;
    else if (label.includes("bank")) detail.totalBanks = parseInt(value, 10) || undefined;
    else if (label.includes("card")) detail.totalCards = parseInt(value, 10) || undefined;
  }

  const aboutH2 = findHeading(/^about$/i);
  const aboutP = aboutH2?.parentElement?.querySelector("p");
  if (aboutP) detail.description = norm(aboutP.textContent) || undefined;

  const bodyText = document.body?.innerText ?? "";
  const open = bodyText.match(/\b(Open now|Closed)\b(?:\s*·\s*(?:Closes|Opens)\s+([^\n·]+))?/i);
  if (open) {
    detail.openingStatus = open[1];
    detail.closingTime = open[2] ? norm(open[2]) : undefined;
  }

  const telA = document.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
  if (telA) detail.phone = norm(telA.textContent) || decodeURIComponent(telA.href.slice(4));

  // Weekly schedule: <li> rows of exactly [day, hours] spans
  const dayRe = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i;
  const hours: { day: string; hours: string }[] = [];
  for (const li of Array.from(document.querySelectorAll("li"))) {
    const spans = li.querySelectorAll("span");
    if (spans.length !== 2) continue;
    const day = norm(spans[0].textContent);
    if (dayRe.test(day) && !hours.some((h) => h.day === day)) {
      hours.push({ day, hours: norm(spans[1].textContent) });
    }
  }
  if (hours.length) detail.openingHours = hours.slice(0, 7);

  const priceEl = Array.from(document.querySelectorAll("span"))
    .find((s) => /price level/i.test(norm(s.textContent)) && norm(s.textContent).length < 40);
  const dollars = norm(priceEl?.closest("div")?.textContent).match(/\$+/g);
  if (dollars) detail.priceLevel = dollars.join("");

  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    const href = a.href;
    if (!detail.facebookUrl && /facebook\.com/i.test(href)) detail.facebookUrl = href;
    else if (!detail.instagramUrl && /instagram\.com/i.test(href)) detail.instagramUrl = href;
    else if (!detail.mapsUrl && /google\.[^/]+\/maps\/search/i.test(href)) detail.mapsUrl = href;
    else if (!detail.website && norm(a.textContent) === "Website") detail.website = href;
  }
}

// ── Branches ──────────────────────────────────────────────────────────────────

function parseBranchLi(li: Element, detail: TakhfifBusinessDetail): void {
  const ps = Array.from(li.querySelectorAll("p"));
  const dirA = li.querySelector<HTMLAnchorElement>('a[href*="maps/dir"]');
  const branch: TakhfifBranch = {
    name: norm(ps[0]?.textContent),
    address: norm(ps[1]?.textContent),
    directionsUrl: dirA?.href,
  };
  if (dirA?.href) {
    try {
      const params = new URL(dirA.href).searchParams;
      const dest = params.get("destination");
      const m = dest?.match(/^(-?[\d.]+),(-?[\d.]+)$/);
      if (m) { branch.latitude = parseFloat(m[1]); branch.longitude = parseFloat(m[2]); }
      branch.placeId = params.get("destination_place_id") ?? undefined;
    } catch { /* keep raw url */ }
  }
  if (branch.name || branch.address || branch.directionsUrl) detail.branches.push(branch);
}

async function extractBranches(detail: TakhfifBusinessDetail): Promise<void> {
  const toggle = Array.from(document.querySelectorAll("button"))
    .find((b) => /^\d+\s*branch(es)?$/i.test(norm(b.textContent)));

  if (toggle) {
    // Branch list is behind a collapsible — click to expand and wait for <li>s
    if (toggle.getAttribute("aria-expanded") !== "true") {
      toggle.click();
      const wrapper = toggle.closest("div");
      for (let i = 0; i < 20; i++) {
        await sleep(150);
        if (wrapper?.querySelector("li")) break;
      }
    }
    const wrapper = toggle.closest("div");
    for (const li of Array.from(wrapper?.querySelectorAll("li") ?? [])) {
      parseBranchLi(li, detail);
    }
  } else {
    // Single branch shown inline (no toggle button) — find via directions link
    for (const dirA of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="maps/dir"]'))) {
      const li = dirA.closest("li");
      if (li) { parseBranchLi(li, detail); break; }
    }
  }

  detail.totalBranches = detail.branches.length || undefined;
}

// ── Gallery & menu ────────────────────────────────────────────────────────────

function extractGallery(detail: TakhfifBusinessDetail): void {
  const section = document.querySelector("#photos") ?? findHeading(/photos/i)?.parentElement;
  if (!section) return;
  let order = 0;
  for (const img of Array.from(section.querySelectorAll<HTMLImageElement>("img"))) {
    const url = imgUrl(img);
    if (url) detail.gallery.push({ url, alt: norm(img.alt) || undefined, order: ++order } as TakhfifGalleryImage);
  }
  // Menu pages button may live inside the photos section or anywhere on the page
  const menuBtn = Array.from(document.querySelectorAll("button"))
    .find((b) => /view menu/i.test(norm(b.textContent)));
  const pages = norm(menuBtn?.textContent).match(/(\d+)\s*pages?/i);
  if (pages) detail.menuPages = parseInt(pages[1], 10);
}

// ── Bank offers (per selected filter) ─────────────────────────────────────────

function offersSection(): HTMLElement | null {
  return (document.querySelector<HTMLElement>("#offers"))
    ?? findHeading(/card offers/i)?.parentElement ?? null;
}

function bankButtons(section: HTMLElement): HTMLButtonElement[] {
  return Array.from(section.querySelectorAll("button")).filter((b) => {
    const t = norm(b.textContent);
    return /↑\s*\d+\s*%|\d+\s*%$/.test(t) && t.length < 60 && !/% off/i.test(t);
  });
}

function bankFromButton(btn: HTMLElement): { name: string; maxPct: number | null } {
  const clone = btn.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("span, svg").forEach((s) => s.remove());
  const pct = norm(btn.textContent).match(/(\d+)\s*%/);
  return { name: norm(clone.textContent), maxPct: pct ? parseInt(pct[1], 10) : null };
}

function offerContainer(section: HTMLElement): HTMLElement | null {
  return Array.from(section.querySelectorAll<HTMLElement>("div"))
    .find((d) => /cards? available/i.test(d.textContent ?? "") && d.querySelector("a[target]")) ?? null;
}

function extractActiveBank(section: HTMLElement, bank: { name: string; maxPct: number | null }): TakhfifBankOffers | null {
  const container = offerContainer(section);
  if (!container) return null;
  const text = container.innerText ?? "";

  const result: TakhfifBankOffers = {
    bankName: bank.name,
    maxDiscountPercentage: bank.maxPct,
    cardsAvailableText: norm(text.match(/\d+\s*cards? available/i)?.[0] ?? "") || undefined,
    validityText: norm(text.match(/valid until[^\n·]*/i)?.[0] ?? "") || undefined,
    bankOfferUrl: Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .find((a) => /view on bank site/i.test(norm(a.textContent)))?.href,
    terms: [],
    tiers: [],
  };

  const badges = Array.from(container.querySelectorAll("span"))
    .filter((s) => /^\d+%\s*off$/i.test(norm(s.textContent)));
  for (const badge of badges) {
    const row = badge.parentElement;
    const group = row?.parentElement;
    if (!row || !group) continue;
    const rowSpans = Array.from(row.querySelectorAll("span")).map((s) => norm(s.textContent));
    const tier: TakhfifOfferTier = {
      discountPercentage: parseInt(norm(badge.textContent), 10) || null,
      title: rowSpans.find((t) => t !== norm(badge.textContent) && !/^\d+\s*cards?$/i.test(t)) ?? norm(badge.textContent),
      cardsCountText: rowSpans.find((t) => /^\d+\s*cards?$/i.test(t)),
      cards: [],
    };
    for (const block of Array.from(group.children)) {
      if (block === row || !(block instanceof HTMLElement)) continue;
      const nameSpan = block.querySelector("span");
      const cardName = norm(nameSpan?.textContent);
      if (!cardName || /max discount/i.test(cardName)) continue;
      const maxM = (block.innerText ?? "").match(/max discount:\s*((?:Rs\.?|PKR)?\s*[\d,]+)/i);
      const card: TakhfifCard = {
        cardName,
        discountPercentage: tier.discountPercentage,
        maxDiscountText: maxM ? norm(maxM[1]) : undefined,
        maxDiscountAmount: maxM ? parseInt(maxM[1].replace(/[^\d]/g, ""), 10) || undefined : undefined,
        currency: maxM && /rs|pkr/i.test(maxM[1]) ? "PKR" : undefined,
      };
      tier.cards.push(card);
    }
    if (tier.cards.length || tier.title) result.tiers.push(tier);
  }

  // Terms live inside a <details> whose content is in the DOM even collapsed
  const details = Array.from(container.querySelectorAll("details"))
    .find((d) => /terms/i.test(norm(d.querySelector("summary")?.textContent)));
  if (details) {
    result.terms = Array.from(details.querySelectorAll("li")).map((li) => norm(li.textContent)).filter(Boolean);
  }
  return result.tiers.length || result.terms.length ? result : null;
}

async function extractAllBanks(section: HTMLElement, warnings: string[]): Promise<TakhfifBankOffers[]> {
  const buttons = bankButtons(section);
  const results: TakhfifBankOffers[] = [];
  const sig = () => (offerContainer(section)?.innerText ?? "").slice(0, 400);
  const seenSigs = new Map<string, string>();

  if (buttons.length === 0) {
    const single = extractActiveBank(section, { name: "", maxPct: null });
    if (single) results.push(single);
    return results;
  }

  for (const btn of buttons) {
    const bank = bankFromButton(btn);
    if (!bank.name) continue;
    const before = sig();
    btn.click();
    // Wait for the offer container to swap to this bank (client-side render)
    for (let waited = 0; waited < 4000 && sig() === before; waited += 250) await sleep(250);
    const current = sig();
    const claimedBy = seenSigs.get(current);
    if (claimedBy && claimedBy !== bank.name) {
      warnings.push(`Offers for "${bank.name}" did not load — content still shows "${claimedBy}".`);
      continue;
    }
    seenSigs.set(current, bank.name);
    const extracted = extractActiveBank(section, bank);
    if (extracted) results.push(extracted);
    else warnings.push(`No offer tiers found for "${bank.name}".`);
    await sleep(300);
  }
  return results;
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function extractTakhfifDetailPage(): Promise<TakhfifDetailResult> {
  const warnings: string[] = [];
  const health = classifyPageHealth();
  if (health.kind !== "ok") return { detail: null, health, warnings, error: health.detail };

  // Wait for the offers section to hydrate
  let section = offersSection();
  for (let i = 0; i < 5 && (!section || !bankButtons(section).length && !offerContainer(section)); i++) {
    await sleep(1200);
    section = offersSection();
  }

  const detail: TakhfifBusinessDetail = {
    source: "takhfif",
    slug: window.location.pathname.split("/place/")[1]?.split(/[/?#]/)[0] ?? "",
    name: "",
    canonicalUrl: `${window.location.origin}${window.location.pathname}`,
    branches: [],
    gallery: [],
    banks: [],
    warnings,
    sourceUrl: window.location.href,
    scrapedAt: new Date().toISOString(),
  };

  try { extractBusinessInfo(detail); } catch (e) { warnings.push(`Business info: ${String(e)}`); }
  try { await extractBranches(detail); } catch (e) { warnings.push(`Branches: ${String(e)}`); }
  try { extractGallery(detail); } catch (e) { warnings.push(`Gallery: ${String(e)}`); }

  // JSON-LD is the authoritative card/bank source (covers ALL banks without
  // clicking); the DOM click-pass enriches it with max amounts, terms & URLs.
  let ld: ReturnType<typeof banksFromJsonLd> = null;
  try { ld = banksFromJsonLd(); } catch (e) { warnings.push(`JSON-LD: ${String(e)}`); }
  if (ld) {
    detail.rating = detail.rating ?? ld.rating;
    if (!detail.reviewCountText && ld.reviewCount != null) detail.reviewCountText = String(ld.reviewCount);
  }

  let domBanks: typeof detail.banks = [];
  if (section) {
    try { domBanks = await extractAllBanks(section, warnings); }
    catch (e) { warnings.push(`Bank offers: ${String(e)}`); }
  } else {
    warnings.push("Card offers section not found on page.");
  }

  if (ld?.banks.length) {
    enrichBanks(ld.banks, domBanks, detail);
    detail.banks = ld.banks;
  } else {
    if (domBanks.length) warnings.push("JSON-LD offers missing — using DOM-extracted offers only.");
    detail.banks = domBanks;
  }

  if (!detail.name || !detail.slug) {
    return {
      detail: null,
      health: { ...health, kind: "empty", detail: "Business name/slug not found" },
      warnings,
      error: "Business name or slug could not be extracted",
    };
  }
  return { detail, health, warnings };
}
