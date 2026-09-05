import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage, useLogin } from "../../api/auth";
import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";
import { AuthDivider, AuthField, AuthIllustration } from "./AuthField";
import { GoogleButton } from "./GoogleButton";

export function SignInPage() {
  useSeo({ title: "Sign in — DealPulse" });
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      // "Remember me" off → don't persist the session past this tab: the
      // login just wrote it to localStorage (zustand's persist middleware),
      // so undo that write now — in-memory state (and this tab) stays
      // signed in, but a reload or new tab won't find a token to restore.
      if (!rememberMe) localStorage.removeItem("auth-storage");
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "Incorrect email or password."));
    }
  }

  return (
    <PublicLayout>
      <div style={{ display: "flex", justifyContent: "center", padding: "56px 24px" }}>
        <div
          style={{
            position: "relative",
            maxWidth: 440,
            width: "100%",
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "32px 36px 36px",
            overflow: "hidden",
          }}
        >
          <AuthIllustration variant="tag" />

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, marginBottom: 28 }}>
            <Icon.pulse size={20} strokeWidth={2.5} style={{ color: "var(--brand)" }} />
            <span style={{ font: "var(--fw-extra) 17px/1 var(--font-sans)" }}>
              Deal<span style={{ color: "var(--brand)" }}>Pulse</span>
            </span>
          </div>

          <h1 style={{ margin: 0, font: "var(--fw-extra) 26px/1.25 var(--font-sans)", color: "var(--text-strong)" }}>
            Welcome <span style={{ color: "var(--brand)" }}>Back!</span>
          </h1>
          <p style={{ margin: "8px 0 26px", fontSize: 13.5, color: "var(--text-muted)", maxWidth: 300 }}>
            Glad to see you again. Sign in to continue and discover the best deals.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>Email address</label>
              <AuthField
                icon={<Icon.mail size={17} />}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>Password</label>
              <AuthField
                icon={<Icon.lock size={17} />}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", display: "flex" }}
                  >
                    {showPassword ? <Icon.eyeOff size={16} /> : <Icon.eye size={16} />}
                  </button>
                }
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-body)", cursor: "pointer" }}>
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                Remember me
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Password reset isn't available yet — contact support to reset your password.");
                }}
                style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={login.isPending || !email || !password}
              style={{
                height: 48,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                border: "none",
                borderRadius: "var(--radius-md)",
                background: "var(--brand)",
                color: "var(--on-brand)",
                fontWeight: 700,
                fontSize: 14.5,
                cursor: login.isPending ? "not-allowed" : "pointer",
                opacity: login.isPending || !email || !password ? 0.6 : 1,
                boxShadow: "var(--shadow-brand)",
              }}
            >
              {login.isPending ? "Signing in…" : "Sign In"} {!login.isPending && <Icon.arrowRight size={16} />}
            </button>
          </form>

          <div style={{ margin: "22px 0" }}>
            <AuthDivider label="OR CONTINUE WITH" />
          </div>

          <GoogleButton />

          <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Don't have an account?{" "}
            <Link to="/sign-up" style={{ color: "var(--brand)", fontWeight: 700 }}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
