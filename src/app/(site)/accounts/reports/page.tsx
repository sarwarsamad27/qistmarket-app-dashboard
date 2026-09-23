"use client";

import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import toast from "react-hot-toast";
import {
  Banknote, ClipboardCheck, BarChart3, Users, FileSpreadsheet, Wallet, Receipt, HandCoins,
  ArrowRight, FileText, Printer, CalendarClock, Plus, Trash2, Clock, Undo2,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

const globalReports = [
  { title: "Global Daybook", description: "Consolidated cash flow across all outlets.", icon: Banknote, href: "/reports/daybook", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  { title: "Global Sales Report", description: "Orders, gross amounts, and collections nationwide.", icon: ClipboardCheck, href: "/reports/sales", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
  { title: "P&L (Global)", description: "Net earnings after COGS and operational expenses.", icon: BarChart3, href: "/reports/profit-loss", color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10" },
  { title: "Customer Ledger", description: "Customer transaction history across outlets.", icon: Users, href: "/reports/ledger", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10" },
  { title: "Return Items Report", description: "Customer returns, verified status, and refund audit log.", icon: Undo2, href: "/accounts/stock-summary?tab=returns", color: "text-[#ff3d3d]", bg: "bg-rose-50 dark:bg-rose-500/10" },
];

const exports = [
  { key: "cash-in-hand", label: "Cash In Hand", icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", endpoint: "/api/accounts/cash-in-hand", pluck: (d: any) => d.entries, reportType: null as string | null },
  { key: "expenses", label: "Expense Summary", icon: Receipt, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-500/10", endpoint: "/api/accounts/expenses/summary", pluck: (d: any) => d.topCategories, reportType: "expenses" },
  { key: "vendor-payables", label: "Vendor Payables", icon: HandCoins, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10", endpoint: "/api/accounts/vendors/payables", pluck: (d: any) => d.vendorWise, reportType: "vendor_payables" },
  { key: "returns", label: "Return Items", icon: Undo2, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10", endpoint: "/api/accounts/stock/returns", pluck: (d: any) => d.items, reportType: "returns" },
];

const REPORT_TYPES = ["daybook", "expenses", "vendor_payables", "recovery", "aging", "returns"];

interface ScheduledReport { id: number; report_type: string; frequency: string; recipients: string; is_active: boolean; last_sent_at: string | null }

export default function AccountsReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [scheduled, setScheduled] = useState<ScheduledReport[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [form, setForm] = useState({ report_type: "daybook", frequency: "weekly", recipients: "" });
  const [creating, setCreating] = useState(false);

  const fetchScheduled = () => {
    setScheduledLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/reports/scheduled`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setScheduled(json.data); })
      .finally(() => setScheduledLoading(false));
  };

  useEffect(() => { fetchScheduled(); }, []);

  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: "Accounts_Reports_Summary" });

  const handleExportExcel = async (item: (typeof exports)[number]) => {
    setExporting(item.key);
    try {
      const res = await fetch(`${BACKEND_URL}${item.endpoint}`, { headers: authHeaders() });
      const json = await res.json();
      const payload = json.data || json.summary;
      const rows = item.pluck(payload);
      if (!rows || rows.length === 0) { toast.error("No data available to export."); return; }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, item.label);
      XLSX.writeFile(wb, `${item.label.replace(/\s+/g, "_")}.xlsx`);
      toast.success(`${item.label} exported to Excel.`);
    } catch (err) {
      toast.error("Export failed.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = async (reportType: string) => {
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${BACKEND_URL}/api/accounts/reports/export/${reportType}`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${reportType} exported to CSV.`);
    } catch {
      toast.error("CSV export failed.");
    }
  };

  const handleCreateScheduled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipients.trim()) { toast.error("Enter at least one recipient email."); return; }
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/reports/scheduled`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed to schedule report.");
      toast.success("Scheduled report created.");
      setForm({ report_type: "daybook", frequency: "weekly", recipients: "" });
      fetchScheduled();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleScheduled = async (id: number, is_active: boolean) => {
    try {
      await fetch(`${BACKEND_URL}/api/accounts/reports/scheduled/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ is_active: !is_active }) });
      fetchScheduled();
    } catch {
      toast.error("Update failed.");
    }
  };

  const deleteScheduled = async (id: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/accounts/reports/scheduled/${id}`, { method: "DELETE", headers: authHeaders() });
      toast.success("Removed.");
      fetchScheduled();
    } catch {
      toast.error("Delete failed.");
    }
  };

  return (
    <>
      <Breadcrumb pageName="Reports & Export" />
      <PageHeader
        icon={FileSpreadsheet}
        title="Reports & Export"
        subtitle="Generate, export, and schedule financial reports across the business."
        actions={<button onClick={handlePrint} className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"><Printer className="size-4" /> Print / PDF</button>}
      />

      <div ref={printRef}>
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">Quick Export</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {exports.map((item) => (
              <div key={item.key} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${item.bg} ${item.color}`}><item.icon className="size-5" strokeWidth={2.25} /></div>
                <div className="flex-1">
                  <p className="font-bold text-dark dark:text-white">{item.label}</p>
                  <div className="mt-1 flex gap-2 print:hidden">
                    <button onClick={() => handleExportExcel(item)} disabled={exporting === item.key} className="text-xs font-semibold text-emerald-600 hover:underline disabled:opacity-50">Excel</button>
                    {item.reportType && <button onClick={() => handleExportCsv(item.reportType!)} className="text-xs font-semibold text-blue-600 hover:underline">CSV</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-8 print:hidden">
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">CSV Export — All Reports</h2>
          <div className="flex flex-wrap gap-2">
            {REPORT_TYPES.map((rt) => (
              <button key={rt} onClick={() => handleExportCsv(rt)} className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-boxdark dark:text-gray-300">
                <FileText className="size-3.5" /> {rt.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">Global Reports</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {globalReports.map((report) => (
              <Link key={report.href} href={report.href} className="group flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-boxdark">
                <div className={`flex size-11 items-center justify-center rounded-2xl ${report.bg} ${report.color}`}><report.icon className="size-5" strokeWidth={2.25} /></div>
                <div>
                  <p className="flex items-center gap-1 font-bold text-dark dark:text-white">{report.title}<ArrowRight className="size-3.5 text-gray-300 transition-transform group-hover:translate-x-0.5" /></p>
                  <p className="text-xs text-gray-500">{report.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 print:hidden">
        <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">Scheduled Reports</h2>
        <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <form onSubmit={handleCreateScheduled} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Report</label>
              <select value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })} className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                {REPORT_TYPES.map((rt) => <option key={rt} value={rt}>{rt.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Recipients (comma-separated emails)</label>
              <input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="finance@qistmarket.pk, ceo@qistmarket.pk" className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            </div>
            <button type="submit" disabled={creating} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50"><Plus className="size-4" /> Schedule</button>
          </form>
        </div>

        {scheduledLoading ? <TableSkeleton /> : scheduled.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">Report</th><th className="px-4 py-3 font-bold">Frequency</th><th className="px-4 py-3 font-bold">Recipients</th><th className="px-4 py-3 font-bold">Last Sent</th><th className="px-4 py-3 font-bold">Active</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>
                {scheduled.map((s) => (
                  <tr key={s.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3.5 font-medium capitalize text-dark dark:text-white">{s.report_type.replace("_", " ")}</td>
                    <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{s.frequency}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{s.recipients}</td>
                    <td className="px-4 py-3.5 text-gray-500">{s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Never</span>}</td>
                    <td className="px-4 py-3.5"><button onClick={() => toggleScheduled(s.id, s.is_active)} className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.is_active ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{s.is_active ? "Active" : "Paused"}</button></td>
                    <td className="px-4 py-3.5 text-right"><button onClick={() => deleteScheduled(s.id)} className="text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={CalendarClock} title="No scheduled reports configured" /></div>}
      </div>
    </>
  );
}
