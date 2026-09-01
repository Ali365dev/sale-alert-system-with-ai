import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage, useSignup } from "../../api/auth";
import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Label, TextInput } from "../../components/ui/Field";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";
import { GoogleButton } from "./GoogleButton";

const MIN_PASSWORD_LENGTH = 8;

export function SignUpPage() {
  useSeo({ title: "Sign up — DealHub" });
  const navigate = useNavigate();
  const signup = useSignup();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    try {
      await signup.mutateAsync({ email, password, name: name || undefined });
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create your account. Please try again."));
    }
  }

  return (
    <PublicLayout>
      <div style={{ display: "flex", justifyContent: "center", padding: "56px 24px" }}>
        <Card style={{ maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                width: 48,
                height: 48,
                margin: "0 auto",
                borderRadius: 14,
                background: "var(--brand)",
                color: "var(--on-brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.gift size={22} />
            </span>
            <h1 style={{ margin: "8px 0 0", font: "var(--fw-bold) 20px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Create your account</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Save deals and follow brands across all your devices.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label>Name (optional)</Label>
              <TextInput autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <TextInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <div style={{ position: "relative" }}>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-faint)",
                    cursor: "pointer",
                    display: "flex",
                  }}
                >
                  {showPassword ? <Icon.eyeOff size={16} /> : <Icon.eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" fullWidth loading={signup.isPending} disabled={!email || !password}>
              Create account
            </Button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-faint)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            or
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <GoogleButton label="Continue with Google" />

          <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Already have an account? <Link to="/sign-in" style={{ color: "var(--brand)", fontWeight: 600 }}>Sign in</Link>
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
