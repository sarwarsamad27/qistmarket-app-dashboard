"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Search, HandCoins } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Row { id: number; paid_at: string; order_id: number; order_ref: string; customer_name: string; outlet_name: string; month: number | null; amount: number; method: string; channel: string; collected_by: string; collector_role: string | null; at_head_office: boolean }
interface Totals { count: number; amount: number; cash: number; online: number; bank: number; other: number }

const CHANNEL_STYLE: Record<string, string> = {
  cash: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  online: "bg-blue-50 text-blue-700 dark:bg-blue-500/10",
  bank: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10",
  other: "bg-gray-100 text-gray-600 dark:bg-white/10",
};

/** Every installment payment received in a period — cash, online, bank — with who took it. */
export default function CollectionsPanel({ refreshKey }: { refreshKey: number }) {
  const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [range, setRange] = useState<DateRange>(() => { const d = new Date(); d.setDate(d.getDate() - 29); return { from: ymd(d), to: ymd(new Date()) }; });
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { const t = setTimeout(() => setDq(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ ...(range.from && { startDate: range.from }), ...(range.to && { endDate: range.to }), ...(channel && { channel }), ...(dq.trim() && { search: dq.trim() }) });
    fetch(`${BACKEND_URL}/api/accounts/installments/collections?${qs}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) { setRows(j.data); setTotals(j.totals); } })
      .finally(() => setLoading(false));
  }, [range, channel, dq, refreshKey]);

  return (
    <div className="space-y-4">
      {totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["Total received", totals.amount, ""], ["Cash", totals.cash, "cash"], ["Online (1Bill / QR)", totals.online, "online"], ["Bank transfer", totals.bank, "bank"], ["Other", totals.other, "other"]].map(([l, v, k]) => (
            <button key={l as string} onClick={() => setChannel(channel === k ? "" : (k as string))} className={`rounded-2xl border bg-white p-3.5 text-left shadow-sm dark:bg-boxdark ${channel === k && k ? "border-[#ff3d3d] ring-2 ring-[#ff3d3d]/20" : "border-slate-100 dark:border-white/10"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
              <p className="text-lg font-black text-dark dark:text-white">{PKR(v as number)}</p>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, order, collector..." className="w-full rounded-xl border border-stroke bg-white py-2 pl-9 pr-3 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
        <div className="ml-auto">
          <ExportMenu title="Installment Collections" subtitle={`${range.from || "…"} to ${range.to || "…"}`} columns={[
            { header: "#", value: (_: Row, i) => i + 1 },
            { header: "Date", value: (r) => new Date(r.paid_at).toLocaleString() },
            { header: "Order", value: (r) => r.order_ref },
            { header: "Customer", value: (r) => r.customer_name },
            { header: "Outlet", value: (r) => r.outlet_name },
            { header: "Month", value: (r) => r.month ?? "" },
            { header: "Channel", value: (r) => r.channel },
            { header: "Method", value: (r) => r.method },
            { header: "Collected by", value: (r) => r.collected_by },
            { header: "Amount", value: (r) => r.amount, numeric: true },
          ]} getRows={() => rows} />
        </div>
      </div>
      {loading ? <TableSkeleton /> : rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Month</th><th className="px-4 py-3">Channel / Method</th><th className="px-4 py-3">Collected By</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{new Date(r.paid_at).toLocaleString()}</td>
                    <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{r.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{r.order_ref}</p></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.outlet_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.month ?? "—"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${CHANNEL_STYLE[r.channel] || CHANNEL_STYLE.other}`}>{r.channel}</span><p className="mt-0.5 text-[11px] text-gray-400">{r.method}</p></td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{r.collected_by}{r.collector_role && <p className="text-gray-400">{r.collector_role}</p>}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">{PKR(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={HandCoins} title="No installment payments in this period" /></div>}
    </div>
  );
}
