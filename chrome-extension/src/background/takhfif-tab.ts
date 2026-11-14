import { KEYS } from "./takhfif-store";

/** Shared run control for both phases — only one phase can run at a time,
 * both drive the same dedicated inactive scraper tab. */
export interface Ctl {
  running: "idle" | "listing" | "details";
  pause: boolean;
  stop: boolean;
  tabId: number | null;
}
export const ctl: Ctl = { running: "idle", pause: false, stop: false, tabId: null };
export const interrupted = (): boolean => ctl.stop || ctl.pause;

export function beginRun(kind: "listing" | "details"): boolean {
  if (ctl.running !== "idle") return false;
  ctl.running = kind;
  ctl.pause = false;
  ctl.stop = false;
  startKeepAlive();
  // Watchdog alarm survives service-worker death and auto-resumes the run
  // (takhfif-watchdog.ts). Literal name — mirrored there.
  chrome.alarms.create("dm_takhfif_watchdog", { periodInMinutes: 1 });
  return true;
}

export function endRun(): void {
  ctl.running = "idle";
  ctl.pause = false;
  ctl.stop = false;
  stopKeepAlive();
}

// MV3 service workers die after ~30s idle; periodic storage reads keep them alive
let keepAlive: ReturnType<typeof setInterval> | null = null;
function startKeepAlive() {
  if (!keepAlive) keepAlive = setInterval(() => chrome.storage.local.get(KEYS.session, () => {}), 20_000);
}
function stopKeepAlive() {
  if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
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

/** One dedicated inactive scraper tab, reused across loads. Never touches the
 * user's own browsing tabs. */
async function ensureTab(url: string): Promise<number> {
  if (ctl.tabId != null) {
    const alive = await new Promise<boolean>((res) =>
      chrome.tabs.get(ctl.tabId!, (t) => res(!chrome.runtime.lastError && !!t)));
    if (alive) {
      // Tab may have been closed between the get() check and update() — treat
      // a lastError here as "tab gone" and fall through to create a new one.
      const updated = await new Promise<boolean>((res) =>
        chrome.tabs.update(ctl.tabId!, { url }, () => res(!chrome.runtime.lastError)));
      if (updated) return ctl.tabId!;
    }
    ctl.tabId = null;
  }
  const tab = await new Promise<chrome.tabs.Tab>((res) => chrome.tabs.create({ url, active: false }, res));
  if (tab.id == null) throw new Error("Could not create scraper tab");
  ctl.tabId = tab.id;
  return tab.id;
}

export function closeScraperTab(): void {
  if (ctl.tabId != null) {
    chrome.tabs.remove(ctl.tabId).catch(() => {});
    ctl.tabId = null;
  }
}

/** Detail extraction legitimately runs long (clicking through every bank
 * filter), but must never hang the loop forever — the content script answers
 * within 100s (its own internal race), this is the outer safety cap. */
const EXTRACT_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, interruptedFn?: () => boolean): Promise<T | null> {
  const timeoutP = new Promise<null>((res) => setTimeout(() => res(null), ms));
  if (!interruptedFn) return Promise.race([p, timeoutP]);
  // Poll every 500ms so pause/stop resolves within half a second instead of
  // waiting the full 120s extraction timeout.
  const interruptP = new Promise<null>((res) => {
    const id = setInterval(() => { if (interruptedFn()) { clearInterval(id); res(null); } }, 500);
    setTimeout(() => clearInterval(id), ms);
  });
  return Promise.race([p, timeoutP, interruptP]);
}

/** Navigates the scraper tab, waits for load, and asks the content script to
 * extract — injecting it first if the page didn't auto-load it. Returns null
 * on timeout so the caller's retry path takes over instead of stalling. */
export async function loadPage<T>(url: string, navTimeoutMs: number, msg: object, interruptedFn?: () => boolean): Promise<T | null> {
  const tabId = await ensureTab(url);
  await waitForComplete(tabId, navTimeoutMs);
  let res = await withTimeout(sendToTab(tabId, msg), EXTRACT_TIMEOUT_MS, interruptedFn);
  if (res === null) {
    if (interruptedFn?.()) return null;
    await new Promise<void>((r) =>
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
        void chrome.runtime.lastError; // tab may have been closed before injection
        setTimeout(r, 500);
      }));
    res = await withTimeout(sendToTab(tabId, msg), EXTRACT_TIMEOUT_MS, interruptedFn);
  }
  return res as T | null;
}
