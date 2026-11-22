import { useEffect, useState } from "react";

import { useDeleteScrapedBusiness, useScrapedBusinesses } from "../../api/bankOffers";
import { useUpdateBusiness } from "../../api/bankOfferAdmin";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextInput } from "../ui/Field";
import { Pagination } from "../ui/Pagination";
import { Icon } from "../icons";
import { BusinessDrawer } from "./BusinessDrawer";
import { BusinessFormModal } from "./BusinessFormModal";
import { fmtDate } from "./format";
import "./bankOffers.css";

const PAGE_SIZE = 50;

export function BusinessesTab() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [matchedOnly, setMatchedOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const update = useUpdateBusiness();
  const remove = useDeleteScrapedBusiness();

  useEffect(() => {
    const t = setTimeout(() => { setOffset(0); setSearch(q.trim()); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useScrapedBusinesses({
    q: search || undefined, matched_only: matchedOnly || undefined, limit: PAGE_SIZE, offset,
  });
  const total = data?.total ?? 0;
  const businesses = data?.businesses ?? [];

  return (
    <div className="bo-stack">
      <Card>
        <div className="bo-toolbar">
          <div className="bo-search">
            <Icon.search size={15} className="bo-search-icon" aria-hidden="true" />
            <TextInput type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search businesses…" aria-label="Search businesses" style={{ paddingLeft: 36 }} />
          </div>
          <label className="bo-check">
            <input type="checkbox" checked={matchedOnly} onChange={(e) => { setOffset(0); setMatchedOnly(e.target.checked); }} />
            Brand-matched only
          </label>
          <div className="bo-toolbar-end">
            <Button size="sm" onClick={() => setCreating(true)}>
              <Icon.plus size={15} aria-hidden="true" /> Add business
            </Button>
          </div>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden", gap: 0 }}>
        {isLoading ? (
          <div aria-busy="true" aria-label="Loading businesses">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-shimmer bo-skeleton-row" />)}
          </div>
        ) : businesses.length === 0 ? (
          <div className="bo-empty">
            <span className="bo-empty-icon"><Icon.store size={24} aria-hidden="true" /></span>
            <strong>{search || matchedOnly ? "No businesses match" : "No businesses yet"}</strong>
            <span>Import from the chrome extension or add one manually.</span>
            <Button size="sm" onClick={() => setCreating(true)}><Icon.plus size={15} aria-hidden="true" /> Add business</Button>
          </div>
        ) : (
          <>
            <div className="bo-table-wrap">
              <table className="bo-table">
                <caption className="sr-only">Businesses with bank offers</caption>
                <thead>
                  <tr>
                    <th scope="col">Business</th>
                    <th scope="col">City</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">Banks</th>
                    <th scope="col" className="num">Offers</th>
                    <th scope="col">Brand match</th>
                    <th scope="col">Status</th>
                    <th scope="col">Last scraped</th>
                    <th scope="col" className="bo-cell-actions"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {businesses.map((b) => (
                    <tr key={b.id} className={b.is_active ? undefined : "is-inactive"}>
                      <td>
                        <div className="bo-name-cell">
                          {b.logo_url
                            ? <img src={b.logo_url} alt="" width={32} height={32} className="bo-logo" loading="lazy" />
                            : <span className="bo-logo" aria-hidden="true">{b.name.charAt(0).toUpperCase()}</span>}
                          <button type="button" className="bo-link-btn bo-truncate" onClick={() => setOpenId(b.id)}>{b.name}</button>
                          {b.rating != null && <span style={{ color: "var(--amber-600)", whiteSpace: "nowrap" }}>★ {b.rating}</span>}
                        </div>
                      </td>
                      <td className="bo-muted">{b.city ?? "—"}</td>
                      <td className="bo-muted">{b.category ?? "—"}</td>
                      <td className="num">{b.banks_count}</td>
                      <td className="num">{b.offers_count}</td>
                      <td>{b.brand_name ? <Badge tone="success">{b.brand_name}</Badge> : <Badge tone="neutral">unmatched</Badge>}</td>
                      <td>{b.is_active ? <Badge tone="success">active</Badge> : <Badge tone="neutral">inactive</Badge>}</td>
                      <td className="bo-muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(b.last_scraped_at)}</td>
                      <td className="bo-cell-actions">
                        <div className="bo-row-actions">
                          <IconButton icon={<Icon.eye size={15} />} label="View & edit" onClick={() => setOpenId(b.id)} />
                          <IconButton icon={<Icon.power size={15} />} label={b.is_active ? "Deactivate" : "Activate"}
                            onClick={() => update.mutate({ id: b.id, input: { is_active: !b.is_active } })} />
                          <IconButton icon={<Icon.trash size={15} />} label="Delete business" variant="danger"
                            onClick={() => {
                              if (window.confirm(`Delete ${b.name} and its ${b.offers_count} offers? This cannot be undone.`)) remove.mutate(b.id);
                            }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination offset={offset} pageSize={PAGE_SIZE} total={total} onChange={setOffset} />
          </>
        )}
      </Card>

      {creating && <BusinessFormModal onClose={() => setCreating(false)} onCreated={setOpenId} />}
      {openId != null && <BusinessDrawer businessId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
