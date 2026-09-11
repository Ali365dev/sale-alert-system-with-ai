import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { apiClient } from "../api/client";
import {
  isHttpUrl,
  useBrandScrapeConfig,
  useScrapeNow,
  useUpdateBrandScrapeConfig,
  useWebsiteActivity,
  useWebsiteBrandsSummary,
  type WebsiteBrandSummary,
} from "../api/websiteScraper";
import { toast } from "../store/toastStore";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldGroup, Label, Select, TextArea, TextInput } from "../components/ui/Field";
import { LoadingState } from "../components/ui/Spinner";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";

type RowStatus = "active" | "idle" | "disabled" | "error";

const STATUS_META: Record<RowStatus, { label: string; tone: "success" | "warning" | "neutral" | "danger"; color: string }> = {
  active: { label: "Active", tone: "success", color: "var(--success)" },
  idle: { label: "Not scraped", tone: "warning", color: "var(--warning)" },
  disabled: { label: "Disabled", tone: "neutral", color: "var(--border-strong)" },
  error: { label: "Error", tone: "danger", color: "var(--danger)" },
};

const SEVERITY_ICON: Record<string, string> = { success: "✓", warning: "⚠", error: "✗", info: "○" };
const SEVERITY_COLOR: Record<string, string> = {
  success: "var(--success)", warning: "var(--warning)", error: "var(--danger)", info: "var(--text-muted)",
};

const PAGE_SIZE = 8;

