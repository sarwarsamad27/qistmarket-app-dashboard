"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Wallet, Search, FileDown, CheckCircle2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";
import { downloadAuthedFile } from "@/lib/employee-api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Slip {
  id: number;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  bonuses: number;
  commissions: number;
  deductions: number;
  net_payable: number;
  status: string;
  paid_date?: string | null;
  slip_data?: { payment?: { by: string; at: string; method?: string | null; reference?: string | null } } | null;
  employee: { id: number; employee_id: string; full_name: string; department?: string | null; designation?: string | null };
}

interface Totals { pending_count: number; pending_amount: number; paid_count: number; paid_amount: number }

/**
 * Salary payments: HR generates and reviews the monthly slips, Accounts pays
 * them here. Marking a slip paid deducts its loan installments and sends the
 * employee the "Salary Credited" notification.
 */
export default function SalaryPaymentsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState("pending");
  const [slips, setSlips] = useState<Slip[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState<Slip | null>(null);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ month: String(month), year: String(year), ...(status ? { status } : {}) });
      const res = await fetch(`${BACKEND_URL}/api/accounts/payroll?${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to load salary slips."));
      const json = await res.json();
      setSlips(json.slips || []);
      setTotals(json.totals || null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month, year, status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return slips;
    return slips.filter((s) =>
      s.employee.full_name.toLowerCase().includes(q) ||
      s.employee.employee_id.toLowerCase().includes(q) ||
      (s.employee.department || "").toLowerCase().includes(q));
  }, [slips, search]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/payroll/${paying.id}/pay`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ payment_method: method, reference }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to mark salary paid."));
      toast.success(`Salary paid to ${paying.employee.full_name} — employee notified`);
      setPaying(null);
      setReference("");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = (s: Slip) =>
    downloadAuthedFile(
      `/accounts/payroll/${s.id}/pdf`,
      `Salary-Slip-${s.employee.employee_id}-${s.year}-${String(s.month).padStart(2, "0")}.pdf`,
      "hr",
    ).catch((err) => toast.error((err as Error).message));

  const input = "rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2";

  return (
    <div>
      <Breadcrumb pageName="Salary Payments" />
      <PageHeader icon={Wallet} title="Salary Payments" subtitle="Pay the salary slips HR has prepared. Marking a slip paid deducts its loan installments and notifies the employee." />

      {totals && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Awaiting payment</p>
            <p className="mt-1 text-2xl font-black text-yellow-dark">{PKR(totals.pending_amount)}</p>
            <p className="text-xs text-gray-500">{totals.pending_count} slip{totals.pending_count === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid</p>
            <p className="mt-1 text-2xl font-black text-green">{PKR(totals.paid_amount)}</p>
            <p className="text-xs text-gray-500">{totals.paid_count} slip{totals.paid_count === 1 ? "" : "s"}</p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={month} onChange={(e) => setMonth(+e.target.value)} className={input}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} className={`${input} w-24`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          <option value="pending">Awaiting payment</option>
          <option value="paid">Paid</option>
          <option value="">All</option>
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee, ID or department..." className={`${input} w-full pl-9`} />
        </div>
      </div>

      {paying && (
        <form onSubmit={pay} className="mb-4 rounded-2xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <h3 className="font-semibold text-dark dark:text-white">
            Pay {paying.employee.full_name} — {MONTHS[paying.month - 1]} {paying.year}
          </h3>
          <p className="mb-3 text-sm text-gray-500">Net payable <span className="font-bold text-dark dark:text-white">{PKR(paying.net_payable)}</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-500">Payment method
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`${input} mt-1 w-full`}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="mobile_wallet">Mobile wallet</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">Reference / transaction ID (optional)
              <input value={reference} onChange={(e) => setReference(e.target.value)} className={`${input} mt-1 w-full`} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-green px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving..." : "Confirm payment"}
            </button>
            <button type="button" onClick={() => setPaying(null)} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-stroke-dark">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 text-left dark:border-stroke-dark dark:bg-dark-3">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3 text-right">Gross</th>
              <th className="px-4 py-3 text-right">Deductions</th>
              <th className="px-4 py-3 text-right">Net Payable</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No salary slips for this month. HR generates them from HR Portal → Payroll.</td></tr>
            )}
            {!loading && filtered.map((s) => {
              const gross = s.basic_salary + s.allowances + s.bonuses + s.commissions;
              const payment = s.slip_data?.payment;
              return (
                <tr key={s.id} className="border-b border-stroke dark:border-stroke-dark">
                  <td className="px-4 py-3">
                    <p className="font-medium text-dark dark:text-white">{s.employee.full_name}</p>
                    <p className="text-xs text-gray-500">{s.employee.employee_id}{s.employee.department ? ` · ${s.employee.department}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">{MONTHS[s.month - 1]} {s.year}</td>
                  <td className="px-4 py-3 text-right">{PKR(gross)}</td>
                  <td className="px-4 py-3 text-right">{PKR(s.deductions)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{PKR(s.net_payable)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "paid" ? "bg-green/10 text-green" : s.status === "pending" ? "bg-yellow-light-4/20 text-yellow-dark" : "bg-red/10 text-red"
                    }`}>{s.status === "pending" ? "awaiting payment" : s.status}</span>
                    {s.status === "paid" && (s.paid_date || payment) && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        {s.paid_date ? new Date(s.paid_date).toLocaleDateString() : ""}
                        {payment?.by ? ` · ${payment.by}` : ""}
                        {payment?.method ? ` · ${payment.method.replace(/_/g, " ")}` : ""}
                        {payment?.reference ? ` · ${payment.reference}` : ""}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    {s.status === "pending" && (
                      <button onClick={() => setPaying(s)} className="mr-3 inline-flex items-center gap-1 text-xs font-semibold text-green hover:underline">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                      </button>
                    )}
                    <button onClick={() => downloadPdf(s)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
