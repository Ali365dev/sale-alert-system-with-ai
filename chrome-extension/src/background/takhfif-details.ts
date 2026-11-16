import type {
  TakhfifBusinessDetail, TakhfifDetailMode, TakhfifDetailResult,
  TakhfifQueueItem, TakhfifSession,
} from "../types/takhfif";
import { bumpDelay, pauseFor, politeDelayMs, recordFailure, recordOk, waitInterruptible } from "./takhfif-health";
import { KEYS, get, log, normUrl, saveSession, set, slugOf } from "./takhfif-store";
import { beginRun, closeScraperTab, ctl, endRun, interrupted, loadPage } from "./takhfif-tab";

type DetailsStore = Record<string, TakhfifBusinessDetail>;

/** Merges a fresh extraction over an existing record: business fields are
 * updated, matching banks/branches replaced, missing ones kept — a bank absent
 * from one extraction is never deleted. */
function mergeDetail(prev: TakhfifBusinessDetail | undefined, next: TakhfifBusinessDetail): TakhfifBusinessDetail {
  if (!prev) return next;
  const banks = [...next.banks];
  for (const old of prev.banks) {
    if (!banks.some((b) => b.bankName.toLowerCase() === old.bankName.toLowerCase())) banks.push(old);
  }
  const branches = [...next.branches];
  for (const old of prev.branches) {
    if (!branches.some((b) => b.name.toLowerCase() === old.name.toLowerCase())) branches.push(old);
  }
  return { ...prev, ...next, banks, branches, gallery: next.gallery.length ? next.gallery : prev.gallery };
}


