import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import type { Offer, OfferFilters } from "../api/offers";
import { useCreateOffer, useDeleteOffer, useOffers, useUpdateOffer, useVerifyOffer } from "../api/offers";
import { apiClient } from "../api/client";
import { isJobActive, useActiveJob, useJob, useStartJob } from "../api/jobs";
import { OfferForm } from "../components/offers/OfferForm";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Select, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { toast } from "../store/toastStore";

const VERIFICATION_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  verified: "success",
  suspicious: "warning",
  invalid: "danger",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function VerifyButton({ offer }: { offer: Offer }) {
  const verify = useVerifyOffer();
  return (
    <IconButton
      icon={<Icon.sparkle size={14} />}
      label="Verify with AI"
      loading={verify.isPending}
      onClick={() => verify.mutate(offer.id)}
    />
  );
}

type ViewMode = "table" | "cards";
const VIEW_MODE_KEY = "dealpulse:offers-view-mode";

function OfferActions({ offer, onView, onEdit }: { offer: Offer; onView: () => void; onEdit: () => void }) {
  const deleteOffer = useDeleteOffer();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <IconButton icon={<Icon.eye size={14} />} label="View" variant="ghost" onClick={onView} />
      <IconButton icon={<Icon.edit size={14} />} label="Edit" variant="secondary" onClick={onEdit} />
      <VerifyButton offer={offer} />
      <IconButton
        icon={<Icon.trash size={14} />}
        label="Delete"
        variant="danger"
        onClick={() => {
          if (window.confirm(`Delete offer #${offer.id}?`)) deleteOffer.mutate(offer.id);
        }}
      />
    </div>
  );
}

