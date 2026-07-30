import { NavLink } from "react-router";

import { Icon } from "../icons";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: Icon.house },
  { to: "/analytics", label: "Analytics", icon: Icon.trendUp },
  { to: "/search", label: "Search", icon: Icon.search },
  { to: "/offers", label: "Offers manager", icon: Icon.offer },
  { to: "/brands", label: "Brands manager", icon: Icon.home },
  { to: "/emails", label: "Email manager", icon: Icon.mail },
  { to: "/insights", label: "AI insights", icon: Icon.sparkle, badge: 18 },
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
    padding: "10px 10px",
    borderRadius: "var(--radius-sm)",
    font: "600 13.5px/1 var(--font-sans)",
    background: active ? "var(--brand-subtle)" : "transparent",
    color: active ? "var(--brand)" : "var(--text-body)",
    textDecoration: "none",
  };
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
        gap: 20,
        padding: "20px 16px",
        position: "sticky",
        top: 0,
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 4px" }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "linear-gradient(140deg, var(--brand), var(--brand-active))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-brand)",
            flex: "0 0 38px",
          }}
        >
          <Icon.offer size={20} stroke="#fff" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)", letterSpacing: "-0.01em" }}>
            Sales Offers AI
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            gmail · gemini
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={onRunFetch}
          disabled={fetching}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            height: 48,
            border: "none",
            borderRadius: "var(--radius-sm)",
            background: "var(--brand)",
            color: "var(--on-brand)",
            fontWeight: 600,
            fontSize: 13.5,
            cursor: fetching ? "not-allowed" : "pointer",
            opacity: fetching ? 0.7 : 1,
            boxShadow: "var(--shadow-brand)",
          }}
        >
          {fetching ? "Fetching…" : "Run fetch & analyse now"}
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "var(--ls-wide)",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            padding: "6px 8px 8px",
          }}
        >
          Workspace
        </div>

        {NAV_ITEMS.map(({ to, label, icon: ItemIcon, badge }) => (
          <NavLink key={to} to={to} end={to === "/"} style={({ isActive }) => navStyle(isActive)}>
            <ItemIcon size={17} />
            {label}
            {badge !== undefined && (
              <span
                style={{
                  marginLeft: "auto",
                  font: "700 10.5px/1 var(--font-mono)",
                  color: "var(--ai)",
                  background: "var(--ai-subtle)",
                  padding: "4px 7px",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                {badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
