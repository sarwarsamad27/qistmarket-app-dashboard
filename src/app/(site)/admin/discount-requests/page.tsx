"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Percent, Plus, Check, X as XIcon } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface DiscountRequestRow {
  id: number;
  order: { id: number; order_ref: string; customer_name: string; total_amount: number } | null;
  requested_by_name: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decided_by_name: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

export default function AdminDiscountRequestsPage() {
  const [requests, setRequests] = useState<DiscountRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ order_id: "", amount: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const q = filter === "all" ? "" : `?status=${filter}`;
    fetch(`${BACKEND_URL}/api/discounts${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setRequests(json.data || []); })
      .catch((err) => console.error("Failed to load discount requests:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.order_id || !form.amount || !form.reason.trim()) {
      toast.error("Order ID, amount, and reason are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/discounts`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to submit request.");
      toast.success("Discount request submitted.");
      setShowForm(false);
      setForm({ order_id: "", amount: "", reason: "" });
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDecide = async (id: number, decision: "approved" | "rejected") => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/discounts/${id}/decide`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ decision }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to decide.");
      toast.success(`Request ${decision}.`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Discount Requests" />
      <PageHeader
        icon={Percent}
        title="Discount Requests"
        subtitle="Request and approval tracking — approving a request records the decision but doesn't automatically change the order price."
        actions={
          <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90">
            <Plus className="size-4" /> New Request
          </button>
        }
      />

      {showForm && (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">New Discount Request</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Order ID *</label>
              <input type="number" value={form.order_id} onChange={(e) => setForm({ ...form, order_id: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Discount Amount (PKR) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Reason *</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" disabled={saving} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{saving ? "Submitting..." : "Submit Request"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${filter === f ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>{f}</button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Percent} title="No discount requests" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Requested By</th><th className="px-4 py-3 text-right font-bold">Amount</th><th className="px-4 py-3 font-bold">Reason</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {requests.map((r, idx) => (
                <tr key={r.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-[#ff3d3d]">{r.order?.order_ref || `#${r.id}`}</p>
                    <p className="text-xs text-gray-400">{r.order?.customer_name}</p>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.requested_by_name}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(r.amount)}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.reason}</td>
                  <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[r.status]}`}>{r.status}</span></td>
                  <td className="px-4 py-3.5 text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleDecide(r.id, "approved")} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"><Check className="size-3.5" /> Approve</button>
                        <button onClick={() => handleDecide(r.id, "rejected")} className="inline-flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline"><XIcon className="size-3.5" /> Reject</button>
                      </div>
                    )}
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
