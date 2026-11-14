import { useState } from "react";
import { Toggle } from "./primitives";
import { ChevronDownIcon, ChevronUpIcon } from "./icons";

export interface TakhfifOptions {
  scrapeAllPages: boolean;
  startPage: number;
  endPage: number | null;
  scrapeDetails: boolean;
  delaySeconds: number;
  maxRetries: number;
  timeoutSec: number;
}

export const DEFAULT_OPTIONS: TakhfifOptions = {
  scrapeAllPages: true,
  startPage: 1,
  endPage: null,
  scrapeDetails: true,
  delaySeconds: 3,
  maxRetries: 2,
  timeoutSec: 30,
};

const ADVANCED: [string, keyof TakhfifOptions, number, number, number][] = [
  ["Min delay between requests (s)", "delaySeconds", 1, 10, 0.5],
  ["Max retries per step", "maxRetries", 0, 5, 1],
  ["Navigation timeout (s)", "timeoutSec", 10, 60, 5],
];

export function OptionsCard({ options, onChange, running }: {
  options: TakhfifOptions;
  onChange: (patch: Partial<TakhfifOptions>) => void;
  running: boolean;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
      <div className="p-3 flex flex-col gap-3 divide-y divide-line">
        <div>
          <Toggle
            on={options.scrapeAllPages}
            onChange={(v) => onChange({ scrapeAllPages: v })}
            label="Scrape all pages"
            description="Follow pagination until the site has no next page"
          />
          {!options.scrapeAllPages && (
            <div className="flex items-center gap-3 mt-2.5">
              <label className="flex items-center gap-2 flex-1">
                <span className="text-[10px] text-t2">Start page</span>
                <input
                  type="number" min={1} value={options.startPage}
                  onChange={(e) => {
                    const start = Math.max(1, Math.floor(+e.target.value) || 1);
                    onChange({
                      startPage: start,
                      ...(options.endPage != null && options.endPage < start ? { endPage: start } : {}),
                    });
                  }}
                  className="w-16 text-[11px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-2 flex-1">
                <span className="text-[10px] text-t2">End page</span>
                <input
                  type="number" min={options.startPage} value={options.endPage ?? ""}
                  placeholder="last"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onChange({ endPage: raw === "" ? null : Math.max(options.startPage, Math.floor(+raw) || options.startPage) });
                  }}
                  className="w-16 text-[11px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
          <p className="text-[9px] text-t3 mt-2">
            Note: the site's robots.txt discourages paginated crawling — the scraper stays sequential, slow, and pauses on any pushback.
          </p>
        </div>
        <div className="pt-3">
          <Toggle
            on={options.scrapeDetails}
            onChange={(v) => onChange({ scrapeDetails: v })}
            label="Deal Details Scraping"
            description="Prepare a detail queue for bank cards, discounts and terms"
            badge={options.scrapeDetails ? "Full Scraping" : undefined}
          />
          {!options.scrapeDetails && (
            <p className="text-[10px] text-t3 mt-2">
              Detail scraping disabled. Only deal listings will be extracted.
            </p>
          )}
        </div>
      </div>
      {running && (
        <p className="px-3 pb-2 text-[9px] text-t3">Option changes apply to the next session.</p>
      )}
      <button
        onClick={() => setAdvancedOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 border-t border-line text-[10px] text-t2 hover:text-t1 transition"
      >
        <span>Advanced settings</span>
        {advancedOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </button>
      {advancedOpen && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {ADVANCED.map(([label, key, min, max, step]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-t2 flex-1">{label}</span>
              <input
                type="number" min={min} max={max} step={step}
                value={options[key] as number}
                onChange={(e) => onChange({ [key]: Math.min(max, Math.max(min, +e.target.value || min)) })}
                className="w-16 text-[11px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
              />
            </div>
          ))}
          <p className="text-[9px] text-t3">
            Delays adapt upward automatically when the site shows strain — never below your minimum.
          </p>
        </div>
      )}
    </div>
  );
}
