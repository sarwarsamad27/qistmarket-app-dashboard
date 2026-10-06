"use client";

import { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Search, RefreshCw, Radio, Wifi } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export interface OnlineTxn {
  channel: "1bill" | "smartpay"; log_id: number; gateway_txn_id: string; consumer_number: string; amount: number; date: string; bank: string | null;
  status: "paid" | "failed" | "duplicate"; gateway_status: string; purpose: string; payer: string; phone: string | null;
  order_id?: number | null; order_ref?: string | null; outlet_name: string; reference?: string | null;
  settlement: { batch_id: number; batch_no: string; batch_status: string; item_status: string } | null;
}
interface Data {
  kpis: { total_amount: number; total_count: number; today_amount: number; today_count: number; success_rate: number; failed: number; duplicate: number; unsettled_amount: number };
  byChannel: Record<string, { label: string; count: number; paid_count: number; paid_amount: number; failed: number; duplicate: number; unsettled: number }>;
  purposes: Record<string, string>;
  outlets: { id: number; name: string }[];
  transactions: OnlineTxn[];
  server_time: string;
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
  duplicate: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
};
const CHANNEL_STYLE: Record<string, string> = { "1bill": "bg-blue-50 text-blue-700 dark:bg-blue-500/10", smartpay: "bg-violet-50 text-violet-700 dark:bg-violet-500/10" };

/** Every 1Bill / SmartPay payment as it arrives — refreshes itself every 30 seconds while "Live" is on. */
export default function LiveTransactions() {
  const [range, setRange] = useState<DateRange>({ from: ymd(new Date()), to: ymd(new Date()) });
  const [f, setF] = useState({ channel: "", status: "", purpose: "", settlement: "", outletId: "" });
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDq(search), 400); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ ...(range.from && { startDate: range.from }), ...(range.to && { endDate: range.to }), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...(dq.trim() && { search: dq.trim() }) });
    fetch(`${BACKEND_URL}/api/accounts/online/transactions?${qs}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, [range, f, dq]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [live, load]);

  const sel = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white";
  const k = data?.kpis;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Received (range)", k ? PKR(k.total_amount) : "…", k ? `${k.total_count} payment(s)` : ""],
          ["Today", k ? PKR(k.today_amount) : "…", k ? `${k.today_count} payment(s)` : ""],
          ["1Bill", data ? PKR(data.byChannel["1bill"].paid_amount) : "…", data ? `${data.byChannel["1bill"].paid_count} paid` : ""],
          ["SmartPay QR", data ? PKR(data.byChannel.smartpay.paid_amount) : "…", data ? `${data.byChannel.smartpay.paid_count} paid` : ""],
          ["Success rate", k ? `${k.success_rate}%` : "…", k ? `${k.failed} failed · ${k.duplicate} duplicate` : ""],
          ["Not yet settled", k ? PKR(k.unsettled_amount) : "…", "awaiting bank settlement"],
        ].map(([l, v, n]) => (
          <div key={l} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
            <p className="text-xl font-black text-dark dark:text-white">{v}</p>
            <p className="text-[11px] text-gray-500">{n}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setLive(!live)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${live ? "bg-emerald-600 text-white" : "border border-stroke text-gray-600 dark:border-dark-3 dark:text-gray-300"}`}>
          <Radio className={`size-4 ${live ? "animate-pulse" : ""}`} /> {live ? "Live" : "Paused"}
        </button>
        <button onClick={load} className="rounded-xl border border-stroke p-2 text-gray-500 hover:text-[#ff3d3d] dark:border-dark-3" title="Refresh now"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
        {data && <span className="text-xs text-gray-400">Updated {new Date(data.server_time).toLocaleTimeString()}</span>}
        <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} className={sel}><option value="">1Bill + QR</option><option value="1bill">1Bill</option><option value="smartpay">SmartPay QR</option></select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={sel}><option value="">Any status</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="duplicate">Duplicate</option></select>
        <select value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} className={sel}>
          <option value="">Any purpose</option>
          {Object.entries(data?.purposes || {}).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={f.outletId} onChange={(e) => setF({ ...f, outletId: e.target.value })} className={sel}>
          <option value="">All outlets</option>
          {(data?.outlets || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={f.settlement} onChange={(e) => setF({ ...f, settlement: e.target.value })} className={sel}><option value="">Any settlement</option><option value="unbatched">Not in a batch</option><option value="batched">In a batch (unsettled)</option><option value="settled">Settled</option></select>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Txn ID, consumer no, customer, phone, order..." className={`${sel} w-full pl-9`} />
        </div>
        <div className="ml-auto">
          <ExportMenu title="Online Payments" subtitle={`${range.from || "…"} to ${range.to || "…"}`} columns={[
            { header: "Date / time", value: (t: OnlineTxn) => new Date(t.date).toLocaleString() },
            { header: "Channel", value: (t) => (t.channel === "1bill" ? "1Bill" : "SmartPay QR") },
            { header: "Gateway Txn ID", value: (t) => t.gateway_txn_id },
            { header: "Consumer no", value: (t) => t.consumer_number },
            { header: "Paid by", value: (t) => t.payer },
            { header: "Phone", value: (t) => t.phone || "" },
            { header: "Purpose", value: (t) => data?.purposes[t.purpose] || t.purpose },
            { header: "Order", value: (t) => t.order_ref || t.reference || "" },
            { header: "Outlet", value: (t) => t.outlet_name },
            { header: "Bank", value: (t) => t.bank || "" },
            { header: "Status", value: (t) => t.status },
            { header: "Settlement", value: (t) => (t.settlement ? `${t.settlement.batch_no} (${t.settlement.batch_status})` : "") },
            { header: "Amount", value: (t) => t.amount, numeric: true },
          ]} getRows={() => data?.transactions || []} />
        </div>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />

      {!data ? <TableSkeleton /> : data.transactions.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Channel / Txn ID</th><th className="px-4 py-3">Paid By</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Settlement</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {data.transactions.map((t, i) => (
                  <tr key={`${t.channel}-${t.log_id}`} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{new Date(t.date).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${CHANNEL_STYLE[t.channel]}`}>{t.channel === "1bill" ? "1Bill" : "QR"}</span><p className="mt-0.5 font-mono text-[11px] text-gray-500">{t.gateway_txn_id}</p>{t.bank && <p className="text-[10px] text-gray-400">{t.bank}</p>}</td>
                    <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{t.payer}</p><p className="font-mono text-[11px] text-gray-400">{t.consumer_number}{t.phone ? ` · ${t.phone}` : ""}</p></td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{data.purposes[t.purpose] || t.purpose}{t.order_ref && <p>{t.order_id ? <Link href={`/accounts/installment-receiving?order=${t.order_id}`} className="font-mono text-blue-600 hover:underline">{t.order_ref}</Link> : t.order_ref}</p>}{t.reference && <p className="font-mono text-gray-400">{t.reference}</p>}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.outlet_name}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[t.status]}`}>{t.status}</span><p className="mt-0.5 text-[10px] text-gray-400">{t.gateway_status}</p></td>
                    <td className="px-4 py-3 text-xs">{t.settlement ? <><span className="font-mono">{t.settlement.batch_no}</span><p className={t.settlement.batch_status === "settled" ? "font-semibold text-emerald-600" : "text-amber-600"}>{t.settlement.batch_status}</p></> : t.status === "paid" ? <span className="text-gray-400">not batched</span> : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Wifi} title="No online payments in this selection" /></div>}
    </div>
  );
}
