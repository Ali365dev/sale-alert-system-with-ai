import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { isAxiosError } from "axios";

import { isJobActive, useActiveJob, useStartJob } from "../../api/jobs";
import { useSettingsSession } from "../../api/settings";
import { useJobLifecycleNotifications } from "../../lib/notifications";
import { SettingsLogin } from "../settings/SettingsLogin";
import { Icon } from "../icons";
import { Button } from "../ui/Button";
import { LoadingState } from "../ui/Spinner";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import "./AppShell.css";

/** Titles for dashboard routes — kept here so AppShell can be a single layout
 * route (mounts once) instead of remounting a full-page loader on every nav. */
const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/analytics": "Analytics",
  "/search": "Search",
  "/offers": "Offers",
  "/bank-offers": "",
  "/brands": "Brands",
  "/manage-categories": "Categories",
  "/discover-brand": "Discover brands",
  "/offer-discovery": "Offer discovery",
  "/social-scraper-test": "Social media scraper test",
  "/website-scraper": "",
  "/website-scraper-test": "Website scraper test",
  "/emails": "",
  "/unknown-emails": "Unknown emails",
  "/brand-requests": "Brand requests",
  "/insights": "AI insights",
  "/notifications": "Notifications",
  "/pipeline": "Scraping jobs",
  "/settings": "Settings",
};

/** Tab titles for pages that render their own in-page heading (empty ROUTE_TITLES). */
const DOCUMENT_TITLES: Record<string, string> = {
  "/emails": "Emails",
  "/bank-offers": "Bank offers",
  "/website-scraper": "Website scraper",
};

function titleForPath(pathname: string): string {
  if (pathname in ROUTE_TITLES) return ROUTE_TITLES[pathname];
  if (pathname.startsWith("/website-scraper/brands/")) return "";
  return "";
}

/** Admin login gate + chrome. Mount once via a React Router layout route —
 * wrapping each page in its own AppShell remounted the session check and
 * flashed LoadingState on every navigation. */
export function AppShell() {
  const { data: session, isPending, error, refetch, isFetching } = useSettingsSession();

  // Only block the first session resolve — never blank the shell on background refetch.
  if (isPending) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <LoadingState />
      </div>
    );
  }

  // No response at all means the server is down, not that the admin is logged out.
  if (isAxiosError(error) && !error.response) {
    return <ServerUnavailable onRetry={() => refetch()} retrying={isFetching} />;
  }

  if (!session?.authenticated) {
    return <SettingsLogin />;
  }

  return <AuthedShell />;
}

function ServerUnavailable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="shell-offline" role="alert">
      <Icon.alert size={20} aria-hidden="true" />
      <h1>Can't reach the DealsMore server</h1>
      <p>The admin API didn't respond. Check that the app and scraper servers are running, then try again.</p>
      <Button size="sm" onClick={onRetry} loading={retrying}>
        Retry
      </Button>
    </div>
  );
}

/** Split out so the job-polling hooks below only ever mount once an admin
 * session is confirmed — never fired while the login screen is showing. */
function AuthedShell() {
  const location = useLocation();
  const title = titleForPath(location.pathname);
  const startEmailSync = useStartJob("email_sync");
  const activeEmailSync = useActiveJob("email_sync");
  useJobLifecycleNotifications();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => setNavOpen(false), [location.pathname]);

  useEffect(() => {
    const name = title || DOCUMENT_TITLES[location.pathname] || (location.pathname.startsWith("/website-scraper/") ? "Website scraper" : "Admin");
    document.title = `${name} · DealsMore admin`;
  }, [title, location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <div className="shell">
      <a href="#main-content" className="shell-skip-link">Skip to content</a>
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onRunFetch={() => startEmailSync.mutate(undefined)}
        fetching={startEmailSync.isPending || isJobActive(activeEmailSync.data?.status)}
      />
      {navOpen && <div className="shell-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <main className="shell-main">
        <Header navOpen={navOpen} onMenu={() => setNavOpen(true)} />
        <div id="main-content" tabIndex={-1} className="shell-content">
          {/* Pages that render their own in-page header (e.g. Email Manager)
             pass an empty title to skip this generic one and avoid a duplicate. */}
          {title && (
            <h1 style={{ margin: 0, font: "var(--fw-semibold) clamp(1.25rem, 2vw, 1.5rem)/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{title}</h1>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
