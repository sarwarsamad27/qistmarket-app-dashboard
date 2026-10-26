"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, FileText, FileDown, ChevronDown } from "lucide-react";
import { pktDate } from '@/utils/pkt'

export interface ExportColumn<T> {
  header: string;
  /** Value written to the file — numbers stay numbers in Excel/CSV. */
  value: (row: T, index: number) => string | number | null | undefined;
  /** Right-align in the PDF (amounts). */
  numeric?: boolean;
}

type Format = "xlsx" | "csv" | "pdf";

/**
 * jsPDF's built-in font is Latin-1 only: one "—" (or any character past U+00FF) in a
 * string makes it write the whole cell as spaced-out garbage. Swap the common ones
 * for plain equivalents and drop the rest.
 */
export const pdfText = (s: string) => s
  .replace(/[‐-―−]/g, "-")
  .replace(/[‘’‚]/g, "'")
  .replace(/[“”„]/g, '"')
  .replace(/…/g, "...")
  .replace(/•/g, "·")
  .replace(/₨/g, "Rs")
  .replace(/[←-⇿]/g, "->")
  .replace(/[^\x00-\xFF]/g, "");

/**
 * CSV opened in Excel turns digit strings into numbers: a phone loses its leading 0,
 * an IMEI shows as 8.66863E+14 and a 16-digit 1Bill ID loses its last digit. Such
 * values are written as ="…" so Excel keeps them as text.
 */
const csvCell = (raw: unknown) => {
  if (typeof raw === "number") return String(raw);
  const v = String(raw);
  if (/^(0\d+|\+\d+|\d{11,})$/.test(v)) return `="${v}"`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};
export const toCsv = (rows: unknown[][]) =>
  rows.map((r) => r.map((v) => csvCell(v === null || v === undefined ? "" : v)).join(",")).join("\r\n");

/** Saves a CSV with a BOM so Excel reads Urdu / special characters as UTF-8. */
export function downloadCsv(rows: unknown[][], fileName: string) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Every row of a paged list, for an export: asks for page after page until one comes
 * back short. A single "limit=5000" request silently cut the file off at 5000 rows.
 */
export async function fetchAllPages<T>(fetchPage: (page: number, limit: number) => Promise<T[]>, limit = 1000): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 500; page++) {
    const rows = await fetchPage(page, limit);
    all.push(...rows);
    if (rows.length < limit) break;
  }
  return all;
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "export";
const stamp = () => pktDate();

/** Writes `rows` as an Excel, CSV or PDF file using the given column definitions. */
export function exportRows<T>(format: Format, title: string, columns: ExportColumn<T>[], rows: T[], subtitle?: string) {
  const table = rows.map((r, i) => columns.map((c) => {
    const v = c.value(r, i);
    return v === null || v === undefined ? "" : v;
  }));
  const fileBase = `${safeName(title)}_${stamp()}`;

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(pdfText(title), 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(110);
    const generated = new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
    doc.text(pdfText(`${subtitle ? `${subtitle} - ` : ""}Generated ${generated} - ${rows.length} row(s)`), 40, 56);
    autoTable(doc, {
      startY: 70,
      head: [columns.map((c) => pdfText(c.header))],
      body: table.map((r) => r.map((v) => (typeof v === "number" ? v.toLocaleString("en-PK") : pdfText(String(v))))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [255, 61, 61] },
      columnStyles: Object.fromEntries(columns.map((c, i) => [i, c.numeric ? { halign: "right" } : {}])),
      margin: { left: 40, right: 40 },
    });
    doc.save(`${fileBase}.pdf`);
    return;
  }

  if (format === "csv") {
    downloadCsv([columns.map((c) => c.header), ...table], `${fileBase}.csv`);
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header), ...table]);
  ws["!cols"] = columns.map((c, i) => ({ wch: Math.min(48, Math.max(c.header.length, ...table.slice(0, 200).map((r) => String(r[i]).length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeName(title).slice(0, 31));
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}

/**
 * "Export" button with Excel / CSV / PDF options for the rows currently on screen.
 * `getRows` may be async (e.g. to fetch every page before exporting).
 */
export default function ExportMenu<T>({ title, subtitle, columns, getRows, disabled }: {
  title: string;
  subtitle?: string;
  /** Fixed columns, or a function that builds them from the rows (for reports whose fields vary). */
  columns: ExportColumn<T>[] | ((rows: T[]) => ExportColumn<T>[]);
  getRows: () => T[] | Promise<T[]>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const run = async (format: Format) => {
    setOpen(false);
    setBusy(true);
    try {
      const rows = await getRows();
      if (!rows.length) { toast.error("Nothing to export."); return; }
      exportRows(format, title, typeof columns === "function" ? columns(rows) : columns, rows, subtitle);
      toast.success(`Exported ${rows.length} row(s).`);
    } catch (err: any) {
      toast.error(err?.message || "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const options: { format: Format; label: string; icon: any }[] = [
    { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
    { format: "csv", label: "CSV (.csv)", icon: FileDown },
    { format: "pdf", label: "PDF (.pdf)", icon: FileText },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-stroke bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:border-[#ff3d3d] hover:text-[#ff3d3d] disabled:opacity-50 dark:border-dark-3 dark:bg-gray-dark dark:text-gray-200"
      >
        <Download className="size-4" /> {busy ? "Exporting..." : "Export"} <ChevronDown className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg dark:border-white/10 dark:bg-boxdark">
          {options.map((o) => (
            <button key={o.format} type="button" onClick={() => run(o.format)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-gray-700 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-white/5">
              <o.icon className="size-4 text-gray-400" /> {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
