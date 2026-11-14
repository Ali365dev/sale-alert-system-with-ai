import type { TakhfifSession } from "../types/takhfif";
import { KEYS, get, log, saveSession } from "./takhfif-store";
import { ctl } from "./takhfif-tab";
import { resumeTakhfifListing } from "./takhfif-listing";
import { resumeTakhfifDetails } from "./takhfif-details";

// Mirrors the literal in takhfif-tab.ts beginRun (kept as literals to avoid
// a tab↔watchdog import cycle).
const ALARM = "dm_takhfif_watchdog";
const INTERRUPTED = "Interrupted — resume to continue";

/** Self-healing for unattended runs. Every minute (chrome.alarms survives
 * service-worker death — unlike the in-memory loop):
 *  - loop alive            → nothing to do; per-page timeouts bound every await
 *  - loop dead, "running"  → the worker was restarted mid-run: mark the phase
 *                            interrupted and auto-resume it
 *  - interrupted "paused"  → auto-resume (e.g. recovery ran before this tick)
 *  - protection pause      → NEVER auto-resumed (captcha / access restriction
 *                            needs a human) — pauseReason is set on those
 *  - nothing active        → clear the alarm
 */
async function tick(): Promise<void> {
  const s = await get<TakhfifSession>(KEYS.session);
  if (!s?.phase1) { chrome.alarms.clear(ALARM); return; }

  const p1 = s.phase1.status;
  const p2 = s.phase2?.status;
  const active = p1 === "running" || p2 === "running";
  const p1Interrupted = p1 === "paused" && !s.phase1.pauseReason && s.phase1.currentLabel === INTERRUPTED;
  const p2Interrupted = p2 === "paused" && !s.phase2.pauseReason && s.phase2.currentLabel === INTERRUPTED;

  if (!active && !p1Interrupted && !p2Interrupted) {
    chrome.alarms.clear(ALARM);
    return;
  }
  if (ctl.running !== "idle") return; // loop is alive and bounded — leave it be

  const detailsPhase = p2 === "running" || p2Interrupted;
  if (active) {
    if (p1 === "running") { s.phase1.status = "paused"; s.phase1.currentLabel = INTERRUPTED; }
    if (p2 === "running") { s.phase2.status = "paused"; s.phase2.currentLabel = INTERRUPTED; }
    await saveSession(s);
  }
  await log("warn", `Watchdog: run was interrupted — auto-resuming ${detailsPhase ? "detail" : "listing"} scraping.`);
  const res = detailsPhase ? await resumeTakhfifDetails() : await resumeTakhfifListing();
  if (!res.ok) await log("error", `Watchdog auto-resume failed: ${res.error ?? "unknown error"}.`);
}

export function initTakhfifWatchdog(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) void tick();
  });
  // Worker just started: if a run was interrupted, resume it right away
  // instead of waiting for the next alarm (also re-arms/clears as needed).
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  setTimeout(() => void tick(), 3_000); // after recoverTakhfifSession settles
}
