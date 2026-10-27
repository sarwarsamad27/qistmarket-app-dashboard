"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { Clock, AlertTriangle, Search, ChevronDown, ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import DateRangeFilter, { type DateRange } from "@/components/Accounts/DateRangeFilter";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Status-severity palette: 0-30 (good) -> 90+ (critical)
const BUCKET_COLORS: Record<string, string> = {
  "0-30": "#0ca30c",
  "31-60": "#fab219",
  "61-90": "#ec835a",
  "90+": "#d03b3b",
};
const BUCKET_TEXT_ON_LIGHT: Record<string, string> = {
  "0-30": "text-emerald-700",
  "31-60": "text-amber-700",
  "61-90": "text-orange-700",
  "90+": "text-rose-700",
};
const BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;

interface AgingItem {
  order_id: number;
  order_ref: string;
  customer_name: string;
  outlet_name: string;
  officer_name: string;
  month: number;
  dueDate: string;
  daysOverdue: number;
  bucket: string;
  outstanding: number;
}

interface AgingBucketItem {
  outlet_id?: number | null;
  outlet_name?: string;
  officer_id?: number | null;
  officer_name?: string;
  "0-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
  total: number;
}

// One row per order: every overdue installment of the order summed, so the Outstanding
// column matches the order ledger's total due (installment rows are shown on expand).
interface AgingOrder {
  order_id: number;
  order_ref: string;
  customer_name: string;
  outlet_name: string;
  officer_name: string;
  installments: AgingItem[];
  outstanding: number;
  oldestDue: string;
  daysOverdue: number;
  bucket: string;
}

interface AgingData {
  buckets: Record<string, number>;
  total: number;
  outletWise: AgingBucketItem[];
  officerWise: AgingBucketItem[];
  items: AgingItem[];
}

