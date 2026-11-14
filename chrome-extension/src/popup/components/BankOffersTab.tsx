import { useEffect, useMemo, useState } from "react";
import type {
  TakhfifBusinessDetail, TakhfifConfigSnapshot, TakhfifDetailMode,
  TakhfifLogEntry, TakhfifQueueItem, TakhfifSession,
} from "../../types/takhfif";
import { PhaseCard, StatCard } from "./bankoffers/primitives";
import type { PhaseStatus } from "./bankoffers/primitives";
import { CompletionPanel, ExportBar, HealthPanel, LogsPanel, SourceCard } from "./bankoffers/panels";
import { ResultsPanel } from "./bankoffers/ResultsPanel";
import { OptionsCard, DEFAULT_OPTIONS } from "./bankoffers/OptionsCard";
import type { TakhfifOptions } from "./bankoffers/OptionsCard";
import { ControlsBar } from "./bankoffers/ControlsBar";
import { flattenOffers } from "./bankoffers/exporters";
import { AlertIcon, BankIcon, BuildingIcon, CardIcon } from "./bankoffers/icons";

// Mirror of the keys owned by background/takhfif-store.ts (kept as literals —
// the shared types module must stay type-only for content-script bundling).
const KEYS = {
  session: "dm_takhfif_session",
  queue: "dm_takhfif_detail_queue",
  details: "dm_takhfif_details",
  logs: "dm_takhfif_logs",
} as const;

const OPTIONS_KEY = "dm_takhfif_options";

type DetailsStore = Record<string, TakhfifBusinessDetail>;

interface Props {
  onToast: (type: "success" | "error" | "info", text: string) => void;
}

const HEADER_CHIP: Record<string, string> = {
  idle:      "bg-green-500/10 text-green-400 border-green-500/20",
  running:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paused:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  stopped:   "bg-surface-3 text-t3 border-line",
  failed:    "bg-red-500/10 text-red-400 border-red-500/20",
};

const HEADER_LABEL: Record<string, string> = {
  idle: "Ready", running: "Running", paused: "Paused",
  completed: "Done", stopped: "Stopped", failed: "Failed",
};

/** Drops sessions persisted by older builds whose schema lacks the health /
 * page fields, and fills in phase-2 counters older sessions don't have. */
function saneSession(s: unknown): TakhfifSession | null {
  const session = s as TakhfifSession | undefined | null;
  if (!session?.phase1 || !session.health || !Array.isArray(session.phase1.failedPages)) return null;
  if (typeof session.phase2?.processed !== "number") {
    session.phase2 = {
      status: session.phase2?.status ?? "waiting",
      queueSize: session.phase2?.queueSize ?? 0,
      processed: 0, completedCount: 0, failedCount: 0, tiersFound: 0, cardsFound: 0,
      currentLabel: "", pauseReason: null,
    };
  }
  return session;
}

