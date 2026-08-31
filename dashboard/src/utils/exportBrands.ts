import type { Brand } from "../api/brands";

const EXPORT_COLUMNS = ["ID", "Name", "Website", "Categories", "Country", "Active", "Last searched", "Created"] as const;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function brandRow(b: Brand): string[] {
  return [
    String(b.id),
    b.name,
    b.website ?? "",
    b.categories.join("; "),
    b.country ?? "",
    b.is_active ? "Yes" : "No",
    formatDate(b.last_searched),
    formatDate(b.created_at),
  ];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportBrandsToCsv(brands: Brand[], filename = "brands.csv") {
  const lines = [EXPORT_COLUMNS.join(","), ...brands.map((b) => brandRow(b).map(csvEscape).join(","))];
  // Leading BOM so Excel opens the UTF-8 file correctly instead of mangling accented brand names.
  const csv = "﻿" + lines.join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

// Dynamically imported — jsPDF pulls in html2canvas/dompurify (~250KB) that
// every dashboard user would otherwise download even if they never export a
// PDF, since this app has no other route-based code-splitting.
export async function exportBrandsToPdf(brands: Brand[], filename = "brands.pdf") {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Brands", 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported ${new Date().toLocaleString()} — ${brands.length} brand(s)`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [[...EXPORT_COLUMNS]],
    body: brands.map(brandRow),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [183, 19, 26] },
    alternateRowStyles: { fillColor: [248, 249, 251] },
  });

  doc.save(filename);
}