function compactPKR(v: number): string {
  if (v >= 1000000) return `PKR ${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `PKR ${(v / 1000).toFixed(0)}k`;
  return `PKR ${v}`;
}

function formatOfficerName(name?: string): string {
  if (!name || name === "Unassigned") return "Unassigned";
  const formatted = name
    .replace(/Test Recovery Officer\s*(\d+)/gi, "Test Officer $1")
    .replace(/Super Admin\s*(\d*)/gi, "Super Admin $1")
    .replace(/\s+/g, " ")
    .trim();

  return formatted
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
}

export default function InstallmentAgingPage() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"outlet" | "officer">("outlet");
  const [hideUnassigned, setHideUnassigned] = useState(false);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const orders = useMemo<AgingOrder[]>(() => {
    const map = new Map<number, AgingOrder>();
    // items arrive sorted by days overdue desc, so the first row of each order is its oldest
    for (const item of data?.items || []) {
      let o = map.get(item.order_id);
      if (!o) {
        o = {
          order_id: item.order_id,
          order_ref: item.order_ref,
          customer_name: item.customer_name,
          outlet_name: item.outlet_name,
          officer_name: item.officer_name,
          installments: [],
          outstanding: 0,
          oldestDue: item.dueDate,
          daysOverdue: item.daysOverdue,
          bucket: item.bucket,
        };
        map.set(item.order_id, o);
      }
      o.installments.push(item);
      o.outstanding += item.outstanding;
    }
    for (const o of map.values()) o.installments.sort((a, b) => a.month - b.month);
    return Array.from(map.values());
  }, [data]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.order_ref, o.customer_name, o.outlet_name, o.officer_name, PKR(o.outstanding), String(o.outstanding)]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [orders, search]);

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) return;

    setLoading(true);
    const qs = new URLSearchParams();
    if (range.from) qs.set("startDate", range.from);
    if (range.to) qs.set("endDate", range.to);
    fetch(`${BACKEND_URL}/api/accounts/aging?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .catch((err) => console.error("Failed to load aging report:", err))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const rawList = viewMode === "outlet" ? data?.outletWise || [] : data?.officerWise || [];
  const unassignedItem = rawList.find(
    (o) => o.outlet_name === "Unassigned" || o.officer_name === "Unassigned" || o.outlet_id === null || o.officer_id === null
  );
  const unassignedTotal = unassignedItem?.total || 0;

  const activeList = hideUnassigned
    ? rawList.filter((o) => o.outlet_name !== "Unassigned" && o.officer_name !== "Unassigned" && o.outlet_id !== null && o.officer_id !== null)
    : rawList;

  const isHorizontal = viewMode === "officer";

  const stackedOptions: ApexOptions = {
    chart: { type: "bar", stacked: true, toolbar: { show: false }, fontFamily: "inherit" },
    plotOptions: {
      bar: {
        horizontal: isHorizontal,
        borderRadius: 4,
        borderRadiusApplication: "end",
        barHeight: isHorizontal ? "55%" : undefined,
        columnWidth: !isHorizontal ? "45%" : undefined,
      },
    },
    dataLabels: { enabled: false },
    colors: BUCKETS.map((b) => BUCKET_COLORS[b]),
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    xaxis: {
      categories: activeList.map((o) =>
        viewMode === "officer"
          ? formatOfficerName(o.officer_name || o.outlet_name)
          : o.outlet_name || formatOfficerName(o.officer_name) || "Unassigned"
      ),
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: isHorizontal ? 5 : undefined,
      labels: {
        formatter: isHorizontal ? (v) => compactPKR(typeof v === "number" ? v : parseFloat(v) || 0) : undefined,
        style: { colors: "#898781", fontSize: "11px" },
      },
    },
    yaxis: {
      labels: {
        formatter: !isHorizontal ? (v) => compactPKR(typeof v === "number" ? v : parseFloat(v) || 0) : undefined,
        style: { colors: "#898781", fontSize: "11px", fontWeight: isHorizontal ? 600 : 400 },
      },
    },
    tooltip: { y: { formatter: (v) => PKR(v) } },
  };

  return (
    <>
      <Breadcrumb pageName="Installment Aging" />
      <PageHeader icon={Clock} title="Installment Aging" subtitle="Outstanding installments grouped by how overdue they are." />
      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
        <p className="mt-1.5 text-[11px] text-gray-400">Dates pick installments that fell due in that period; days overdue are always counted to today. Empty = all overdue installments.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          BUCKETS.map((b) => (
            <div key={b} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="h-[3px] w-full" style={{ backgroundColor: BUCKET_COLORS[b] }} />
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${BUCKET_COLORS[b]}1a`, color: BUCKET_COLORS[b] }}>
                    {b === "90+" ? <AlertTriangle className="size-4" strokeWidth={2.25} /> : <Clock className="size-4" strokeWidth={2.25} />}
                  </div>
                  <p className="text-[9px] font-black uppercase leading-tight tracking-widest text-slate-400">{b} Days</p>
                </div>
                <p className={`text-[22px] font-black leading-none tracking-tight ${BUCKET_TEXT_ON_LIGHT[b]} dark:text-white`}>{PKR(data?.buckets[b] || 0)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {loading ? (
        <div className="mb-6"><ChartSkeleton /></div>
      ) : activeList.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-dark dark:text-white">
              Aging Analysis — {viewMode === "outlet" ? "by Outlet (Branch)" : "by Officer"}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {unassignedTotal > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-dark-3 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={hideUnassigned}
                    onChange={(e) => setHideUnassigned(e.target.checked)}
                    className="size-3.5 rounded accent-[#ff3d3d]"
                  />
                  Hide Unassigned ({compactPKR(unassignedTotal)})
                </label>
              )}
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
                <button
                  onClick={() => setViewMode("outlet")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === "outlet" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}
                >
                  By Outlet
                </button>
                <button
                  onClick={() => setViewMode("officer")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${viewMode === "officer" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}
                >
                  By Officer
                </button>
              </div>
            </div>
          </div>
          <Chart
            options={stackedOptions}
            series={BUCKETS.map((b) => ({ name: `${b} Days`, data: activeList.map((o) => o[b]) }))}
            type="bar"
            height={isHorizontal ? Math.max(320, activeList.length * 45) : 320}
          />
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Clock} title="No overdue installments" description="Everything is either fully paid or not yet due." />
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-white/10">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order ref, customer, outlet, officer..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-dark outline-none transition focus:border-[#ff3d3d] focus:bg-white dark:border-white/10 dark:bg-dark-3 dark:text-white"
              />
            </div>
            <p className="text-xs font-semibold text-gray-500">
              {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"} · {PKR(filteredOrders.reduce((s, o) => s + o.outstanding, 0))} outstanding
            </p>
          </div>
          <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-bold">S.No</th>
                  <th className="px-4 py-3 font-bold">Order Ref</th>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 font-bold">Outlet</th>
                  <th className="px-4 py-3 font-bold">Officer</th>
                  <th className="px-4 py-3 text-center font-bold">Overdue Inst.</th>
                  <th className="px-4 py-3 font-bold">Oldest Due</th>
                  <th className="px-4 py-3 text-right font-bold">Days Overdue</th>
                  <th className="px-4 py-3 text-right font-bold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">No orders match &ldquo;{search}&rdquo;</td>
                  </tr>
                ) : (
                  filteredOrders.map((o, i) => {
                    const open = expanded.has(o.order_id);
                    return (
                      <Fragment key={o.order_id}>
                        <tr
                          onClick={() => toggleExpanded(o.order_id)}
                          className="cursor-pointer border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5"
                        >
                          <td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{i + 1}</td>
                          <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">
                            <span className="inline-flex items-center gap-1.5">
                              {open ? <ChevronDown className="size-3.5 text-gray-400" /> : <ChevronRight className="size-3.5 text-gray-400" />}
                              {o.order_ref}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.customer_name}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.outlet_name}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.officer_name}</td>
                          <td className="px-4 py-3.5 text-center tabular-nums text-gray-600 dark:text-gray-300">{o.installments.length}</td>
                          <td className="px-4 py-3.5 text-gray-500">{new Date(o.oldestDue).toLocaleDateString()}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-semibold" style={{ color: BUCKET_COLORS[o.bucket] }}>
                            {o.daysOverdue > 0 ? o.daysOverdue : 0}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(o.outstanding)}</td>
                        </tr>
                        {open &&
                          o.installments.map((it) => (
                            <tr key={`${o.order_id}-${it.month}`} className="bg-slate-50/60 text-xs dark:bg-white/5">
                              <td />
                              <td colSpan={4} className="px-4 py-2 pl-10 text-gray-500">Month {it.month}</td>
                              <td />
                              <td className="px-4 py-2 text-gray-500">{new Date(it.dueDate).toLocaleDateString()}</td>
                              <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: BUCKET_COLORS[it.bucket] }}>
                                {it.daysOverdue}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(it.outstanding)}</td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
