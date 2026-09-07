import { NavLink } from "react-router";

import { Icon } from "../icons";

interface NavItem {
  to: string;
  label: string;
  icon: (typeof Icon)[keyof typeof Icon];
}

const MAIN_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Icon.house },
  { to: "/analytics", label: "Analytics", icon: Icon.trendUp },
  { to: "/search", label: "Search", icon: Icon.search },
  { to: "/offers", label: "Offers Manager", icon: Icon.offer },
  { to: "/brands", label: "Brands Manager", icon: Icon.home },
];

const EMAIL_ITEMS: NavItem[] = [
  { to: "/emails", label: "Email Manager", icon: Icon.mail },
  { to: "/unknown-emails", label: "Unknown Emails", icon: Icon.inbox },
  { to: "/brand-requests", label: "Brand Requests", icon: Icon.store },
  { to: "/notifications", label: "Notifications", icon: Icon.bell },
  { to: "/insights", label: "AI Insights", icon: Icon.sparkle },
];

const SETTINGS_ITEMS: NavItem[] = [
  { to: "/pipeline", label: "Pipeline Center", icon: Icon.activity },
  { to: "/settings", label: "Settings", icon: Icon.target },
];

function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    border: 0,
    cursor: "pointer",
    padding: "9px 10px",
    borderRadius: "var(--radius-sm)",
    font: "600 13px/1 var(--font-sans)",
    background: active ? "var(--brand-subtle)" : "transparent",
    color: active ? "var(--brand)" : "var(--text-body)",
    textDecoration: "none",
  };
}

function NavSection({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "var(--ls-wide)",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          padding: "10px 10px 4px",
        }}
      >
        {label}
      </div>
      {items.map(({ to, label: itemLabel, icon: ItemIcon }) => (
        <NavLink key={to} to={to} style={({ isActive }) => navStyle(isActive)}>
          <ItemIcon size={17} />
          {itemLabel}
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar({ onRunFetch, fetching }: { onRunFetch: () => void; fetching: boolean }) {
  return (
    <aside
      style={{
        width: 252,
        flex: "0 0 252px",
        borderRight: "1px solid var(--border)",
        background: "var(--surface-card)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "18px 14px",
        position: "sticky",
        top: 0,
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 8px 16px" }}>
        <Icon.pulse size={22} strokeWidth={2.5} style={{ color: "var(--brand)" }} />
        <span style={{ font: "800 18px/1 var(--font-sans)", letterSpacing: "var(--ls-snug)", color: "var(--text-strong)" }}>
          Deal<span style={{ color: "var(--brand)" }}>Pulse</span>
        </span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        <NavSection label="Main" items={MAIN_ITEMS} />
        <NavSection label="Email Manager" items={EMAIL_ITEMS} />
        <NavSection label="Settings" items={SETTINGS_ITEMS} />
      </nav>

      <button
        type="button"
        onClick={onRunFetch}
        disabled={fetching}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
          width: "100%",
          padding: 14,
          border: "1px solid var(--brand-subtle-2)",
          borderRadius: "var(--radius-lg)",
          background: "var(--brand-subtle)",
          textAlign: "left",
          cursor: fetching ? "not-allowed" : "pointer",
          opacity: fetching ? 0.75 : 1,
        }}
      >
        <Icon.sparkle size={18} style={{ color: "var(--brand)" }} />
        <div>
          <div style={{ font: "var(--fw-semibold) 13px/1.35 var(--font-sans)", color: "var(--text-strong)" }}>
            Let AI find the best offers for you
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
            Fetch new emails and never miss a deal.
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 12px",
            borderRadius: "var(--radius-sm)",
            background: "var(--brand)",
            color: "var(--on-brand)",
            font: "700 12.5px/1 var(--font-sans)",
          }}
        >
          {fetching ? "Fetching…" : "Run Fetch Now"}
          {!fetching && <Icon.arrowRight size={13} />}
        </span>
      </button>
    </aside>
  );
}
