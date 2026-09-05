import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage, useSignup } from "../../api/auth";
import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";
import { AuthDivider, AuthField, AuthIllustration } from "./AuthField";
import { GoogleButton } from "./GoogleButton";

const MIN_PASSWORD_LENGTH = 8;

export function SignUpPage() {
  useSeo({ title: "Sign up — DealPulse" });
  const navigate = useNavigate();
  const signup = useSignup();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }
    try {
      await signup.mutateAsync({ email, password, name: name || undefined });
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create your account. Please try again."));
    }
  }

  const canSubmit = name.trim() && email && password && confirmPassword && agreed;

  return (
    <PublicLayout>
      <div style={{ display: "flex", justifyContent: "center", padding: "56px 24px" }}>
        <div
          style={{
            position: "relative",
            maxWidth: 560,
            width: "100%",
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "32px 36px 36px",
            overflow: "hidden",
          }}
        >
          <AuthIllustration variant="bag-tag" />

          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, marginBottom: 28 }}>
            <Icon.pulse size={20} strokeWidth={2.5} style={{ color: "var(--brand)" }} />
            <span style={{ font: "var(--fw-extra) 17px/1 var(--font-sans)" }}>
              Deal<span style={{ color: "var(--brand)" }}>Pulse</span>
            </span>
          </div>

          <h1 style={{ margin: 0, font: "var(--fw-extra) 26px/1.25 var(--font-sans)", color: "var(--text-strong)", maxWidth: 340 }}>
            Create Your <span style={{ color: "var(--brand)" }}>Account</span>
          </h1>
          <p style={{ margin: "8px 0 26px", fontSize: 13.5, color: "var(--text-muted)", maxWidth: 340 }}>
            Join DealPulse and never miss a great deal again.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="auth-two-col">
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>Full name</label>
                <AuthField icon={<Icon.user size={17} />} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" />
              </div>
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
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>Password</label>
              <AuthField
                icon={<Icon.lock size={17} />}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
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
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-strong)", marginBottom: 6 }}>Confirm password</label>
              <AuthField
                icon={<Icon.lock size={17} />}
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", display: "flex" }}
                  >
                    {showConfirmPassword ? <Icon.eyeOff size={16} /> : <Icon.eye size={16} />}
                  </button>
                }
              />
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--text-body)", cursor: "pointer", lineHeight: 1.5 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2 }} />
              <span>
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "var(--brand)", fontWeight: 700 }}
                >
                  Terms &amp; Conditions
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: "var(--brand)", fontWeight: 700 }}
                >
                  Privacy Policy
                </a>
              </span>
            </label>

            <button
              type="submit"
              disabled={signup.isPending || !canSubmit}
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
                cursor: signup.isPending ? "not-allowed" : "pointer",
                opacity: signup.isPending || !canSubmit ? 0.6 : 1,
                boxShadow: "var(--shadow-brand)",
              }}
            >
              {signup.isPending ? "Creating account…" : "Create Account"} {!signup.isPending && <Icon.arrowRight size={16} />}
            </button>
          </form>

          <div style={{ margin: "22px 0" }}>
            <AuthDivider label="OR SIGN UP WITH" />
          </div>

          <GoogleButton label="Sign up with Google" />

          <p style={{ margin: "22px 0 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link to="/sign-in" style={{ color: "var(--brand)", fontWeight: 700 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
