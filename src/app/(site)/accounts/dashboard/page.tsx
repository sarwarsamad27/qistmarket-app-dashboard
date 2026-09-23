"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import {
  LayoutDashboard, Wallet, Clock, Wifi, Receipt, HandCoins, Users, TrendingUp, Landmark,
  Package, Lock, AlertTriangle, ShieldAlert, Info, ArrowRight, CalendarRange,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, ChartSkeleton } from "@/components/Accounts/Skeleton";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface DashboardSummary {
  totalCashInHand: number;
  pendingCashInHand: number;
  onlinePaymentsToday: number;
  todaysExpense: number;
  vendorPayables: number;
  customerReceivables: number;
  bankBalance: number;
}

interface RecoveryAnalytics {
  totalDue: number;
  totalRecovered: number;
  recoveryPercentage: number;
  outletWise: { outlet_name: string; due: number; recovered: number; recoveryPercentage: number }[];
  officerWise: { officer_name: string; due: number; recovered: number; recoveryPercentage: number }[];
}

interface FlowTrend { date: string; cash: number; online: number; total: number }
interface Alert { severity: "good" | "warning" | "serious" | "critical"; title: string; message: string; link?: string }

const SEVERITY_STYLE: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20",
  warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20",
  serious: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20",
  critical: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20",
};

const RANGES = ["Day", "Week", "Month", "Quarter", "Year"] as const;
const RANGE_LABEL: Record<(typeof RANGES)[number], string> = {
  Day: "today", Week: "this week", Month: "this month", Quarter: "this quarter", Year: "this year",
};

type Range = (typeof RANGES)[number];
interface TrendBucket { key: string; tick: string; label: string; cash: number; online: number }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dayLabel = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const mondayOf = (d: Date) => { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };

// The API only returns days that had collections, which leaves an uneven,
// gappy axis. Spread the period into evenly spaced, zero-filled buckets
// (days for short ranges, weeks for a quarter, months for a year).
const bucketTrend = (trend: FlowTrend[], range: Range): TrendBucket[] => {
  const now = new Date();
  const buckets: TrendBucket[] = [];
  let keyOf: (d: Date) => string;

  if (range === "Year") {
    keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    for (let m = 0; m < 12; m++) {
      buckets.push({ key: `${now.getFullYear()}-${m}`, tick: MONTHS[m], label: `${MONTHS[m]} ${now.getFullYear()}`, cash: 0, online: 0 });
    }
  } else if (range === "Quarter") {
    keyOf = (d) => ymd(mondayOf(d));
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
    for (let d = mondayOf(qStart); d < qEnd; d.setDate(d.getDate() + 7)) {
      const end = new Date(d); end.setDate(end.getDate() + 6);
      buckets.push({ key: ymd(d), tick: dayLabel(d), label: `Week of ${dayLabel(d)} – ${dayLabel(end)}`, cash: 0, online: 0 });
    }
  } else {
    keyOf = ymd;
    let start: Date, end: Date;
    if (range === "Month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (range === "Week") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      start = end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    const everyNth = range === "Month" ? 3 : 1;
    let i = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), i++) {
      const isFirstOrLast = d.getTime() === start.getTime() || d.getTime() === end.getTime();
      buckets.push({ key: ymd(d), tick: i % everyNth === 0 || isFirstOrLast ? dayLabel(d) : "", label: dayLabel(d) + ` ${d.getFullYear()}`, cash: 0, online: 0 });
    }
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const t of trend) {
    const b = byKey.get(keyOf(parseYmd(t.date)));
    if (b) { b.cash += t.cash; b.online += t.online; }
  }
  return buckets;
};

