import { useUiStore } from "../../store/uiStore";

export function Header({ title, eyebrow = "Workspace" }: { title: string; eyebrow?: string }) {
  const { theme, toggleTheme } = useUiStore();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 28px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-app)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "0 0 auto" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "var(--ls-wide)",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            margin: 0,
            font: "var(--fw-bold) 20px/1.2 var(--font-sans)",
            letterSpacing: "var(--ls-snug)",
            color: "var(--text-strong)",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </h1>
      </div>

      <div style={{ flex: "1 1 auto" }} />

      <button
        type="button"
        onClick={toggleTheme}
        title="Toggle theme"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 40,
          padding: "0 13px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-card)",
          color: "var(--text-body)",
          font: "600 12.5px/1 var(--font-sans)",
          cursor: "pointer",
        }}
      >
        {theme === "dark" ? "Dark" : "Light"}
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 12px",
          border: "1px solid var(--success-subtle)",
          background: "var(--success-subtle)",
          borderRadius: "var(--radius-sm)",
          whiteSpace: "nowrap",
          flex: "0 0 auto",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--success)",
            boxShadow: "0 0 0 3px var(--success-subtle)",
          }}
        />
        <span style={{ font: "600 12px/1 var(--font-sans)", color: "var(--success)" }}>Gmail connected</span>
      </div>
    </header>
  );
}
