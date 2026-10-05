"use client";

import { useMemo, useState } from "react";
import Cookies from "js-cookie";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { Upload, FileSpreadsheet } from "lucide-react";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type Cell = string | number | Date | null;
type DateFormat = "auto" | "dmy" | "mdy" | "ymd";
interface Mapping { date: number; description: number; reference: number; debit: number; credit: number; amount: number; balance: number }
const NONE = -1;
const EMPTY_MAPPING: Mapping = { date: NONE, description: NONE, reference: NONE, debit: NONE, credit: NONE, amount: NONE, balance: NONE };

const toNumber = (v: Cell): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  const negative = /^\(.*\)$/.test(s) || /dr\.?$/i.test(s) || s.startsWith("-");
  s = s.replace(/[^\d.]/g, "");
  const n = parseFloat(s) || 0;
  return negative ? -n : n;
};

const toDate = (v: Cell, format: DateFormat): Date | null => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0) : null;
  }
  if (!v) return null;
  const s = String(v).trim();
  const parts = s.split(/[\/\-. ]+/).filter(Boolean);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  if (parts.length >= 3) {
    const monthName = months.indexOf(parts[1].slice(0, 3).toLowerCase());
    if (monthName >= 0) { // 05-Oct-2026
      const y = parseInt(parts[2]);
      return new Date(y < 100 ? 2000 + y : y, monthName, parseInt(parts[0]));
    }
    const [a, b, c] = parts.map((p) => parseInt(p));
    const fmt = format === "auto" ? (String(parts[0]).length === 4 ? "ymd" : a > 12 ? "dmy" : b > 12 ? "mdy" : "dmy") : format;
    const year = (y: number) => (y < 100 ? 2000 + y : y);
    if (fmt === "ymd") return new Date(a, b - 1, c);
    if (fmt === "mdy") return new Date(year(c), a - 1, b);
    return new Date(year(c), b - 1, a);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** Guesses which column is which from the header text (works for most Pakistani bank exports). */
const guessMapping = (headers: string[]): Mapping => {
  // First pattern that matches any header wins, so the more specific ones go first.
  const find = (...patterns: RegExp[]) => {
    for (const p of patterns) {
      const i = headers.findIndex((h) => p.test(h.trim().toLowerCase()));
      if (i !== NONE) return i;
    }
    return NONE;
  };
  const debit = find(/debit/, /withdraw/, /\bdr\b/);
  const credit = find(/credit/, /deposit/, /\bcr\b/);
  return {
    date: find(/value\s*date/, /(txn|tran|transaction)\s*date/, /\bdate\b/, /posting/),
    description: find(/description/, /narration/, /particular/, /details/, /remarks/),
    reference: find(/reference/, /\bref\b/, /cheque|chq/, /instrument/),
    debit,
    credit: credit === debit ? NONE : credit,
    amount: debit === NONE && credit === NONE ? find(/amount/) : NONE,
    balance: find(/balance/),
  };
};

/**
 * Import a bank statement in whatever layout the bank exports (Excel or CSV): pick the header
 * row, map the columns once (remembered per account), preview, then send the normalised lines
 * to the backend, which stores them and auto-matches them against the system transactions.
 */
export default function StatementImport({ account, onImported }: { account: { id: number; bank_name: string; account_number: string }; onImported: (statementId: number) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [dateFormat, setDateFormat] = useState<DateFormat>("auto");
  const [uploading, setUploading] = useState(false);
  const storageKey = `bank-stmt-mapping-${account.id}`;

  const headers = useMemo(() => (grid[headerRow] || []).map((h, i) => (h === null || h === "" ? `Column ${i + 1}` : String(h))), [grid, headerRow]);

  const readFile = async (f: File) => {
    setFile(f);
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null }) as Cell[][];
    setGrid(rows);
    // Header row = first row with at least 3 text cells (banks often put the account info above it).
    const hr = Math.max(0, rows.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim()).length >= 3));
    setHeaderRow(hr);
    let saved: (Mapping & { headerRow?: number; dateFormat?: DateFormat }) | null = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { saved = null; }
    const hdrs = (rows[hr] || []).map((h) => String(h ?? ""));
    if (saved && saved.date !== NONE && saved.date < hdrs.length) {
      setMapping(saved);
      if (saved.dateFormat) setDateFormat(saved.dateFormat);
    } else {
      setMapping(guessMapping(hdrs));
    }
  };

  const lines = useMemo(() => {
    if (mapping.date === NONE) return [];
    return grid.slice(headerRow + 1).map((r) => {
      const date = toDate(r[mapping.date], dateFormat);
      let debit = mapping.debit !== NONE ? Math.abs(toNumber(r[mapping.debit])) : 0;
      let credit = mapping.credit !== NONE ? Math.abs(toNumber(r[mapping.credit])) : 0;
      if (mapping.amount !== NONE) {
        const a = toNumber(r[mapping.amount]);
        if (a < 0) debit = -a; else credit = a;
      }
      return {
        date: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10) + "T12:00:00" : null,
        description: mapping.description !== NONE ? (r[mapping.description] ?? "") : "",
        reference: mapping.reference !== NONE ? (r[mapping.reference] ?? "") : "",
        debit, credit,
        balance: mapping.balance !== NONE && r[mapping.balance] !== null && r[mapping.balance] !== "" ? toNumber(r[mapping.balance]) : null,
      };
    }).filter((l) => l.date && (l.debit > 0 || l.credit > 0));
  }, [grid, headerRow, mapping, dateFormat]);

  const totals = lines.reduce((t, l) => ({ debit: t.debit + l.debit, credit: t.credit + l.credit }), { debit: 0, credit: 0 });

  const submit = async () => {
    if (!lines.length) { toast.error("No valid rows — map the Date column and Debit/Credit (or Amount)."); return; }
    setUploading(true);
    try {
      try { localStorage.setItem(storageKey, JSON.stringify({ ...mapping, dateFormat })); } catch { /* storage unavailable */ }
      const fd = new FormData();
      if (file) fd.append("file", file);
      fd.append("bank_account_id", String(account.id));
      fd.append("lines", JSON.stringify(lines));
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements/import`, { method: "POST", headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` }, body: fd });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Import failed."));
      const j = await res.json();
      toast.success(`${j.data.lines} line(s) imported — ${j.data.matched} matched automatically, ${j.data.unmatched} to review.`);
      setFile(null); setGrid([]);
      onImported(j.data.statement_id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const select = "w-full rounded-lg border border-stroke bg-white px-2.5 py-1.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white";
  const fields: { key: keyof Mapping; label: string; required?: boolean }[] = [
    { key: "date", label: "Date *", required: true },
    { key: "description", label: "Description / Narration" },
    { key: "reference", label: "Reference / Cheque no." },
    { key: "debit", label: "Debit (money out)" },
    { key: "credit", label: "Credit (money in)" },
    { key: "amount", label: "Single Amount column (− = out)" },
    { key: "balance", label: "Balance" },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10"><FileSpreadsheet className="size-4" /></div>
        <div>
          <h3 className="text-sm font-bold text-dark dark:text-white">Import Bank Statement</h3>
          <p className="text-xs text-gray-500">Download the statement from your bank’s internet banking as Excel or CSV — any bank’s layout works. Match its columns below once; it’s remembered for this account.</p>
        </div>
      </div>

      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} className="w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />

      {grid.length > 0 && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-gray-500">Header row
              <select value={headerRow} onChange={(e) => { setHeaderRow(parseInt(e.target.value)); setMapping(guessMapping((grid[parseInt(e.target.value)] || []).map((h) => String(h ?? "")))); }} className={`${select} mt-1`}>
                {grid.slice(0, 30).map((r, i) => <option key={i} value={i}>Row {i + 1}: {r.filter((c) => c !== null && c !== "").slice(0, 4).map(String).join(" | ").slice(0, 60)}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-500">Date format in file
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)} className={`${select} mt-1`}>
                <option value="auto">Auto detect</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option><option value="ymd">YYYY-MM-DD</option>
              </select>
            </label>
            {fields.map((f) => (
              <label key={f.key} className="text-xs font-medium text-gray-500">{f.label}
                <select value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: parseInt(e.target.value) })} className={`${select} mt-1`}>
                  <option value={NONE}>— not in file —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
            {lines.length} transaction line(s) read — credits <b className="text-emerald-600">{PKR(totals.credit)}</b>, debits <b className="text-rose-600">{PKR(totals.debit)}</b>.
            {lines.length === 0 && " Map at least the Date column and Debit/Credit (or one Amount column)."}
          </div>

          {lines.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-100 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500 dark:bg-dark-2"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Ref</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                <tbody>
                  {lines.slice(0, 15).map((l, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-3 py-1.5">{l.date?.slice(0, 10)}</td>
                      <td className="max-w-[260px] truncate px-3 py-1.5">{String(l.description)}</td>
                      <td className="px-3 py-1.5">{String(l.reference)}</td>
                      <td className="px-3 py-1.5 text-right text-rose-600">{l.debit ? PKR(l.debit) : ""}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-600">{l.credit ? PKR(l.credit) : ""}</td>
                      <td className="px-3 py-1.5 text-right">{l.balance !== null ? PKR(l.balance) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lines.length > 15 && <p className="px-3 py-1.5 text-[11px] text-gray-400">…and {lines.length - 15} more</p>}
            </div>
          )}

          <button onClick={submit} disabled={uploading || !lines.length} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">
            <Upload className="size-4" /> {uploading ? "Importing..." : `Import ${lines.length} line(s) & auto-match`}
          </button>
        </div>
      )}
    </div>
  );
}
