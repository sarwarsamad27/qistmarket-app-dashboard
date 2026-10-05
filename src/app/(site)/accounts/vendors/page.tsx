"use client";

import React, { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { HandCoins, Store, Handshake, Clock, AlertTriangle, CalendarClock, Plus, Wallet, Search, ShoppingCart, Warehouse, BarChart3, BookOpen } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";
import { ValueSkeleton } from "@/components/ui/LoadingStates";
import PayVendorModal, { PayTarget } from "./_components/PayVendorModal";
import VendorLedgerModal from "./_components/VendorLedgerModal";
import HoPurchaseForm from "./_components/HoPurchaseForm";
import WarehousePanel from "./_components/WarehousePanel";
import VendorAnalytics from "./_components/VendorAnalytics";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const BUCKET_COLORS: Record<string, string> = { "0-30": "text-emerald-600", "31-60": "text-amber-600", "61-90": "text-orange-600", "90+": "text-rose-600" };

interface VendorPayables { totalPayable: number; vendorWise: { vendor_name: string; vendor_id: number | null; total_amount: number; paid_amount: number; balance: number }[]; outletWise: { outlet_id: number | null; outlet_name: string; payable: number }[] }
interface AgingItem { purchase_id: number; invoice_number: string; vendor_name: string; outlet_name?: string; aging_from: string; dateCorrected?: boolean; daysOverdue: number; bucket: string; balance: number }
interface AgingData { buckets: Record<string, number>; total: number; vendorWise: any[]; items: AgingItem[] }
interface DueAlert { purchase_id: number; invoice_number: string; vendor_name: string; outlet_name: string; due_date: string; balance: number; isOverdue: boolean }
interface ScheduledPayment { id: number; vendor_id: number; amount: number; scheduled_date: string; status: string; notes: string | null; paid_at: string | null; paid_amount: number | null; vendor: { name: string } }
interface VendorListItem { id: number; name: string; phone: string | null; email: string | null; balance: number; cash_in_hand_balance: number; outlet: { id: number; name: string } | null }
interface Purchase {
  id: number; invoice_number: string; vendor_id: number | null; vendor_name: string; purchase_date: string; due_date: string | null; total_amount: number; paid_amount: number; balance: number; status: string;
  outlet: { id: number; name: string; type: string }; is_head_office: boolean; items_count: number; items_summary: string; days_overdue: number; notes: string | null;
}

const TABS = [
  { key: "payables" as const, label: "Payables", icon: HandCoins },
  { key: "purchases" as const, label: "Purchases & Pending Payments", icon: ShoppingCart },
  { key: "aging" as const, label: "Aging", icon: Clock },
  { key: "alerts" as const, label: "Due Alerts", icon: AlertTriangle },
  { key: "scheduled" as const, label: "Scheduled Payments", icon: CalendarClock },
  { key: "manage" as const, label: "Vendors & Ledgers", icon: Store },
  { key: "warehouse" as const, label: "HO Warehouse", icon: Warehouse },
  { key: "analytics" as const, label: "Analytics", icon: BarChart3 },
];

const STATUS_STYLE: Record<string, string> = {
  Paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  Partial: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  Unpaid: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
};
const card = "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark";
const thead = "bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400";
const sel = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white";

export default function AccountsVendorsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("payables");
  const [data, setData] = useState<VendorPayables | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"vendor" | "outlet">("vendor");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [aging, setAging] = useState<AgingData | null>(null);
  const [agingLoading, setAgingLoading] = useState(false);
  const [alerts, setAlerts] = useState<DueAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertDays, setAlertDays] = useState(7);

  const [scheduled, setScheduled] = useState<ScheduledPayment[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ vendor_id: "", amount: "", scheduled_date: "", notes: "" });

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseTotals, setPurchaseTotals] = useState({ count: 0, total: 0, paid: 0, balance: 0 });
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [pFilter, setPFilter] = useState({ scope: "", status: "open", outletId: "", vendor_id: "", search: "" });
  const [pRange, setPRange] = useState<DateRange>({ from: "", to: "" });
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);

  const [vendorForm, setVendorForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [cashForm, setCashForm] = useState({ vendor_id: "", type: "debit" as "credit" | "debit", amount: "", description: "" });
  const [vendorList, setVendorList] = useState<VendorListItem[]>([]);
  const [vendorListLoading, setVendorListLoading] = useState(false);
  const [vendorDirSearch, setVendorDirSearch] = useState("");
  const [vendorDirOutlet, setVendorDirOutlet] = useState("");

  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [ledgerVendor, setLedgerVendor] = useState<number | null>(null);

  const refreshAll = () => { setRefreshKey((k) => k + 1); };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/vendors/payables`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load vendor payables:", err))
      .finally(() => setLoading(false));
    fetchVendorList();
  }, [refreshKey]);

  useEffect(() => {
    if (tab === "aging") {
      setAgingLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/vendors/aging`, { headers: authHeaders() }).then((res) => res.json()).then((json) => { if (json.success) setAging(json.data); }).finally(() => setAgingLoading(false));
    }
    if (tab === "alerts") {
      setAlertsLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/vendors/due-alerts?withinDays=${alertDays}`, { headers: authHeaders() }).then((res) => res.json()).then((json) => { if (json.success) setAlerts(json.data); }).finally(() => setAlertsLoading(false));
    }
    if (tab === "scheduled") fetchScheduled();
  }, [tab, alertDays, refreshKey]);

  useEffect(() => {
    if (tab !== "purchases") return;
    setPurchasesLoading(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries({ ...pFilter, startDate: pRange.from, endDate: pRange.to }).filter(([, v]) => v) as [string, string][]);
      fetch(`${BACKEND_URL}/api/accounts/vendors/purchases?${qs}`, { headers: authHeaders() })
        .then((r) => r.json()).then((j) => { if (j.success) { setPurchases(j.data); setPurchaseTotals(j.totals); } })
        .finally(() => setPurchasesLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [tab, pFilter, pRange, refreshKey]);

  const fetchVendorList = () => {
    setVendorListLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/vendors`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setVendorList(json.data); })
      .catch((err) => console.error("Failed to load vendor directory:", err))
      .finally(() => setVendorListLoading(false));
  };

  const fetchScheduled = () => {
    setScheduledLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/vendors/scheduled-payments`, { headers: authHeaders() }).then((res) => res.json()).then((json) => { if (json.success) setScheduled(json.data); }).finally(() => setScheduledLoading(false));
  };

  const vendorOutstanding = (vendorId: number | null) => (data?.vendorWise || []).filter((v) => v.vendor_id === vendorId).reduce((s, v) => s + v.balance, 0);

  const outletOptions = useMemo(() => {
    const m = new Map<number, string>();
    vendorList.forEach((v) => { if (v.outlet) m.set(v.outlet.id, v.outlet.name); });
    (data?.outletWise || []).forEach((o) => { if (o.outlet_id) m.set(o.outlet_id, o.outlet_name); });
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [vendorList, data]);

  const filteredVendorList = vendorList.filter((v) => {
    if (vendorDirOutlet === "ho" && v.outlet) return false;
    if (vendorDirOutlet && vendorDirOutlet !== "ho" && String(v.outlet?.id) !== vendorDirOutlet) return false;
    return v.name.toLowerCase().includes(vendorDirSearch.toLowerCase()) || (v.phone || "").includes(vendorDirSearch);
  });

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) { toast.error("Vendor name is required."); return; }
    setCreatingVendor(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors`, { method: "POST", headers: authHeaders(), body: JSON.stringify(vendorForm) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to create vendor."));
      toast.success("Head Office vendor created.");
      setVendorForm({ name: "", phone: "", email: "", address: "" });
      fetchVendorList();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleCashTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashForm.vendor_id || !cashForm.amount) { toast.error("Vendor and amount are required."); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/cash-transactions`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ ...cashForm, amount: parseFloat(cashForm.amount) }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Transaction failed."));
      toast.success("Vendor cash transaction recorded.");
      setCashForm({ vendor_id: "", type: "debit", amount: "", description: "" });
      refreshAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSchedulePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.vendor_id || !scheduleForm.amount || !scheduleForm.scheduled_date) { toast.error("Vendor, amount, and date are required."); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/scheduled-payments`, { method: "POST", headers: authHeaders(), body: JSON.stringify(scheduleForm) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to schedule payment."));
      toast.success("Payment scheduled.");
      setScheduleForm({ vendor_id: "", amount: "", scheduled_date: "", notes: "" });
      fetchScheduled();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const cancelSchedule = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/scheduled-payments/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status: "cancelled" }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Update failed."));
      toast.success("Scheduled payment cancelled.");
      fetchScheduled();
    } catch (err) {
      toast.error(getErrorMessage(err, "Update failed."));
    }
  };

  const payPurchase = (p: { purchase_id: number; invoice_number: string; vendor_name: string; balance: number; vendor_id?: number | null }) =>
    setPayTarget({ purchase_id: p.purchase_id, invoice_number: p.invoice_number, vendor_name: p.vendor_name, vendor_id: p.vendor_id ?? null, outstanding: p.balance });

  return (
    <>
      <Breadcrumb pageName="Vendors & Payables" />
      <PageHeader
        icon={Handshake}
        title="Vendors & Payables"
        subtitle="Head Office and outlet vendors — purchases, what we owe, payments from bank or Head Office cash, and stock bought by Head Office."
        actions={<button onClick={() => setShowPurchaseForm(true)} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90"><Plus className="size-4" /> Head Office Purchase</button>}
      />

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-transparent">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-600"><HandCoins className="size-6" strokeWidth={2.25} /></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-orange-600/80">Total Vendor Payables</p><p className="text-3xl font-black leading-tight text-orange-700 dark:text-orange-400">{data ? PKR(data.totalPayable || 0) : <ValueSkeleton failed={!loading} className="h-8 w-40" />}</p></div>
      </div>

      <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Payables ── */}
      {tab === "payables" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
              {(["vendor", "outlet"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === v ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{v === "vendor" ? "Vendor Wise" : "Outlet Wise"}</button>
              ))}
            </div>
            {view === "vendor" && (
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendor name..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
            )}
            <div className="ml-auto">
              {view === "vendor" ? (
                <ExportMenu title="Vendor Payables" columns={[
                  { header: "Vendor", value: (v: VendorPayables["vendorWise"][number]) => v.vendor_name },
                  { header: "Total purchased", value: (v) => v.total_amount, numeric: true },
                  { header: "Paid", value: (v) => v.paid_amount, numeric: true },
                  { header: "Balance", value: (v) => v.balance, numeric: true },
                ]} getRows={() => data?.vendorWise || []} />
              ) : (
                <ExportMenu title="Outlet Payables" columns={[
                  { header: "Outlet", value: (o: VendorPayables["outletWise"][number]) => o.outlet_name },
                  { header: "Payable", value: (o) => o.payable, numeric: true },
                ]} getRows={() => data?.outletWise || []} />
              )}
            </div>
          </div>
          {loading ? <TableSkeleton /> : (
            <div className={card}>
              {view === "vendor" ? (
                data && data.vendorWise.filter((v) => v.vendor_name.toLowerCase().includes(search.toLowerCase())).length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className={thead}><tr><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 text-right font-bold">Total Purchased</th><th className="px-4 py-3 text-right font-bold">Paid</th><th className="px-4 py-3 text-right font-bold">Balance</th><th className="px-4 py-3"></th></tr></thead>
                    <tbody>{data.vendorWise.filter((v) => v.vendor_name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.balance - a.balance).map((v) => (
                      <tr key={`${v.vendor_id}-${v.vendor_name}`} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{v.vendor_id ? <button onClick={() => setLedgerVendor(v.vendor_id)} className="hover:text-[#ff3d3d] hover:underline">{v.vendor_name}</button> : v.vendor_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(v.total_amount)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(v.paid_amount)}</td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums text-orange-600">{PKR(v.balance)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {v.balance > 0 && v.vendor_id && <button onClick={() => setPayTarget({ vendor_id: v.vendor_id, vendor_name: v.vendor_name, outstanding: v.balance })} className="rounded-lg bg-[#ff3d3d] px-3 py-1.5 text-xs font-bold text-white hover:bg-opacity-90">Pay</button>}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <EmptyState icon={Handshake} title={search ? "No matching vendors" : "No vendor purchases recorded"} />
              ) : (
                data && data.outletWise.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className={thead}><tr><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Payable</th></tr></thead>
                    <tbody>{data.outletWise.map((o) => (
                      <tr key={o.outlet_id ?? "unassigned"} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-dark dark:text-white">{o.outlet_name}</td><td className="px-4 py-3.5 text-right font-bold tabular-nums text-orange-600">{PKR(o.payable)}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <EmptyState icon={Store} title="No outlet-wise payables" />
              )}
            </div>
          )}
        </>
      )}

      {/* ── Purchases & pending payments ── */}
      {tab === "purchases" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select value={pFilter.status} onChange={(e) => setPFilter({ ...pFilter, status: e.target.value })} className={sel}>
              <option value="open">Pending payment (Unpaid + Partial)</option><option value="Unpaid">Unpaid</option><option value="Partial">Partially paid</option><option value="Paid">Paid</option><option value="">All</option>
            </select>
            <select value={pFilter.scope} onChange={(e) => setPFilter({ ...pFilter, scope: e.target.value, outletId: "" })} className={sel}>
              <option value="">Head Office + outlets</option><option value="ho">Head Office purchases</option><option value="outlets">Outlet purchases</option>
            </select>
            {pFilter.scope !== "ho" && (
              <select value={pFilter.outletId} onChange={(e) => setPFilter({ ...pFilter, outletId: e.target.value })} className={sel}>
                <option value="">All outlets</option>
                {outletOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <select value={pFilter.vendor_id} onChange={(e) => setPFilter({ ...pFilter, vendor_id: e.target.value })} className={sel}>
              <option value="">All vendors</option>
              {vendorList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input value={pFilter.search} onChange={(e) => setPFilter({ ...pFilter, search: e.target.value })} placeholder="Invoice no, vendor..." className={`${sel} w-full pl-9`} />
            </div>
            <div className="ml-auto">
              <ExportMenu title="Vendor Purchases" columns={[
                { header: "Invoice", value: (p: Purchase) => p.invoice_number },
                { header: "Date", value: (p) => day(p.purchase_date) },
                { header: "Due", value: (p) => day(p.due_date) },
                { header: "Vendor", value: (p) => p.vendor_name },
                { header: "Bought by", value: (p) => (p.is_head_office ? "Head Office" : p.outlet?.name) },
                { header: "Items", value: (p) => p.items_summary },
                { header: "Qty", value: (p) => p.items_count, numeric: true },
                { header: "Total", value: (p) => p.total_amount, numeric: true },
                { header: "Paid", value: (p) => p.paid_amount, numeric: true },
                { header: "Balance", value: (p) => p.balance, numeric: true },
                { header: "Status", value: (p) => p.status },
                { header: "Days overdue", value: (p) => p.days_overdue || "", numeric: true },
              ]} getRows={() => purchases} />
            </div>
          </div>
          <DateRangeFilter value={pRange} onChange={setPRange} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Invoices", String(purchaseTotals.count)], ["Total", PKR(purchaseTotals.total)], ["Paid", PKR(purchaseTotals.paid)], ["Still to pay", PKR(purchaseTotals.balance)]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p><p className="text-lg font-black text-dark dark:text-white">{v}</p></div>
            ))}
          </div>
          {purchasesLoading ? <TableSkeleton /> : purchases.length ? (
            <div className={card}>
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={`${thead} sticky top-0`}><tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Bought by</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Date / Due</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-dark dark:text-white">{p.invoice_number}</td>
                        <td className="px-4 py-3">{p.vendor_id ? <button onClick={() => setLedgerVendor(p.vendor_id)} className="font-medium text-dark hover:text-[#ff3d3d] hover:underline dark:text-white">{p.vendor_name}</button> : p.vendor_name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.is_head_office ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10">Head Office</span> : p.outlet?.name}</td>
                        <td className="max-w-[220px] px-4 py-3 text-xs text-gray-500"><p className="truncate">{p.items_summary}</p><p>{p.items_count} unit(s)</p></td>
                        <td className="px-4 py-3 text-xs text-gray-500">{day(p.purchase_date)}<p className={p.days_overdue ? "font-semibold text-rose-600" : ""}>due {day(p.due_date)}{p.days_overdue ? ` · ${p.days_overdue}d overdue` : ""}</p></td>
                        <td className="px-4 py-3 text-right tabular-nums">{PKR(p.total_amount)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-orange-600">{PKR(p.balance)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[p.status] || "bg-gray-100 text-gray-600"}`}>{p.status}</span></td>
                        <td className="px-4 py-3 text-right">{p.balance > 0 && <button onClick={() => payPurchase({ purchase_id: p.id, invoice_number: p.invoice_number, vendor_name: p.vendor_name, balance: p.balance, vendor_id: p.vendor_id })} className="rounded-lg bg-[#ff3d3d] px-3 py-1.5 text-xs font-bold text-white hover:bg-opacity-90">Pay</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={card}><EmptyState icon={ShoppingCart} title="No purchases match" /></div>}
        </div>
      )}

      {/* ── Aging ── */}
      {tab === "aging" && (
        agingLoading ? <TableSkeleton /> : aging && aging.items.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Object.entries(aging.buckets).map(([bucket, amount]) => (
                <div key={bucket} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{bucket} Days</p>
                  <p className={`text-xl font-black ${BUCKET_COLORS[bucket]}`}>{PKR(amount)}</p>
                </div>
              ))}
            </div>
            <div className={card}>
              <div className="flex justify-end border-b border-slate-100 p-3 dark:border-white/10">
                <ExportMenu title="Vendor Aging" columns={[
                  { header: "Invoice", value: (it: AgingItem) => it.invoice_number },
                  { header: "Vendor", value: (it) => it.vendor_name },
                  { header: "Outlet", value: (it) => it.outlet_name || "" },
                  { header: "Due / purchase date", value: (it) => day(it.aging_from) },
                  { header: "Days overdue", value: (it) => it.daysOverdue, numeric: true },
                  { header: "Bucket", value: (it) => it.bucket },
                  { header: "Balance", value: (it) => it.balance, numeric: true },
                  { header: "Note", value: (it) => (it.dateCorrected ? "Invoice has an invalid date" : "") },
                ]} getRows={() => aging.items} />
              </div>
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={`${thead} sticky top-0`}><tr><th className="px-4 py-3 font-bold">Invoice</th><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Due / Purchase Date</th><th className="px-4 py-3 text-right font-bold">Days Overdue</th><th className="px-4 py-3 text-right font-bold">Balance</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>{aging.items.map((it) => (
                    <tr key={it.purchase_id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{it.invoice_number}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{it.vendor_name}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{it.outlet_name || "—"}</td>
                      <td className="px-4 py-3.5 text-gray-500">
                        {day(it.aging_from)}
                        {it.dateCorrected && (
                          <span title="The date saved on this invoice has an impossible year, so aging is counted from the day it was entered. Edit the purchase to fix the date." className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10">Wrong date on invoice</span>
                        )}
                      </td>
                      <td className={`px-4 py-3.5 text-right font-semibold tabular-nums ${BUCKET_COLORS[it.bucket]}`}>{it.daysOverdue}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(it.balance)}</td>
                      <td className="px-4 py-3.5 text-right"><button onClick={() => payPurchase({ purchase_id: it.purchase_id, invoice_number: it.invoice_number, vendor_name: it.vendor_name, balance: it.balance })} className="text-xs font-bold text-[#ff3d3d] hover:underline">Pay</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        ) : <div className={card}><EmptyState icon={Clock} title="No outstanding vendor balances" /></div>
      )}

      {/* ── Due alerts ── */}
      {tab === "alerts" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Show invoices due within</span>
            <select value={alertDays} onChange={(e) => setAlertDays(parseInt(e.target.value))} className={sel}>
              {[3, 7, 15, 30, 60].map((d) => <option key={d} value={d}>{d} days (and overdue)</option>)}
            </select>
            <div className="ml-auto">
              <ExportMenu title="Vendor Due Alerts" columns={[
                { header: "Invoice", value: (a: DueAlert) => a.invoice_number },
                { header: "Vendor", value: (a) => a.vendor_name },
                { header: "Outlet", value: (a) => a.outlet_name },
                { header: "Due date", value: (a) => day(a.due_date) },
                { header: "Status", value: (a) => (a.isOverdue ? "Overdue" : "Due soon") },
                { header: "Balance", value: (a) => a.balance, numeric: true },
              ]} getRows={() => alerts} />
            </div>
          </div>
          {alertsLoading ? <TableSkeleton /> : alerts.length > 0 ? (
            <div className={card}>
              <table className="w-full text-left text-sm">
                <thead className={thead}><tr><th className="px-4 py-3 font-bold">Invoice</th><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Due Date</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Balance</th><th className="px-4 py-3"></th></tr></thead>
                <tbody>{alerts.map((a) => {
                  const days = Math.round((new Date(a.due_date).getTime() - Date.now()) / 86400000);
                  return (
                    <tr key={a.purchase_id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{a.invoice_number}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{a.vendor_name}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{a.outlet_name}</td>
                      <td className="px-4 py-3.5 text-gray-500">{day(a.due_date)}</td>
                      <td className="px-4 py-3.5">{a.isOverdue ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 dark:bg-rose-500/10">Overdue {-days}d</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 dark:bg-amber-500/10">Due in {days}d</span>}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(a.balance)}</td>
                      <td className="px-4 py-3.5 text-right"><button onClick={() => payPurchase({ purchase_id: a.purchase_id, invoice_number: a.invoice_number, vendor_name: a.vendor_name, balance: a.balance })} className="rounded-lg bg-[#ff3d3d] px-3 py-1.5 text-xs font-bold text-white">Pay</button></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <div className={card}><EmptyState icon={AlertTriangle} title="No payments due in this window" /></div>}
        </div>
      )}

      {/* ── Scheduled ── */}
      {tab === "scheduled" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h2 className="mb-1 text-sm font-bold text-dark dark:text-white">Schedule a Payment</h2>
            <p className="mb-4 text-xs text-gray-500">Plan when a vendor will be paid. On the day, use “Pay now” — it makes the real payment from the bank or Head Office cash and marks the schedule paid.</p>
            <form onSubmit={handleSchedulePayment} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Vendor</label>
                <select value={scheduleForm.vendor_id} onChange={(e) => setScheduleForm({ ...scheduleForm, vendor_id: e.target.value })} className={`${sel} w-56`}>
                  <option value="">Select vendor...</option>
                  {vendorList.map((v) => <option key={v.id} value={v.id}>{v.name}{v.outlet ? ` (${v.outlet.name})` : ""}</option>)}
                </select>
              </div>
              <Field label="Amount" value={scheduleForm.amount} onChange={(v) => setScheduleForm({ ...scheduleForm, amount: v })} type="number" />
              <Field label="Date" value={scheduleForm.scheduled_date} onChange={(v) => setScheduleForm({ ...scheduleForm, scheduled_date: v })} type="date" />
              <Field label="Notes" value={scheduleForm.notes} onChange={(v) => setScheduleForm({ ...scheduleForm, notes: v })} />
              <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90"><Plus className="size-4" /> Schedule</button>
            </form>
          </div>
          {scheduledLoading ? <TableSkeleton /> : scheduled.length > 0 ? (
            <div className={card}>
              <div className="flex justify-end border-b border-slate-100 p-3 dark:border-white/10">
                <ExportMenu title="Scheduled Vendor Payments" columns={[
                  { header: "Vendor", value: (s: ScheduledPayment) => s.vendor.name },
                  { header: "Scheduled", value: (s) => day(s.scheduled_date) },
                  { header: "Amount", value: (s) => s.amount, numeric: true },
                  { header: "Status", value: (s) => s.status },
                  { header: "Paid on", value: (s) => day(s.paid_at) },
                  { header: "Paid amount", value: (s) => s.paid_amount ?? "", numeric: true },
                  { header: "Notes", value: (s) => s.notes || "" },
                ]} getRows={() => scheduled} />
              </div>
              <table className="w-full text-left text-sm">
                <thead className={thead}><tr><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 text-right font-bold">Amount</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3"></th></tr></thead>
                <tbody>{scheduled.map((s) => {
                  const overdue = s.status === "scheduled" && new Date(s.scheduled_date) < new Date(new Date().toDateString());
                  return (
                    <tr key={s.id} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{s.vendor.name}{s.notes && <p className="text-xs font-normal text-gray-400">{s.notes}</p>}</td>
                      <td className={`px-4 py-3.5 ${overdue ? "font-semibold text-rose-600" : "text-gray-500"}`}>{day(s.scheduled_date)}{overdue && " (past)"}</td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(s.amount)}</td>
                      <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{s.status}{s.paid_at && <p className="text-xs normal-case text-gray-400">{PKR(s.paid_amount || 0)} on {day(s.paid_at)}</p>}</td>
                      <td className="px-4 py-3.5 text-right">
                        {s.status === "scheduled" && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { const out = vendorOutstanding(s.vendor_id); if (out <= 0) { toast.error("This vendor has nothing outstanding."); return; } setPayTarget({ vendor_id: s.vendor_id, vendor_name: s.vendor.name, outstanding: out, suggested_amount: s.amount, scheduled_payment_id: s.id }); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Pay now</button>
                            <button onClick={() => cancelSchedule(s.id)} className="text-xs font-bold text-rose-500 hover:underline">Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          ) : <div className={card}><EmptyState icon={CalendarClock} title="No scheduled payments" /></div>}
        </div>
      )}

      {/* ── Vendors & ledgers ── */}
      {tab === "manage" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10"><Handshake className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Vendor Directory</h2></div>
              <select value={vendorDirOutlet} onChange={(e) => setVendorDirOutlet(e.target.value)} className={`${sel} ml-auto`}>
                <option value="">Head Office + all outlets</option>
                <option value="ho">Head Office vendors</option>
                {outletOptions.map((o) => <option key={o.id} value={o.id}>{o.name} vendors</option>)}
              </select>
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={vendorDirSearch} onChange={(e) => setVendorDirSearch(e.target.value)} placeholder="Search name or phone..." className={`${sel} w-full pl-9`} />
              </div>
              <ExportMenu title="Vendor Directory" columns={[
                { header: "Vendor", value: (v: VendorListItem) => v.name },
                { header: "Outlet", value: (v) => v.outlet?.name || "Head Office" },
                { header: "Phone", value: (v) => v.phone || "" },
                { header: "Email", value: (v) => v.email || "" },
                { header: "Owed (purchases)", value: (v) => v.balance, numeric: true },
                { header: "Vendor cash balance", value: (v) => v.cash_in_hand_balance, numeric: true },
              ]} getRows={() => filteredVendorList} />
            </div>
            {vendorListLoading ? <TableSkeleton /> : filteredVendorList.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className={thead}><tr><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Phone</th><th className="px-4 py-3 text-right font-bold">We Owe</th><th className="px-4 py-3 text-right font-bold">Vendor Cash</th><th className="px-4 py-3"></th></tr></thead>
                  <tbody>
                    {filteredVendorList.map((v) => (
                      <tr key={v.id} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{v.name} <span className="text-xs font-normal text-gray-400">#{v.id}</span></td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{v.outlet?.name || <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10">Head Office</span>}</td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{v.phone || "—"}</td>
                        <td className="px-4 py-3.5 text-right font-bold tabular-nums text-orange-600">{PKR(v.balance)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-dark dark:text-white">{PKR(v.cash_in_hand_balance)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-3">
                            <button onClick={() => setLedgerVendor(v.id)} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"><BookOpen className="size-3.5" /> Ledger</button>
                            {v.balance > 0 && <button onClick={() => setPayTarget({ vendor_id: v.id, vendor_name: v.name, outstanding: vendorOutstanding(v.id) || v.balance })} className="text-xs font-bold text-[#ff3d3d] hover:underline">Pay</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={Store} title={vendorDirSearch ? "No matching vendors" : "No vendors yet — add one below"} />}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="mb-4 flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10"><Store className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Add Head Office Vendor</h2></div>
              <form onSubmit={handleCreateVendor} className="space-y-3">
                <Field label="Name *" value={vendorForm.name} onChange={(v) => setVendorForm({ ...vendorForm, name: v })} />
                <Field label="Phone" value={vendorForm.phone} onChange={(v) => setVendorForm({ ...vendorForm, phone: v })} />
                <Field label="Email" value={vendorForm.email} onChange={(v) => setVendorForm({ ...vendorForm, email: v })} />
                <Field label="Address" value={vendorForm.address} onChange={(v) => setVendorForm({ ...vendorForm, address: v })} />
                <button type="submit" disabled={creatingVendor} className="w-full rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{creatingVendor ? "Saving..." : "Add Vendor"}</button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="mb-1 flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Wallet className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Vendor Cash Advance / Refund</h2></div>
              <p className="mb-4 text-xs text-gray-500">Cash given to a vendor as an advance (paid) or cash a vendor returned (received), not tied to one invoice. To settle invoices use <b>Pay</b>.</p>
              <form onSubmit={handleCashTransaction} className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-gray-500">Vendor *</label>
                  <select value={cashForm.vendor_id} onChange={(e) => setCashForm({ ...cashForm, vendor_id: e.target.value })} className={`${sel} w-full`}>
                    <option value="">Select vendor...</option>
                    {vendorList.map((v) => <option key={v.id} value={v.id}>{v.name}{v.outlet ? ` (${v.outlet.name})` : ""}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCashForm({ ...cashForm, type: "debit" })} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${cashForm.type === "debit" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>Cash paid to vendor</button>
                  <button type="button" onClick={() => setCashForm({ ...cashForm, type: "credit" })} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${cashForm.type === "credit" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>Cash received from vendor</button>
                </div>
                <Field label="Amount *" value={cashForm.amount} onChange={(v) => setCashForm({ ...cashForm, amount: v })} type="number" />
                <Field label="Description" value={cashForm.description} onChange={(v) => setCashForm({ ...cashForm, description: v })} />
                <button type="submit" className="w-full rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white hover:bg-opacity-90">Record</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {tab === "warehouse" && <WarehousePanel refreshKey={refreshKey} />}
      {tab === "analytics" && <VendorAnalytics onOpenLedger={setLedgerVendor} />}

      {showPurchaseForm && <HoPurchaseForm vendors={vendorList} onClose={() => setShowPurchaseForm(false)} onSaved={refreshAll} />}
      {ledgerVendor && <VendorLedgerModal vendorId={ledgerVendor} onClose={() => setLedgerVendor(null)} onPay={(outstanding, name) => setPayTarget({ vendor_id: ledgerVendor, vendor_name: name, outstanding })} />}
      {payTarget && <PayVendorModal target={payTarget} onClose={() => setPayTarget(null)} onPaid={refreshAll} />}
    </>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-500">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
    </div>
  );
}
