"use client";

import { useEffect, useState } from "react";
import { employeeFetch } from "@/lib/employee-api";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Performance {
  kpi_score: number;
  attendance_score: number;
  recovery_pct?: number;
  team_rank?: number;
  targets?: Record<string, number>;
  achieved?: Record<string, number>;
  month: number;
  year: number;
}

export default function EmployeePerformancePage() {
  const [current, setCurrent] = useState<Performance | null>(null);
  const [history, setHistory] = useState<Performance[]>([]);
  const [ranking, setRanking] = useState<{ rank: number; team_size: number; department: string | null } | null>(null);
  const [liveAttendance, setLiveAttendance] = useState<number | null>(null);

  useEffect(() => {
    employeeFetch("/employee/performance").then((r) => {
      setCurrent(r.current);
      setHistory(r.history || []);
      setRanking(r.ranking || null);
      setLiveAttendance(r.live_attendance_score ?? null);
    });
  }, []);

  // Scores are percentages; clamp so a bad value can never push a bar outside its card.
  const pct = (v?: number | null) => Math.min(100, Math.max(0, Number(v) || 0));
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const targetKeys = Object.keys(current?.targets || {});
  const barOptions = {
    chart: { type: "bar" as const, toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: "70%" } },
    colors: ["#ff3d3d", "#22AD5C"],
    dataLabels: { enabled: true, style: { fontSize: "11px" } },
    xaxis: { categories: targetKeys.map(label) },
    legend: { position: "top" as const },
    grid: { strokeDashArray: 4 },
  };
  const barSeries = [
    { name: "Target", data: targetKeys.map((k) => Number(current?.targets?.[k] || 0)) },
    { name: "Achieved", data: targetKeys.map((k) => Number(current?.achieved?.[k] || 0)) },
  ];

  // Oldest → newest, last 12 months; a column chart reads well even with one month.
  const months = [...history].reverse();
  const historyOptions = {
    chart: { type: "bar" as const, toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 4, columnWidth: months.length < 3 ? "30%" : "55%" } },
    colors: ["#ff3d3d", "#22AD5C"],
    dataLabels: { enabled: true, formatter: (v: number) => `${v}%`, style: { fontSize: "11px" } },
    xaxis: { categories: months.map((h) => `${MONTHS[h.month - 1]} ${h.year}`) },
    yaxis: { min: 0, max: 100, tickAmount: 5, labels: { formatter: (v: number) => `${Math.round(v)}%` } },
    legend: { position: "top" as const },
    grid: { strokeDashArray: 4 },
  };
  const historySeries = [
    { name: "KPI Score", data: months.map((h) => pct(h.kpi_score)) },
    { name: "Attendance", data: months.map((h) => pct(h.attendance_score)) },
  ];

  const attendance = current?.attendance_score ?? liveAttendance ?? 0;
  const scoreCard = (title: string, value: number, color: string, bar: string, note?: string) => (
    <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-dark-2">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{pct(value)}%</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-3 dark:bg-dark-3">
        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct(value)}%` }} />
      </div>
      {note && <p className="mt-2 text-xs text-gray-500">{note}</p>}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Performance</h1>
        {current && <p className="text-sm text-gray-500">{MONTHS[current.month - 1]} {current.year} review</p>}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {scoreCard("KPI Score", current?.kpi_score ?? 0, "text-primary", "bg-primary", current ? undefined : "Published after HR's monthly review")}
        {scoreCard("Attendance Score", attendance, "text-green", "bg-green", !current && liveAttendance != null ? "From this month's attendance so far" : undefined)}
        {scoreCard("Recovery %", current?.recovery_pct ?? 0, "text-dark dark:text-white", "bg-dark dark:bg-white")}
        <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-dark-2">
          <p className="text-sm text-gray-500">Team Rank</p>
          <p className="mt-2 text-3xl font-bold text-dark dark:text-white">{ranking ? `#${ranking.rank}` : "—"}</p>
          <p className="mt-3 text-xs text-gray-500">{ranking ? `of ${ranking.team_size} in ${ranking.department || "your team"}` : "Published after HR's monthly review"}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-dark-2">
          <h2 className="mb-4 font-semibold">Targets vs Achieved</h2>
          {Object.keys(current?.targets || {}).length > 0 && typeof window !== "undefined" ? (
            <Chart options={barOptions} series={barSeries} type="bar" height={280} />
          ) : (
            <p className="text-sm text-gray-500">No targets set for this month yet</p>
          )}
        </div>
        <div className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-dark-2">
          <h2 className="mb-4 font-semibold">Monthly History</h2>
          {history.length > 0 && typeof window !== "undefined" && (
            <Chart options={historyOptions} series={historySeries} type="bar" height={280} />
          )}
          {history.length === 0 && <p className="text-sm text-gray-500">No history yet</p>}
        </div>
      </div>
    </div>
  );
}
