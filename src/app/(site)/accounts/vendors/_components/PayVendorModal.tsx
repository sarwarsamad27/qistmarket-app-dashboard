"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { X, Landmark, Building2 } from "lucide-react";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

export interface PayTarget {
  vendor_id?: number | null;
  vendor_name: string;
  purchase_id?: number;
  invoice_number?: string;
  outstanding: number;
  scheduled_payment_id?: number;
  suggested_amount?: number;
}

/**
 * Pay a vendor from a Head Office bank account or the Head Office cash book. Without an invoice
 * the amount settles the vendor's open invoices oldest-due first.
 */
export default function PayVendorModal({ target, onClose, onPaid }: { target: PayTarget; onClose: () => void; onPaid: () => void }) {
  const [banks, setBanks] = useState<{ id: number; bank_name: string; account_number: string; current_balance: number; is_active: boolean }[]>([]);
  const [hoCash, setHoCash] = useState<number | null>(null);
  const [form, setForm] = useState({
    source: "bank" as "bank" | "ho_cash",
    bank_account_id: "",
    amount: String(Math.min(target.suggested_amount ?? target.outstanding, target.outstanding) || ""),
    reference: "",
    notes: "",
    payment_date: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setBanks(j.data.filter((b: any) => b.is_active)); });
    fetch(`${BACKEND_URL}/api/accounts/ho-cash?type=none`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setHoCash(j.data.balance); });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) { toast.error("Enter the amount to pay."); return; }
    if (amount - target.outstanding > 0.5) { toast.error(`Outstanding is only ${PKR(target.outstanding)}.`); return; }
    if (form.source === "bank" && !form.bank_account_id) { toast.error("Select the bank account."); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/payments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          vendor_id: target.vendor_id, purchase_id: target.purchase_id, scheduled_payment_id: target.scheduled_payment_id,
          amount, source: form.source, bank_account_id: form.bank_account_id || undefined,
          reference: form.reference, notes: form.notes, payment_date: form.payment_date || undefined,
        }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Payment failed."));
      const j = await res.json();
      toast.success(`Paid ${PKR(amount)} to ${target.vendor_name} — ${j.data.bank_transaction?.transaction_no || j.data.ho_cash_transaction?.transaction_id}`);
      onPaid();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-xl border border-stroke bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-sm font-bold text-dark dark:text-white">Pay {target.vendor_name}</h3>
            <p className="text-xs text-gray-500">{target.invoice_number ? `Invoice ${target.invoice_number} · ` : "Settles open invoices oldest-due first · "}outstanding {PKR(target.outstanding)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="size-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm({ ...form, source: "bank" })} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${form.source === "bank" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10" : "border-stroke text-gray-500 dark:border-dark-3"}`}><Landmark className="size-4" /> Bank (online)</button>
            <button type="button" onClick={() => setForm({ ...form, source: "ho_cash" })} className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold ${form.source === "ho_cash" ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-500/10" : "border-stroke text-gray-500 dark:border-dark-3"}`}><Building2 className="size-4" /> Head Office cash</button>
          </div>
          {form.source === "bank" ? (
            <label className="block text-xs font-medium text-gray-500">Pay from bank account *
              <select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })} className={`${input} mt-1`}>
                <option value="">Select...</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number} ({PKR(b.current_balance)})</option>)}
              </select>
            </label>
          ) : (
            <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">Head Office cash in hand: <b>{hoCash === null ? "…" : PKR(hoCash)}</b></p>
          )}
          <label className="block text-xs font-medium text-gray-500">Amount (PKR) *
            <input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${input} mt-1`} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-gray-500">{form.source === "bank" ? "Transfer / cheque ref" : "Receipt no."}
              <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="block text-xs font-medium text-gray-500">Payment date
              <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} className={`${input} mt-1`} />
            </label>
          </div>
          <label className="block text-xs font-medium text-gray-500">Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} mt-1`} />
          </label>
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{saving ? "Paying..." : "Confirm Payment"}</button>
          <button type="button" onClick={onClose} className="rounded-xl border border-stroke px-4 py-2.5 text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-gray-300">Cancel</button>
        </div>
      </form>
    </div>
  );
}
