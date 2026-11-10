"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Sheet, Download, Search, Users, AlertTriangle, CheckCircle2, Wallet, Loader2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { LEGACY_COLUMNS, LEGACY_DATE_COLUMNS, LEGACY_HEADERS, SERIAL_HEADER } from "@/lib/legacySheetColumns";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const TZ = "Asia/Karachi";
const PAGE_SIZE = 50;

type MasterRow = Record<string, any> & {
  order_id: number;
  order_ref: string;
  account_branch: string;
  source: string;
  account_status: "Active" | "Overdue" | "Completed";
  months_paid: number;
  total_paid: number;
  overdue_amount: number;
  overdue_months: number;
  due_day: number | null;
  first_due_date: string | null;
  next_due_date: string | null;
  next_due_amount: number;
  qr_id: string;
};

interface MasterData {
  summary: { count: number; active: number; overdue: number; completed: number; totalRemain: number };
  outlets: { id: number; name: string; code: string }[];
  categories: string[];
  rows: MasterRow[];
}

// Written after the import columns, so the sheet still re-imports cleanly
// (the import reads by position, skips a leading S.No column and ignores anything past its last column).
const SUMMARY_COLUMNS: { key: keyof MasterRow; header: string; date?: boolean }[] = [
  { key: "order_ref", header: "Order Ref" },
  { key: "account_branch", header: "Account Branch" },
  { key: "source", header: "Source" },
  { key: "account_status", header: "Account Status" },
  { key: "months_paid", header: "Installments Paid" },
  { key: "total_paid", header: "Total Paid (incl. Advance)" },
  { key: "overdue_months", header: "Overdue Installments" },
  { key: "overdue_amount", header: "Overdue Amount" },
  { key: "due_day", header: "Monthly Due Day" },
  { key: "first_due_date", header: "First Due Date", date: true },
  { key: "next_due_date", header: "Next Due Date", date: true },
  { key: "next_due_amount", header: "Next Due Amount" },
  { key: "qr_id", header: "QR ID" },
];

// Number columns shown with thousands separators in the preview (the Excel keeps raw numbers).
const NUMBER_COLUMNS = new Set<string>(["item_price", "advance", "installment", "remain", "total_paid", "overdue_amount", "next_due_amount"]);

// One cell value, used by BOTH the Excel download and the on-screen table, so what
// the page shows is exactly what the file contains.
const cellValue = (r: MasterRow, key: string, date?: boolean) => (date ? ddmmyyyy(r[key]) : r[key] ?? "");

const RANGES = ["All", "Day", "Week", "Month", "Quarter", "Year", "Custom"] as const;

