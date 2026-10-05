"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Users, CalendarDays, ShieldAlert, X, AlertTriangle, TrendingDown, Search, Clock } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import OutletSelector from "@/components/common/OutletSelector";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

interface Account {
  order_id: number; order_ref: string; customer_name: string; whatsapp_number: string; product_name: string; outlet_id: number | null; outlet_name: string;
  total: number; paid: number; remaining: number; overdue: number; overdue_months: number; days_late: number; bucket: string;
  next_month: number | null; next_due_date: string | null; next_due_amount: number; last_payment: string | null; days_since_payment: number | null; months_left: number; status: string;
}
interface Upcoming { order_id: number; order_ref: string; customer_name: string; whatsapp_number: string; outlet_name: string; month: number; due_date: string; amount: number; partial: boolean }
interface Overview {
  summary: { accounts: number; outstanding: number; overdue: number; overdue_accounts: number; due_next_7: number; due_next_30: number; no_payment_60d: number };
  aging: Record<string, number>;
  accounts: Account[];
  upcoming: Upcoming[];
}
interface ScheduleRow { monthNumber: number; label: string; dueDate: string; dueAmount: number; paidAmount: number; remainingAmount: number; status: string }
interface RiskEntry { order_id: number; order_ref: string; customer_name: string; outlet_name: string; remaining: number; missedCount: number }
interface RiskData { summary: { cleared: number; regular: number; overdue: number; defaulter: number }; tiers: { regular: RiskEntry[]; overdue: RiskEntry[]; defaulter: RiskEntry[] } }

const TABS = [
  { key: "outstanding" as const, label: "Outstanding", icon: Users },
  { key: "overdue" as const, label: "Overdue Tracking", icon: Clock },
  { key: "schedule" as const, label: "Payment Schedules", icon: CalendarDays },
  { key: "risk" as const, label: "Risk Analysis", icon: ShieldAlert },
];
const BUCKETS = [
  { key: "1-30", label: "1–30 days late", color: "#fab219" },
  { key: "31-60", label: "31–60 days late", color: "#ec835a" },
  { key: "61-90", label: "61–90 days late", color: "#e66767" },
  { key: "90+", label: "90+ days late", color: "#d03b3b" },
];
const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  regular: "bg-blue-50 text-blue-700 dark:bg-blue-500/10",
  overdue: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  defaulter: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
  blacklist: "bg-rose-100 text-rose-800 dark:bg-rose-500/20",
};
const card = "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark";
const thead = "sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400";
const sel = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white";

const receiveHref = (orderId: number) => `/accounts/installment-receiving?order=${orderId}`;

