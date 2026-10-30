import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Moon, Search, ShoppingBag, Sun, UserRound } from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Deals", href: "/deals" },
  { label: "Categories", href: "/categories" },
  { label: "Favorites", href: "/favorites" },
];

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useUiStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/deals/search?q=${encodeURIComponent(trimmed)}` : "/deals/search");
  }

  return (
    <header
      className="public-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--surface-app)",
        borderBottom: "1px solid var(--border)",
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
        transition: "box-shadow 0.2s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            color: "var(--text-strong)",
            flex: "0 0 auto",
          }}
        >
          <span
            style={{
              width: 27,
              height: 29,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              background: "var(--brand)",
              borderRadius: "6px 6px 4px 4px",
              transform: "rotate(8deg)",
            }}
          >
            <ShoppingBag size={21} strokeWidth={2.5} />
          </span>
          <span style={{ font: "var(--fw-extra) 18px/1 var(--font-sans)", letterSpacing: "var(--ls-snug)" }}>
            Deals<span style={{ color: "var(--brand)" }}>More</span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 auto" }} className="public-nav-links">
          {NAV_LINKS.map((link) => {
            const active = link.href === "/" ? location.pathname === "/" : location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: active ? "var(--brand)" : "var(--text-body)",
                  whiteSpace: "nowrap",
                  borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <form onSubmit={handleSubmit} style={{ flex: "0 1 320px", position: "relative" }} className="public-header-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands, offers, categories…"
            aria-label="Search offers"
            style={{
              width: "100%",
              height: 38,
              padding: "0 14px 0 36px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-card)",
              color: "var(--text-strong)",
              fontSize: 13,
            }}
          />
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>
            <Search size={15} />
          </span>
        </form>

        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle theme"
          style={{
            flex: "0 0 auto",
            height: 38,
            padding: "0 14px",
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-card)",
            color: "var(--text-body)",
            font: "600 12.5px/1 var(--font-sans)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {theme === "dark" ? <Sun size={15} aria-label="Dark theme" /> : <Moon size={15} aria-label="Light theme" />}
        </button>

        {user ? (
          <Link
            to="/account"
            title={`Signed in as ${user.email}`}
            style={{
              flex: "0 0 auto",
              width: 36,
              height: 36,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--border)",
              borderRadius: "50%",
              background: "var(--surface-inverse)",
              color: "var(--text-on-inverse)",
              font: "700 12px/1 var(--font-sans)",
              whiteSpace: "nowrap",
            }}
          >
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </Link>
        ) : (
          <Link
            to="/sign-in"
            aria-label="Sign in"
            style={{
              flex: "0 0 auto",
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid transparent",
              borderRadius: "50%",
              background: "var(--surface-inverse)",
              color: "var(--on-brand)",
              font: "600 12.5px/1 var(--font-sans)",
              whiteSpace: "nowrap",
            }}
          >
            <UserRound size={15} />
          </Link>
        )}
      </div>
    </header>
  );
}
