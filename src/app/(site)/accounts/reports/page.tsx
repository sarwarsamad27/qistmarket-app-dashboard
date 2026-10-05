"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Banknote, ClipboardCheck, BarChart3, Users, FileSpreadsheet, ArrowRight, CalendarClock, Plus, Trash2, Clock, Undo2, Send, Loader2,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import ExportMenu, { ExportColumn } from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

const globalReports = [
  { title: "Global Daybook", description: "Consolidated cash flow across all outlets.", icon: Banknote, href: "/reports/daybook", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  { title: "Global Sales Report", description: "Orders, gross amounts, and collections nationwide.", icon: ClipboardCheck, href: "/reports/sales", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
  { title: "P&L (Global)", description: "Net earnings after COGS and operational expenses.", icon: BarChart3, href: "/reports/profit-loss", color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10" },
  { title: "Customer Ledger", description: "Customer transaction history across outlets.", icon: Users, href: "/reports/ledger", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10" },
  { title: "Return Items Report", description: "Customer and vendor returns with IMEI history.", icon: Undo2, href: "/accounts/stock-summary?tab=returns", color: "text-[#ff3d3d]", bg: "bg-rose-50 dark:bg-rose-500/10" },
];

interface ReportType { key: string; label: string; dated: boolean }
interface ScheduledReport { id: number; report_type: string; frequency: string; recipients: string; is_active: boolean; last_sent_at: string | null; created_by: { full_name: string } | null }
type Row = Record<string, string | number | null>;

const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const titleCase = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
// Columns come from the report's own fields; amounts are right-aligned in the PDF.
const columnsFor = (rows: Row[]): ExportColumn<Row>[] =>
  rows.length ? Object.keys(rows[0]).map((k) => ({ header: titleCase(k), value: (r: Row) => r[k], numeric: typeof rows[0][k] === "number" })) : [];

function ReportRow({ type }: { type: ReportType }) {
  const [range, setRange] = useState<DateRange>(() => { const d = new Date(); d.setDate(d.getDate() - 29); return { from: ymd(d), to: ymd(new Date()) }; });
  const [preview, setPreview] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (): Promise<Row[]> => {
    const qs = new URLSearchParams(type.dated ? { ...(range.from && { startDate: range.from }), ...(range.to && { endDate: range.to }) } : {});
    const j = await (await fetch(`${BACKEND_URL}/api/accounts/reports/data/${type.key}?${qs}`, { headers: authHeaders() })).json();
    if (!j.success) throw new Error(j.message || "Could not load report.");
    return j.data;
  };

  const showPreview = async () => {
    if (preview) { setPreview(null); return; }
    setLoading(true);
    try { setPreview(await load()); } catch (err: any) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <p className="font-bold text-dark dark:text-white">{type.label}</p>
          <p className="text-xs text-gray-500">{type.dated ? "For the dates you pick" : "Current position (as of now)"}</p>
        </div>
        {type.dated && <DateRangeFilter value={range} onChange={setRange} presets={false} />}
        <button onClick={showPreview} className="rounded-xl border border-stroke px-3.5 py-2 text-sm font-semibold text-gray-600 hover:border-[#ff3d3d] hover:text-[#ff3d3d] dark:border-dark-3 dark:text-gray-300">{loading ? <Loader2 className="size-4 animate-spin" /> : preview ? "Hide" : "Preview"}</button>
        <ExportMenu title={type.label} subtitle={type.dated ? `${range.from || "…"} to ${range.to || "…"}` : undefined} columns={columnsFor} getRows={load} />
      </div>
      {preview && (
        preview.length ? (
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-slate-100 dark:border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase text-gray-500 dark:bg-dark-2"><tr>{Object.keys(preview[0]).map((k) => <th key={k} className="whitespace-nowrap px-3 py-2">{titleCase(k)}</th>)}</tr></thead>
              <tbody>
                {preview.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-white/5">{Object.keys(preview[0]).map((k) => <td key={k} className={`whitespace-nowrap px-3 py-1.5 ${typeof r[k] === "number" ? "text-right tabular-nums" : ""}`}>{typeof r[k] === "number" ? (r[k] as number).toLocaleString("en-PK") : String(r[k] ?? "")}</td>)}</tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-1.5 text-[11px] text-gray-400">{preview.length} row(s){preview.length > 100 ? " — first 100 shown; export for all" : ""}</p>
          </div>
        ) : <p className="mt-3 text-sm text-gray-500">No data for this selection.</p>
      )}
    </div>
  );
}

export default function AccountsReportsPage() {
  const [types, setTypes] = useState<ReportType[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledReport[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(true);
  const [form, setForm] = useState({ report_type: "daybook", frequency: "weekly", recipients: "" });
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  const fetchScheduled = () => {
    setScheduledLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/reports/scheduled`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setScheduled(json.data); })
      .finally(() => setScheduledLoading(false));
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/reports/types`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setTypes(j.data); });
    fetchScheduled();
  }, []);

  const labelOf = (key: string) => types.find((t) => t.key === key)?.label || titleCase(key);

  const handleCreateScheduled = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipients.trim()) { toast.error("Enter at least one recipient email."); return; }
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/reports/scheduled`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to schedule report."));
      toast.success("Scheduled report created.");
      setForm({ ...form, recipients: "" });
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
    } catch (err) {
      toast.error(getErrorMessage(err, "Update failed."));
    }
  };

  const deleteScheduled = async (id: number) => {
    if (!confirm("Delete this scheduled report?")) return;
    try {
      await fetch(`${BACKEND_URL}/api/accounts/reports/scheduled/${id}`, { method: "DELETE", headers: authHeaders() });
      toast.success("Removed.");
      fetchScheduled();
    } catch (err) {
      toast.error(getErrorMessage(err, "Delete failed."));
    }
  };

  const sendNow = async (id: number) => {
    setSending(id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/reports/scheduled/${id}/send-now`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Could not send."));
      toast.success((await res.json()).message);
      fetchScheduled();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Reports & Export" />
      <PageHeader icon={FileSpreadsheet} title="Reports & Export" subtitle="Every accounts report in Excel, CSV or PDF for any dates — and emailed automatically on a schedule." />

      <div className="mb-8">
        <h2 className="mb-1 text-sm font-black uppercase tracking-widest text-gray-400">Reports</h2>
        <p className="mb-4 text-xs text-gray-500">Pick the dates, preview, then Export → Excel / CSV / PDF. Every list inside the accounts pages also has its own Export button.</p>
        {types.length ? <div className="space-y-3">{types.map((t) => <ReportRow key={t.key} type={t} />)}</div> : <TableSkeleton />}
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-gray-400">Other Reports</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      <div>
        <h2 className="mb-1 text-sm font-black uppercase tracking-widest text-gray-400">Scheduled Reports (email)</h2>
        <p className="mb-4 text-xs text-gray-500">Sent automatically as an Excel-ready CSV attachment. Daily = yesterday, weekly = last 7 days, monthly = last 30 days for dated reports. Use “Send now” to test.</p>
        <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <form onSubmit={handleCreateScheduled} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Report</label>
              <select value={form.report_type} onChange={(e) => setForm({ ...form, report_type: e.target.value })} className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
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
                    <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{labelOf(s.report_type)}{s.created_by && <p className="text-xs font-normal text-gray-400">by {s.created_by.full_name}</p>}</td>
                    <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{s.frequency}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{s.recipients}</td>
                    <td className="px-4 py-3.5 text-gray-500">{s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : <span className="inline-flex items-center gap-1"><Clock className="size-3" /> Never</span>}</td>
                    <td className="px-4 py-3.5"><button onClick={() => toggleScheduled(s.id, s.is_active)} className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.is_active ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{s.is_active ? "Active" : "Paused"}</button></td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right">
                      <button onClick={() => sendNow(s.id)} disabled={sending === s.id} className="mr-3 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline disabled:opacity-50">{sending === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send now</button>
                      <button onClick={() => deleteScheduled(s.id)} className="text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button>
                    </td>
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
