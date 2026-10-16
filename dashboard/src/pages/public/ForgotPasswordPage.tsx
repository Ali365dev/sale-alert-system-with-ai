import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AxiosError } from "axios";

import { apiClient } from "../../api/client";
import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";
import { AuthField, AuthIllustration } from "./AuthField";

const MIN_PASSWORD_LENGTH = 8;

export function ForgotPasswordPage() {
  useSeo({ title: "Forgot password — DealPulse" });
  const navigate = useNavigate();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setPending(true);
    setInfo(null);
    try {
      const { data } = await apiClient.post<{ ok: boolean; message?: string; dev_code?: string }>(
        "/auth/forgot-password",
        { email: email.trim().toLowerCase() },
      );
      const message = data.message || "If an account exists, we sent a reset code.";
      setInfo(data.dev_code ? `${message} Dev code: ${data.dev_code}` : message);
      if (data.dev_code) setCode(String(data.dev_code));
      setStep("reset");
      toast.success("Check your email for a reset code.");
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { error?: string } | undefined)?.error
          : undefined;
      toast.error(message || "Couldn't send a reset code. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await apiClient.post("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
      });
      toast.success("Password updated. Sign in with your new password.");
      navigate("/sign-in");
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { error?: string } | undefined)?.error
          : undefined;
      toast.error(message || "Couldn't reset password. Check the code and try again.");
    } finally {
      setPending(false);
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
            {step === "request" ? "Forgot password?" : "Set a new password"}
          </h1>
          <p style={{ margin: "8px 0 26px", fontSize: 13.5, color: "var(--text-muted)", maxWidth: 320 }}>
            {step === "request"
              ? "Enter your email and we'll send a 6-digit code if you have an email & password account."
              : `Enter the code sent to ${email}, then choose a new password.`}
          </p>

          {info ? (
            <p
              style={{
                margin: "0 0 18px",
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-sunken)",
                fontSize: 13,
                color: "var(--text-body)",
                lineHeight: 1.45,
              }}
            >
              {info}
            </p>
          ) : null}

          {step === "request" ? (
            <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>
                  Email address
                </label>
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
              <button
                type="submit"
                disabled={pending || !email.trim()}
                style={submitStyle(pending || !email.trim())}
              >
                {pending ? "Sending…" : "Send reset code"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitReset} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>
                  Reset code
                </label>
                <AuthField
                  icon={<Icon.lock size={17} />}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>
                  New password
                </label>
                <AuthField
                  icon={<Icon.lock size={17} />}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
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
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>
                  Confirm password
                </label>
                <AuthField
                  icon={<Icon.lock size={17} />}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <button
                type="submit"
                disabled={pending || !code.trim() || !password || !confirmPassword}
                style={submitStyle(pending || !code.trim() || !password || !confirmPassword)}
              >
                {pending ? "Updating…" : "Update password"}
              </button>
              <button
                type="button"
                onClick={() => sendCode()}
                disabled={pending}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Resend code
              </button>
            </form>
          )}

          <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Remembered it?{" "}
            <Link to="/sign-in" style={{ color: "var(--brand)", fontWeight: 700 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

function submitStyle(disabled: boolean): React.CSSProperties {
  return {
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
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    boxShadow: "var(--shadow-brand)",
  };
}
