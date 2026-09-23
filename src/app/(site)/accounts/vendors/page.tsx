"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { HandCoins, Store, Handshake, Clock, AlertTriangle, CalendarClock, Plus, Wallet, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

const BUCKET_COLORS: Record<string, string> = { "0-30": "text-emerald-600", "31-60": "text-amber-600", "61-90": "text-orange-600", "90+": "text-rose-600" };

interface VendorPayables { totalPayable: number; vendorWise: { vendor_name: string; vendor_id: number | null; total_amount: number; paid_amount: number; balance: number }[]; outletWise: { outlet_id: number | null; outlet_name: string; payable: number }[] }
interface AgingData { buckets: Record<string, number>; total: number; vendorWise: any[]; items: { purchase_id: number; invoice_number: string; vendor_name: string; daysOverdue: number; bucket: string; balance: number }[] }
interface DueAlert { purchase_id: number; invoice_number: string; vendor_name: string; outlet_name: string; due_date: string; balance: number; isOverdue: boolean }
interface ScheduledPayment { id: number; amount: number; scheduled_date: string; status: string; notes: string | null; vendor: { name: string } }
interface VendorListItem { id: number; name: string; phone: string | null; email: string | null; balance: number; cash_in_hand_balance: number; outlet: { id: number; name: string } | null }
interface VendorLedgerTxn { id: number; type: "credit" | "debit"; amount: number; balance_after: number; description: string | null; created_at: string; created_by: { full_name: string } | null }

const TABS = [
  { key: "payables" as const, label: "Payables", icon: HandCoins },
  { key: "aging" as const, label: "Aging", icon: Clock },
  { key: "alerts" as const, label: "Due Alerts", icon: AlertTriangle },
  { key: "scheduled" as const, label: "Scheduled Payments", icon: CalendarClock },
  { key: "manage" as const, label: "Manage Vendors", icon: Store },
];

