"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import toast from "react-hot-toast";
import { CalendarRange, Target, Save } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { ChartSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface MonthRow {
  month: string;
  label: string;
  due: number;
  recovered: number;
  target: number;
  isProjected?: boolean;
  recoveryPercentage: number;
}

export default function MonthlyInstallmentsPage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetMonth, setTargetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    const token = Cookies.get("auth_token");
    if (!token) return;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/monthly-installments?months=12&futureMonths=0`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setMonths(json.data.months);
      })
      .catch((err) => console.error("Failed to load monthly analytics:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSetTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      toast.error("Enter a valid target amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/monthly-installments/target`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ month: targetMonth, target_amount: parseFloat(targetAmount) }),
      });
      if (!res.ok) throw new Error("Failed to set target.");
      toast.success(`Target set for ${targetMonth}.`);
      setTargetAmount("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const chartOptions: ApexOptions = {
    chart: { type: "line", toolbar: { show: false }, fontFamily: "inherit", width: "100%" },
    stroke: { curve: "smooth", width: [0, 3, 2], dashArray: [0, 0, 6] },
    plotOptions: { bar: { borderRadius: 5, borderRadiusApplication: "end", columnWidth: "40%" } },
    colors: ["#2a78d6", "#1baf7a", "#898781"],
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    xaxis: {
      type: "category",
      tickPlacement: "on",
      categories: months.map((m) => m.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: "#898781", fontSize: "11px" },
        rotate: -45,
        rotateAlways: true,
        trim: false,
        hideOverlappingLabels: false,
      },
    },
    yaxis: { labels: { formatter: (v) => PKR(v), style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { shared: true, y: { formatter: (v) => PKR(v) } },
    dataLabels: { enabled: false },
    responsive: [
      {
        breakpoint: 768,
        options: {
          xaxis: { labels: { style: { fontSize: "9px" }, rotate: -60 } },
          legend: { fontSize: "10px" },
        },
      },
    ],
  };

  const series = [
    { name: "Due (Expected)", type: "column", data: months.map((m) => m.due) },
    { name: "Recovered (Actual)", type: "line", data: months.map((m) => m.recovered) },
    { name: "Target", type: "line", data: months.map((m) => m.target) },
  ];

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonth = months.find((m) => m.month === currentMonthKey) || months.find((m) => !m.isProjected) || months[months.length - 1];

  return (
    <>
      <Breadcrumb pageName="Monthly Installments" />
      <PageHeader icon={CalendarRange} title="Monthly Installment Analytics" subtitle="Expected vs. recovered installments per month, tracked against targets." />

      {currentMonth && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MiniStat label="This Month Due" value={PKR(currentMonth.due)} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" />
          <MiniStat label="This Month Recovered" value={PKR(currentMonth.recovered)} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" />
          <MiniStat label="Recovery Rate" value={`${currentMonth.recoveryPercentage}%`} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-500/10" />
        </div>
      )}

      {loading ? (
        <div className="mb-6"><ChartSkeleton /></div>
      ) : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">12-Month Trend</h2>
          <div className="overflow-x-auto">
            <Chart options={chartOptions} series={series} type="line" height={380} width="100%" />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><Target className="size-4" /></div>
          <h2 className="text-sm font-bold text-dark dark:text-white">Set Monthly Target</h2>
        </div>
        <form onSubmit={handleSetTarget} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Month</label>
            <input type="month" value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Target Amount (PKR)</label>
            <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="0" className="w-48 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
            <Save className="size-4" /> {saving ? "Saving..." : "Save Target"}
          </button>
        </form>
      </div>
    </>
  );
}

function MiniStat({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 p-4 shadow-sm dark:border-white/10 ${bg}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${color} opacity-80`}>{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
