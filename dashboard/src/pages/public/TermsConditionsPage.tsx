import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";

const SECTIONS = [
  {
    title: "1. User Agreement",
    paragraphs: [
      "By accessing or using the DealPulse platform, you agree to be bound by these Terms and Conditions. If you disagree with any part of the terms, you may not access the service. DealPulse provides a curated platform for high-intent shoppers to discover and engage with exclusive deals.",
      "You must be at least 18 years of age to use this service. By using DealPulse, you represent and warrant that you meet this age requirement.",
    ],
  },
  {
    title: "2. Intellectual Property",
    paragraphs: [
      "The service and its original content, features, and functionality are and will remain the exclusive property of DealPulse and its licensors. The service is protected by copyright, trademark, and other laws of both the United States and foreign countries.",
      "Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of DealPulse.",
    ],
  },
  {
    title: "3. Limitation of Liability",
    paragraphs: [
      "In no event shall DealPulse, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.",
    ],
  },
  {
    title: "4. Governing Law",
    paragraphs: [
      "These Terms shall be governed and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.",
      "Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.",
    ],
  },
];

export function TermsConditionsPage() {
  useSeo({ title: "Terms & Conditions — DealPulse" });

  return (
    <PublicLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 8px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Terms &amp; Conditions</h1>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>Last updated: October 24, 2023</div>

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
              </div>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
