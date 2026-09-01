import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { useLogout } from "../../api/auth";
import { Icon } from "../icons";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";

const NAV_LINKS = [
  { label: "All Offers", href: "/#offers" },
  { label: "Brands", href: "/#brands" },
  { label: "Categories", href: "/#categories" },
  { label: "Expiring Soon", href: "/#expiring" },
];

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const navigate = useNavigate();
  const { theme, toggleTheme } = useUiStore();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  }

  return (
    <header
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
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "var(--brand)",
              color: "var(--on-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon.gift size={18} />
          </span>
          <span style={{ font: "var(--fw-bold) 17px/1 var(--font-sans)", letterSpacing: "var(--ls-snug)" }}>DealHub</span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 4, flex: "1 1 auto" }} className="public-nav-links">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text-body)",
                whiteSpace: "nowrap",
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <form onSubmit={handleSubmit} style={{ flex: "0 1 320px", position: "relative" }} className="public-header-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search offers, brands, coupons…"
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
            <Icon.search size={15} />
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
          {theme === "dark" ? "Dark" : "Light"}
        </button>

        {user ? (
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            title={`Signed in as ${user.email}`}
            style={{
              flex: "0 0 auto",
              height: 38,
              padding: "0 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-card)",
              color: "var(--text-body)",
              font: "600 12.5px/1 var(--font-sans)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {user.name || user.email.split("@")[0]}
          </button>
        ) : (
          <Link
            to="/sign-in"
            style={{
              flex: "0 0 auto",
              height: 38,
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid transparent",
              borderRadius: "var(--radius-pill)",
              background: "var(--brand)",
              color: "var(--on-brand)",
              font: "600 12.5px/1 var(--font-sans)",
              whiteSpace: "nowrap",
            }}
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
