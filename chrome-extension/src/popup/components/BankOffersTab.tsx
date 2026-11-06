import { useEffect, useRef, useState } from "react";
import type { BankOfferListingConfig, ExtractedBankOffer, Job, SimilarSelectorResult } from "../../types";
import { AUTOMATED_SCRAPE_DOMAINS, saveManualBankOffers, triggerTakhfifScrape } from "../../services/bankOffersApi";
import { cancelJob, getJob, isJobTerminal } from "../../services/jobsApi";
import { JobStatusPanel } from "./JobStatusPanel";

const TAKHFIF_JOB_KEY = "dm_takhfif_job_id";
const JOB_POLL_MS = 4000;

interface PickTarget {
  fieldKey: string;
  label: string;
}

const FIELDS: { key: keyof BankOfferListingConfig["fields"]; label: string; attr: string; placeholder: string }[] = [
  { key: "placeName", label: "Place / Brand Name", attr: "text", placeholder: "h1, .business-name…" },
  { key: "bankName",   label: "Bank Name",          attr: "text", placeholder: ".bank-name, td:nth-child(1)…" },
  { key: "cardName",   label: "Card Name",          attr: "text", placeholder: ".card-name…" },
  { key: "discount",   label: "Discount",           attr: "text", placeholder: "50% off, .discount…" },
  { key: "expiry",     label: "Expiry Date",        attr: "text", placeholder: "Valid till…" },
];

const DEFAULT_CONFIG: BankOfferListingConfig = { containerSelector: "", fields: {} };

interface Props {
  pageUrl: string;
  onToast: (type: "success" | "error" | "info", text: string) => void;
}

