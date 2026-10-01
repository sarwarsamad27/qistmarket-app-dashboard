"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { ReceiptText, Download, Search, Wallet, Store, QrCode, Receipt, Loader2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const TZ = "Asia/Karachi";
const PAGE_SIZE = 50;

interface PaymentRow {
  order_id: number;
  order_ref: string;
  received_at: string;
  customer_name: string;
  customer_phone: string;
  item: string;
  imei: string | null;
  amount: number;
  payment_type: "installment" | "advance";
  month: number;
  account_branch: string | null;
  channel: "branch" | "qr" | "1bill";
  method: string;
  collected_by: string | null;
  system_txn_id: string;
  provider_txn_id: string | null;
  payment_status: "Partial" | "Full";
  installment_amount: number;
  due_date: string | null;
  purchase_date: string;
  bill_or_qr_id: string | null;
}

interface ReportData {
  summary: { count: number; total: number; branch: number; qr: number; oneBill: number; partialCount: number; fullCount: number };
  outlets: { id: number; name: string; code: string }[];
  rows: PaymentRow[];
}

const RANGES = ["Day", "Week", "Month", "Quarter", "Year", "Custom"] as const;

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-PK", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: TZ }) : "");

const CHANNEL_STYLE: Record<string, string> = {
  branch: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
  qr: "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300",
  "1bill": "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
};

