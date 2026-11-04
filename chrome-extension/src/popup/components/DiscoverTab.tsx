import { useEffect, useRef, useState } from "react";
import type { Brand } from "../../types";
import { createBrand, startBrandDiscovery, getBrandDiscovery } from "../../services/brandsApi";

interface Props {
  brands: Brand[];
  pageUrl: string;
  onBrandAdded: (brand: Brand) => void;
  onToast: (type: "success" | "error" | "info", text: string) => void;
}

interface DiscoveredData {
  name: string;
  country: string;
  logo_url: string;
  description: string;
  duplicate_brand_id: number | null;
  duplicate_brand?: { id: number; name: string; website: string | null } | null;
}

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function domainFromBrand(b: Brand): string {
  return normalizeDomain(b.website ?? "");
}

const SparkleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
  </svg>
);

export function DiscoverTab({ brands, pageUrl, onBrandAdded, onToast }: Props) {
  const [mode, setMode] = useState<"current" | "manual">("current");

  // Current-page state
  const [currentDomain, setCurrentDomain] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [existingBrand, setExistingBrand] = useState<Brand | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredData | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual form state
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualCountry, setManualCountry] = useState("");
  const [manualLogo, setManualLogo] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pageUrl) return;
    const domain = normalizeDomain(pageUrl);
    setCurrentDomain(domain);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setCurrentTitle(tabs[0]?.title ?? domain);
    });
    const found = brands.find((b) => domainFromBrand(b) === domain);
    setExistingBrand(found ?? null);
    // Reset analysis when page changes
    setDiscovered(null);
    setName("");
    setCountry("");
    setLogoUrl("");
  }, [pageUrl, brands]);

  // Cleanup poll timer on unmount
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const runAnalysis = async () => {
    if (!currentDomain || analyzing) return;
    setAnalyzing(true);
    setDiscovered(null);
    setAnalyzeStep("Starting analysis…");

    try {
      const { discoveryId } = await startBrandDiscovery(
        `https://${currentDomain}`,
        name || currentTitle || currentDomain,
      );

      setAnalyzeStep("Analyzing website & database…");

      // Poll until terminal status
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const poll = async () => {
          attempts++;
          if (attempts > 30) { reject(new Error("Analysis timed out")); return; }
          try {
            const result = await getBrandDiscovery(discoveryId);
            if (result.status === "review" || result.status === "saved") {
              setDiscovered({
                name: result.name ?? "",
                country: result.country ?? "",
                logo_url: result.logo_url ?? "",
                description: result.description ?? "",
                duplicate_brand_id: result.duplicate_brand_id,
                duplicate_brand: result.duplicate_brand,
              });
              // Auto-fill fields with discovered data
              if (result.name) setName(result.name);
              if (result.country) setCountry(result.country);
              if (result.logo_url) setLogoUrl(result.logo_url);
              resolve();
            } else if (result.status === "failed") {
              reject(new Error(result.error ?? "Analysis failed"));
            } else {
              const steps = ["Scanning website…", "Extracting brand info…", "Matching database…", "Finalizing…"];
              setAnalyzeStep(steps[Math.floor(attempts / 2) % steps.length]);
              pollRef.current = setTimeout(poll, 2000);
            }
          } catch (e) {
            reject(e);
          }
        };
        pollRef.current = setTimeout(poll, 1500);
      });
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
      setAnalyzeStep("");
    }
  };

  const handleQuickAdd = async () => {
    if (!currentDomain) return;
    setSaving(true);
    try {
      const brand = await createBrand({
        name: name || currentTitle || currentDomain,
        website: `https://${currentDomain}`,
        country,
        logo_url: logoUrl || undefined,
      });
      onBrandAdded(brand);
      onToast("success", `Brand "${brand.name}" added.`);
      setName(""); setCountry(""); setLogoUrl(""); setDiscovered(null);
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Failed to add brand");
    } finally {
      setSaving(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualName.trim() || !manualUrl.trim()) return;
    const domain = normalizeDomain(manualUrl);
    const duplicate = brands.find((b) => domainFromBrand(b) === domain);
    if (duplicate) {
      onToast("info", `"${duplicate.name}" already registered for this domain.`);
      return;
    }
    setSaving(true);
    try {
      const brand = await createBrand({
        name: manualName.trim(),
        website: manualUrl.trim(),
        country: manualCountry,
        logo_url: manualLogo.trim() || undefined,
      });
      onBrandAdded(brand);
      onToast("success", `Brand "${brand.name}" added.`);
      setManualName(""); setManualUrl(""); setManualCountry(""); setManualLogo("");
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Failed to add brand");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full text-[11px] px-2.5 py-2 border border-line rounded-lg outline-none focus:border-primary bg-surface-2 text-t1 placeholder-t3";

  return (
    <div className="scrollable px-3 py-3 flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex bg-surface-2 rounded-xl p-0.5">
        {(["current", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-[10px] transition ${
              mode === m ? "bg-surface-3 text-t1" : "text-t2"
            }`}
          >
            {m === "current" ? "Current Page" : "Add Manually"}
          </button>
        ))}
      </div>

      {/* ── Current Page mode ── */}
      {mode === "current" && (
        <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-3">
          <p className="text-[11px] font-bold text-t1">Discover Current Website</p>

          {!currentDomain ? (
            <p className="text-[10px] text-t2">Open a website in your browser first.</p>
          ) : existingBrand ? (
            <div className="flex items-center gap-2.5 p-2.5 bg-green-900/20 border border-green-500/30 rounded-xl">
              {existingBrand.logo_url && (
                <img src={existingBrand.logo_url} alt="" className="w-8 h-8 object-contain rounded-lg flex-shrink-0" />
              )}
              <div>
                <p className="text-[11px] font-semibold text-t1">{existingBrand.name}</p>
                <p className="text-[10px] text-green-400">Already registered</p>
              </div>
            </div>
          ) : (
            <>
              {/* Site preview card */}
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

              {/* Auto Analyze button / status */}
              {analyzing ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-primary/10 border border-primary/25 rounded-xl">
                  <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-[10px] text-primary font-medium">{analyzeStep}</span>
                </div>
              ) : !discovered ? (
                <button
                  onClick={runAnalysis}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-2 hover:bg-surface-3 border border-line hover:border-primary/40 text-t1 hover:text-primary text-[11px] font-semibold rounded-xl transition"
                >
                  <SparkleIcon />
                  Auto Analyze
                </button>
              ) : null}

              {/* Discovered data preview */}
              {discovered && (
                <div className="flex flex-col gap-1.5 p-2.5 bg-surface-2 border border-line rounded-xl">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <SparkleIcon />
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">Analysis Complete</span>
                  </div>
                  {discovered.duplicate_brand ? (
                    <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/25 rounded-lg">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      <div>
                        <p className="text-[9.5px] font-semibold text-yellow-400">Possible duplicate</p>
                        <p className="text-[9px] text-t2">{discovered.duplicate_brand.name}</p>
                      </div>
                    </div>
                  ) : null}
                  {discovered.description ? (
                    <p className="text-[9.5px] text-t2 leading-relaxed">{discovered.description}</p>
                  ) : null}
                  <button
                    onClick={runAnalysis}
                    className="self-start text-[9px] text-t3 hover:text-primary underline underline-offset-2 transition"
                  >
                    Re-analyze
                  </button>
                </div>
              )}

              {/* Editable fields */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Brand Name</label>
                  <input
                    type="text"
                    placeholder={`Default: ${currentTitle}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Country</label>
                    <input
                      type="text"
                      placeholder="PK, AE, SA…"
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                      className={inputCls}
                    />
                  </div>
                  {logoUrl && (
                    <div className="flex-shrink-0 self-end mb-0.5">
                      <img src={logoUrl} alt="" className="w-9 h-9 rounded-lg object-contain bg-surface-3 border border-line" />
                    </div>
                  )}
                </div>
                {logoUrl || discovered ? (
                  <div>
                    <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Logo URL</label>
                    <input
                      type="url"
                      placeholder="https://…"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                ) : null}
              </div>

              <button
                onClick={handleQuickAdd}
                disabled={saving || analyzing}
                className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-bold rounded-xl transition"
              >
                {saving ? "Adding…" : "Add Brand"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Manual mode ── */}
      {mode === "manual" && (
        <div className="bg-surface border border-line rounded-xl p-3 flex flex-col gap-2.5">
          <p className="text-[11px] font-bold text-t1">Add Brand Manually</p>
          <div>
            <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Brand Name *</label>
            <input type="text" placeholder="e.g. Nike" value={manualName}
              onChange={(e) => setManualName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Website URL *</label>
            <input type="url" placeholder="https://example.com" value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Country</label>
              <input type="text" placeholder="PK, AE…" value={manualCountry}
                onChange={(e) => setManualCountry(e.target.value.toUpperCase().slice(0, 2))} className={inputCls} />
            </div>
            {manualLogo && (
              <div className="flex-shrink-0 self-end mb-0.5">
                <img src={manualLogo} alt="" className="w-9 h-9 rounded-lg object-contain bg-surface-3 border border-line" />
              </div>
            )}
          </div>
          <div>
            <label className="text-[9.5px] font-semibold text-t2 uppercase tracking-wider block mb-1">Logo URL</label>
            <input type="url" placeholder="https://… (optional)" value={manualLogo}
              onChange={(e) => setManualLogo(e.target.value)} className={inputCls} />
          </div>
          <button
            onClick={handleManualAdd}
            disabled={saving || !manualName.trim() || !manualUrl.trim()}
            className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-bold rounded-xl transition"
          >
            {saving ? "Adding…" : "Add Brand"}
          </button>
        </div>
      )}

      <div className="h-1" />
    </div>
  );
}
