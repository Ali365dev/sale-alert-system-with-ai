import { useState } from "react";
import { Link } from "react-router";

import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";

const FAQS = [
  {
    question: "How do I follow a brand or category?",
    answer:
      "Visit a brand's page and tap Follow, or browse Categories from the nav bar. Your homepage's \"For You\" section fills in automatically based on what you follow, and you can save individual offers with the heart icon to find them again on Favorites.",
  },
  {
    question: "How do I get notified about new deals?",
    answer:
      "Sign in and follow brands, then check back on Favorites and the homepage's \"For You\" section for picks matched to you. Email and push alerts for the website aren't available yet — the DealPulse mobile app supports push notifications if you'd like those.",
  },
  {
    question: "Are the discounts and coupon codes verified?",
    answer:
      "Offers go through an automated verification pass, shown as a status on each deal. Always confirm the final price and code at checkout, since brands can end promotions at any time.",
  },
  {
    question: "Do I need an account to use DealPulse?",
    answer:
      "No — you can browse and save favorites as a guest; they're stored in this browser. Sign in to also follow brands and manage your account.",
  },
];

function FaqItem({ question, answer, expanded, onToggle }: { question: string; answer: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 18px",
          border: "none",
          background: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ font: "var(--fw-semibold) 13.5px/1.4 var(--font-sans)", color: "var(--text-strong)" }}>{question}</span>
        <Icon.chevron size={16} style={{ color: "var(--text-faint)", flex: "0 0 auto", transform: expanded ? "rotate(-90deg)" : "rotate(90deg)" }} />
      </button>
      {expanded && (
        <p style={{ margin: 0, padding: "0 18px 16px", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>{answer}</p>
      )}
    </div>
  );
}

export function HelpSupportPage() {
  useSeo({ title: "Help & Support — DealPulse" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <PublicLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 22px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Help &amp; Support</h1>

        <div style={{ background: "var(--brand-subtle)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 32 }}>
          <div style={{ font: "var(--fw-bold) 17px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Need more help?</div>
          <p style={{ margin: "4px 0 14px", fontSize: 13, color: "var(--text-muted)" }}>Our team usually replies within a day.</p>
          <a
            href="mailto:support@dealpulse.app"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--surface-card)",
              borderRadius: "var(--radius-md)",
              padding: "14px 16px",
              color: "inherit",
            }}
          >
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-sunken)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", flex: "0 0 auto" }}>
              <Icon.mail size={17} />
            </span>
            <span style={{ flex: 1 }}>
              <div style={{ font: "var(--fw-semibold) 13.5px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Email Support</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>support@dealpulse.app</div>
            </span>
            <Icon.chevron size={16} style={{ color: "var(--text-faint)" }} />
          </a>
        </div>

        <h2 style={{ margin: "0 0 14px", font: "var(--fw-bold) 18px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Frequently Asked Questions</h2>
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} expanded={openIndex === i} onToggle={() => setOpenIndex((prev) => (prev === i ? null : i))} />
          ))}
        </div>

        <p style={{ marginTop: 28, fontSize: 13, color: "var(--text-muted)" }}>
          Didn't find what you needed?{" "}
          <Link to="/contact" style={{ color: "var(--brand)", fontWeight: 700 }}>
            Contact us
          </Link>
          .
        </p>
      </div>
    </PublicLayout>
  );
}
