"use client";

import { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Search, User, Landmark, Building2, CheckCircle2 } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

interface Hit { order_id: number; order_ref: string; customer_name: string; whatsapp_number: string; product_name: string; outlet_name: string; status: string; is_delivered: boolean; has_ledger: boolean; remaining: number; overdue_amount: number; overdue_months: number; next_due_date: string | null; next_due_amount: number }
interface Row { monthNumber: number; dueDate: string | null; dueAmount: number; paidAmount: number; remainingAmount: number; status: string; paidAt?: string | null }
interface Account {
  order: { id: number; order_ref: string; customer_name: string; whatsapp_number: string; cnic: string | null; product_name: string; outlet_name: string; status: string; is_delivered: boolean };
  account: { total: number; paid: number; remaining: number; overdue_amount: number; overdue_months: number; next_month: number | null; next_due_date: string | null; next_due_amount: number; installments: Row[] } | null;
  payments: { id: number; type: string; month: number | null; amount: number; method: string | null; paid_at: string; collected_by: string | null }[];
}

const ROW_STATUS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  partial: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
};

/**
 * Head Office receives an installment for any customer: find the account, see the schedule,
 * take the payment (cash at Head Office or bank transfer). Less than the due month is a partial
 * payment; more rolls into the next months (advance).
 */
