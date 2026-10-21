"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Clock, CalendarClock, X, CheckCircle2, Hourglass } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import DateRangeFilter, { type DateRange } from "@/components/Accounts/DateRangeFilter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

const BUCKET_COLORS: Record<string, string> = { "0-30": "text-emerald-600", "31-60": "text-amber-600", "61-90": "text-orange-600", "90+": "text-rose-600" };

interface AgingItem {
  order_id: number;
  order_ref: string;
  customer_name: string;
  outlet_name: string;
  officer_name: string;
  month: number;
  dueDate: string;
  daysOverdue: number;
  bucket: string;
  outstanding: number;
}

interface AgingData {
  buckets: Record<string, number>;
  total: number;
  items: AgingItem[];
}

export default function AdminInstallmentAgingPage() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState<AgingItem | null>(null);
  const [newDate, setNewDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [statusCounts, setStatusCounts] = useState<{ active: number; closed: number; total: number } | null>(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (range.from) qs.set("startDate", range.from);
    if (range.to) qs.set("endDate", range.to);
    fetch(`${BACKEND_URL}/api/accounts/aging?${qs}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load installment aging:", err))
      .finally(() => setLoading(false));

    fetch(`${BACKEND_URL}/api/admin-panel/installments/status-counts`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setStatusCounts(json.data); })
      .catch((err) => console.error("Failed to load installment status counts:", err));
  };

  useEffect(() => { load(); }, [range.from, range.to]);

  const openReschedule = (item: AgingItem) => {
    setRescheduling(item);
    setNewDate("");
    setReason("");
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduling || !newDate) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/installments/${rescheduling.order_id}/reschedule`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ month_number: rescheduling.month, new_due_date: newDate, reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Reschedule failed.");
      toast.success("Installment rescheduled.");
      setRescheduling(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Installment Aging" />
      <PageHeader icon={Clock} title="Installment Aging" subtitle="Overdue installments by age bucket, company-wide — with reschedule support." />
      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
        <p className="mt-1.5 text-[11px] text-gray-400">Dates pick installments that fell due in that period; days overdue are always counted to today. Empty = all overdue installments.</p>
      </div>

      {statusCounts && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard icon={Hourglass} label="Active Installments" value={statusCounts.active.toLocaleString()} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
          <StatCard icon={CheckCircle2} label="Closed Installments" value={statusCounts.closed.toLocaleString()} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
          <StatCard icon={Clock} label="Total Tracked" value={statusCounts.total.toLocaleString()} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Clock} title="No overdue installments" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.entries(data.buckets).map(([bucket, amount]) => (
              <div key={bucket} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{bucket} Days</p>
                <p className={`text-xl font-black ${BUCKET_COLORS[bucket]}`}>{PKR(amount)}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 text-right font-bold">Days Overdue</th><th className="px-4 py-3 text-right font-bold">Outstanding</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody>
                {data.items.slice(0, 150).map((it, idx) => (
                  <tr key={`${it.order_id}-${it.month}`} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-[#ff3d3d]">{it.order_ref}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{it.customer_name}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{it.outlet_name}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{it.officer_name}</td>
                    <td className={`px-4 py-3.5 text-right tabular-nums font-semibold ${BUCKET_COLORS[it.bucket]}`}>{it.daysOverdue}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(it.outstanding)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button onClick={() => openReschedule(it)} className="inline-flex items-center gap-1 text-xs font-bold text-[#ff3d3d] hover:underline">
                        <CalendarClock className="size-3.5" /> Reschedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rescheduling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-dark dark:text-white">Reschedule — {rescheduling.order_ref} (Month {rescheduling.month})</h2>
              <button onClick={() => setRescheduling(null)} className="text-gray-400 hover:text-gray-600"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleReschedule} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Current Due Date</label>
                <input disabled value={new Date(rescheduling.dueDate).toLocaleDateString()} className="w-full rounded-xl border border-stroke bg-gray-50 px-4 py-2.5 text-sm text-gray-500 dark:border-dark-3 dark:bg-dark-3" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">New Due Date *</label>
                <input type="date" required value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Reason</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional note for the audit log..." className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Confirm Reschedule"}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
