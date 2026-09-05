import type { InputHTMLAttributes, ReactNode } from "react";

export function AuthField({
  icon,
  trailing,
  style,
  ...props
}: { icon: ReactNode; trailing?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", display: "flex" }}>
        {icon}
      </span>
      <input
        {...props}
        style={{
          width: "100%",
          height: 48,
          padding: `0 ${trailing ? 44 : 16}px 0 44px`,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-card)",
          color: "var(--text-strong)",
          fontSize: 14,
          ...style,
        }}
      />
      {trailing && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>{trailing}</span>}
    </div>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-faint)", fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)" }}>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      {label}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function TagGlyph({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        background: "var(--surface-inverse)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--shadow-md)",
        position: "relative",
      }}
    >
      <span style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 22, height: 22, borderRadius: "50%", border: `5px solid var(--brand)`, background: "transparent" }} />
      <span style={{ font: "800 34px/1 var(--font-sans)", color: "var(--text-on-inverse)" }}>%</span>
    </div>
  );
}

function BagGlyph({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size * 0.85,
        borderRadius: 14,
        background: "var(--surface-inverse)",
        boxShadow: "var(--shadow-md)",
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -14,
          left: "50%",
          transform: "translateX(-50%)",
          width: 26,
          height: 20,
          borderTop: "5px solid var(--surface-inverse)",
          borderLeft: "5px solid var(--surface-inverse)",
          borderRight: "5px solid var(--surface-inverse)",
          borderRadius: "12px 12px 0 0",
        }}
      />
    </div>
  );
}

/** Flat, brand-colored decorative mark for the auth screens — a stand-in for
 * the reference mockup's 3D illustration, since no 3D asset pipeline exists
 * here; kept intentionally simple (no gradients/glassmorphism) per the
 * brief's own "avoid excessive decorative elements" direction. */
export function AuthIllustration({ variant }: { variant: "tag" | "bag-tag" }) {
  return (
    <div style={{ position: "absolute", top: -8, right: 0, width: 150, height: 150, pointerEvents: "none" }} aria-hidden>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--brand-subtle)" }} />
      {variant === "tag" ? (
        <div style={{ position: "absolute", top: 24, right: 30 }}>
          <TagGlyph size={78} />
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", top: 30, right: 14 }}>
            <BagGlyph size={70} />
          </div>
          <div style={{ position: "absolute", top: 62, right: 6 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "800 20px/1 var(--font-sans)",
                color: "var(--on-brand)",
                boxShadow: "var(--shadow-md)",
                transform: "rotate(-6deg)",
              }}
            >
              %
            </span>
          </div>
        </>
      )}
      {[
        { top: 8, left: 4, rotate: -18 },
        { top: 44, left: -6, rotate: 12 },
      ].map((s, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: s.top,
            left: s.left,
            width: 10,
            height: 10,
            background: "var(--warning)",
            transform: `rotate(${s.rotate}deg)`,
            clipPath: "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)",
          }}
        />
      ))}
    </div>
  );
}
