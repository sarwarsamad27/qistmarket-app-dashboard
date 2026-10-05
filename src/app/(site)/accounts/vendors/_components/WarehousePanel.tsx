"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Warehouse, Send, KeyRound, X, Search } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface StockItem { id: number; product_name: string; category: string | null; imei_serial: string | null; color_variant: string | null; quantity: number; purchase_price: number; status: string }
interface Transfer { id: number; to_id: number; to_type: string; to_name: string; inventory_id: number; quantity_transferred: number; status: string; created_at: string; inventory: { product_name: string; imei_serial: string | null; color_variant: string | null; purchase_price: number } }
interface WarehouseData { warehouse: { id: number; name: string }; outlets: { id: number; name: string; code: string }[]; stock: StockItem[]; stock_value: number; transfers: Transfer[] }

/**
 * Stock Head Office bought (HO warehouse) and its transfers to outlets. Same OTP handshake as
 * outlet-to-outlet transfers: the receiving outlet gets the OTP and reads it back to Accounts.
 */
export default function WarehousePanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<WarehouseData | null>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [toOutlet, setToOutlet] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [otpFor, setOtpFor] = useState<{ to_id: number; to_name: string; items: Transfer[] } | null>(null);
  const [otp, setOtp] = useState("");

  const load = useCallback(() => {
    fetch(`${BACKEND_URL}/api/accounts/warehouse`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const inStock = useMemo(() => (data?.stock || []).filter((s) => s.status === "In Stock" && `${s.product_name} ${s.imei_serial || ""} ${s.category || ""}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const pendingGroups = useMemo(() => {
    const g: Record<number, { to_id: number; to_name: string; items: Transfer[] }> = {};
    (data?.transfers || []).filter((t) => t.status === "pending").forEach((t) => { (g[t.to_id] ||= { to_id: t.to_id, to_name: t.to_name, items: [] }).items.push(t); });
    return Object.values(g);
  }, [data]);

  const toggle = (item: StockItem) => setSelected((s) => { const n = { ...s }; if (n[item.id]) delete n[item.id]; else n[item.id] = item.quantity; return n; });

  const send = async () => {
    const ids = Object.entries(selected).map(([id, quantity]) => ({ id: parseInt(id), quantity }));
    if (!ids.length || !toOutlet) { toast.error("Select items and the outlet to send them to."); return; }
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/warehouse/transfer`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ inventory_ids: ids, to_id: toOutlet }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Transfer failed."));
      toast.success("OTP sent to the receiving outlet. Enter it below once they share it.");
      setSelected({});
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!otpFor || otp.length < 4) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/warehouse/transfer/verify`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ otp, to_id: otpFor.to_id, inventory_ids: otpFor.items.map((t) => ({ id: t.inventory_id, quantity: t.quantity_transferred })) }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) throw new Error(j.message || "Verification failed.");
      toast.success(`Stock delivered to ${otpFor.to_name}.`);
      setOtpFor(null); setOtp("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (group: { items: Transfer[] }) => {
    if (!confirm("Cancel this pending transfer? The items go back to warehouse stock.")) return;
    const res = await fetch(`${BACKEND_URL}/api/accounts/warehouse/transfer/cancel`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ transfer_ids: group.items.map((t) => t.id), reason: "Cancelled by Accounts" }) });
    if (res.ok) { toast.success("Transfer cancelled."); load(); } else toast.error(await apiErrorMessage(res, "Cancel failed."));
  };

  const resend = async (group: { to_id: number; items: Transfer[] }) => {
    const res = await fetch(`${BACKEND_URL}/api/accounts/warehouse/transfer/resend-otp`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ to_id: group.to_id, transfer_ids: group.items.map((t) => t.id) }) });
    if (res.ok) toast.success("OTP sent again."); else toast.error(await apiErrorMessage(res, "Could not resend."));
  };

  if (!data) return <TableSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"><Warehouse className="size-5" /></div>
        <div>
          <p className="text-sm font-bold text-dark dark:text-white">{data.warehouse.name}</p>
          <p className="text-xs text-gray-500">Stock bought by Head Office. Send it to outlets — the outlet receives an OTP and confirms delivery.</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stock value (cost)</p>
          <p className="text-lg font-black text-dark dark:text-white">{PKR(data.stock_value)}</p>
        </div>
      </div>

      {pendingGroups.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
          <h4 className="mb-2 text-sm font-bold text-amber-800 dark:text-amber-300">Waiting for the outlet’s OTP</h4>
          <div className="space-y-2">
            {pendingGroups.map((g) => (
              <div key={g.to_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm dark:bg-boxdark">
                <span className="font-semibold text-dark dark:text-white">{g.to_name}</span>
                <span className="text-xs text-gray-500">{g.items.length} item(s): {g.items.slice(0, 3).map((t) => t.inventory.product_name).join(", ")}{g.items.length > 3 ? "…" : ""}</span>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => { setOtpFor(g); setOtp(""); }} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"><KeyRound className="size-3.5" /> Enter OTP</button>
                  <button onClick={() => resend(g)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">Resend</button>
                  <button onClick={() => cancel(g)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-500">Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4 dark:border-white/10">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Product, IMEI..." className="w-full rounded-xl border border-stroke bg-white py-2 pl-9 pr-3 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <select value={toOutlet} onChange={(e) => setToOutlet(e.target.value)} className="rounded-xl border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white">
            <option value="">Send to outlet...</option>
            {data.outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
          </select>
          <button onClick={send} disabled={busy || !Object.keys(selected).length || !toOutlet} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Send className="size-4" /> Transfer {Object.keys(selected).length || ""} item(s)</button>
          <div className="ml-auto">
            <ExportMenu title="Head Office Warehouse Stock" columns={[
              { header: "Product", value: (s: StockItem) => s.product_name },
              { header: "Category", value: (s) => s.category || "" },
              { header: "Variant", value: (s) => s.color_variant || "" },
              { header: "IMEI / Serial", value: (s) => s.imei_serial || "" },
              { header: "Qty", value: (s) => s.quantity, numeric: true },
              { header: "Unit cost", value: (s) => s.purchase_price, numeric: true },
              { header: "Status", value: (s) => s.status },
            ]} getRows={() => data.stock} />
          </div>
        </div>
        {inStock.length ? (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-2.5"></th><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5">IMEI / Serial</th><th className="px-4 py-2.5 text-right">In stock</th><th className="px-4 py-2.5 text-right">Send qty</th><th className="px-4 py-2.5 text-right">Unit cost</th></tr>
              </thead>
              <tbody>
                {inStock.map((s) => (
                  <tr key={s.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-2.5"><input type="checkbox" checked={!!selected[s.id]} onChange={() => toggle(s)} className="size-4 accent-[#ff3d3d]" /></td>
                    <td className="px-4 py-2.5 font-medium text-dark dark:text-white">{s.product_name}<p className="text-xs font-normal text-gray-400">{[s.category, s.color_variant].filter(Boolean).join(" · ")}</p></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{s.imei_serial || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.quantity}</td>
                    <td className="px-4 py-2.5 text-right">
                      {selected[s.id] !== undefined && s.quantity > 1 && !s.imei_serial ? (
                        <input type="number" min={1} max={s.quantity} value={selected[s.id]} onChange={(e) => setSelected({ ...selected, [s.id]: Math.max(1, Math.min(s.quantity, parseInt(e.target.value) || 1)) })} className="w-20 rounded-lg border border-stroke px-2 py-1 text-right text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                      ) : selected[s.id] ? selected[s.id] : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(s.purchase_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Warehouse} title="No stock in the Head Office warehouse" description="Record a Head Office purchase to add stock here." />}
      </div>

      {data.transfers.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h4 className="mb-3 text-sm font-bold text-dark dark:text-white">Transfers to outlets</h4>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-gray-400"><tr><th className="py-1.5">Date</th><th className="py-1.5">To</th><th className="py-1.5">Product</th><th className="py-1.5">IMEI</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5">Status</th></tr></thead>
              <tbody>
                {data.transfers.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 dark:border-white/5">
                    <td className="py-1.5 text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="py-1.5 font-medium text-dark dark:text-white">{t.to_name}</td>
                    <td className="py-1.5">{t.inventory?.product_name}</td>
                    <td className="py-1.5 font-mono text-gray-500">{t.inventory?.imei_serial || "—"}</td>
                    <td className="py-1.5 text-right">{t.quantity_transferred}</td>
                    <td className="py-1.5 capitalize">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {otpFor && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setOtpFor(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-dark dark:text-white">Confirm delivery to {otpFor.to_name}</h3>
              <button onClick={() => setOtpFor(null)} className="text-gray-400"><X className="size-4" /></button>
            </div>
            <p className="mb-3 text-xs text-gray-500">Ask the outlet for the OTP they received and enter it here. The stock moves to their inventory only after this.</p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="OTP" className="mb-3 w-full rounded-xl border border-stroke px-4 py-2.5 text-center text-lg font-bold tracking-[0.4em] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            <button onClick={verify} disabled={busy || otp.length < 4} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Verifying..." : "Verify & Transfer"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
