"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import { Truck, PackageCheck, CalendarClock, Users2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface OfficerRow {
  officer_id: number;
  full_name: string;
  username: string;
  outlet_name: string;
  total: number;
  statusBreakdown: Record<string, number>;
}

interface Overview {
  statusBreakdown: Record<string, number>;
  totalToday: number;
  officerWise: OfficerRow[];
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  completed: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
  cancelled: "bg-rose-50 text-rose-600 dark:bg-rose-500/10",
};

export default function AdminDeliveryManagementPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin-panel/delivery-overview`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load delivery management overview:", err))
      .finally(() => setLoading(false));
  }, []);

  const totalDeliveries = useMemo(() => Object.values(data?.statusBreakdown || {}).reduce((s, v) => s + v, 0), [data]);
  const delivered = (data?.statusBreakdown?.delivered || 0) + (data?.statusBreakdown?.completed || 0);

  return (
    <>
      <Breadcrumb pageName="Delivery Management" />
      <PageHeader icon={Truck} title="Delivery Management" subtitle="Company-wide delivery status and officer performance." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Truck} label="Total Deliveries" value={totalDeliveries.toLocaleString()} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
        <StatCard icon={PackageCheck} label="Delivered" value={delivered.toLocaleString()} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
        <StatCard icon={CalendarClock} label="Today" value={data?.totalToday ?? 0} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        <StatCard icon={Users2} label="Active Officers" value={data?.officerWise.length ?? 0} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
      </div>

      {!loading && data && (
        <div className="mb-6 flex flex-wrap gap-3">
          {Object.entries(data.statusBreakdown).map(([status, count]) => (
            <span key={status} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600 dark:bg-white/10"}`}>
              {status.replace(/_/g, " ")}: {count}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : !data || data.officerWise.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Truck} title="No delivery activity yet" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Total</th><th className="px-4 py-3 font-bold">Breakdown</th></tr>
            </thead>
            <tbody>
              {data.officerWise.map((o, idx) => (
                <tr key={o.officer_id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-dark dark:text-white">{o.full_name}</p>
                    <p className="text-xs text-gray-400">@{o.username}</p>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.outlet_name}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{o.total}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(o.statusBreakdown).map(([s, c]) => (
                        <span key={s} className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLORS[s] || "bg-gray-100 text-gray-600 dark:bg-white/10"}`}>{s.replace(/_/g, " ")}: {c}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
