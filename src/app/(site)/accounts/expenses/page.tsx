"use client";

import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { CreditCard, Receipt, Tags, Store, Plus, ClipboardCheck, Users2, Trash2, Check, X, Upload, ExternalLink, Loader2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import OutletSelector from "@/components/common/OutletSelector";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface ExpenseSummary {
  today: number;
  thisMonth: number;
  topCategories: { category: string; amount: number }[];
  outletWise: { outlet_id: number | null; outlet_name: string; thisMonth: number }[];
}
interface ExpenseVoucher {
  id: number;
  voucher_number: string;
  total_amount: number;
  status: string;
  date: string;
  invoice_url: string | null;
  outlet: { name: string } | null;
  items: { category: string; amount: number; description: string | null }[];
}
interface SalaryMonth { month: string; total: number; paid: number; pending: number; count: number }

const TABS = [
  { key: "summary" as const, label: "Summary", icon: CreditCard },
  { key: "create" as const, label: "Create Expense", icon: Plus },
  { key: "approvals" as const, label: "Approvals", icon: ClipboardCheck },
  { key: "salary" as const, label: "Salary Expenses", icon: Users2 },
];

export default function AccountsExpensesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("summary");
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ outlet_id: "", payment_method: "Cash", notes: "" });
  const [items, setItems] = useState([{ category: "General", amount: "", description: "" }]);
  const [creating, setCreating] = useState(false);

  const [approvals, setApprovals] = useState<ExpenseVoucher[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<number | null>(null);
  const invoiceInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const [salaryMonths, setSalaryMonths] = useState<SalaryMonth[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/expenses/summary`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setSummary(json.summary); })
      .catch((err) => console.error("Failed to load expense summary:", err))
      .finally(() => setLoading(false));
  }, []);

  const fetchApprovals = () => {
    setApprovalsLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/expenses/approvals?status=pending`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setApprovals(json.data); })
      .finally(() => setApprovalsLoading(false));
  };

  useEffect(() => {
    if (tab === "approvals") fetchApprovals();
    if (tab === "salary") {
      setSalaryLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/expenses/salary`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((json) => { if (json.success) setSalaryMonths(json.data.months); })
        .finally(() => setSalaryLoading(false));
    }
  }, [tab]);

  const maxCategory = summary?.topCategories.reduce((m, c) => Math.max(m, c.amount), 0) || 0;

  const addItem = () => setItems([...items, { category: "General", amount: "", description: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: string) => setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.amount && parseFloat(it.amount) > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one item with an amount.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, outlet_id: form.outlet_id || null, items: validItems }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to create expense.");
      toast.success("Expense submitted for approval.");
      setForm({ outlet_id: "", payment_method: "Cash", notes: "" });
      setItems([{ category: "General", amount: "", description: "" }]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleInvoiceUpload = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInvoiceId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses/${id}/invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to upload invoice.");
      toast.success("Invoice uploaded.");
      setApprovals((prev) => prev.map((v) => (v.id === id ? { ...v, invoice_url: json.data.invoice_url } : v)));
    } catch (err: any) {
      toast.error(err.message || "Failed to upload invoice.");
    } finally {
      setUploadingInvoiceId(null);
      e.target.value = "";
    }
  };

  const handleDecision = async (id: number, decision: "approved" | "rejected") => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses/${id}/decision`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ decision }) });
      if (!res.ok) throw new Error("Decision failed.");
      toast.success(`Expense ${decision}.`);
      fetchApprovals();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Expenses" />
      <PageHeader icon={CreditCard} title="Expenses" subtitle="Head office and outlet expense tracking, consolidated." />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {loading ? (
              <><StatCardSkeleton /><StatCardSkeleton /></>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 dark:border-rose-500/20 dark:from-rose-500/10 dark:to-transparent">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600"><Receipt className="size-5" strokeWidth={2.25} /></div>
                  <div><p className="text-[10px] font-black uppercase tracking-widest text-rose-600/80">Today's Expense</p><p className="text-2xl font-black leading-tight text-rose-700 dark:text-rose-400">{PKR(summary?.today || 0)}</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-transparent">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-600"><CreditCard className="size-5" strokeWidth={2.25} /></div>
                  <div><p className="text-[10px] font-black uppercase tracking-widest text-orange-600/80">This Month's Expense</p><p className="text-2xl font-black leading-tight text-orange-700 dark:text-orange-400">{PKR(summary?.thisMonth || 0)}</p></div>
                </div>
              </>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><TableSkeleton rows={5} cols={2} /><TableSkeleton rows={5} cols={2} /></div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-4 flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10"><Tags className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Top Expense Categories (This Month)</h2></div>
                {summary && summary.topCategories.length > 0 ? (
                  <div className="space-y-4">
                    {summary.topCategories.map((c) => (
                      <div key={c.category}>
                        <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium text-gray-600 dark:text-gray-300">{c.category}</span><span className="font-bold tabular-nums text-dark dark:text-white">{PKR(c.amount)}</span></div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-dark-3"><div className="h-full rounded-full bg-rose-400" style={{ width: `${maxCategory > 0 ? (c.amount / maxCategory) * 100 : 0}%` }} /></div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon={Tags} title="No expense categories recorded yet" />}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-4 flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10"><Store className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Outlet Wise (This Month)</h2></div>
                {summary && summary.outletWise.length > 0 ? (
                  <div className="space-y-3">
                    {summary.outletWise.map((o) => (
                      <div key={o.outlet_id ?? "unassigned"} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0 dark:border-white/5"><span className="text-sm font-medium text-gray-600 dark:text-gray-300">{o.outlet_name}</span><span className="font-bold tabular-nums text-dark dark:text-white">{PKR(o.thisMonth)}</span></div>
                    ))}
                  </div>
                ) : <EmptyState icon={Store} title="No outlet expenses recorded this month" />}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "create" && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <form onSubmit={handleCreateExpense} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Outlet</label>
                <OutletSelector selectedId={form.outlet_id || "all"} onSelect={(id) => setForm({ ...form, outlet_id: id === "all" ? "" : id })} allLabel="Head Office (no outlet)" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Payment Method</label>
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-dark dark:text-white">Items</label>
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-[#ff3d3d]"><Plus className="size-3.5" /> Add item</button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)} placeholder="Category" className="w-32 rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                    <input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description" className="flex-1 rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                    <input type="number" value={item.amount} onChange={(e) => updateItem(i, "amount", e.target.value)} placeholder="Amount" className="w-32 rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                    {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            </div>

            <button type="submit" disabled={creating} className="rounded-xl bg-[#ff3d3d] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
              {creating ? "Submitting..." : "Submit for Approval"}
            </button>
          </form>
        </div>
      )}

      {tab === "approvals" && (
        approvalsLoading ? <TableSkeleton /> : approvals.length > 0 ? (
          <div className="space-y-4">
            {approvals.map((v) => (
              <div key={v.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-dark dark:text-white">{v.voucher_number} <span className="ml-2 text-xs font-normal text-gray-400">{v.outlet?.name || "Head Office"}</span></p>
                    <p className="text-xs text-gray-500">{new Date(v.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-xl font-black text-dark dark:text-white">{PKR(v.total_amount)}</p>
                </div>
                <div className="mb-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  {v.items.map((it, i) => <div key={i} className="flex justify-between"><span>{it.category}{it.description ? ` — ${it.description}` : ""}</span><span className="tabular-nums">{PKR(it.amount)}</span></div>)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleDecision(v.id, "approved")} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"><Check className="size-3.5" /> Approve</button>
                  <button onClick={() => handleDecision(v.id, "rejected")} className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"><X className="size-3.5" /> Reject</button>

                  <input
                    ref={(el) => { invoiceInputRefs.current[v.id] = el; }}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleInvoiceUpload(v.id, e)}
                  />
                  {v.invoice_url ? (
                    <a href={`${BACKEND_URL}${v.invoice_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-white/5 dark:text-gray-300">
                      <ExternalLink className="size-3.5" /> View Invoice
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingInvoiceId === v.id}
                      onClick={() => invoiceInputRefs.current[v.id]?.click()}
                      className="flex items-center gap-1.5 rounded-lg bg-[#ff3d3d]/10 px-4 py-2 text-xs font-bold text-[#ff3d3d] hover:bg-[#ff3d3d]/20 disabled:opacity-50"
                    >
                      {uploadingInvoiceId === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      {uploadingInvoiceId === v.id ? "Uploading..." : "Upload Invoice"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={ClipboardCheck} title="No expenses pending approval" /></div>
      )}

      {tab === "salary" && (
        salaryLoading ? <TableSkeleton /> : salaryMonths.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3 font-bold">Month</th><th className="px-4 py-3 text-right font-bold">Employees</th><th className="px-4 py-3 text-right font-bold">Paid</th><th className="px-4 py-3 text-right font-bold">Pending</th><th className="px-4 py-3 text-right font-bold">Total</th></tr>
              </thead>
              <tbody>
                {salaryMonths.map((m) => (
                  <tr key={m.month} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{m.month}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{m.count}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600">{PKR(m.paid)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-amber-600">{PKR(m.pending)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Users2} title="No payroll data yet" description="Salary expenses are pulled from the HR module's payroll slips." /></div>
      )}
    </>
  );
}
