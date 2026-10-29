"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  Users2,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard from "@/components/Accounts/StatCard";
import toast from "react-hot-toast";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({
  Authorization: `Bearer ${Cookies.get("auth_token") || ""}`,
});
const PAGE_SIZE = 25;

interface Officer {
  id: number;
  full_name: string;
  username: string;
  is_online?: boolean;
  last_known_latitude?: number | null;
  last_known_longitude?: number | null;
  last_online_at?: string | null;
}

interface DeliveryUpload {
  id: number;
  upload_type: string;
  file_url: string | null;
  link: string | null;
  tag: string | null;
  uploaded_at: string;
}

interface DeliveryRecord {
  id: number;
  status: string;
  start_time: string | null;
  end_time: string | null;
  feedback: string | null;
  verified: boolean;
  delivery_agent: Officer | null;
  uploads: DeliveryUpload[];
}

interface StatusHistory {
  id: number;
  old_status: string | null;
  new_status: string;
  remarks: string | null;
  created_at: string;
  user: { full_name: string; username: string } | null;
}

interface GpsPoint {
  id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface DeliveryOrder {
  id: number;
  order_ref: string;
  customer_name: string;
  whatsapp_number: string;
  address: string;
  area: string | null;
  product_name: string;
  status: string;
  updated_at: string;
  delivery_assigned_at: string | null;
  delivered_at: string | null;
  postponed_feedback: string | null;
  delivery_officer: Officer | null;
  outlet: { name: string } | null;
  delivery: DeliveryRecord | null;
  statusHistories: StatusHistory[];
}

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
  activeOfficerCount: number;
  officerWise: OfficerRow[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const emptyPagination: Pagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  in_transit: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  picked: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  postponed: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  returned: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  failed: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
};

const formatStatus = (status: string) => status.replace(/_/g, " ");
const formatDate = (date: string | null | undefined) =>
  date
    ? new Date(date).toLocaleString("en-PK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Karachi",
      })
    : "Not recorded";

const statusClass = (status: string) =>
  `inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
    STATUS_COLORS[status] || "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
  }`;

