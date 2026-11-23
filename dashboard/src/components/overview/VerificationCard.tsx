import type { VerificationCount } from "../../api/overview";
import { Card, CardHeader } from "../ui/Card";
import "./Overview.css";

const STATUS_ORDER = ["verified", "unverified", "suspicious", "invalid"];

const STATUS_COLOR: Record<string, string> = {
  verified: "var(--success)",
  unverified: "var(--text-faint)",
  suspicious: "var(--warning)",
  invalid: "var(--danger)",
};

const STATUS_LABEL: Record<string, string> = {
  verified: "Verified",
  unverified: "Not checked yet",
  suspicious: "Suspicious",
  invalid: "Invalid",
};

function rank(status: string) {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? STATUS_ORDER.length : i;
}

/** The one chart on the Overview: where the catalogue stands on verification,
 * as a single share bar the admin can read in a glance. */
export function VerificationCard({ statuses, total }: { statuses: VerificationCount[]; total: number }) {
  const sum = statuses.reduce((acc, s) => acc + s.count, 0) || 1;
  const sorted = [...statuses].sort((a, b) => rank(a.status) - rank(b.status));
  const verified = statuses.find((s) => s.status === "verified")?.count ?? 0;

  return (
    <Card>
      <CardHeader
        title="Verification"
        aside={<span className="overview-meta">{total.toLocaleString()} offers</span>}
      />
      <div className="verification-headline">
        <span className="verification-figure">{((verified / sum) * 100).toFixed(1)}%</span>
        <span className="verification-caption">of offers passed every check</span>
      </div>
      <div
        className="verification-bar"
        role="img"
        aria-label={sorted.map((s) => `${STATUS_LABEL[s.status] ?? s.status} ${s.count}`).join(", ")}
      >
        {sorted.map((s) => (
          <span
            key={s.status}
            style={{ flexGrow: s.count, background: STATUS_COLOR[s.status] ?? "var(--text-faint)" }}
          />
        ))}
      </div>
      <ul className="verification-legend">
        {sorted.map((s) => (
          <li key={s.status}>
            <span className="legend-dot" style={{ background: STATUS_COLOR[s.status] ?? "var(--text-faint)" }} />
            <span className="legend-label">{STATUS_LABEL[s.status] ?? s.status}</span>
            <span className="legend-count">{s.count.toLocaleString()}</span>
            <span className="legend-share">{((s.count / sum) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
