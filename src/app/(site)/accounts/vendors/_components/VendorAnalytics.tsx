"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { TableSkeleton, ChartSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Categorical slots 1–2 of the validated chart palette (identity: purchased vs paid).
const SERIES = { purchased: "#2a78d6", paid: "#eb6834" };

interface VendorRow { vendor_id: number | null; vendor_name: string; purchased: number; purchased_period: number; paid: number; outstanding: number; overdue: number; returned: number; invoices: number; last_purchase: string | null; return_rate: number; avg_days_to_pay: number | null }
interface Analytics {
  months: number;
  kpis: { vendors: number; purchased_period: number; outstanding: number; overdue: number; top_vendor_share: number; avg_days_to_pay: number | null };
  trend: { month: string; purchased: number; paid: number; returned: number }[];
  vendors: VendorRow[];
  byOutlet: { outlet_id: number; outlet_name: string; purchased: number; outstanding: number }[];
  bySource: { source: string; amount: number }[];
}

const compact = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`);

export default function VendorAnalytics({ onOpenLedger }: { onOpenLedger: (vendorId: number) => void }) {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`${BACKEND_URL}/api/accounts/vendors/analytics?months=${months}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [months]);

  if (!data) return <div className="space-y-4"><ChartSkeleton /><TableSkeleton /></div>;

  const options: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: { bar: { columnWidth: "55%", borderRadius: 4, borderRadiusApplication: "end" } },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    dataLabels: { enabled: false },
    colors: [SERIES.purchased, SERIES.paid],
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    xaxis: { categories: data.trend.map((t) => t.month), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: "#898781", fontSize: "11px" } } },
    yaxis: { labels: { formatter: (v) => compact(v), style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => PKR(v) } },
  };

  const k = data.kpis;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">Period</span>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          {[3, 6, 12, 24].map((m) => (
            <button key={m} onClick={() => setMonths(m)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${months === m ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{m} months</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Purchased (period)", PKR(k.purchased_period)],
          ["Outstanding now", PKR(k.outstanding)],
          ["Overdue now", PKR(k.overdue)],
          ["Active vendors", String(k.vendors)],
          ["Biggest vendor's share", `${k.top_vendor_share}%`],
          ["Avg. days to pay", k.avg_days_to_pay === null ? "—" : `${k.avg_days_to_pay} days`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
            <p className="text-lg font-black text-dark dark:text-white">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <h3 className="mb-2 text-sm font-bold text-dark dark:text-white">Purchases vs payments by month</h3>
        <Chart options={options} series={[{ name: "Purchased", data: data.trend.map((t) => t.purchased) }, { name: "Paid", data: data.trend.map((t) => t.paid) }]} type="bar" height={300} />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/10">
          <h3 className="text-sm font-bold text-dark dark:text-white">Vendor scorecard</h3>
          <ExportMenu title="Vendor Analytics" subtitle={`Last ${months} months`} columns={[
            { header: "Vendor", value: (v: VendorRow) => v.vendor_name },
            { header: "Purchased (period)", value: (v) => v.purchased_period, numeric: true },
            { header: "Purchased (all time)", value: (v) => v.purchased, numeric: true },
            { header: "Paid", value: (v) => v.paid, numeric: true },
            { header: "Outstanding", value: (v) => v.outstanding, numeric: true },
            { header: "Overdue", value: (v) => v.overdue, numeric: true },
            { header: "Returns %", value: (v) => v.return_rate, numeric: true },
            { header: "Avg days to pay", value: (v) => v.avg_days_to_pay ?? "", numeric: true },
            { header: "Invoices", value: (v) => v.invoices, numeric: true },
            { header: "Last purchase", value: (v) => (v.last_purchase ? new Date(v.last_purchase).toLocaleDateString() : "") },
          ]} getRows={() => data.vendors} />
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-2.5">Vendor</th><th className="px-4 py-2.5 text-right">Purchased (period)</th><th className="px-4 py-2.5 text-right">Paid</th><th className="px-4 py-2.5 text-right">Outstanding</th><th className="px-4 py-2.5 text-right">Overdue</th><th className="px-4 py-2.5 text-right">Returns</th><th className="px-4 py-2.5 text-right">Avg days to pay</th><th className="px-4 py-2.5">Last purchase</th></tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={`${v.vendor_id}-${v.vendor_name}`} className="border-t border-slate-50 dark:border-white/5">
                  <td className="px-4 py-2.5 font-medium text-dark dark:text-white">
                    {v.vendor_id ? <button onClick={() => onOpenLedger(v.vendor_id!)} className="hover:text-[#ff3d3d] hover:underline">{v.vendor_name}</button> : v.vendor_name}
                    <p className="text-xs font-normal text-gray-400">{v.invoices} invoice(s)</p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{PKR(v.purchased_period)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(v.paid)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-orange-600">{PKR(v.outstanding)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{v.overdue > 0 ? <span className="font-semibold text-rose-600">{PKR(v.overdue)}</span> : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{v.return_rate}%</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{v.avg_days_to_pay ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{v.last_purchase ? new Date(v.last_purchase).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">Purchases by outlet (period)</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] uppercase text-gray-400"><tr><th className="py-1.5">Outlet</th><th className="py-1.5 text-right">Purchased</th><th className="py-1.5 text-right">Still owed</th></tr></thead>
            <tbody>{data.byOutlet.map((o) => <tr key={o.outlet_id} className="border-t border-slate-100 dark:border-white/5"><td className="py-2">{o.outlet_name}</td><td className="py-2 text-right tabular-nums">{PKR(o.purchased)}</td><td className="py-2 text-right tabular-nums text-orange-600">{PKR(o.outstanding)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">How vendors were paid (period)</h3>
          <table className="w-full text-left text-sm">
            <tbody>{data.bySource.map((s) => <tr key={s.source} className="border-t border-slate-100 first:border-0 dark:border-white/5"><td className="py-2">{s.source}</td><td className="py-2 text-right font-semibold tabular-nums">{PKR(s.amount)}</td></tr>)}</tbody>
          </table>
          {!data.bySource.length && <p className="text-sm text-gray-500">No vendor payments in this period.</p>}
        </div>
      </div>
    </div>
  );
}
