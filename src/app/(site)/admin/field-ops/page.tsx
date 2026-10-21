"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { MapPin, Circle, ExternalLink, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface Coords { latitude: number; longitude: number; timestamp?: string }
interface Officer {
  id: number;
  full_name: string;
  username: string;
  phone: string;
  is_online: boolean;
  current_location: Coords | null;
  last_known_location: Coords | null;
}

type Dept = "verification" | "delivery" | "recovery";

const DEPT_META: Record<Dept, { label: string; icon: any; color: string; bg: string; endpoint: string }> = {
  verification: { label: "Verification", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", endpoint: "/api/officers/verification" },
  delivery: { label: "Delivery", icon: Truck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10", endpoint: "/api/officers/delivery" },
  recovery: { label: "Recovery", icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10", endpoint: "/api/recovery/officers" },
};

export default function AdminFieldOpsPage() {
  const [officers, setOfficers] = useState<(Officer & { dept: Dept })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Dept | "all">("all");

  useEffect(() => {
    Promise.all(
      (Object.keys(DEPT_META) as Dept[]).map((dept) =>
        fetch(`${BACKEND_URL}${DEPT_META[dept].endpoint}`, { headers: authHeaders() })
          .then((r) => r.json())
          .then((json) => (json.success ? (json.data.officers || []).map((o: Officer) => ({ ...o, dept })) : []))
          .catch(() => [])
      )
    )
      .then((results) => setOfficers(results.flat()))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? officers : officers.filter((o) => o.dept === filter);
  const onlineCount = officers.filter((o) => o.is_online).length;

  return (
    <>
      <Breadcrumb pageName="Field Ops" />
      <PageHeader icon={MapPin} title="Field Ops" subtitle={`${onlineCount} of ${officers.length} field officers online right now.`} />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        <button onClick={() => setFilter("all")} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${filter === "all" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>All</button>
        {(Object.keys(DEPT_META) as Dept[]).map((d) => {
          const DeptIcon = DEPT_META[d].icon;
          return (
            <button key={d} onClick={() => setFilter(d)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${filter === d ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
              <DeptIcon className="size-3.5" /> {DEPT_META[d].label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={MapPin} title="No field officers found" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Department</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Last Seen</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map((o, idx) => {
                const meta = DEPT_META[o.dept];
                const coords = o.current_location || o.last_known_location;
                return (
                  <tr key={`${o.dept}-${o.id}`} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 text-gray-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-dark dark:text-white">{o.full_name}</p>
                      <p className="text-xs text-gray-400">@{o.username} · {o.phone}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.bg} ${meta.color}`}><meta.icon className="size-3" /> {meta.label}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${o.is_online ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>
                        <Circle className={`size-2 ${o.is_online ? "fill-emerald-500 text-emerald-500" : "fill-gray-400 text-gray-400"}`} />
                        {o.is_online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{o.last_known_location?.timestamp ? new Date(o.last_known_location.timestamp).toLocaleString() : o.is_online ? "Now" : "—"}</td>
                    <td className="px-4 py-3.5 text-right">
                      {coords ? (
                        <a href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#ff3d3d] hover:underline">
                          View on Map <ExternalLink className="size-3" />
                        </a>
                      ) : <span className="text-xs text-gray-300">No location</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
