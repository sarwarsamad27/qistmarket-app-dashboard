"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { Activity, Wallet, Wifi, Grid3x3, TrendingUp } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { ChartSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import DateRangeFilter, { type DateRange } from "@/components/Accounts/DateRangeFilter";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface FlowData {
  trend: { date: string; cash: number; online: number; total: number }[];
  channelSplit: { cash: number; online: number; other: number; total: number };
  heatmap: { outlet_name: string; days: number[] }[];
}
interface ChannelRecovery {
  totalDue: number;
  totalRecovered: number;
  overallRecoveryPercentage: number;
  byChannel: { channel: string; amount: number; percentageOfDue: number }[];
}

const RANGES = ["Week", "Month", "Quarter", "Year"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InstallmentFlowPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("Month");
  // A picked From–To overrides the preset buttons (sent as range=Custom).
  const [custom, setCustom] = useState<DateRange>({ from: "", to: "" });
  const isCustom = !!(custom.from || custom.to);
  const rq = isCustom ? `range=Custom&startDate=${custom.from}&endDate=${custom.to}` : `range=${range}`;
  const [flow, setFlow] = useState<FlowData | null>(null);
  const [channel, setChannel] = useState<ChannelRecovery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BACKEND_URL}/api/accounts/installment-flow?${rq}`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/accounts/recovery-analytics/channel-wise?${rq}`, { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([flowJson, channelJson]) => {
        if (flowJson.success) setFlow(flowJson.data);
        if (channelJson.success) setChannel(channelJson.data);
      })
      .catch((err) => console.error("Failed to load installment flow analytics:", err))
      .finally(() => setLoading(false));
  }, [rq]);

  const trendOptions: ApexOptions = {
    chart: { type: "line", toolbar: { show: false }, fontFamily: "inherit" },
    stroke: { curve: "smooth", width: 2 },
    colors: ["#1baf7a", "#2a78d6"],
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px" },
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    xaxis: { categories: flow?.trend.map((t) => t.date) || [], labels: { style: { colors: "#898781", fontSize: "10px" } } },
    yaxis: { labels: { formatter: (v) => PKR(v), style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { shared: true, y: { formatter: (v) => PKR(v) } },
    dataLabels: { enabled: false },
  };

  const heatmapOptions: ApexOptions = {
    chart: { type: "heatmap", toolbar: { show: false }, fontFamily: "inherit" },
    dataLabels: { enabled: false },
    colors: ["#1baf7a"],
    plotOptions: { heatmap: { colorScale: { ranges: [{ from: 0, to: 0, color: "#f0efec", name: "none" }] } } },
    xaxis: { categories: WEEKDAYS, labels: { style: { colors: "#898781", fontSize: "11px" } } },
    yaxis: { labels: { style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { y: { formatter: (v) => PKR(v) } },
  };
  const heatmapSeries = (flow?.heatmap || []).map((h) => ({ name: h.outlet_name, data: h.days.map((v, i) => ({ x: WEEKDAYS[i], y: v })) }));

  return (
    <>
      <Breadcrumb pageName="Installment Flow Analytics" />
      <PageHeader
        icon={Activity}
        title="Installment Flow Analytics"
        subtitle="Collection trends, cash vs. online, and recovery heatmaps."
        actions={
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
            {RANGES.map((r) => (
              <button key={r} onClick={() => { setRange(r); setCustom({ from: "", to: "" }); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${!isCustom && range === r ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{r}</button>
            ))}
          </div>
        }
      />
      <div className="mb-4">
        <DateRangeFilter value={custom} onChange={setCustom} presets={false} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-transparent">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600"><Wallet className="size-5" strokeWidth={2.25} /></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/80">Cash Collected</p><p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{PKR(flow?.channelSplit.cash || 0)}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-transparent">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600"><Wifi className="size-5" strokeWidth={2.25} /></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600/80">Online Collected</p><p className="text-xl font-black text-blue-700 dark:text-blue-400">{PKR(flow?.channelSplit.online || 0)}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 dark:border-indigo-500/20 dark:from-indigo-500/10 dark:to-transparent">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-600"><TrendingUp className="size-5" strokeWidth={2.25} /></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-indigo-600/80">Overall Recovery</p><p className="text-xl font-black text-indigo-700 dark:text-indigo-400">{channel?.overallRecoveryPercentage ?? 0}%</p></div>
        </div>
      </div>

      {loading ? (
        <div className="mb-6"><ChartSkeleton /></div>
      ) : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">Collection Trend — Cash vs. Online</h2>
          {flow && flow.trend.length > 0 ? (
            <Chart options={trendOptions} series={[{ name: "Cash", data: flow.trend.map((t) => t.cash) }, { name: "Online", data: flow.trend.map((t) => t.online) }]} type="line" height={300} />
          ) : (
            <EmptyState icon={Activity} title="No collections in this period" />
          )}
        </div>
      )}

      {loading ? (
        <div className="mb-6"><ChartSkeleton /></div>
      ) : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="mb-4 flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10"><Grid3x3 className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Recovery Heatmap — Outlet × Day of Week</h2></div>
          {heatmapSeries.length > 0 ? (
            <Chart options={heatmapOptions} series={heatmapSeries} type="heatmap" height={Math.max(200, heatmapSeries.length * 40)} />
          ) : (
            <EmptyState icon={Grid3x3} title="No collection data to map yet" />
          )}
        </div>
      )}

      {!loading && channel && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">Recovery by Payment Channel</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {channel.byChannel.map((c) => (
              <div key={c.channel} className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{c.channel}</p>
                <p className="mt-1 text-lg font-black text-dark dark:text-white">{PKR(c.amount)}</p>
                <p className="text-xs text-gray-400">{c.percentageOfDue}% of total due</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
