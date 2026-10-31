"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const PAGE_SIZE = 10;

type Decision = "pending" | "approved" | "rejected";

interface VerificationRecord {
  id: number;
  order_id: number;
  status: string;
  verification_officer_id: number | null;
  verification_officer_name_override?: string | null;
  verification_officer?: { full_name: string; username: string } | null;
  order: {
    id: number;
    order_ref: string;
    customer_name: string;
    city: string | null;
    area: string | null;
    status: string;
    updated_at: string;
  };
}

interface Pagination {
  page: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface OfficerStat extends Stats {
  id: number | null;
  name: string;
}

interface AreaStat extends Stats {
  city: string;
  area: string;
}

interface Officer {
  id: number;
  full_name: string;
  username: string;
}

interface Analytics {
  stats: Stats;
  officers: OfficerStat[];
  areas: AreaStat[];
}

const authHeaders = () => ({
  Authorization: `Bearer ${Cookies.get("auth_token")}`,
});

const decisionLabel = (status: string): Decision => {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
};

const decisionStyles: Record<Decision, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};

export default function VerificationManagementPage() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 1 });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<"all" | Decision>("all");
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        search: search.trim(),
        sortBy: "created_at",
        sortDir: "desc",
      });
      if (decision !== "all") params.set("decision", decision);
      const response = await fetch(`${BACKEND_URL}/api/verifications?${params}`, { headers: authHeaders() });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error?.message || json.message || "Failed to load verifications");
      setRecords(json.data?.verifications || []);
      setPagination(json.data?.pagination || { page: 1, total: 0, totalPages: 1 });
    } catch (fetchError) {
      console.error("Failed to load verification records:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load verifications");
    } finally {
      setLoading(false);
    }
  }, [decision, page, search]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [analyticsResponse, officersResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/verification/management-analytics`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/officers/verification`, { headers: authHeaders() }),
      ]);
      const [analyticsJson, officersJson] = await Promise.all([
        analyticsResponse.json(),
        officersResponse.json(),
      ]);
      if (!analyticsResponse.ok || !analyticsJson.success) {
        throw new Error(analyticsJson.error?.message || "Failed to load verification analytics");
      }
      if (!officersResponse.ok || !officersJson.success) {
        throw new Error(officersJson.error?.message || "Failed to load verification officers");
      }
      setAnalytics(analyticsJson.data);
      setOfficers((officersJson.data?.officers || []).map((officer: Officer) => ({
        id: officer.id,
        full_name: officer.full_name,
        username: officer.username,
      })));
    } catch (fetchError) {
      console.error("Failed to load verification analytics:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load verification analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const assignOfficer = async (verificationId: number, officerId: string) => {
    setSavingId(verificationId);
    setError("");
    try {
      const response = await fetch(`${BACKEND_URL}/api/verification/${verificationId}/assignment`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ verification_officer_id: officerId ? Number(officerId) : null }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || json.error?.message || "Assignment update failed");
      await Promise.all([fetchRecords(), fetchAnalytics()]);
    } catch (assignError) {
      console.error("Failed to assign verification officer:", assignError);
      setError(assignError instanceof Error ? assignError.message : "Assignment update failed");
    } finally {
      setSavingId(null);
    }
  };

  const summaryCards = useMemo(() => [
    { label: "Total verifications", value: analytics?.stats.total, icon: ShieldCheck, color: "text-blue-600 bg-blue-50 dark:bg-blue-500/10" },
    { label: "Pending", value: analytics?.stats.pending, icon: Clock3, color: "text-amber-600 bg-amber-50 dark:bg-amber-500/10" },
    { label: "Approved", value: analytics?.stats.approved, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Rejected", value: analytics?.stats.rejected, icon: XCircle, color: "text-rose-600 bg-rose-50 dark:bg-rose-500/10" },
  ], [analytics]);

  return (
    <>
      <Breadcrumb pageName="Verification Management" />
      <PageHeader
        icon={ShieldCheck}
        title="Verification Management"
        subtitle="Manage assignments, monitor field verification, and review verification outcomes."
        actions={
          <button
            type="button"
            onClick={() => void Promise.all([fetchRecords(), fetchAnalytics()])}
            className="inline-flex items-center gap-2 rounded-lg border border-stroke bg-white px-3 py-2 text-sm font-semibold text-dark hover:bg-gray-50 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-3"
          >
            <RefreshCw className="size-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <span>{error}</span>
          <button type="button" className="font-bold underline" onClick={() => void Promise.all([fetchRecords(), fetchAnalytics()])}>Retry</button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-stroke bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-boxdark">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{label}</span>
              <span className={`flex size-10 items-center justify-center rounded-xl ${color}`}><Icon className="size-5" /></span>
            </div>
            <p className="mt-4 text-3xl font-black text-dark dark:text-white">
              {analyticsLoading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-100 dark:bg-dark-3" /> : value ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-stroke bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-boxdark">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-dark dark:text-white">Officer performance</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Assigned workload and final outcomes</p>
            </div>
            <Link href="/verification-officers" className="inline-flex items-center gap-1 text-xs font-bold text-[#ff3d3d] hover:underline">
              Monitor officers <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                <tr><th className="pb-2">Officer</th><th className="pb-2 text-right">Assigned</th><th className="pb-2 text-right">Pending</th><th className="pb-2 text-right">Approved</th><th className="pb-2 text-right">Rejected</th></tr>
              </thead>
              <tbody>
                {!analyticsLoading && analytics?.officers.map((officer) => (
                  <tr key={officer.id ?? "unassigned"} className="border-t border-stroke dark:border-dark-3">
                    <td className="py-3 font-semibold text-dark dark:text-white">{officer.name}</td>
                    <td className="py-3 text-right tabular-nums">{officer.total}</td>
                    <td className="py-3 text-right tabular-nums text-amber-600">{officer.pending}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-600">{officer.approved}</td>
                    <td className="py-3 text-right tabular-nums text-rose-600">{officer.rejected}</td>
                  </tr>
                ))}
                {!analyticsLoading && !analytics?.officers.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No verification assignments yet.</td></tr>}
                {analyticsLoading && <tr><td colSpan={5} className="py-6 text-center text-gray-400">Loading performance…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-stroke bg-white p-5 shadow-sm dark:border-dark-3 dark:bg-boxdark">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-dark dark:text-white">Area-wise report</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Verification status by city and area</p>
            </div>
            <MapPin className="size-5 text-[#ff3d3d]" />
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full min-w-[440px] text-left text-sm">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-gray-400 dark:bg-boxdark">
                <tr><th className="pb-2">City / area</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Pending</th><th className="pb-2 text-right">Approved</th><th className="pb-2 text-right">Rejected</th></tr>
              </thead>
              <tbody>
                {!analyticsLoading && analytics?.areas.map((area) => (
                  <tr key={`${area.city}-${area.area}`} className="border-t border-stroke dark:border-dark-3">
                    <td className="py-3"><span className="font-semibold text-dark dark:text-white">{area.area}</span><span className="block text-xs text-gray-400">{area.city}</span></td>
                    <td className="py-3 text-right tabular-nums">{area.total}</td>
                    <td className="py-3 text-right tabular-nums text-amber-600">{area.pending}</td>
                    <td className="py-3 text-right tabular-nums text-emerald-600">{area.approved}</td>
                    <td className="py-3 text-right tabular-nums text-rose-600">{area.rejected}</td>
                  </tr>
                ))}
                {!analyticsLoading && !analytics?.areas.length && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No area data available.</td></tr>}
                {analyticsLoading && <tr><td colSpan={5} className="py-6 text-center text-gray-400">Loading area report…</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-stroke bg-white shadow-sm dark:border-dark-3 dark:bg-boxdark">
        <div className="flex flex-col gap-3 border-b border-stroke p-5 dark:border-dark-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-dark dark:text-white">Verification assignments & tracking</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{pagination.total} records · Open a record for GPS, photos, documents, and approval/rejection.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search customer, order, area…"
                className="w-full rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 sm:w-64"
              />
            </label>
            <select
              value={decision}
              onChange={(event) => { setDecision(event.target.value as "all" | Decision); setPage(1); }}
              className="rounded-lg border border-stroke bg-white px-3 py-2 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
              aria-label="Filter by verification decision"
            >
              <option value="all">All decisions</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3">Order / customer</th>
                <th className="px-5 py-3">Area</th>
                <th className="px-5 py-3">Officer assignment</th>
                <th className="px-5 py-3">Decision</th>
                <th className="px-5 py-3">Field progress</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && records.map((record) => {
                const currentDecision = decisionLabel(record.order.status);
                const officerName = record.verification_officer?.full_name || record.verification_officer_name_override || "Unassigned";
                return (
                  <tr key={record.id} className="border-t border-stroke dark:border-dark-3">
                    <td className="px-5 py-4">
                      <Link href={`/verifications/${record.order.id}`} className="font-bold text-dark hover:text-[#ff3d3d] dark:text-white">{record.order.order_ref}</Link>
                      <p className="mt-0.5 text-xs text-gray-500">{record.order.customer_name}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                      {record.order.area || "—"}<span className="block text-xs text-gray-400">{record.order.city || "Unknown city"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><UserRound className="size-3.5" />{officerName}</div>
                      <select
                        value={record.verification_officer_id ?? ""}
                        onChange={(event) => void assignOfficer(record.id, event.target.value)}
                        disabled={savingId === record.id || currentDecision !== "pending"}
                        aria-label={`Assign verification officer for ${record.order.order_ref}`}
                        className="max-w-56 rounded-md border border-stroke bg-white px-2 py-1.5 text-xs disabled:opacity-60 dark:border-dark-3 dark:bg-dark-2"
                      >
                        <option value="">Unassigned</option>
                        {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.full_name} (@{officer.username})</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${decisionStyles[currentDecision]}`}>{currentDecision}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"><Activity className="size-3.5 text-sky-600" />{record.status.replaceAll("_", " ")}</span>
                      <Link href={`/verifications/${record.order.id}`} className="mt-1 block text-[11px] text-gray-400 hover:text-[#ff3d3d]">
                        GPS, photos & documents
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/verifications/${record.order.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#ff3d3d] hover:underline">
                        Review record <ArrowUpRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && records.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">No verification records match this filter.</td></tr>
              )}
              {loading && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">Loading verification records…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-stroke px-5 py-3 text-sm dark:border-dark-3">
          <span className="text-xs text-gray-500">Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-dark-3">Previous</button>
            <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || loading} className="rounded-md border border-stroke px-3 py-1.5 text-xs font-semibold disabled:opacity-40 dark:border-dark-3">Next</button>
          </div>
        </div>
      </section>
    </>
  );
}