export default function AccountsReceivablesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("outstanding");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [bucketFilter, setBucketFilter] = useState("");
  const [dueWindow, setDueWindow] = useState(30);

  const [scheduleOrder, setScheduleOrder] = useState<{ order_id: number; order_ref: string; customer_name: string } | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [risk, setRisk] = useState<RiskData | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskTier, setRiskTier] = useState<"defaulter" | "overdue" | "regular">("defaulter");

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/receivables/overview?outletId=${outletId}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load receivables:", err))
      .finally(() => setLoading(false));
  }, [outletId]);

  useEffect(() => {
    if (tab === "risk" && !risk) {
      setRiskLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/receivables/risk-analysis`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((json) => { if (json.success) setRisk(json.data); })
        .finally(() => setRiskLoading(false));
    }
  }, [tab, risk]);

  const openSchedule = async (row: { order_id: number; order_ref: string; customer_name: string }) => {
    setScheduleOrder(row);
    setScheduleLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/receivables/schedule/${row.order_id}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setSchedule(json.data.schedule);
    } finally {
      setScheduleLoading(false);
    }
  };

  const q = search.trim().toLowerCase();
  const matches = (a: { order_ref: string; customer_name: string; whatsapp_number?: string; outlet_name: string }) =>
    !q || `${a.order_ref} ${a.customer_name} ${a.whatsapp_number || ""} ${a.outlet_name}`.toLowerCase().includes(q);
  const accounts = useMemo(() => (data?.accounts || []).filter((a) => matches(a) && (!statusFilter || a.status === statusFilter)), [data, q, statusFilter]);
  const overdueAccounts = useMemo(() => (data?.accounts || []).filter((a) => a.overdue > 0 && matches(a) && (!bucketFilter || a.bucket === bucketFilter)).sort((a, b) => b.days_late - a.days_late), [data, q, bucketFilter]);
  const upcoming = useMemo(() => {
    const limit = Date.now() + dueWindow * 86400000;
    return (data?.upcoming || []).filter((u) => new Date(u.due_date).getTime() <= limit && matches(u));
  }, [data, q, dueWindow]);
  const tierList = (risk?.tiers[riskTier] || []).filter(matches);
  const maxBucket = Math.max(1, ...BUCKETS.map((b) => data?.aging[b.key] || 0));

  const accountColumns = [
    { header: "Order", value: (a: Account) => a.order_ref },
    { header: "Customer", value: (a: Account) => a.customer_name },
    { header: "Phone", value: (a: Account) => a.whatsapp_number },
    { header: "Outlet", value: (a: Account) => a.outlet_name },
    { header: "Product", value: (a: Account) => a.product_name },
    { header: "Total", value: (a: Account) => a.total, numeric: true },
    { header: "Paid", value: (a: Account) => a.paid, numeric: true },
    { header: "Outstanding", value: (a: Account) => a.remaining, numeric: true },
    { header: "Overdue", value: (a: Account) => a.overdue, numeric: true },
    { header: "Days late", value: (a: Account) => a.days_late || "", numeric: true },
    { header: "Next due", value: (a: Account) => day(a.next_due_date) },
    { header: "Last payment", value: (a: Account) => day(a.last_payment) },
    { header: "Status", value: (a: Account) => a.status },
  ];

  return (
    <>
      <Breadcrumb pageName="Customer Receivables" />
      <PageHeader icon={Users} title="Customer Receivables" subtitle="What every customer still owes, what is overdue and how late, what falls due next, and who is at risk." actions={<OutletSelector selectedId={outletId} onSelect={setOutletId} />} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Total outstanding", data ? PKR(data.summary.outstanding) : "…", "text-purple-700 dark:text-purple-400"],
          ["Overdue", data ? PKR(data.summary.overdue) : "…", "text-rose-600"],
          ["Accounts with dues", data ? String(data.summary.accounts) : "…", "text-dark dark:text-white"],
          ["Overdue accounts", data ? String(data.summary.overdue_accounts) : "…", "text-rose-600"],
          ["Due next 7 days", data ? PKR(data.summary.due_next_7) : "…", "text-amber-600"],
          ["No payment in 60+ days", data ? String(data.summary.no_payment_60d) : "…", "text-rose-700"],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
            <p className={`text-xl font-black ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order ref, customer, phone, outlet..." className={`${sel} w-full pl-9`} />
        </div>
      </div>

      {/* ── Outstanding ── */}
      {tab === "outstanding" && (
        loading ? <TableSkeleton /> : (
          <div className={card}>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={sel}>
                <option value="">All statuses</option><option value="active">Active (nothing overdue)</option><option value="regular">Regular (1 missed)</option><option value="overdue">Overdue</option><option value="defaulter">Defaulter</option><option value="blacklist">Blacklist grade</option>
              </select>
              <p className="text-xs text-gray-500">{accounts.length} account(s) · {PKR(accounts.reduce((s, a) => s + a.remaining, 0))}</p>
              <div className="ml-auto"><ExportMenu title="Customer Receivables" columns={accountColumns} getRows={() => accounts} /></div>
            </div>
            {accounts.length ? (
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3">Next Due</th><th className="px-4 py-3">Last Paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.order_id} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{a.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{a.order_ref} · {a.whatsapp_number}</p></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.outlet_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(a.total)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{PKR(a.paid)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-purple-700 dark:text-purple-400">{PKR(a.remaining)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{a.overdue > 0 ? <span className="font-semibold text-rose-600">{PKR(a.overdue)}<span className="block text-[11px] font-normal">{a.days_late}d late</span></span> : "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{a.next_month ? `M${a.next_month} · ${day(a.next_due_date)}` : "—"}<p>{a.next_due_amount ? PKR(a.next_due_amount) : ""}</p></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{a.last_payment ? <>{day(a.last_payment)}<p className={a.days_since_payment! > 60 ? "font-semibold text-rose-600" : ""}>{a.days_since_payment}d ago</p></> : <span className="font-semibold text-rose-600">Never</span>}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[a.status] || "bg-gray-100 text-gray-600"}`}>{a.status}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button onClick={() => openSchedule(a)} className="mr-3 text-xs font-semibold text-blue-600 hover:underline">Schedule</button>
                          <Link href={receiveHref(a.order_id)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Receive</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={Users} title="No outstanding receivables" description="Every customer balance for this selection is fully cleared." />}
          </div>
        )
      )}

      {/* ── Overdue tracking ── */}
      {tab === "overdue" && (
        loading ? <TableSkeleton /> : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">Overdue amount by how late it is</h3>
              <div className="space-y-2.5">
                {BUCKETS.map((b) => {
                  const v = data?.aging[b.key] || 0;
                  return (
                    <button key={b.key} onClick={() => setBucketFilter(bucketFilter === b.key ? "" : b.key)} className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left ${bucketFilter === b.key ? "bg-slate-100 dark:bg-white/10" : ""}`}>
                      <span className="w-32 shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300">{b.label}</span>
                      <span className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><span className="block h-full rounded-full" style={{ width: `${(v / maxBucket) * 100}%`, backgroundColor: b.color }} /></span>
                      <span className="w-32 shrink-0 text-right text-sm font-bold tabular-nums text-dark dark:text-white">{PKR(v)}</span>
                    </button>
                  );
                })}
                <p className="pt-1 text-xs text-gray-500">Not yet due: <b>{PKR(data?.aging.current || 0)}</b>. Click a bar to list only those accounts.</p>
              </div>
            </div>
            <div className={card}>
              <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-white/10">
                <p className="text-xs text-gray-500">{overdueAccounts.length} overdue account(s){bucketFilter ? ` · ${bucketFilter} days` : ""} · {PKR(overdueAccounts.reduce((s, a) => s + a.overdue, 0))}</p>
                <ExportMenu title="Overdue Customers" columns={accountColumns} getRows={() => overdueAccounts} />
              </div>
              {overdueAccounts.length ? (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={thead}><tr><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3 text-right">Days Late</th><th className="px-4 py-3 text-right">Missed Months</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3 text-right">Total Outstanding</th><th className="px-4 py-3">Last Paid</th><th className="px-4 py-3"></th></tr></thead>
                    <tbody>
                      {overdueAccounts.map((a) => (
                        <tr key={a.order_id} className="border-t border-slate-50 dark:border-white/5">
                          <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{a.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{a.order_ref} · {a.whatsapp_number}</p></td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.outlet_name}</td>
                          <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-600">{a.days_late}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{a.overdue_months}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">{PKR(a.overdue)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{PKR(a.remaining)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{a.last_payment ? day(a.last_payment) : "Never"}</td>
                          <td className="px-4 py-3 text-right"><Link href={receiveHref(a.order_id)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">Receive</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={Clock} title="No overdue accounts" />}
            </div>
          </div>
        )
      )}

      {/* ── Payment schedules ── */}
      {tab === "schedule" && (
        loading ? <TableSkeleton /> : (
          <div className={card}>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10">
              <span className="text-xs font-semibold text-gray-500">Installments falling due in the next</span>
              <select value={dueWindow} onChange={(e) => setDueWindow(parseInt(e.target.value))} className={sel}>
                {[7, 15, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
              </select>
              <p className="text-xs text-gray-500">{upcoming.length} installment(s) · {PKR(upcoming.reduce((s, u) => s + u.amount, 0))} expected</p>
              <div className="ml-auto">
                <ExportMenu title={`Upcoming Installments ${dueWindow} days`} columns={[
                  { header: "Due date", value: (u: Upcoming) => day(u.due_date) },
                  { header: "Customer", value: (u) => u.customer_name },
                  { header: "Phone", value: (u) => u.whatsapp_number },
                  { header: "Order", value: (u) => u.order_ref },
                  { header: "Outlet", value: (u) => u.outlet_name },
                  { header: "Month", value: (u) => u.month },
                  { header: "Amount", value: (u) => u.amount, numeric: true },
                ]} getRows={() => upcoming} />
              </div>
            </div>
            {upcoming.length ? (
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>
                    {upcoming.map((u) => (
                      <tr key={`${u.order_id}-${u.month}`} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3 font-semibold text-dark dark:text-white">{day(u.due_date)}</td>
                        <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{u.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{u.order_ref} · {u.whatsapp_number}</p></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.outlet_name}</td>
                        <td className="px-4 py-3 text-gray-500">M{u.month}{u.partial && <span className="ml-1 text-[11px] text-amber-600">(part paid)</span>}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{PKR(u.amount)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right"><button onClick={() => openSchedule(u)} className="text-xs font-semibold text-blue-600 hover:underline">Full schedule</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={CalendarDays} title="Nothing falls due in this window" />}
          </div>
        )
      )}

      {/* ── Risk ── */}
      {tab === "risk" && (
        riskLoading ? <TableSkeleton /> : risk ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/80">Cleared</p><p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{risk.summary.cleared}</p></div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-500/20 dark:bg-blue-500/10"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600/80">Regular</p><p className="text-xl font-black text-blue-700 dark:text-blue-400">{risk.summary.regular}</p></div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-[10px] font-black uppercase tracking-widest text-amber-600/80">Overdue</p><p className="text-xl font-black text-amber-700 dark:text-amber-400">{risk.summary.overdue}</p></div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10"><p className="text-[10px] font-black uppercase tracking-widest text-rose-600/80">Defaulter</p><p className="text-xl font-black text-rose-700 dark:text-rose-400">{risk.summary.defaulter}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
                {(["defaulter", "overdue", "regular"] as const).map((t) => (
                  <button key={t} onClick={() => setRiskTier(t)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${riskTier === t ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{t}</button>
                ))}
              </div>
              <div className="ml-auto">
                <ExportMenu title={`Risk ${riskTier}`} columns={[
                  { header: "Order", value: (e: RiskEntry) => e.order_ref },
                  { header: "Customer", value: (e) => e.customer_name },
                  { header: "Outlet", value: (e) => e.outlet_name },
                  { header: "Missed months", value: (e) => e.missedCount, numeric: true },
                  { header: "Remaining", value: (e) => e.remaining, numeric: true },
                ]} getRows={() => tierList} />
              </div>
            </div>
            {tierList.length > 0 ? (
              <div className={card}>
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3 font-bold">Order Ref</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Missed</th><th className="px-4 py-3 text-right font-bold">Remaining</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>{tierList.map((e) => (
                    <tr key={e.order_id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{e.order_ref}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{e.customer_name}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{e.outlet_name}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-amber-600">{e.missedCount}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-rose-600">{PKR(e.remaining)}</td>
                      <td className="px-4 py-3.5 text-right"><Link href={receiveHref(e.order_id)} className="text-xs font-bold text-emerald-600 hover:underline">Receive</Link></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className={card}><EmptyState icon={TrendingDown} title={`No customers in the ${riskTier} tier`} /></div>}
          </div>
        ) : <div className={card}><EmptyState icon={AlertTriangle} title="No risk data available" /></div>
      )}

      {scheduleOrder && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setScheduleOrder(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stroke p-6 dark:border-strokedark">
              <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-white">Payment Schedule</h2>
                <p className="text-xs text-gray-500">{scheduleOrder.order_ref} — {scheduleOrder.customer_name}</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href={receiveHref(scheduleOrder.order_id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Receive payment</Link>
                <button onClick={() => setScheduleOrder(null)} className="text-gray-400 transition-all hover:rotate-90 hover:text-red-500"><X size={22} /></button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {scheduleLoading ? <TableSkeleton rows={4} cols={4} /> : schedule.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-6 py-3 font-bold">Month</th><th className="px-6 py-3 font-bold">Due Date</th><th className="px-6 py-3 text-right font-bold">Due</th><th className="px-6 py-3 text-right font-bold">Paid</th><th className="px-6 py-3 text-right font-bold">Remaining</th><th className="px-6 py-3 font-bold">Status</th></tr></thead>
                  <tbody>{schedule.map((s) => {
                    const late = s.status !== "paid" && s.dueDate && new Date(s.dueDate) < new Date(new Date().toDateString());
                    return (
                      <tr key={s.monthNumber} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{s.label}</td>
                        <td className={`px-6 py-3.5 ${late ? "font-semibold text-rose-600" : "text-gray-500"}`}>{day(s.dueDate)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(s.dueAmount)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums text-emerald-600">{PKR(s.paidAmount)}</td>
                        <td className="px-6 py-3.5 text-right tabular-nums">{PKR(s.remainingAmount)}</td>
                        <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.status === "paid" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : late ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{late ? "overdue" : s.status}</span></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              ) : <EmptyState icon={CalendarDays} title="No schedule found" />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
