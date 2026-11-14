import type {
  TakhfifConfigSnapshot, TakhfifListing, TakhfifPageResult, TakhfifQueueItem, TakhfifSession,
} from "../types/takhfif";
import { newHealth, politeDelayMs, waitInterruptible } from "./takhfif-health";
import { scrapeListingPage } from "./takhfif-steps";
import type { StepIo } from "./takhfif-steps";
import { KEYS, get, log, normUrl, saveSession, set } from "./takhfif-store";
import { beginRun, closeScraperTab, ctl, endRun, interrupted, loadPage } from "./takhfif-tab";

async function finalize(session: TakhfifSession): Promise<void> {
  const p1 = session.phase1;
  if (p1.status === "completed") {
    p1.finishedAt = new Date().toISOString();
    p1.currentLabel = "Listing extraction completed";
    await log("success",
      `Listing extraction completed — ${p1.pagesCompleted} page(s), ${p1.saved} unique businesses, ${p1.duplicates} duplicates skipped, ${p1.failedPages.length} failed page(s).`);
    if (session.config.detailsEnabled) {
      const listings = (await get<TakhfifListing[]>(KEYS.listings)) ?? [];
      const queue: TakhfifQueueItem[] = listings.map((l) => ({
        detailUrl: l.detail_url, businessName: l.business_name,
        status: "pending", retries: 0, error: null,
      }));
      await set({ [KEYS.queue]: queue });
      session.phase2.status = "ready";
      session.phase2.queueSize = queue.length;
      await log("success", `Detail queue prepared — ${queue.length} unique detail URLs. Waiting for user action.`);
    } else {
      session.phase2.status = "disabled";
      await log("info", "Deal detail scraping disabled — only listings were extracted.");
    }
  } else if (p1.status === "stopped" || p1.status === "failed") {
    p1.finishedAt = new Date().toISOString();
  }
  await saveSession(session);
  // Keep the tab open on verification/access pauses so the user can resolve
  // the challenge in it; close it otherwise.
  const keepTab = p1.status === "paused"
    && (session.health.status === "verification_required" || session.health.status === "access_restricted");
  if (!keepTab) closeScraperTab();
  endRun();
}

