"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Target, TrendingUp, CheckCircle2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface MonthRow {
  month: string;
  label: string;
  due: number;
  recovered: number;
  target: number;
  isProjected: boolean;
  recoveryPercentage: number;
}

export default function AdminSalesTargetsPage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetMonth, setTargetMonth] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/monthly-installments`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setMonths(json.data.months || []); })
      .catch((err) => console.error("Failed to load monthly targets:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSetTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(targetMonth) || !targetAmount) {
      toast.error("Enter month as YYYY-MM and a target amount.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/monthly-installments/target`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ month: targetMonth, target_amount: parseFloat(targetAmount) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to set target.");
      toast.success("Target saved.");
      setTargetMonth("");
      setTargetAmount("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Sales Targets" />
      <PageHeader icon={Target} title="Sales Targets" subtitle="Monthly recovery due vs. actual vs. target, company-wide." />

      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">Set a Monthly Target</h2>
        <form onSubmit={handleSetTarget} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Month (YYYY-MM)</label>
            <input value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} placeholder="2026-08" className="w-40 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Target Amount (PKR)</label>
            <input type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="5000000" className="w-48 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <button type="submit" disabled={saving} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{saving ? "Saving..." : "Save Target"}</button>
        </form>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Month</th><th className="px-4 py-3 text-right font-bold">Due</th><th className="px-4 py-3 text-right font-bold">Recovered</th><th className="px-4 py-3 text-right font-bold">Target</th><th className="px-4 py-3 text-right font-bold">Recovery %</th><th className="px-4 py-3 font-bold">Status</th></tr>
            </thead>
            <tbody>
              {months.map((m, idx) => {
                const hitTarget = m.target > 0 && m.recovered >= m.target;
                return (
                  <tr key={m.month} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{m.label}{m.isProjected && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-500/10">Projected</span>}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(m.due)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600">{PKR(m.recovered)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{m.target > 0 ? PKR(m.target) : "—"}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{m.recoveryPercentage.toFixed(1)}%</td>
                    <td className="px-4 py-3.5">
                      {m.target > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${hitTarget ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10"}`}>
                          {hitTarget && <CheckCircle2 className="size-3" />} {hitTarget ? "On Target" : "Below Target"}
                        </span>
                      )}
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
