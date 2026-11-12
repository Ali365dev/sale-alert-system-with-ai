import type {
  TakhfifConfigSnapshot, TakhfifListing, TakhfifLogEntry,
  TakhfifPageResult, TakhfifQueueItem, TakhfifSession,
} from "../types/takhfif";

// Storage keys also appear as string literals in the popup — the takhfif types
// module must stay type-only so content.js doesn't gain a shared import chunk.
const KEYS = {
  session: "dm_takhfif_session",
  listings: "dm_takhfif_listings",
  queue: "dm_takhfif_detail_queue",
  logs: "dm_takhfif_logs",
} as const;

const LISTING_URL = "https://takhfif.app/deals";

interface Ctl { running: boolean; pause: boolean; stop: boolean; tabId: number | null; }
const ctl: Ctl = { running: false, pause: false, stop: false, tabId: null };

// MV3 service workers die after ~30s idle; periodic storage reads keep them alive
let keepAlive: ReturnType<typeof setInterval> | null = null;
function startKeepAlive() {
  if (!keepAlive) keepAlive = setInterval(() => chrome.storage.local.get(KEYS.session, () => {}), 20_000);
}
function stopKeepAlive() {
  if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
}

function get<T>(key: string): Promise<T | undefined> {
  return new Promise((res) => chrome.storage.local.get(key, (r) => res(r[key] as T | undefined)));
}
function set(items: Record<string, unknown>): Promise<void> {
  return new Promise((res) => chrome.storage.local.set(items, () => res()));
}
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function log(level: TakhfifLogEntry["level"], message: string): Promise<void> {
  const logs = (await get<TakhfifLogEntry[]>(KEYS.logs)) ?? [];
  logs.unshift({ time: new Date().toLocaleTimeString("en-US", { hour12: false }), level, message });
  await set({ [KEYS.logs]: logs.slice(0, 300) });
}

async function saveSession(s: TakhfifSession): Promise<void> {
  s.updatedAt = new Date().toISOString();
  await set({ [KEYS.session]: s });
}

function pageFromUrl(url: string): number {
  try { return parseInt(new URL(url).searchParams.get("page") ?? "1", 10) || 1; } catch { return 1; }
}
function urlForPage(page: number): string {
  return page <= 1 ? LISTING_URL : `${LISTING_URL}?page=${page}`;
}

function waitForComplete(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        setTimeout(resolve, 1000); // let client-side rendering settle
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sendToTab(tabId: number, msg: object): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

/** Reuses the dedicated scraper tab if it is still open, otherwise creates a
 * new inactive one. Never touches the user's own browsing tabs. */
async function ensureTab(url: string): Promise<number> {
  if (ctl.tabId != null) {
    const alive = await new Promise<boolean>((res) =>
      chrome.tabs.get(ctl.tabId!, (t) => res(!chrome.runtime.lastError && !!t)));
    if (alive) {
      await new Promise<void>((res) => chrome.tabs.update(ctl.tabId!, { url }, () => res()));
      return ctl.tabId!;
    }
    ctl.tabId = null;
  }
  const tab = await new Promise<chrome.tabs.Tab>((res) => chrome.tabs.create({ url, active: false }, res));
  if (tab.id == null) throw new Error("Could not create scraper tab");
  ctl.tabId = tab.id;
  return tab.id;
}

async function extractFromTab(tabId: number): Promise<TakhfifPageResult | null> {
  let res = await sendToTab(tabId, { type: "EXTRACT_TAKHFIF_LISTING_PAGE" });
  if (res === null) {
    await new Promise<void>((r) =>
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => setTimeout(r, 500)));
    res = await sendToTab(tabId, { type: "EXTRACT_TAKHFIF_LISTING_PAGE" });
  }
  return res as TakhfifPageResult | null;
}

async function processPage(url: string, cfg: TakhfifConfigSnapshot): Promise<TakhfifPageResult | null> {
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      const tabId = await ensureTab(url);
      await waitForComplete(tabId, cfg.navTimeoutMs);
      const result = await extractFromTab(tabId);
      if (result && result.listings.length > 0) return result;
      if (result && attempt === cfg.maxRetries) return result;
    } catch { /* retry */ }
    if (attempt < cfg.maxRetries) {
      await log("warn", `Page ${pageFromUrl(url)} attempt ${attempt + 1} failed — retrying.`);
      await sleep(1500);
    }
  }
  return null;
}