export default function AccountsVendorsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("payables");
  const [data, setData] = useState<VendorPayables | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"vendor" | "outlet">("vendor");
  const [search, setSearch] = useState("");

  const [aging, setAging] = useState<AgingData | null>(null);
  const [agingLoading, setAgingLoading] = useState(false);

  const [alerts, setAlerts] = useState<DueAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [scheduled, setScheduled] = useState<ScheduledPayment[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ vendor_id: "", amount: "", scheduled_date: "", notes: "" });

  const [vendorForm, setVendorForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [creatingVendor, setCreatingVendor] = useState(false);
  const [cashForm, setCashForm] = useState({ vendor_id: "", type: "credit" as "credit" | "debit", amount: "", description: "" });

  const [vendorList, setVendorList] = useState<VendorListItem[]>([]);
  const [vendorListLoading, setVendorListLoading] = useState(false);
  const [vendorDirSearch, setVendorDirSearch] = useState("");
  const [expandedVendorId, setExpandedVendorId] = useState<number | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState<number | null>(null);
  const [ledgerByVendor, setLedgerByVendor] = useState<Record<number, VendorLedgerTxn[]>>({});

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/vendors/payables`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load vendor payables:", err))
      .finally(() => setLoading(false));
    // Loaded once up front (not gated to the "Manage Vendors" tab) so the vendor picker on
    // "Schedule a Payment" and "Vendor Cash-In-Hand Transaction" always has real names to
    // choose from, instead of asking the admin to type a numeric Vendor ID from memory.
    fetchVendorList();
  }, []);

  useEffect(() => {
    if (tab === "aging") {
      setAgingLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/vendors/aging`, { headers: authHeaders() }).then((res) => res.json()).then((json) => { if (json.success) setAging(json.data); }).finally(() => setAgingLoading(false));
    }
    if (tab === "alerts") {
      setAlertsLoading(true);
      fetch(`${BACKEND_URL}/api/accounts/vendors/due-alerts`, { headers: authHeaders() }).then((res) => res.json()).then((json) => { if (json.success) setAlerts(json.data); }).finally(() => setAlertsLoading(false));
    }
    if (tab === "scheduled") fetchScheduled();
  }, [tab]);

  const fetchVendorList = () => {
    setVendorListLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/vendors`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setVendorList(json.data); })
      .catch((err) => console.error("Failed to load vendor directory:", err))
      .finally(() => setVendorListLoading(false));
  };

  const toggleLedger = async (vendorId: number) => {
    if (expandedVendorId === vendorId) { setExpandedVendorId(null); return; }
    setExpandedVendorId(vendorId);
    if (ledgerByVendor[vendorId]) return;
    setLedgerLoading(vendorId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/${vendorId}/cash-ledger`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setLedgerByVendor((prev) => ({ ...prev, [vendorId]: json.data.transactions }));
    } catch (err) {
      toast.error("Failed to load vendor ledger.");
    } finally {
      setLedgerLoading(null);
    }
  };

  const selectVendorForForms = (v: VendorListItem) => {
    setCashForm((f) => ({ ...f, vendor_id: String(v.id) }));
    setScheduleForm((f) => ({ ...f, vendor_id: String(v.id) }));
    toast.success(`${v.name} selected — ID filled into the forms below.`);
  };

  const filteredVendorList = vendorList.filter((v) =>
    v.name.toLowerCase().includes(vendorDirSearch.toLowerCase()) || (v.phone || "").includes(vendorDirSearch)
  );

  const fetchScheduled = () => {
    setScheduledLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/vendors/scheduled-payments`, { headers: authHeaders() }).then((res) => res.json()).then((json) => { if (json.success) setScheduled(json.data); }).finally(() => setScheduledLoading(false));
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) { toast.error("Vendor name is required."); return; }
    setCreatingVendor(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors`, { method: "POST", headers: authHeaders(), body: JSON.stringify(vendorForm) });
      if (!res.ok) throw new Error("Failed to create vendor.");
      toast.success("Vendor created.");
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
    if (!cashForm.vendor_id || !cashForm.amount) { toast.error("Vendor ID and amount are required."); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/cash-transactions`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ ...cashForm, amount: parseFloat(cashForm.amount) }) });
      if (!res.ok) throw new Error("Transaction failed.");
      toast.success("Vendor cash transaction recorded.");
      const affectedVendorId = parseInt(cashForm.vendor_id);
      setCashForm({ vendor_id: "", type: "credit", amount: "", description: "" });
      fetchVendorList();
      if (ledgerByVendor[affectedVendorId]) {
        setLedgerByVendor((prev) => { const next = { ...prev }; delete next[affectedVendorId]; return next; });
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSchedulePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.vendor_id || !scheduleForm.amount || !scheduleForm.scheduled_date) { toast.error("Vendor, amount, and date are required."); return; }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/vendors/scheduled-payments`, { method: "POST", headers: authHeaders(), body: JSON.stringify(scheduleForm) });
      if (!res.ok) throw new Error("Failed to schedule payment.");
      toast.success("Payment scheduled.");
      setScheduleForm({ vendor_id: "", amount: "", scheduled_date: "", notes: "" });
      fetchScheduled();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateScheduleStatus = async (id: number, status: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/accounts/vendors/scheduled-payments/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
      toast.success(`Marked ${status}.`);
      fetchScheduled();
    } catch {
      toast.error("Update failed.");
    }
  };

  return (
    <>
      <Breadcrumb pageName="Vendors & Payables" />
      <PageHeader icon={Handshake} title="Vendors & Payables" subtitle="Outstanding balances owed to vendors across all outlets." />

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 dark:border-orange-500/20 dark:from-orange-500/10 dark:to-transparent">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-600"><HandCoins className="size-6" strokeWidth={2.25} /></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-orange-600/80">Total Vendor Payables</p><p className="text-3xl font-black leading-tight text-orange-700 dark:text-orange-400">{PKR(data?.totalPayable || 0)}</p></div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "payables" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
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
          </div>
          {loading ? <TableSkeleton /> : (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              {view === "vendor" ? (
                data && data.vendorWise.filter((v) => v.vendor_name.toLowerCase().includes(search.toLowerCase())).length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 text-right font-bold">Total Purchased</th><th className="px-4 py-3 text-right font-bold">Paid</th><th className="px-4 py-3 text-right font-bold">Balance</th></tr></thead>
                    <tbody>{data.vendorWise.filter((v) => v.vendor_name.toLowerCase().includes(search.toLowerCase())).map((v) => (
                      <tr key={`${v.vendor_id}-${v.vendor_name}`} className="border-t border-slate-50 dark:border-white/5">
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{v.vendor_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(v.total_amount)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(v.paid_amount)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-orange-600">{PKR(v.balance)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : <EmptyState icon={Handshake} title={search ? "No matching vendors" : "No vendor purchases recorded"} />
              ) : (
                data && data.outletWise.length > 0 ? (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Payable</th></tr></thead>
                    <tbody>{data.outletWise.map((o) => (
                      <tr key={o.outlet_id ?? "unassigned"} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-medium text-dark dark:text-white">{o.outlet_name}</td><td className="px-4 py-3.5 text-right tabular-nums font-bold text-orange-600">{PKR(o.payable)}</td></tr>
                    ))}</tbody>
                  </table>
                ) : <EmptyState icon={Store} title="No outlet-wise payables" />
              )}
            </div>
          )}
        </>
      )}

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
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">Invoice</th><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 text-right font-bold">Days Overdue</th><th className="px-4 py-3 text-right font-bold">Balance</th></tr></thead>
                <tbody>{aging.items.slice(0, 100).map((it) => (
                  <tr key={it.purchase_id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{it.invoice_number}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{it.vendor_name}</td>
                    <td className={`px-4 py-3.5 text-right tabular-nums font-semibold ${BUCKET_COLORS[it.bucket]}`}>{it.daysOverdue}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(it.balance)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Clock} title="No outstanding vendor balances" /></div>
      )}

      {tab === "alerts" && (
        alertsLoading ? <TableSkeleton /> : alerts.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">Invoice</th><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Due Date</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Balance</th></tr></thead>
              <tbody>{alerts.map((a) => (
                <tr key={a.purchase_id} className="border-t border-slate-50 dark:border-white/5">
                  <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{a.invoice_number}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{a.vendor_name}</td>
                  <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{a.outlet_name}</td>
                  <td className="px-4 py-3.5 text-gray-500">{a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3.5">{a.isOverdue ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 dark:bg-rose-500/10">Overdue</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 dark:bg-amber-500/10">Due Soon</span>}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(a.balance)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={AlertTriangle} title="No payments due soon" /></div>
      )}

      {tab === "scheduled" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">Schedule a Payment</h2>
            <form onSubmit={handleSchedulePayment} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Vendor</label>
                <select
                  value={scheduleForm.vendor_id}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, vendor_id: e.target.value })}
                  className="w-56 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="">Select vendor...</option>
                  {vendorList.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.outlet ? ` (${v.outlet.name})` : ""}</option>
                  ))}
                </select>
              </div>
              <Field label="Amount" value={scheduleForm.amount} onChange={(v) => setScheduleForm({ ...scheduleForm, amount: v })} type="number" />
              <Field label="Date" value={scheduleForm.scheduled_date} onChange={(v) => setScheduleForm({ ...scheduleForm, scheduled_date: v })} type="date" />
              <Field label="Notes" value={scheduleForm.notes} onChange={(v) => setScheduleForm({ ...scheduleForm, notes: v })} />
              <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90"><Plus className="size-4" /> Schedule</button>
            </form>
          </div>
          {scheduledLoading ? <TableSkeleton /> : scheduled.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 text-right font-bold">Amount</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3"></th></tr></thead>
                <tbody>{scheduled.map((s) => (
                  <tr key={s.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{s.vendor.name}</td>
                    <td className="px-4 py-3.5 text-gray-500">{new Date(s.scheduled_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(s.amount)}</td>
                    <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{s.status}</td>
                    <td className="px-4 py-3.5 text-right">
                      {s.status === "scheduled" && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => updateScheduleStatus(s.id, "paid")} className="text-xs font-bold text-emerald-600 hover:underline">Mark Paid</button>
                          <button onClick={() => updateScheduleStatus(s.id, "cancelled")} className="text-xs font-bold text-rose-500 hover:underline">Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={CalendarClock} title="No scheduled payments" /></div>}
        </div>
      )}

      {tab === "manage" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10"><Handshake className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Vendor Directory</h2></div>
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={vendorDirSearch} onChange={(e) => setVendorDirSearch(e.target.value)} placeholder="Search name or phone..." className="w-full rounded-xl border border-stroke bg-white py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
            </div>
            {vendorListLoading ? <TableSkeleton /> : filteredVendorList.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                    <tr><th className="px-4 py-3 font-bold">Vendor</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 font-bold">Phone</th><th className="px-4 py-3 text-right font-bold">Purchase Balance</th><th className="px-4 py-3 text-right font-bold">Cash-In-Hand</th><th className="px-4 py-3"></th></tr>
                  </thead>
                  <tbody>
                    {filteredVendorList.map((v) => (
                      <React.Fragment key={v.id}>
                        <tr className="border-t border-slate-50 dark:border-white/5">
                          <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{v.name} <span className="text-xs font-normal text-gray-400">#{v.id}</span></td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{v.outlet?.name || "Head Office"}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{v.phone || "—"}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-bold text-orange-600">{PKR(v.balance)}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-dark dark:text-white">{PKR(v.cash_in_hand_balance)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex justify-end gap-3">
                              <button onClick={() => selectVendorForForms(v)} className="text-xs font-bold text-[#ff3d3d] hover:underline">Select</button>
                              <button onClick={() => toggleLedger(v.id)} className="text-xs font-bold text-blue-600 hover:underline">{expandedVendorId === v.id ? "Hide Ledger" : "View Ledger"}</button>
                            </div>
                          </td>
                        </tr>
                        {expandedVendorId === v.id && (
                          <tr className="bg-gray-50 dark:bg-gray-900/30">
                            <td colSpan={6} className="px-4 py-3">
                              {ledgerLoading === v.id ? (
                                <p className="text-xs text-gray-500">Loading ledger...</p>
                              ) : (ledgerByVendor[v.id]?.length || 0) > 0 ? (
                                <div className="space-y-1.5">
                                  {ledgerByVendor[v.id].slice(0, 20).map((t) => (
                                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs dark:bg-boxdark">
                                      <div className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 font-bold ${t.type === "credit" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10"}`}>{t.type}</span>
                                        <span className="text-gray-500">{new Date(t.created_at).toLocaleString()}</span>
                                        {t.description && <span className="text-gray-400">— {t.description}</span>}
                                      </div>
                                      <div className="flex items-center gap-3 tabular-nums">
                                        <span className={`font-bold ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>{t.type === "credit" ? "+" : "-"}{PKR(t.amount)}</span>
                                        <span className="text-gray-400">bal {PKR(t.balance_after)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : <p className="text-xs text-gray-500">No cash-in-hand transactions for this vendor yet.</p>}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
            <div className="mb-4 flex items-center gap-2.5"><div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Wallet className="size-4" /></div><h2 className="text-sm font-bold text-dark dark:text-white">Vendor Cash-In-Hand Transaction</h2></div>
            <form onSubmit={handleCashTransaction} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-500">Vendor *</label>
                <select
                  value={cashForm.vendor_id}
                  onChange={(e) => setCashForm({ ...cashForm, vendor_id: e.target.value })}
                  className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="">Select vendor...</option>
                  {vendorList.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.outlet ? ` (${v.outlet.name})` : ""}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCashForm({ ...cashForm, type: "credit" })} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${cashForm.type === "credit" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>Credit</button>
                <button type="button" onClick={() => setCashForm({ ...cashForm, type: "debit" })} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${cashForm.type === "debit" ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>Debit</button>
              </div>
              <Field label="Amount *" value={cashForm.amount} onChange={(v) => setCashForm({ ...cashForm, amount: v })} type="number" />
              <Field label="Description" value={cashForm.description} onChange={(v) => setCashForm({ ...cashForm, description: v })} />
              <button type="submit" className="w-full rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white hover:bg-opacity-90">Record Transaction</button>
            </form>
          </div>
          </div>
        </div>
      )}
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