function CountBadge({ selector }: { selector: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!selector) { setCount(null); return; }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs.find((t) => t.url && !t.url.startsWith("chrome-extension://"));
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "COUNT_SELECTOR", selector }, (res) => {
        if (!chrome.runtime.lastError && res) setCount(res.count ?? null);
      });
    });
  }, [selector]);
  if (count === null) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
      count > 0 ? "bg-green-500/10 text-green-400 border-green-500/25" : "bg-red-500/10 text-red-400 border-red-500/25"
    }`}>
      {count}
    </span>
  );
}

function FieldRow({ label, cssValue, placeholder, onCssChange, onPick, onClear }: {
  label: string; cssValue: string; placeholder: string;
  onCssChange: (v: string) => void; onPick: () => void; onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">{label}</span>
        {cssValue && <CountBadge selector={cssValue} />}
      </div>
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={cssValue}
          onChange={(e) => onCssChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 font-mono outline-none focus:border-primary"
        />
        <button
          onClick={onPick}
          title={`Pick ${label}`}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition text-[10px] font-bold"
        >
          Pick
        </button>
        {cssValue && (
          <button onClick={onClear} aria-label={`Clear ${label}`}
            className="flex-shrink-0 w-7 h-8 flex items-center justify-center text-t3 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function BankOffersTab({ pageUrl, onToast }: Props) {
  const [config, setConfig] = useState<BankOfferListingConfig>(DEFAULT_CONFIG);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const pickTargetRef = useRef<PickTarget | null>(null);
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  const [placeName, setPlaceName] = useState("");
  const [placeWebsite, setPlaceWebsite] = useState("");
  const [rows, setRows] = useState<ExtractedBankOffer[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [saving, setSaving] = useState(false);

  // Automated server-side scrape (takhfif.app and any future site with a
  // dedicated backend job — see services/takhfif_scraper.py) — no picking
  // needed at all for these.
  const domain = pageUrl ? (() => { try { return new URL(pageUrl).hostname.replace("www.", ""); } catch { return ""; } })() : "";
  const isAutomatedSite = !!domain && AUTOMATED_SCRAPE_DOMAINS.includes(domain);
  const [maxPages, setMaxPages] = useState(3);
  const [triggering, setTriggering] = useState(false);
  const [serverJob, setServerJob] = useState<Job | null>(null);
  const jobPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollServerJob = (jobId: number) => {
    if (jobPollRef.current) clearInterval(jobPollRef.current);
    jobPollRef.current = setInterval(async () => {
      const job = await getJob(jobId);
      if (!job) return;
      setServerJob(job);
      if (isJobTerminal(job.status)) {
        clearInterval(jobPollRef.current!);
        jobPollRef.current = null;
        chrome.storage.local.remove(TAKHFIF_JOB_KEY);
        if (job.status === "done") {
          onToast("success", `takhfif.app scrape complete — ${job.successful ?? 0} place(s) processed.`);
        } else if (job.status === "failed") {
          onToast("error", `Scrape failed: ${job.error ?? "unknown error"}`);
        }
      }
    }, JOB_POLL_MS);
  };

  // Resume polling a still-running scrape job across popup close/reopen
  useEffect(() => {
    chrome.storage.local.get(TAKHFIF_JOB_KEY, (r) => {
      const jobId = r[TAKHFIF_JOB_KEY] as number | undefined;
      if (jobId == null) return;
      getJob(jobId).then((job) => {
        if (!job) return;
        if (isJobTerminal(job.status)) { chrome.storage.local.remove(TAKHFIF_JOB_KEY); return; }
        setServerJob(job);
        pollServerJob(jobId);
      });
    });
    return () => { if (jobPollRef.current) clearInterval(jobPollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunScrape = async () => {
    setTriggering(true);
    try {
      const { jobId } = await triggerTakhfifScrape(maxPages);
      chrome.storage.local.set({ [TAKHFIF_JOB_KEY]: jobId });
      const job = await getJob(jobId);
      if (job) setServerJob(job);
      pollServerJob(jobId);
      onToast("info", `Scrape started (job #${jobId}).`);
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Could not start scrape");
    } finally {
      setTriggering(false);
    }
  };

  const handleCancelServerJob = async () => {
    if (!serverJob) return;
    await cancelJob(serverJob.id).catch(() => {});
    onToast("info", "Cancel requested.");
  };

  // Prefill place name/website from the current page
  useEffect(() => {
    if (!pageUrl) return;
    try {
      const url = new URL(pageUrl);
      setPlaceWebsite((v) => v || url.hostname.replace("www.", ""));
    } catch { /* ignore */ }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs.find((t) => t.url && !t.url.startsWith("chrome-extension://"));
      setPlaceName((v) => v || tab?.title || "");
    });
  }, [pageUrl]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "popup" });
    portRef.current = port;
    port.onMessage.addListener((msg: { type: string; selector?: string; similar?: SimilarSelectorResult | null }) => {
      if (msg.type === "SELECTOR_PICKED" && pickTargetRef.current && msg.selector) {
        const target = pickTargetRef.current;
        const similar = msg.similar ?? null;
        if (target.fieldKey === "container") {
          // findSimilarSelector's container selector (href-prefix or
          // shared-class based) is far more robust than the raw selector
          // for whatever exact element the user clicked inside the card.
          const useSel = similar?.containerSelector || msg.selector;
          setConfig((c) => ({ ...c, containerSelector: useSel! }));
        } else {
          const fieldDef = FIELDS.find((f) => f.key === target.fieldKey as keyof BankOfferListingConfig["fields"]);
          // Once a container is set, prefer the field selector *relative to
          // it* — the raw selector may not resolve correctly when queried
          // scoped to a single container element.
          const useSel = (similar && configRef.current.containerSelector) ? similar.fieldSelector : msg.selector;
          setConfig((c) => ({
            ...c,
            fields: { ...c.fields, [target.fieldKey]: { css: useSel!, attr: fieldDef?.attr } },
          }));
        }
        pickTargetRef.current = null;
        setPickTarget(null);
        chrome.storage.local.remove(["dm_pending_selector", "dm_picker_context"]);
      } else if (msg.type === "SELECTOR_MODE_CANCELLED") {
        pickTargetRef.current = null;
        setPickTarget(null);
      }
    });
    return () => port.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startPick = (fieldKey: string, label: string) => {
    const t = { fieldKey, label };
    pickTargetRef.current = t;
    setPickTarget(t);
    chrome.storage.local.set({ dm_picker_context: { source: "bank-offers", fieldKey, label } });
    chrome.runtime.sendMessage({ type: "START_SELECTOR_MODE" });
  };

  const cancelPick = () => {
    chrome.runtime.sendMessage({ type: "STOP_SELECTOR_MODE" });
    chrome.storage.local.remove(["dm_picker_context"]);
    pickTargetRef.current = null;
    setPickTarget(null);
  };

  const setField = (key: keyof BankOfferListingConfig["fields"], css: string) => {
    setConfig((c) => ({ ...c, fields: { ...c.fields, [key]: { ...c.fields[key], css } } }));
  };
  const clearField = (key: keyof BankOfferListingConfig["fields"]) => {
    setConfig((c) => { const fields = { ...c.fields }; delete fields[key]; return { ...c, fields }; });
  };

  const scanPage = () => {
    if (!config.containerSelector) return;
    setScanning(true);
    setScanError("");
    chrome.runtime.sendMessage({ type: "EXTRACT_BANK_OFFERS", config }, (res) => {
      setScanning(false);
      if (chrome.runtime.lastError || !res) {
        setScanError("Could not connect to page. Make sure it's loaded.");
        return;
      }
      if (res.error) { setScanError(res.error); return; }
      const extracted = (res.rows as ExtractedBankOffer[]) ?? [];
      setRows(extracted);
      setSelected(new Set(extracted.map((_, i) => i)));
      if (!extracted.length) onToast("info", "No bank offer rows found with these selectors.");
    });
  };

  const updateRow = (i: number, patch: Partial<ExtractedBankOffer>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    const toSave = rows.filter((_, i) => selected.has(i)).filter((r) => r.bankName);
    if (!toSave.length || !placeName.trim()) return;
    setSaving(true);
    try {
      const result = await saveManualBankOffers({
        source_url: pageUrl,
        place_name: placeName.trim(),
        place_website: placeWebsite.trim() || undefined,
        offers: toSave.map((r) => ({
          bank_name: r.bankName!,
          card_name: r.cardName,
          discount_percentage: r.discount,
          expiry_date: r.expiry,
        })),
      });
      onToast("success", `${result.saved} bank offer${result.saved !== 1 ? "s" : ""} saved.`);
      setRows([]);
      setSelected(new Set());
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {pickTarget && (
        <div className="mx-3 mt-2 flex items-center gap-2.5 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl flex-shrink-0">
          <span className="relative flex-shrink-0 w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
            <span className="relative block w-2.5 h-2.5 rounded-full bg-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-primary uppercase tracking-wide">Picker Active</p>
            <p className="text-[10px] text-t2 truncate">Click element → <span className="font-bold text-t1">{pickTarget.label}</span></p>
          </div>
          <button onClick={cancelPick} className="flex-shrink-0 px-2.5 py-1.5 bg-surface-2 border border-line rounded-lg text-[10px] font-bold text-t2 hover:text-red-400 hover:border-red-500/30 transition">
            Stop
          </button>
        </div>
      )}

      <div className="scrollable">
        <div className="px-3 pt-3 pb-2">
          <p className="text-xs font-black text-t1 uppercase tracking-[0.08em]">Bank Offers</p>
          <p className="text-[10px] text-t2 mt-0.5">Pick a bank-offer row, scan the page, review, then save.</p>
        </div>

        {/* Automated server-side scrape — no picking needed */}
        {isAutomatedSite && (
          <div className="mx-3 mb-2.5 bg-primary/5 border border-primary/30 rounded-xl p-3 flex flex-col gap-2.5">
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-wide">Automated Scraper Available</p>
              <p className="text-[10px] text-t2 mt-0.5">
                {domain} has a dedicated server-side scraper — no picking needed. Runs against the live site directly, not just this tab.
              </p>
            </div>
            {serverJob ? (
              <>
                <JobStatusPanel job={serverJob} onCancel={handleCancelServerJob} />
                {isJobTerminal(serverJob.status) && (
                  <button
                    onClick={() => setServerJob(null)}
                    className="self-start text-[10px] text-primary hover:underline font-bold"
                  >
                    Run again
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={101}
                  value={maxPages}
                  onChange={(e) => setMaxPages(Math.min(101, Math.max(1, +e.target.value || 1)))}
                  className="w-16 text-[11px] px-2 py-2 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
                />
                <span className="text-[10px] text-t3 flex-1">page{maxPages !== 1 ? "s" : ""} (max 101 — full catalog)</span>
                <button
                  onClick={handleRunScrape}
                  disabled={triggering}
                  className="px-3 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition"
                >
                  {triggering ? "Starting…" : "Run Scrape"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Place / brand identity */}
        <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl p-3 flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">Place / Brand Name</span>
            <input
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="e.g. The Monal"
              className="text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">Website (helps brand matching)</span>
            <input
              type="text"
              value={placeWebsite}
              onChange={(e) => setPlaceWebsite(e.target.value)}
              placeholder="example.com"
              className="text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Container */}
        <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">Step 1</span>
            <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">Offer Row Container</span>
            {config.containerSelector && <CountBadge selector={config.containerSelector} />}
          </div>
          <div className="p-3">
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                value={config.containerSelector}
                onChange={(e) => setConfig((c) => ({ ...c, containerSelector: e.target.value }))}
                placeholder=".bank-offer-row, tr…"
                className="flex-1 min-w-0 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 font-mono outline-none focus:border-primary"
              />
              <button
                onClick={() => startPick("container", "Offer Row Container")}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition text-[10px] font-bold"
              >
                Pick
              </button>
              {config.containerSelector && (
                <button onClick={() => setConfig((c) => ({ ...c, containerSelector: "" }))}
                  aria-label="Clear container"
                  className="flex-shrink-0 w-8 h-9 flex items-center justify-center text-t3 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                  ×
                </button>
              )}
            </div>
            <p className="text-[10px] text-t3 mt-2">Click one bank/card offer row — similar rows are matched by the same selector.</p>
          </div>
        </div>

        {/* Field selectors */}
        {config.containerSelector && (
          <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-line flex items-center gap-2">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">Step 2</span>
              <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">Field Selectors</span>
            </div>
            <div className="p-3 flex flex-col gap-3">
              {FIELDS.map((f) => (
                <FieldRow
                  key={f.key}
                  label={f.label}
                  cssValue={config.fields[f.key]?.css ?? ""}
                  placeholder={f.placeholder}
                  onCssChange={(v) => setField(f.key, v)}
                  onPick={() => startPick(f.key, f.label)}
                  onClear={() => clearField(f.key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Scan */}
        {config.containerSelector && (
          <div className="mx-3 mb-2.5">
            <button
              onClick={scanPage}
              disabled={scanning}
              className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-bold rounded-xl transition"
            >
              {scanning ? "Scanning…" : "Scan Page"}
            </button>
            {scanError && <p className="text-[10px] text-red-400 mt-1.5">{scanError}</p>}
          </div>
        )}

        {/* Review */}
        {rows.length > 0 && (
          <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-line flex items-center justify-between">
              <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">
                {rows.length} row{rows.length !== 1 ? "s" : ""} found
              </span>
              <label className="flex items-center gap-1 text-[10px] text-t2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length}
                  onChange={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((_, i) => i)))}
                  className="w-3 h-3 accent-primary"
                />
                All
              </label>
            </div>
            <div className="flex flex-col divide-y divide-line max-h-72 overflow-y-auto">
              {rows.map((row, i) => (
                <div key={i} className="p-2.5 flex gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    className="w-3.5 h-3.5 accent-primary mt-1.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
                    <input value={row.bankName ?? ""} onChange={(e) => updateRow(i, { bankName: e.target.value })}
                      placeholder="Bank name" className="text-[10px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary" />
                    <input value={row.cardName ?? ""} onChange={(e) => updateRow(i, { cardName: e.target.value })}
                      placeholder="Card name" className="text-[10px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary" />
                    <input value={row.discount ?? ""} onChange={(e) => updateRow(i, { discount: e.target.value })}
                      placeholder="Discount %" className="text-[10px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary" />
                    <input value={row.expiry ?? ""} onChange={(e) => updateRow(i, { expiry: e.target.value })}
                      placeholder="Expiry (YYYY-MM-DD)" className="text-[10px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-20" />
      </div>

      {/* Docked save bar */}
      {selected.size > 0 && (
        <div className="px-3 py-2 border-t border-line bg-surface flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !placeName.trim()}
            className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-xs font-bold rounded-xl transition"
          >
            {saving ? "Saving…" : `Save ${selected.size} bank offer${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
