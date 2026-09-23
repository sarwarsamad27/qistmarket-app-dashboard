"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Wallet, Store, UserRound, Banknote, FileBarChart, History, ShieldAlert, Plus, Trash2, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface CashEntry {
  id: number | string;
  source?: string;
  transaction_id: string;
  submission_ref: string | null;
  order_ref: string | null;
  amount: number;
  balance: number;
  type: string;
  status: string;
  description: string;
  payment_method: string;
  transaction_date: string;
  officer: { full_name: string; role: string } | null;
  outlet: { name: string; code: string } | null;
}
interface CashInHandData {
  totalPending: number;
  outletCash: number;
  totalCashInHand: number;
  entries: CashEntry[];
  outletEntries: CashEntry[];
  outletWise: { outlet_id: number | null; outlet_name: string; pending: number; count: number }[];
  officerWise: { officer_id: number | null; officer_name: string; role: string; pending: number; count: number }[];
}
interface ReportRow { period: string; closing_cash: number; installments_received: number; expenses: number; count: number }
interface HistoryRow { id: number; amount_submitted: number; submission_date: string; submission_ref: string; officer: string; outlet: string }
interface LimitRow { id: number; scope_type: string; scope_id: number; name: string; daily_limit: number; current_pending: number; is_over_limit: boolean }

const TABS = [
  { key: "entries" as const, label: "All Entries", icon: Wallet },
  { key: "outlet" as const, label: "Outlet Wise", icon: Store },
  { key: "officer" as const, label: "Officer Wise", icon: UserRound },
  { key: "reports" as const, label: "Reports", icon: FileBarChart },
  { key: "history" as const, label: "Submission History", icon: History },
  { key: "limits" as const, label: "Cash Limits", icon: ShieldAlert },
];

