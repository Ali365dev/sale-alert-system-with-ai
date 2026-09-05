import { Link } from "react-router";

import { Icon } from "../icons";
import { toast } from "../../store/toastStore";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Explore",
    links: [
      { label: "Home", href: "/" },
      { label: "Deals", href: "/deals" },
      { label: "Categories", href: "/categories" },
      { label: "Brands", href: "/deals/brands" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help & Support", href: "/help" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

const SOCIALS = [
  { label: "Facebook", icon: <Icon.facebook size={15} /> },
  { label: "Instagram", icon: <Icon.instagram size={15} /> },
  { label: "X", icon: <Icon.twitter size={15} /> },
  { label: "YouTube", icon: <Icon.youtube size={15} /> },
];

const linkButtonStyle: React.CSSProperties = {
  display: "block",
  border: "none",
  background: "none",
  padding: 0,
  textAlign: "left",
  fontSize: 13,
  color: "var(--text-body)",
  cursor: "pointer",
};

function comingSoon(what: string) {
  toast.info(`${what} isn't available yet — check back soon.`);
}

function AppStoreBadge({ store, sub }: { store: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={() => comingSoon(`The ${store === "Apple" ? "iOS" : "Android"} app`)}
      title={`${store} — coming soon`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 12px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-inverse)",
        color: "var(--text-on-inverse)",
        cursor: "pointer",
      }}
    >
      {store === "Apple" ? <Icon.store size={16} /> : <Icon.play size={16} />}
      <span style={{ lineHeight: 1.1, textAlign: "left" }}>
        <div style={{ fontSize: 8.5, opacity: 0.75 }}>{sub}</div>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{store === "Apple" ? "App Store" : "Google Play"}</div>
      </span>
    </button>
  );
}

export function PublicFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface-card)", marginTop: 48 }}>
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "40px 24px 28px",
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(3, 1fr)",
          gap: 32,
        }}
        className="public-footer-grid"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}>
              <Icon.pulse size={20} strokeWidth={2.5} />
            </span>
            <span style={{ font: "var(--fw-extra) 15.5px/1 var(--font-sans)", color: "var(--text-strong)" }}>
              Deal<span style={{ color: "var(--brand)" }}>Pulse</span>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Deals Today. A Better Tomorrow.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {SOCIALS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => comingSoon(`Our ${s.label} page`)}
                aria-label={s.label}
                style={{
                  width: 30,
                  height: 30,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  background: "none",
                  color: "var(--text-body)",
                  cursor: "pointer",
                }}
              >
                {s.icon}
              </button>
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "var(--ls-wide)",
                textTransform: "uppercase",
                color: "var(--text-faint)",
              }}
            >
              {col.title}
            </div>
            {col.links.map((link) =>
              link.href.startsWith("/") ? (
                <Link key={link.label} to={link.href} style={{ fontSize: 13, color: "var(--text-body)" }}>
                  {link.label}
                </Link>
              ) : (
                <button key={link.label} type="button" onClick={() => comingSoon(link.label)} style={linkButtonStyle}>
                  {link.label}
                </button>
              ),
            )}
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "var(--ls-wide)",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            Download Our App
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AppStoreBadge store="Apple" sub="Download on the" />
            <AppStoreBadge store="Google" sub="GET IT ON" />
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          maxWidth: 1240,
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>© {new Date().getFullYear()} DealPulse. All rights reserved.</span>
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Made with ❤️ for smart shoppers.</span>
      </div>
    </footer>
  );
}
