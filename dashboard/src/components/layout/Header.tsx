import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useSettingsLogout } from "../../api/settings";
import { useUiStore } from "../../store/uiStore";
import { Icon } from "../icons";

function GlobalSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) navigate(`/emails?q=${encodeURIComponent(value.trim())}`);
      }}
      style={{ position: "relative", flex: "1 1 auto", maxWidth: 480 }}
    >
      <Icon.search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search emails, brands, or keywords…"
        aria-label="Search emails, brands, or keywords"
        style={{
          width: "100%",
          height: 40,
          padding: "0 60px 0 38px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-pill)",
          background: "var(--surface-app)",
          color: "var(--text-strong)",
          fontSize: 13,
          boxSizing: "border-box",
        }}
      />
      <span
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          display: "inline-flex",
          alignItems: "center",
          height: 20,
          padding: "0 6px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          font: "600 10.5px/1 var(--font-mono)",
          color: "var(--text-faint)",
        }}
      >
        ⌘K
      </span>
    </form>
  );
}

function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useUiStore();
  const logout = useSettingsLogout();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 6px 0 0",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "var(--text-strong)",
            color: "var(--surface-app)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "700 12.5px/1 var(--font-sans)",
          }}
        >
          <Icon.user size={16} />
        </span>
        <Icon.chevron size={12} style={{ transform: "rotate(90deg)", color: "var(--text-faint)" }} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 20,
            minWidth: 200,
            padding: 6,
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)" }} />
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Gmail connected</span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "9px 10px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              color: "var(--text-body)",
              font: "600 12.5px/1 var(--font-sans)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "9px 10px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              color: "var(--danger)",
              font: "600 12.5px/1 var(--font-sans)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const navigate = useNavigate();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 28px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-app)",
      }}
    >
      <GlobalSearch />

      <div style={{ flex: "1 1 auto" }} />

      <button
        type="button"
        onClick={() => navigate("/notifications")}
        aria-label="Notifications"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          border: "1px solid var(--border)",
          borderRadius: "50%",
          background: "var(--surface-card)",
          color: "var(--text-body)",
          cursor: "pointer",
        }}
      >
        <Icon.bell size={16} />
      </button>

      <AvatarMenu />
    </header>
  );
}
