"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ChartSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// One fixed colour per channel so a channel looks the same in every chart and table.
const COLOR: Record<string, string> = {
  "1bill": "#2a78d6", smartpay: "#eb6834", online_other: "#8b5cf6",
  officer: "#2f9e6f", counter: "#d4a017", bank: "#0e9aa7", legacy: "#9ca3af", adjustment: "#e11d48",
};

interface Channel { key: string; label: string; online: boolean; amount: number; count: number; customers: number; avg_payment: number; share: number; on_time: number; late: number; advance: number; on_time_pct: number; avg_days_late: number }
interface Gap { order_id: number; order_ref: string | null; customer: string | null; gateway: number; ledger: number; difference: number }
interface Recon { channel: string; label: string; gateway_amount: number; gateway_count: number; ledger_amount: number; ledger_count: number; difference: number; unlinked_amount: number; unlinked_count: number; gaps: Gap[] }
interface Data {
  startDate: string; endDate: string; total: number; count: number; online_amount: number;
  channels: Channel[]; labels: Record<string, string>;
  trend: ({ month: string; total: number; online: number; online_share: number } & Record<string, number | string>)[];
  byOutlet: ({ outlet: string; total: number } & Record<string, number | string>)[];
  collectors: { id: number; name: string; role: string; amount: number; count: number; channels: Record<string, number> }[];
  reconcile: Recon[];
}