export default function CashInHandPage() {
  const [data, setData] = useState<CashInHandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<(typeof TABS)[number]["key"]>("entries");
  const [search, setSearch] = useState("");
  // Which headline card drives the "All Entries" list: every rupee in hand, or only what officers still hold.
  const [scope, setScope] = useState<"total" | "pending">("total");
  const [historySearch, setHistorySearch] = useState("");

  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  const [limits, setLimits] = useState<LimitRow[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitForm, setLimitForm] = useState({ scope_type: "outlet", scope_id: "", daily_limit: "" });

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/cash-in-hand`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load cash in hand:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (view === "reports") {
      setReportsLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/cash/reports?period=${reportPeriod}`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((json) => { if (json.success) setReports(json.data.series); })
        .finally(() => setReportsLoading(false));
    }
    if (view === "history") {
      setHistoryLoading(true);
      setHistoryPage(1);
      fetch(`${BACKEND_URL}/api/accounts/cash/submission-history?page=1&limit=25`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setHistory(json.data);
            setHistoryTotalPages(json.pagination?.totalPages || 1);
          }
        })
        .finally(() => setHistoryLoading(false));
    }
    if (view === "limits") {
      fetchLimits();
    }
  }, [view, reportPeriod]);

  const loadMoreHistory = () => {
    const nextPage = historyPage + 1;
    setHistoryLoadingMore(true);
    fetch(`${BACKEND_URL}/api/accounts/cash/submission-history?page=${nextPage}&limit=25`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setHistory((prev) => [...prev, ...json.data]);
          setHistoryPage(nextPage);
          setHistoryTotalPages(json.pagination?.totalPages || 1);
        }
      })
      .finally(() => setHistoryLoadingMore(false));
  };

  const fetchLimits = () => {
    setLimitsLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/cash/limits`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setLimits(json.data); })
      .finally(() => setLimitsLoading(false));
  };

  const handleAddLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitForm.scope_id || !limitForm.daily_limit) {
      toast.error("Please fill in scope ID and daily limit.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/cash/limits`, { method: "POST", headers: authHeaders(), body: JSON.stringify(limitForm) });
      if (!res.ok) throw new Error("Failed to save limit.");
      toast.success("Cash limit saved.");
      setLimitForm({ scope_type: "outlet", scope_id: "", daily_limit: "" });
      fetchLimits();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const scopedEntries: CashEntry[] = scope === "pending"
    ? (data?.entries || [])
    : [
        ...(data?.entries || []).map((e) => ({ ...e, id: `officer-${e.id}` })),
        ...(data?.outletEntries || []),
      ].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

  const filteredEntries = scopedEntries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      e.transaction_id?.toLowerCase().includes(q) ||
      e.submission_ref?.toLowerCase().includes(q) ||
      e.order_ref?.toLowerCase().includes(q) ||
      e.officer?.full_name?.toLowerCase().includes(q) ||
      e.outlet?.name?.toLowerCase().includes(q) ||
      e.payment_method?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  const filteredHistory = history.filter((h) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.trim().toLowerCase();
    return (
      h.submission_ref?.toLowerCase().includes(q) ||
      String(h.id).includes(q) ||
      h.officer?.toLowerCase().includes(q) ||
      h.outlet?.toLowerCase().includes(q)
    );
  });

  const handleDeleteLimit = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/accounts/cash/limits/${id}`, { method: "DELETE", headers: authHeaders() });
      toast.success("Limit removed.");
      fetchLimits();
    } catch {
      toast.error("Failed to remove limit.");
    }
  };

  return (
    <>
      <Breadcrumb pageName="Cash In Hand" />
      <PageHeader icon={Wallet} title="Cash In Hand" subtitle="Pending cash sitting with officers, awaiting submission to outlets." />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => { setScope("total"); setView("entries"); }}
          className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br from-emerald-50 to-white p-5 text-left transition dark:from-emerald-500/10 dark:to-transparent ${
            scope === "total" ? "border-emerald-400 ring-2 ring-emerald-400/30 dark:border-emerald-500/60" : "border-emerald-100 hover:border-emerald-300 dark:border-emerald-500/20"
          }`}
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
            <Wallet className="size-6" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600/80">Total Cash In Hand</p>
            <p className="text-3xl font-black leading-tight text-emerald-700 dark:text-emerald-400">{PKR(data?.totalCashInHand || 0)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">At outlets {PKR(data?.outletCash || 0)} + with officers {PKR(data?.totalPending || 0)}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setScope("pending"); setView("entries"); }}
          className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br from-amber-50 to-white p-5 text-left transition dark:from-amber-500/10 dark:to-transparent ${
            scope === "pending" ? "border-amber-400 ring-2 ring-amber-400/30 dark:border-amber-500/60" : "border-amber-100 hover:border-amber-300 dark:border-amber-500/20"
          }`}
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <Banknote className="size-6" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-600/80">Total Pending Cash In Hand</p>
            <p className="text-3xl font-black leading-tight text-amber-700 dark:text-amber-400">{PKR(data?.totalPending || 0)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">With officers, not yet submitted to outlets</p>
          </div>
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              view === tab.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <tab.icon className="size-3.5" /> {tab.key === "entries" ? (scope === "total" ? "All Entries — Total" : "All Entries — Pending") : tab.label}
          </button>
        ))}
      </div>

      {view === "entries" && !loading && (
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by transaction ID, officer, outlet..."
            className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
        </div>
      )}

      {(view === "entries" || view === "outlet" || view === "officer") && (
        loading ? <TableSkeleton /> : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            {view === "entries" && (
              filteredEntries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                      <tr><th className="px-4 py-3 font-bold">Transaction ID</th><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Description</th><th className="px-4 py-3 font-bold">Method</th><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 text-right font-bold">Amount</th></tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry) => (
                        <tr key={entry.id} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                          <td className="px-4 py-3.5">
                            <p className="font-mono text-xs font-semibold text-[#ff3d3d]">{entry.transaction_id}</p>
                            {entry.submission_ref && <p className="font-mono text-[10px] text-gray-400"># {entry.submission_ref}</p>}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-dark dark:text-white">
                            {entry.officer ? <>{entry.officer.full_name} <span className="font-normal text-xs text-gray-400">({entry.officer.role})</span></> : "—"}
                            {scope === "total" && (
                              <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${entry.source ? "text-emerald-600" : "text-amber-600"}`}>{entry.source ? "At outlet" : "With officer"}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{entry.outlet?.name || "—"}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{entry.description}{entry.order_ref ? ` — ${entry.order_ref}` : ""}</td>
                          <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{entry.payment_method}</td>
                          <td className="px-4 py-3.5 text-gray-500">{new Date(entry.transaction_date).toLocaleString()}</td>
                          <td className={`px-4 py-3.5 text-right tabular-nums font-bold ${entry.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>{entry.amount < 0 ? `− ${PKR(-entry.amount)}` : PKR(entry.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={Wallet} title={search ? "No matching entries" : scope === "total" ? "No cash-in-hand entries" : "No pending cash-in-hand entries"} description={search ? "Try a different search term." : scope === "total" ? "No cash is currently held at outlets or with officers." : "All collected cash has been submitted."} />
            )}

            {view === "outlet" && (
              data && data.outletWise.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                      <tr><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Entries</th><th className="px-4 py-3 text-right font-bold">Pending Amount</th></tr>
                    </thead>
                    <tbody>
                      {data.outletWise.map((o) => (
                        <tr key={o.outlet_id ?? "unassigned"} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                          <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{o.outlet_name}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{o.count}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600">{PKR(o.pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={Store} title="No outlet-wise data" />
            )}

            {view === "officer" && (
              data && data.officerWise.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                      <tr><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Role</th><th className="px-4 py-3 text-right font-bold">Entries</th><th className="px-4 py-3 text-right font-bold">Pending Amount</th></tr>
                    </thead>
                    <tbody>
                      {data.officerWise.map((o) => (
                        <tr key={o.officer_id ?? "unassigned"} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                          <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{o.officer_name}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.role}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{o.count}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600">{PKR(o.pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={UserRound} title="No officer-wise data" />
            )}
          </div>
        )
      )}

      {view === "reports" && (
        <div>
          <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button key={p} onClick={() => setReportPeriod(p)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${reportPeriod === p ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{p}</button>
            ))}
          </div>
          {reportsLoading ? <TableSkeleton /> : reports.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr><th className="px-4 py-3 font-bold">Period</th><th className="px-4 py-3 text-right font-bold">Installments Received</th><th className="px-4 py-3 text-right font-bold">Expenses</th><th className="px-4 py-3 text-right font-bold">Closing Cash</th></tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.period} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{r.period}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(r.installments_received)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(r.expenses)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(r.closing_cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={FileBarChart} title="No cash register data for this period" /></div>}
        </div>
      )}

      {view === "history" && (
        <div>
          {!historyLoading && history.length > 0 && (
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by ref, officer, outlet..."
                className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              />
            </div>
          )}
          {historyLoading ? <TableSkeleton /> : filteredHistory.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 font-bold">Ref</th><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Amount</th></tr>
                </thead>
                <tbody>
                  {filteredHistory.map((h) => (
                    <tr key={h.id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 text-gray-500">{new Date(h.submission_date).toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{h.submission_ref}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{h.officer}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{h.outlet}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600">{PKR(h.amount_submitted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historyPage < historyTotalPages && (
                <div className="flex justify-center border-t border-slate-50 p-4 dark:border-white/5">
                  <button
                    onClick={loadMoreHistory}
                    disabled={historyLoadingMore}
                    className="rounded-xl border border-stroke px-5 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#ff3d3d] hover:text-[#ff3d3d] disabled:opacity-50 dark:border-dark-3 dark:text-gray-300"
                  >
                    {historyLoadingMore ? "Loading..." : `Load More (page ${historyPage + 1} of ${historyTotalPages})`}
                  </button>
                </div>
              )}
            </div>
          ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={History} title="No submission history yet" /></div>}
        </div>
      )}

      {view === "limits" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">Set Cash Limit</h2>
            <form onSubmit={handleAddLimit} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Scope</label>
                <select value={limitForm.scope_type} onChange={(e) => setLimitForm({ ...limitForm, scope_type: e.target.value })} className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                  <option value="outlet">Outlet</option>
                  <option value="officer">Officer</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">{limitForm.scope_type === "outlet" ? "Outlet ID" : "Officer (User) ID"}</label>
                <input type="number" value={limitForm.scope_id} onChange={(e) => setLimitForm({ ...limitForm, scope_id: e.target.value })} className="w-40 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Daily Limit (PKR)</label>
                <input type="number" value={limitForm.daily_limit} onChange={(e) => setLimitForm({ ...limitForm, daily_limit: e.target.value })} className="w-40 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90">
                <Plus className="size-4" /> Add Limit
              </button>
            </form>
          </div>

          {limitsLoading ? <TableSkeleton /> : limits.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr><th className="px-4 py-3 font-bold">Scope</th><th className="px-4 py-3 font-bold">Name</th><th className="px-4 py-3 text-right font-bold">Limit</th><th className="px-4 py-3 text-right font-bold">Current Pending</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody>
                  {limits.map((l) => (
                    <tr key={l.id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{l.scope_type}</td>
                      <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{l.name}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(l.daily_limit)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(l.current_pending)}</td>
                      <td className="px-4 py-3.5">
                        {l.is_over_limit ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 dark:bg-rose-500/10">Over Limit</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10">OK</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right"><button onClick={() => handleDeleteLimit(l.id)} className="text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={ShieldAlert} title="No cash limits configured" /></div>}
        </div>
      )}
    </>
  );
}