// Day-first text, the format the legacy import reads date cells in.
const ddmmyyyy = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ }) : "");

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  Overdue: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  Completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const selectCls = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-dark focus:border-[#ff3d3d] focus:outline-none dark:border-white/10 dark:bg-dark-2 dark:text-white";

export default function MasterSheetPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [outletId, setOutletId] = useState("all");
  const [accountStatus, setAccountStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [category, setCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<MasterData | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) return;
    if (range === "Custom" && (!startDate || !endDate)) { setData(null); return; }

    const params = new URLSearchParams({ outlet_id: outletId, accountStatus, channel, category });
    if (range !== "All") params.set("range", range);
    if (range === "Custom") { params.set("startDate", startDate); params.set("endDate", endDate); }
    if (search) params.set("search", search);

    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/master-sheet?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data);
          setPage(1);
          // Keep the category list from widening/narrowing as the category filter itself changes.
          if (category === "all") setCategories(json.data.categories);
        } else toast.error(json.message || "Failed to load master sheet");
      })
      .catch((err) => { console.error("Failed to load master sheet:", err); toast.error("Failed to load master sheet"); })
      .finally(() => setLoading(false));
  }, [range, startDate, endDate, outletId, accountStatus, channel, category, search]);

  const rows = data?.rows || [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Exactly the columns the Excel gets, in the same order.
  const sheetColumns: { key: string; header: string; date?: boolean }[] = [
    ...LEGACY_COLUMNS.map((col, i) => ({ key: col as string, header: LEGACY_HEADERS[i], date: LEGACY_DATE_COLUMNS.includes(col) })),
    ...(includeSummary ? SUMMARY_COLUMNS.map((c) => ({ key: c.key as string, header: c.header, date: c.date })) : []),
  ];

  const handleDownload = () => {
    if (!rows.length) return toast.error("Nothing to download for these filters");
    const headers = [SERIAL_HEADER, ...sheetColumns.map((c) => c.header)];
    const body = rows.map((r, i) => [i + 1, ...sheetColumns.map((c) => cellValue(r, c.key, c.date))]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, Math.min(28, h.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Sheet");
    const stamp = range === "Custom" ? `${startDate}_to_${endDate}` : `${range}_${new Date().toLocaleDateString("en-CA", { timeZone: TZ })}`;
    XLSX.writeFile(wb, `master_sheet_${stamp}.xlsx`);
  };

  return (
    <>
      <Breadcrumb pageName="Master Sheet" />
      <PageHeader
        icon={Sheet}
        title="Master Sheet Export"
        subtitle="All delivered accounts in the same column layout as the Legacy Import sheet."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={includeSummary} onChange={(e) => setIncludeSummary(e.target.checked)} className="accent-[#ff3d3d]" />
              Add account summary columns
            </label>
            <button
              onClick={handleDownload}
              disabled={loading || !rows.length}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download Excel
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Delivery date</span>
          <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${range === r ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                {r === "All" ? "All time" : r === "Day" ? "Today" : r}
              </button>
            ))}
          </div>
          {range === "Custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={selectCls} />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={selectCls} />
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, CNIC, phone, 1Bill ID…" className={`${selectCls} w-full pl-9`} />
          </div>
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={selectCls}>
            <option value="all">All branches</option>
            {data?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
          </select>
          <select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)} className={selectCls}>
            <option value="all">All account statuses</option>
            <option value="active">Active (up to date)</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed (fully paid)</option>
          </select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={selectCls}>
            <option value="all">Regular + Legacy</option>
            <option value="regular">Regular sales only</option>
            <option value="legacy_import">Legacy imported only</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={Users} label={`Accounts · ${data?.summary.active ?? 0} active`} value={data?.summary.count ?? 0} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
            <StatCard icon={AlertTriangle} label="Overdue accounts" value={data?.summary.overdue ?? 0} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" />
            <StatCard icon={CheckCircle2} label="Completed accounts" value={data?.summary.completed ?? 0} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
            <StatCard icon={Wallet} label="Total remaining" value={PKR(data?.summary.totalRemain || 0)} accent="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" bar="bg-amber-500" />
          </>
        )}
      </div>

      {/* Preview */}
      {loading ? (
        <TableSkeleton />
      ) : rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <p className="border-b border-slate-100 px-4 py-2.5 text-xs text-gray-500 dark:border-white/10">
            Every column of the Excel download, in the same order ({sheetColumns.length} columns) — scroll sideways to see them all.
            Price, advance, installment and tenure come from the account&apos;s ledger.
          </p>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 font-bold dark:bg-dark-2">{SERIAL_HEADER}</th>
                  {sheetColumns.map((c) => (
                    <th key={c.key} className={`whitespace-nowrap px-3 py-3 font-bold ${NUMBER_COLUMNS.has(c.key) ? "text-right" : ""}`}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.order_id} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="sticky left-0 bg-white px-3 py-2.5 text-gray-400 dark:bg-boxdark">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    {sheetColumns.map((c) => {
                      const v = cellValue(r, c.key, c.date);
                      if (c.key === "account_status") {
                        return (
                          <td key={c.key} className="px-3 py-2.5">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.account_status]}`}>{r.account_status}</span>
                          </td>
                        );
                      }
                      const isNum = NUMBER_COLUMNS.has(c.key) && typeof v === "number";
                      return (
                        <td
                          key={c.key}
                          title={String(v)}
                          className={`max-w-[240px] truncate whitespace-nowrap px-3 py-2.5 ${isNum ? "text-right tabular-nums" : ""} ${c.key === "purchaser_name" || c.key === "item_price" ? "font-semibold text-dark dark:text-white" : "text-gray-600 dark:text-gray-300"}`}
                        >
                          {v === "" ? <span className="text-gray-300">—</span> : isNum ? (v as number).toLocaleString() : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-gray-500 dark:border-white/10">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-white/10">Prev</button>
                <button disabled={page === pageCount} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState
            icon={Sheet}
            title={range === "Custom" && (!startDate || !endDate) ? "Pick a start and end date" : "No accounts found"}
            description="No delivered accounts match these filters."
          />
        </div>
      )}
    </>
  );
}