async function run(session: TakhfifSession, seen: Set<string>): Promise<void> {
  const p1 = session.phase1;
  const cfg = session.config;
  const io: StepIo = {
    loadAndExtract: (url) =>
      loadPage<TakhfifPageResult>(url, cfg.navTimeoutMs, { type: "EXTRACT_TAKHFIF_LISTING_PAGE" }, interrupted),
    interrupted,
  };
  // Resume continues at the page AFTER the last fully completed one, so an
  // interrupted page is retried, never skipped.
  let page = Math.max(cfg.startPage, p1.lastCompletedPage + 1);
  const endPage = cfg.scrapeAllPages ? null : cfg.endPage;

  try {
    while (!interrupted()) {
      if (endPage != null && page > endPage) {
        p1.status = "completed";
        await log("success", `Reached configured end page ${endPage}.`);
        break;
      }
      if (p1.totalPages != null && page > p1.totalPages) {
        p1.status = "completed";
        await log("success", `Reached the last page (${p1.totalPages}).`);
        break;
      }

      const { outcome, result } = await scrapeListingPage(session, seen, io, page);
      if (outcome === "interrupted") break;

      if (outcome === "ok") {
        // The site reporting a different page than requested (redirect) or no
        // next link means the catalog ended here — even if endPage is higher.
        const reportedPage = result?.currentPage ?? page;
        const noNext = !result?.nextUrl;
        const pastEnd = p1.totalPages != null && page >= p1.totalPages;
        if (reportedPage !== page || noNext || pastEnd) {
          p1.status = "completed";
          if (reportedPage !== page) {
            await log("warn", `Site served page ${reportedPage} instead of ${page} — stopping at the catalog's end.`);
          }
          break;
        }
      }
      // outcome === "failed": page recorded in failedPages — move on if more
      // pages are known to exist, otherwise finish with what we have.
      if (outcome === "failed" && p1.totalPages == null) {
        p1.status = p1.saved > 0 ? "completed" : "failed";
        if (p1.status === "failed") p1.error = `Page ${page} failed and no further pages are known.`;
        break;
      }

      page++;
      await waitInterruptible(politeDelayMs(session.health), interrupted);
    }

    if (p1.status === "running") {
      if (ctl.stop) {
        p1.status = "stopped";
        p1.currentLabel = "Stopped by user";
        await log("warn", "Listing scraping stopped.");
      } else if (ctl.pause) {
        p1.status = "paused";
        p1.currentLabel = "Paused — resume to continue";
        await log("warn", "Listing scraping paused.");
      } else {
        p1.status = p1.saved > 0 ? "completed" : "failed";
        if (p1.status === "failed") p1.error = "No listings could be extracted.";
      }
    }
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
  const startPage = Math.max(1, Math.floor(config.startPage) || 1);
  if (!config.scrapeAllPages && config.endPage != null && config.endPage < startPage) {
    return { ok: false, error: "End page cannot be smaller than start page." };
  }
  const endPage = config.scrapeAllPages || config.endPage == null
    ? null : Math.max(startPage, Math.floor(config.endPage));
  if (!beginRun("listing")) return { ok: false, error: "A scraping session is already running." };

  const cfg: TakhfifConfigSnapshot = { ...config, startPage, endPage };
  const now = new Date().toISOString();
  const session: TakhfifSession = {
    sessionId: `${Date.now()}`,
    config: cfg,
    health: newHealth(Math.max(1000, cfg.delaySeconds * 1000)),
    phase1: {
      status: "running", currentPage: startPage, lastCompletedPage: startPage - 1,
      totalPages: null, pagesCompleted: 0,
      discovered: 0, saved: 0, duplicates: 0, failedPages: [],
      currentLabel: "Starting…", pauseReason: null, error: null,
      startedAt: now, finishedAt: null,
    },
    phase2: {
      status: cfg.detailsEnabled ? "waiting" : "disabled", queueSize: 0,
      processed: 0, completedCount: 0, failedCount: 0, tiersFound: 0, cardsFound: 0,
      currentLabel: "", pauseReason: null,
    },
    updatedAt: now,
  };
  await set({ [KEYS.session]: session, [KEYS.listings]: [], [KEYS.queue]: [], [KEYS.details]: {}, [KEYS.logs]: [] });
  await log("info",
    `Listing scraping started — ${cfg.scrapeAllPages ? "all pages" : `pages ${startPage}–${endPage ?? "end"}`}, details ${cfg.detailsEnabled ? "enabled" : "disabled"}.`);
  void run(session, new Set());
  return { ok: true };
}

export function pauseTakhfifListing(): Promise<{ ok: boolean; error?: string }> {
  if (ctl.running !== "listing") return Promise.resolve({ ok: false, error: "No running listing session." });
  ctl.pause = true;
  return Promise.resolve({ ok: true });
}

export async function stopTakhfifListing(): Promise<{ ok: boolean }> {
  if (ctl.running === "listing") { ctl.stop = true; return { ok: true }; }
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
  const session = await get<TakhfifSession>(KEYS.session);
  if (!session || session.phase1.status !== "paused") {
    return { ok: false, error: "No paused session to resume." };
  }
  if (!session.health || !Array.isArray(session.phase1.failedPages)) {
    return { ok: false, error: "Session was created by an older version — start a new session." };
  }
  if (!beginRun("listing")) return { ok: false, error: "A scraping session is already running." };
  const listings = (await get<TakhfifListing[]>(KEYS.listings)) ?? [];
  const seen = new Set(listings.map((l) => normUrl(l.detail_url)));
  session.phase1.status = "running";
  session.phase1.pauseReason = null;
  session.phase1.error = null;
  session.health.status = "healthy";
  await saveSession(session);
  const nextPage = Math.max(session.config.startPage, session.phase1.lastCompletedPage + 1);
  await log("info", `Resuming listing scraping from page ${nextPage} (last completed: ${session.phase1.lastCompletedPage || "none"}).`);
  void run(session, seen);
  return { ok: true };
}

export async function clearTakhfifSession(): Promise<{ ok: boolean; error?: string }> {
  if (ctl.running !== "idle") return { ok: false, error: "Stop the running session first." };
  closeScraperTab();
  await new Promise<void>((res) =>
    chrome.storage.local.remove([KEYS.session, KEYS.listings, KEYS.queue, KEYS.details, KEYS.logs], () => res()));
  return { ok: true };
}

/** Called at service-worker startup: a session left "running" after a worker
 * restart means the loop died — surface it as paused so the user can resume. */
export function recoverTakhfifSession(): void {
  chrome.storage.local.get(KEYS.session, (r) => {
    const s = r[KEYS.session] as TakhfifSession | undefined;
    if (!s || ctl.running !== "idle") return;
    let dirty = false;
    if (s.phase1.status === "running") {
      s.phase1.status = "paused";
      s.phase1.currentLabel = "Interrupted — resume to continue";
      dirty = true;
    }
    if (s.phase2?.status === "running") {
      s.phase2.status = "paused";
      s.phase2.currentLabel = "Interrupted — resume to continue";
      dirty = true;
    }
    if (dirty) {
      s.updatedAt = new Date().toISOString();
      chrome.storage.local.set({ [KEYS.session]: s });
    }
  });
}
