import { useState } from "react";
import { NavLink, useLocation } from "react-router";

import { Icon } from "../icons";

interface NavItem {
  to: string;
  label: string;
  icon: (typeof Icon)[keyof typeof Icon];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Navigation groups ────────────────────────────────────────────────────────

const OVERVIEW_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Icon.house },
  { to: "/analytics", label: "Analytics", icon: Icon.trendUp },
];

const DISCOVERY_ITEMS: NavItem[] = [
  { to: "/discover-brand", label: "Discover Brands", icon: Icon.globe },
  { to: "/brand-requests", label: "Brand Requests", icon: Icon.store },
];

const BRAND_ITEMS: NavItem[] = [
  { to: "/brands", label: "All Brands", icon: Icon.home },
  { to: "/manage-categories", label: "Categories", icon: Icon.grid },
  { to: "/scraper-configs", label: "Scraper Configs", icon: Icon.target },
];

const SCRAPER_BUILDER_ITEMS: NavItem[] = [
  { to: "/scraper-builder", label: "Visual Scraper", icon: Icon.sparkle },
  { to: "/website-scraper", label: "Website Scraper", icon: Icon.activity },
  { to: "/website-scraper-test", label: "Scraper Test", icon: Icon.search },
  { to: "/social-scraper-test", label: "Social Scraper", icon: Icon.instagram },
];

const AUTOMATION_ITEMS: NavItem[] = [
  { to: "/pipeline", label: "Scraping Jobs", icon: Icon.pulse },
  { to: "/schedules", label: "Scheduled Scraping", icon: Icon.bell },
];

const OFFERS_ITEMS: NavItem[] = [
  { to: "/offers", label: "All Offers", icon: Icon.offer },
  { to: "/offer-discovery", label: "Offer Discovery", icon: Icon.sparkle },
  { to: "/search", label: "Search", icon: Icon.search },
];

const EMAIL_ITEMS: NavItem[] = [
  { to: "/emails", label: "Email Manager", icon: Icon.mail },
  { to: "/unknown-emails", label: "Unknown Emails", icon: Icon.inbox },
  { to: "/insights", label: "AI Insights", icon: Icon.sparkle },
  { to: "/notifications", label: "Notifications", icon: Icon.bell },
];

const SETTINGS_ITEMS: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Icon.target },
];

const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: OVERVIEW_ITEMS },
  { label: "Discovery", items: DISCOVERY_ITEMS },
  { label: "Brand Management", items: BRAND_ITEMS },
  { label: "Scraper Builder", items: SCRAPER_BUILDER_ITEMS },
  { label: "Automation", items: AUTOMATION_ITEMS },
  { label: "Offers", items: OFFERS_ITEMS },
  { label: "Email Manager", items: EMAIL_ITEMS },
  { label: "Settings", items: SETTINGS_ITEMS },
];

// ── Styles ───────────────────────────────────────────────────────────────────

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

// ── Components ───────────────────────────────────────────────────────────────

function NavGroup({ group, defaultOpen }: { group: NavGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Section header — clickable to collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          border: 0,
          background: "transparent",
          cursor: "pointer",
          padding: "10px 10px 4px",
          color: "var(--text-faint)",
          font: `700 10.5px/1 var(--font-sans)`,
          letterSpacing: "var(--ls-wide)",
          textTransform: "uppercase",
        }}
      >
        {group.label}
        <span style={{ fontSize: 9, opacity: 0.6, transition: "transform 0.15s", transform: open ? "rotate(0)" : "rotate(-90deg)", display: "inline-block" }}>▼</span>
      </button>

      {open &&
        group.items.map(({ to, label, icon: ItemIcon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => navStyle(isActive)}>
            <ItemIcon size={17} />
            {label}
          </NavLink>
        ))}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ onRunFetch, fetching }: { onRunFetch: () => void; fetching: boolean }) {
  const location = useLocation();

  // Auto-open the group that contains the current route
  function groupIsActive(group: NavGroup) {
    return group.items.some((item) => location.pathname.startsWith(item.to));
  }

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
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 8px 16px" }}>
        <Icon.pulse size={22} strokeWidth={2.5} style={{ color: "var(--brand)" }} />
        <span style={{ font: "800 18px/1 var(--font-sans)", letterSpacing: "var(--ls-snug)", color: "var(--text-strong)" }}>
          Deal<span style={{ color: "var(--brand)" }}>Pulse</span>
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.label} group={group} defaultOpen={groupIsActive(group)} />
        ))}
      </nav>

      {/* Run Fetch CTA */}
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
