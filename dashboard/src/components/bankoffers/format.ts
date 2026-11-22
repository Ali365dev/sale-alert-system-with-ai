export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function isExpired(iso: string | null) {
  return iso ? new Date(iso) < new Date() : false;
}

export function fmtMoney(amount: number | null, currency: string | null) {
  if (amount == null) return null;
  return `${currency ?? "Rs"} ${Number(amount).toLocaleString()}`;
}

export function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

export function splitList(text: string, separator: RegExp) {
  return text.split(separator).map((s) => s.trim()).filter(Boolean);
}
