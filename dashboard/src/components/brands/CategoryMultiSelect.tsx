import { useEffect, useRef, useState } from "react";
import { useCategories } from "../../api/categories";

interface Props {
  selected: string[];
  onChange: (categories: string[]) => void;
}

export function CategoryMultiSelect({ selected, onChange }: Props) {
  const { data } = useCategories(false);
  const options = (data?.categories ?? []).filter((c) => c.is_active).map((c) => c.name);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = options.filter(
    (o) => o.toLowerCase().includes(query.toLowerCase()) && !selected.includes(o),
  );

  const toggle = (name: string) => {
    if (selected.includes(name)) onChange(selected.filter((s) => s !== name));
    else onChange([...selected, name]);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Selected pills + input */}
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          minHeight: 42,
          padding: "6px 10px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-input, var(--surface-card))",
          cursor: "text",
        }}
      >
        {selected.map((name) => (
          <span
            key={name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--accent-subtle, rgba(232,52,78,0.12))",
              color: "var(--accent)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(name); }}
              aria-label={`Remove ${name}`}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--accent)" }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "Select categories…" : ""}
          style={{
            flex: "1 1 80px",
            minWidth: 80,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: "var(--text-strong)",
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 40,
            maxHeight: 220,
            overflowY: "auto",
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--text-muted)" }}>
              {query ? "No match" : "All categories selected"}
            </div>
          ) : (
            filtered.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { toggle(name); setQuery(""); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "9px 14px",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  fontSize: 13,
                  color: "var(--text-body)",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover, var(--surface-sunken))")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
