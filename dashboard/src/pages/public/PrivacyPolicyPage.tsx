import type { ReactNode } from "react";
import { Link } from "react-router";

import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";

function PolicySection({ icon, title, children }: { icon: keyof typeof Icon; title: string; children: ReactNode }) {
  const IconComp = Icon[icon];
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
        <IconComp size={17} style={{ color: "var(--brand)" }} />
        <h2 style={{ margin: 0, font: "var(--fw-semibold) 15px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function BulletRow({ icon, title, body }: { icon: keyof typeof Icon; title: string; body: string }) {
  const IconComp = Icon[icon];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <IconComp size={16} style={{ color: "var(--text-faint)", marginTop: 2, flex: "0 0 auto" }} />
      <div>
        <div style={{ font: "var(--fw-semibold) 13px/1.4 var(--font-sans)", color: "var(--text-strong)" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{body}</div>
      </div>
    </div>
  );
}

function UsageTile({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--radius-md)", padding: 14 }}>
      <div style={{ font: "var(--fw-semibold) 13px/1.4 var(--font-sans)", color: "var(--text-strong)" }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{body}</div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  useSeo({ title: "Privacy Policy — DealPulse" });

  return (
    <PublicLayout>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 8px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Privacy Policy</h1>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 16 }}>
          Last updated: September 2026
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>
          DealPulse ("we," "us," "our") operates the DealPulse website and the DealPulse mobile app for Android (together, the
          "Service") — a deal-discovery tool that surfaces promotional offers from participating brands. This Privacy Policy
          explains, in plain terms, exactly what information we collect when you use the Service, why we collect it, who else
          ever sees it, how long we keep it, and how you can review, export, or delete it.
        </p>
        <p style={{ margin: "0 0 28px", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>
          The short version: we collect the minimum needed to run the Service and personalize it to your followed brands and
          categories, we never sell your personal data, and you can delete your account and its data at any time from either
          the app or this site.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <PolicySection icon="inbox" title="1. Information We Collect">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              What we collect depends on how you use DealPulse — as a signed-in user or as a guest — and on which platform
              (web or mobile) you're using.
            </p>
            <BulletRow icon="user" title="Account Information" body="If you sign up directly: your name, email address, and a securely hashed password (we never store your password in plain text). If you sign in with Google: your name, email address, and a Google account identifier — we never see or store your Google password." />
            <BulletRow icon="clock" title="Browsing & Preference Data" body="Categories you view, deals you click, brands you follow or favorite, and search queries you enter within the app or site. This is what lets us show followed-brand deals first and remember your interests across sessions." />
            <BulletRow icon="bell" title="Device & Notification Data" body="For guests, a locally-generated device identifier so your followed brands/categories persist between visits without an account. For the mobile app, a push-notification token issued by Firebase Cloud Messaging so we can deliver deal alerts to your device." />
            <BulletRow icon="activity" title="Usage Analytics" body="On the mobile app, anonymized interaction data — screens viewed, taps, and session recordings — collected via Microsoft Clarity to help us diagnose bugs and improve the app. This is not tied to your name or email. See “Third-Party Processors” below." />
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              What we <strong style={{ color: "var(--text-strong)" }}>don't</strong> collect: we never ask for or store payment
              card details, since all purchases happen on the brand's own website, not through DealPulse.
            </p>
          </PolicySection>

          <PolicySection icon="filter" title="2. How We Use Your Data">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>We use the data above strictly to operate and improve the Service — never to sell to advertisers.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <UsageTile title="Personalization" body="To curate deals and sort search results based on the brands and categories you follow." />
              <UsageTile title="Account & Authentication" body="To create and secure your account, verify sign-in with Google, and let you sync preferences across the app and website." />
              <UsageTile title="Notifications" body="To send push alerts for deals from brands you follow, and important account-related messages." />
              <UsageTile title="Service Improvement" body="Analyzing aggregated, anonymized usage patterns (via Microsoft Clarity) to find bugs, fix confusing flows, and improve search relevance." />
              <UsageTile title="Trust & Safety" body="To detect abuse of the Service (e.g., automated scraping or fraudulent brand-request submissions) and enforce our Terms & Conditions." />
            </div>
          </PolicySection>

          <PolicySection icon="grid" title="3. Third-Party Processors">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              We keep the list of outside services that touch your data intentionally short. We <strong style={{ color: "var(--text-strong)" }}>do not</strong> sell your personal data
              to advertisers or data brokers. Each processor below handles data only for the specific purpose described:
            </p>
            <BulletRow icon="shield" title="Firebase Authentication & Google Sign-In (Google LLC)" body="Verifies your identity when you sign in with a Google account. Google receives your basic profile info (name, email) as part of that sign-in, governed by Google's own privacy policy." />
            <BulletRow icon="bell" title="Firebase Cloud Messaging (Google LLC)" body="Delivers push notifications to the mobile app using a device token — no message content beyond what's needed to route the notification is shared with Google." />
            <BulletRow icon="eye" title="Microsoft Clarity (Microsoft Corporation)" body="Records anonymized session activity (taps, scrolls, screen views) on the mobile app so we can diagnose bugs and improve usability. Clarity applies its own default input masking to reduce capture of sensitive on-screen text." />
            <BulletRow icon="store" title="Hosting & Database Providers" body="Our website, API, and database are hosted with third-party cloud infrastructure providers, who store and process data on our behalf under their own security and confidentiality commitments — they don't use your data for their own purposes." />
          </PolicySection>

          <PolicySection icon="shield" title="4. Data Security">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              All traffic between your device and DealPulse is encrypted in transit (HTTPS/TLS). Passwords are never stored in
              plain text — they're hashed using an industry-standard one-way hashing algorithm, so even we can't read them back.
              Access to production systems and the underlying database is restricted to what's needed to operate the Service.
              No method of transmission or storage is 100% secure, so while we work to protect your information, we can't
              guarantee absolute security.
            </p>
          </PolicySection>

          <PolicySection icon="clock" title="5. Data Retention">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              We keep account data for as long as your account exists, and delete it (see “Your Rights & Account Deletion”
              below) when you close your account. Deal/offer listings are not kept indefinitely either: an offer is
              automatically removed from our systems 7 days after its listed expiry date, or 30 days after we first found it if
              no expiry date was given — so the catalog you browse reflects genuinely current information rather than an
              ever-growing archive.
            </p>
          </PolicySection>

          <PolicySection icon="user" title="6. Children's Privacy">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              DealPulse is not directed at children, and we don't knowingly collect personal information from anyone under 16.
              If you believe a child has provided us with personal information, contact us using the details below and we'll
              delete it.
            </p>
          </PolicySection>

          <PolicySection icon="trash" title="7. Your Rights & Account Deletion">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              You can permanently delete your account and its saved preferences (followed brands, favorite categories) at any time:
            </p>
            <BulletRow
              icon="grid"
              title="On the web"
              body="Sign in, then visit your Account page to delete your account — no app install required."
            />
            <BulletRow icon="store" title="In the mobile app" body="Go to Profile → Delete Account." />
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Deleting your account removes it from our database immediately. Data held by third-party processors above (e.g., your Google
              sign-in record, or aggregated Clarity analytics) is governed by their own retention policies. If you used DealPulse only as a
              guest, your preferences are stored on your device and can be cleared by uninstalling the app or clearing this site's browser data.
              You may also request a copy of the personal data we hold about you, or ask us to correct it, by contacting us below.
            </p>
          </PolicySection>

          <PolicySection icon="filter" title="8. Changes to This Policy">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              If we make a meaningful change to this policy — such as adding a new third-party processor or changing what data
              we collect — we'll update the "Last updated" date above and, for significant changes, note it on this page.
            </p>
          </PolicySection>

          <PolicySection icon="mail" title="9. Contact Us">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              For any question about this policy, or to make a data request, contact us via our{" "}
              <Link to="/contact" style={{ color: "var(--brand)", fontWeight: 700 }}>
                Contact page
              </Link>
              .
            </p>
          </PolicySection>
        </div>
      </div>
    </PublicLayout>
  );
}
