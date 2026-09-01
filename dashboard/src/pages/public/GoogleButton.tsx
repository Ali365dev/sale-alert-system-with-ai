import { useState } from "react";

import { isGoogleSignInConfigured } from "../../config/firebase";
import { errorMessage, useGoogleLogin } from "../../api/auth";
import { signInWithGoogle } from "../../services/googleAuth";
import { toast } from "../../store/toastStore";

function GoogleG() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const googleLogin = useGoogleLogin();
  const [busy, setBusy] = useState(false);

  if (!isGoogleSignInConfigured) return null;

  async function handleClick() {
    setBusy(true);
    try {
      const idToken = await signInWithGoogle();
      await googleLogin.mutateAsync(idToken);
    } catch (error) {
      const message = error instanceof Error && /popup|cancel/i.test(error.message) ? null : errorMessage(error, "Google sign-in failed. Please try again.");
      if (message) toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 46,
        width: "100%",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-card)",
        color: "var(--text-strong)",
        font: "600 13.5px/1 var(--font-sans)",
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1,
      }}
    >
      <GoogleG />
      {busy ? "Signing in…" : label}
    </button>
  );
}
