"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import { RotateCcw, Users2, Wallet, TrendingUp, Circle, AlertTriangle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface Officer {
  id: number;
  full_name: string;
  username: string;
  phone: string;
  account_status: string;
  is_online: boolean;
  bike_km_range: number | null;
  working_hours: string | null;
  current_assignment: { order: { order_ref: string; customer_name: string } } | null;
  monthly_online_hours: string;
}

interface OfficerRecovery {
  officer_id: number;
  officer_name: string;
  officer_phone: string;
  assigned_orders: number;
  total_recovered: number;
}

interface MissedItem { order_id: number; order_ref: string; customer_name: string; officer_id: number; officer_name: string }

export default function AdminRecoveryManagementPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [recoveries, setRecoveries] = useState<OfficerRecovery[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [missedLoading, setMissedLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/api/recovery/officers`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/outlet-reports/officer-recoveries`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/outlet-reports/recovery`, { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([officersJson, recoveriesJson, pendingJson]) => {
        if (officersJson.success) setOfficers(officersJson.data.officers || []);
        if (recoveriesJson.success) setRecoveries(recoveriesJson.data || []);
        if (pendingJson.success) {
          const total = (pendingJson.data || []).reduce((s: number, o: any) => s + (o.balance || 0), 0);
          setPendingTotal(total);
        }
      })
      .catch((err) => console.error("Failed to load recovery management data:", err))
      .finally(() => setLoading(false));

    fetch(`${BACKEND_URL}/api/admin-panel/recovery/missed`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setMissed(json.data.items || []); })
      .catch((err) => console.error("Failed to load missed recovery tracking:", err))
      .finally(() => setMissedLoading(false));
  }, []);

  const recoveryByOfficerId = useMemo(() => {
    const map: Record<number, OfficerRecovery> = {};
    for (const r of recoveries) map[r.officer_id] = r;
    return map;
  }, [recoveries]);

  const totals = useMemo(() => ({
    onlineOfficers: officers.filter((o) => o.is_online).length,
    totalOfficers: officers.length,
    totalRecovered: recoveries.reduce((s, r) => s + r.total_recovered, 0),
    pending: pendingTotal,
  }), [officers, recoveries, pendingTotal]);

  return (
    <>
      <Breadcrumb pageName="Recovery Management" />
      <PageHeader icon={RotateCcw} title="Recovery Management" subtitle="Officer roster, live status, and collection performance company-wide." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users2} label="Recovery Officers" value={totals.totalOfficers} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
        <StatCard icon={Circle} label="Online Now" value={totals.onlineOfficers} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
        <StatCard icon={TrendingUp} label="Total Recovered" value={PKR(totals.totalRecovered)} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        <StatCard icon={Wallet} label="Pending Recovery" value={PKR(totals.pending)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : officers.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={RotateCcw} title="No recovery officers found" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Current Job</th><th className="px-4 py-3 text-right font-bold">Assigned Orders</th><th className="px-4 py-3 text-right font-bold">Recovered</th><th className="px-4 py-3 text-right font-bold">Monthly Hours</th></tr>
            </thead>
            <tbody>
              {officers.map((o, idx) => {
                const rec = recoveryByOfficerId[o.id];
                return (
                  <tr key={o.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 text-gray-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-dark dark:text-white">{o.full_name}</p>
                      <p className="text-xs text-gray-400">@{o.username} · {o.phone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${o.is_online ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>
                        <Circle className={`size-2 ${o.is_online ? "fill-emerald-500 text-emerald-500" : "fill-gray-400 text-gray-400"}`} />
                        {o.is_online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.current_assignment ? `${o.current_assignment.order.order_ref} — ${o.current_assignment.order.customer_name}` : "—"}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{rec?.assigned_orders ?? 0}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600">{PKR(rec?.total_recovered ?? 0)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-500">{o.monthly_online_hours}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><AlertTriangle className="size-4 text-amber-500" /> Missed Recovery Tracking</h2>
        <p className="mb-3 text-xs text-gray-400">Assigned orders with zero recovery visits logged in the last 14 days.</p>
        {missedLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : missed.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={AlertTriangle} title="No missed recoveries" description="Every assigned order has had a visit in the last 14 days." /></div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Officer</th></tr></thead>
              <tbody>
                {missed.map((m, idx) => (
                  <tr key={m.order_id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-[#ff3d3d]">{m.order_ref}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{m.customer_name}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{m.officer_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
