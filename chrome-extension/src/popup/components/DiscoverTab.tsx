import { useEffect, useState } from "react";
import type { Brand } from "../../types";
import { createBrand } from "../../services/brandsApi";

interface Props {
  brands: Brand[];
  pageUrl: string;
  onBrandAdded: (brand: Brand) => void;
  onToast: (type: "success" | "error" | "info", text: string) => void;
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

export function DiscoverTab({ brands, pageUrl, onBrandAdded, onToast }: Props) {
  const [mode, setMode] = useState<"current" | "manual">("current");

  // Current-page discover state
  const [currentDomain, setCurrentDomain] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [existingBrand, setExistingBrand] = useState<Brand | null>(null);

  // Manual form state
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualCountry, setManualCountry] = useState("");
  const [manualLogo, setManualLogo] = useState("");

  const [saving, setSaving] = useState(false);

  // Populate current-page section from active tab
  useEffect(() => {
    if (!pageUrl) return;
    const domain = normalizeDomain(pageUrl);
    setCurrentDomain(domain);
    // Get page title from active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setCurrentTitle(tabs[0]?.title ?? domain);
    });
    const found = brands.find((b) => domainFromBrand(b) === domain);
    setExistingBrand(found ?? null);
  }, [pageUrl, brands]);

  const handleQuickAdd = async () => {
    if (!currentDomain) return;
    setSaving(true);
    try {
      const brand = await createBrand({
        name: manualName || currentTitle || currentDomain,
        website: `https://${currentDomain}`,
        country: manualCountry,
      });
      onBrandAdded(brand);
      onToast("success", `Brand "${brand.name}" added.`);
      setManualName("");
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

  const inputCls = "w-full text-xs px-2.5 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary bg-gray-50";

  return (
    <div className="scrollable px-3 py-3 flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-xl p-0.5">
        {(["current", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-[10px] transition ${
              mode === m ? "bg-white shadow-sm text-dark" : "text-gray-500"
            }`}
          >
            {m === "current" ? "Current Page" : "Add Manually"}
          </button>
        ))}
      </div>

      {mode === "current" && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2.5">
          <p className="text-xs font-bold text-dark">Discover Current Website</p>
          {!currentDomain ? (
            <p className="text-[10px] text-gray-400">Open a website in your browser first.</p>
          ) : existingBrand ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                {existingBrand.logo_url && (
                  <img src={existingBrand.logo_url} alt="" className="w-6 h-6 object-contain rounded" />
                )}
                <div>
                  <p className="text-xs font-semibold text-dark">{existingBrand.name}</p>
                  <p className="text-[10px] text-green-600">Already registered</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${currentDomain}&sz=32`}
                  alt=""
                  className="w-6 h-6 rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-dark truncate">{currentTitle}</p>
                  <p className="text-[10px] text-gray-400 truncate">{currentDomain}</p>
                </div>
              </div>
              <input
                type="text"
                placeholder={`Brand name (default: ${currentTitle})`}
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="Country code (e.g. PK, AE, SA)"
                value={manualCountry}
                onChange={(e) => setManualCountry(e.target.value.toUpperCase().slice(0, 2))}
                className={inputCls}
              />
              <button
                onClick={handleQuickAdd}
                disabled={saving}
                className="w-full py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
              >
                {saving ? "Adding…" : "Add Brand"}
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2.5">
          <p className="text-xs font-bold text-dark">Add Brand Manually</p>
          <input type="text" placeholder="Brand name *" value={manualName}
            onChange={(e) => setManualName(e.target.value)} className={inputCls} />
          <input type="url" placeholder="Website URL * (https://...)" value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)} className={inputCls} />
          <input type="text" placeholder="Country code (PK, AE, SA…)" value={manualCountry}
            onChange={(e) => setManualCountry(e.target.value.toUpperCase().slice(0, 2))} className={inputCls} />
          <input type="url" placeholder="Logo URL (optional)" value={manualLogo}
            onChange={(e) => setManualLogo(e.target.value)} className={inputCls} />
          <button
            onClick={handleManualAdd}
            disabled={saving || !manualName.trim() || !manualUrl.trim()}
            className="w-full py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
          >
            {saving ? "Adding…" : "Add Brand"}
          </button>
        </div>
      )}
      <div className="h-1" />
    </div>
  );
}
