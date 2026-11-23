import { useState } from "react";
import { NavLink, useLocation } from "react-router";

import { Icon } from "../icons";
import { Button } from "../ui/Button";

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
  { to: "/discover-brand", label: "Discover brands", icon: Icon.globe },
  { to: "/brand-requests", label: "Brand requests", icon: Icon.user },
];

const BRAND_ITEMS: NavItem[] = [
  { to: "/brands", label: "All brands", icon: Icon.store },
  { to: "/manage-categories", label: "Categories", icon: Icon.grid },
  { to: "/scraper-configs", label: "Scraper configs", icon: Icon.list },
];

const SCRAPER_BUILDER_ITEMS: NavItem[] = [
  { to: "/scraper-builder", label: "Visual scraper", icon: Icon.target },
  { to: "/website-scraper", label: "Website scraper", icon: Icon.external },
  { to: "/website-scraper-test", label: "Scraper test", icon: Icon.play },
  { to: "/social-scraper-test", label: "Social scraper", icon: Icon.instagram },
];

const AUTOMATION_ITEMS: NavItem[] = [
  { to: "/pipeline", label: "Scraping jobs", icon: Icon.pulse },
  { to: "/schedules", label: "Scheduled scraping", icon: Icon.calendar },
];

const OFFERS_ITEMS: NavItem[] = [
  { to: "/offers", label: "All offers", icon: Icon.offer },
  { to: "/bank-offers", label: "Bank offers", icon: Icon.card },
  { to: "/offer-discovery", label: "Offer discovery", icon: Icon.tag },
  { to: "/search", label: "Search", icon: Icon.search },
];

const EMAIL_ITEMS: NavItem[] = [
  { to: "/emails", label: "Email manager", icon: Icon.mail },
  { to: "/unknown-emails", label: "Unknown emails", icon: Icon.inbox },
  { to: "/insights", label: "AI insights", icon: Icon.sparkle },
  { to: "/notifications", label: "Notifications", icon: Icon.bell },
];

const SETTINGS_ITEMS: NavItem[] = [
  { to: "/settings", label: "Settings", icon: Icon.settings },
];

const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: OVERVIEW_ITEMS },
  { label: "Discovery", items: DISCOVERY_ITEMS },
  { label: "Brands", items: BRAND_ITEMS },
  { label: "Scraper builder", items: SCRAPER_BUILDER_ITEMS },
  { label: "Automation", items: AUTOMATION_ITEMS },
  { label: "Offers", items: OFFERS_ITEMS },
  { label: "Email", items: EMAIL_ITEMS },
  { label: "System", items: SETTINGS_ITEMS },
];

function NavGroup({ group, defaultOpen }: { group: NavGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const listId = `nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="nav-group">
      <button
        type="button"
        className="nav-group-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
      >
        {group.label}
        <Icon.chevron size={14} aria-hidden="true" className={`nav-group-chevron${open ? " is-open" : ""}`} />
      </button>

      {open && (
        <div id={listId} className="nav-group-items">
          {group.items.map(({ to, label, icon: ItemIcon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? " is-active" : ""}`}>
              <ItemIcon size={16} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ onRunFetch, fetching, open, onClose }: {
  onRunFetch: () => void;
  fetching: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const location = useLocation();

  // Auto-open the group that contains the current route
  function groupIsActive(group: NavGroup) {
    return group.items.some((item) => location.pathname.startsWith(item.to));
  }

  return (
    <aside id="app-sidebar" className={`shell-sidebar${open ? " is-open" : ""}`} aria-label="Main navigation">
      <div className="shell-brand">
        <span className="shell-brand-mark" aria-hidden="true">
          <Icon.tag size={16} />
        </span>
        <span className="shell-brand-name">DealsMore</span>
        <span className="shell-brand-sub">Admin</span>
        <button type="button" className="shell-sidebar-close" onClick={onClose} aria-label="Close navigation">
          <Icon.x size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="shell-nav">
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.label} group={group} defaultOpen={groupIsActive(group)} />
        ))}
      </nav>

      <div className="shell-fetch">
        <div className="shell-fetch-status">
          <span className={`status-dot${fetching ? " is-live" : ""}`} aria-hidden="true" />
          {fetching ? "Fetching new emails" : "Inbox idle"}
        </div>
        <Button variant="secondary" size="sm" fullWidth onClick={onRunFetch} loading={fetching}>
          <Icon.mail size={16} aria-hidden="true" />
          Fetch new emails
        </Button>
      </div>
    </aside>
  );
}
