"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Warehouse, ArrowLeftRight, Undo2, Search, Package, PackageCheck, PackageX, AlertTriangle, Archive, Ban, TrendingUp, TrendingDown, Scale, ScanBarcode } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface WarehouseSummaryItem { product: string; total: number; inStock: number; sold: number; valuation: number }
interface Transfer { id: number; status: string; quantity_transferred: number; created_at: string; product_name: string; imei_serial: string; from: string; to: string }
interface ReturnItem { id: number; order_ref: string; customer_name: string; outlet_name: string; type: string; status: string; imei_returned: string; refund_amount: number; created_at: string }
interface ImeiResult {
  inventory: { id: number; imei_serial: string; product_name: string; status: string; outlet_name: string }[];
  payTriggerDevice: { imei: string; lock_status: string; enrollment_status: string; order_ref: string } | null;
  returns: { id: number; imei_returned: string; outlet_name: string; status: string; created_at: string }[];
}
interface LowStockItem { outlet_id: number; outlet_name: string; product_name: string; inStock: number; threshold: number }
interface DeadStockItem { id: number; product_name: string; imei_serial: string | null; outlet_name: string; created_at: string; daysInStock: number }
interface DamagedItem { id: number; product_name: string; imei_serial: string | null; outlet_name: string; purchase_price: number; updated_at: string }
interface MovementItem { product_name: string; inStock: number; soldLast30Days: number; totalSold: number }
interface PricingItem { product_name: string; min: number; max: number; spread: number; hasInconsistency: boolean; byOutlet: { outlet_name: string; price: number }[] }
interface BarcodeItem { id: number; barcode: string; product_name: string; status: string; outlet_name: string }

const TABS = [
  { key: "warehouse" as const, label: "Warehouse Stock", icon: Warehouse },
  { key: "transfers" as const, label: "Stock Transfers", icon: ArrowLeftRight },
  { key: "returns" as const, label: "Returns", icon: Undo2 },
  { key: "imei" as const, label: "IMEI / Barcode", icon: Search },
  { key: "health" as const, label: "Health Alerts", icon: AlertTriangle },
  { key: "damaged" as const, label: "Damaged Stock", icon: Ban },
  { key: "movement" as const, label: "Product Movement", icon: TrendingUp },
  { key: "pricing" as const, label: "Pricing Comparison", icon: Scale },
];

