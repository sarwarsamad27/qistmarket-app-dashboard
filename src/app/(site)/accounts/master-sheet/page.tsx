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
import { LEGACY_COLUMNS, LEGACY_DATE_COLUMNS, LEGACY_HEADERS } from "@/lib/legacySheetColumns";

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
// (the import reads by position and ignores anything past its last column).
const SUMMARY_COLUMNS: { key: keyof MasterRow; header: string; date?: boolean }[] = [
  { key: "order_ref", header: "Order Ref" },
  { key: "account_branch", header: "Account Branch" },
  { key: "source", header: "Source" },
  { key: "account_status", header: "Account Status" },
  { key: "months_paid", header: "Installments Paid" },
  { key: "total_paid", header: "Total Paid (incl. Advance)" },
  { key: "overdue_months", header: "Overdue Installments" },
  { key: "overdue_amount", header: "Overdue Amount" },
  { key: "next_due_date", header: "Next Due Date", date: true },
  { key: "next_due_amount", header: "Next Due Amount" },
  { key: "qr_id", header: "QR ID" },
];

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

  const handleDownload = () => {
    if (!rows.length) return toast.error("Nothing to download for these filters");
    const headers = [...LEGACY_HEADERS, ...(includeSummary ? SUMMARY_COLUMNS.map((c) => c.header) : [])];
    const body = rows.map((r) => [
      ...LEGACY_COLUMNS.map((col) => (LEGACY_DATE_COLUMNS.includes(col) ? ddmmyyyy(r[col]) : r[col] ?? "")),
      ...(includeSummary ? SUMMARY_COLUMNS.map((c) => (c.date ? ddmmyyyy(r[c.key]) : r[c.key] ?? "")) : []),
    ]);
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
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Purchase date</span>
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
            Preview of the key columns — the download has all {LEGACY_COLUMNS.length} Legacy Import columns
            (purchaser, both guarantors, next of kin, officers, timeline){includeSummary ? ` plus ${SUMMARY_COLUMNS.length} account summary columns` : ""}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3 font-bold">#</th>
                  <th className="px-3 py-3 font-bold">Date</th>
                  <th className="px-3 py-3 font-bold">1Bill ID</th>
                  <th className="px-3 py-3 font-bold">Customer</th>
                  <th className="px-3 py-3 font-bold">CNIC</th>
                  <th className="px-3 py-3 font-bold">Item</th>
                  <th className="px-3 py-3 text-right font-bold">Price</th>
                  <th className="px-3 py-3 text-right font-bold">Advance</th>
                  <th className="px-3 py-3 text-right font-bold">Installment</th>
                  <th className="px-3 py-3 font-bold">Tenure</th>
                  <th className="px-3 py-3 text-right font-bold">Remain</th>
                  <th className="px-3 py-3 font-bold">Branch</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.order_id} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-3 py-3 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{ddmmyyyy(r.order_date)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">{r.bill_id || "—"}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-dark dark:text-white">{r.purchaser_name}</p>
                      <p className="text-xs text-gray-500">{r.purchaser_phone}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{r.purchaser_cnic || "—"}</td>
                    <td className="max-w-[200px] px-3 py-3 text-gray-700 dark:text-gray-200">
                      <p className="truncate" title={r.item_model}>{r.item_model}</p>
                      <p className="text-xs text-gray-400">{r.category || "—"}{r.source === "Legacy Import" ? " · Legacy" : ""}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{PKR(r.item_price)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{PKR(r.advance)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{PKR(r.installment)}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{r.months_paid}/{r.tenure_months}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(r.remain)}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{r.account_branch || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[r.account_status]}`}>{r.account_status}</span>
                    </td>
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
