"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { Wifi, QrCode, Receipt, CheckCircle2, XCircle, Copy, Wallet } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, TableSkeleton, ChartSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface ChannelSummary {
  total: number;
  count: number;
  matched: number;
  failed: number;
  duplicate: number;
}

interface RecentTxn {
  channel: string;
  consumer_number: string;
  amount: number;
  status: "matched" | "failed" | "duplicate";
  reference: string;
  created_at: string;
}

interface OnlinePaymentsData {
  range: string;
  totalOnline: number;
  channels: { oneBill: ChannelSummary; smartPay: ChannelSummary };
  recent: RecentTxn[];
}

interface ChannelRecoveryData {
  byChannel: { channel: string; amount: number; percentageOfDue: number }[];
}

const RANGES = ["Day", "Week", "Month", "Quarter", "Year"] as const;

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  failed: "bg-rose-50 text-rose-600 dark:bg-rose-500/10",
  duplicate: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
};

export default function OnlinePaymentsPage() {
  const [data, setData] = useState<OnlinePaymentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]>("Month");

  const [channelData, setChannelData] = useState<ChannelRecoveryData | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) return;

    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/online-payments?range=${range}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch((err) => console.error("Failed to load online payments:", err))
      .finally(() => setLoading(false));

    // Same data Recovery Analytics' "Recovery By Payment Channel" section shows — kept
    // here too so the whole "Online Payments Flow" checklist (tracking, reconciliation,
    // AND channel-wise recovery) lives on this one page instead of sending the client
    // to a different section for the last item.
    setChannelLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/recovery-analytics/channel-wise?range=${range}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setChannelData(json.data);
      })
      .catch((err) => console.error("Failed to load channel-wise recovery:", err))
      .finally(() => setChannelLoading(false));
  }, [range]);

  const gridColor = "#e1e0d9";
  const axisLabelStyle = { colors: "#898781", fontSize: "11px", fontWeight: 600 };
  const horizontalBarOptions = (categories: string[], color: string): ApexOptions => ({
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: { bar: { borderRadius: 5, borderRadiusApplication: "end", barHeight: "55%", horizontal: true } },
    dataLabels: { enabled: true, formatter: (v) => `${v}%`, style: { fontSize: "11px", fontWeight: 700, colors: ["#52514e"] }, offsetX: 18 },
    colors: [color],
    grid: { strokeDashArray: 4, borderColor: gridColor, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    xaxis: { categories, min: 0, max: 100, labels: { formatter: (v) => `${v}%`, style: axisLabelStyle }, axisBorder: { show: false } },
    yaxis: { labels: { style: axisLabelStyle } },
    tooltip: { x: { formatter: (v) => `${v}%` } },
    states: { hover: { filter: { type: "darken" } } },
  });
  const chartHeight = (count: number) => Math.max(180, count * 46);

  return (
    <>
      <Breadcrumb pageName="Online Payments" />
      <PageHeader
        icon={Wifi}
        title="Online Payments Flow"
        subtitle="1Bill and SmartPay QR reconciliation across the business."
        actions={
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range === r ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-transparent">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600"><Wifi className="size-5" strokeWidth={2.25} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/80">Total Online Received</p>
                <p className="text-2xl font-black leading-tight text-blue-700 dark:text-blue-400">{PKR(data?.totalOnline || 0)}</p>
              </div>
            </div>
            <ChannelTile icon={Receipt} label="1Bill" summary={data?.channels.oneBill} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-500/10" />
            <ChannelTile icon={QrCode} label="SmartPay QR" summary={data?.channels.smartPay} color="text-teal-600" bg="bg-teal-50 dark:bg-teal-500/10" />
          </>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : data && data.recent.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">Channel</th>
                  <th className="px-4 py-3 font-bold">Consumer #</th>
                  <th className="px-4 py-3 font-bold">Reference</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((t, i) => (
                  <tr key={i} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3.5 whitespace-nowrap text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{t.channel}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{t.consumer_number}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{t.reference}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[t.status]}`}>
                        {t.status === "matched" ? <CheckCircle2 className="size-3" /> : t.status === "failed" ? <XCircle className="size-3" /> : <Copy className="size-3" />}
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Wifi} title="No online payment activity" description="No 1Bill or SmartPay transactions recorded for this period." />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Wallet className="size-4" /></div>
          <h2 className="text-sm font-bold text-dark dark:text-white">Channel-Wise Recovery</h2>
        </div>
        {channelLoading ? (
          <ChartSkeleton />
        ) : channelData && channelData.byChannel.some((c) => c.amount > 0) ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
            <Chart
              options={horizontalBarOptions(channelData.byChannel.map((c) => c.channel), "#2f9e6f")}
              series={[{ name: "% of Due Recovered", data: channelData.byChannel.map((c) => c.percentageOfDue) }]}
              type="bar"
              height={chartHeight(channelData.byChannel.length)}
            />
            <div className="flex flex-col justify-center gap-3 lg:min-w-[220px]">
              {channelData.byChannel.map((c) => (
                <div key={c.channel} className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-3.5 py-2.5 dark:bg-dark-2">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{c.channel}</span>
                  <span className="text-sm font-black text-dark dark:text-white">{PKR(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState icon={Wallet} title="No recovered payments this period" description="Nothing was collected via any channel in the selected range yet." />
        )}
      </div>
    </>
  );
}

function ChannelTile({ icon: Icon, label, summary, color, bg }: { icon: any; label: string; summary?: ChannelSummary; color: string; bg: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <div className="mb-3 flex items-center gap-2.5">
        <div className={`flex size-9 items-center justify-center rounded-xl ${bg} ${color}`}><Icon className="size-4" strokeWidth={2.25} /></div>
        <p className="text-sm font-bold text-dark dark:text-white">{label}</p>
      </div>
      <p className="text-xl font-black text-dark dark:text-white">{PKR(summary?.total || 0)}</p>
      <div className="mt-3 flex gap-3 text-xs">
        <span className="text-emerald-600">{summary?.matched ?? 0} matched</span>
        <span className="text-rose-500">{summary?.failed ?? 0} failed</span>
        <span className="text-amber-500">{summary?.duplicate ?? 0} dup</span>
      </div>
    </div>
  );
}
