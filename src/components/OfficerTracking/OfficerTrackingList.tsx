"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import { Search, Radar, Circle, ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { apiErrorMessage } from "@/lib/apiErrors";
import { ROLE_META, RoleKey, fmtRs, monthStart, today, isCompleteDate } from "./shared";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface OfficerRow {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  role: RoleKey;
  status: string;
  is_online: boolean;
  last_online_at: string | null;
  outlet: { id: number; name: string; code: string } | null;
  stats: Record<string, number>;
}

// Shared by the Admin, Outlet and Accounts portals. The backend decides scope:
// outlet staff only ever get their own outlet's officers.
export default function OfficerTrackingList({ basePath }: { basePath: string }) {
  const [officers, setOfficers] = useState<OfficerRow[]>([]);
  const [outlets, setOutlets] = useState<{ id: number; name: string }[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<RoleKey | "all">("all");
  const [outletId, setOutletId] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");

  // Each change aborts the previous request, so a slower response for an older
  // (or half-typed) range can never overwrite the one for the dates now shown.
  useEffect(() => {
    if (from > to) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        if (outletId) params.set("outlet_id", outletId);
        const res = await fetch(`${BACKEND_URL}/api/officer-tracking/officers?${params}`, {
          headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to load officers"));
        const json = await res.json();
        setOfficers(json.data.officers || []);
        setOutlets(json.data.outlets || []);
        setIsGlobal(!!json.data.scope?.global);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setError(e.message || "Failed to load officers");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [from, to, outletId]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return officers.filter((o) =>
      (role === "all" || o.role === role) &&
      (!q || o.full_name.toLowerCase().includes(q) || o.username.toLowerCase().includes(q) || (o.phone || "").includes(q))
    );
  }, [officers, role, search]);

  const counts = useMemo(() => ({
    all: officers.length,
    verification: officers.filter((o) => o.role === "verification").length,
    delivery: officers.filter((o) => o.role === "delivery").length,
    recovery: officers.filter((o) => o.role === "recovery").length,
    csr: officers.filter((o) => o.role === "csr").length,
  }), [officers]);

  const qs = `?from=${from}&to=${to}${outletId ? `&outlet_id=${encodeURIComponent(outletId)}` : ""}`;

  return (
    <>
      <Breadcrumb pageName="Officer Tracking" />
      <PageHeader
        icon={Radar}
        title="Officer Tracking"
        subtitle={isGlobal ? "Field officers and CSRs across all outlets — tap a person for full activity and sales." : "Your outlet's field officers and CSRs — tap a person for full activity and sales."}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-dark">
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          {(["all", "verification", "delivery", "recovery", "csr"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${role === r ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
            >
              {r === "all" ? "All" : ROLE_META[r].label} ({counts[r]})
            </button>
          ))}
        </div>
        {isGlobal && (
          <label className="flex flex-col text-xs font-semibold text-gray-500">
            Outlet
            <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white">
              <option value="">All outlets</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col text-xs font-semibold text-gray-500">
          From
          <input type="date" defaultValue={from} max={to} onChange={(e) => { if (isCompleteDate(e.target.value)) setFrom(e.target.value); }} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white" />
        </label>
        <label className="flex flex-col text-xs font-semibold text-gray-500">
          To
          <input type="date" defaultValue={to} min={from} onChange={(e) => { if (isCompleteDate(e.target.value)) setTo(e.target.value); }} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white" />
        </label>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search officer name, username, phone..."
            className="w-full rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-3 text-sm text-dark dark:border-dark-3 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : error ? (
        <EmptyState icon={Radar} title="Could not load officers" description={error} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Radar} title="No officers found" description="Try another role, outlet or search." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => {
            const meta = ROLE_META[o.role];
            const Icon = meta.icon;
            return (
              <Link
                key={o.id}
                href={`${basePath}/${o.id}${qs}`}
                className="group rounded-2xl border border-stroke bg-white p-4 shadow-sm transition hover:border-[#ff3d3d]/40 hover:shadow-md dark:border-dark-3 dark:bg-gray-dark"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${meta.bg}`}>
                      <Icon className={`size-5 ${meta.color}`} />
                    </div>
                    <div>
                      <p className="font-bold text-dark dark:text-white">{o.full_name}</p>
                      <p className="text-xs text-gray-500">@{o.username}{o.phone ? ` · ${o.phone}` : ""}</p>
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-gray-300 transition group-hover:text-[#ff3d3d]" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${meta.bg} ${meta.color}`}>{meta.label}</span>
                  {o.outlet && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600 dark:bg-dark-3 dark:text-gray-300">{o.outlet.name}</span>}
                  <span className="flex items-center gap-1 text-gray-500">
                    <Circle className={`size-2 ${o.is_online ? "fill-emerald-500 text-emerald-500" : "fill-gray-300 text-gray-300"}`} />
                    {o.is_online ? "Online" : "Offline"}
                  </span>
                  {o.status !== "active" && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">{o.status}</span>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-stroke pt-3 text-center dark:border-dark-3">
                  {o.role === "verification" && <Stat label="Verifications" value={o.stats.verifications} />}
                  {o.role === "delivery" && (
                    <>
                      <Stat label="Delivered" value={o.stats.deliveries} />
                      <Stat label="Cash taken" value={fmtRs(o.stats.cash_collected)} wide />
                    </>
                  )}
                  {o.role === "recovery" && (
                    <>
                      <Stat label="Collections" value={o.stats.collections} />
                      <Stat label="Amount" value={fmtRs(o.stats.amount_collected)} />
                      <Stat label="Visits" value={o.stats.visits} />
                    </>
                  )}
                  {o.role === "csr" && (
                    <>
                      <Stat label="Sales" value={o.stats.sales} />
                      <Stat label="Order value" value={fmtRs(o.stats.sales_amount)} wide />
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, wide }: { label: string; value: any; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <p className="text-sm font-black text-dark dark:text-white">{value ?? 0}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
