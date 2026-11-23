import { useEffect, useState } from "react";
import { Link } from "react-router";

import { useListBankOffers, useScrapeBankOffers, type BankOfferRow } from "../../api/bankOffers";
import { useBulkOffers, useDeleteOffer, useUpdateOffer, type BulkOfferAction } from "../../api/bankOfferAdmin";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Select, TextInput } from "../ui/Field";
import { Pagination } from "../ui/Pagination";
import { StatCard } from "../ui/StatCard";
import { Icon } from "../icons";
import { BusinessDrawer } from "./BusinessDrawer";
import { OfferFormModal } from "./OfferFormModal";
import { OffersTable } from "./OffersTable";
import "./bankOffers.css";

const PAGE_SIZE = 50;
type Status = "" | "active" | "inactive" | "expired";

export interface OfferFilters {
  bank?: string;
  card?: string;
}

export function CardOffersTab({ initialFilters, onScrapeJobStart }: {
  initialFilters?: OfferFilters;
  onScrapeJobStart: (jobId: number) => void;
}) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState(initialFilters?.bank ?? "");
  const [cardFilter, setCardFilter] = useState(initialFilters?.card ?? "");
  const [status, setStatus] = useState<Status>("");
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openBusinessId, setOpenBusinessId] = useState<number | null>(null);
  const [editing, setEditing] = useState<BankOfferRow | "new" | null>(null);

  const scrape = useScrapeBankOffers();
  const bulk = useBulkOffers();
  const deleteOffer = useDeleteOffer();
  const updateOffer = useUpdateOffer();

  useEffect(() => {
    const t = setTimeout(() => { setOffset(0); setSearch(q.trim()); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setSelected(new Set()), [search, bankFilter, cardFilter, status, matchedOnly, offset]);

  const { data, isLoading, isFetching } = useListBankOffers({
    q: search || undefined,
    bank_name: bankFilter || undefined,
    card_name: cardFilter || undefined,
    status: status || undefined,
    matched_only: matchedOnly || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const offers = data?.offers ?? [];
  const bankNames = data?.bank_names ?? [];
  const hasFilters = !!search || !!bankFilter || !!cardFilter || !!status || matchedOnly;

  function clearFilters() {
    setQ(""); setSearch(""); setBankFilter(""); setCardFilter(""); setStatus(""); setMatchedOnly(false); setOffset(0);
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function runBulk(action: BulkOfferAction) {
    const ids = [...selected];
    if (action === "delete" && !window.confirm(`Delete ${ids.length} offer${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    bulk.mutate({ ids, action }, { onSuccess: () => setSelected(new Set()) });
  }

  return (
    <div className="bo-stack">
      <div className="bo-stats">
        <StatCard label="Offers" value={total.toLocaleString()} />
        <StatCard label="Active" value={(data?.active_count ?? 0).toLocaleString()} valueColor="var(--success)" />
        <StatCard label="Brand matched" value={(data?.matched_count ?? 0).toLocaleString()} />
        <StatCard label="With expiry" value={(data?.with_expiry_count ?? 0).toLocaleString()} />
      </div>

      <Card>
        <div className="bo-toolbar">
          <div className="bo-search">
            <Icon.search size={15} className="bo-search-icon" aria-hidden="true" />
            <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search business or card…" aria-label="Search offers" style={{ paddingLeft: 36 }} />
          </div>
          <Select aria-label="Filter by bank" value={bankFilter} className="bo-filter-select"
            onChange={(e) => { setBankFilter(e.target.value); setCardFilter(""); setOffset(0); }}>
            <option value="">All banks</option>
            {bankNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={status} className="bo-filter-select"
            onChange={(e) => { setStatus(e.target.value as Status); setOffset(0); }}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
          </Select>
          <label className="bo-check">
            <input type="checkbox" checked={matchedOnly} onChange={(e) => { setMatchedOnly(e.target.checked); setOffset(0); }} />
            Brand-matched only
          </label>
          {hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
          <div className="bo-toolbar-end">
            <Link to="/pipeline" style={{ font: "600 0.8rem/1 var(--font-sans)" }}>View jobs →</Link>
            <Button size="sm" variant="secondary" loading={scrape.isPending}
              onClick={() => scrape.mutate(undefined, { onSuccess: (d) => onScrapeJobStart(d.jobId) })}>
              <Icon.retry size={15} aria-hidden="true" /> Scrape takhfif.app
            </Button>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Icon.plus size={15} aria-hidden="true" /> Add offer
            </Button>
          </div>
        </div>
        {cardFilter && (
          <p className="bo-muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Showing card <strong>{cardFilter}</strong> ·{" "}
            <button type="button" className="bo-link-btn" onClick={() => setCardFilter("")}>show all cards</button>
          </p>
        )}
      </Card>

      {selected.size > 0 && (
        <div className="bo-bulkbar" role="region" aria-label="Bulk actions">
          <span aria-live="polite">{selected.size} selected</span>
          <div className="bo-bulkbar-actions">
            <Button size="sm" variant="secondary" loading={bulk.isPending} onClick={() => runBulk("activate")}>Activate</Button>
            <Button size="sm" variant="secondary" loading={bulk.isPending} onClick={() => runBulk("deactivate")}>Deactivate</Button>
            <Button size="sm" variant="danger" loading={bulk.isPending} onClick={() => runBulk("delete")}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancel</Button>
          </div>
        </div>
      )}

      <Card padded={false} style={{ overflow: "hidden", gap: 0, opacity: isFetching && !isLoading ? 0.7 : 1, transition: "opacity 150ms" }}>
        {isLoading ? (
          <div aria-busy="true" aria-label="Loading offers">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-shimmer bo-skeleton-row" />)}
          </div>
        ) : offers.length === 0 ? (
          <div className="bo-empty">
            <span className="bo-empty-icon"><Icon.card size={24} aria-hidden="true" /></span>
            <strong>{hasFilters ? "No offers match these filters" : "No bank offers yet"}</strong>
            <span>{hasFilters ? "Try a different bank or status." : "Add one manually or run a takhfif.app scrape."}</span>
            {hasFilters
              ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button>
              : <Button size="sm" onClick={() => setEditing("new")}><Icon.plus size={15} aria-hidden="true" /> Add first offer</Button>}
          </div>
        ) : (
          <>
            <OffersTable
              offers={offers}
              selected={selected}
              onSelect={toggle}
              onSelectAll={(checked) => setSelected(checked ? new Set(offers.map((o) => o.id)) : new Set())}
              onEdit={setEditing}
              onDelete={(o) => { if (window.confirm(`Delete the ${o.bank_name} offer at ${o.place_name}?`)) deleteOffer.mutate(o.id); }}
              onToggleActive={(o) => updateOffer.mutate({ id: o.id, input: { is_active: !o.is_active } })}
              onOpenBusiness={setOpenBusinessId}
            />
            <Pagination offset={offset} pageSize={PAGE_SIZE} total={total} onChange={setOffset} />
          </>
        )}
      </Card>

      {editing && (
        <OfferFormModal offer={editing === "new" ? undefined : editing} bankNames={bankNames} onClose={() => setEditing(null)} />
      )}
      {openBusinessId != null && <BusinessDrawer businessId={openBusinessId} onClose={() => setOpenBusinessId(null)} />}
    </div>
  );
}
