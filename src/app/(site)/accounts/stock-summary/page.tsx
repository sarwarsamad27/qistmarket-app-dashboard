"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Package, Boxes, Coins, Warehouse, ArrowLeftRight, Undo2, Search, Smartphone, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

interface Item { id: number; outlet_id: number; outlet_name: string; is_warehouse: boolean; product_name: string; category: string | null; color_variant: string | null; imei_serial: string | null; quantity: number; purchase_price: number; sale_price: number | null; value: number; status: string; is_used: boolean; created_at: string; age_days: number }
interface OutletSum { outlet_id: number; outlet_name: string; is_warehouse: boolean; units: number; value: number; products: number; aged_60: number }
interface StockData { outlets: { id: number; name: string; type: string }[]; categories: string[]; summary: OutletSum[]; totals: { units: number; value: number; rows: number }; items: Item[] }
interface Transfer { id: number; status: string; quantity_transferred: number; created_at: string; product_name: string; imei_serial: string; from: string; to: string; category: string | null }
interface ReturnItem { id: number; order_ref: string; customer_name: string; outlet_name: string; type: string; status: string; imei_returned: string | null; is_cash_refund: boolean; refund_amount: number; created_at: string }
interface VendorReturn { id: string; return_number: string; return_date: string; vendor_name: string; outlet_name: string; invoice_number: string | null; product_name: string; imei_serial: string | null; quantity: number; unit_price: number; total_price: number; reason: string | null }
interface TimelineEvent { date: string; type: string; imei: string; title: string; detail: string }

const TABS = [
  { key: "stock" as const, label: "Outlet & Warehouse Stock", icon: Package },
  { key: "transfers" as const, label: "Stock Transfers", icon: ArrowLeftRight },
  { key: "returns" as const, label: "Return Items", icon: Undo2 },
  { key: "imei" as const, label: "IMEI / Barcode Tracking", icon: Smartphone },
];
const EVENT_STYLE: Record<string, string> = {
  Purchased: "bg-blue-50 text-blue-700 dark:bg-blue-500/10",
  "Added to stock": "bg-slate-100 text-slate-600 dark:bg-white/10",
  Transfer: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10",
  "Sold (cash)": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  "Delivered (installments)": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  "Installment order": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  "Returned by customer": "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  "Returned to vendor": "bg-orange-50 text-orange-700 dark:bg-orange-500/10",
  PayTrigger: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
};
const card = "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark";
const thead = "sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400";
const sel = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white";

