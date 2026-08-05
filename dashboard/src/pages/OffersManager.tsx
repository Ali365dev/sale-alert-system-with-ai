import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { Offer, OfferFilters } from "../api/offers";
import { useCreateOffer, useDeleteOffer, useOffers, useUpdateOffer, useVerifyOffer } from "../api/offers";
import { isJobActive, useActiveJob, useJob, useStartJob } from "../api/jobs";
import { OfferForm } from "../components/offers/OfferForm";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Label, Select, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";

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
    <Button size="sm" variant="ghost" loading={verify.isPending} onClick={() => verify.mutate(offer.id)}>
      {verify.isPending ? "Verifying" : "Verify AI"}
    </Button>
  );
}

function OffersTable() {
  const [filters, setFilters] = useState<OfferFilters>({});
  const [search, setSearch] = useState("");
  const { data, isLoading } = useOffers(filters);
  const summary = data?.summary;
  const q = search.trim().toLowerCase();
  const offers = q
    ? data?.offers.filter((o) =>
        [o.brand, o.company, o.category, o.subcategory, o.offer_type, o.coupon_code, o.summary, o.website]
          .filter((v): v is string => !!v)
          .some((v) => v.toLowerCase().includes(q)),
      )
    : data?.offers;
  const deleteOffer = useDeleteOffer();
  const updateOffer = useUpdateOffer();
  const verifyAll = useStartJob("verify_offers");
  const activeVerifyAll = useActiveJob("verify_offers");
  const [visibleJobId, setVisibleJobId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [viewing, setViewing] = useState<Offer | null>(null);

  useEffect(() => {
    if (activeVerifyAll.data && visibleJobId === null) setVisibleJobId(activeVerifyAll.data.id);
  }, [activeVerifyAll.data, visibleJobId]);

  const watchedJob = useJob(visibleJobId);
  const bulkRunning = isJobActive(watchedJob.data?.status);

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

      <Card>
        <div style={{ position: "relative" }}>
          <Icon.search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand, category, type, coupon code, or summary…"
            aria-label="Search offers"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            style={{ height: 44, padding: "0 36px", borderRadius: "var(--radius-md)" }}
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          <div>
            <Label>Verification status</Label>
            <Select
              value={filters.verification_status ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, verification_status: e.target.value || undefined }))}
            >
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="suspicious">Suspicious</option>
              <option value="invalid">Invalid</option>
              <option value="unverified">Unverified</option>
            </Select>
          </div>
          <div>
            <Label>Active</Label>
            <Select
              value={filters.active ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, active: (e.target.value || undefined) as "true" | "false" | undefined }))}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button
            loading={verifyAll.isPending || bulkRunning}
            onClick={() => verifyAll.mutate(undefined, { onSuccess: (data) => setVisibleJobId(data.jobId) })}
          >
            Verify all unverified offers
          </Button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {watchedJob.data?.status === "cancelling"
              ? "Finishing current item before stopping… "
              : bulkRunning
                ? `Verifying ${watchedJob.data?.processed_items}/${watchedJob.data?.total_items}… `
                : q
                  ? `${offers?.length ?? 0} of ${data?.offers.length ?? 0} offer(s) match “${search.trim()}” `
                  : `${summary?.unverified ?? 0} unverified offer(s) · ${summary?.total ?? 0} total `}
            <Link to="/pipeline" style={{ color: "var(--brand)" }}>
              View in Pipeline Center →
            </Link>
          </span>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 20, color: "var(--text-muted)" }}>Loading offers…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1100 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 120px 110px 100px 90px 100px 90px 120px 220px",
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
                <span>Brand</span>
                <span>Category</span>
                <span>Type</span>
                <span style={{ textAlign: "right" }}>Disc %</span>
                <span>Expiry</span>
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
                    gridTemplateColumns: "60px 120px 110px 100px 90px 100px 90px 120px 220px",
                    alignItems: "center",
                    gap: 12,
                    padding: "var(--row-pad) 20px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>#{offer.id}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{offer.brand ?? "—"}</span>
                  <span>{offer.category ?? "—"}</span>
                  <span style={{ color: "var(--text-muted)" }}>{offer.offer_type ?? "—"}</span>
                  <span style={{ textAlign: "right", font: "700 13px/1 var(--font-mono)" }}>
                    {offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}
                  </span>
                  <span style={{ font: "500 12px/1 var(--font-mono)" }}>{formatDate(offer.expiry_date)}</span>
                  <span>{offer.is_active ? "Yes" : "No"}</span>
                  {offer.verification_status ? (
                    <Badge tone={VERIFICATION_TONE[offer.verification_status] ?? "neutral"}>{offer.verification_status}</Badge>
                  ) : (
                    <Badge tone="neutral">unverified</Badge>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Button size="sm" variant="ghost" onClick={() => setViewing(offer)}>
                      View
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(offer)}>
                      Edit
                    </Button>
                    <VerifyButton offer={offer} />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete offer #${offer.id}?`)) deleteOffer.mutate(offer.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

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
            <div><strong style={{ color: "var(--text-strong)" }}>Category:</strong> {viewing.category ?? "—"} / {viewing.subcategory ?? "—"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Discount:</strong> {viewing.discount_percentage != null ? `${viewing.discount_percentage}%` : "—"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Coupon code:</strong> {viewing.coupon_code ?? "—"}</div>
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
