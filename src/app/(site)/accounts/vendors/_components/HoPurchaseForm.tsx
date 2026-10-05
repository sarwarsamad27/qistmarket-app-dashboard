"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Plus, Trash2, X } from "lucide-react";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Row { product_name: string; category: string; color_variant: string; quantity: string; unit_price: string; imeis: string }
const blankRow = (): Row => ({ product_name: "", category: "", color_variant: "", quantity: "1", unit_price: "", imeis: "" });

/**
 * Purchase made by Head Office — the stock goes into the Head Office warehouse (and from there to
 * outlets via Warehouse → Transfer). Several IMEIs on one line (comma / new line separated) become
 * one unit each.
 */
export default function HoPurchaseForm({ vendors, onClose, onSaved }: { vendors: { id: number; name: string; outlet: { name: string } | null }[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [vendorId, setVendorId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [saving, setSaving] = useState(false);

  const imeiList = (r: Row) => r.imeis.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const qtyOf = (r: Row) => (imeiList(r).length || parseInt(r.quantity) || 0);
  const total = rows.reduce((s, r) => s + qtyOf(r) * (parseFloat(r.unit_price) || 0), 0);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) { toast.error("Select the vendor."); return; }
    if (rows.some((r) => !r.product_name.trim() || !(parseFloat(r.unit_price) > 0) || qtyOf(r) < 1)) { toast.error("Every line needs a product, quantity and unit price."); return; }
    const badYear = (d: string) => !!d && !/^(20\d{2}|2100)-/.test(d);
    if (badYear(purchaseDate) || badYear(dueDate)) { toast.error("A date has an invalid year — please re-enter it."); return; }
    const items = rows.flatMap((r) => {
      const imeis = imeiList(r);
      const base = { product_name: r.product_name.trim(), category: r.category || null, color_variant: r.color_variant || null, unit_price: parseFloat(r.unit_price) };
      return imeis.length ? imeis.map((imei) => ({ ...base, imei_serial: imei, quantity: 1 })) : [{ ...base, imei_serial: "", quantity: parseInt(r.quantity) || 1 }];
    });
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/purchases`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, purchase_date: purchaseDate, due_date: dueDate || null, notes, items }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Could not save purchase."));
      const j = await res.json();
      toast.success(`Purchase ${j.purchase.invoice_number} saved — stock added to the Head Office warehouse.`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input = "w-full rounded-lg border border-stroke bg-white px-2.5 py-2 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-dark dark:text-white">New Head Office Purchase</h3>
            <p className="text-xs text-gray-500">Stock is received into the Head Office warehouse; transfer it to outlets from the Warehouse tab.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="size-4" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-gray-500 md:col-span-2">Vendor *
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={`${input} mt-1`}>
                <option value="">Select vendor...</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.outlet ? ` (${v.outlet.name})` : " (Head Office)"}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-500">Purchase date
              <input type="date" min="2000-01-01" max="2100-12-31" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={`${input} mt-1`} />
            </label>
            <label className="text-xs font-medium text-gray-500">Payment due date
              <input type="date" min="2000-01-01" max="2100-12-31" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${input} mt-1`} />
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-dark-2">
                <tr><th className="px-2 py-2">Product *</th><th className="px-2 py-2">Category</th><th className="px-2 py-2">Variant</th><th className="px-2 py-2">IMEIs (one per unit)</th><th className="px-2 py-2 w-20">Qty</th><th className="px-2 py-2 w-28">Unit price *</th><th className="px-2 py-2 text-right">Line total</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 align-top dark:border-white/5">
                    <td className="px-2 py-2"><input value={r.product_name} onChange={(e) => set(i, { product_name: e.target.value })} className={input} /></td>
                    <td className="px-2 py-2"><input value={r.category} onChange={(e) => set(i, { category: e.target.value })} className={input} placeholder="Mobile" /></td>
                    <td className="px-2 py-2"><input value={r.color_variant} onChange={(e) => set(i, { color_variant: e.target.value })} className={input} /></td>
                    <td className="px-2 py-2"><textarea rows={1} value={r.imeis} onChange={(e) => set(i, { imeis: e.target.value })} className={`${input} min-w-[160px]`} placeholder="optional" /></td>
                    <td className="px-2 py-2"><input type="number" min={1} value={imeiList(r).length || r.quantity} disabled={imeiList(r).length > 0} onChange={(e) => set(i, { quantity: e.target.value })} className={input} /></td>
                    <td className="px-2 py-2"><input type="number" min={0} value={r.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} className={input} /></td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{PKR(qtyOf(r) * (parseFloat(r.unit_price) || 0))}</td>
                    <td className="px-2 py-2">{rows.length > 1 && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => setRows([...rows, blankRow()])} className="flex items-center gap-1 text-sm font-semibold text-[#ff3d3d]"><Plus className="size-4" /> Add line</button>
          <label className="block text-xs font-medium text-gray-500">Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} mt-1`} />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <p className="text-sm text-gray-500">Total: <span className="text-lg font-black text-dark dark:text-white">{PKR(total)}</span></p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-stroke px-4 py-2.5 text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-gray-300">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save Purchase"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
