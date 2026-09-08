import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import type { Brand } from "../api/brands";
import {
  useBrands,
  useBulkSearchBrands,
  useBulkSearchStatus,
  useCreateBrand,
  useDeleteBrand,
  useSearchBrand,
  useSearchBrandStatus,
  useUpdateBrand,
} from "../api/brands";
import { BrandForm } from "../components/brands/BrandForm";
import { BrandLogo } from "../components/public/BrandLogo";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Label, Select, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { Icon } from "../components/icons";
import { toast } from "../store/toastStore";
import { exportBrandsToCsv, exportBrandsToPdf } from "../utils/exportBrands";

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function SingleSearch({ brands }: { brands: Brand[] }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | undefined>(brands[0]?.id);
  const [pollingId, setPollingId] = useState<number | null>(null);
  const search = useSearchBrand();
  const status = useSearchBrandStatus(pollingId);
  const selected = brands.find((b) => b.id === selectedId);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!status.data || status.data.running || settledRef.current) return;
    settledRef.current = true;
    queryClient.invalidateQueries({ queryKey: ["brands"] });
    if (status.data.error) {
      toast.error(`Brand search failed: ${status.data.error}`);
    } else if (status.data.result) {
      toast.success(`Found ${status.data.result.found} offer(s) — ${status.data.result.saved} saved.`);
    }
  }, [status.data, queryClient]);

  const running = status.data?.running ?? search.isPending;
  const result = status.data?.result ?? null;

  return (
    <Card>
      <CardHeader title="Single brand search" />
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        Pick a brand and search for its current promotions via AI.
      </p>
      {brands.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No brands in the database.</span>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <Label>Select brand</Label>
              <Select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              loading={running}
              onClick={() => {
                if (!selectedId) return;
                settledRef.current = false;
                setPollingId(selectedId);
                search.mutate(selectedId, {
                  onError: () => setPollingId(null),
                });
              }}
            >
              Search
            </Button>
          </div>
          {selected && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Last searched: {formatDateTime(selected.last_searched)}
              {selected.categories.length > 0 && <> · Categories: {selected.categories.join(", ")}</>}
            </div>
          )}
          {running && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Searching…</div>
          )}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, color: "var(--text-body)" }}>
                Found {result.found} offer(s) ({result.active} active) — {result.saved} saved, {result.failed} failed.
              </div>
              {result.preview.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, borderBottom: "1px solid var(--border)", padding: "6px 0" }}>
                  <span style={{ color: "var(--text-muted)", minWidth: 80 }}>{o.offer_type ?? "—"}</span>
                  <span style={{ fontWeight: 600 }}>{o.discount_percentage != null ? `${o.discount_percentage}%` : "—"}</span>
                  <span style={{ color: "var(--text-faint)" }}>{o.coupon_code ?? ""}</span>
                  <span style={{ color: "var(--text-muted)", flex: 1 }}>{o.summary}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function BulkSearch({ brands }: { brands: Brand[] }) {
  const [skipCache, setSkipCache] = useState(false);
  const bulkSearch = useBulkSearchBrands();
  const status = useBulkSearchStatus(bulkSearch.isPending || !!bulkSearch.data);
  const activeBrands = brands.filter((b) => b.is_active);
  const running = status.data?.running ?? false;

  return (
    <Card>
      <CardHeader title="Bulk brand search" />
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        Search all active brands at once. This may take a few minutes.
      </p>
      <div style={{ fontSize: 13, color: "var(--text-body)" }}>{activeBrands.length} active brand(s) will be searched.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button loading={bulkSearch.isPending || running} onClick={() => bulkSearch.mutate(skipCache)}>
          Search all active brands
        </Button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-body)" }}>
          <input type="checkbox" checked={skipCache} onChange={(e) => setSkipCache(e.target.checked)} />
          Skip cache — re-search all brands
        </label>
      </div>
      {status.data && (running || status.data.done > 0) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {running
            ? `Searching ${status.data.done}/${status.data.total}…`
            : `Done — ${status.data.offers_found} offer(s) found, ${status.data.offers_saved} saved.`}
        </div>
      )}
    </Card>
  );
}