export function BankOffersTab({ onToast }: Props) {
  const [options, setOptions] = useState<TakhfifOptions>(DEFAULT_OPTIONS);
  const [session, setSession] = useState<TakhfifSession | null>(null);
  const [queue, setQueue] = useState<TakhfifQueueItem[]>([]);
  const [details, setDetails] = useState<DetailsStore>({});
  const [logs, setLogs] = useState<TakhfifLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  // Load persisted options + session state, then stay live via storage events
  useEffect(() => {
    chrome.storage.local.get([OPTIONS_KEY, ...Object.values(KEYS)], (r) => {
      if (r[OPTIONS_KEY]) setOptions((prev) => ({ ...prev, ...(r[OPTIONS_KEY] as Partial<TakhfifOptions>) }));
      setSession(saneSession(r[KEYS.session]));
      setQueue((r[KEYS.queue] as TakhfifQueueItem[]) ?? []);
      setDetails((r[KEYS.details] as DetailsStore) ?? {});
      setLogs((r[KEYS.logs] as TakhfifLogEntry[]) ?? []);
    });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (changes[KEYS.session]) setSession(saneSession(changes[KEYS.session].newValue));
      if (changes[KEYS.queue]) setQueue((changes[KEYS.queue].newValue as TakhfifQueueItem[]) ?? []);
      if (changes[KEYS.details]) setDetails((changes[KEYS.details].newValue as DetailsStore) ?? {});
      if (changes[KEYS.logs]) setLogs((changes[KEYS.logs].newValue as TakhfifLogEntry[]) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const saveOptions = (patch: Partial<TakhfifOptions>) => {
    setOptions((prev) => {
      const next = { ...prev, ...patch };
      chrome.storage.local.set({ [OPTIONS_KEY]: next });
      return next;
    });
  };

  const sendCmd = (msg: Record<string, unknown>, okText?: string) => {
    setBusy(true);
    chrome.runtime.sendMessage(msg, (res: { ok: boolean; error?: string } | undefined) => {
      setBusy(false);
      if (chrome.runtime.lastError || !res?.ok) {
        onToast("error", res?.error ?? "Command failed — reload the extension and try again.");
      } else if (okText) {
        onToast("info", okText);
      }
    });
  };

  const handleStart = () => {
    if (session && window.confirm(
      "Starting a new session replaces the existing one and all its extracted data. Export first if you need it. Continue?",
    ) === false) return;
    const config: TakhfifConfigSnapshot = {
      scrapeAllPages: options.scrapeAllPages,
      startPage: options.startPage,
      endPage: options.scrapeAllPages ? null : options.endPage,
      detailsEnabled: options.scrapeDetails,
      delaySeconds: options.delaySeconds,
      maxRetries: options.maxRetries,
      navTimeoutMs: options.timeoutSec * 1000,
    };
    sendCmd({ type: "TAKHFIF_LISTING_START", config }, "Listing scraping started.");
  };

  const handleNewSession = () => {
    if (!window.confirm("Clear the current session and its extracted data? Export first if you need it.")) return;
    sendCmd({ type: "TAKHFIF_SESSION_CLEAR" }, "Session cleared.");
  };

  const handleStartDetails = (mode: TakhfifDetailMode) => {
    sendCmd({ type: "TAKHFIF_DETAILS_START", mode }, "Detail scraping started.");
  };

  const handleScrapeOne = (url: string) => {
    sendCmd({ type: "TAKHFIF_DETAILS_SINGLE", url }, "Scraping business details…");
  };

  const handlePushOne = (slug: string) => {
    sendCmd({ type: "TAKHFIF_PUSH_ONE", slug }, "Saved to backend.");
  };

  const handlePushAll = () => {
    sendCmd({ type: "TAKHFIF_PUSH_ALL" }, "Backend sync finished — see logs.");
  };

  const p1 = session?.phase1 ?? null;
  const p2 = session?.phase2 ?? null;
  const p1Status = p1?.status ?? "idle";
  const detailsEnabled = session ? session.config.detailsEnabled : options.scrapeDetails;

  // Which engine the controls drive: phase 2 takes over once it's engaged.
  const p2Engaged = !!p2 && (p2.status === "running" || p2.status === "paused");
  const phase: "listing" | "details" = p2Engaged ? "details" : "listing";
  const effStatus = p2Engaged ? p2!.status : p1Status;

  const pauseReason = p2Engaged ? p2?.pauseReason : p1?.pauseReason;
  const protectionPaused = effStatus === "paused" && !!pauseReason;
  const manualResumeWarning = session?.health?.status === "verification_required"
    || session?.health?.status === "access_restricted";

  const phase1Status: PhaseStatus =
    p1Status === "idle" ? "ready" : p1Status === "completed" ? "done" : p1Status as PhaseStatus;
  const phase2Status: PhaseStatus =
    !detailsEnabled || p2?.status === "disabled" ? "skipped" :
    !p2 || p2.status === "waiting" ? "waiting" :
    p2.status === "ready" ? "queued" :
    p2.status === "completed" ? "done" :
    p2.status as PhaseStatus;

  // Phase-1 progress against the planned range: start → (configured end | site total).
  const startPage = session?.config.startPage ?? 1;
  const lastPlanned = session?.config.endPage != null && p1?.totalPages != null
    ? Math.min(session.config.endPage, p1.totalPages)
    : session?.config.endPage ?? p1?.totalPages ?? null;
  const plannedPages = lastPlanned != null ? Math.max(1, lastPlanned - startPage + 1) : null;
  const remaining = plannedPages != null && p1 ? Math.max(0, plannedPages - p1.pagesCompleted) : null;
  const phase1Pct = p1
    ? p1Status === "completed" ? 100
    : plannedPages != null ? (p1.pagesCompleted / plannedPages) * 100 : 0
    : 0;
  const phase1Left = p1
    ? `Page ${p1.currentPage}${lastPlanned != null ? ` of ${lastPlanned}` : ""}${remaining != null && p1Status === "running" ? ` · ${remaining} remaining` : ""}`
    : "Page 0";

  const offers = useMemo(() => flattenOffers(details), [details]);
  const failedItems = useMemo(() => queue.filter((q) => q.status === "failed"), [queue]);
  const totalTiers = useMemo(
    () => Object.values(details).reduce((n, d) => n + d.banks.reduce((m, b) => m + b.tiers.length, 0), 0),
    [details]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="scrollable">
        {/* ── Header ── */}
        <div className="px-3 pt-3 pb-2 flex items-start justify-between">
          <div>
            <p className="text-[13px] font-black text-t1 uppercase tracking-[0.08em]">Bank Offers</p>
            <p className="text-[10px] text-t2 mt-0.5">Automated promotional offer extraction</p>
          </div>
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full border mt-0.5 ${HEADER_CHIP[effStatus] ?? HEADER_CHIP.idle}`}>
            {phase === "details" ? `Details · ${HEADER_LABEL[effStatus]}` : HEADER_LABEL[effStatus] ?? "Ready"}
          </span>
        </div>

        <SourceCard />

        <OptionsCard options={options} onChange={saveOptions} running={effStatus === "running"} />

        {/* ── Protection pause banner ── */}
        {protectionPaused && (
          <div className="mx-3 mb-2.5 bg-red-500/5 border border-red-500/25 rounded-xl p-3">
            <p className="text-[10px] font-black text-red-400 uppercase tracking-wider">Paused by website protection</p>
            <p className="text-[10px] text-t2 mt-1">{pauseReason}</p>
            {manualResumeWarning && (
              <p className="text-[9px] text-t3 mt-1.5">
                Resolve the restriction first — resuming beforehand will pause again. Challenges are never bypassed automatically.
              </p>
            )}
          </div>
        )}

        <ControlsBar
          status={effStatus} phase={phase} busy={busy}
          onStart={handleStart} onNewSession={handleNewSession} sendCmd={sendCmd}
        />

        {phase === "listing" && p1Status === "paused" && p1 && (
          <p className="mx-3 mb-2.5 text-[10px] text-t2">
            Last completed: {p1.lastCompletedPage >= startPage ? `Page ${p1.lastCompletedPage}` : "none"}
            {" · "}Next page: {Math.max(startPage, p1.lastCompletedPage + 1)}
          </p>
        )}

        {p1Status === "failed" && p1?.error && (
          <p className="mx-3 mb-2.5 text-[10px] text-red-400">{p1.error}</p>
        )}

        {/* ── Phase 1 completion summary + manual Phase 2 handoff ── */}
        {p1Status === "completed" && session && !p2Engaged && (
          <CompletionPanel session={session} onStartDetails={handleStartDetails} />
        )}

        {/* ── Scraping Progress ── */}
        <div className="mx-3 mb-2.5">
          <p className="text-[10px] font-black text-t1 uppercase tracking-wider mb-2">Scraping Progress</p>
          <div className="flex flex-col gap-2">
            <PhaseCard
              phase="01" title="Deal Listings"
              description="Extract business cards from Takhfif.app listing pages"
              status={phase1Status}
              progressPct={phase1Pct}
              leftStat={phase1Left}
              rightStat={`${p1?.saved ?? 0} deals`}
              label={p1?.currentLabel}
            />
            <PhaseCard
              phase="02" title="Deal Details"
              description="Visit business pages and extract bank-card offers — starts only on your action"
              status={phase2Status}
              progressPct={p2 && p2.queueSize > 0 ? (p2.processed / p2.queueSize) * 100 : 0}
              leftStat={p2 && p2.status !== "ready" && p2.status !== "waiting"
                ? `${p2.processed} / ${p2.queueSize} businesses`
                : `${p2?.queueSize ?? 0} businesses queued`}
              rightStat={`${p2?.cardsFound ?? 0} cards`}
              label={p2?.currentLabel || (p2?.status === "ready" ? "Waiting for user action" : undefined)}
              disabled={!detailsEnabled}
            />
          </div>
        </div>

        {/* ── Website health ── */}
        {session?.health && (
          <HealthPanel
            health={session.health}
            phaseLabel={phase === "details" ? "Phase 2 — details" : "Phase 1 — listings"}
          />
        )}

        {/* ── Stats grid ── */}
        <div className="mx-3 mb-2.5 grid grid-cols-2 gap-2">
          <StatCard icon={<BuildingIcon />} label="Places Scraped" value={Object.keys(details).length} />
          <StatCard icon={<BankIcon />} label="Bank Offers" value={detailsEnabled ? totalTiers : "N/A"} faded={!detailsEnabled} />
          <StatCard icon={<CardIcon />} label="Cards Found" value={detailsEnabled ? offers.length : "N/A"} faded={!detailsEnabled} />
          <StatCard icon={<AlertIcon />} label="Failed" value={(p1?.failedPages.length ?? 0) + failedItems.length} />
        </div>

        <ResultsPanel
          offers={offers}
          details={details}
          failedPages={p1?.failedPages ?? []}
          failedItems={failedItems}
          detailsEnabled={detailsEnabled}
          canScrape={!busy && effStatus !== "running"}
          onRetryFailed={() => handleStartDetails("failed")}
          onScrapeOne={handleScrapeOne}
          busy={busy}
          onPushOne={handlePushOne}
          onPushAll={handlePushAll}
        />

        <ExportBar details={details} />

        <LogsPanel logs={logs} />

        <div className="h-4" />
      </div>
    </div>
  );
}