async function finalize(session: TakhfifSession): Promise<void> {
  const p1 = session.phase1;
  if (p1.status === "completed") {
    p1.finishedAt = new Date().toISOString();
    p1.nextUrl = null;
    p1.currentLabel = "Listing extraction completed";
    await log("success",
      `Listing extraction completed — ${p1.saved} unique businesses, ${p1.duplicates} duplicates skipped, ${p1.failedPages.length} failed page(s).`);
    if (session.config.detailsEnabled) {
      const listings = (await get<TakhfifListing[]>(KEYS.listings)) ?? [];
      const queue: TakhfifQueueItem[] = listings.map((l) => ({
        detailUrl: l.detail_url, businessName: l.business_name,
        status: "pending", retries: 0, error: null,
      }));
      await set({ [KEYS.queue]: queue });
      session.phase2 = { status: "ready", queueSize: queue.length };
      await log("success", `Detail queue prepared — ${queue.length} unique detail URLs. Waiting for user action.`);
    } else {
      session.phase2 = { status: "disabled", queueSize: 0 };
      await log("info", "Deal detail scraping disabled — only listings were extracted.");
    }
  } else if (p1.status === "stopped" || p1.status === "failed") {
    p1.finishedAt = new Date().toISOString();
  }
  await saveSession(session);
  if (ctl.tabId != null) { chrome.tabs.remove(ctl.tabId).catch(() => {}); ctl.tabId = null; }
  ctl.running = false; ctl.pause = false; ctl.stop = false;
  stopKeepAlive();
}

async function loop(session: TakhfifSession, startUrl: string, seen: Set<string>): Promise<void> {
  ctl.running = true; ctl.pause = false; ctl.stop = false;
  startKeepAlive();
  const p1 = session.phase1;
  const visited = new Set<string>();
  let lastPageNo = -1;
  let url: string | null = startUrl;

  try {
    while (url) {
      if (ctl.stop || ctl.pause) {
        p1.status = ctl.stop ? "stopped" : "paused";
        p1.nextUrl = url;
        p1.currentLabel = ctl.stop ? "Stopped by user" : "Paused — resume to continue";
        await log("warn", ctl.stop ? "Listing scraping stopped." : "Listing scraping paused.");
        break;
      }
      if (visited.has(url)) {
        await log("warn", "Navigation loop detected — finishing session.");
        p1.status = "completed";
        break;
      }
      visited.add(url);

      const pageNo = pageFromUrl(url);
      p1.currentPage = pageNo;
      p1.currentLabel = p1.totalPages ? `Scraping page ${pageNo} of ${p1.totalPages}…` : `Scraping page ${pageNo}…`;
      await saveSession(session);

      const result = await processPage(url, session.config);

      if (!result || (result.error && result.listings.length === 0)) {
        p1.failedPages.push(pageNo);
        await log("error", `Page ${pageNo} failed${result?.error ? `: ${result.error}` : " after retries"}.`);
        if (p1.totalPages && pageNo < p1.totalPages) {
          url = urlForPage(pageNo + 1);
          await sleep(session.config.delaySeconds * 1000);
          continue;
        }
        p1.status = p1.saved > 0 ? "completed" : "failed";
        p1.error = `Page ${pageNo} failed and no further pages are known.`;
        break;
      }

      if (result.totalPages) p1.totalPages = result.totalPages;
      if (result.currentPage != null) {
        if (result.currentPage === lastPageNo) {
          await log("warn", `Site returned page ${lastPageNo} again — finishing session.`);
          p1.status = "completed";
          break;
        }
        lastPageNo = result.currentPage;
        p1.currentPage = result.currentPage;
      }

      const fresh: TakhfifListing[] = [];
      for (const l of result.listings) {
        if (seen.has(l.detail_url)) { p1.duplicates++; continue; }
        seen.add(l.detail_url);
        fresh.push(l);
      }
      p1.discovered += result.listings.length;
      p1.saved += fresh.length;
      p1.pagesCompleted++;
      if (fresh.length) {
        const existing = (await get<TakhfifListing[]>(KEYS.listings)) ?? [];
        await set({ [KEYS.listings]: existing.concat(fresh) });
      }
      const last = fresh[fresh.length - 1];
      if (last) p1.currentLabel = `Extracted ${last.business_name}`;
      await saveSession(session);
      await log("info",
        `Page ${p1.currentPage}${p1.totalPages ? ` of ${p1.totalPages}` : ""}: ${result.listings.length} cards, ${fresh.length} new.`);

      if (!session.config.scrapeAllPages && p1.pagesCompleted >= session.config.maxPages) {
        p1.status = "completed";
        await log("success", `Reached configured limit of ${session.config.maxPages} page(s).`);
        break;
      }
      if (!result.nextUrl || (p1.totalPages != null && p1.currentPage >= p1.totalPages)) {
        p1.status = "completed";
        break;
      }
      url = result.nextUrl;
      await sleep(Math.max(300, session.config.delaySeconds * 1000));
    }
    if (p1.status === "running") p1.status = "completed";
  } catch (err) {
    p1.status = "failed";
    p1.error = err instanceof Error ? err.message : String(err);
    await log("error", `Listing scraping crashed: ${p1.error}`);
  } finally {
    await finalize(session);
  }
}