export default function ReceivePanel({ initialOrderId, onReceived }: { initialOrderId?: number | null; onReceived: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(initialOrderId ?? null);
  const [acc, setAcc] = useState<Account | null>(null);
  const [banks, setBanks] = useState<{ id: number; bank_name: string; account_number: string }[]>([]);
  const [form, setForm] = useState({ amount: "", method: "ho_cash" as "ho_cash" | "bank", bank_account_id: "", reference: "", feedback: "", alternate_number: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (initialOrderId) setOrderId(initialOrderId); }, [initialOrderId]);
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setBanks(j.data.filter((b: any) => b.is_active)); });
  }, []);

  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`${BACKEND_URL}/api/accounts/installments/search?q=${encodeURIComponent(q.trim())}`, { headers: authHeaders() })
        .then((r) => r.json()).then((j) => { if (j.success) setHits(j.data); }).finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const loadAccount = useCallback(() => {
    if (!orderId) return;
    setAcc(null);
    fetch(`${BACKEND_URL}/api/accounts/installments/account/${orderId}`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => {
        if (j.success) {
          setAcc(j.data);
          const a = j.data.account;
          setForm((f) => ({ ...f, amount: a ? String(Math.round(a.overdue_amount > 0 ? a.overdue_amount : a.next_due_amount)) : "" }));
        }
      });
  }, [orderId]);
  useEffect(() => { loadAccount(); }, [loadAccount]);

  const amount = parseFloat(form.amount) || 0;
  const a = acc?.account;
  const kind = !a ? "" : amount <= 0 ? "" : amount + 0.5 < a.next_due_amount ? "Partial payment" : amount - 0.5 > Math.max(a.overdue_amount, a.next_due_amount) ? "Covers future months too (advance)" : "Full installment";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acc?.account) return;
    if (!(amount > 0)) { toast.error("Enter the amount received."); return; }
    if (amount - acc.account.remaining > 1) { toast.error(`Only ${PKR(acc.account.remaining)} is remaining on this account.`); return; }
    if (form.method === "bank" && (!form.bank_account_id || !form.reference.trim())) { toast.error("Select the bank account and enter the transfer / slip reference."); return; }
    if (!confirm(`Receive ${PKR(amount)} from ${acc.order.customer_name} (${acc.order.order_ref}) — ${form.method === "bank" ? "bank transfer" : "cash at Head Office"}? The customer gets a WhatsApp receipt.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/installments/receive`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ order_id: acc.order.id, ...form, amount }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Could not receive payment."));
      const j = await res.json();
      toast.success(`Received ${PKR(amount)} — ${j.data.entry}`);
      setForm({ ...form, reference: "", feedback: "", alternate_number: "" });
      loadAccount();
      onReceived();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-stroke bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <h3 className="mb-2 text-sm font-bold text-dark dark:text-white">Find customer account</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, CNIC or order ref..." className={`${input} pl-9`} />
        </div>
        {searching ? <p className="text-xs text-gray-500">Searching…</p> : q.trim().length < 3 ? <p className="text-xs text-gray-500">Type at least 3 characters. Works for every outlet's customers.</p> : hits.length === 0 ? <p className="text-xs text-gray-500">No account found.</p> : (
          <div className="max-h-[540px] space-y-1.5 overflow-y-auto">
            {hits.map((h) => (
              <button key={h.order_id} onClick={() => setOrderId(h.order_id)} className={`w-full rounded-xl border p-3 text-left transition ${orderId === h.order_id ? "border-[#ff3d3d] bg-rose-50/50 dark:bg-rose-500/5" : "border-slate-100 hover:border-slate-300 dark:border-white/10"}`}>
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-semibold text-dark dark:text-white">{h.customer_name}</p>
                  <p className="font-mono text-[11px] text-gray-400">{h.order_ref}</p>
                </div>
                <p className="truncate text-xs text-gray-500">{h.product_name} · {h.outlet_name} · {h.whatsapp_number}</p>
                <p className="mt-1 text-xs">
                  {!h.has_ledger ? <span className="text-gray-400">No ledger yet ({h.status})</span> : h.remaining <= 0 ? <span className="font-semibold text-emerald-600">Fully paid</span> : (
                    <>Remaining <b>{PKR(h.remaining)}</b>{h.overdue_amount > 0 && <span className="ml-1 font-semibold text-rose-600">· overdue {PKR(h.overdue_amount)}</span>}</>
                  )}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        {!orderId ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={User} title="Select a customer account" description="Search on the left, or use Receive on any due installment." /></div>
        ) : !acc ? <TableSkeleton /> : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-dark dark:text-white">{acc.order.customer_name}</p>
                  <p className="text-xs text-gray-500">{acc.order.order_ref} · {acc.order.product_name} · {acc.order.outlet_name}</p>
                  <p className="text-xs text-gray-500">{acc.order.whatsapp_number}{acc.order.cnic ? ` · CNIC ${acc.order.cnic}` : ""}</p>
                </div>
                {a && (
                  <div className="grid grid-cols-3 gap-2 text-right">
                    <div><p className="text-[10px] font-black uppercase text-gray-400">Paid</p><p className="font-bold text-emerald-600">{PKR(a.paid)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-gray-400">Remaining</p><p className="font-bold text-dark dark:text-white">{PKR(a.remaining)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-gray-400">Overdue</p><p className={`font-bold ${a.overdue_amount > 0 ? "text-rose-600" : "text-gray-400"}`}>{PKR(a.overdue_amount)}</p></div>
                  </div>
                )}
              </div>
            </div>

            {!a ? (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={User} title="No installment ledger on this order yet" description="Installments start once the order is delivered." /></div>
            ) : (
              <>
                {a.remaining > 0 ? (
                  <form onSubmit={submit} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                    <h3 className="mb-1 text-sm font-bold text-dark dark:text-white">Receive installment</h3>
                    <p className="mb-3 text-xs text-gray-500">Next: month {a.next_month} — {PKR(a.next_due_amount)} due {day(a.next_due_date)}. The oldest unpaid month is settled first.</p>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setForm({ ...form, method: "ho_cash" })} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${form.method === "ho_cash" ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10" : "border-stroke text-gray-500 dark:border-dark-3"}`}><Building2 className="size-4" /> Cash at Head Office</button>
                      <button type="button" onClick={() => setForm({ ...form, method: "bank" })} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${form.method === "bank" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10" : "border-stroke text-gray-500 dark:border-dark-3"}`}><Landmark className="size-4" /> Bank transfer</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <label className="text-xs font-medium text-gray-500">Amount received (PKR) *
                        <input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${input} mt-1`} />
                        {kind && <span className="mt-1 block font-semibold text-gray-600 dark:text-gray-300">{kind}</span>}
                      </label>
                      {form.method === "bank" && (
                        <label className="text-xs font-medium text-gray-500">Paid into bank account *
                          <select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })} className={`${input} mt-1`}>
                            <option value="">Select...</option>
                            {banks.map((b) => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                          </select>
                        </label>
                      )}
                      <label className="text-xs font-medium text-gray-500">{form.method === "bank" ? "Bank txn / slip reference *" : "Receipt no."}
                        <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={`${input} mt-1`} />
                      </label>
                      <label className="text-xs font-medium text-gray-500">Extra WhatsApp number for receipt
                        <input value={form.alternate_number} onChange={(e) => setForm({ ...form, alternate_number: e.target.value })} placeholder="optional" className={`${input} mt-1`} />
                      </label>
                      <label className="text-xs font-medium text-gray-500 md:col-span-2">Remarks
                        <input value={form.feedback} onChange={(e) => setForm({ ...form, feedback: e.target.value })} className={`${input} mt-1`} />
                      </label>
                    </div>
                    <button type="submit" disabled={saving} className="mt-4 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="size-4" /> {saving ? "Saving..." : "Receive Payment"}</button>
                  </form>
                ) : <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10">This account is fully paid.</p>}

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                    <h4 className="mb-2 text-sm font-bold text-dark dark:text-white">Installment schedule</h4>
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] uppercase text-gray-400"><tr><th className="py-1.5">Month</th><th className="py-1.5">Due</th><th className="py-1.5 text-right">Amount</th><th className="py-1.5 text-right">Paid</th><th className="py-1.5">Status</th></tr></thead>
                        <tbody>
                          {a.installments.map((r) => {
                            const late = r.status !== "paid" && r.dueDate && new Date(r.dueDate) < new Date(new Date().toDateString());
                            return (
                              <tr key={r.monthNumber} className="border-t border-slate-100 dark:border-white/5">
                                <td className="py-1.5 font-medium">{r.monthNumber}</td>
                                <td className={`py-1.5 ${late ? "font-semibold text-rose-600" : "text-gray-500"}`}>{day(r.dueDate)}</td>
                                <td className="py-1.5 text-right tabular-nums">{PKR(r.dueAmount)}</td>
                                <td className="py-1.5 text-right tabular-nums">{r.paidAmount ? PKR(r.paidAmount) : "—"}</td>
                                <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${ROW_STATUS[r.status] || (late ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10")}`}>{late ? "overdue" : r.status}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                    <h4 className="mb-2 text-sm font-bold text-dark dark:text-white">Payments received</h4>
                    <div className="max-h-80 space-y-1.5 overflow-auto">
                      {acc.payments.length ? acc.payments.map((p) => (
                        <div key={p.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                          <div><p className="font-medium text-dark dark:text-white">{p.type === "installment" ? `Month ${p.month}` : p.type} · {p.method || "Cash"}</p><p className="text-gray-400">{new Date(p.paid_at).toLocaleString()}{p.collected_by ? ` · ${p.collected_by}` : ""}</p></div>
                          <p className="font-bold tabular-nums text-emerald-600">{PKR(p.amount)}</p>
                        </div>
                      )) : <p className="text-xs text-gray-500">No payments yet.</p>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
