"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Search, Wallet, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import { formatExactDate } from "@/utils/dateUtils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface Payment {
  id: number; amount: number; paid_at: string; recorded_at: string; payment_type: string; month_number: number | null;
  method: string; channel: "cash" | "officer" | "online" | "bank";
  order_id: number; order_ref: string; customer: string; phone: string | null; outlet: string;
  collector: { id: number; name: string; username: string; role: string } | null;
  backdated_days: number;
}
interface Totals { count: number; amount: number; byChannel: Record<string, { amount: number; count: number }> }

const CHANNEL_LABEL: Record<string, string> = { cash: "Cash (outlet)", officer: "Recovery officer", online: "Online (1Bill / QR)", bank: "Bank / cheque" };
const CHANNEL_STYLE: Record<string, string> = {
  cash: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  officer: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  online: "bg-blue-50 text-blue-700 dark:bg-blue-500/10",
  bank: "bg-violet-50 text-violet-700 dark:bg-violet-500/10",
};
const sel = "rounded-xl border border-stroke bg-white px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white";

/** Every customer payment as a transaction log — who paid, how much, how, when, and who collected it. */
export default function PaymentActivity({ outlets }: { outlets: { id: number; name: string }[] }) {
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [f, setF] = useState({ channel: "", outletId: "", collectorId: "", paymentType: "" });
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [collectors, setCollectors] = useState<{ id: number; name: string; role: string }[]>([]);
  const [data, setData] = useState<{ rows: Payment[]; totals: Totals; totalPages: number } | null>(null);

  useEffect(() => { const t = setTimeout(() => { setDq(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/audit/collectors`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setCollectors(j.data); }).catch(() => {});
  }, []);

  const params = (p: number, limit: number) => {
    const q = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (dq) q.set("search", dq);
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    if (range.from) q.set("startDate", range.from);
    if (range.to) q.set("endDate", range.to);
    return q;
  };
  useEffect(() => {
    setData(null);
    fetch(`${BACKEND_URL}/api/accounts/audit/payments?${params(page, 25)}`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => { if (j.success) setData({ rows: j.data, totals: j.totals, totalPages: j.pagination.totalPages }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, f, range, page]);

  const setFilter = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(1); };
  const fetchAll = async () => (await (await fetch(`${BACKEND_URL}/api/accounts/audit/payments?${params(1, 5000)}`, { headers: authHeaders() })).json()).data as Payment[];

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total</p><p className="text-lg font-black text-dark dark:text-white">{PKR(data.totals.amount)}</p><p className="text-[11px] text-gray-500">{data.totals.count.toLocaleString()} payment(s)</p></div>
          {(["cash", "officer", "online", "bank"] as const).map((k) => (
            <button key={k} onClick={() => setFilter("channel", f.channel === k ? "" : k)} className={`rounded-2xl border bg-white p-3.5 text-left shadow-sm dark:bg-boxdark ${f.channel === k ? "border-[#ff3d3d] ring-2 ring-[#ff3d3d]/20" : "border-slate-100 dark:border-white/10"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{CHANNEL_LABEL[k]}</p>
              <p className="text-lg font-black text-dark dark:text-white">{PKR(data.totals.byChannel[k]?.amount || 0)}</p>
              <p className="text-[11px] text-gray-500">{data.totals.byChannel[k]?.count || 0} payment(s)</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order no, customer name, phone..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
        <select value={f.channel} onChange={(e) => setFilter("channel", e.target.value)} className={sel}>
          <option value="">All channels</option>
          {Object.entries(CHANNEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={f.paymentType} onChange={(e) => setFilter("paymentType", e.target.value)} className={sel}>
          <option value="">Advance + installments</option><option value="installment">Installments only</option><option value="advance">Advance only</option>
        </select>
        <select value={f.outletId} onChange={(e) => setFilter("outletId", e.target.value)} className={sel}>
          <option value="">All outlets</option>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          <option value="none">No outlet assigned</option>
        </select>
        <select value={f.collectorId} onChange={(e) => setFilter("collectorId", e.target.value)} className={sel}>
          <option value="">Anyone collected</option>
          {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ""}</option>)}
        </select>
        <div className="ml-auto">
          <ExportMenu title="Payment transactions" columns={[
            { header: "Paid on", value: (p: Payment) => formatExactDate(p.paid_at, "DD MMM YYYY, hh:mm A") },
            { header: "Entered on", value: (p) => formatExactDate(p.recorded_at, "DD MMM YYYY, hh:mm A") },
            { header: "Order", value: (p) => p.order_ref },
            { header: "Customer", value: (p) => p.customer },
            { header: "Phone", value: (p) => p.phone || "" },
            { header: "Outlet", value: (p) => p.outlet },
            { header: "Type", value: (p) => (p.payment_type === "advance" ? "Advance" : `Installment ${p.month_number ?? ""}`) },
            { header: "Method", value: (p) => p.method },
            { header: "Collected by", value: (p) => (p.collector ? `${p.collector.name} (${p.collector.role})` : "") },
            { header: "Amount", value: (p) => p.amount, numeric: true },
          ]} getRows={fetchAll} />
        </div>
      </div>
      <DateRangeFilter value={range} onChange={(r) => { setRange(r); setPage(1); }} />

      {!data ? <TableSkeleton /> : data.rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3">Paid on</th><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">For</th><th className="px-4 py-3">How</th><th className="px-4 py-3">Collected by</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id} className="border-t border-slate-50 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatExactDate(p.paid_at, "DD MMM YYYY, hh:mm A")}
                      {p.backdated_days >= 3 && <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600" title={`Entered on ${formatExactDate(p.recorded_at, "DD MMM YYYY, hh:mm A")}`}><AlertTriangle className="size-3" /> entered {p.backdated_days} days later</p>}
                    </td>
                    <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{p.customer}</p><Link href={`/accounts/installment-receiving?order=${p.order_id}`} className="font-mono text-xs text-blue-600 hover:underline">{p.order_ref}</Link>{p.phone && <span className="ml-1 text-xs text-gray-400">· {p.phone}</span>}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.outlet}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{p.payment_type === "advance" ? "Advance" : `Installment ${p.month_number ?? ""}`}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CHANNEL_STYLE[p.channel]}`}>{CHANNEL_LABEL[p.channel]}</span><p className="mt-0.5 max-w-[200px] truncate text-[11px] text-gray-400" title={p.method}>{p.method}</p></td>
                    <td className="px-4 py-3 text-xs">{p.collector ? <><p className="font-medium text-dark dark:text-white">{p.collector.name}</p><p className="text-gray-400">{p.collector.role}</p></> : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-white/5">
            <p className="text-xs text-gray-400">Page {page} of {data.totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:bg-white/10"><ChevronLeft className="size-4" /></button>
              <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:bg-white/10"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Wallet} title="No payments match these filters" /></div>}
    </div>
  );
}