// ── Public API (called from the service worker's message handler) ─────────────

export async function startTakhfifListing(config: TakhfifConfigSnapshot): Promise<{ ok: boolean; error?: string }> {
  if (ctl.running) return { ok: false, error: "A listing session is already running." };
  const now = new Date().toISOString();
  const session: TakhfifSession = {
    sessionId: `${Date.now()}`,
    config,
    phase1: {
      status: "running", currentPage: 0, totalPages: null, pagesCompleted: 0,
      discovered: 0, saved: 0, duplicates: 0, failedPages: [],
      nextUrl: null, currentLabel: "Starting…", error: null, startedAt: now, finishedAt: null,
    },
    phase2: { status: config.detailsEnabled ? "waiting" : "disabled", queueSize: 0 },
    updatedAt: now,
  };
  await set({ [KEYS.session]: session, [KEYS.listings]: [], [KEYS.queue]: [], [KEYS.logs]: [] });
  await log("info",
    `Listing scraping started — ${config.scrapeAllPages ? "all pages" : `up to ${config.maxPages} page(s)`}, details ${config.detailsEnabled ? "enabled" : "disabled"}.`);
  void loop(session, LISTING_URL, new Set());
  return { ok: true };
}

export function pauseTakhfifListing(): Promise<{ ok: boolean; error?: string }> {
  if (!ctl.running) return Promise.resolve({ ok: false, error: "No running session." });
  ctl.pause = true;
  return Promise.resolve({ ok: true });
}

export async function stopTakhfifListing(): Promise<{ ok: boolean }> {
  if (ctl.running) { ctl.stop = true; return { ok: true }; }
  const s = await get<TakhfifSession>(KEYS.session);
  if (s && s.phase1.status === "paused") {
    s.phase1.status = "stopped";
    s.phase1.currentLabel = "Stopped by user";
    s.phase1.finishedAt = new Date().toISOString();
    await saveSession(s);
    await log("warn", "Paused session stopped.");
  }
  return { ok: true };
}

export async function resumeTakhfifListing(): Promise<{ ok: boolean; error?: string }> {
  if (ctl.running) return { ok: false, error: "Already running." };
  const session = await get<TakhfifSession>(KEYS.session);
  if (!session || session.phase1.status !== "paused") {
    return { ok: false, error: "No paused session to resume." };
  }
  const listings = (await get<TakhfifListing[]>(KEYS.listings)) ?? [];
  const seen = new Set(listings.map((l) => l.detail_url));
  const url = session.phase1.nextUrl ?? urlForPage(Math.max(1, session.phase1.currentPage));
  session.phase1.status = "running";
  session.phase1.nextUrl = null;
  session.phase1.error = null;
  await saveSession(session);
  await log("info", `Resuming listing scraping from page ${pageFromUrl(url)}.`);
  void loop(session, url, seen);
  return { ok: true };
}

export async function clearTakhfifSession(): Promise<{ ok: boolean; error?: string }> {
  if (ctl.running) return { ok: false, error: "Stop the running session first." };
  await new Promise<void>((res) =>
    chrome.storage.local.remove([KEYS.session, KEYS.listings, KEYS.queue, KEYS.logs], () => res()));
  return { ok: true };
}

/** Called at service-worker startup: a session left "running" after a worker
 * restart means the loop died — surface it as paused so the user can resume. */
export function recoverTakhfifSession(): void {
  chrome.storage.local.get(KEYS.session, (r) => {
    const s = r[KEYS.session] as TakhfifSession | undefined;
    if (s && s.phase1.status === "running" && !ctl.running) {
      s.phase1.status = "paused";
      s.phase1.nextUrl = s.phase1.nextUrl ?? urlForPage(Math.max(1, s.phase1.currentPage));
      s.phase1.currentLabel = "Interrupted — resume to continue";
      s.updatedAt = new Date().toISOString();
      chrome.storage.local.set({ [KEYS.session]: s });
    }
  });
}
