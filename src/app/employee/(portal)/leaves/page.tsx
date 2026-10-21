"use client";

import { useEffect, useState } from "react";
import { employeeFetch } from "@/lib/employee-api";
import toast from "react-hot-toast";

interface LeaveRequest {
  id: number;
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  status: string;
  rejection_reason?: string;
}

interface Balances {
  annual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  emergency: { total: number; used: number; remaining: number };
}

export default function EmployeeLeavesPage() {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [form, setForm] = useState({ leave_type: "annual", from_date: "", to_date: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    employeeFetch("/employee/leaves").then((r) => {
      setBalances(r.balances);
      setRequests(r.requests);
    });
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await employeeFetch("/employee/leaves", { method: "POST", body: JSON.stringify(form) });
      toast.success("Leave application submitted");
      setForm({ leave_type: "annual", from_date: "", to_date: "", reason: "" });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">Leaves</h1>

      {balances && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {(["annual", "sick", "emergency"] as const).map((type) => (
            <div key={type} className={`rounded-xl border p-4 ${balances[type].remaining < 1 ? "border-red/30 bg-red/5" : "border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2"}`}>
              <p className="text-xs capitalize text-gray-500">{type} Leave</p>
              <p className="text-lg font-bold text-dark dark:text-white">{balances[type].remaining} / {balances[type].total}</p>
              <p className="text-xs text-gray-500">Used: {balances[type].used}</p>
              {balances[type].remaining < 1 && <p className="text-xs font-medium text-red">Exhausted</p>}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
        <h2 className="mb-4 font-semibold text-dark dark:text-white">Apply for Leave</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-500">Leave Type</label>
            <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3">
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="emergency">Emergency</option>
              <option value="unpaid">Unpaid</option>
            </select>
            {balances && form.leave_type !== "unpaid" && (() => {
              const b = balances[form.leave_type as keyof typeof balances] as { remaining: number } | undefined;
              return b && b.remaining < 1 ? <p className="mt-1 text-xs text-red">No {form.leave_type} leave remaining</p> : null;
            })()}
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">From Date</label>
            <input type="date" required value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">To Date</label>
            <input type="date" required value={form.to_date} min={form.from_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-gray-500">Reason</label>
            <textarea required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3" />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="mt-4 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? "Submitting..." : "Submit Application"}
        </button>
      </form>

      <h2 className="mb-4 font-semibold text-dark dark:text-white">Leave History</h2>
      <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
              <th className="px-4 py-3">S.No</th><th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-center">Days</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, idx) => (
              <tr key={r.id} className="border-b border-stroke dark:border-stroke-dark"><td className="px-4 py-3 text-gray-500 tabular-nums">{idx + 1}</td>
                <td className="px-4 py-3">{new Date(r.from_date).toLocaleDateString()} – {new Date(r.to_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 capitalize">{r.leave_type}</td>
                <td className="px-4 py-3 text-center">{r.days}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                    r.status === "approved" ? "bg-green/20 text-green" :
                    r.status === "rejected" ? "bg-red/20 text-red" : "bg-yellow-dark/20 text-yellow-dark"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-xs">{r.rejection_reason || r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
