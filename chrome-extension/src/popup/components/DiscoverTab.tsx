import { useEffect, useRef, useState } from "react";
import type { Brand } from "../../types";
import {
  startBrandDiscovery, getBrandDiscovery,
  updateBrandDiscovery, saveBrandDiscovery, discardBrandDiscovery,
  searchBrandCandidates, listCategories,
} from "../../services/brandsApi";

const COUNTRIES: { code: string; name: string }[] = [
  { code: "PK", name: "Pakistan" }, { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "UAE" }, { code: "EG", name: "Egypt" },
  { code: "QA", name: "Qatar" }, { code: "KW", name: "Kuwait" },
  { code: "OM", name: "Oman" }, { code: "BH", name: "Bahrain" },
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "TR", name: "Turkey" }, { code: "IN", name: "India" },
  { code: "SG", name: "Singapore" }, { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" }, { code: "DE", name: "Germany" },
  { code: "FR", name: "France" }, { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" }, { code: "CN", name: "China" },
  { code: "BR", name: "Brazil" }, { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" }, { code: "NG", name: "Nigeria" },
];

interface Props {
  brands: Brand[];
  pageUrl: string;
  onBrandAdded: (brand: Brand) => void;
  onToast: (type: "success" | "error" | "info", text: string) => void;
}

interface Discovery {
  id: number;
  status: string;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  country: string | null;
  confidence: number | null;
  duplicate_brand_id: number | null;
  duplicate_brand?: { id: number; name: string; website: string | null } | null;
  error: string | null;
}

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
  } catch { return url; }
}

