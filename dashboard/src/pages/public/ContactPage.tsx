import { Link } from "react-router";

import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";

export function ContactPage() {
  useSeo({ title: "Contact Us — DealPulse" });

  return (
    <PublicLayout>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px 64px", textAlign: "center" }}>
        <span
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 18px",
            borderRadius: "50%",
            background: "var(--brand-subtle)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon.mail size={24} />
        </span>
        <h1 style={{ margin: "0 0 8px", font: "var(--fw-extra) 24px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Contact Us</h1>
        <p style={{ margin: "0 0 28px", fontSize: 13.5, color: "var(--text-muted)" }}>
          Questions, feedback, or found a broken deal? Our team usually replies within a day.
        </p>

        <a
          href="mailto:support@dealpulse.app"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 48,
            padding: "0 24px",
            borderRadius: "var(--radius-sm)",
            background: "var(--brand)",
            color: "var(--on-brand)",
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "var(--shadow-brand)",
          }}
        >
          <Icon.mail size={16} /> support@dealpulse.app
        </a>

        <p style={{ margin: "32px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          Have a question about a specific offer? Check its{" "}
          <Link to="/deals" style={{ color: "var(--brand)", fontWeight: 700 }}>
            deal page
          </Link>{" "}
          first, or see our{" "}
          <Link to="/help" style={{ color: "var(--brand)", fontWeight: 700 }}>
            Help &amp; Support
          </Link>{" "}
          page for common questions.
        </p>
      </div>
    </PublicLayout>
  );
}
