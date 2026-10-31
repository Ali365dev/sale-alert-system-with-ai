import { useEffect, useRef, useState } from "react";
import { COUNTRIES, useRegionStore } from "../../store/regionStore";
import { Icon } from "../icons";

export function CountrySelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { region, setRegion } = useRegionStore();

  const selected = COUNTRIES.find((c) => c.code === region) ?? null;

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
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 10px 0 12px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-pill)",
          background: "var(--surface-card)",
          color: "var(--text-strong)",
          font: "600 13px/1 var(--font-sans)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>
          {selected ? selected.flag : "🌍"}
        </span>
        <span style={{ color: "var(--text-body)" }}>
          {selected ? selected.name : "All Countries"}
        </span>
        <Icon.chevron
          size={11}
          style={{
            transform: open ? "rotate(-90deg)" : "rotate(90deg)",
            color: "var(--text-faint)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Select country"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 30,
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
          {/* All Countries option */}
          <button
            type="button"
            role="option"
            aria-selected={region === null}
            onClick={() => { setRegion(null); setOpen(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: region === null ? "var(--accent-subtle, rgba(232,52,78,0.1))" : "transparent",
              color: region === null ? "var(--accent)" : "var(--text-body)",
              font: "600 13px/1 var(--font-sans)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16 }}>🌍</span>
            <span style={{ flex: 1 }}>All Countries</span>
            {region === null && <Icon.check size={13} style={{ color: "var(--accent)" }} />}
          </button>

          <div style={{ height: 1, background: "var(--border)", margin: "4px 4px" }} />

          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={region === c.code}
              onClick={() => { setRegion(c.code); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: region === c.code ? "var(--accent-subtle, rgba(232,52,78,0.1))" : "transparent",
                color: region === c.code ? "var(--accent)" : "var(--text-body)",
                font: "600 13px/1 var(--font-sans)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 16 }}>{c.flag}</span>
              <span style={{ flex: 1 }}>{c.name}</span>
              {region === c.code && <Icon.check size={13} style={{ color: "var(--accent)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
