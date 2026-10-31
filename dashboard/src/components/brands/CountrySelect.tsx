import { COUNTRIES } from "../../store/regionStore";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export function CountrySelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        height: 42,
        padding: "0 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-input, var(--surface-card))",
        color: value ? "var(--text-strong)" : "var(--text-faint)",
        fontSize: 13,
        cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: 32,
      }}
    >
      <option value="">— Select country —</option>
      {COUNTRIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.flag}  {c.name}
        </option>
      ))}
    </select>
  );
}