function rowStatus(row: WebsiteBrandSummary): RowStatus {
  if (!row.scraping_enabled) return "disabled";
  if (row.status === "failed") return "error";
  if (row.status === "never_run") return "idle";
  return "active";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function lastResultText(row: WebsiteBrandSummary): string {
  if (row.status === "failed") return row.last_error || "Scrape failed";
  if (!row.last_scraped_at) return "Not scraped yet";
  if (row.last_content_change_at === row.last_scraped_at) return "Content updated";
  if (row.active_offers > 0) return `${row.active_offers} offer(s) active`;
  return "No sale detected";
}

function downloadCsv(rows: WebsiteBrandSummary[]) {
  const header = ["Brand", "Website", "Status", "Last Scraped", "Active Offers", "Total Offers"];
  const lines = rows.map((r) =>
    [r.brand_name, r.website, rowStatus(r), r.last_scraped_at ?? "", String(r.active_offers), String(r.total_offers)]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "website-scraper-brands.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function optionalUrlError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isHttpUrl(trimmed)) return "Enter a full http(s) URL.";
  return null;
}

function ConfigureForm({ row, onDone }: { row: WebsiteBrandSummary; onDone: () => void }) {
  const { data: config, isLoading, isError, refetch } = useBrandScrapeConfig(row.brand_id);
  const [salePage, setSalePage] = useState("");
  const [offersPage, setOffersPage] = useState("");
  const [promoPage, setPromoPage] = useState("");
  const [customUrls, setCustomUrls] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const update = useUpdateBrandScrapeConfig(row.brand_id);

  useEffect(() => {
    if (!config) return;
    setSalePage(config.sale_page_url ?? "");
    setOffersPage(config.offers_page_url ?? "");
    setPromoPage(config.promotions_page_url ?? "");
    setCustomUrls((config.custom_scrape_urls ?? []).join("\n"));
  }, [config]);

  function handleSave() {
    const fields = [salePage, offersPage, promoPage];
    if (fields.some((value) => optionalUrlError(value))) {
      setFormError("Sale, offers, and promotions URLs must be empty or full http(s) links.");
      return;
    }
    const extra = customUrls.split("\n").map((line) => line.trim()).filter(Boolean);
    if (extra.some((url) => !isHttpUrl(url))) {
      setFormError("Each extra URL must be a full http(s) link, one per line.");
      return;
    }
    setFormError(null);
    update.mutate(
      {
        sale_page_url: salePage.trim(),
        offers_page_url: offersPage.trim(),
        promotions_page_url: promoPage.trim(),
        custom_scrape_urls: extra,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "var(--surface-sunken)", borderTop: "1px solid var(--border)" }}>
      {isLoading && <LoadingState label="Loading saved URLs…" />}
      {isError && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--danger)" }}>Could not load this brand’s scrape URLs.</p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>Try again</Button>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <FieldGroup>
              <Label>Sale page URL</Label>
              <TextInput value={salePage} onChange={(e) => setSalePage(e.target.value)} placeholder={`${row.website.replace(/\/$/, "")}/sale`} aria-invalid={!!optionalUrlError(salePage)} />
            </FieldGroup>
            <FieldGroup>
              <Label>Offers page URL</Label>
              <TextInput value={offersPage} onChange={(e) => setOffersPage(e.target.value)} aria-invalid={!!optionalUrlError(offersPage)} />
            </FieldGroup>
            <FieldGroup>
              <Label>Promotions page URL</Label>
              <TextInput value={promoPage} onChange={(e) => setPromoPage(e.target.value)} aria-invalid={!!optionalUrlError(promoPage)} />
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Extra URLs (one per line)</Label>
            <TextArea value={customUrls} onChange={(e) => setCustomUrls(e.target.value)} placeholder="https://brand.com/outlet" />
          </FieldGroup>
          {formError && <p style={{ margin: 0, fontSize: 12.5, color: "var(--danger)" }}>{formError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" loading={update.isPending} onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Its own useScrapeNow() instance per row — sharing one mutation across all
 * rows (as an earlier version of this page did) means `.isPending` goes true
 * for every row's button at once whenever any single row is clicked. */
function ScrapeNowButton({ row, onStarted }: { row: WebsiteBrandSummary; onStarted: (jobId: number, brandName: string) => void }) {
  const scrapeNow = useScrapeNow();
  return (
    <IconButton
      icon={<Icon.play size={13} />}
      label="Scrape now"
      loading={scrapeNow.isPending}
      onClick={() => scrapeNow.mutate({ brand_id: row.brand_id }, { onSuccess: (data) => onStarted(data.jobId, row.brand_name) })}
    />
  );
}

function ActionsMenu({ row, onConfigure }: { row: WebsiteBrandSummary; onConfigure: () => void }) {
  const [open, setOpen] = useState(false);
  const toggleEnabled = useUpdateBrandScrapeConfig(row.brand_id);

  return (
    <div style={{ position: "relative" }}>
      <IconButton icon={<span style={{ fontSize: 16, lineHeight: 1 }}>⋮</span>} label="More actions" onClick={() => setOpen((v) => !v)} />
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute", right: 0, top: "110%", zIndex: 20, minWidth: 160,
              background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", padding: 4,
            }}
          >
            <button
              type="button"
              onClick={() => { setOpen(false); onConfigure(); }}
              style={menuItemStyle}
            >
              Configure
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); toggleEnabled.mutate({ website_scraping_enabled: !row.scraping_enabled }); }}
              style={menuItemStyle}
            >
              {row.scraping_enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", border: "none", background: "transparent",
  color: "var(--text-body)", fontSize: 12.5, borderRadius: "var(--radius-sm)", cursor: "pointer",
};

export function WebsiteScraper() {
  const { data, isLoading, isError, dataUpdatedAt, refetch, isFetching } = useWebsiteBrandsSummary();
  const { data: activity } = useWebsiteActivity();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RowStatus>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [configuringId, setConfiguringId] = useState<number | null>(null);
  const [scrapingAll, setScrapingAll] = useState(false);
  const [confirmScrape, setConfirmScrape] = useState<"all" | "selected" | null>(null);
  const [activeJob, setActiveJob] = useState<{ jobId: number; brandName: string } | null>(null);

  const rows = data ?? [];

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && rowStatus(r) !== statusFilter) return false;
      if (search.trim() && !`${r.brand_name} ${r.website}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stats = useMemo(() => {
    const enabled = rows.filter((r) => r.scraping_enabled).length;
    const activeOffers = rows.reduce((sum, r) => sum + r.active_offers, 0);
    const scrapedToday = rows.filter((r) => isToday(r.last_scraped_at)).length;
    const failed = rows.filter((r) => r.status === "failed").length;
    return { total: rows.length, enabled, activeOffers, scrapedToday, failed };
  }, [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<RowStatus, number> = { active: 0, idle: 0, disabled: 0, error: 0 };
    for (const r of rows) counts[rowStatus(r)] += 1;
    return counts;
  }, [rows]);

  const totalForDonut = rows.length || 1;
  let cumulative = 0;
  const conicStops = (["active", "idle", "disabled", "error"] as RowStatus[])
    .filter((s) => statusCounts[s] > 0)
    .map((s) => {
      const start = (cumulative / totalForDonut) * 100;
      cumulative += statusCounts[s];
      const end = (cumulative / totalForDonut) * 100;
      return `${STATUS_META[s].color} ${start}% ${end}%`;
    })
    .join(", ");

  async function startScrapes(targets: WebsiteBrandSummary[]) {
    const eligible = targets.filter((r) => r.scraping_enabled && r.website);
    if (eligible.length === 0) {
      toast.error("No enabled brands with a website URL in this selection.");
      return;
    }
    setScrapingAll(true);
    let started = 0;
    for (const row of eligible) {
      try {
        await apiClient.post("/website-scraper/scrape-now", { brand_id: row.brand_id });
        started += 1;
      } catch {
        // individual failures don't stop the batch — summarized below
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    setScrapingAll(false);
    if (started === 0) toast.error(`Could not start any scrapes (${eligible.length} attempted).`);
    else toast.success(`Started scraping ${started} of ${eligible.length} brand(s).`);
    refetch();
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRows = rows.filter((r) => selected.has(r.brand_id));

  if (isLoading) return <LoadingState label="Loading website brands…" />;

  if (isError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>Unable to load website scraper brands.</p>
        <div><Button size="sm" variant="secondary" onClick={() => refetch()}>Try again</Button></div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--brand-subtle)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon.globe size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, font: "800 20px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Website Sale Scraper</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Monitor brand websites, detect sales, and automatically create offers.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            Last updated<br />
            <span style={{ color: "var(--text-muted)" }}>{new Date(dataUpdatedAt).toLocaleString()}</span>
          </span>
          <IconButton icon={<Icon.retry size={15} />} label="Refresh" loading={isFetching} onClick={() => refetch()} />
          <Button variant="secondary" loading={scrapingAll} onClick={() => setConfirmScrape("all")}>
            <Icon.play size={14} /> Scrape All Brands
          </Button>
          {selected.size > 0 && (
            <Button variant="secondary" loading={scrapingAll} onClick={() => setConfirmScrape("selected")}>
              Scrape selected ({selected.size})
            </Button>
          )}
          <Button onClick={() => navigate("/brands")}>
            <Icon.store size={14} /> Add Brand Website
          </Button>
        </div>
      </div>

      {activeJob && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Scraping: <strong style={{ color: "var(--text-strong)" }}>{activeJob.brandName}</strong>
          </div>
          <ProcessingPanel jobId={activeJob.jobId} onDismiss={() => setActiveJob(null)} />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.store size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total Brands" value={stats.total} caption="Brands being monitored" />
        <StatCard icon={<Icon.play size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Active Scrapers" value={`${stats.enabled} / ${stats.total}`} caption="Currently enabled" />
        <StatCard icon={<Icon.tag size={17} />} iconColor="var(--ai)" iconBg="var(--ai-subtle)" label="Active Website Offers" value={stats.activeOffers} caption="Offers from websites" />
        <StatCard icon={<Icon.retry size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Scrapes Today" value={stats.scrapedToday} caption="Brands scraped today" />
        <StatCard icon={<Icon.alert size={17} />} iconColor="var(--danger)" iconBg="var(--danger-subtle)" label="Failed Scrapes" value={stats.failed} valueColor={stats.failed ? "var(--danger)" : undefined} caption="Requires attention" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        <Card>
          <CardHeader icon={<Icon.activity size={16} style={{ color: "var(--brand)" }} />} title="Recent Scraping Activity" />
          {!activity || activity.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
              No scraping jobs have run yet. Use Scrape now on a brand, or open Website Scraper Test for a single URL.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {activity.slice(0, 8).map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: SEVERITY_COLOR[a.severity], fontSize: 14, flex: "0 0 auto" }}>{SEVERITY_ICON[a.severity] ?? "○"}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-body)", flex: "1 1 auto" }}>{a.message}</span>
                  <span style={{ fontSize: 11, color: "var(--text-faint)", flex: "0 0 auto", whiteSpace: "nowrap" }}>{timeAgo(a.time)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon={<Icon.pie size={16} style={{ color: "var(--brand)" }} />} title="Scraping Status Overview" />
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: 140, height: 140, flex: "0 0 140px", borderRadius: "50%", background: conicStops ? `conic-gradient(${conicStops})` : "var(--surface-sunken)" }}>
              <div style={{ position: "absolute", inset: 24, borderRadius: "50%", background: "var(--surface-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                <div style={{ font: "800 24px/1 var(--font-mono)", color: "var(--text-strong)" }}>{stats.total}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>brands</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "1 1 160px", minWidth: 150 }}>
              {(["active", "idle", "disabled", "error"] as RowStatus[]).map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_META[s].color }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-body)", flex: "1 1 auto" }}>{STATUS_META[s].label}</span>
                  <span style={{ font: "600 12.5px/1 var(--font-mono)", color: "var(--text-strong)" }}>{statusCounts[s]}</span>
                  <span style={{ font: "500 11.5px/1 var(--font-mono)", color: "var(--text-faint)", width: 42, textAlign: "right" }}>
                    {((statusCounts[s] / totalForDonut) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, font: "var(--fw-semibold) 15px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Brand Website Monitoring</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: 200 }}>
              <TextInput
                placeholder="Search brand or URL…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ paddingLeft: 32 }}
              />
              <Icon.search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            </div>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }} style={{ width: 150 }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="idle">Not scraped</option>
              <option value="disabled">Disabled</option>
              <option value="error">Error</option>
            </Select>
            <Button variant="secondary" size="sm" onClick={() => downloadCsv(filtered)}>
              <Icon.download size={14} /> Export
            </Button>
          </div>
        </div>

        <div style={{ overflowX: "auto", padding: "12px 20px 20px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 6px", width: 28 }}>
                  <input
                    type="checkbox"
                    checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.brand_id))}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const r of pageRows) e.target.checked ? next.add(r.brand_id) : next.delete(r.brand_id);
                        return next;
                      });
                    }}
                  />
                </th>
                <th style={{ padding: "8px 6px" }}>Brand</th>
                <th style={{ padding: "8px 6px" }}>Website</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
                <th style={{ padding: "8px 6px" }}>Last Scraped</th>
                <th style={{ padding: "8px 6px" }}>Content Change</th>
                <th style={{ padding: "8px 6px" }}>Active Offers</th>
                <th style={{ padding: "8px 6px" }}>Last Result</th>
                <th style={{ padding: "8px 6px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const status = rowStatus(row);
                const changed = row.last_content_change_at !== null && row.last_content_change_at === row.last_scraped_at;
                return (
                  <Fragment key={row.brand_id}>
                    <tr style={{ borderBottom: configuringId === row.brand_id ? "none" : "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 6px" }}>
                        <input type="checkbox" checked={selected.has(row.brand_id)} onChange={() => toggleSelected(row.brand_id)} />
                      </td>
                      <td style={{ padding: "10px 6px", fontWeight: 600, color: "var(--text-strong)" }}>{row.brand_name}</td>
                      <td style={{ padding: "10px 6px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <a href={row.website} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{row.website}</a>
                      </td>
                      <td style={{ padding: "10px 6px" }}><Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge></td>
                      <td style={{ padding: "10px 6px", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{timeAgo(row.last_scraped_at)}</td>
                      <td style={{ padding: "10px 6px" }}>{changed ? <Icon.check size={14} style={{ color: "var(--success)" }} /> : <span style={{ color: "var(--text-faint)" }}>—</span>}</td>
                      <td style={{ padding: "10px 6px", fontWeight: 600 }}>{row.active_offers}</td>
                      <td style={{ padding: "10px 6px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }} title={lastResultText(row)}>
                        {lastResultText(row)}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/website-scraper/brands/${row.brand_id}`)}>View</Button>
                          <ScrapeNowButton row={row} onStarted={(jobId, brandName) => setActiveJob({ jobId, brandName })} />
                          <ActionsMenu row={row} onConfigure={() => setConfiguringId(configuringId === row.brand_id ? null : row.brand_id)} />
                        </div>
                      </td>
                    </tr>
                    {configuringId === row.brand_id && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <ConfigureForm row={row} onDone={() => setConfiguringId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  {rows.length === 0
                    ? "No brands have a website URL yet. Add a website in Brands Manager, then return here to scrape."
                    : "No brands match this search or filter. Clear the search or choose All Statuses."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 18px", fontSize: 12, color: "var(--text-muted)" }}>
          <span>Showing {pageRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} brands</span>
          <div style={{ display: "flex", gap: 6 }}>
            <Button size="sm" variant="ghost" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>{currentPage} / {totalPages}</span>
            <Button size="sm" variant="ghost" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      {confirmScrape && (
        <Modal
          title={confirmScrape === "all" ? "Scrape all enabled brands?" : `Scrape ${selectedRows.length} selected brand(s)?`}
          onClose={() => setConfirmScrape(null)}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-body)", lineHeight: 1.5 }}>
            This starts a website scrape job for each enabled brand. Adidas-like sites can take 15+ seconds each. You can follow progress in Pipeline Center.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setConfirmScrape(null)}>Cancel</Button>
            <Button
              onClick={() => {
                const targets = confirmScrape === "all" ? rows : selectedRows;
                setConfirmScrape(null);
                void startScrapes(targets);
              }}
            >
              Start scraping
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