function useDebounced<T>(v: T, ms = 400) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function AccountsStockSummaryPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("stock");

  // Stock
  const [stock, setStock] = useState<StockData | null>(null);
  const [stockFilter, setStockFilter] = useState({ outletId: "all", status: "In Stock", category: "", search: "" });
  const dStockSearch = useDebounced(stockFilter.search);

  // Transfers
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [tFilter, setTFilter] = useState({ status: "", outletId: "", search: "" });
  const [tRange, setTRange] = useState<DateRange>({ from: "", to: "" });
  const [tPage, setTPage] = useState(1);
  const [tPages, setTPages] = useState(1);
  const dTSearch = useDebounced(tFilter.search);

  // Returns
  const [returnKind, setReturnKind] = useState<"customer" | "vendor">("customer");
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [vendorReturns, setVendorReturns] = useState<VendorReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);

  // IMEI
  const [imei, setImei] = useState("");
  const [timeline, setTimeline] = useState<{ query: string; current: { id: number; imei_serial: string; product_name: string; status: string; outlet_name: string; purchase_price: number }[]; events: TimelineEvent[] } | null>(null);
  const [imeiSearching, setImeiSearching] = useState(false);
  const [imeiError, setImeiError] = useState("");

  // Deep links like /accounts/stock-summary?tab=returns (from Reports).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as (typeof TABS)[number]["key"]);
  }, []);

  useEffect(() => {
    setStock(null);
    const qs = new URLSearchParams({ outletId: stockFilter.outletId, status: stockFilter.status, ...(stockFilter.category && { category: stockFilter.category }), ...(dStockSearch.trim() && { search: dStockSearch.trim() }) });
    fetch(`${BACKEND_URL}/api/accounts/stock/items?${qs}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setStock(j.data); });
  }, [stockFilter.outletId, stockFilter.status, stockFilter.category, dStockSearch]);

  useEffect(() => {
    if (tab !== "transfers") return;
    setTransfersLoading(true);
    const qs = new URLSearchParams({ page: String(tPage), limit: "50", ...(tFilter.status && { status: tFilter.status }), ...(tFilter.outletId && { outletId: tFilter.outletId }), ...(dTSearch.trim() && { search: dTSearch.trim() }), ...(tRange.from && { startDate: tRange.from }), ...(tRange.to && { endDate: tRange.to }) });
    fetch(`${BACKEND_URL}/api/accounts/stock/transfers?${qs}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) { setTransfers(j.data); setTPages(j.pagination?.totalPages || 1); } }).finally(() => setTransfersLoading(false));
  }, [tab, tPage, tFilter.status, tFilter.outletId, dTSearch, tRange]);
  useEffect(() => { setTPage(1); }, [tFilter.status, tFilter.outletId, dTSearch, tRange]);

  useEffect(() => {
    if (tab !== "returns") return;
    setReturnsLoading(true);
    Promise.all([
      fetch(`${BACKEND_URL}/api/accounts/stock/returns`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setReturns(j.data.items); }),
      fetch(`${BACKEND_URL}/api/accounts/stock/vendor-returns`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setVendorReturns(j.data); }),
    ]).finally(() => setReturnsLoading(false));
  }, [tab]);

  const fetchAllTransfers = async () => {
    const qs = new URLSearchParams({ page: "1", limit: "5000", ...(tFilter.status && { status: tFilter.status }), ...(tFilter.outletId && { outletId: tFilter.outletId }), ...(dTSearch.trim() && { search: dTSearch.trim() }), ...(tRange.from && { startDate: tRange.from }), ...(tRange.to && { endDate: tRange.to }) });
    const j = await (await fetch(`${BACKEND_URL}/api/accounts/stock/transfers?${qs}`, { headers: authHeaders() })).json();
    return (j.data || []) as Transfer[];
  };

  const searchImei = async (e?: React.FormEvent, value?: string) => {
    e?.preventDefault();
    const q = (value ?? imei).trim();
    if (q.length < 4) { setImeiError("Enter at least 4 digits."); return; }
    setImeiSearching(true); setImeiError("");
    try {
      const j = await (await fetch(`${BACKEND_URL}/api/accounts/stock/imei-timeline/${encodeURIComponent(q)}`, { headers: authHeaders() })).json();
      if (j.success) setTimeline(j.data); else setImeiError(j.message || "Search failed.");
    } finally {
      setImeiSearching(false);
    }
  };
  const trackImei = (value: string) => { setTab("imei"); setImei(value); searchImei(undefined, value); };

  return (
    <>
      <Breadcrumb pageName="Stock Summary" />
      <PageHeader icon={Package} title="Stock Inventory" subtitle="Every unit at every outlet and the Head Office warehouse, transfers, returns and full IMEI history." />

      <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Stock ── */}
      {tab === "stock" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard icon={Boxes} label="Units" value={stock?.totals.units ?? "…"} accent="text-slate-600" bg="bg-slate-100 dark:bg-white/10" bar="bg-slate-400" />
            <StatCard icon={Coins} label="Stock value (cost)" value={stock ? PKR(stock.totals.value) : "…"} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
            <StatCard icon={Warehouse} label="Locations" value={stock?.summary.length ?? "…"} accent="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-500/10" bar="bg-indigo-500" />
            <StatCard icon={Clock} label="Older than 60 days" value={stock ? stock.summary.reduce((s, o) => s + o.aged_60, 0) : "…"} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" />
          </div>

          {stock && stock.summary.length > 0 && (
            <div className={card}>
              <table className="w-full text-left text-sm">
                <thead className={thead}><tr><th className="px-4 py-2.5">Location</th><th className="px-4 py-2.5 text-right">Products</th><th className="px-4 py-2.5 text-right">Units</th><th className="px-4 py-2.5 text-right">&gt; 60 days</th><th className="px-4 py-2.5 text-right">Value</th></tr></thead>
                <tbody>
                  {stock.summary.map((o) => (
                    <tr key={o.outlet_id} onClick={() => setStockFilter({ ...stockFilter, outletId: String(o.outlet_id) })} className={`cursor-pointer border-t border-slate-50 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5 ${stockFilter.outletId === String(o.outlet_id) ? "bg-rose-50/60 dark:bg-rose-500/5" : ""}`}>
                      <td className="px-4 py-2.5 font-medium text-dark dark:text-white">{o.outlet_name}{o.is_warehouse && <span className="ml-1.5 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">warehouse</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{o.products}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{o.units}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${o.aged_60 ? "font-semibold text-rose-600" : ""}`}>{o.aged_60}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{PKR(o.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <select value={stockFilter.outletId} onChange={(e) => setStockFilter({ ...stockFilter, outletId: e.target.value })} className={sel}>
              <option value="all">All outlets + warehouse</option>
              {stock?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}{o.type === "warehouse" ? " (warehouse)" : ""}</option>)}
            </select>
            <select value={stockFilter.status} onChange={(e) => setStockFilter({ ...stockFilter, status: e.target.value })} className={sel}>
              <option value="In Stock">In stock</option><option value="Pending Transfer">Pending transfer</option><option value="Sold">Sold</option><option value="Damaged">Damaged</option><option value="all">Any status</option>
            </select>
            <select value={stockFilter.category} onChange={(e) => setStockFilter({ ...stockFilter, category: e.target.value })} className={sel}>
              <option value="">All categories</option>
              {stock?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input value={stockFilter.search} onChange={(e) => setStockFilter({ ...stockFilter, search: e.target.value })} placeholder="Product, IMEI, variant..." className={`${sel} w-full pl-9`} />
            </div>
            <div className="ml-auto">
              <ExportMenu title="Stock Inventory" columns={[
                { header: "Location", value: (i: Item) => i.outlet_name },
                { header: "Product", value: (i) => i.product_name },
                { header: "Category", value: (i) => i.category || "" },
                { header: "Variant", value: (i) => i.color_variant || "" },
                { header: "IMEI / Serial", value: (i) => i.imei_serial || "" },
                { header: "Qty", value: (i) => i.quantity, numeric: true },
                { header: "Unit cost", value: (i) => i.purchase_price, numeric: true },
                { header: "Sale price", value: (i) => i.sale_price ?? "", numeric: true },
                { header: "Value", value: (i) => i.value, numeric: true },
                { header: "Status", value: (i) => i.status },
                { header: "In stock since", value: (i) => day(i.created_at) },
                { header: "Age (days)", value: (i) => i.age_days, numeric: true },
              ]} getRows={() => stock?.items || []} />
            </div>
          </div>
          {!stock ? <TableSkeleton /> : stock.items.length ? (
            <div className={card}>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">IMEI / Serial</th><th className="px-4 py-3">Location</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Sale Price</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Age</th></tr></thead>
                  <tbody>
                    {stock.items.map((i) => (
                      <tr key={i.id} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-2.5"><p className="font-medium text-dark dark:text-white">{i.product_name}</p><p className="text-xs text-gray-400">{[i.category, i.color_variant, i.is_used ? "used" : null].filter(Boolean).join(" · ")}</p></td>
                        <td className="px-4 py-2.5 font-mono text-xs">{i.imei_serial ? <button onClick={() => trackImei(i.imei_serial!)} className="text-blue-600 hover:underline">{i.imei_serial}</button> : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{i.outlet_name}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{i.quantity}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{PKR(i.purchase_price)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{i.sale_price ? PKR(i.sale_price) : "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{i.status}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${i.age_days > 60 ? "font-semibold text-rose-600" : "text-gray-500"}`}>{i.age_days}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={card}><EmptyState icon={Package} title="No stock matches these filters" /></div>}
        </div>
      )}

      {/* ── Transfers ── */}
      {tab === "transfers" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select value={tFilter.status} onChange={(e) => setTFilter({ ...tFilter, status: e.target.value })} className={sel}>
              <option value="">Any status</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={tFilter.outletId} onChange={(e) => setTFilter({ ...tFilter, outletId: e.target.value })} className={sel}>
              <option value="">All outlets</option>
              {stock?.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input value={tFilter.search} onChange={(e) => setTFilter({ ...tFilter, search: e.target.value })} placeholder="Product or IMEI..." className={`${sel} w-full pl-9`} />
            </div>
            <div className="ml-auto">
              <ExportMenu title="Stock Transfers" columns={[
                { header: "Date", value: (t: Transfer) => new Date(t.created_at).toLocaleString() },
                { header: "Product", value: (t) => t.product_name },
                { header: "IMEI", value: (t) => t.imei_serial || "" },
                { header: "From", value: (t) => t.from },
                { header: "To", value: (t) => t.to },
                { header: "Qty", value: (t) => t.quantity_transferred, numeric: true },
                { header: "Status", value: (t) => t.status },
              ]} getRows={fetchAllTransfers} />
            </div>
          </div>
          <DateRangeFilter value={tRange} onChange={setTRange} />
          {transfersLoading ? <TableSkeleton /> : transfers.length > 0 ? (
            <div className={card}>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">IMEI</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3">Status</th></tr></thead>
                  <tbody>{transfers.map((t) => (
                    <tr key={t.id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-dark dark:text-white">{t.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{t.imei_serial ? <button onClick={() => trackImei(t.imei_serial)} className="text-blue-600 hover:underline">{t.imei_serial}</button> : "—"}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.from}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.to}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.quantity_transferred}</td>
                      <td className="px-4 py-3 capitalize text-gray-500">{t.status}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              {tPages > 1 && (
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3 text-xs text-gray-500 dark:border-white/5">
                  Page {tPage} of {tPages}
                  <button disabled={tPage <= 1} onClick={() => setTPage(tPage - 1)} className="rounded-lg bg-slate-100 p-1.5 disabled:opacity-40 dark:bg-white/10"><ChevronLeft className="size-4" /></button>
                  <button disabled={tPage >= tPages} onClick={() => setTPage(tPage + 1)} className="rounded-lg bg-slate-100 p-1.5 disabled:opacity-40 dark:bg-white/10"><ChevronRight className="size-4" /></button>
                </div>
              )}
            </div>
          ) : <div className={card}><EmptyState icon={ArrowLeftRight} title="No stock transfers match" /></div>}
        </div>
      )}

      {/* ── Returns ── */}
      {tab === "returns" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
              <button onClick={() => setReturnKind("customer")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${returnKind === "customer" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>Returned by customers ({returns.length})</button>
              <button onClick={() => setReturnKind("vendor")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${returnKind === "vendor" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>Returned to vendors ({vendorReturns.length})</button>
            </div>
            <div className="ml-auto">
              {returnKind === "customer" ? (
                <ExportMenu title="Customer Returns" columns={[
                  { header: "Date", value: (r: ReturnItem) => day(r.created_at) },
                  { header: "Order", value: (r) => r.order_ref },
                  { header: "Customer", value: (r) => r.customer_name },
                  { header: "Outlet", value: (r) => r.outlet_name },
                  { header: "Type", value: (r) => r.type },
                  { header: "IMEI returned", value: (r) => r.imei_returned || "" },
                  { header: "Status", value: (r) => r.status },
                  { header: "Cash refund", value: (r) => (r.is_cash_refund ? r.refund_amount : ""), numeric: true },
                ]} getRows={() => returns} />
              ) : (
                <ExportMenu title="Vendor Returns" columns={[
                  { header: "Date", value: (r: VendorReturn) => day(r.return_date) },
                  { header: "Return no", value: (r) => r.return_number },
                  { header: "Vendor", value: (r) => r.vendor_name },
                  { header: "Outlet", value: (r) => r.outlet_name },
                  { header: "Invoice", value: (r) => r.invoice_number || "" },
                  { header: "Product", value: (r) => r.product_name },
                  { header: "IMEI", value: (r) => r.imei_serial || "" },
                  { header: "Qty", value: (r) => r.quantity, numeric: true },
                  { header: "Amount", value: (r) => r.total_price, numeric: true },
                  { header: "Reason", value: (r) => r.reason || "" },
                ]} getRows={() => vendorReturns} />
              )}
            </div>
          </div>
          {returnsLoading ? <TableSkeleton /> : returnKind === "customer" ? (
            returns.length > 0 ? (
              <div className={card}>
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={thead}><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Order / Customer</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">IMEI</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Refund</th></tr></thead>
                    <tbody>{returns.map((r) => (
                      <tr key={r.id} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3 text-xs text-gray-500">{day(r.created_at)}</td>
                        <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{r.customer_name}</p><p className="font-mono text-[11px] text-gray-400">{r.order_ref}</p></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.outlet_name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.type}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.imei_returned ? <button onClick={() => trackImei(r.imei_returned!)} className="text-blue-600 hover:underline">{r.imei_returned}</button> : "—"}</td>
                        <td className="px-4 py-3 capitalize text-gray-500">{r.status}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-rose-600">{r.is_cash_refund ? PKR(r.refund_amount) : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            ) : <div className={card}><EmptyState icon={Undo2} title="No customer returns recorded" /></div>
          ) : vendorReturns.length > 0 ? (
            <div className={card}>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Return / Vendor</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">IMEI</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Reason</th></tr></thead>
                  <tbody>{vendorReturns.map((r) => (
                    <tr key={r.id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3 text-xs text-gray-500">{day(r.return_date)}</td>
                      <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{r.vendor_name}</p><p className="font-mono text-[11px] text-gray-400">{r.return_number}{r.invoice_number ? ` · ${r.invoice_number}` : ""}</p></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.outlet_name}</td>
                      <td className="px-4 py-3">{r.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.imei_serial ? <button onClick={() => trackImei(r.imei_serial!)} className="text-blue-600 hover:underline">{r.imei_serial}</button> : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{PKR(r.total_price)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{r.reason || "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : <div className={card}><EmptyState icon={Undo2} title="No items returned to vendors" /></div>}
        </div>
      )}

      {/* ── IMEI tracking ── */}
      {tab === "imei" && (
        <div className="space-y-5">
          <form onSubmit={searchImei} className="flex max-w-xl gap-2">
            <input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="Scan barcode or type IMEI / serial (or part of it)" autoFocus className="flex-1 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            <button type="submit" disabled={imeiSearching} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50"><Search className="size-4" /> {imeiSearching ? "Searching…" : "Track"}</button>
          </form>
          <p className="text-xs text-gray-500">A barcode scanner works like a keyboard — scan into the box and press Enter.</p>
          {imeiError && <p className="text-sm text-rose-600">{imeiError}</p>}
          {timeline && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <h3 className="mb-2 text-sm font-bold text-dark dark:text-white">Where it is now</h3>
                {timeline.current.length ? timeline.current.map((c) => (
                  <div key={c.id} className="mb-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
                    <p className="font-semibold text-dark dark:text-white">{c.product_name}</p>
                    <p className="font-mono text-xs text-gray-500">{c.imei_serial}</p>
                    <p className="text-xs text-gray-500">{c.status} · {c.outlet_name} · cost {PKR(c.purchase_price)}</p>
                  </div>
                )) : <p className="text-sm text-gray-500">Not in any outlet's inventory now.</p>}
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-dark dark:text-white">History — “{timeline.query}”</h3>
                  <ExportMenu title={`IMEI history ${timeline.query}`} columns={[
                    { header: "Date", value: (e: TimelineEvent) => (e.date ? new Date(e.date).toLocaleString() : "") },
                    { header: "Event", value: (e) => e.type },
                    { header: "IMEI", value: (e) => e.imei },
                    { header: "What", value: (e) => e.title },
                    { header: "Details", value: (e) => e.detail },
                  ]} getRows={() => timeline.events} />
                </div>
                {timeline.events.length ? (
                  <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-white/10">
                    {timeline.events.map((e, i) => (
                      <li key={i}>
                        <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-[#ff3d3d] dark:border-boxdark" />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${EVENT_STYLE[e.type] || "bg-gray-100 text-gray-600"}`}>{e.type}</span>
                          <span className="text-xs text-gray-400">{e.date ? new Date(e.date).toLocaleString() : "—"}</span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-dark dark:text-white">{e.title}</p>
                        <p className="text-xs text-gray-500">{e.detail}{e.imei && e.imei !== timeline.query ? ` · ${e.imei}` : ""}</p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-gray-500">Nothing found for this IMEI / serial.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
