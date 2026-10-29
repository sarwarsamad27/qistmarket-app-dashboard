"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Circle,
  MapPin,
  RotateCcw,
  Route,
  Target,
  TrendingUp,
  Users2,
  Wallet,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import { getErrorMessage } from "@/lib/apiErrors";
import { pktAddDays, pktDate, pktMonthStart } from "@/utils/pkt";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
const cardClass = "rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark";
const selectClass = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-dark focus:border-[#ff3d3d] focus:outline-none dark:border-white/10 dark:bg-dark-2 dark:text-white";

type Range = "Day" | "Week" | "Month";

interface Officer {
  id: number;
  full_name: string;
  username: string;
  phone: string;
  account_status: string;
  is_online: boolean;
  current_location: { latitude: number; longitude: number } | null;
  last_known_location: { latitude: number; longitude: number; timestamp: string | null } | null;
  current_assignment: { order: { order_ref: string; customer_name: string } } | null;
  monthly_online_hours: string;
}

interface OfficerCollection {
  officer_id: number;
  officer_name: string;
  assigned_orders: number;
  total_recovered: number;
  recoveries: { order_id: number; amount: number }[];
}

interface MissedItem {
  order_id: number;
  order_ref: string;
  customer_name: string;
  officer_id: number;
  officer_name: string;
}

interface FieldOfficer {
  id: number;
  full_name: string;
  stats: { visits?: number; collections?: number; amount_collected?: number };
}

interface Assignment {
  officer_id?: number;
  id?: number;
  full_name?: string;
  username?: string;
  officerAssignments?: { zone: string; area: string }[];
}

interface Target {
  officer_id: number;
  month: string;
  target_amount: number;
  target_customers: number;
  achieved?: number;
  achievedCustomers?: number;
}

interface RecoveryAnalytics {
  totalDue: number;
  totalRecovered: number;
  recoveryPercentage: number;
  outletWise: { outlet_id: number | null; outlet_name: string; due: number; recovered: number; recoveryPercentage: number }[];
  officerWise: { officer_id: number | null; officer_name: string; due: number; recovered: number; recoveryPercentage: number }[];
}

interface RecoveryChannel {
  key: string;
  label: string;
  online: boolean;
  amount: number;
  count: number;
  share: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  targets?: Target[];
  message?: string;
  error?: { message?: string };
}

async function fetchApi<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${BACKEND_URL}${path}`, { headers: authHeaders() });
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success) {
    throw new Error(json.message || json.error?.message || `Request failed (${response.status})`);
  }
  return json;
}

function getRangeDates(range: Range) {
  const today = pktDate();
  if (range === "Day") return { from: today, to: today };
  if (range === "Week") return { from: pktAddDays(-6), to: today };
  return { from: pktMonthStart(), to: today };
}

function formatMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

export default function AdminRecoveryManagementPage() {
  const [range, setRange] = useState<Range>("Day");
  const [targetMonth, setTargetMonth] = useState(() => pktDate().slice(0, 7));
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [recoveries, setRecoveries] = useState<OfficerCollection[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [fieldOfficers, setFieldOfficers] = useState<FieldOfficer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [analytics, setAnalytics] = useState<RecoveryAnalytics | null>(null);
  const [channels, setChannels] = useState<RecoveryChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetCustomers, setTargetCustomers] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  const period = useMemo(() => getRangeDates(range), [range]);
  const targetPeriod = useMemo(() => {
    const [year, month] = targetMonth.split("-").map(Number);
    const monthStart = `${targetMonth}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const end = targetMonth === pktDate().slice(0, 7) ? pktDate() : lastDay;
    return { from: monthStart, to: end };
  }, [targetMonth]);

  useEffect(() => {
    let active = true;
    const rangeQuery = `startDate=${period.from}&endDate=${period.to}`;
    const trackingQuery = `role=recovery&from=${period.from}&to=${period.to}`;
    setLoading(true);
    setLoadError("");

    Promise.all([
      fetchApi<{ officers: Officer[] }>("/api/recovery/officers"),
      fetchApi<OfficerCollection[]>(`/api/outlet-reports/officer-recoveries?${rangeQuery}`),
      fetchApi<{ items: MissedItem[] }>("/api/admin-panel/recovery/missed"),
      fetchApi<{ officers: FieldOfficer[] }>(`/api/officer-tracking/officers?${trackingQuery}`),
      fetchApi<Assignment[]>("/api/assignments/officers?role=recovery&all=true"),
      fetchApi<Target>(`/api/targets/officer?month=${targetMonth}`),
      fetchApi<OfficerCollection[]>(`/api/outlet-reports/officer-recoveries?startDate=${targetPeriod.from}&endDate=${targetPeriod.to}`),
      fetchApi<RecoveryAnalytics>(`/api/accounts/recovery-analytics?range=Custom&startDate=${period.from}&endDate=${period.to}`),
      fetchApi<{ channels: RecoveryChannel[] }>(`/api/accounts/online/recovery-channels?${rangeQuery}`),
      fetchApi<{ order_id: number; balance: number }[]>("/api/outlet-reports/recovery"),
    ])
      .then(([officerJson, collectionJson, missedJson, fieldJson, assignmentJson, targetJson, targetCollectionJson, analyticsJson, channelJson, pendingJson]) => {
        if (!active) return;
        const collectionRows = collectionJson.data || [];
        const monthlyCollections = new Map(
          (targetCollectionJson.data || []).map((officer) => [officer.officer_id, {
            amount: officer.total_recovered,
            customers: new Set(officer.recoveries.map((recovery) => recovery.order_id)).size,
          }]),
        );
        const recoveryOfficers = officerJson.data?.officers || [];
        const recoveryOfficerIds = new Set(recoveryOfficers.map((officer) => officer.id));
        setOfficers(recoveryOfficers);
        setRecoveries(collectionRows);
        setMissed(missedJson.data?.items || []);
        setFieldOfficers(fieldJson.data?.officers || []);
        setAssignments(assignmentJson.data || []);
        setTargets((targetJson.targets || []).filter((target) => recoveryOfficerIds.has(target.officer_id)).map((target) => {
          const achieved = monthlyCollections.get(target.officer_id);
          return {
            ...target,
            achieved: achieved?.amount || 0,
            achievedCustomers: achieved?.customers || 0,
          };
        }));
        setAnalytics(analyticsJson.data || null);
        setChannels(channelJson.data?.channels || []);
        setPendingTotal((pendingJson.data || []).reduce((sum, item) => sum + (Number(item.balance) || 0), 0));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(getErrorMessage(error, "Unable to load recovery management data."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period, targetMonth, targetPeriod, refreshKey]);

  const recoveryByOfficerId = useMemo(
    () => new Map(recoveries.map((recovery) => [recovery.officer_id, recovery])),
    [recoveries],
  );
  const assignmentByOfficerId = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.officer_id ?? assignment.id ?? 0, assignment])),
    [assignments],
  );
  const fieldByOfficerId = useMemo(
    () => new Map(fieldOfficers.map((officer) => [officer.id, officer])),
    [fieldOfficers],
  );
  const targetByOfficerId = useMemo(
    () => new Map(targets.map((target) => [target.officer_id, target])),
    [targets],
  );

  const totals = useMemo(() => ({
    onlineOfficers: officers.filter((officer) => officer.is_online).length,
    totalOfficers: officers.length,
    totalRecovered: recoveries.reduce((sum, recovery) => sum + recovery.total_recovered, 0),
    cash: channels.filter((channel) => ["officer", "counter"].includes(channel.key)).reduce((sum, channel) => sum + channel.amount, 0),
    online: channels.filter((channel) => channel.online).reduce((sum, channel) => sum + channel.amount, 0),
  }), [officers, recoveries, channels]);

  const handleAssignTarget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOfficer || !targetAmount || !targetCustomers) {
      toast.error("Choose an officer and enter both target values.");
      return;
    }

    setSavingTarget(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/targets/officer`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          officer_id: Number(selectedOfficer),
          month: targetMonth,
          target_amount: Number(targetAmount),
          target_customers: Number(targetCustomers),
        }),
      });
      const json = (await response.json()) as ApiResponse<Target>;
      if (!response.ok || !json.success) {
        throw new Error(json.message || json.error?.message || "Could not assign the target.");
      }
      toast.success(json.message || "Recovery target assigned.");
      setSelectedOfficer("");
      setTargetAmount("");
      setTargetCustomers("");
      setRefreshKey((key) => key + 1);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not assign the target."));
    } finally {
      setSavingTarget(false);
    }
  };

  const untargetedOfficers = officers.filter((officer) => !targetByOfficerId.has(officer.id));

  return (
    <>
      <Breadcrumb pageName="Recovery Management" />
      <PageHeader
        icon={RotateCcw}
        title="Recovery Management"
        subtitle="Assignments, collections, monthly targets, field activity, and recovery analytics."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/recovery-assignments" className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-dark hover:border-[#ff3d3d] dark:border-white/10 dark:text-white">
              <Route className="size-4" /> Manage routes
            </Link>
            <Link href="/accounts/recovery-analytics" className="inline-flex items-center gap-2 rounded-xl bg-[#ff3d3d] px-3 py-2 text-xs font-bold text-white hover:bg-red-600">
              Full analytics <ArrowUpRight className="size-4" />
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <CalendarDays className="size-4" />
          Collections and rankings: {period.from} to {period.to}
        </div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          {(["Day", "Week", "Month"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${range === value ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
            >
              {value === "Day" ? "Today" : value === "Week" ? "7 days" : "This month"}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div><p className="font-bold">Recovery data could not be loaded.</p><p>{loadError}</p></div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard icon={Users2} label="Recovery Officers" value={loading ? "—" : totals.totalOfficers} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
        <StatCard icon={Circle} label="Online Now" value={loading ? "—" : totals.onlineOfficers} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
        <StatCard icon={TrendingUp} label={`Collected · ${range}`} value={loading ? "—" : PKR(totals.totalRecovered)} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        <StatCard icon={Wallet} label="Cash Recovery" value={loading ? "—" : PKR(totals.cash)} accent="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" bar="bg-amber-500" />
        <StatCard icon={Wallet} label="Online Recovery" value={loading ? "—" : PKR(totals.online)} accent="text-cyan-600" bg="bg-cyan-50 dark:bg-cyan-500/10" bar="bg-cyan-500" />
        <StatCard icon={TrendingUp} label="Global Recovery %" value={loading ? "—" : `${analytics?.recoveryPercentage ?? 0}%`} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" />
        <StatCard icon={Wallet} label="Pending Recovery" value={loading ? "—" : PKR(pendingTotal)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
      </div>

      <section className={`${cardClass} mb-6`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-dark dark:text-white">Recovery assignments and routes</h2>
            <p className="mt-1 text-xs text-gray-500">Active assigned accounts and the recovery areas assigned to each officer.</p>
          </div>
          <Link href="/admin/recovery-assignments" className="text-xs font-bold text-[#ff3d3d] hover:underline">Edit route areas</Link>
        </div>
        {loading ? <TableSkeleton rows={3} cols={4} /> : officers.length === 0 ? (
          <EmptyState icon={Users2} title="No recovery officers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-3 py-3">Officer</th><th className="px-3 py-3 text-right">Assigned accounts</th><th className="px-3 py-3">Route / areas</th><th className="px-3 py-3">Current account</th></tr>
              </thead>
              <tbody>
                {officers.map((officer) => {
                  const recovery = recoveryByOfficerId.get(officer.id);
                  const assignment = assignmentByOfficerId.get(officer.id);
                  return (
                    <tr key={officer.id} className="border-t border-slate-100 dark:border-white/5">
                      <td className="px-3 py-3"><p className="font-semibold text-dark dark:text-white">{officer.full_name}</p><p className="text-xs text-gray-400">@{officer.username}</p></td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{recovery?.assigned_orders ?? 0}</td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-xl flex-wrap gap-1.5">
                          {(assignment?.officerAssignments || []).length === 0
                            ? <span className="text-xs text-gray-400">No route areas assigned</span>
                            : assignment?.officerAssignments?.map((area) => <span key={`${area.zone}-${area.area}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{area.area} · {area.zone}</span>)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">{officer.current_assignment ? `${officer.current_assignment.order.order_ref} · ${officer.current_assignment.order.customer_name}` : "No live account"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className={cardClass}>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-dark dark:text-white">Daily collection tracking and officer performance</h2>
            <p className="mt-1 text-xs text-gray-500">Ledger-attributed collections for the selected period, visits, active accounts, and current-month target progress.</p>
          </div>
          {loading ? <TableSkeleton rows={4} cols={5} /> : officers.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No officer collection activity" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr><th className="px-3 py-3">Officer</th><th className="px-3 py-3 text-right">Collections</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3 text-right">Visits</th><th className="px-3 py-3">Monthly target</th></tr>
                </thead>
                <tbody>
                  {[...officers].sort((a, b) => (recoveryByOfficerId.get(b.id)?.total_recovered || 0) - (recoveryByOfficerId.get(a.id)?.total_recovered || 0)).map((officer) => {
                    const recovery = recoveryByOfficerId.get(officer.id);
                    const field = fieldByOfficerId.get(officer.id);
                    const target = targetByOfficerId.get(officer.id);
                    const achieved = target?.achieved || 0;
                    const progress = target?.target_amount ? Math.min(100, Math.round((achieved / target.target_amount) * 100)) : 0;
                    return (
                      <tr key={officer.id} className="border-t border-slate-100 dark:border-white/5">
                        <td className="px-3 py-3 font-semibold text-dark dark:text-white">{officer.full_name}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{recovery?.recoveries.length ?? 0}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-600">{PKR(recovery?.total_recovered ?? 0)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{field?.stats.visits ?? 0}</td>
                        <td className="min-w-44 px-3 py-3">
                          {target ? (
                            <>
                              <div className="mb-1 flex justify-between gap-2 text-[11px]"><span className="font-semibold text-dark dark:text-white">{PKR(achieved)} / {PKR(target.target_amount)}</span><span className="text-gray-500">{progress}%</span></div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                            </>
                          ) : <span className="text-xs text-gray-400">No target set</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-bold text-dark dark:text-white">Recovery targets · {formatMonth(targetMonth)}</h2><p className="mt-1 text-xs text-gray-500">Assign an officer’s monthly amount and customer targets.</p></div>
            <Target className="size-5 text-[#ff3d3d]" />
          </div>
          <form onSubmit={handleAssignTarget} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-gray-500 sm:col-span-2">Target month<input type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} className={`${selectClass} mt-1.5 w-full`} /></label>
            <label className="text-xs font-semibold text-gray-500 sm:col-span-2">Officer<select value={selectedOfficer} onChange={(event) => setSelectedOfficer(event.target.value)} className={`${selectClass} mt-1.5 w-full`}><option value="">Select recovery officer</option>{untargetedOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name}</option>)}</select></label>
            <label className="text-xs font-semibold text-gray-500">Amount target (PKR)<input type="number" min="1" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} className={`${selectClass} mt-1.5 w-full`} placeholder="e.g. 250000" /></label>
            <label className="text-xs font-semibold text-gray-500">Customer target<input type="number" min="1" step="1" value={targetCustomers} onChange={(event) => setTargetCustomers(event.target.value)} className={`${selectClass} mt-1.5 w-full`} placeholder="e.g. 80" /></label>
            <button type="submit" disabled={savingTarget || !untargetedOfficers.length} className="rounded-xl bg-[#ff3d3d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{savingTarget ? "Assigning…" : "Assign monthly target"}</button>
          </form>
          <p className="mb-3 text-[11px] text-gray-400">Targets are set once per officer per month, following the existing target policy.</p>
          {loading ? <TableSkeleton rows={2} cols={3} /> : targets.length === 0 ? <EmptyState icon={Target} title="No targets set for this month" /> : (
            <div className="space-y-2">
              {targets.map((target) => {
                const officer = officers.find((item) => item.id === target.officer_id);
                const achieved = target.achieved || 0;
                const achievedCustomers = target.achievedCustomers || 0;
                const progress = target.target_amount > 0 ? Math.min(100, Math.round((achieved / target.target_amount) * 100)) : 0;
                const customerProgress = target.target_customers > 0 ? Math.min(100, Math.round((achievedCustomers / target.target_customers) * 100)) : 0;
                return <div key={target.officer_id} className="rounded-xl bg-gray-50 p-3 dark:bg-dark-2"><div className="mb-1 flex justify-between gap-2"><span className="text-xs font-bold text-dark dark:text-white">{officer?.full_name || `Officer #${target.officer_id}`}</span><span className="text-xs font-semibold text-gray-500">{progress}% amount</span></div><div className="mb-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><p className="text-[11px] text-gray-500">{PKR(achieved)} / {PKR(target.target_amount)} · {achievedCustomers} / {target.target_customers} unique customers ({customerProgress}%)</p></div>;
              })}
            </div>
          )}
        </section>
      </div>

      <section className={`${cardClass} mb-6`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-sm font-bold text-dark dark:text-white">Field recovery monitoring</h2><p className="mt-1 text-xs text-gray-500">Current online state, GPS coordinates, visit activity, and live account.</p></div>
          <Link href="/admin/officer-tracking" className="text-xs font-bold text-[#ff3d3d] hover:underline">Open field activity details</Link>
        </div>
        {loading ? <TableSkeleton rows={3} cols={5} /> : officers.length === 0 ? <EmptyState icon={MapPin} title="No officer field activity" /> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {officers.map((officer) => {
              const location = officer.current_location || officer.last_known_location;
              const field = fieldByOfficerId.get(officer.id);
              const coords = location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "";
              return (
                <div key={officer.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/10">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div><p className="font-bold text-dark dark:text-white">{officer.full_name}</p><p className="text-xs text-gray-400">{field?.stats.visits ?? 0} visits · {officer.monthly_online_hours}h online this month</p></div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${officer.is_online ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}><Circle className={`size-2 ${officer.is_online ? "fill-emerald-500 text-emerald-500" : "fill-gray-400 text-gray-400"}`} />{officer.is_online ? "Online" : "Offline"}</span>
                  </div>
                  <p className="mb-2 truncate text-xs text-gray-600 dark:text-gray-300">{officer.current_assignment ? `${officer.current_assignment.order.order_ref} · ${officer.current_assignment.order.customer_name}` : "No current account assignment"}</p>
                  {location ? <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"><MapPin className="size-3.5" />{coords}{!officer.is_online && officer.last_known_location?.timestamp ? ` · last seen ${new Date(officer.last_known_location.timestamp).toLocaleString("en-PK")}` : ""}</a> : <p className="text-xs text-gray-400">GPS location not available</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className={cardClass}>
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-dark dark:text-white">Outlet recovery rankings</h2><p className="mt-1 text-xs text-gray-500">Recovery against installments due in the selected period.</p></div><span className="text-xs font-bold text-gray-500">{analytics ? `${PKR(analytics.totalRecovered)} / ${PKR(analytics.totalDue)}` : "—"}</span></div>
          {loading ? <TableSkeleton rows={3} cols={3} /> : !analytics?.outletWise.length ? <EmptyState icon={TrendingUp} title="No outlet dues in this period" /> : (
            <div className="space-y-3">{[...analytics.outletWise].sort((a, b) => b.recoveryPercentage - a.recoveryPercentage).map((outlet, index) => <div key={outlet.outlet_id ?? outlet.outlet_name} className="flex items-center gap-3"><span className="w-6 text-xs font-bold text-gray-400">{index + 1}</span><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-semibold text-dark dark:text-white">{outlet.outlet_name}</span><span className="font-bold text-emerald-600">{outlet.recoveryPercentage}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, outlet.recoveryPercentage)}%` }} /></div><p className="mt-1 text-[10px] text-gray-400">{PKR(outlet.recovered)} recovered of {PKR(outlet.due)}</p></div></div>)}</div>
          )}
        </section>

        <section className={cardClass}>
          <div className="mb-4"><h2 className="text-sm font-bold text-dark dark:text-white">Officer recovery rankings</h2><p className="mt-1 text-xs text-gray-500">Ranked by recovery percentage for the selected period.</p></div>
          {loading ? <TableSkeleton rows={3} cols={3} /> : !analytics?.officerWise.length ? <EmptyState icon={Users2} title="No officer dues in this period" /> : (
            <div className="space-y-3">{[...analytics.officerWise].sort((a, b) => b.recoveryPercentage - a.recoveryPercentage).slice(0, 10).map((officer, index) => <div key={officer.officer_id ?? officer.officer_name} className="flex items-center gap-3"><span className="w-6 text-xs font-bold text-gray-400">{index + 1}</span><div className="min-w-0 flex-1"><div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-semibold text-dark dark:text-white">{officer.officer_name}</span><span className="font-bold text-emerald-600">{officer.recoveryPercentage}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, officer.recoveryPercentage)}%` }} /></div><p className="mt-1 text-[10px] text-gray-400">{PKR(officer.recovered)} recovered of {PKR(officer.due)}</p></div></div>)}</div>
          )}
        </section>
      </div>

      <section className={`${cardClass} mb-6`}>
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-dark dark:text-white">Cash, online, and channel-wise recovery</h2><p className="mt-1 text-xs text-gray-500">Exact payment channels: recovery officer, outlet counter, 1Bill, SmartPay/QR, bank, and other recorded sources.</p></div><Link href="/accounts/online-payments" className="text-xs font-bold text-[#ff3d3d] hover:underline">Channel report</Link></div>
        {loading ? <TableSkeleton rows={3} cols={4} /> : channels.length === 0 ? <EmptyState icon={Wallet} title="No payment channel data for this period" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-3 py-3">Channel</th><th className="px-3 py-3">Type</th><th className="px-3 py-3 text-right">Recovered</th><th className="px-3 py-3 text-right">Payments</th><th className="px-3 py-3 text-right">Share</th></tr></thead>
              <tbody>{channels.map((channel) => <tr key={channel.key} className="border-t border-slate-100 dark:border-white/5"><td className="px-3 py-3 font-semibold text-dark dark:text-white">{channel.label}</td><td className="px-3 py-3 text-xs text-gray-500">{channel.online ? "Online" : ["officer", "counter"].includes(channel.key) ? "Cash" : "Other"}</td><td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-600">{PKR(channel.amount)}</td><td className="px-3 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{channel.count}</td><td className="px-3 py-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{channel.share}%</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClass}>
        <div className="mb-1 flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /><h2 className="text-sm font-bold text-dark dark:text-white">Missed recovery tracking</h2><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{missed.length}</span></div>
        <p className="mb-4 text-xs text-gray-500">Delivered accounts with no recorded recovery visit during the last 14 days.</p>
        {loading ? <TableSkeleton rows={3} cols={4} /> : missed.length === 0 ? <EmptyState icon={AlertTriangle} title="No missed recoveries" description="All currently assigned accounts had a recovery visit within the last 14 days." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-3 py-3">S.No</th><th className="px-3 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Officer</th></tr></thead>
              <tbody>{missed.map((item, index) => <tr key={item.order_id} className="border-t border-slate-100 dark:border-white/5"><td className="px-3 py-3 tabular-nums text-gray-500">{index + 1}</td><td className="px-3 py-3 font-semibold text-[#ff3d3d]">{item.order_ref}</td><td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.customer_name}</td><td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.officer_name}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