const SOCIAL_ICONS = {
  facebook: Icon.facebook,
  instagram: Icon.instagram,
  twitter: Icon.twitter,
  youtube: Icon.youtube,
} as const;

function IconLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        borderRadius: "var(--radius-sm)",
        color: "var(--text-muted)",
        background: "var(--surface-sunken)",
      }}
    >
      {children}
    </a>
  );
}

function AllBrands({ brands, summary }: { brands: Brand[]; summary: { total: number; active: number; ever_searched: number; known_sender_emails: number } }) {
  const navigate = useNavigate();
  const deleteBrand = useDeleteBrand();
  const updateBrand = useUpdateBrand();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"" | "active" | "inactive">("");
  const bulkSearch = useBulkSearchBrands();
  const bulkStatus = useBulkSearchStatus(bulkSearch.isPending || !!bulkSearch.data);
  const bulkRunning = bulkStatus.data?.running ?? false;

  if (brands.length === 0) {
    return (
      <Card>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No brands in the database.</span>
      </Card>
    );
  }

  const byStatus = statusTab ? brands.filter((b) => (statusTab === "active" ? b.is_active : !b.is_active)) : brands;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? byStatus.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.website ?? "").toLowerCase().includes(q) ||
          b.emails.some((e) => e.toLowerCase().includes(q)),
      )
    : byStatus;
  const hasFilters = !!(query || statusTab);
  const activeBrands = brands.filter((b) => b.is_active);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.house size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total brands" value={summary.total} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Active" value={summary.active} />
        <StatCard icon={<Icon.search size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Ever searched" value={summary.ever_searched} />
        <StatCard icon={<Icon.sparkle size={17} />} iconColor="var(--ai)" iconBg="var(--ai-subtle)" label="Known sender emails" value={summary.known_sender_emails} />
      </div>

      <Tabs
        tabs={[
          { id: "", label: "All Brands" },
          { id: "active", label: "Active" },
          { id: "inactive", label: "Inactive" },
        ]}
        active={statusTab}
        onChange={(id) => setStatusTab(id as "" | "active" | "inactive")}
      />

      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <Icon.search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by brand name, website, or sender email…"
              aria-label="Search brands"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              style={{ height: 42, padding: "0 36px", borderRadius: "var(--radius-md)" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  background: "transparent",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                }}
              >
                <Icon.x size={13} />
              </button>
            )}
          </div>

          <IconButton
            icon={<Icon.filter size={14} />}
            label="Clear all filters"
            variant="secondary"
            disabled={!hasFilters}
            onClick={() => {
              setQuery("");
              setStatusTab("");
            }}
          />

          <div style={{ flex: "1 1 auto" }} />

          <Button size="sm" variant="secondary" disabled={filtered.length === 0} onClick={() => exportBrandsToCsv(filtered, `brands-${new Date().toISOString().slice(0, 10)}.csv`)}>
            <Icon.download size={14} /> CSV
          </Button>
          <Button size="sm" variant="secondary" disabled={filtered.length === 0} onClick={() => exportBrandsToPdf(filtered, `brands-${new Date().toISOString().slice(0, 10)}.pdf`)}>
            <Icon.download size={14} /> PDF
          </Button>
        </div>
        {(q || statusTab) && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {filtered.length} of {brands.length} brand(s) match{q ? ` “${query.trim()}”` : ""}
          </span>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button size="sm" loading={bulkSearch.isPending || bulkRunning} disabled={bulkSearch.isPending || bulkRunning} onClick={() => bulkSearch.mutate(false)}>
            Search all active brands
          </Button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {bulkRunning
              ? `Searching ${bulkStatus.data?.done}/${bulkStatus.data?.total}… `
              : `${activeBrands.length} active · ${summary.ever_searched} ever searched · ${summary.total} total `}
          </span>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1100 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "50px 46px 140px 60px 120px 1fr 80px 160px 160px",
                gap: 12,
                padding: "11px 20px",
                background: "var(--surface-sunken)",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "var(--ls-wide)",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <span>ID</span>
              <span>Logo</span>
              <span>Name</span>
              <span>Website</span>
              <span>Social</span>
              <span>Emails</span>
              <span>Active</span>
              <span>Last searched</span>
              <span>Actions</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
                No brands match “{query.trim()}”.
              </div>
            ) : (
              filtered.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/offers?brand=${encodeURIComponent(b.name)}`)}
                title={`View offers from ${b.name}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "50px 46px 140px 60px 120px 1fr 80px 160px 160px",
                  alignItems: "center",
                  gap: 12,
                  padding: "var(--row-pad) 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>#{b.id}</span>
                <BrandLogo name={b.name} size={30} />
                <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{b.name}</span>
                <span>
                  {b.website ? (
                    <IconLink href={b.website} title={b.website}>
                      <Icon.external size={14} />
                    </IconLink>
                  ) : (
                    <span style={{ color: "var(--text-faint)" }}>—</span>
                  )}
                </span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(() => {
                    const platforms = (Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[]).filter(
                      (platform) => b.social_links?.[platform],
                    );
                    if (platforms.length === 0) return <span style={{ color: "var(--text-faint)" }}>—</span>;
                    return platforms.map((platform) => {
                      const SocialIcon = SOCIAL_ICONS[platform];
                      return (
                        <IconLink key={platform} href={b.social_links?.[platform] ?? "#"} title={platform}>
                          <SocialIcon size={13} />
                        </IconLink>
                      );
                    });
                  })()}
                </span>
                <span
                  title={b.emails.join(", ")}
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    font: "500 12px/1 var(--font-mono)",
                    color: "var(--text-muted)",
                  }}
                >
                  {b.emails.length ? b.emails.join(", ") : "—"}
                </span>
                <span>{b.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</span>
                <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(b.last_searched)}</span>
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(b)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete brand "${b.name}"?`)) deleteBrand.mutate(b.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </Card>

      {editing && (
        <Modal title={`Edit brand — ${editing.name}`} onClose={() => setEditing(null)}>
          <BrandForm
            initial={editing}
            submitting={updateBrand.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => updateBrand.mutate({ id: editing.id, input }, { onSuccess: () => setEditing(null) })}
          />
        </Modal>
      )}
    </>
  );
}

function AddBrand() {
  const createBrand = useCreateBrand();
  const [done, setDone] = useState(false);

  return (
    <Card>
      {done && (
        <div style={{ padding: "10px 14px", background: "var(--success-subtle)", color: "var(--success)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
          Brand added.
        </div>
      )}
      <BrandForm submitting={createBrand.isPending} onCancel={() => {}} onSubmit={(input) => createBrand.mutate(input, { onSuccess: () => setDone(true) })} />
    </Card>
  );
}

export function BrandsManager() {
  const [tab, setTab] = useState("all");
  const { data, isLoading, isError } = useBrands();

  if (isLoading) return <div style={{ color: "var(--text-muted)" }}>Loading brands…</div>;
  if (isError || !data) return <div style={{ color: "var(--danger)" }}>Failed to load brands.</div>;

  return (
    <>
      <Tabs
        tabs={[
          { id: "all", label: "All brands" },
          { id: "search", label: "Single search" },
          { id: "bulk", label: "Bulk search" },
          { id: "add", label: "Add brand" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "all" && <AllBrands brands={data.brands} summary={data.summary} />}
      {tab === "search" && <SingleSearch brands={data.brands} />}
      {tab === "bulk" && <BulkSearch brands={data.brands} />}
      {tab === "add" && <AddBrand />}
    </>
  );
}
