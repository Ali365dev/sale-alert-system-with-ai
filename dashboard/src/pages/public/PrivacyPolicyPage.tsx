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
        <p style={{ margin: "0 0 28px", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-muted)" }}>
          At DealPulse, we take your privacy seriously. This policy outlines exactly what information we collect, how it's utilized to improve
          your deal-finding experience, and the steps we take to ensure your data remains secure within our ecosystem.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <PolicySection icon="inbox" title="Data Collection">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>We collect data necessary to provide and improve the DealPulse service.</p>
            <BulletRow icon="user" title="Account Information" body="Name, email address, and a securely hashed password if you sign up directly — or your name, email, and a Google account identifier if you sign in with Google." />
            <BulletRow icon="clock" title="Browsing Activity" body="Categories viewed, deals clicked, brands followed, and search queries within the app or site." />
            <BulletRow icon="bell" title="Device & Notification Data" body="A device identifier for guest preferences, and a push-notification token (mobile app only) so we can deliver deal alerts." />
            <BulletRow icon="activity" title="Usage Analytics" body="Anonymized interaction data (screens viewed, taps, session recordings) collected via Microsoft Clarity to help us fix bugs and improve the app — see Third-Party Sharing below." />
          </PolicySection>

          <PolicySection icon="filter" title="How We Use Your Data">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Your data fuels the engine that finds the best deals tailored specifically for you.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <UsageTile title="Personalization" body="To curate deals based on your followed brands and categories." />
              <UsageTile title="Service Improvement" body="Analyzing aggregated usage patterns to refine our search algorithms." />
              <UsageTile title="Communication" body="Sending critical alerts regarding saved deals or account security." />
            </div>
          </PolicySection>

          <PolicySection icon="grid" title="Third-Party Sharing">
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              We strictly limit third-party sharing. We <strong style={{ color: "var(--text-strong)" }}>do not</strong> sell your personal data
              to advertisers. We use the following third-party services, each of which processes data only for the purpose described:
            </p>
            <BulletRow icon="shield" title="Firebase Authentication & Google Sign-In (Google LLC)" body="Verifies your identity when you sign in with a Google account. Google receives your basic profile info (name, email) as part of that sign-in." />
            <BulletRow icon="bell" title="Firebase Cloud Messaging (Google LLC)" body="Delivers push notifications to the mobile app using a device token — no message content is shared with Google beyond what's needed to route the notification." />
            <BulletRow icon="eye" title="Microsoft Clarity (Microsoft Corporation)" body="Records anonymized session activity (taps, scrolls, screen views) so we can diagnose bugs and improve the app. Clarity applies its own default input masking to reduce capture of sensitive on-screen text." />
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              Information may also be shared with essential infrastructure providers (e.g., cloud hosting, database) who are contractually bound to
              safeguard your data under similarly strict privacy standards.
            </p>
          </PolicySection>

          <PolicySection icon="trash" title="Your Rights & Account Deletion">
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
              For any other request, contact{" "}
              <Link to="/contact" style={{ color: "var(--brand)", fontWeight: 700 }}>
                support@dealpulse.app
              </Link>
              .
            </p>
          </PolicySection>
        </div>
      </div>
    </PublicLayout>
  );
}
