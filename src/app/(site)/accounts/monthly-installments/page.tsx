"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ApexOptions } from "apexcharts";
import toast from "react-hot-toast";
import { CalendarRange, Target, Save, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import OutletSelector from "@/components/common/OutletSelector";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { ChartSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import { apiErrorMessage } from "@/lib/apiErrors";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

interface MonthRow { month: string; label: string; due: number; paidOfDue: number; unpaidOfDue: number; recovered: number; target: number; isProjected?: boolean; recoveryPercentage: number; paidOfDuePercentage: number; targetPercentage: number | null }
interface ScheduleRow { order_id: number; order_ref: string; customer_name: string; whatsapp_number: string; outlet_name: string; month_number: number; due_date: string; amount: number; paid: number; remaining: number; status: "paid" | "partial" | "unpaid" | "overdue"; paid_at: string | null }
interface Detail {
  month: string; label: string;
  summary: {
    installments: number; due: number; paid: number; unpaid: number; paid_pct: number;
    counts: { paid: number; partial: number; unpaid: number; overdue: number };
    arrears: number; arrears_accounts: number; expected_recovery: number;
    collected: { total: number; cash: number; online: number; other: number };
    collected_vs_expected_pct: number; target: number; target_pct: number | null; target_remaining: number | null;
    target_scope?: "outlet" | "company" | "outlets_sum" | null;
  };
  outlets: { outlet_id: number | null; outlet_name: string; due: number; paid: number; unpaid: number; installments: number; unpaid_count: number; arrears: number; collected: number }[];
  schedule: ScheduleRow[];
}

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  unpaid: "bg-slate-100 text-slate-600 dark:bg-white/10",
  overdue: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
};
const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; };