const selectCls = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-dark focus:border-[#ff3d3d] focus:outline-none dark:border-white/10 dark:bg-dark-2 dark:text-white";

export default function DailyPaymentsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("Day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [outletId, setOutletId] = useState("all");
  const [receivedAt, setReceivedAt] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentType, setPaymentType] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) return;
    if (range === "Custom" && (!startDate || !endDate)) { setData(null); return; }

    const params = new URLSearchParams({ range, outlet_id: outletId, receivedAt, paymentStatus, paymentType });
    if (range === "Custom") { params.set("startDate", startDate); params.set("endDate", endDate); }
    if (search) params.set("search", search);

    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/payments-report?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) { setData(json.data); setPage(1); }
        else toast.error(json.message || "Failed to load payments");
      })
      .catch((err) => { console.error("Failed to load payments report:", err); toast.error("Failed to load payments"); })
      .finally(() => setLoading(false));
  }, [range, startDate, endDate, outletId, receivedAt, paymentStatus, paymentType, search]);

  const rows = useMemo(() => data?.rows || [], [data]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const periodLabel = range === "Custom" ? `${startDate}_to_${endDate}` : `${range}_${new Date().toLocaleDateString("en-CA", { timeZone: TZ })}`;

  const handleDownload = () => {
    if (!rows.length) return toast.error("Nothing to download for these filters");
    const headers = [
      "S.No", "Received Date & Time", "Customer Name", "Customer Number", "Item", "IMEI / Serial", "Amount",
      "Account Branch", "Method / Received At", "Collected By", "System Transaction ID", "1Bill / QR Transaction ID",
      "Partial / Fully Paid", "Payment For", "Installment Amount", "Installment Due Date", "Date of Purchase", "1Bill ID / QR ID", "Order Ref",
    ];
    const body = rows.map((r, i) => [
      i + 1, fmtDateTime(r.received_at), r.customer_name, r.customer_phone, r.item, r.imei || "", r.amount,
      r.account_branch || "", r.method, r.collected_by || "", r.system_txn_id, r.provider_txn_id || "",
      r.payment_status === "Full" ? "Fully Paid" : "Partial", r.payment_type === "advance" ? "Advance" : `Month ${r.month}`,
      r.installment_amount, fmtDate(r.due_date), fmtDate(r.purchase_date), r.bill_or_qr_id || "", r.order_ref,
    ]);
    const totalRow = ["", "", "", "", "", "TOTAL", rows.reduce((s, r) => s + r.amount, 0)];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body, [], totalRow]);
    ws["!cols"] = [6, 22, 24, 14, 30, 18, 12, 20, 34, 18, 24, 20, 14, 12, 14, 14, 14, 20, 22].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Payments");
    XLSX.writeFile(wb, `daily_payments_${periodLabel}.xlsx`);
  };

  return (
    <>
      <Breadcrumb pageName="Daily Payments" />
      <PageHeader
        icon={ReceiptText}
        title="Daily Payments"
        subtitle="Every payment received — branch, recovery officer, QR and 1Bill — in one place."
        actions={
          <button
            onClick={handleDownload}
            disabled={loading || !rows.length}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download Excel
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${range === r ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
              >
                {r === "Day" ? "Today" : r}
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
          <div className="relative lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, phone, txn ID, order…"
              className={`${selectCls} w-full pl-9`}
            />
          </div>
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={selectCls} title="Branch the account belongs to">
            <option value="all">All account branches</option>
            {data?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
          </select>
          <select value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={selectCls} title="Where / how the payment was received">
            <option value="all">All methods</option>
            <option value="online">Online (QR + 1Bill)</option>
            <option value="qr">Online — QR</option>
            <option value="1bill">Online — 1Bill</option>
            <option value="branch">Any branch / recovery</option>
            {data?.outlets.map((o) => <option key={o.id} value={o.id}>Received at {o.name}</option>)}
          </select>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={selectCls}>
            <option value="all">Partial + Fully paid</option>
            <option value="Full">Fully paid only</option>
            <option value="Partial">Partial only</option>
          </select>
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className={selectCls}>
            <option value="all">Installments + Advance</option>
            <option value="installment">Installments only</option>
            <option value="advance">Advance only</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={Wallet} label={`Total received · ${data?.summary.count ?? 0} payments`} value={PKR(data?.summary.total || 0)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
            <StatCard icon={Store} label="Branch / Recovery" value={PKR(data?.summary.branch || 0)} accent="text-slate-600" bg="bg-slate-100 dark:bg-white/10" bar="bg-slate-500" />
            <StatCard icon={QrCode} label="Online — QR" value={PKR(data?.summary.qr || 0)} accent="text-teal-600" bg="bg-teal-50 dark:bg-teal-500/10" bar="bg-teal-500" />
            <StatCard icon={Receipt} label="Online — 1Bill" value={PKR(data?.summary.oneBill || 0)} accent="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-500/10" bar="bg-indigo-500" />
          </>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3 font-bold">S.No</th>
                  <th className="px-3 py-3 font-bold">Received</th>
                  <th className="px-3 py-3 font-bold">Customer</th>
                  <th className="px-3 py-3 font-bold">Item</th>
                  <th className="px-3 py-3 text-right font-bold">Amount</th>
                  <th className="px-3 py-3 font-bold">Account Branch</th>
                  <th className="px-3 py-3 font-bold">Method</th>
                  <th className="px-3 py-3 font-bold">Transaction ID</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Due Date</th>
                  <th className="px-3 py-3 font-bold">Purchased</th>
                  <th className="px-3 py-3 font-bold">1Bill / QR ID</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={`${r.system_txn_id}-${i}`} className="border-t border-slate-50 align-top transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-3 py-3 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{fmtDateTime(r.received_at)}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-dark dark:text-white">{r.customer_name}</p>
                      <p className="text-xs text-gray-500">{r.customer_phone}</p>
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-gray-700 dark:text-gray-200">
                      <p className="truncate" title={r.item}>{r.item}</p>
                      <p className="text-xs text-gray-400">{r.payment_type === "advance" ? "Advance" : `Month ${r.month}`} · {r.order_ref}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(r.amount)}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{r.account_branch || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${CHANNEL_STYLE[r.channel]}`}>{r.method}</span>
                      {r.collected_by && <p className="mt-1 text-xs text-gray-400">by {r.collected_by}</p>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      <p className="text-gray-700 dark:text-gray-200" title="System transaction ID">{r.system_txn_id}</p>
                      {r.provider_txn_id && <p className="text-gray-400" title={r.channel === "qr" ? "QR transaction ID" : "1Bill transaction ID"}>{r.channel === "qr" ? "QR" : "1Bill"}: {r.provider_txn_id}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${r.payment_status === "Full" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"}`}>
                        {r.payment_status === "Full" ? "Fully Paid" : "Partial"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{fmtDate(r.due_date) || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-300">{fmtDate(r.purchase_date)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">{r.bill_or_qr_id || "—"}</td>
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
            icon={ReceiptText}
            title={range === "Custom" && (!startDate || !endDate) ? "Pick a start and end date" : "No payments received"}
            description="No payments match these filters for the selected period."
          />
        </div>
      )}
    </>
  );
}
