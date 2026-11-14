import type { TakhfifHealth, TakhfifPageHealth } from "../types/takhfif";

const MAX_DELAY_MS = 20_000;
const SLOW_LOAD_MS = 12_000;
export const RATE_LIMIT_COOLDOWN_MS = 60_000;

export function newHealth(minDelayMs: number): TakhfifHealth {
  return {
    status: "healthy",
    okLoads: 0,
    failedLoads: 0,
    rateLimitEvents: 0,
    currentDelayMs: minDelayMs,
    lastSuccessAt: null,
    lastError: null,
  };
}

/** Backs off when the site shows strain. Never exceeds MAX_DELAY_MS. */
export function bumpDelay(h: TakhfifHealth, factor = 1.5): void {
  h.currentDelayMs = Math.min(MAX_DELAY_MS, Math.round(h.currentDelayMs * factor));
}

/** Eases back toward (never below) the configured minimum after successes. */
function decayDelay(h: TakhfifHealth, minDelayMs: number): void {
  h.currentDelayMs = Math.max(minDelayMs, Math.round(h.currentDelayMs * 0.9));
}

export function recordOk(h: TakhfifHealth, minDelayMs: number, loadTimeMs?: number): void {
  h.okLoads++;
  h.lastSuccessAt = new Date().toISOString();
  if (loadTimeMs != null && loadTimeMs > SLOW_LOAD_MS) {
    h.status = "slow";
    bumpDelay(h, 1.2);
  } else {
    h.status = "healthy";
    decayDelay(h, minDelayMs);
  }
}

export function recordFailure(h: TakhfifHealth, page: TakhfifPageHealth | null, fallback: string): void {
  h.failedLoads++;
  h.lastError = page?.detail ?? fallback;
  if (page?.kind === "rate_limited") h.rateLimitEvents++;
  h.status =
    page?.kind === "captcha" ? "verification_required" :
    page?.kind === "access_denied" ? "access_restricted" :
    page?.kind === "rate_limited" ? "rate_limited" :
    "connection_error";
}

/** Delay with jitter so request timing isn't perfectly periodic. */
export function politeDelayMs(h: TakhfifHealth): number {
  return h.currentDelayMs + Math.floor(Math.random() * 1000);
}

/** Sleeps in 500ms slices so stop/pause requests interrupt long cooldowns. */
export async function waitInterruptible(ms: number, cancelled: () => boolean): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end && !cancelled()) {
    await new Promise((res) => setTimeout(res, Math.min(500, end - Date.now())));
  }
}

export interface HealthPause {
  reason: string;
}

/** Protection policy for a page-level problem: either pause the whole session
 * (returned object) or allow another attempt (null). Challenges always pause —
 * they must be resolved manually, never bypassed. */
export function pauseFor(page: TakhfifPageHealth, attempts: number, maxRetries: number): HealthPause | null {
  switch (page.kind) {
    case "captcha":
      return { reason: "Verification challenge detected. Solve it in the opened takhfif.app tab, then resume." };
    case "access_denied":
      return { reason: "The website restricted access (HTTP 403). Automated scraping paused — do not resume until access is confirmed." };
    case "rate_limited":
      return attempts >= 1
        ? { reason: "Repeated rate-limit responses (HTTP 429). Paused to respect the website — resume later." }
        : null;
    case "server_error":
      return attempts >= maxRetries
        ? { reason: "Repeated server errors from the website. Paused to avoid adding load — resume later." }
        : null;
    default:
      return null;
  }
}
