"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Activity, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface LogEntry {
  id: number;
  action: string;
  details: string;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
  user: { username: string; full_name: string } | null;
  outlet: { name: string; code: string } | null;
}

export default function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search.trim()) params.set("search", search.trim());
    if (action.trim()) params.set("action", action.trim());

    fetch(`${BACKEND_URL}/api/security-logs?${params.toString()}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setLogs(json.logs || []);
          setTotalPages(json.pagination?.totalPages || 1);
        }
      })
      .catch((err) => console.error("Failed to load activity logs:", err))
      .finally(() => setLoading(false));
  }, [page, search, action]);

  return (
    <>
      <Breadcrumb pageName="Activity Logs" />
      <PageHeader icon={Activity} title="Activity Logs" subtitle="Login history, device/IP tracking, and sensitive actions across the system." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search user or details..."
            className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
        </div>
        <input
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          placeholder="Filter by action (e.g. LOGIN_FAILED)..."
          className="w-56 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Activity} title={search || action ? "No matching logs" : "No activity logged yet"} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">User</th><th className="px-4 py-3 font-bold">Action</th><th className="px-4 py-3 font-bold">Details</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">IP / Device</th><th className="px-4 py-3 font-bold">Date</th></tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{(page - 1) * 25 + idx + 1}</td>
                    <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{log.user?.full_name || "System"}<span className="block text-xs text-gray-400">@{log.user?.username || "-"}</span></td>
                    <td className="px-4 py-3.5"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">{log.action}</span></td>
                    <td className="max-w-xs truncate px-4 py-3.5 text-gray-600 dark:text-gray-300" title={log.details}>{log.details}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{log.outlet?.name || "—"}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-400">{log.ip_address || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-dark-3"><ChevronLeft className="size-4" /> Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-dark-3">Next <ChevronRight className="size-4" /></button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
