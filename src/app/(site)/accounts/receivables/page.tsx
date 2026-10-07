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

/**
 * Risk score 0–100 for one account, from four things a recovery manager looks at:
 *   how late (35) · how many installments missed (25) · how long since any payment (20) ·
 *   how much of the deal is still unpaid (10) and how much of that is already overdue (10).
 * 60+ = high, 30–59 = medium, under 30 = low.
 */
const riskOf = (a: Account) => {
  // Each part is clamped to 0…max (a payment dated in the future must not make days negative).
  const clamp = (v: number, max: number) => Math.max(0, Math.min(v || 0, max));
  const late = clamp(a.days_late, 120) / 120 * 35;
  const missed = clamp(a.overdue_months, 4) / 4 * 25;
  const silent = (a.days_since_payment === null ? 90 : clamp(a.days_since_payment, 90)) / 90 * 20;
  const unpaidShare = a.total > 0 ? Math.max(0, Math.min(1, a.remaining / a.total)) * 10 : 0;
  const overdueShare = a.remaining > 0 ? Math.max(0, Math.min(1, a.overdue / a.remaining)) * 10 : 0;
  const score = Math.round(late + missed + silent + unpaidShare + overdueShare);
  const reasons = [
    a.days_late ? `${a.days_late}d late` : "",
    a.overdue_months ? `${a.overdue_months} missed` : "",
    a.days_since_payment === null ? "never paid" : a.days_since_payment > 30 ? `no payment ${a.days_since_payment}d` : "",
  ].filter(Boolean);
  return { score, level: (score >= 60 ? "high" : score >= 30 ? "medium" : "low") as "high" | "medium" | "low", reasons };
};
const RISK_STYLE = {
  high: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
};

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

  const [riskLevel, setRiskLevel] = useState<"" | "high" | "medium" | "low">("high");

  useEffect(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/receivables/overview?outletId=${outletId}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load receivables:", err))
      .finally(() => setLoading(false));
  }, [outletId]);


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
  // Risk: every account with a balance, scored; follows the outlet picker and the search box.
  const scored = useMemo(() => (data?.accounts || []).filter((a) => a.remaining > 0).map((a) => ({ ...a, risk: riskOf(a) })), [data]);
  const riskList = useMemo(() => scored.filter((a) => matches(a) && (!riskLevel || a.risk.level === riskLevel)).sort((x, y) => y.risk.score - x.risk.score), [scored, q, riskLevel]); // eslint-disable-line react-hooks/exhaustive-deps
  const riskSummary = useMemo(() => {
    const lv = { high: { count: 0, amount: 0 }, medium: { count: 0, amount: 0 }, low: { count: 0, amount: 0 } };
    const byStatus: Record<string, { count: number; amount: number }> = {};
    const byOutlet: Record<string, { outlet: string; accounts: number; outstanding: number; overdue: number; high: number; high_amount: number }> = {};
    for (const a of scored) {
      lv[a.risk.level].count += 1; lv[a.risk.level].amount += a.remaining;
      (byStatus[a.status] ||= { count: 0, amount: 0 }); byStatus[a.status].count += 1; byStatus[a.status].amount += a.remaining;
      const o = (byOutlet[a.outlet_name] ||= { outlet: a.outlet_name, accounts: 0, outstanding: 0, overdue: 0, high: 0, high_amount: 0 });
      o.accounts += 1; o.outstanding += a.remaining; o.overdue += a.overdue;
      if (a.risk.level === "high") { o.high += 1; o.high_amount += a.remaining; }
    }
    return { lv, byStatus, byOutlet: Object.values(byOutlet).sort((x, y) => y.high_amount - x.high_amount || y.overdue - x.overdue) };
  }, [scored]);
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
        loading ? <TableSkeleton /> : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["high", "medium", "low"] as const).map((lv) => (
                <button key={lv} onClick={() => setRiskLevel(riskLevel === lv ? "" : lv)} className={`rounded-2xl border p-4 text-left shadow-sm ${riskLevel === lv ? "ring-2 ring-[#ff3d3d]/30 border-[#ff3d3d]" : "border-slate-100 dark:border-white/10"} bg-white dark:bg-boxdark`}>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${RISK_STYLE[lv]}`}>{lv} risk</span>
                  <p className="mt-1.5 text-xl font-black text-dark dark:text-white">{riskSummary.lv[lv].count} <span className="text-sm font-semibold text-gray-500">customers</span></p>
                  <p className="text-xs text-gray-500">{PKR(riskSummary.lv[lv].amount)} still owed</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">Risk score (0–100) = how late + installments missed + days since the last payment + how much is unpaid / already overdue. <b>60+ high</b>, 30–59 medium, under 30 low. Follows the outlet picker and search above.</p>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              <div className={`${card} p-4`}>
                <h3 className="mb-2 text-sm font-bold text-dark dark:text-white">By account status</h3>
                <table className="w-full text-sm"><tbody>
                  {(["active", "regular", "overdue", "defaulter", "blacklist"] as const).map((st) => (
                    <tr key={st} className="border-t border-slate-100 first:border-0 dark:border-white/5">
                      <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[st]}`}>{st}</span></td>
                      <td className="py-1.5 text-right tabular-nums text-gray-500">{riskSummary.byStatus[st]?.count || 0}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{PKR(riskSummary.byStatus[st]?.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
              <div className={`${card} p-4 xl:col-span-2`}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-dark dark:text-white">Outlet-wise exposure</h3>
                  <ExportMenu title="Receivables risk by outlet" columns={[
                    { header: "Outlet", value: (o: (typeof riskSummary.byOutlet)[number]) => o.outlet },
                    { header: "Accounts", value: (o) => o.accounts, numeric: true },
                    { header: "Outstanding", value: (o) => o.outstanding, numeric: true },
                    { header: "Overdue", value: (o) => o.overdue, numeric: true },
                    { header: "High-risk customers", value: (o) => o.high, numeric: true },
                    { header: "Owed by high-risk", value: (o) => o.high_amount, numeric: true },
                  ]} getRows={() => riskSummary.byOutlet} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[11px] uppercase text-gray-400"><tr><th className="py-1.5">Outlet</th><th className="py-1.5 text-right">Accounts</th><th className="py-1.5 text-right">Outstanding</th><th className="py-1.5 text-right">Overdue</th><th className="py-1.5 text-right">Overdue %</th><th className="py-1.5 text-right">High risk</th></tr></thead>
                    <tbody>{riskSummary.byOutlet.map((o) => (
                      <tr key={o.outlet} className="border-t border-slate-100 dark:border-white/5">
                        <td className="py-1.5 font-medium text-dark dark:text-white">{o.outlet}</td>
                        <td className="py-1.5 text-right tabular-nums">{o.accounts}</td>
                        <td className="py-1.5 text-right tabular-nums">{PKR(o.outstanding)}</td>
                        <td className="py-1.5 text-right tabular-nums text-rose-600">{PKR(o.overdue)}</td>
                        <td className="py-1.5 text-right tabular-nums">{o.outstanding ? Math.round((o.overdue / o.outstanding) * 1000) / 10 : 0}%</td>
                        <td className="py-1.5 text-right tabular-nums"><span className="font-semibold text-rose-600">{o.high}</span><span className="block text-[11px] text-gray-400">{PKR(o.high_amount)}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className={card}>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10">
                <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as typeof riskLevel)} className={sel}>
                  <option value="">All risk levels</option><option value="high">High risk</option><option value="medium">Medium risk</option><option value="low">Low risk</option>
                </select>
                <p className="text-xs text-gray-500">{riskList.length} customer(s) · {PKR(riskList.reduce((s2, a) => s2 + a.remaining, 0))} owed</p>
                <div className="ml-auto">
                  <ExportMenu title={`Receivables risk${riskLevel ? ` ${riskLevel}` : ""}`} columns={[
                    { header: "Risk score", value: (a: (typeof riskList)[number]) => a.risk.score, numeric: true },
                    { header: "Risk", value: (a) => a.risk.level },
                    { header: "Why", value: (a) => a.risk.reasons.join(", ") },
                    { header: "Order", value: (a) => a.order_ref },
                    { header: "Customer", value: (a) => a.customer_name },
                    { header: "Phone", value: (a) => a.whatsapp_number },
                    { header: "Outlet", value: (a) => a.outlet_name },
                    { header: "Status", value: (a) => a.status },
                    { header: "Overdue", value: (a) => a.overdue, numeric: true },
                    { header: "Outstanding", value: (a) => a.remaining, numeric: true },
                    { header: "Last payment", value: (a) => day(a.last_payment) },
                  ]} getRows={() => riskList} />
                </div>
              </div>
              {riskList.length ? (
                <div className="max-h-[600px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={thead}><tr><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Why</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3"></th></tr></thead>
                    <tbody>{riskList.map((a) => (
                      <tr key={a.order_id} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3"><span className={`inline-flex min-w-[52px] justify-center rounded-full px-2 py-0.5 text-xs font-black ${RISK_STYLE[a.risk.level]}`}>{a.risk.score}</span></td>
                        <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{a.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{a.order_ref} · {a.whatsapp_number}</p></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.outlet_name}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{a.risk.reasons.join(" · ") || "—"}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[a.status] || "bg-gray-100 text-gray-600"}`}>{a.status}</span></td>
                        <td className="px-4 py-3 text-right tabular-nums text-rose-600">{a.overdue ? PKR(a.overdue) : "—"}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">{PKR(a.remaining)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button onClick={() => openSchedule(a)} className="mr-3 text-xs font-semibold text-blue-600 hover:underline">Schedule</button>
                          <Link href={receiveHref(a.order_id)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white">Receive</Link>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <EmptyState icon={TrendingDown} title="No customers at this risk level" />}
            </div>
          </div>
        )
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
