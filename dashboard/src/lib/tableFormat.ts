/** Display helpers shared by the admin tables, so every table shows the same
 * date format and readable labels instead of raw API values. */

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatTableDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatTableDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Verified",
  suspicious: "Suspicious",
  invalid: "Invalid",
  unverified: "Not checked",
};

export const VERIFICATION_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  verified: "success",
  suspicious: "warning",
  invalid: "danger",
  unverified: "neutral",
};
