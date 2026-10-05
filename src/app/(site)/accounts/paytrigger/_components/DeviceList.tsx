"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import toast from "react-hot-toast";
import { Lock, Unlock, Search, Smartphone, Loader2 } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import { getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

export type DeviceView = "locked" | "unlocked_overdue" | "locked_paid" | "ptp" | "offline" | "all";
export interface DeviceRow {
  id: number; imei: string; product_model: string | null; enrollment_status: string; lock_status: string; ptp_status: string;
  promised_date: string | null; ptp_count: number; last_connect_time: string | null; offline_days: number | null;
  order_id: number; order_ref: string; customer_name: string; whatsapp_number: string | null; outlet_id: number | null; outlet_name: string; recovery_officer: string | null;
  outstanding: number; overdue: number; overdue_months: number; days_late: number; next_due_date: string | null; next_due_amount: number; last_payment: string | null;
  ptp_due_today: boolean; ptp_overdue: boolean;
}
export interface PtSummary {
  total: number; active: number; pending_enrollment: number; locked: number; unlocked_overdue: number; unlocked_overdue_amount: number;
  locked_paid: number; ptp_active: number; ptp_due_today: number; ptp_overdue: number; ptp_broken: number; offline_7d: number;
}

const VIEW_HELP: Record<DeviceView, string> = {
  locked: "Devices currently locked.",
  unlocked_overdue: "An installment is overdue but the phone is still unlocked (and there's no active promise to pay) — these should normally be locked.",
  locked_paid: "Locked although nothing is overdue — the customer has paid; these should be unlocked.",
  ptp: "Customers on a promise to pay. A promise whose date has passed without payment is shown as overdue.",
  offline: "Devices that haven't connected to PayTrigger for more than 7 days — the lock can't reach them.",
  all: "Every enrolled device, with all filters.",
};

/** Device table for one PayTrigger view, filtered on the server, with lock / unlock and export. */
export default function DeviceList({ view, outlets, onSummary }: { view: DeviceView; outlets: { id: number; name: string }[]; onSummary: (s: PtSummary) => void }) {
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [f, setF] = useState({ outletId: "", ptp_status: "", promisedFrom: "", promisedTo: "", minDaysLate: "", lock_status: "", enrollment_status: "" });
  const [actionImei, setActionImei] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDq(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    setRows(null);
    const qs = new URLSearchParams({ view, ...(dq.trim() && { search: dq.trim() }), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) });
    fetch(`${BACKEND_URL}/api/accounts/paytrigger/overview?${qs}`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => { if (j.success) { setRows(j.data.devices); onSummary(j.data.summary); } })
      .catch(() => setRows([]));
  }, [view, dq, f, reload]);

  const toggleLock = async (d: DeviceRow) => {
    const locking = d.lock_status !== "locked";
    if (!confirm(`${locking ? "Lock" : "Unlock"} ${d.customer_name}'s ${d.product_model || "device"} (${d.imei})?`)) return;
    setActionImei(d.imei);
    try {
      const res = await fetch(`${BACKEND_URL}/api/paytrigger/device/${encodeURIComponent(d.imei)}/${locking ? "lock" : "unlock"}`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" } });
      const data = await res.json();
      if (data.success && (!data.data || data.data.code === 200 || !data.data.code)) {
        toast.success(`Device ${locking ? "locked" : "unlocked"}.`);
        setReload((k) => k + 1);
      } else toast.error(data.message || `Failed to ${locking ? "lock" : "unlock"} device.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Connection failed."));
    } finally {
      setActionImei(null);
    }
  };

  const sel = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white";
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">{VIEW_HELP[view]}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, phone, CNIC, IMEI, order..." className={`${sel} w-full pl-9`} />
        </div>
        <select value={f.outletId} onChange={(e) => setF({ ...f, outletId: e.target.value })} className={sel}>
          <option value="">All outlets</option>
          {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {(view === "unlocked_overdue" || view === "all" || view === "locked") && (
          <select value={f.minDaysLate} onChange={(e) => setF({ ...f, minDaysLate: e.target.value })} className={sel}>
            <option value="">Any lateness</option><option value="1">1+ days late</option><option value="15">15+ days late</option><option value="30">30+ days late</option><option value="60">60+ days late</option><option value="90">90+ days late</option>
          </select>
        )}
        {view === "ptp" && (
          <>
            <select value={f.ptp_status} onChange={(e) => setF({ ...f, ptp_status: e.target.value })} className={sel}>
              <option value="">All PTPs</option><option value="active">Active</option><option value="due_today">Due today</option><option value="overdue">Promise date passed</option><option value="fulfilled">Fulfilled</option><option value="broken">Broken</option>
            </select>
            <label className="text-xs text-gray-500">Promised from <input type="date" value={f.promisedFrom} onChange={(e) => setF({ ...f, promisedFrom: e.target.value })} className={sel} /></label>
            <label className="text-xs text-gray-500">to <input type="date" value={f.promisedTo} onChange={(e) => setF({ ...f, promisedTo: e.target.value })} className={sel} /></label>
          </>
        )}
        {view === "all" && (
          <>
            <select value={f.lock_status} onChange={(e) => setF({ ...f, lock_status: e.target.value })} className={sel}>
              <option value="">Any lock state</option><option value="locked">Locked</option><option value="unlocked">Unlocked</option><option value="unknown">Unknown</option>
            </select>
            <select value={f.enrollment_status} onChange={(e) => setF({ ...f, enrollment_status: e.target.value })} className={sel}>
              <option value="">Any enrollment</option><option value="pending">Pending</option><option value="enrolled">Enrolled</option><option value="active">Active</option><option value="removed">Removed</option>
            </select>
          </>
        )}
        <div className="ml-auto">
          <ExportMenu title={`PayTrigger ${view.replace("_", " ")}`} columns={[
            { header: "Customer", value: (d: DeviceRow) => d.customer_name },
            { header: "Phone", value: (d) => d.whatsapp_number || "" },
            { header: "Order", value: (d) => d.order_ref },
            { header: "Outlet", value: (d) => d.outlet_name },
            { header: "IMEI", value: (d) => d.imei },
            { header: "Model", value: (d) => d.product_model || "" },
            { header: "Lock", value: (d) => d.lock_status },
            { header: "Enrollment", value: (d) => d.enrollment_status },
            { header: "Outstanding", value: (d) => d.outstanding, numeric: true },
            { header: "Overdue", value: (d) => d.overdue, numeric: true },
            { header: "Days late", value: (d) => d.days_late, numeric: true },
            { header: "Last payment", value: (d) => day(d.last_payment) },
            { header: "PTP", value: (d) => d.ptp_status },
            { header: "Promised date", value: (d) => day(d.promised_date) },
            { header: "Last connected", value: (d) => day(d.last_connect_time) },
            { header: "Recovery officer", value: (d) => d.recovery_officer || "" },
          ]} getRows={() => rows || []} />
        </div>
      </div>

      {!rows ? <TableSkeleton /> : rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3">Customer / Order</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3">Last Paid</th><th className="px-4 py-3">PTP</th><th className="px-4 py-3">Last Seen</th><th className="px-4 py-3 text-right">Action</th></tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{d.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{d.order_ref} · {d.whatsapp_number || "—"}</p><p className="text-[11px] text-gray-400">{d.outlet_name}{d.recovery_officer ? ` · RO ${d.recovery_officer}` : ""}</p></td>
                    <td className="px-4 py-3"><p className="text-gray-600 dark:text-gray-300">{d.product_model || "—"}</p><p className="font-mono text-[11px] text-gray-400">{d.imei}</p></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${d.lock_status === "locked" ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10" : d.lock_status === "unlocked" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>{d.lock_status}</span>
                      <p className="mt-0.5 text-[11px] text-gray-400">{d.enrollment_status}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{PKR(d.outstanding)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{d.overdue > 0 ? <span className="font-semibold text-rose-600">{PKR(d.overdue)}<span className="block text-[11px] font-normal">{d.days_late}d late · {d.overdue_months} mo</span></span> : <span className="text-emerald-600">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{day(d.last_payment)}</td>
                    <td className="px-4 py-3 text-xs">
                      {d.ptp_status !== "none" ? (
                        <><span className={`rounded-full px-2 py-0.5 font-bold ${d.ptp_overdue || d.ptp_status === "broken" ? "bg-rose-50 text-rose-700" : d.ptp_due_today ? "bg-amber-50 text-amber-700" : d.ptp_status === "fulfilled" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{d.ptp_overdue ? "date passed" : d.ptp_due_today ? "due today" : d.ptp_status}</span><p className="mt-0.5 text-gray-400">{day(d.promised_date)}{d.ptp_count > 1 ? ` · ${d.ptp_count} promises` : ""}</p></>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-xs ${d.offline_days !== null && d.offline_days > 7 ? "font-semibold text-rose-600" : "text-gray-500"}`}>{d.last_connect_time ? `${day(d.last_connect_time)}${d.offline_days ? ` (${d.offline_days}d)` : ""}` : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {d.overdue > 0 && <Link href={`/accounts/installment-receiving?order=${d.order_id}`} className="mr-2 text-xs font-bold text-emerald-600 hover:underline">Receive</Link>}
                      <button onClick={() => toggleLock(d)} disabled={actionImei === d.imei} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold disabled:opacity-50 ${d.lock_status === "locked" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10" : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10"}`}>
                        {actionImei === d.imei ? <Loader2 className="size-3.5 animate-spin" /> : d.lock_status === "locked" ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                        {d.lock_status === "locked" ? "Unlock" : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Smartphone} title="No devices in this list" /></div>}
    </div>
  );
}
