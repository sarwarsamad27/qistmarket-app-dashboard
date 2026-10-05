"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import toast from "react-hot-toast";
import { Download, FileSpreadsheet, FileText, FileDown, ChevronDown } from "lucide-react";

export interface ExportColumn<T> {
  header: string;
  /** Value written to the file — numbers stay numbers in Excel/CSV. */
  value: (row: T, index: number) => string | number | null | undefined;
  /** Right-align in the PDF (amounts). */
  numeric?: boolean;
}

type Format = "xlsx" | "csv" | "pdf";

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "export";
const stamp = () => new Date().toISOString().slice(0, 10);

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
    doc.text(title, 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${subtitle ? `${subtitle} — ` : ""}Generated ${new Date().toLocaleString()} — ${rows.length} row(s)`, 40, 56);
    autoTable(doc, {
      startY: 70,
      head: [columns.map((c) => c.header)],
      body: table.map((r) => r.map((v) => (typeof v === "number" ? v.toLocaleString("en-PK") : String(v)))),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [255, 61, 61] },
      columnStyles: Object.fromEntries(columns.map((c, i) => [i, c.numeric ? { halign: "right" } : {}])),
      margin: { left: 40, right: 40 },
    });
    doc.save(`${fileBase}.pdf`);
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header), ...table]);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
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
  columns: ExportColumn<T>[];
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
      exportRows(format, title, columns, rows, subtitle);
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
