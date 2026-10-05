"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { ChartSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
// Validated categorical slots 1–2: 1Bill, SmartPay QR.
const COLORS = { "1bill": "#2a78d6", smartpay: "#eb6834" };

interface Group { key: string; amount: number; count: number }
interface Analytics {
  months: number;
  totals: { amount: number; count: number; attempts: number };
  channels: { channel: "1bill" | "smartpay"; label: string; amount: number; count: number; share: number; avg_payment: number; success_rate: number; failed: number; duplicate: number; unsettled: number }[];
  trend: { month: string; "1bill": number; smartpay: number; count: number }[];
  byPurpose: Group[]; byBank: Group[]; byOutlet: Group[];
  settlement: { avg_days_to_settle: number | null; total_charges: number; total_difference: number; batches_settled: number };
}

const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`);

/** Channel-wise recovery: how much comes through 1Bill vs QR, how reliably, through which banks, for what. */
export default function OnlineAnalytics() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`${BACKEND_URL}/api/accounts/online/analytics?months=${months}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [months]);

  if (!data) return <ChartSkeleton />;
  const options: ApexOptions = {
    chart: { type: "bar", stacked: true, toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: { bar: { columnWidth: "50%", borderRadius: 4, borderRadiusApplication: "end" } },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    colors: [COLORS["1bill"], COLORS.smartpay],
    dataLabels: { enabled: false },
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    xaxis: { categories: data.trend.map((t) => t.month), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: "#898781", fontSize: "11px" } } },
    yaxis: { labels: { formatter: compact, style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => PKR(v) } },
  };

  const GroupTable = ({ title, rows }: { title: string; rows: Group[] }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold text-dark dark:text-white">{title}</h4>
        <ExportMenu title={`Online payments ${title}`} columns={[{ header: title, value: (g: Group) => g.key }, { header: "Payments", value: (g) => g.count, numeric: true }, { header: "Amount", value: (g) => g.amount, numeric: true }]} getRows={() => rows} />
      </div>
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((g) => (
            <tr key={g.key} className="border-t border-slate-100 first:border-0 dark:border-white/5">
              <td className="py-1.5">{g.key}</td>
              <td className="py-1.5 text-right text-xs tabular-nums text-gray-500">{g.count}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{PKR(g.amount)}</td>
              <td className="w-24 py-1.5 pl-3"><div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${data.totals.amount ? (g.amount / data.totals.amount) * 100 : 0}%` }} /></div></td>
            </tr>
          ))}
          {!rows.length && <tr><td className="py-2 text-gray-500">No data.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">Period</span>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          {[1, 3, 6, 12].map((m) => <button key={m} onClick={() => setMonths(m)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${months === m ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{m === 1 ? "This month" : `${m} months`}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.channels.map((c) => (
          <div key={c.channel} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="mb-2 flex items-center gap-2"><span className="size-3 rounded-full" style={{ backgroundColor: COLORS[c.channel] }} /><h4 className="text-sm font-bold text-dark dark:text-white">{c.label}</h4><span className="ml-auto text-xs text-gray-500">{c.share}% of online</span></div>
            <p className="text-2xl font-black text-dark dark:text-white">{PKR(c.amount)}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
              <p>{c.count} payments<br /><b className="text-dark dark:text-white">avg {PKR(c.avg_payment)}</b></p>
              <p>success {c.success_rate}%<br /><b className="text-dark dark:text-white">{c.failed} failed · {c.duplicate} dup</b></p>
              <p>unsettled<br /><b className="text-rose-600">{PKR(c.unsettled)}</b></p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-dark dark:text-white">Online collections by month and channel</h3>
          <ExportMenu title="Online collections by month" columns={[{ header: "Month", value: (t: Analytics["trend"][number]) => t.month }, { header: "1Bill", value: (t) => t["1bill"], numeric: true }, { header: "SmartPay QR", value: (t) => t.smartpay, numeric: true }, { header: "Payments", value: (t) => t.count, numeric: true }]} getRows={() => data.trend} />
        </div>
        <Chart options={options} series={[{ name: "1Bill", data: data.trend.map((t) => t["1bill"]) }, { name: "SmartPay QR", data: data.trend.map((t) => t.smartpay) }]} type="bar" height={300} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GroupTable title="What it was for" rows={data.byPurpose} />
        <GroupTable title="Bank / channel used" rows={data.byBank} />
        <GroupTable title="By outlet" rows={data.byOutlet} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Batches settled", String(data.settlement.batches_settled)], ["Avg days to settle", data.settlement.avg_days_to_settle === null ? "—" : `${data.settlement.avg_days_to_settle} days`], ["Gateway charges", PKR(data.settlement.total_charges)], ["Unexplained difference", PKR(data.settlement.total_difference)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p><p className="text-lg font-black text-dark dark:text-white">{v}</p></div>
        ))}
      </div>
    </div>
  );
}
