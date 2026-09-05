import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { errorMessage, useDeleteAccount, useLogout } from "../../api/auth";
import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";

export function AccountPage() {
  useSeo({ title: "Your Account — DealPulse" });
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const deleteAccount = useDeleteAccount();
  const logout = useLogout();
  const [confirming, setConfirming] = useState(false);

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  async function handleDelete() {
    try {
      await deleteAccount.mutateAsync();
      toast.success("Your account has been deleted.");
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete your account. Please try again."));
    }
  }

  return (
    <PublicLayout>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 22px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Your Account</h1>

        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>
            Signed in as
          </div>
          <div style={{ font: "var(--fw-semibold) 15px/1.4 var(--font-sans)", color: "var(--text-strong)" }}>{user.name || user.email}</div>
          {user.name && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</div>}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            style={{
              marginTop: 14,
              height: 38,
              padding: "0 16px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-app)",
              color: "var(--text-body)",
              fontWeight: 600,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>

        <div style={{ background: "var(--danger-subtle)", borderRadius: "var(--radius-lg)", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Icon.alert size={17} style={{ color: "var(--danger)" }} />
            <div style={{ font: "var(--fw-bold) 15px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Delete account</div>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>
            This permanently deletes your account and saved preferences (followed brands, favorite categories). This can't be undone. Favorites
            saved in this browser as a guest aren't affected.
          </p>

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                height: 42,
                padding: "0 20px",
                border: "1px solid var(--danger)",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--danger)",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Delete my account
            </button>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteAccount.isPending}
                style={{
                  height: 42,
                  padding: "0 20px",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--danger)",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: deleteAccount.isPending ? "not-allowed" : "pointer",
                  opacity: deleteAccount.isPending ? 0.6 : 1,
                }}
              >
                {deleteAccount.isPending ? "Deleting…" : "Yes, delete permanently"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleteAccount.isPending}
                style={{
                  height: 42,
                  padding: "0 20px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-card)",
                  color: "var(--text-body)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