const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`);
const card = "rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark";

/**
 * Channel-wise recovery of customer installments across EVERY channel (1Bill, QR, recovery officer,
 * outlet counter, bank, corrections): how much, how punctual, where, who — plus a check that the
 * installment money the gateways took was really credited to the customers' ledgers.
 */
export default function RecoveryChannels() {
  const [range, setRange] = useState<DateRange>(() => { const s = new Date(); s.setMonth(s.getMonth() - 5, 1); return { from: ymd(s), to: ymd(new Date()) }; });
  const [data, setData] = useState<Data | null>(null);
  const [openGap, setOpenGap] = useState<string | null>(null);

  useEffect(() => {
    if (!range.from || !range.to) return;
    setData(null);
    fetch(`${BACKEND_URL}/api/accounts/online/recovery-channels?startDate=${range.from}&endDate=${range.to}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [range]);

  const keys = data?.channels.map((c) => c.key) || [];
  const trendOptions: ApexOptions | null = data && {
    chart: { type: "bar", stacked: true, toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 3, borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
    colors: keys.map((k) => COLOR[k]),
    dataLabels: { enabled: false },
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    xaxis: { categories: data.trend.map((t) => t.month), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: "#898781", fontSize: "11px" } } },
    yaxis: { labels: { formatter: compact, style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => PKR(v) } },
  };

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-dark dark:text-white">Channel-wise installment recovery</h3>
            <p className="text-xs text-gray-500">Every way customers paid their installments: online and cash, side by side.</p>
          </div>
          <div className="ml-auto"><DateRangeFilter value={range} onChange={setRange} /></div>
        </div>

        {!data ? <ChartSkeleton /> : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[["Recovered (all channels)", PKR(data.total), `${data.count} payments`], ["Online (1Bill + QR)", PKR(data.online_amount), `${data.total ? Math.round((data.online_amount / data.total) * 1000) / 10 : 0}% of recovery`], ["Cash (officer + counter)", PKR(data.channels.filter((c) => c.key === "officer" || c.key === "counter").reduce((s, c) => s + c.amount, 0)), "collected in hand"], ["Other / corrections", PKR(data.channels.filter((c) => ["bank", "legacy", "adjustment"].includes(c.key)).reduce((s, c) => s + c.amount, 0)), "bank, legacy, manual"]].map(([l, v, n]) => (
                <div key={l} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p><p className="text-lg font-black text-dark dark:text-white">{v}</p><p className="text-[11px] text-gray-500">{n}</p></div>
              ))}
            </div>

            <div className="mb-1 flex justify-end">
              <ExportMenu title="Channel-wise recovery" subtitle={`${data.startDate} to ${data.endDate}`} columns={[
                { header: "Channel", value: (c: Channel) => c.label },
                { header: "Amount", value: (c) => c.amount, numeric: true },
                { header: "Share %", value: (c) => c.share, numeric: true },
                { header: "Payments", value: (c) => c.count, numeric: true },
                { header: "Customers", value: (c) => c.customers, numeric: true },
                { header: "Avg payment", value: (c) => c.avg_payment, numeric: true },
                { header: "On time / advance", value: (c) => c.on_time + c.advance, numeric: true },
                { header: "Late", value: (c) => c.late, numeric: true },
                { header: "On-time %", value: (c) => c.on_time_pct, numeric: true },
                { header: "Avg days late", value: (c) => c.avg_days_late, numeric: true },
              ]} getRows={() => data.channels} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-2"><tr><th className="px-3 py-2">Channel</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Share</th><th className="px-3 py-2 text-right">Payments</th><th className="px-3 py-2 text-right">Customers</th><th className="px-3 py-2 text-right">Avg</th><th className="px-3 py-2 text-right">Paid on time</th><th className="px-3 py-2 text-right">Paid late</th><th className="px-3 py-2 text-right">Avg days late</th></tr></thead>
                <tbody>
                  {data.channels.map((c) => (
                    <tr key={c.key} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-3 py-2"><span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: COLOR[c.key] }} /><span className="font-medium text-dark dark:text-white">{c.label}</span>{c.online && <span className="ml-1.5 rounded bg-blue-50 px-1.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10">online</span>}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{PKR(c.amount)}</td>
                      <td className="w-36 px-3 py-2"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full rounded-full" style={{ width: `${c.share}%`, backgroundColor: COLOR[c.key] }} /></div><span className="w-11 text-right text-xs tabular-nums text-gray-500">{c.share}%</span></div></td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.count}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.customers}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{PKR(c.avg_payment)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{PKR(c.on_time + c.advance)}<p className="text-[10px] text-gray-400">{c.on_time_pct}%{c.advance ? ` · advance ${PKR(c.advance)}` : ""}</p></td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-600">{c.late ? PKR(c.late) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{c.avg_days_late ? `${c.avg_days_late} d` : "—"}</td>
                    </tr>
                  ))}
                  {!data.channels.length && <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-500">No installment payments in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {data && (
        <>
          {/* Gateway vs ledger — the money check */}
          <div className={card}>
            <h3 className="text-sm font-bold text-dark dark:text-white">Gateway vs customer ledger check</h3>
            <p className="mb-3 text-xs text-gray-500">Installment money 1Bill / SmartPay say they collected, against what was credited to the customers&apos; ledgers in the same dates. Any difference means a payment was received but not posted (or posted without the gateway receiving it).</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {data.reconcile.map((r) => {
                const ok = Math.abs(r.difference) <= 0.5 && !r.unlinked_count;
                return (
                  <div key={r.channel} className={`rounded-xl border p-3 ${ok ? "border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5" : "border-rose-100 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5"}`}>
                    <div className="mb-2 flex items-center gap-2">{ok ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-rose-600" />}<h4 className="text-sm font-bold text-dark dark:text-white">{r.label}</h4><span className={`ml-auto text-sm font-black tabular-nums ${ok ? "text-emerald-600" : "text-rose-600"}`}>{ok ? "Matches" : `Difference ${PKR(r.difference)}`}</span></div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <p>Gateway collected<br /><b className="text-sm text-dark dark:text-white">{PKR(r.gateway_amount)}</b> · {r.gateway_count}</p>
                      <p>Posted to ledgers<br /><b className="text-sm text-dark dark:text-white">{PKR(r.ledger_amount)}</b> · {r.ledger_count}</p>
                    </div>
                    {r.unlinked_count > 0 && <p className="mt-2 text-xs font-semibold text-rose-600">{r.unlinked_count} gateway payment(s) ({PKR(r.unlinked_amount)}) are not linked to any order.</p>}
                    {r.gaps.length > 0 && (
                      <>
                        <button onClick={() => setOpenGap(openGap === r.channel ? null : r.channel)} className="mt-2 text-xs font-bold text-blue-600 hover:underline">{openGap === r.channel ? "Hide" : "Show"} {r.gaps.length} order(s) that don&apos;t match</button>
                        {openGap === r.channel && (
                          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-100 bg-white dark:border-white/10 dark:bg-boxdark">
                            <table className="w-full text-left text-xs">
                              <thead className="sticky top-0 bg-gray-50 uppercase text-gray-500 dark:bg-dark-2"><tr><th className="px-2 py-1.5">Order</th><th className="px-2 py-1.5 text-right">Gateway</th><th className="px-2 py-1.5 text-right">Ledger</th><th className="px-2 py-1.5 text-right">Diff</th></tr></thead>
                              <tbody>
                                {r.gaps.map((g) => (
                                  <tr key={g.order_id} className="border-t border-slate-100 dark:border-white/5">
                                    <td className="px-2 py-1.5"><Link href={`/accounts/installment-receiving?order=${g.order_id}`} className="font-mono text-blue-600 hover:underline">{g.order_ref || `#${g.order_id}`}</Link><p className="text-gray-400">{g.customer}</p></td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{PKR(g.gateway)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{PKR(g.ledger)}</td>
                                    <td className="px-2 py-1.5 text-right font-bold tabular-nums text-rose-600">{PKR(g.difference)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend */}
          <div className={card}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-dark dark:text-white">Recovery by month and channel</h3>
              <ExportMenu title="Recovery by month and channel" columns={[{ header: "Month", value: (t: Data["trend"][number]) => t.month }, ...keys.map((k) => ({ header: data.labels[k], value: (t: Data["trend"][number]) => Number(t[k] || 0), numeric: true })), { header: "Total", value: (t) => t.total, numeric: true }, { header: "Online %", value: (t) => t.online_share, numeric: true }]} getRows={() => data.trend} />
            </div>
            {trendOptions && <Chart options={trendOptions} series={keys.map((k) => ({ name: data.labels[k], data: data.trend.map((t) => Number(t[k] || 0)) }))} type="bar" height={300} />}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="font-semibold">Online share:</span>
              {data.trend.filter((t) => t.total > 0).map((t) => <span key={t.month} className="rounded-full bg-slate-100 px-2 py-0.5 tabular-nums dark:bg-white/10">{t.month}: <b className="text-dark dark:text-white">{t.online_share}%</b></span>)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Outlet × channel */}
            <div className={card}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-dark dark:text-white">Outlet × channel</h3>
                <ExportMenu title="Recovery outlet by channel" columns={[{ header: "Outlet", value: (o: Data["byOutlet"][number]) => o.outlet }, ...keys.map((k) => ({ header: data.labels[k], value: (o: Data["byOutlet"][number]) => Number(o[k] || 0), numeric: true })), { header: "Total", value: (o) => o.total, numeric: true }]} getRows={() => data.byOutlet} />
              </div>
              <div className="space-y-2.5">
                {data.byOutlet.map((o) => (
                  <div key={o.outlet}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-dark dark:text-white">{o.outlet}</span><span className="font-bold tabular-nums">{PKR(o.total)}</span></div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      {keys.map((k) => Number(o[k] || 0) > 0 && <div key={k} title={`${data.labels[k]}: ${PKR(Number(o[k]))}`} style={{ width: `${(Number(o[k]) / o.total) * 100}%`, backgroundColor: COLOR[k] }} />)}
                    </div>
                  </div>
                ))}
                {!data.byOutlet.length && <p className="text-sm text-gray-500">No data.</p>}
              </div>
            </div>

            {/* Collectors */}
            <div className={card}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-dark dark:text-white">Who collected</h3>
                <ExportMenu title="Recovery by collector" columns={[{ header: "Name", value: (c: Data["collectors"][number]) => c.name }, { header: "Role", value: (c) => c.role }, { header: "Payments", value: (c) => c.count, numeric: true }, { header: "Amount", value: (c) => c.amount, numeric: true }]} getRows={() => data.collectors} />
              </div>
              <p className="mb-2 text-[11px] text-gray-400">Only payments where the collector was recorded.</p>
              <table className="w-full text-left text-sm">
                <tbody>
                  {data.collectors.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 first:border-0 dark:border-white/5">
                      <td className="py-1.5"><p className="font-medium text-dark dark:text-white">{c.name}</p><p className="text-[11px] text-gray-400">{c.role} · {Object.entries(c.channels).map(([k, v]) => `${data.labels[k] || k} ${PKR(v)}`).join(" · ")}</p></td>
                      <td className="py-1.5 text-right text-xs tabular-nums text-gray-500">{c.count}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums">{PKR(c.amount)}</td>
                    </tr>
                  ))}
                  {!data.collectors.length && <tr><td className="py-2 text-gray-500">No collector recorded in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