// ── small shared UI ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary"
      />
    </div>
  );
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div style={{ width: `${pct}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span style={{ color }} className="text-[10px] font-bold">{pct}% confidence</span>
    </div>
  );
}

// ── Processing view ────────────────────────────────────────────────────────────

function ProcessingView({ step, onCancel }: { step: string; onCancel: () => void }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <div>
          <p className="text-[11px] font-bold text-t1">Analyzing…</p>
          <p className="text-[10px] text-t2 mt-0.5">{step}</p>
        </div>
      </div>
      <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
      </div>
      <button onClick={onCancel} className="self-start text-[9.5px] text-t3 hover:text-red-400 transition">
        Cancel
      </button>
    </div>
  );
}

// ── Review form ────────────────────────────────────────────────────────────────

function ReviewForm({
  discovery: initial,
  onSaved,
  onDiscard,
  onToast,
}: {
  discovery: Discovery;
  onSaved: (brandName: string) => void;
  onDiscard: () => void;
  onToast: (type: "success" | "error" | "info", text: string) => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [categorySearch, setCategorySearch] = useState(initial.category ?? "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [country, setCountry] = useState(initial.country ?? "");
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [skipDuplicate, setSkipDuplicate] = useState(false);

  useEffect(() => {
    listCategories().then(setDbCategories).catch(() => {});
  }, []);

  const filteredCats = dbCategories.filter((c) =>
    c.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  const showDuplicate = !!initial.duplicate_brand_id && !skipDuplicate;

  const patchAndSave = async (action: "create" | "merge", targetId?: number) => {
    setSaving(true);
    try {
      // Patch any edits back to the discovery record first
      await updateBrandDiscovery(initial.id, { name, website, logo_url: logoUrl, description, category, country });
      const result = await saveBrandDiscovery(initial.id, action, targetId);
      onSaved(result.brand_name);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err instanceof Error ? err.message : "Save failed");
      onToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await discardBrandDiscovery(initial.id);
      onDiscard();
    } catch {
      onDiscard();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-line flex items-center justify-between">
        <p className="text-[10px] font-black text-t1 uppercase tracking-wide">Review Brand</p>
        <ConfidenceBar value={initial.confidence} />
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Duplicate warning */}
        {showDuplicate && initial.duplicate_brand && (
          <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-[10px] font-bold text-yellow-400">Possible duplicate</p>
            </div>
            <p className="text-[10px] text-t2">
              Similar to <span className="font-semibold text-t1">{initial.duplicate_brand.name}</span>
              {initial.duplicate_brand.website ? ` (${normalizeDomain(initial.duplicate_brand.website)})` : ""}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => patchAndSave("merge", initial.duplicate_brand_id!)}
                disabled={saving}
                className="px-2.5 py-1.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black text-[10px] font-bold rounded-lg transition"
              >
                Merge into existing
              </button>
              <button
                onClick={() => setSkipDuplicate(true)}
                className="px-2.5 py-1.5 bg-surface-3 hover:bg-surface-2 border border-line text-t2 text-[10px] font-semibold rounded-lg transition"
              >
                Create anyway
              </button>
            </div>
          </div>
        )}

        {/* Logo preview */}
        {logoUrl && (
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt=""
              className="w-12 h-12 rounded-xl object-contain bg-surface-2 border border-line flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="min-w-0">
              <p className="text-[10px] text-t2">Logo preview</p>
              <p className="text-[9px] text-t3 truncate">{logoUrl}</p>
            </div>
          </div>
        )}

        <Field label="Brand Name" value={name} onChange={setName} placeholder="e.g. Nike" />

        <div className="grid grid-cols-2 gap-2">
          {/* Category — searchable dropdown */}
          <div className="relative">
            <p className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider mb-1">Category</p>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => { setCategorySearch(e.target.value); setCategoryOpen(true); }}
              onFocus={() => setCategoryOpen(true)}
              onBlur={() => setTimeout(() => setCategoryOpen(false), 150)}
              placeholder="Search…"
              className="w-full text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary"
            />
            {categoryOpen && filteredCats.length > 0 && (
              <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-surface-3 border border-line rounded-lg shadow-lg max-h-32 overflow-y-auto">
                {filteredCats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={() => { setCategory(c); setCategorySearch(c); setCategoryOpen(false); }}
                    className={`w-full text-left px-2.5 py-1.5 text-[10.5px] hover:bg-surface-2 transition ${category === c ? "text-primary font-semibold" : "text-t1"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Country — select dropdown */}
          <div>
            <p className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider mb-1">Country</p>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary appearance-none"
            >
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <Field label="Website" value={website} onChange={setWebsite} placeholder="https://…" type="url" />
        <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://…logo.png" type="url" />

        {description && (
          <div>
            <p className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider mb-1">Description</p>
            <p className="text-[10px] text-t2 leading-relaxed">{description}</p>
          </div>
        )}

        {/* Actions */}
        {!showDuplicate && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => patchAndSave("create")}
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-bold rounded-xl transition"
            >
              {saving ? "Saving…" : "Save to Brands"}
            </button>
            <button
              onClick={handleDiscard}
              disabled={discarding}
              className="px-3 py-2.5 bg-surface-2 hover:bg-surface-3 border border-line text-t2 text-[10px] font-semibold rounded-xl transition"
            >
              {discarding ? "…" : "Discard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Screen = "input" | "processing" | "review";

export function DiscoverTab({ brands, pageUrl, onBrandAdded, onToast }: Props) {
  const [mode, setMode] = useState<"current" | "search">("current");
  const [screen, setScreen] = useState<Screen>("input");

  // Current-page
  const [currentDomain, setCurrentDomain] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentTabId, setCurrentTabId] = useState<number | undefined>();
  const [existingBrand, setExistingBrand] = useState<Brand | null>(null);

  // Search mode
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<Array<{ name: string; website: string; domain: string; logo_url: string | null; description: string | null; category: string }>>([]);
  const [searching, setSearching] = useState(false);

  // Processing
  const [processStep, setProcessStep] = useState("");
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!pageUrl) return;
    const domain = normalizeDomain(pageUrl);
    setCurrentDomain(domain);
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs.find((t) => t.url && !t.url.startsWith("chrome-extension://"));
      setCurrentTitle(tab?.title ?? domain);
      setCurrentTabId(tab?.id);
    });
    setExistingBrand(brands.find((b) => normalizeDomain(b.website ?? "") === domain) ?? null);
  }, [pageUrl, brands]);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const startScan = async (website: string, seedName?: string, tabId?: number) => {
    cancelledRef.current = false;
    setScreen("processing");
    setProcessStep("Starting website scan…");
    setDiscovery(null);

    try {
      // Try to grab the page HTML from the browser — avoids server-side IP blocking
      let pageHtml: string | undefined;
      if (tabId != null) {
        try {
          const [frame] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.documentElement.outerHTML.slice(0, 500_000),
          });
          pageHtml = (frame?.result as string | undefined) || undefined;
        } catch { /* scripting not available on this tab — fall back to server fetch */ }
      }

      const { discoveryId } = await startBrandDiscovery(website, seedName, pageHtml);
      const steps = ["Scanning website…", "Extracting brand info…", "Matching database…", "Finalizing results…"];
      let stepIdx = 0;

      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const poll = async () => {
          if (cancelledRef.current) { reject(new Error("cancelled")); return; }
          attempts++;
          if (attempts > 40) { reject(new Error("Analysis timed out after 60 seconds.")); return; }
          try {
            const result = await getBrandDiscovery(discoveryId);
            if (result.status === "review" || result.status === "saved") {
              setDiscovery(result as Discovery);
              resolve();
            } else if (result.status === "failed") {
              reject(new Error(result.error ?? "Discovery failed on the server."));
            } else {
              stepIdx = (stepIdx + 1) % steps.length;
              setProcessStep(steps[stepIdx]);
              pollRef.current = setTimeout(poll, 1500);
            }
          } catch (e) {
            reject(e);
          }
        };
        pollRef.current = setTimeout(poll, 1500);
      });

      setScreen("review");
    } catch (err) {
      if ((err as Error).message === "cancelled") {
        setScreen("input");
        return;
      }
      onToast("error", err instanceof Error ? err.message : "Discovery failed");
      setScreen("input");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setCandidates([]);
    try {
      const results = await searchBrandCandidates(searchQuery.trim());
      setCandidates(results);
      if (results.length === 0) onToast("info", "No candidates found — try Scan Website instead.");
    } catch {
      onToast("error", "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSaved = (brandName: string) => {
    onToast("success", `"${brandName}" saved to Brands.`);
    // Trigger a brands refresh by navigating back
    setScreen("input");
    setDiscovery(null);
  };

  const handleDiscard = () => {
    setScreen("input");
    setDiscovery(null);
    setCandidates([]);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    if (pollRef.current) clearTimeout(pollRef.current);
    setScreen("input");
  };

  const inputCls = "w-full text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary";

  return (
    <div className="scrollable px-3 py-3 flex flex-col gap-3">

      {/* ── Processing ── */}
      {screen === "processing" && (
        <ProcessingView step={processStep} onCancel={handleCancel} />
      )}

      {/* ── Review ── */}
      {screen === "review" && discovery && (
        <>
          {discovery.status === "failed" ? (
            <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-2">
              <p className="text-[11px] font-bold text-red-400">Discovery failed</p>
              <p className="text-[10px] text-t2">{discovery.error ?? "Something went wrong on the server."}</p>
              <button onClick={handleDiscard} className="self-start text-[10px] text-primary hover:underline">Try again</button>
            </div>
          ) : (
            <ReviewForm
              discovery={discovery}
              onSaved={handleSaved}
              onDiscard={handleDiscard}
              onToast={onToast}
            />
          )}
        </>
      )}

      {/* ── Input ── */}
      {screen === "input" && (
        <>
          {/* Mode toggle */}
          <div className="flex bg-surface-2 rounded-xl p-0.5">
            {(["current", "search"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-[10px] transition ${
                  mode === m ? "bg-surface-3 text-t1" : "text-t2"
                }`}
              >
                {m === "current" ? "Current Page" : "Search Brand"}
              </button>
            ))}
          </div>

          {/* Current Page */}
          {mode === "current" && (
            <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-3">
              {!currentDomain ? (
                <p className="text-[10px] text-t2">Open a website in your browser first.</p>
              ) : existingBrand ? (
                <div className="flex items-center gap-2.5 p-2.5 bg-green-900/20 border border-green-500/30 rounded-xl">
                  {existingBrand.logo_url && (
                    <img src={existingBrand.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-[11px] font-semibold text-t1">{existingBrand.name}</p>
                    <p className="text-[10px] text-green-400">Already registered</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 p-2.5 bg-surface-2 border border-line rounded-xl">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${currentDomain}&sz=32`}
                      alt=""
                      className="w-8 h-8 rounded-lg flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-t1 truncate">{currentTitle}</p>
                      <p className="text-[10px] text-t2 truncate">{currentDomain}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => startScan(`https://${currentDomain}`, currentTitle, currentTabId)}
                    className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-[11px] font-bold rounded-xl transition"
                  >
                    Scan & Discover Brand
                  </button>
                </>
              )}
            </div>
          )}

          {/* Search Brand */}
          {mode === "search" && (
            <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-3">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Brand name — e.g. Nike"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className={inputCls}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="flex-shrink-0 px-3 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition"
                >
                  {searching ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                  ) : "Search"}
                </button>
              </div>

              {candidates.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[9.5px] text-t3 uppercase tracking-wider font-semibold">Pick a candidate</p>
                  {candidates.map((c) => (
                    <button
                      key={c.website}
                      onClick={() => startScan(c.website, c.name)}
                      className="flex items-center gap-2.5 p-2.5 bg-surface-2 hover:bg-surface-3 border border-line rounded-xl transition text-left w-full"
                    >
                      <div className="w-9 h-9 rounded-lg bg-surface-3 border border-line flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <span className="text-[10px] text-t3 font-bold">{c.name[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-t1 truncate">{c.name}</p>
                        <p className="text-[10px] text-t2 truncate">{c.domain}</p>
                        {c.category && <p className="text-[9px] text-t3">{c.category}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="h-1" />
    </div>
  );
}
