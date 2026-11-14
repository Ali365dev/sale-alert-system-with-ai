import type { TakhfifPageResult, TakhfifSession } from "../types/takhfif";
import {
  RATE_LIMIT_COOLDOWN_MS, bumpDelay, pauseFor, recordFailure, recordOk, waitInterruptible,
} from "./takhfif-health";
import { appendListings, log, saveSession, urlForPage } from "./takhfif-store";

export type StepOutcome = "ok" | "failed" | "interrupted";

export interface PageStepResult {
  outcome: StepOutcome;
  result?: TakhfifPageResult;
}

/** What a step needs from the orchestrator: tab-driven extraction and the
 * stop/pause signal. */
export interface StepIo {
  loadAndExtract: (url: string) => Promise<TakhfifPageResult | null>;
  interrupted: () => boolean;
}

function pauseSession(session: TakhfifSession, reason: string): void {
  session.phase1.status = "paused";
  session.phase1.pauseReason = reason;
  session.phase1.currentLabel = "Paused by website protection";
}

/** Scrapes one listing page with full health protection. A page counts as
 * completed only after its listings are saved, so an interrupted page is
 * retried on resume, never skipped. */
export async function scrapeListingPage(
  session: TakhfifSession, seen: Set<string>, io: StepIo, pageNo: number,
): Promise<PageStepResult> {
  const p1 = session.phase1;
  const attempts = { rate: 0, server: 0, conn: 0 };
  p1.currentPage = pageNo;

  while (true) {
    if (io.interrupted()) return { outcome: "interrupted" };
    p1.currentLabel = p1.totalPages
      ? `Scraping page ${pageNo} of ${p1.totalPages}…`
      : `Scraping page ${pageNo}…`;
    await saveSession(session);

    let result: TakhfifPageResult | null = null;
    try { result = await io.loadAndExtract(urlForPage(pageNo)); } catch { /* handled below */ }
    const health = result?.health ?? null;

    if (result && result.listings.length > 0) {
      const fresh = await appendListings(session, seen, result.listings);
      recordOk(session.health, session.config.delaySeconds * 1000, health?.loadTimeMs);
      if (result.totalPages) p1.totalPages = result.totalPages;
      p1.lastCompletedPage = pageNo;
      p1.pagesCompleted++;
      const last = result.listings[result.listings.length - 1];
      p1.currentLabel = last ? `Extracted ${last.business_name}` : p1.currentLabel;
      await saveSession(session);
      await log("info",
        `Page ${pageNo}${p1.totalPages ? ` of ${p1.totalPages}` : ""}: ${result.listings.length} cards, ${fresh} new.`);
      return { outcome: "ok", result };
    }

    recordFailure(session.health, health, "Page load failed or timed out");
    await saveSession(session);

    if (health && health.kind !== "empty") {
      const attemptCount = health.kind === "rate_limited" ? attempts.rate++ : attempts.server++;
      const pause = pauseFor(health, attemptCount, session.config.maxRetries);
      if (pause) {
        pauseSession(session, pause.reason);
        await log("error", pause.reason);
        return { outcome: "interrupted" };
      }
      bumpDelay(session.health);
      const cooldown = health.kind === "rate_limited" ? RATE_LIMIT_COOLDOWN_MS : session.health.currentDelayMs * 2;
      await log("warn", `${health.detail ?? health.kind} — retrying page ${pageNo} in ${Math.round(cooldown / 1000)}s.`);
      await waitInterruptible(cooldown, io.interrupted);
      continue;
    }

    // "empty" can legitimately mean the configured page is past the catalog's
    // end — report it upward instead of hammering retries.
    if (health?.kind === "empty") {
      const total = result?.totalPages ?? null;
      if (total == null ? result?.nextUrl == null : pageNo > total) {
        if (total) p1.totalPages = total;
        p1.currentLabel = `Page ${pageNo} has no deal cards`;
        await saveSession(session);
        await log("warn", `Page ${pageNo} has no deal cards — treating as end of catalog.`);
        return { outcome: "ok", result: { ...(result as TakhfifPageResult), listings: [], nextUrl: null } };
      }
    }

    if (++attempts.conn > session.config.maxRetries) {
      p1.failedPages.push(pageNo);
      await saveSession(session);
      await log("error", `Page ${pageNo} failed after retries.`);
      return { outcome: "failed" };
    }
    bumpDelay(session.health);
    await log("warn", `Page ${pageNo} attempt ${attempts.conn} failed — retrying.`);
    await waitInterruptible(session.health.currentDelayMs, io.interrupted);
  }
}
