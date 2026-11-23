import type { LatestOffer } from "../../api/overview";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import "./Overview.css";

const VERIFICATION_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  verified: "success",
  suspicious: "warning",
  invalid: "danger",
  unverified: "neutral",
};

const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Verified",
  suspicious: "Suspicious",
  invalid: "Invalid",
  unverified: "Not checked",
};

function formatDate(iso: string | null) {
  if (!iso) return "No expiry";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function humanize(value: string | null) {
  if (!value) return "—";
  const text = value.replace(/[_-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function LatestOffersTable({ offers, total }: { offers: LatestOffer[]; total: number }) {
  return (
    <Card padded={false} style={{ overflow: "hidden", gap: 0 }}>
      <div className="latest-head">
        <h2>Latest offers</h2>
        <span className="overview-meta">
          {offers.length} of {total.toLocaleString()}
        </span>
      </div>
      <div className="latest-scroll">
        <table className="latest-table">
          <thead>
            <tr>
              <th scope="col">Brand</th>
              <th scope="col">Category</th>
              <th scope="col">Type</th>
              <th scope="col" className="num">Discount</th>
              <th scope="col">Code</th>
              <th scope="col">Expires</th>
              <th scope="col">Status</th>
              <th scope="col">Summary</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id}>
                <td className="strong">{offer.brand ?? "—"}</td>
                <td>{offer.category ?? "—"}</td>
                <td className="muted">{humanize(offer.offer_type)}</td>
                <td className="num">{offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}</td>
                <td className={offer.coupon_code ? "mono" : "muted"}>{offer.coupon_code ?? "No code"}</td>
                <td className="mono">{formatDate(offer.expiry_date)}</td>
                <td>
                  <Badge tone={VERIFICATION_TONE[offer.verification_status] ?? "neutral"}>
                    {VERIFICATION_LABEL[offer.verification_status] ?? humanize(offer.verification_status)}
                  </Badge>
                </td>
                <td className="summary" title={offer.summary ?? undefined}>
                  {offer.summary ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