export default function MonthlyInstallmentsPage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(thisMonth);
  const [outletId, setOutletId] = useState("all");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTrend = () => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/monthly-installments?months=12&futureMonths=3&outletId=${outletId}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setMonths(json.data.months); })
      .catch((err) => console.error("Failed to load monthly analytics:", err))
      .finally(() => setLoading(false));
  };
  const fetchDetail = () => {
    setDetailLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/monthly-installments/month?month=${month}&outletId=${outletId}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) { setDetail(json.data); setTargetAmount(json.data.summary.target ? String(json.data.summary.target) : ""); } })
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => { fetchTrend(); }, [outletId]);
  useEffect(() => { fetchDetail(); }, [month, outletId]);

  const handleSetTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAmount || parseFloat(targetAmount) <= 0) { toast.error("Enter a valid target amount."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/monthly-installments/target`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ month, outletId, target_amount: parseFloat(targetAmount) }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to set target."));
      toast.success(`Target set for ${detail?.label || month}.`);
      fetchTrend();
      fetchDetail();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const schedule = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (detail?.schedule || []).filter((r) => (!statusFilter || r.status === statusFilter) && (!q || `${r.order_ref} ${r.customer_name} ${r.whatsapp_number} ${r.outlet_name}`.toLowerCase().includes(q)));
  }, [detail, statusFilter, search]);

  // Categorical slots 1–2 for due vs collected, a neutral dashed line for the target.
  const chartOptions: ApexOptions = {
    chart: { type: "line", toolbar: { show: false }, fontFamily: "inherit", events: { dataPointSelection: (_e, _c, cfg) => { const m = months[cfg.dataPointIndex]; if (m) setMonth(m.month); } } },
    stroke: { curve: "smooth", width: [0, 0, 2], dashArray: [0, 0, 6], colors: ["transparent", "transparent", "#898781"] },
    plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: "end", columnWidth: "55%" } },
    colors: ["#2a78d6", "#eb6834", "#898781"],
    grid: { strokeDashArray: 4, borderColor: "#e1e0d9" },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    // "Nov 25" instead of "Nov 2025" so 15 months fit; on narrow screens they tilt instead of overlapping.
    xaxis: { categories: months.map((m) => m.label.replace(/ (\d{2})(\d{2})$/, " '$2")), axisBorder: { show: false }, axisTicks: { show: false }, tickPlacement: "on", labels: { rotate: -45, rotateAlways: false, hideOverlappingLabels: false, trim: false, style: { colors: "#898781", fontSize: "11px" } } },
    yaxis: { labels: { formatter: (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${v}`), style: { colors: "#898781", fontSize: "11px" } } },
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => PKR(v) } },
    dataLabels: { enabled: false },
    markers: { size: [0, 0, 7], strokeWidth: 2, strokeColors: "#fff", hover: { size: 9 } },
  };
  const series = [
    { name: "Due that month", type: "column", data: months.map((m) => m.due) },
    { name: "Collected that month", type: "column", data: months.map((m) => m.recovered) },
    { name: "Target", type: "line", data: months.map((m) => m.target || null) },
  ];

  const s = detail?.summary;
  const outletName = detail?.outlets[0]?.outlet_name || "this outlet";
  return (
    <>
      <Breadcrumb pageName="Monthly Installments" />
      <PageHeader
        icon={CalendarRange}
        title="Monthly Installments"
        subtitle="Each month's installment schedule, expected recovery (dues + arrears), paid vs unpaid, collections and target progress."
        actions={
          <>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-xl border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            <OutletSelector selectedId={outletId} onSelect={setOutletId} />
          </>
        }
      />

      {detailLoading && !detail ? <div className="mb-6"><TableSkeleton /></div> : s && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={`Expected recovery — ${detail!.label}`} value={PKR(s.expected_recovery)} note={`${PKR(s.due)} due this month + ${PKR(s.arrears)} arrears (${s.arrears_accounts} accounts)`} tone="text-blue-700 dark:text-blue-300" />
            <Stat label="Collected in month" value={PKR(s.collected.total)} note={`${s.collected_vs_expected_pct}% of expected · cash ${PKR(s.collected.cash)} · online ${PKR(s.collected.online)}${s.collected.other ? ` · manual corrections / other ${PKR(s.collected.other)}` : ""}`} tone="text-emerald-700 dark:text-emerald-300" />
            <Stat label="This month's dues paid" value={`${s.paid_pct}%`} note={`${PKR(s.paid)} paid · ${PKR(s.unpaid)} unpaid of ${s.installments} installments`} tone="text-dark dark:text-white" />
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Target — {outletId === "all" ? "whole company" : outletName}</p>
              {s.target > 0 ? (
                <>
                  <p className="text-xl font-black text-dark dark:text-white">{s.target_pct}% <span className="text-sm font-semibold text-gray-500">of {PKR(s.target)}</span></p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className={`h-full ${(s.target_pct || 0) >= 100 ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, s.target_pct || 0)}%` }} /></div>
                  <p className="mt-1 text-[11px] text-gray-500">{s.target_remaining ? `${PKR(s.target_remaining)} still to collect` : "Target achieved"}</p>
                  {s.target_scope === "outlets_sum" && <p className="text-[10px] text-gray-400">Sum of the outlets&apos; own targets (no company target set).</p>}
                </>
              ) : <p className="mt-1 text-sm text-gray-500">No target set for {outletId === "all" ? "the company" : outletName} this month.</p>}
              <form onSubmit={handleSetTarget} className="mt-2 flex gap-1.5">
                <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="Target PKR" className="w-full rounded-lg border border-stroke px-2 py-1 text-xs dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                <button type="submit" disabled={saving} className="flex items-center gap-1 rounded-lg bg-[#ff3d3d] px-2 py-1 text-xs font-bold text-white disabled:opacity-50"><Save className="size-3" /> {saving ? "…" : "Set"}</button>
              </form>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["paid", "partial", "unpaid", "overdue"] as const).map((k) => (
              <button key={k} onClick={() => setStatusFilter(statusFilter === k ? "" : k)} className={`rounded-2xl border bg-white p-3.5 text-left shadow-sm dark:bg-boxdark ${statusFilter === k ? "border-[#ff3d3d] ring-2 ring-[#ff3d3d]/20" : "border-slate-100 dark:border-white/10"}`}>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[k]}`}>{k === "unpaid" ? "Not yet due / unpaid" : k}</span>
                <p className="mt-1.5 text-xl font-black text-dark dark:text-white">{s.counts[k]}</p>
                <p className="text-[11px] text-gray-500">installment(s)</p>
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? <div className="mb-6"><ChartSkeleton /></div> : (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-dark dark:text-white">Monthly trend — {outletId === "all" ? "all outlets" : outletName} <span className="font-normal text-gray-400">(click a month to open it)</span></h2>
            <ExportMenu title="Monthly Installments Trend" columns={[
              { header: "Month", value: (m: MonthRow) => m.label },
              { header: "Due", value: (m) => m.due, numeric: true },
              { header: "Paid of that month's dues", value: (m) => m.paidOfDue, numeric: true },
              { header: "Unpaid of that month's dues", value: (m) => m.unpaidOfDue, numeric: true },
              { header: "Collected in month", value: (m) => m.recovered, numeric: true },
              { header: "Target", value: (m) => m.target || "", numeric: true },
              { header: "Target %", value: (m) => m.targetPercentage ?? "", numeric: true },
            ]} getRows={() => months} />
          </div>
          {/* Scrolls sideways only on narrow screens; never shows a scrollbar on desktop. */}
          <div className="overflow-x-auto overflow-y-hidden md:overflow-x-visible">
            <div className="min-w-[640px] md:min-w-0">
              <Chart options={chartOptions} series={series} type="line" height={330} />
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-gray-400"><tr><th className="py-1.5">Month</th><th className="py-1.5 text-right">Due</th><th className="py-1.5 text-right">Paid of dues</th><th className="py-1.5 text-right">Unpaid</th><th className="py-1.5 text-right">Collected</th><th className="py-1.5 text-right">Target</th></tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} onClick={() => setMonth(m.month)} className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 ${m.month === month ? "bg-rose-50/60 dark:bg-rose-500/5" : ""}`}>
                    <td className="py-1.5 font-semibold">{m.label}{m.isProjected && <span className="ml-1 text-gray-400">(upcoming)</span>}</td>
                    <td className="py-1.5 text-right tabular-nums">{PKR(m.due)}</td>
                    <td className="py-1.5 text-right tabular-nums text-emerald-600">{PKR(m.paidOfDue)} <span className="text-gray-400">({m.paidOfDuePercentage}%)</span></td>
                    <td className="py-1.5 text-right tabular-nums text-rose-600">{PKR(m.unpaidOfDue)}</td>
                    <td className="py-1.5 text-right tabular-nums">{PKR(m.recovered)}</td>
                    <td className="py-1.5 text-right tabular-nums">{m.target ? `${PKR(m.target)} (${m.targetPercentage}%)` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail && detail.outlets.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-white/10">
            <h3 className="text-sm font-bold text-dark dark:text-white">Outlet-wise — {detail.label}</h3>
            <ExportMenu title={`Monthly Installments by Outlet ${detail.label}`} columns={[
              { header: "Outlet", value: (o: Detail["outlets"][number]) => o.outlet_name },
              { header: "Installments", value: (o) => o.installments, numeric: true },
              { header: "Due", value: (o) => o.due, numeric: true },
              { header: "Paid", value: (o) => o.paid, numeric: true },
              { header: "Unpaid", value: (o) => o.unpaid, numeric: true },
              { header: "Arrears", value: (o) => o.arrears, numeric: true },
              { header: "Collected in month", value: (o) => o.collected, numeric: true },
            ]} getRows={() => detail.outlets} />
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-2.5">Outlet</th><th className="px-4 py-2.5 text-right">Installments</th><th className="px-4 py-2.5 text-right">Due</th><th className="px-4 py-2.5 text-right">Paid</th><th className="px-4 py-2.5 text-right">Unpaid</th><th className="px-4 py-2.5 text-right">Arrears</th><th className="px-4 py-2.5 text-right">Collected</th></tr></thead>
            <tbody>
              {detail.outlets.map((o) => (
                <tr key={o.outlet_id ?? "none"} className="border-t border-slate-50 dark:border-white/5">
                  <td className="px-4 py-2.5 font-medium text-dark dark:text-white">{o.outlet_name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{o.installments}<span className="text-xs text-gray-400"> ({o.unpaid_count} open)</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{PKR(o.due)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">{PKR(o.paid)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">{PKR(o.unpaid)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-amber-700">{PKR(o.arrears)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{PKR(o.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10">
          <h3 className="text-sm font-bold text-dark dark:text-white">Installment schedule — {detail?.label || month}</h3>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-stroke bg-white px-3 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white">
            <option value="">All</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="overdue">Overdue</option><option value="unpaid">Not yet due</option>
          </select>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, order, phone..." className="w-full rounded-xl border border-stroke bg-white py-1.5 pl-9 pr-3 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <div className="ml-auto">
            <ExportMenu title={`Installment Schedule ${detail?.label || month}`} columns={[
              { header: "Due date", value: (r: ScheduleRow) => day(r.due_date) },
              { header: "Customer", value: (r) => r.customer_name },
              { header: "Phone", value: (r) => r.whatsapp_number },
              { header: "Order", value: (r) => r.order_ref },
              { header: "Outlet", value: (r) => r.outlet_name },
              { header: "Month #", value: (r) => r.month_number, numeric: true },
              { header: "Amount", value: (r) => r.amount, numeric: true },
              { header: "Paid", value: (r) => r.paid, numeric: true },
              { header: "Remaining", value: (r) => r.remaining, numeric: true },
              { header: "Status", value: (r) => r.status },
              { header: "Paid on", value: (r) => day(r.paid_at) },
            ]} getRows={() => schedule} />
          </div>
        </div>
        {detailLoading ? <TableSkeleton /> : schedule.length ? (
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3">Due</th><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Month #</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Remaining</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={`${r.order_id}-${r.month_number}`} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 text-gray-500">{day(r.due_date)}</td>
                    <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{r.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{r.order_ref} · {r.whatsapp_number}</p></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.outlet_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.month_number}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{PKR(r.amount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{r.paid ? PKR(r.paid) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.remaining ? PKR(r.remaining) : "—"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[r.status]}`}>{r.status === "unpaid" ? "not yet due" : r.status}</span></td>
                    <td className="px-4 py-3 text-right">{r.remaining > 0 && <Link href={`/accounts/installment-receiving?order=${r.order_id}`} className="text-xs font-bold text-emerald-600 hover:underline">Receive</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Target} title="No installments in this selection" />}
      </div>
    </>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`text-xl font-black ${tone}`}>{value}</p>
      {note && <p className="mt-1 text-[11px] text-gray-500">{note}</p>}
    </div>
  );
}