const compactPKR = (v: number) => {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${+(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v)}`;
};

export default function AccountsDashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recovery, setRecovery] = useState<RecoveryAnalytics | null>(null);
  const [trend, setTrend] = useState<FlowTrend[]>([]);
  const [stockValuation, setStockValuation] = useState(0);
  const [lockedDevices, setLockedDevices] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]>("Month");

  const getFilterQueryParams = () => {
    if (range) return `?dateRange=${range}`;
    return "";
  };

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [summaryRes, recoveryRes, flowRes, stockRes, deviceRes, alertsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/accounts/dashboard-summary`, { headers }),
          fetch(`${BACKEND_URL}/api/accounts/recovery-analytics?range=${range}`, { headers }),
          fetch(`${BACKEND_URL}/api/accounts/installment-flow?range=${range}`, { headers }),
          fetch(`${BACKEND_URL}/api/outlet-reports/stock-summary?outletId=all`, { headers }),
          fetch(`${BACKEND_URL}/api/paytrigger/devices/summary`, { headers }),
          fetch(`${BACKEND_URL}/api/accounts/alerts`, { headers }),
        ]);
        const [summaryJson, recoveryJson, flowJson, stockJson, deviceJson, alertsJson] = await Promise.all([
          summaryRes.json(), recoveryRes.json(), flowRes.json(), stockRes.json(), deviceRes.json(), alertsRes.json(),
        ]);
        if (summaryJson.success) setSummary(summaryJson.data);
        if (recoveryJson.success) setRecovery(recoveryJson.data);
        if (flowJson.success) setTrend(flowJson.data.trend);
        if (stockJson.success) setStockValuation(stockJson.data.reduce((acc: number, r: any) => acc + r.valuation, 0));
        if (deviceJson.success) setLockedDevices(deviceJson.data.locked);
        if (alertsJson.success) setAlerts(alertsJson.data.alerts);
      } catch (err) {
        console.error("Failed to load Accounts dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [range]);

  // Only entries with actual due activity this period — an all-zero chart
  // just renders invisible zero-width bars, which reads as "broken", not "empty".
  const activeOutlets = (recovery?.outletWise || []).filter((o) => o.due > 0).sort((a, b) => b.due - a.due);
  const activeOfficers = (recovery?.officerWise || []).filter((o) => o.due > 0).sort((a, b) => b.due - a.due);

  const barOptions = (categories: string[], color: string): ApexOptions => ({
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit", animations: { speed: 300 } },
    plotOptions: { bar: { borderRadius: 5, borderRadiusApplication: "end", barHeight: "55%", horizontal: true } },
    dataLabels: { enabled: true, formatter: (v) => `${v}%`, style: { fontSize: "11px", fontWeight: 700, colors: ["#52514e"] }, offsetX: 18 },
    colors: [color],
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9", xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
    xaxis: { categories, min: 0, max: 100, axisBorder: { show: false }, labels: { formatter: (v) => `${v}%`, style: { colors: "#898781", fontSize: "11px", fontWeight: 600 } } },
    yaxis: { labels: { style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { theme: "light", y: { formatter: (v) => `${v}%` } },
    states: { hover: { filter: { type: "darken" } } },
  });

  const buckets = bucketTrend(trend, range);
  const trendCash = buckets.reduce((s, b) => s + b.cash, 0);
  const trendOnline = buckets.reduce((s, b) => s + b.online, 0);
  const hasTrend = trendCash + trendOnline > 0;

  const trendOptions: ApexOptions = {
    chart: { type: "bar", stacked: true, toolbar: { show: false }, fontFamily: "inherit", animations: { speed: 300 } },
    plotOptions: { bar: { columnWidth: buckets.length > 20 ? "70%" : "50%", borderRadius: 4, borderRadiusApplication: "end", borderRadiusWhenStacked: "last" } },
    colors: ["#1baf7a", "#2a78d6"],
    legend: { show: false },
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9", xaxis: { lines: { show: false } } },
    xaxis: {
      categories: buckets.map((b) => b.tick),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { rotate: 0, hideOverlappingLabels: false, style: { colors: "#898781", fontSize: "11px" } },
    },
    yaxis: { labels: { formatter: (v) => compactPKR(v), style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: {
      shared: true,
      intersect: false,
      x: { formatter: (_v, opts) => buckets[opts?.dataPointIndex ?? 0]?.label ?? "" },
      y: { formatter: (v) => PKR(v) },
    },
    states: { hover: { filter: { type: "darken" } } },
    dataLabels: { enabled: false },
  };

  return (
    <>
      <Breadcrumb pageName="Accounts Dashboard" />
      <PageHeader
        icon={LayoutDashboard}
        title="Accounts Dashboard"
        subtitle="Centralized financial snapshot across all outlets, updated in real time."
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

      {/* Global Alerts & Notifications */}
      {!loading && alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.slice(0, 5).map((a, i) => (
            <div key={i} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.warning}`}>
              <div className="flex items-center gap-2.5">
                {a.severity === "critical" || a.severity === "serious" ? <AlertTriangle className="size-4 shrink-0" /> : a.severity === "good" ? <ShieldAlert className="size-4 shrink-0" /> : <Info className="size-4 shrink-0" />}
                <span><strong className="font-bold">{a.title}</strong> — {a.message}</span>
              </div>
              {a.link && <Link href={a.link} className="shrink-0 font-semibold underline underline-offset-2">View</Link>}
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 10 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={Wallet} label="Total Cash In Hand" value={PKR(summary?.totalCashInHand || 0)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" onClick={() => router.push(`/accounts/cash-in-hand${getFilterQueryParams()}`)} />
            <StatCard icon={Clock} label="Pending Cash In Hand" value={PKR(summary?.pendingCashInHand || 0)} accent="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" bar="bg-amber-500" onClick={() => router.push(`/accounts/cash-in-hand${getFilterQueryParams()}`)} />
            <StatCard icon={Wifi} label="Online Payments Today" value={PKR(summary?.onlinePaymentsToday || 0)} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" onClick={() => router.push(`/accounts/online-payments${getFilterQueryParams()}`)} />
            <StatCard icon={TrendingUp} label={`Total Recovery (${range})`} value={PKR(recovery?.totalRecovered || 0)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" onClick={() => router.push(`/accounts/recovery-analytics${getFilterQueryParams()}`)} />
            <StatCard icon={Landmark} label="Bank Balance" value={PKR(summary?.bankBalance || 0)} accent="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-500/10" bar="bg-indigo-500" onClick={() => router.push("/accounts/bank-accounts")} />
            <StatCard icon={Receipt} label="Today's Expense" value={PKR(summary?.todaysExpense || 0)} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" onClick={() => router.push(`/accounts/expenses${getFilterQueryParams()}`)} />
            <StatCard icon={HandCoins} label="Vendor Payables" value={PKR(summary?.vendorPayables || 0)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" onClick={() => router.push("/accounts/vendors")} />
            <StatCard icon={Users} label="Customer Receivables" value={PKR(summary?.customerReceivables || 0)} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" onClick={() => router.push(`/accounts/receivables${getFilterQueryParams()}`)} />
            <StatCard icon={Package} label="Stock Valuation" value={PKR(stockValuation)} accent="text-teal-600" bg="bg-teal-50 dark:bg-teal-500/10" bar="bg-teal-500" onClick={() => router.push("/accounts/stock-summary")} />
            <StatCard icon={Lock} label="Locked Devices" value={lockedDevices} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" onClick={() => router.push("/accounts/paytrigger")} />
          </>
        )}
      </div>

      {loading ? (
        <div className="mb-6"><ChartSkeleton /></div>
      ) : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10"><CalendarRange className="size-4" strokeWidth={2.25} /></div>
              <div>
                <h2 className="text-base font-bold text-dark dark:text-white">Installment Collection Trend</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {range === "Year" ? "Monthly" : range === "Quarter" ? "Weekly" : "Daily"} cash vs. online collections, {RANGE_LABEL[range]}
                </p>
              </div>
            </div>
            {hasTrend && (
              <div className="flex gap-5">
                {[
                  { name: "Cash", value: trendCash, dot: "bg-[#1baf7a]" },
                  { name: "Online", value: trendOnline, dot: "bg-[#2a78d6]" },
                ].map((s) => (
                  <div key={s.name}>
                    <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><span className={`size-2 rounded-full ${s.dot}`} />{s.name}</p>
                    <p className="text-sm font-bold text-dark dark:text-white">{PKR(s.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {hasTrend ? (
            <Chart options={trendOptions} series={[{ name: "Cash", data: buckets.map((b) => b.cash) }, { name: "Online", data: buckets.map((b) => b.online) }]} type="bar" height={280} />
          ) : (
            <EmptyState icon={CalendarRange} title={`No collections recorded ${RANGE_LABEL[range]}`} />
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-dark dark:text-white">Recovery % — Outlet Wise</h2>
              <div className="rounded-xl bg-emerald-50 px-3 py-1.5 text-right dark:bg-emerald-500/10">
                <p className="text-lg font-black leading-none text-emerald-600">{recovery?.recoveryPercentage ?? 0}%</p>
              </div>
            </div>
            {activeOutlets.length > 0 ? (
              <Chart options={barOptions(activeOutlets.map((o) => o.outlet_name), "#1baf7a")} series={[{ name: "Recovery %", data: activeOutlets.map((o) => o.recoveryPercentage) }]} type="bar" height={Math.max(220, activeOutlets.length * 46)} />
            ) : (
              <EmptyState icon={TrendingUp} title="No recovery data yet" description={`Once installments are due ${RANGE_LABEL[range]}, recovery trends will appear here.`} />
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h2 className="mb-4 text-base font-bold text-dark dark:text-white">Recovery % — Officer Wise</h2>
            {activeOfficers.length > 0 ? (
              <Chart options={barOptions(activeOfficers.map((o) => o.officer_name), "#eb6834")} series={[{ name: "Recovery %", data: activeOfficers.map((o) => o.recoveryPercentage) }]} type="bar" height={Math.max(220, activeOfficers.length * 46)} />
            ) : (
              <EmptyState icon={Users} title="No officer data for this period" />
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Link href="/accounts/recovery-analytics" className="flex items-center gap-1 text-sm font-semibold text-[#ff3d3d] hover:underline">
          Full Recovery Analytics <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </>
  );
}
