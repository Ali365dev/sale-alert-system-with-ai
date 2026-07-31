import { Link } from "react-router";

import { Icon } from "../icons";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Contact", href: "#contact" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "#privacy" },
      { label: "Terms of Service", href: "#terms" },
    ],
  },
  {
    title: "Explore",
    links: [
      { label: "All Offers", href: "/#offers" },
      { label: "Brands", href: "/#brands" },
      { label: "Categories", href: "/#categories" },
    ],
  },
];

const SOCIALS = [
  { label: "X", href: "#" },
  { label: "Facebook", href: "#" },
  { label: "Instagram", href: "#" },
];

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
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "var(--brand)",
                color: "var(--on-brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.gift size={16} />
            </span>
            <span style={{ font: "var(--fw-bold) 15.5px/1 var(--font-sans)", color: "var(--text-strong)" }}>DealHub</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 320 }}>
            The latest deals, discounts, and coupons — verified with AI and gathered from your favorite brands.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{ display: "flex", gap: 8, marginTop: 6, maxWidth: 320 }}
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              aria-label="Email for newsletter"
              style={{
                flex: "1 1 auto",
                height: 38,
                padding: "0 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-app)",
                color: "var(--text-strong)",
                fontSize: 13,
              }}
            />
            <button
              type="submit"
              style={{
                height: 38,
                padding: "0 16px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "var(--brand)",
                color: "var(--on-brand)",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Subscribe
            </button>
          </form>
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
                <a key={link.label} href={link.href} style={{ fontSize: 13, color: "var(--text-body)" }}>
                  {link.label}
                </a>
              ),
            )}
          </div>
        ))}
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
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>© {new Date().getFullYear()} DealHub. All rights reserved.</span>
        <div style={{ display: "flex", gap: 14 }}>
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
