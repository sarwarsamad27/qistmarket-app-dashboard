"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Search, Store, UserX, RefreshCw } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import AssignOutletControl from "@/components/common/AssignOutletControl";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface UnassignedRow {
  order_id: number;
  order_ref: string;
  customer_name: string;
  phone: string | null;
  product_name: string | null;
  delivered_at: string | null;
  status: string;
  outlet: { id: number; name: string } | null;
  recovery_officer: { id: number; name: string } | null;
  delivered_by: string | null;
  suggested_outlet: { id: number; name: string } | null;
  outstanding: number;
  no_outlet: boolean;
  no_officer: boolean;
}

interface UnassignedData {
  rows: UnassignedRow[];
  summary: { no_outlet: number; no_outlet_outstanding: number; no_officer: number; no_officer_outstanding: number };
}

export default function UnassignedAccountsPage() {
  const [data, setData] = useState<UnassignedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"outlet" | "officer">("outlet");
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/admin-panel/unassigned-accounts`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load unassigned accounts:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || [])
      .filter((r) => (tab === "outlet" ? r.no_outlet : r.no_officer))
      .filter((r) => !q || [r.order_ref, r.customer_name, r.phone, r.product_name, r.delivered_by, r.outlet?.name, r.recovery_officer?.name, r.suggested_outlet?.name]
        .some((v) => (v || "").toLowerCase().includes(q)));
  }, [data, tab, search]);

  // An account given its outlet leaves the "No Outlet" list straight away.
  const markAssigned = (orderId: number, outlet: { id: number; name: string }) =>
    setData((prev) => prev && {
      ...prev,
      rows: prev.rows.map((r) => (r.order_id === orderId ? { ...r, outlet, no_outlet: false } : r)),
      summary: {
        ...prev.summary,
        no_outlet: prev.summary.no_outlet - 1,
        no_outlet_outstanding: prev.summary.no_outlet_outstanding - (prev.rows.find((r) => r.order_id === orderId)?.outstanding || 0),
      },
    });

  return (
    <>
      <Breadcrumb pageName="Unassigned Accounts" />
      <PageHeader
        icon={UserX}
        title="Unassigned Accounts"
        subtitle="Delivered accounts with no outlet or no recovery officer. No-outlet accounts show as “Unassigned” in Installment Aging and in no branch's Installments View."
        actions={
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:text-[#ff3d3d] dark:border-white/10 dark:bg-boxdark dark:text-gray-300">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      {data && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => setTab("outlet")} className={`rounded-2xl text-left ring-2 transition ${tab === "outlet" ? "ring-[#ff3d3d]" : "ring-transparent"}`}>
            <StatCard icon={Store} label="No Outlet" value={`${data.summary.no_outlet} · ${PKR(data.summary.no_outlet_outstanding)}`} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" />
          </button>
          <button type="button" onClick={() => setTab("officer")} className={`rounded-2xl text-left ring-2 transition ${tab === "officer" ? "ring-[#ff3d3d]" : "ring-transparent"}`}>
            <StatCard icon={UserX} label="No Recovery Officer" value={`${data.summary.no_officer} · ${PKR(data.summary.no_officer_outstanding)}`} accent="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" bar="bg-amber-500" />
          </button>
        </div>
      )}

      {loading && !data ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-white/10">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order ref, customer, phone, product, officer..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-dark outline-none transition focus:border-[#ff3d3d] focus:bg-white dark:border-white/10 dark:bg-dark-3 dark:text-white"
              />
            </div>
            <p className="text-xs font-semibold text-gray-500">
              {tab === "outlet" ? "No outlet" : "No recovery officer"} · {rows.length} account{rows.length === 1 ? "" : "s"} · {PKR(rows.reduce((s, r) => s + r.outstanding, 0))} outstanding
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={UserX} title={search ? "No accounts match your search" : "Nothing unassigned"} description={search ? undefined : "Every delivered account has one."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-bold">S.No</th>
                    <th className="px-4 py-3 font-bold">Order Ref</th>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 font-bold">Delivered By</th>
                    <th className="px-4 py-3 font-bold">Outlet</th>
                    <th className="px-4 py-3 font-bold">Recovery Officer</th>
                    <th className="px-4 py-3 text-right font-bold">Outstanding</th>
                    {tab === "outlet" && <th className="px-4 py-3 font-bold">Assign Outlet</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.order_id} className="border-t border-slate-50 align-middle dark:border-white/5">
                      <td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3.5 font-semibold">
                        <Link href={`/orders/${r.order_id}`} className="text-[#ff3d3d] hover:underline">{r.order_ref}</Link>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                        <div className="font-semibold text-dark dark:text-white">{r.customer_name}</div>
                        {r.phone && <div className="text-xs text-gray-400">{r.phone}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.product_name || "—"}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.delivered_by || "—"}</td>
                      <td className="px-4 py-3.5">
                        {r.outlet ? <span className="text-gray-600 dark:text-gray-300">{r.outlet.name}</span> : <span className="font-semibold text-rose-600">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.recovery_officer ? <span className="text-gray-600 dark:text-gray-300">{r.recovery_officer.name}</span> : <span className="font-semibold text-amber-600">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(r.outstanding)}</td>
                      {tab === "outlet" && (
                        <td className="px-4 py-3.5">
                          <AssignOutletControl compact orderId={r.order_id} suggestedOutletId={r.suggested_outlet?.id ?? null} onAssigned={(o) => markAssigned(r.order_id, o)} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