async function runDetails(session: TakhfifSession, queue: TakhfifQueueItem[], only?: Set<string>): Promise<void> {
  const p2 = session.phase2;
  const cfg = session.config;
  try {
    for (;;) {
      if (interrupted()) break;
      const item = queue.find((q) => q.status === "pending" && (!only || only.has(q.detailUrl)));
      if (!item) { p2.status = "completed"; break; }

      item.status = "processing";
      await set({ [KEYS.queue]: queue });
      p2.currentLabel = `Extracting ${item.businessName}…`;
      await saveSession(session);

      let res: TakhfifDetailResult | null = null;
      try {
        res = await loadPage<TakhfifDetailResult>(item.detailUrl, cfg.navTimeoutMs, { type: "EXTRACT_TAKHFIF_DETAIL" }, interrupted);
      } catch { /* handled below */ }
      // User may have paused/stopped while loadPage was running — honour it now.
      if (interrupted()) { item.status = "pending"; await set({ [KEYS.queue]: queue }); break; }
      const health = res?.health ?? null;

      if (health && health.kind !== "ok" && health.kind !== "empty") {
        recordFailure(session.health, health, "Detail page blocked");
        const pause = pauseFor(health, item.retries, cfg.maxRetries);
        item.status = "pending"; // retried on resume
        await set({ [KEYS.queue]: queue });
        if (pause) {
          p2.status = "paused";
          p2.pauseReason = pause.reason;
          p2.currentLabel = "Paused by website protection";
          await log("error", pause.reason);
          break;
        }
        item.retries++;
        bumpDelay(session.health);
        await saveSession(session);
        await log("warn", `${health.detail ?? health.kind} on ${item.businessName} — retrying after cooldown.`);
        await waitInterruptible(session.health.currentDelayMs * 2, interrupted);
        continue;
      }

      if (res?.detail?.name && res.detail.canonicalUrl) {
        const detail = res.detail;
        const store = (await get<DetailsStore>(KEYS.details)) ?? {};
        // Local save only — the reviewed "Save to backend" action pushes later.
        store[detail.slug] = mergeDetail(store[detail.slug], detail);
        await set({ [KEYS.details]: store });

        const tiers = detail.banks.reduce((n, b) => n + b.tiers.length, 0);
        const cards = detail.banks.reduce((n, b) => n + b.tiers.reduce((m, t) => m + t.cards.length, 0), 0);
        recordOk(session.health, cfg.delaySeconds * 1000, health?.loadTimeMs);
        item.status = "completed";
        item.error = null;
        p2.processed++;
        p2.completedCount++;
        p2.tiersFound += tiers;
        p2.cardsFound += cards;
        await set({ [KEYS.queue]: queue });
        await saveSession(session);
        await log("success",
          `${detail.name}: ${detail.banks.length} bank(s), ${tiers} tier(s), ${cards} card(s), ${detail.branches.length} branch(es)${detail.warnings.length ? `, ${detail.warnings.length} warning(s)` : ""}.`);
      } else {
        recordFailure(session.health, health, res?.error ?? "Extraction returned no business data");
        item.retries++;
        if (item.retries > cfg.maxRetries) {
          item.status = "failed";
          item.error = res?.error ?? "Extraction failed after retries";
          p2.processed++;
          p2.failedCount++;
          await log("error", `${item.businessName}: ${item.error}`);
        } else {
          item.status = "pending";
          bumpDelay(session.health);
          await log("warn", `${item.businessName} attempt ${item.retries} failed — retrying.`);
        }
        await set({ [KEYS.queue]: queue });
        await saveSession(session);
      }

      await waitInterruptible(politeDelayMs(session.health), interrupted);
    }

    if (p2.status === "running") {
      if (ctl.stop) { p2.status = "stopped"; p2.currentLabel = "Stopped by user"; await log("warn", "Detail scraping stopped."); }
      else if (ctl.pause) { p2.status = "paused"; p2.currentLabel = "Paused — resume to continue"; await log("warn", "Detail scraping paused."); }
    }
    if (p2.status === "completed") {
      p2.currentLabel = "Detail extraction completed";
      await log("success",
        `Detail extraction completed — ${p2.completedCount} business(es), ${p2.tiersFound} offer tier(s), ${p2.cardsFound} card offer(s), ${p2.failedCount} failed.`);
    }
  } catch (err) {
    p2.status = "failed";
    p2.pauseReason = null;
    p2.currentLabel = err instanceof Error ? err.message : String(err);
    await log("error", `Detail scraping crashed: ${p2.currentLabel}`);
  } finally {
    await saveSession(session);
    const keepTab = p2.status === "paused"
      && (session.health.status === "verification_required" || session.health.status === "access_restricted");
    if (!keepTab) closeScraperTab();
    endRun();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startTakhfifDetails(mode: TakhfifDetailMode): Promise<{ ok: boolean; error?: string }> {
  const session = await get<TakhfifSession>(KEYS.session);
  const queue = (await get<TakhfifQueueItem[]>(KEYS.queue)) ?? [];
  if (!session || !queue.length) return { ok: false, error: "No detail queue — run listing scraping first." };
  if (session.phase2.status === "running") return { ok: false, error: "Detail scraping is already running." };

  const details = (await get<DetailsStore>(KEYS.details)) ?? {};
  let selected = 0;
  for (const item of queue) {
    if (item.status === "processing") item.status = "pending"; // recover interrupted
    // A business is "fully scraped" only if it has bank-offer data — a listing
    // skeleton (banks: []) means it was discovered but never detail-scraped.
    const detail = details[slugOf(item.detailUrl)];
    const isFullyScraped = !!(detail?.banks?.length || detail?.pushedAt);
    const pick =
      mode === "all" ? true :
      mode === "failed" ? item.status === "failed" :
      mode === "existing" ? isFullyScraped :
      /* new */ !isFullyScraped && item.status !== "completed";
    if (pick) {
      item.status = "pending";
      item.error = null;
      if (mode === "failed") item.retries = 0;
      selected++;
    }
  }
  if (!selected) return { ok: false, error: "No businesses match the selected mode." };
  if (!beginRun("details")) return { ok: false, error: "A scraping session is already running." };

  session.phase2 = {
    ...session.phase2,
    status: "running", queueSize: selected,
    processed: 0, completedCount: 0, failedCount: 0, tiersFound: 0, cardsFound: 0,
    currentLabel: "Starting detail scraping…", pauseReason: null,
  };
  await set({ [KEYS.queue]: queue });
  await saveSession(session);
  await log("info", `Detail scraping started by user — ${selected} business(es), mode: ${mode}.`);
  void runDetails(session, queue);
  return { ok: true };
}

/** Scrapes ONE business's detail page on demand (row action in All Deals) and
 * merges the result into the stored bank-offers data like any other run. */
export async function startTakhfifSingleDetail(detailUrl: string): Promise<{ ok: boolean; error?: string }> {
  const session = await get<TakhfifSession>(KEYS.session);
  if (!session) return { ok: false, error: "No session — run listing scraping first." };
  const queue = (await get<TakhfifQueueItem[]>(KEYS.queue)) ?? [];
  let item = queue.find((q) => q.detailUrl === detailUrl);
  if (!item) {
    const store = (await get<DetailsStore>(KEYS.details)) ?? {};
    const existing = Object.values(store).find((d) => normUrl(d.canonicalUrl) === normUrl(detailUrl));
    item = {
      detailUrl,
      businessName: existing?.name ?? slugOf(detailUrl).replace(/-/g, " "),
      status: "pending", retries: 0, error: null,
    };
    queue.push(item);
  }
  if (!beginRun("details")) return { ok: false, error: "A scraping session is already running." };
  item.status = "pending";
  item.retries = 0;
  item.error = null;
  session.phase2 = {
    ...session.phase2,
    status: "running", queueSize: 1,
    processed: 0, completedCount: 0, failedCount: 0, tiersFound: 0, cardsFound: 0,
    currentLabel: `Extracting ${item.businessName}…`, pauseReason: null,
  };
  await set({ [KEYS.queue]: queue });
  await saveSession(session);
  await log("info", `Single detail scrape started — ${item.businessName}.`);
  void runDetails(session, queue, new Set([detailUrl]));
  return { ok: true };
}

export function pauseTakhfifDetails(): Promise<{ ok: boolean; error?: string }> {
  if (ctl.running !== "details") return Promise.resolve({ ok: false, error: "No running detail session." });
  ctl.pause = true;
  return Promise.resolve({ ok: true });
}

export async function stopTakhfifDetails(): Promise<{ ok: boolean }> {
  if (ctl.running === "details") { ctl.stop = true; return { ok: true }; }
  const s = await get<TakhfifSession>(KEYS.session);
  if (s && s.phase2.status === "paused") {
    s.phase2.status = "stopped";
    s.phase2.currentLabel = "Stopped by user";
    await saveSession(s);
    await log("warn", "Paused detail session stopped.");
  }
  return { ok: true };
}

export async function resumeTakhfifDetails(): Promise<{ ok: boolean; error?: string }> {
  const session = await get<TakhfifSession>(KEYS.session);
  if (!session || session.phase2.status !== "paused") {
    return { ok: false, error: "No paused detail session to resume." };
  }
  const queue = (await get<TakhfifQueueItem[]>(KEYS.queue)) ?? [];
  if (!beginRun("details")) return { ok: false, error: "A scraping session is already running." };
  for (const item of queue) if (item.status === "processing") item.status = "pending";
  session.phase2.status = "running";
  session.phase2.pauseReason = null;
  session.health.status = "healthy";
  await set({ [KEYS.queue]: queue });
  await saveSession(session);
  await log("info", "Resuming detail scraping.");
  void runDetails(session, queue);
  return { ok: true };
}