export default function AdminInventoryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("warehouse");

  const [warehouseSummary, setWarehouseSummary] = useState<WarehouseSummaryItem[]>([]);
  const [warehouseCount, setWarehouseCount] = useState(0);
  const [warehouseLoading, setWarehouseLoading] = useState(true);

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);

  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);

  const [imei, setImei] = useState("");
  const [imeiResult, setImeiResult] = useState<ImeiResult | null>(null);
  const [imeiLoading, setImeiLoading] = useState(false);

  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [deadStock, setDeadStock] = useState<DeadStockItem[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);

  const [barcode, setBarcode] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<BarcodeItem[] | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const [damaged, setDamaged] = useState<DamagedItem[]>([]);
  const [damagedLoading, setDamagedLoading] = useState(false);

  const [movement, setMovement] = useState<{ fastMoving: MovementItem[]; slowMoving: MovementItem[] } | null>(null);
  const [movementLoading, setMovementLoading] = useState(false);

  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/stock/warehouse`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setWarehouseSummary(json.data.summary || []);
          setWarehouseCount((json.data.warehouses || []).length);
        }
      })
      .catch((err) => console.error("Failed to load warehouse summary:", err))
      .finally(() => setWarehouseLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "transfers" && transfers.length === 0) {
      setTransfersLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/stock/transfers?limit=50`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => { if (json.success) setTransfers(json.data || []); })
        .finally(() => setTransfersLoading(false));
    }
    if (tab === "returns" && returns.length === 0) {
      setReturnsLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/stock/returns`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => { if (json.success) setReturns(json.data.items || []); })
        .finally(() => setReturnsLoading(false));
    }
    if (tab === "health" && lowStock.length === 0 && deadStock.length === 0) {
      setHealthLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/stock/health-alerts`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            setLowStock(json.data.lowStock || []);
            setDeadStock(json.data.deadStock || []);
          }
        })
        .finally(() => setHealthLoading(false));
    }
    if (tab === "damaged" && damaged.length === 0) {
      setDamagedLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/stock/damaged`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => { if (json.success) setDamaged(json.data || []); })
        .finally(() => setDamagedLoading(false));
    }
    if (tab === "movement" && !movement) {
      setMovementLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/stock/movement`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => { if (json.success) setMovement(json.data); })
        .finally(() => setMovementLoading(false));
    }
    if (tab === "pricing" && pricing.length === 0) {
      setPricingLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/stock/pricing-comparison`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => { if (json.success) setPricing(json.data || []); })
        .finally(() => setPricingLoading(false));
    }
  }, [tab]);

  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim().length < 3) return;
    setBarcodeLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/stock/barcode/${encodeURIComponent(barcode.trim())}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setBarcodeResult(json.data);
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleMarkDamaged = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/stock/${id}/mark-damaged`, { method: "PATCH", headers: authHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to mark item damaged.");
      toast.success("Item marked as damaged.");
      setImeiResult((prev) => prev ? { ...prev, inventory: prev.inventory.filter((i) => i.id !== id) } : prev);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImeiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imei.trim().length < 4) return;
    setImeiLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/stock/imei/${encodeURIComponent(imei.trim())}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setImeiResult(json.data);
    } finally {
      setImeiLoading(false);
    }
  };

  const totals = {
    products: warehouseSummary.length,
    inStock: warehouseSummary.reduce((s, w) => s + w.inStock, 0),
    valuation: warehouseSummary.reduce((s, w) => s + w.valuation, 0),
  };

  return (
    <>
      <Breadcrumb pageName="Inventory & Warehouse" />
      <PageHeader icon={Warehouse} title="Inventory & Warehouse" subtitle="Central warehouse stock, transfers, returns, and IMEI lookup." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Warehouse} label="Warehouses" value={warehouseCount} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        <StatCard icon={Package} label="Products" value={totals.products} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
        <StatCard icon={PackageCheck} label="In Stock" value={totals.inStock.toLocaleString()} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
        <StatCard icon={PackageX} label="Stock Valuation" value={PKR(totals.valuation)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "warehouse" && (
        warehouseLoading ? <TableSkeleton /> : warehouseSummary.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Warehouse} title="No warehouse-tagged outlets yet" description="Tag an outlet's type as 'warehouse' to see central stock here." /></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 text-right font-bold">Total</th><th className="px-4 py-3 text-right font-bold">In Stock</th><th className="px-4 py-3 text-right font-bold">Sold</th><th className="px-4 py-3 text-right font-bold">Valuation</th></tr></thead>
              <tbody>{warehouseSummary.map((w, idx) => (
                <tr key={w.product} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{w.product}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{w.total}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-600">{w.inStock}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{w.sold}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(w.valuation)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {tab === "transfers" && (
        transfersLoading ? <TableSkeleton /> : transfers.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={ArrowLeftRight} title="No stock transfers yet" /></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">IMEI</th><th className="px-4 py-3 font-bold">From</th><th className="px-4 py-3 font-bold">To</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Date</th></tr></thead>
              <tbody>{transfers.map((t, idx) => (
                <tr key={t.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{t.product_name || "—"}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{t.imei_serial || "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{t.from}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{t.to}</td>
                  <td className="px-4 py-3.5"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-600 dark:bg-blue-500/10">{t.status}</span></td>
                  <td className="px-4 py-3.5 text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {tab === "returns" && (
        returnsLoading ? <TableSkeleton /> : returns.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Undo2} title="No returns recorded" /></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Type</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Refund</th></tr></thead>
              <tbody>{returns.map((r, idx) => (
                <tr key={r.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-semibold text-[#ff3d3d]">{r.order_ref || "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.customer_name || "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.outlet_name || "—"}</td>
                  <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{r.type}</td>
                  <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{r.status}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(r.refund_amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {tab === "imei" && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <form onSubmit={handleImeiSearch} className="flex max-w-md flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Search by IMEI (min 4 digits)..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <button type="submit" disabled={imeiLoading} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{imeiLoading ? "..." : "Search"}</button>
            </form>
            <form onSubmit={handleBarcodeSearch} className="flex max-w-md flex-1 gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Search by barcode (min 3 chars)..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <button type="submit" disabled={barcodeLoading} className="rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50 dark:bg-white/10">{barcodeLoading ? "..." : "Search"}</button>
            </form>
          </div>

          {barcodeResult && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Barcode Results ({barcodeResult.length})</h3>
              {barcodeResult.length === 0 ? <p className="text-sm text-gray-400">No matches.</p> : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {barcodeResult.map((b) => (
                    <div key={b.id} className="rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
                      <p className="font-mono text-xs">{b.barcode}</p>
                      <p className="font-medium text-dark dark:text-white">{b.product_name}</p>
                      <p className="text-xs text-gray-400">{b.status} · {b.outlet_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {imeiResult && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Inventory ({imeiResult.inventory.length})</h3>
                {imeiResult.inventory.length === 0 ? <p className="text-sm text-gray-400">No matches.</p> : imeiResult.inventory.map((i) => (
                  <div key={i.id} className="flex items-start justify-between gap-2 border-t border-slate-50 py-2 text-sm first:border-0 dark:border-white/5">
                    <div>
                      <p className="font-mono text-xs">{i.imei_serial}</p>
                      <p className="font-medium text-dark dark:text-white">{i.product_name}</p>
                      <p className="text-xs text-gray-400">{i.status} · {i.outlet_name}</p>
                    </div>
                    {i.status !== "Damaged" && (
                      <button onClick={() => handleMarkDamaged(i.id)} className="shrink-0 text-[10px] font-bold text-rose-500 hover:underline">Mark Damaged</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">PayTrigger Device</h3>
                {imeiResult.payTriggerDevice ? (
                  <div className="text-sm">
                    <p className="font-mono text-xs">{imeiResult.payTriggerDevice.imei}</p>
                    <p className="font-medium text-dark dark:text-white">Lock: {imeiResult.payTriggerDevice.lock_status}</p>
                    <p className="text-xs text-gray-400">Enrollment: {imeiResult.payTriggerDevice.enrollment_status}</p>
                    <p className="text-xs text-gray-400">Order: {imeiResult.payTriggerDevice.order_ref || "—"}</p>
                  </div>
                ) : <p className="text-sm text-gray-400">No PayTrigger record.</p>}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Returns ({imeiResult.returns.length})</h3>
                {imeiResult.returns.length === 0 ? <p className="text-sm text-gray-400">No return history.</p> : imeiResult.returns.map((r) => (
                  <div key={r.id} className="border-t border-slate-50 py-2 text-sm first:border-0 dark:border-white/5">
                    <p className="font-medium text-dark dark:text-white">{r.outlet_name}</p>
                    <p className="text-xs text-gray-400">{r.status} · {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "health" && (
        healthLoading ? <TableSkeleton /> : (lowStock.length === 0 && deadStock.length === 0) ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={AlertTriangle} title="No inventory health alerts" description="No low-stock or dead-stock items detected." /></div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><AlertTriangle className="size-4 text-amber-500" /> Low Stock ({lowStock.length})</h3>
              {lowStock.length === 0 ? (
                <p className="text-sm text-gray-400">No products below threshold.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">In Stock</th><th className="px-4 py-3 text-right font-bold">Threshold</th></tr></thead>
                    <tbody>{lowStock.map((l, idx) => (
                      <tr key={idx} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{l.product_name}</td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{l.outlet_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-amber-600">{l.inStock}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-400">{l.threshold}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><Archive className="size-4 text-rose-500" /> Dead Stock ({deadStock.length})</h3>
              {deadStock.length === 0 ? (
                <p className="text-sm text-gray-400">No stale inventory detected.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">IMEI</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Days In Stock</th></tr></thead>
                    <tbody>{deadStock.map((d, idx) => (
                      <tr key={d.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{d.product_name}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{d.imei_serial || "—"}</td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{d.outlet_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-rose-600">{d.daysInStock}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {tab === "damaged" && (
        damagedLoading ? <TableSkeleton /> : damaged.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Ban} title="No damaged stock recorded" /></div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 font-bold">IMEI</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Purchase Price</th><th className="px-4 py-3 font-bold">Marked On</th></tr></thead>
              <tbody>{damaged.map((d, idx) => (
                <tr key={d.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{d.product_name}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{d.imei_serial || "—"}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{d.outlet_name}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-rose-600">{PKR(d.purchase_price)}</td>
                  <td className="px-4 py-3.5 text-gray-500">{new Date(d.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )
      )}

      {tab === "movement" && (
        movementLoading ? <TableSkeleton /> : !movement ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={TrendingUp} title="No movement data" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><TrendingUp className="size-4 text-emerald-500" /> Fast Moving (last 30 days)</h3>
              {movement.fastMoving.length === 0 ? <p className="text-sm text-gray-400">No sales in the last 30 days.</p> : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 text-right font-bold">Sold (30d)</th><th className="px-4 py-3 text-right font-bold">In Stock</th></tr></thead>
                    <tbody>{movement.fastMoving.map((m, idx) => (
                      <tr key={m.product_name} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{m.product_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600">{m.soldLast30Days}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-500">{m.inStock}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><TrendingDown className="size-4 text-rose-500" /> Slow Moving</h3>
              {movement.slowMoving.length === 0 ? <p className="text-sm text-gray-400">No slow-moving products with stock on hand.</p> : (
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Product</th><th className="px-4 py-3 text-right font-bold">In Stock</th></tr></thead>
                    <tbody>{movement.slowMoving.map((m, idx) => (
                      <tr key={m.product_name} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{m.product_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-rose-600">{m.inStock}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {tab === "pricing" && (
        pricingLoading ? <TableSkeleton /> : pricing.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Scale} title="No pricing data" /></div>
        ) : (
          <div className="space-y-3">
            {pricing.map((p) => (
              <div key={p.product_name} className={`rounded-2xl border p-4 shadow-sm dark:bg-boxdark ${p.hasInconsistency ? "border-amber-200 dark:border-amber-500/30" : "border-slate-100 dark:border-white/10"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-dark dark:text-white">{p.product_name}</p>
                  {p.hasInconsistency && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-500/10">Price varies by {PKR(p.spread)}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.byOutlet.map((o, idx) => (
                    <span key={idx} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">{o.outlet_name}: {PKR(o.price)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
