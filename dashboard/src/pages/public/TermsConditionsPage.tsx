import { Link } from "react-router";

import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";

const SECTIONS = [
  {
    title: "1. Agreement to These Terms",
    paragraphs: [
      "These Terms & Conditions (\"Terms\") govern your access to and use of DealPulse — the website at this domain and the DealPulse mobile app for Android (together, the \"Service\"). By creating an account, using the Service as a guest, or otherwise browsing deals here, you agree to be bound by these Terms. If you don't agree, please don't use the Service.",
      "We may update these Terms from time to time as the Service changes — see “Changes to These Terms” below. Continuing to use DealPulse after an update means you accept the revised Terms.",
    ],
  },
  {
    title: "2. What DealPulse Is (and Isn't)",
    paragraphs: [
      "DealPulse is a deal-discovery service. We monitor promotional emails sent by participating brands, use AI to extract structured details from them (discount percentage, coupon code, expiry date, category, and similar), and present those as browsable \"offers\" in our app and on this site — organized by brand, category, and search.",
      "DealPulse is not a retailer, is not a party to any purchase you make, and does not process payments. When you act on a deal, you're taken to the brand's own website or store to complete that purchase directly with them, under their own terms and policies.",
      "Because offers are extracted automatically from marketing emails (with an AI-assisted verification pass to catch obviously invalid ones), we can't guarantee that every listed offer is accurate, still valid, or still honored by the brand at the time you try to use it. Always confirm the price, code, and expiry directly with the brand before purchasing. See “Deals, Pricing & Third-Party Merchants” below for more on this.",
    ],
  },
  {
    title: "3. Accounts & Guest Mode",
    paragraphs: [
      "You can browse most deals on DealPulse without an account, as a guest — in that mode, your followed brands and favorite categories are stored only on your own device.",
      "Creating an account (with an email and password, or by signing in with Google) lets you sync your preferences and receive personalized deal notifications. You're responsible for keeping your login credentials confidential and for all activity under your account. Tell us right away at the contact below if you believe your account has been accessed without your permission.",
      "You may permanently delete your account and its associated data at any time — from the mobile app (Profile → Delete Account) or from your Account page on this site. See our Privacy Policy for exactly what that removes.",
    ],
  },
  {
    title: "4. Acceptable Use",
    paragraphs: [
      "When using DealPulse, you agree not to: scrape, crawl, or bulk-extract data from the Service other than through features we provide; attempt to reverse-engineer, decompile, or bypass any security or rate-limiting measure; interfere with or overload our infrastructure; use an account that isn't yours; or use the Service for any unlawful purpose, including submitting a false brand request or coupon report intended to mislead other users.",
      "We reserve the right to suspend or terminate access for anyone who violates this section, without prior notice where the violation is serious (e.g., abuse of our systems or fraud).",
    ],
  },
  {
    title: "5. Deals, Pricing & Third-Party Merchants",
    paragraphs: [
      "Offer details displayed on DealPulse (discount percentage, coupon codes, expiry dates, and offer descriptions) are sourced from brands' own promotional emails and are provided \"as is,\" for informational convenience. Brands may change or end a promotion at any time without notifying us, and our extraction process — however carefully verified — can occasionally misread a date, code, or percentage from the source email.",
      "DealPulse does not guarantee that any listed deal is currently active, that a coupon code will be accepted at checkout, or that a brand will honor pricing shown here. We are not responsible for losses arising from reliance on an inaccurate or expired offer; your recourse for a purchase problem is with the merchant, not DealPulse.",
      "Expired offers are automatically removed from our systems shortly after they lapse — typically 7 days after their listed expiry date, or 30 days after we first found them if no expiry date was given — so what you see reflects our best current information at the time you view it.",
    ],
  },
  {
    title: "6. Notifications & Communications",
    paragraphs: [
      "If you enable notifications, we'll send you push alerts (via Firebase Cloud Messaging) about deals from brands you follow, or account-related messages. You can disable push notifications at any time from your device's notification settings or within the app.",
    ],
  },
  {
    title: "7. Intellectual Property",
    paragraphs: [
      "The DealPulse name, logo, app, and website — excluding the brand names, logos, and offer content that belong to their respective brand owners — are the property of DealPulse. You may not copy, modify, or redistribute our app or site, or use our name or branding to imply an affiliation or endorsement that doesn't exist.",
      "Brand names, logos, and marks shown on DealPulse belong to their respective owners and are used to identify and describe their offers, not to claim any affiliation with or endorsement by those brands.",
    ],
  },
  {
    title: "8. Third-Party Services We Rely On",
    paragraphs: [
      "The Service depends on a small number of third-party providers to function: Firebase Authentication and Google Sign-In (for account sign-in), Firebase Cloud Messaging (for push notifications), and Microsoft Clarity (for anonymized usage analytics on the mobile app). Your use of DealPulse means you also accept that these providers process a limited amount of data as described in our Privacy Policy and their own respective privacy policies.",
    ],
  },
  {
    title: "9. Disclaimer of Warranties",
    paragraphs: [
      "The Service is provided on an \"as is\" and \"as available\" basis, without warranties of any kind, whether express or implied — including, without limitation, warranties that the Service will be uninterrupted, error-free, or that deal information will be complete or accurate.",
    ],
  },
  {
    title: "10. Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, DealPulse and its operators will not be liable for any indirect, incidental, special, or consequential damages — including lost savings, lost data, or losses from a purchase made based on a deal shown on the Service — arising from your use of, or inability to use, DealPulse.",
    ],
  },
  {
    title: "11. Termination",
    paragraphs: [
      "You may stop using the Service, or delete your account, at any time. We may suspend or terminate your access if you violate these Terms, or discontinue the Service (or any part of it) at our discretion, with notice where reasonably practicable.",
    ],
  },
  {
    title: "12. Changes to These Terms",
    paragraphs: [
      "We'll update the \"Last updated\" date below whenever we make a meaningful change to these Terms, and where a change is significant we'll aim to flag it on this page or through an in-app notice.",
    ],
  },
  {
    title: "13. Governing Law",
    paragraphs: [
      "These Terms are governed by the laws of Pakistan, without regard to its conflict-of-law principles, unless a different law is required to apply by the jurisdiction you access the Service from.",
    ],
  },
  {
    title: "14. Contact Us",
    paragraphs: [
      "Questions about these Terms? Reach us any time via our Contact page — we read every message.",
    ],
  },
];

export function TermsConditionsPage() {
  useSeo({ title: "Terms & Conditions — DealPulse" });

  return (
    <PublicLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 8px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Terms &amp; Conditions</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Last updated: September 2026</div>
        <p style={{ margin: "0 0 28px", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>
          Please read these Terms carefully before using DealPulse. They explain what our Service does and doesn't do, what we
          expect from you as a user, and the limits of our responsibility for deals sourced from third-party brands.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2
                style={{
                  margin: "0 0 12px",
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                  font: "var(--fw-semibold) 16px/1.3 var(--font-sans)",
                  color: "var(--text-strong)",
                }}
              >
                {section.title}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {section.paragraphs.map((p, i) => (
                  <p key={i} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>
                    {p}
                  </p>
                ))}
                {section.title.startsWith("14.") && (
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>
                    <Link to="/contact" style={{ color: "var(--brand)", fontWeight: 700 }}>
                      Contact DealPulse →
                    </Link>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
