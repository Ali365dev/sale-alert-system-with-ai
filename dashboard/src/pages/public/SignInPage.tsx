import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { errorMessage, useLogin } from "../../api/auth";
import { Icon } from "../../components/icons";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Label, TextInput } from "../../components/ui/Field";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";
import { GoogleButton } from "./GoogleButton";

export function SignInPage() {
  useSeo({ title: "Sign in — DealHub" });
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate("/");
    } catch (error) {
      toast.error(errorMessage(error, "Incorrect email or password."));
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
            <h1 style={{ margin: "8px 0 0", font: "var(--fw-bold) 20px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Welcome back</h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Sign in to save and follow your favorite deals.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Label>Email</Label>
              <TextInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <div style={{ position: "relative" }}>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            <Button type="submit" fullWidth loading={login.isPending} disabled={!email || !password}>
              Sign in
            </Button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-faint)", fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            or
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <GoogleButton />

          <p style={{ margin: 0, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            Don't have an account? <Link to="/sign-up" style={{ color: "var(--brand)", fontWeight: 600 }}>Sign up</Link>
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