function OfferCard({ offer, onView, onEdit }: { offer: Offer; onView: () => void; onEdit: () => void }) {
  return (
    <Card style={{ gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)", marginBottom: 4 }}>#{offer.id}</div>
          <div style={{ fontWeight: 700, color: "var(--text-strong)", fontSize: 14 }}>{offer.brand ?? "—"}</div>
        </div>
        {offer.verification_status ? (
          <Badge tone={VERIFICATION_TONE[offer.verification_status] ?? "neutral"}>{offer.verification_status}</Badge>
        ) : (
          <Badge tone="neutral">unverified</Badge>
        )}
      </div>

      <div
        title={offer.title ?? undefined}
        style={{
          fontSize: 13,
          color: offer.title ? "var(--text-body)" : "var(--text-faint)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {offer.title ?? "—"}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "var(--text-muted)" }}>
        {offer.category && <span>{offer.category}</span>}
        {offer.offer_type && <span>· {offer.offer_type}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ font: "700 18px/1 var(--font-mono)", color: "var(--brand)" }}>
          {offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Expires {formatDate(offer.expiry_date)}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
        <span>{offer.is_active ? "Active" : "Inactive"}</span>
        <span>Created {formatDate(offer.created_at)}</span>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 2, paddingTop: 10 }}>
        <OfferActions offer={offer} onView={onView} onEdit={onEdit} />
      </div>
    </Card>
  );
}

function OffersTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const brandParam = searchParams.get("brand") ?? undefined;
  const emailIdParam = searchParams.get("email_id");
  const [filters, setFilters] = useState<OfferFilters>({
    brand: brandParam,
    email_id: emailIdParam ? Number(emailIdParam) : undefined,
  });
  const [search, setSearch] = useState("");
  const hasFilters = !!(search || filters.verification_status || filters.active);

  function clearFilters() {
    setSearch("");
    setFilters((f) => ({ ...f, verification_status: undefined, active: undefined }));
  }
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "table");
  const { data, isLoading } = useOffers(filters);
  const summary = data?.summary;
  const q = search.trim().toLowerCase();
  const offers = q
    ? data?.offers.filter((o) =>
        [o.title, o.brand, o.company, o.category, o.subcategory, o.offer_type, o.coupon_code, o.summary, o.website]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(q)),
      )
    : data?.offers;
  const updateOffer = useUpdateOffer();
  const verifyAll = useStartJob("verify_offers");
  const activeVerifyAll = useActiveJob("verify_offers");
  const [visibleJobId, setVisibleJobId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [viewing, setViewing] = useState<Offer | null>(null);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionBulkRunning, setSelectionBulkRunning] = useState(false);

  function toggleSelected(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected offer(s)?`)) return;
    setSelectionBulkRunning(true);
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/offers/${id}`)));
    setSelectionBulkRunning(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    if (failed === 0) toast.success(`${ids.length} offer(s) deleted.`);
    else toast.error(`Deleted ${ids.length - failed} offer(s), ${failed} failed.`);
    setSelected(new Set());
  }

  async function bulkReverify() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setSelectionBulkRunning(true);
    const results = await Promise.allSettled(ids.map((id) => apiClient.post(`/offers/${id}/verify`)));
    setSelectionBulkRunning(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    if (failed === 0) toast.success(`${ids.length} offer(s) re-verified.`);
    else toast.error(`Re-verified ${ids.length - failed} offer(s), ${failed} failed.`);
    setSelected(new Set());
  }

  useEffect(() => {
    if (activeVerifyAll.data && visibleJobId === null) setVisibleJobId(activeVerifyAll.data.id);
  }, [activeVerifyAll.data, visibleJobId]);

  const watchedJob = useJob(visibleJobId);
  const bulkRunning = isJobActive(watchedJob.data?.status);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  return (
    <>
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
          <StatCard icon={<Icon.offer size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total offers" value={summary.total} />
          <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Verified" value={summary.verified} valueColor="var(--success)" />
          <StatCard icon={<Icon.alert size={17} />} iconColor="var(--amber-600)" iconBg="var(--warning-subtle)" label="Suspicious" value={summary.suspicious} valueColor="var(--warning)" />
          <StatCard icon={<Icon.x size={17} />} iconColor="var(--danger)" iconBg="var(--danger-subtle)" label="Invalid" value={summary.invalid} valueColor="var(--danger)" />
          <StatCard icon={<Icon.clock size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Unverified" value={summary.unverified} />
          <StatCard icon={<Icon.target size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Active" value={summary.active} />
        </div>
      )}

      {(filters.brand || filters.email_id) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {filters.brand && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--brand-subtle)",
                color: "var(--brand)",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              Brand: {filters.brand}
              <button
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, brand: undefined }));
                  setSearchParams((p) => {
                    p.delete("brand");
                    return p;
                  });
                }}
                aria-label="Clear brand filter"
                style={{ display: "flex", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}
              >
                <Icon.x size={12} />
              </button>
            </span>
          )}
          {filters.email_id && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: "var(--radius-pill)",
                background: "var(--brand-subtle)",
                color: "var(--brand)",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              From email #{filters.email_id}
              <button
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, email_id: undefined }));
                  setSearchParams((p) => {
                    p.delete("email_id");
                    return p;
                  });
                }}
                aria-label="Clear email filter"
                style={{ display: "flex", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}
              >
                <Icon.x size={12} />
              </button>
            </span>
          )}
        </div>
      )}

      <Tabs
        tabs={[
          { id: "", label: "All Offers" },
          { id: "verified", label: "Verified" },
          { id: "unverified", label: "Unverified" },
          { id: "suspicious", label: "Suspicious" },
          { id: "invalid", label: "Invalid" },
        ]}
        active={filters.verification_status ?? ""}
        onChange={(id) => setFilters((f) => ({ ...f, verification_status: id || undefined }))}
      />

      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <Icon.search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, brand, category, type, coupon code, or summary…"
              aria-label="Search offers"
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
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
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

          <Select
            aria-label="Filter by active status"
            value={filters.active ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, active: (e.target.value || undefined) as "true" | "false" | undefined }))}
            style={{ width: 150 }}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>

          <IconButton icon={<Icon.filter size={14} />} label="Clear all filters" variant="secondary" disabled={!hasFilters} onClick={clearFilters} />
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button
            size="sm"
            loading={verifyAll.isPending || bulkRunning}
            disabled={verifyAll.isPending || bulkRunning}
            onClick={() => verifyAll.mutate(undefined, { onSuccess: (data) => setVisibleJobId(data.jobId) })}
          >
            Verify all unverified offers
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={verifyAll.isPending || bulkRunning}
            disabled={verifyAll.isPending || bulkRunning}
            onClick={() =>
              verifyAll.mutate({ statuses: ["suspicious"] }, { onSuccess: (data) => setVisibleJobId(data.jobId) })
            }
          >
            Re-verify suspicious
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={verifyAll.isPending || bulkRunning}
            disabled={verifyAll.isPending || bulkRunning}
            onClick={() =>
              verifyAll.mutate({ statuses: ["invalid"] }, { onSuccess: (data) => setVisibleJobId(data.jobId) })
            }
          >
            Re-verify invalid
          </Button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {watchedJob.data?.status === "cancelling"
              ? "Finishing current item before stopping… "
              : bulkRunning
                ? `Verifying ${watchedJob.data?.processed_items}/${watchedJob.data?.total_items}… `
                : q
                  ? `${offers?.length ?? 0} of ${data?.offers.length ?? 0} offer(s) match “${search.trim()}” `
                  : `${summary?.unverified ?? 0} unverified · ${summary?.suspicious ?? 0} suspicious · ${summary?.invalid ?? 0} invalid · ${summary?.total ?? 0} total `}
            <Link to="/pipeline" style={{ color: "var(--brand)" }}>
              View in Pipeline Center →
            </Link>
          </span>
        </div>
      </Card>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
        <button
          type="button"
          onClick={() => changeViewMode("table")}
          aria-label="Table view"
          aria-pressed={viewMode === "table"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
            borderRight: "none",
            background: viewMode === "table" ? "var(--brand-subtle)" : "var(--surface-card)",
            color: viewMode === "table" ? "var(--brand)" : "var(--text-muted)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Icon.list size={14} /> Table
        </button>
        <button
          type="button"
          onClick={() => changeViewMode("cards")}
          aria-label="Card view"
          aria-pressed={viewMode === "cards"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 10px",
            border: "1px solid var(--border)",
            borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
            background: viewMode === "cards" ? "var(--brand-subtle)" : "var(--surface-card)",
            color: viewMode === "cards" ? "var(--brand)" : "var(--text-muted)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Icon.grid size={14} /> Cards
        </button>
      </div>

      {viewMode === "table" && selected.size > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{selected.size} selected</span>
            <Button size="sm" loading={selectionBulkRunning} disabled={selectionBulkRunning} onClick={bulkReverify}>
              Re-verify selected
            </Button>
            <Button size="sm" variant="danger" loading={selectionBulkRunning} disabled={selectionBulkRunning} onClick={bulkDelete}>
              Delete selected
            </Button>
            <Button size="sm" variant="ghost" disabled={selectionBulkRunning} onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <div style={{ color: "var(--text-muted)" }}>Loading offers…</div>
        </Card>
      ) : viewMode === "cards" ? (
        offers?.length === 0 ? (
          <Card>
            <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
              {q ? `No offers match “${search.trim()}”.` : "No offers found."}
            </div>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {offers?.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onView={() => setViewing(offer)} onEdit={() => setEditing(offer)} />
            ))}
          </div>
        )
      ) : (
        <Card padded={false} style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1100 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 60px minmax(160px, 1fr) 110px 100px 90px 80px 95px 95px 70px 110px 200px",
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
                <input
                  type="checkbox"
                  aria-label="Select all loaded offers"
                  checked={!!offers?.length && offers.every((o) => selected.has(o.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(offers?.map((o) => o.id) ?? []));
                    else setSelected(new Set());
                  }}
                  style={{ width: 14, height: 14 }}
                />
                <span>ID</span>
                <span>Title</span>
                <span>Brand</span>
                <span>Category</span>
                <span>Type</span>
                <span style={{ textAlign: "right" }}>Disc %</span>
                <span>Expiry</span>
                <span>Created</span>
                <span>Active</span>
                <span>Verification</span>
                <span>Actions</span>
              </div>

              {offers?.length === 0 && (
                <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
                  {q ? `No offers match “${search.trim()}”.` : "No offers found."}
                </div>
              )}
              {offers?.map((offer) => (
                <div
                  key={offer.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "28px 60px minmax(160px, 1fr) 110px 100px 90px 80px 95px 95px 70px 110px 200px",
                    alignItems: "center",
                    gap: 12,
                    padding: "var(--row-pad) 20px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select offer #${offer.id}`}
                    checked={selected.has(offer.id)}
                    onChange={() => toggleSelected(offer.id)}
                    style={{ width: 14, height: 14 }}
                  />
                  <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>#{offer.id}</span>
                  <span
                    title={offer.title ?? undefined}
                    style={{
                      color: offer.title ? "var(--text-body)" : "var(--text-faint)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {offer.title ?? "—"}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{offer.brand ?? "—"}</span>
                  <span>{offer.category ?? "—"}</span>
                  <span style={{ color: "var(--text-muted)" }}>{offer.offer_type ?? "—"}</span>
                  <span style={{ textAlign: "right", font: "700 13px/1 var(--font-mono)" }}>
                    {offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}
                  </span>
                  <span style={{ font: "500 12px/1 var(--font-mono)" }}>{formatDate(offer.expiry_date)}</span>
                  <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDate(offer.created_at)}</span>
                  <span>{offer.is_active ? "Yes" : "No"}</span>
                  {offer.verification_status ? (
                    <Badge tone={VERIFICATION_TONE[offer.verification_status] ?? "neutral"}>{offer.verification_status}</Badge>
                  ) : (
                    <Badge tone="neutral">unverified</Badge>
                  )}
                  <OfferActions offer={offer} onView={() => setViewing(offer)} onEdit={() => setEditing(offer)} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {editing && (
        <Modal title={`Edit offer #${editing.id}`} onClose={() => setEditing(null)}>
          <OfferForm
            initial={editing}
            submitting={updateOffer.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(input) => updateOffer.mutate({ id: editing.id, input }, { onSuccess: () => setEditing(null) })}
          />
        </Modal>
      )}

      {viewing && (
        <Modal title={`Offer #${viewing.id} — ${viewing.brand ?? "Unknown brand"}`} onClose={() => setViewing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-body)" }}>
            <div><strong style={{ color: "var(--text-strong)" }}>Title:</strong> {viewing.title ?? "— (no source email)"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Category:</strong> {viewing.category ?? "—"} / {viewing.subcategory ?? "—"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Discount:</strong> {viewing.discount_percentage != null ? `${viewing.discount_percentage}%` : "—"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Coupon code:</strong> {viewing.coupon_code ?? "—"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Created:</strong> {formatDate(viewing.created_at)}</div>
            {viewing.website && (
              <div>
                <strong style={{ color: "var(--text-strong)" }}>Website:</strong>{" "}
                <a href={viewing.website} target="_blank" rel="noreferrer">
                  {viewing.website}
                </a>
              </div>
            )}
            {viewing.summary && <div><strong style={{ color: "var(--text-strong)" }}>Summary:</strong> {viewing.summary}</div>}
            {viewing.key_highlights.length > 0 && (
              <div>
                <strong style={{ color: "var(--text-strong)" }}>Key highlights:</strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {viewing.key_highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}
            {viewing.verification_status ? (
              <div>
                <strong style={{ color: "var(--text-strong)" }}>Verification:</strong>{" "}
                <Badge tone={VERIFICATION_TONE[viewing.verification_status] ?? "neutral"}>{viewing.verification_status}</Badge>{" "}
                ({viewing.verification_confidence}% confidence)
                {viewing.verification_reason && <div style={{ marginTop: 4 }}>{viewing.verification_reason}</div>}
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)" }}>Not verified yet.</div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function AddOffer() {
  const createOffer = useCreateOffer();
  const [done, setDone] = useState(false);

  return (
    <Card>
      {done && (
        <div style={{ padding: "10px 14px", background: "var(--success-subtle)", color: "var(--success)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
          Offer created.
        </div>
      )}
      <OfferForm
        requireEmailId
        submitting={createOffer.isPending}
        onCancel={() => {}}
        onSubmit={(input) =>
          createOffer.mutate(input, {
            onSuccess: () => setDone(true),
          })
        }
      />
    </Card>
  );
}

export function OffersManager() {
  const [tab, setTab] = useState("all");

  return (
    <>
      <Tabs
        tabs={[
          { id: "all", label: "All offers" },
          { id: "add", label: "Add offer" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "all" ? <OffersTable /> : <AddOffer />}
    </>
  );
}