export default function AdminDeliveryManagementPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);
  const [statusFilter, setStatusFilter] = useState("all");
  const [officerFilter, setOfficerFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOfficers, setSelectedOfficers] = useState<Record<number, string>>({});
  const [gpsHistoryByOrder, setGpsHistoryByOrder] = useState<Record<number, GpsPoint[]>>({});
  const [gpsHistoryLoading, setGpsHistoryLoading] = useState<Record<number, boolean>>({});
  const [gpsHistoryError, setGpsHistoryError] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    const response = await fetch(`${BACKEND_URL}/api/admin-panel/delivery-overview`, {
      headers: authHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || "Could not load delivery overview.");
    }
    setOverview(json.data);
  }, []);

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(PAGE_SIZE),
      status: statusFilter,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (officerFilter !== "all") params.set("officerId", officerFilter);

    const response = await fetch(
      `${BACKEND_URL}/api/admin-panel/delivery-management/orders?${params.toString()}`,
      { headers: authHeaders() },
    );
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || "Could not load delivery orders.");
    }
    setOrders(json.data.orders || []);
    setPagination((current) => ({ ...current, ...json.data.pagination }));
  }, [debouncedSearch, officerFilter, pagination.page, statusFilter]);

  const loadOfficers = useCallback(async () => {
    const response = await fetch(`${BACKEND_URL}/api/users/delivery-officers`, {
      headers: authHeaders(),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new Error(json.message || "Could not load delivery officers.");
    }
    setOfficers(json.data.officers || []);
  }, []);

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      await Promise.all([loadOverview(), loadOrders(), loadOfficers()]);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load delivery data.";
      setError(message);
      console.error("Failed to load delivery management data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadOfficers, loadOrders, loadOverview]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const totalDeliveries = useMemo(
    () => Object.values(overview?.statusBreakdown || {}).reduce((sum, value) => sum + value, 0),
    [overview],
  );
  const delivered = (overview?.statusBreakdown?.delivered || 0) + (overview?.statusBreakdown?.completed || 0);
  const officerFilterOptions = useMemo(() => {
    const optionMap = new Map<number, { id: number; full_name: string; username: string }>();
    for (const officer of officers) optionMap.set(officer.id, officer);
    for (const row of overview?.officerWise || []) {
      if (!optionMap.has(row.officer_id)) {
        optionMap.set(row.officer_id, {
          id: row.officer_id,
          full_name: row.full_name,
          username: row.username,
        });
      }
    }
    return [...optionMap.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [officers, overview]);

  const assignOfficer = async (order: DeliveryOrder) => {
    const selected = selectedOfficers[order.id] || String(order.delivery_officer?.id || "");
    if (!selected) {
      toast.error("Select a delivery officer first.");
      return;
    }
    setSavingOrderId(order.id);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${order.id}/assign-delivery`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(selected) }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "Assignment failed.");
      toast.success("Delivery officer assigned.");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not assign delivery officer.";
      toast.error(message);
    } finally {
      setSavingOrderId(null);
    }
  };

  const unassignOfficer = async (order: DeliveryOrder) => {
    setSavingOrderId(order.id);
    try {
      const response = await fetch(`${BACKEND_URL}/api/orders/${order.id}/assign-delivery`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unassign" }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "Unassignment failed.");
      toast.success("Delivery officer unassigned.");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not unassign delivery officer.";
      toast.error(message);
    } finally {
      setSavingOrderId(null);
    }
  };

  const toggleOrderDetails = async (order: DeliveryOrder) => {
    if (selectedOrderId === order.id) {
      setSelectedOrderId(null);
      return;
    }

    setSelectedOrderId(order.id);
    if (Object.prototype.hasOwnProperty.call(gpsHistoryByOrder, order.id)) return;
    if (!order.delivery?.delivery_agent?.id && !order.delivery_officer?.id) {
      setGpsHistoryByOrder((current) => ({ ...current, [order.id]: [] }));
      return;
    }

    setGpsHistoryLoading((current) => ({ ...current, [order.id]: true }));
    setGpsHistoryError((current) => ({ ...current, [order.id]: "" }));
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/admin-panel/delivery-management/orders/${order.id}/gps-history`,
        { headers: authHeaders() },
      );
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Could not load GPS history.");
      }
      setGpsHistoryByOrder((current) => ({ ...current, [order.id]: json.data.points || [] }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load GPS history.";
      setGpsHistoryError((current) => ({ ...current, [order.id]: message }));
      toast.error(message);
    } finally {
      setGpsHistoryLoading((current) => ({ ...current, [order.id]: false }));
    }
  };

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  return (
    <>
      <Breadcrumb pageName="Delivery Management" />
      <PageHeader
        icon={Truck}
        title="Delivery Management"
        subtitle="Manage assignments, monitor delivery progress, inspect proof and review failures."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Truck} label="Delivery Records" value={totalDeliveries.toLocaleString()} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
        <StatCard icon={PackageCheck} label="Successfully Delivered" value={delivered.toLocaleString()} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
        <StatCard icon={CalendarClock} label="Completed Today" value={overview?.totalToday ?? 0} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        <StatCard icon={Users2} label="Active Officers" value={overview?.activeOfficerCount ?? 0} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
      </div>

      {overview && (
        <div className="mb-5 flex flex-wrap gap-2" aria-label="Delivery record status breakdown">
          {Object.entries(overview.statusBreakdown).map(([status, count]) => (
            <span key={status} className={statusClass(status)}>
              Delivery record {formatStatus(status)}: {count.toLocaleString()}
            </span>
          ))}
          <span className="self-center text-xs text-gray-500">
            Completed today uses delivery completion time; active officers are active Delivery Agent accounts.
          </span>
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-dark dark:text-white">Delivery assignments & tracking</h2>
            <p className="text-sm text-gray-500">Order status, rider GPS, delivery proofs, failed attempts, and status timeline.</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm font-semibold text-dark hover:bg-gray-50 disabled:opacity-60 dark:border-strokedark dark:text-white dark:hover:bg-white/5"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPagination((current) => ({ ...current, page: 1 }));
              }}
              placeholder="Search order, customer, address..."
              className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => changeFilter(setStatusFilter, event.target.value)}
            className="rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none dark:border-strokedark dark:bg-boxdark dark:text-white"
          >
            <option value="all">All delivery orders</option>
            <option value="unassigned">Ready for assignment</option>
            <option value="assigned">Assigned, not yet started</option>
            <option value="in_transit">Picked up / in progress</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed / returned</option>
          </select>
          <select
            value={officerFilter}
            onChange={(event) => changeFilter(setOfficerFilter, event.target.value)}
            className="rounded-lg border border-stroke bg-white px-3 py-2.5 text-sm text-dark outline-none dark:border-strokedark dark:bg-boxdark dark:text-white"
          >
            <option value="all">All delivery officers</option>
            {officerFilterOptions.map((officer) => (
              <option key={officer.id} value={officer.id}>{officer.full_name}</option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle size={17} />
            {error}
          </div>
        )}

        {loading ? (
          <TableSkeleton />
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-slate-100 dark:border-white/10">
            <EmptyState icon={Truck} title={error ? "Delivery data could not be loaded" : "No matching delivery orders"} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3 font-bold">Order / Customer</th>
                    <th className="px-3 py-3 font-bold">Delivery address</th>
                    <th className="px-3 py-3 font-bold">Assignment</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-3 py-3 font-bold">Timeline</th>
                    <th className="px-3 py-3 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const activeOfficer = order.delivery?.delivery_agent || order.delivery_officer;
                    const canAssign = !order.delivery && ["approved", "picked"].includes(order.status);
                    const isExpanded = selectedOrderId === order.id;
                    return (
                      <DeliveryOrderRows
                        key={order.id}
                        order={order}
                        activeOfficer={activeOfficer}
                        canAssign={canAssign}
                        isExpanded={isExpanded}
                        officers={officers}
                        selectedOfficer={selectedOfficers[order.id] ?? String(order.delivery_officer?.id || "")}
                        saving={savingOrderId === order.id}
                        gpsHistory={gpsHistoryByOrder[order.id] || []}
                        gpsLoading={gpsHistoryLoading[order.id] || false}
                        gpsError={gpsHistoryError[order.id] || ""}
                        onSelectOfficer={(value) => setSelectedOfficers((current) => ({ ...current, [order.id]: value }))}
                        onAssign={() => void assignOfficer(order)}
                        onUnassign={() => void unassignOfficer(order)}
                        onToggle={() => void toggleOrderDetails(order)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing {pagination.total === 0 ? 0 : (pagination.page - 1) * PAGE_SIZE + 1}–{Math.min(pagination.page * PAGE_SIZE, pagination.total)} of {pagination.total.toLocaleString()} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                  className="rounded-lg border border-stroke p-2 disabled:opacity-40 dark:border-strokedark"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="min-w-24 text-center text-sm font-semibold">
                  Page {pagination.page} of {Math.max(1, pagination.totalPages)}
                </span>
                <button
                  type="button"
                  disabled={!pagination.hasNext}
                  onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                  className="rounded-lg border border-stroke p-2 disabled:opacity-40 dark:border-strokedark"
                  aria-label="Next page"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {overview && overview.officerWise.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <h2 className="font-bold text-dark dark:text-white">Officer delivery records</h2>
            <p className="text-xs text-gray-500">All-time delivery-record status breakdown by the officer who completed the handover.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Officer</th>
                  <th className="px-4 py-3 font-bold">Outlet</th>
                  <th className="px-4 py-3 text-right font-bold">Records</th>
                  <th className="px-4 py-3 font-bold">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {overview.officerWise.map((officer) => (
                  <tr key={officer.officer_id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dark dark:text-white">{officer.full_name}</p>
                      <p className="text-xs text-gray-500">@{officer.username}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{officer.outlet_name}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{officer.total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(officer.statusBreakdown).map(([status, count]) => (
                          <span key={status} className={statusClass(status)}>{formatStatus(status)}: {count}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function DeliveryOrderRows({
  order,
  activeOfficer,
  canAssign,
  isExpanded,
  officers,
  selectedOfficer,
  saving,
  gpsHistory,
  gpsLoading,
  gpsError,
  onSelectOfficer,
  onAssign,
  onUnassign,
  onToggle,
}: {
  order: DeliveryOrder;
  activeOfficer: Officer | null;
  canAssign: boolean;
  isExpanded: boolean;
  officers: Officer[];
  selectedOfficer: string;
  saving: boolean;
  gpsHistory: GpsPoint[];
  gpsLoading: boolean;
  gpsError: string;
  onSelectOfficer: (value: string) => void;
  onAssign: () => void;
  onUnassign: () => void;
  onToggle: () => void;
}) {
  const uploads = order.delivery?.uploads || [];
  const gps = activeOfficer?.last_known_latitude != null && activeOfficer.last_known_longitude != null
    ? { latitude: activeOfficer.last_known_latitude, longitude: activeOfficer.last_known_longitude }
    : null;
  const failureReason = order.postponed_feedback || order.delivery?.feedback;

  return (
    <>
      <tr className="border-t border-slate-50 align-top dark:border-white/5">
        <td className="px-3 py-4">
          <Link
            href={`/orders/${order.id}`}
            className="font-bold text-primary underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {order.order_ref}
          </Link>
          <p className="mt-0.5 font-medium">{order.customer_name}</p>
          <p className="mt-0.5 text-xs text-gray-500">{order.product_name}</p>
          {order.whatsapp_number && <p className="mt-0.5 text-xs text-gray-500">{order.whatsapp_number}</p>}
        </td>
        <td className="max-w-[240px] px-3 py-4">
          <p className="line-clamp-2 text-gray-700 dark:text-gray-300">{order.address}</p>
          <p className="mt-1 text-xs text-gray-500">{[order.area, order.outlet?.name].filter(Boolean).join(" · ") || "No area/outlet"}</p>
        </td>
        <td className="min-w-[220px] px-3 py-4">
          {canAssign ? (
            <div className="space-y-2">
              <select
                value={selectedOfficer}
                onChange={(event) => onSelectOfficer(event.target.value)}
                className="w-full rounded-lg border border-stroke bg-white px-2.5 py-2 text-xs outline-none dark:border-strokedark dark:bg-boxdark dark:text-white"
                aria-label={`Delivery officer for ${order.order_ref}`}
              >
                <option value="">Select officer</option>
                {officers.map((officer) => (
                  <option key={officer.id} value={officer.id}>{officer.full_name} (@{officer.username})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={onAssign} disabled={saving} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                  {saving ? "Saving..." : order.delivery_officer ? "Reassign" : "Assign"}
                </button>
                {order.delivery_officer && (
                  <button type="button" onClick={onUnassign} disabled={saving} className="rounded-md border border-stroke px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-strokedark">
                    Unassign
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold text-dark dark:text-white">{activeOfficer?.full_name || "Unassigned"}</p>
              {activeOfficer?.username && <p className="text-xs text-gray-500">@{activeOfficer.username}</p>}
              {activeOfficer && (
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${activeOfficer.is_online ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                  {activeOfficer.is_online ? "Online" : "Offline"}
                </span>
              )}
            </>
          )}
        </td>
        <td className="px-3 py-4">
          <span className={statusClass(order.status)}>{formatStatus(order.status)}</span>
          {order.delivery && (
            <span className={`mt-1 block w-fit ${statusClass(order.delivery.status)}`}>
              Delivery: {formatStatus(order.delivery.status)}
            </span>
          )}
          {failureReason && (
            <p className="mt-2 max-w-[190px] text-xs text-rose-700 dark:text-rose-300">{failureReason}</p>
          )}
        </td>
        <td className="px-3 py-4 text-xs text-gray-600 dark:text-gray-300">
          {order.delivery_assigned_at && <p>Assigned: {formatDate(order.delivery_assigned_at)}</p>}
          {order.delivery?.start_time && <p className="mt-1">Started: {formatDate(order.delivery.start_time)}</p>}
          {order.delivered_at && <p className="mt-1">Delivered: {formatDate(order.delivered_at)}</p>}
          {!order.delivery_assigned_at && !order.delivery?.start_time && !order.delivered_at && <p>No delivery milestones recorded.</p>}
        </td>
        <td className="px-3 py-4">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-stroke px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 dark:border-strokedark"
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Hide details" : `Details (${uploads.length} proofs)`}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-t border-slate-100 bg-gray-50/70 dark:border-white/10 dark:bg-white/[0.02]">
          <td colSpan={6} className="px-4 py-5">
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-dark dark:text-white">
                  <MapPin size={16} /> GPS delivery tracking
                </h3>
                {gps ? (
                  <div className="rounded-lg border border-stroke bg-white p-3 text-sm dark:border-strokedark dark:bg-boxdark">
                    <p className="font-medium">Last known rider position</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">GPS ping: {formatDate(activeOfficer?.last_online_at)}</p>
                    <a
                      href={`https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs font-bold text-primary hover:underline"
                    >
                      Open location in Maps
                    </a>
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-stroke p-3 text-sm text-gray-500 dark:border-strokedark">
                    No GPS coordinates are recorded for the assigned rider.
                  </p>
                )}
                <p className="mb-1 mt-3 text-xs font-bold text-gray-600 dark:text-gray-300">GPS trail since assignment (up to 100 recent pings)</p>
                {gpsLoading ? (
                  <p className="text-xs text-gray-500">Loading GPS history…</p>
                ) : gpsError ? (
                  <p role="alert" className="text-xs text-rose-600">{gpsError}</p>
                ) : gpsHistory.length ? (
                  <ol className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stroke bg-white p-2 dark:border-strokedark dark:bg-boxdark">
                    {gpsHistory.map((point) => (
                      <li key={point.id} className="flex items-center justify-between gap-2 text-[11px]">
                        <time className="text-gray-500">{formatDate(point.timestamp)}</time>
                        <a
                          href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary hover:underline"
                        >
                          {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-gray-500">No GPS trail points have been recorded since assignment.</p>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-dark dark:text-white">
                  <FileCheck2 size={16} /> Delivery proof & customer signature
                </h3>
                {uploads.length ? (
                  <div className="flex flex-wrap gap-2">
                    {uploads.map((upload) => {
                      const href = upload.file_url || upload.link;
                      return href ? (
                        <a
                          key={upload.id}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-stroke bg-white px-3 py-2 text-xs font-semibold capitalize text-primary hover:bg-primary/5 dark:border-strokedark dark:bg-boxdark"
                        >
                          {upload.upload_type === "customer_signature" ? "Customer signature" : formatStatus(upload.upload_type)}
                          {upload.tag ? ` · ${upload.tag}` : ""}
                        </a>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-stroke p-3 text-sm text-gray-500 dark:border-strokedark">
                    No delivery proof or signature has been uploaded.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">Customer signature is optional. It appears here when the delivery client submits one.</p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-dark dark:text-white">
                  <AlertTriangle size={16} /> Failed delivery tracking
                </h3>
                {failureReason ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {failureReason}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-stroke p-3 text-sm text-gray-500 dark:border-strokedark">
                    No failure reason recorded.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">Order: {formatStatus(order.status)} · Delivery record: {order.delivery ? formatStatus(order.delivery.status) : "not created"}</p>
              </div>

              <div className="lg:col-span-3">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-dark dark:text-white">
                  <Clock3 size={16} /> Delivery timeline
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Assigned", order.delivery_assigned_at],
                    ["Delivery started", order.delivery?.start_time],
                    ["Delivery completed", order.delivery?.end_time || order.delivered_at],
                    ["Last status update", order.updated_at],
                  ].map(([label, date]) => (
                    <div key={label} className="rounded-lg border border-stroke bg-white p-3 text-xs dark:border-strokedark dark:bg-boxdark">
                      <p className="font-bold">{label}</p>
                      <p className="mt-1 text-gray-500">{formatDate(date)}</p>
                    </div>
                  ))}
                </div>
                {order.statusHistories.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {order.statusHistories.map((history) => (
                      <li key={history.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-boxdark sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <strong>{history.old_status ? `${formatStatus(history.old_status)} → ` : ""}{formatStatus(history.new_status)}</strong>
                          {history.remarks ? ` · ${history.remarks}` : ""}
                          {history.user?.full_name ? ` · ${history.user.full_name}` : ""}
                        </span>
                        <time className="shrink-0 text-gray-500">{formatDate(history.created_at)}</time>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">No status history recorded for this order.</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
