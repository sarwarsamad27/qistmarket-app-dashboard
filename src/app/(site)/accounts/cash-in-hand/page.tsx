"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  Wallet, Store, UserRound, Banknote, FileBarChart, History, ShieldAlert, Plus, Trash2, Search, Building2, Eye,
  ChevronDown, ChevronRight, AlertTriangle, ArrowDownLeft, ArrowUpRight, Landmark, Undo2,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu, { ExportColumn } from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange, inDateRange } from "@/components/Accounts/DateRangeFilter";
import TransactionDetailModal from "@/components/Accounts/TransactionDetailModal";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

interface CashEntry {
  id: number | string;
  source?: string;
  transaction_id: string;
  submission_ref?: string | null;
  order_ref?: string | null;
  amount: number;
  description: string;
  payment_method: string;
  transaction_date: string;
  officer: { id?: number; full_name: string; username?: string; role: string } | null;
  outlet: { id?: number; name: string; code: string } | null;
}
interface OutletRow { outlet_id: number | null; outlet_name: string; outlet_code: string | null; at_outlet: number; pending: number; total: number; count: number; officer_count: number }
interface OfficerRow { officer_id: number | null; officer_name: string; username: string | null; phone: string | null; role: string; outlet_id: number | null; outlet_name: string; pending: number; count: number; oldest_entry: string | null }
interface CashInHandData {
  totalPending: number;
  outletCash: number;
  hoCash: number;
  totalCashInHand: number;
  entries: CashEntry[];
  outletEntries: CashEntry[];
  outletWise: OutletRow[];
  officerWise: OfficerRow[];
}
interface ReportRow {
  period: string; opening_cash: number; collections: number; officer_submissions: number; cash_sales: number; cash_in: number;
  expenses: number; refunds: number; vendor: number; transfers: number; bank_deposits: number; to_head_office: number; head_office: number;
  cash_out: number; net_change: number; closing_cash: number; count: number;
}
interface SubmissionRow {
  submission_ref: string; transaction_id: string | null; amount: number; status: string; submission_date: string;
  officer_name: string; officer_username: string | null; officer_role: string | null; officer_outlet: string;
  submitted_to: string; channel: string; accepted_by: string | null; accepted_at: string | null; orders: string[];
}
interface LimitRow { id: number; scope_type: string; scope_id: number; name: string; outlet_name: string; daily_limit: number; current_pending: number; at_outlet: number; with_officers: number; remaining: number; used_pct: number; is_over_limit: boolean }
interface HoTxn {
  id: number; transaction_id: string; type: "credit" | "debit"; category: string; category_label: string; amount: number; balance_after: number;
  description: string | null; reference: string | null; transaction_date: string; reversed: boolean;
  outlet: { name: string } | null; bank_account: { bank_name: string; account_number: string } | null; vendor: { name: string } | null; created_by: { full_name: string; username: string } | null;
}
interface HoBook { balance: number; totalIn: number; totalOut: number; transactions: HoTxn[] }
interface Option { id: number; name?: string; full_name?: string; username?: string; outlet_id?: number; role?: string | null; code?: string }

const TABS = [
  { key: "entries" as const, label: "All Entries", icon: Wallet },
  { key: "outlet" as const, label: "Outlet Wise", icon: Store },
  { key: "officer" as const, label: "Officer Wise", icon: UserRound },
  { key: "ho" as const, label: "Head Office Cash", icon: Building2 },
  { key: "reports" as const, label: "Reports", icon: FileBarChart },
  { key: "history" as const, label: "Submission Tracking", icon: History },
  { key: "limits" as const, label: "Cash Limits", icon: ShieldAlert },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-white/10",
};

const input = "rounded-xl border border-stroke bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";
const th = "px-4 py-3 font-bold";
const thR = "px-4 py-3 text-right font-bold";
const card = "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark";
const thead = "bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400";
const tr = "border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5";

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Negative cash can't physically exist — it means outflows were recorded without the matching cash in. */
function Money({ value, className = "" }: { value: number; className?: string }) {
  if (value < -0.5) {
    return (
      <span className={`inline-flex items-center gap-1 text-rose-600 ${className}`} title="Negative cash: more cash was recorded going out than coming in — some entries are missing or wrong.">
        <AlertTriangle className="size-3.5" /> − {PKR(-value)}
      </span>
    );
  }
  return <span className={className}>{PKR(value)}</span>;
}

export default function CashInHandPage() {
  const [data, setData] = useState<CashInHandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<(typeof TABS)[number]["key"]>("entries");
  const [detail, setDetail] = useState<{ source: string; id: string } | null>(null);

  // All Entries
  const [scope, setScope] = useState<"total" | "pending" | "outlets">("total");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [outletFilter, setOutletFilter] = useState("");

  // Outlet / Officer wise
  const [expandedOutlet, setExpandedOutlet] = useState<number | "unassigned" | null>(null);
  const [officerSearch, setOfficerSearch] = useState("");
  const [officerOutlet, setOfficerOutlet] = useState("");

  // Reports
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [reportRange, setReportRange] = useState<DateRange>({ from: "", to: "" });
  const [reportOutlet, setReportOutlet] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportMeta, setReportMeta] = useState<{ opening_cash: number; closing_cash: number; totals: Record<string, number> } | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Submission tracking
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [subSummary, setSubSummary] = useState<Record<string, { count: number; amount: number }> | null>(null);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subStatus, setSubStatus] = useState("all");
  const [subRange, setSubRange] = useState<DateRange>({ from: "", to: "" });
  const [subOutlet, setSubOutlet] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);

  // Limits
  const [limits, setLimits] = useState<LimitRow[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitForm, setLimitForm] = useState({ scope_type: "outlet", outlet_id: "", scope_id: "", daily_limit: "" });
  const [options, setOptions] = useState<{ outlets: Option[]; officers: Option[] }>({ outlets: [], officers: [] });

  // Head Office cash
  const [ho, setHo] = useState<HoBook | null>(null);
  const [hoLoading, setHoLoading] = useState(false);
  const [hoRange, setHoRange] = useState<DateRange>({ from: "", to: "" });
  const [hoSearch, setHoSearch] = useState("");
  const [hoForm, setHoForm] = useState<null | "in" | "out" | "deposit">(null);
  const [hoEntry, setHoEntry] = useState({ category: "", amount: "", description: "", reference: "", outlet_id: "", vendor_id: "", bank_account_id: "", transaction_date: "" });
  const [hoSaving, setHoSaving] = useState(false);
  const [banks, setBanks] = useState<{ id: number; bank_name: string; account_number: string; is_active: boolean }[]>([]);
  const [vendors, setVendors] = useState<{ id: number; name: string }[]>([]);

  const dHoSearch = useDebounced(hoSearch);
  const dSubSearch = useDebounced(subSearch);

  const loadOverview = useCallback(() => {
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/cash-in-hand`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load cash in hand:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOverview();
    fetch(`${BACKEND_URL}/api/accounts/cash/limit-options`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => { if (j.success) setOptions(j.data); }).catch(() => {});
  }, [loadOverview]);

  const loadHo = useCallback(() => {
    setHoLoading(true);
    const qs = new URLSearchParams({ ...(hoRange.from && { startDate: hoRange.from }), ...(hoRange.to && { endDate: hoRange.to }), ...(dHoSearch.trim() && { search: dHoSearch.trim() }) });
    fetch(`${BACKEND_URL}/api/accounts/ho-cash?${qs}`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => { if (j.success) setHo(j.data); })
      .finally(() => setHoLoading(false));
  }, [hoRange, dHoSearch]);

  const loadSubs = useCallback((page = 1) => {
    setSubsLoading(true);
    const qs = new URLSearchParams({
      status: subStatus, page: String(page), limit: "50",
      ...(subRange.from && { startDate: subRange.from }), ...(subRange.to && { endDate: subRange.to }),
      ...(subOutlet && { outletId: subOutlet }), ...(dSubSearch.trim() && { search: dSubSearch.trim() }),
    });
    fetch(`${BACKEND_URL}/api/accounts/cash/submissions?${qs}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setSubs(j.data); setSubSummary(j.summary); setSubPage(page); setSubTotalPages(j.pagination?.totalPages || 1);
        }
      })
      .finally(() => setSubsLoading(false));
  }, [subStatus, subRange, subOutlet, dSubSearch]);

  const fetchLimits = () => {
    setLimitsLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/cash/limits`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setLimits(json.data); })
      .finally(() => setLimitsLoading(false));
  };

  useEffect(() => {
    if (view !== "reports") return;
    setReportsLoading(true);
    const qs = new URLSearchParams({ period: reportPeriod, ...(reportRange.from && { startDate: reportRange.from }), ...(reportRange.to && { endDate: reportRange.to }), ...(reportOutlet && { outletId: reportOutlet }) });
    fetch(`${BACKEND_URL}/api/accounts/cash/reports?${qs}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) { setReports(json.data.series); setReportMeta(json.data); } })
      .finally(() => setReportsLoading(false));
  }, [view, reportPeriod, reportRange, reportOutlet]);

  useEffect(() => { if (view === "history") loadSubs(1); }, [view, loadSubs]);
  useEffect(() => { if (view === "limits") fetchLimits(); }, [view]);
  useEffect(() => { if (view === "ho") loadHo(); }, [view, loadHo]);
  useEffect(() => {
    if (view !== "ho" || banks.length) return;
    fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setBanks(j.data); }).catch(() => {});
    fetch(`${BACKEND_URL}/api/accounts/vendors`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setVendors(j.data); }).catch(() => {});
  }, [view, banks.length]);

  // ---------- All Entries ----------
  const scopedEntries: CashEntry[] = useMemo(() => {
    const officerRows = (data?.entries || []).map((e) => ({ ...e, id: `officer-${e.id}`, source: undefined }));
    if (scope === "pending") return officerRows;
    if (scope === "outlets") return data?.outletEntries || [];
    return [...officerRows, ...(data?.outletEntries || [])].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }, [data, scope]);

  const filteredEntries = scopedEntries.filter((e) => {
    if (!inDateRange(e.transaction_date, range)) return false;
    if (outletFilter && String(e.outlet?.id ?? "") !== outletFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [e.transaction_id, e.submission_ref, e.order_ref, e.officer?.full_name, e.officer?.username, e.outlet?.name, e.payment_method, e.description].some((v) => (v || "").toLowerCase().includes(q));
  });
  const filteredIn = filteredEntries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const filteredOut = filteredEntries.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);

  const openDetail = (e: CashEntry) => {
    if (!e.source) setDetail({ source: "officer", id: e.transaction_id });
    else setDetail({ source: e.source, id: String(e.id).slice(e.source.length + 1) });
  };

  const entryColumns: ExportColumn<CashEntry>[] = [
    { header: "#", value: (_, i) => i + 1 },
    { header: "Date", value: (e) => fmt(e.transaction_date) },
    { header: "Transaction ID", value: (e) => e.transaction_id },
    { header: "Held by", value: (e) => (e.source ? "Outlet" : "Officer") },
    { header: "Officer", value: (e) => (e.officer ? `${e.officer.full_name}${e.officer.username ? ` (${e.officer.username})` : ""}` : "") },
    { header: "Outlet", value: (e) => e.outlet?.name || "" },
    { header: "Description", value: (e) => `${e.description}${e.order_ref ? ` — ${e.order_ref}` : ""}` },
    { header: "Method", value: (e) => e.payment_method },
    { header: "Amount (PKR)", value: (e) => e.amount, numeric: true },
  ];

  // ---------- Officer wise ----------
  const filteredOfficers = (data?.officerWise || []).filter((o) => {
    if (officerOutlet && String(o.outlet_id ?? "unassigned") !== officerOutlet) return false;
    const q = officerSearch.trim().toLowerCase();
    return !q || [o.officer_name, o.username, o.outlet_name, o.role, o.phone].some((v) => (v || "").toLowerCase().includes(q));
  });

  // ---------- Limits ----------
  const officersForOutlet = options.officers.filter((o) => !limitForm.outlet_id || String(o.outlet_id) === limitForm.outlet_id);

  const handleAddLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    const scope_id = limitForm.scope_type === "outlet" ? limitForm.outlet_id : limitForm.scope_id;
    if (!scope_id || !limitForm.daily_limit) {
      toast.error(limitForm.scope_type === "outlet" ? "Select an outlet and enter the limit." : "Select an outlet, an officer and enter the limit.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/cash/limits`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ scope_type: limitForm.scope_type, scope_id, daily_limit: limitForm.daily_limit }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to save limit."));
      toast.success("Cash limit saved.");
      setLimitForm({ scope_type: limitForm.scope_type, outlet_id: "", scope_id: "", daily_limit: "" });
      fetchLimits();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteLimit = async (id: number) => {
    if (!confirm("Remove this cash limit?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/cash/limits/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to remove limit."));
      toast.success("Limit removed.");
      fetchLimits();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove limit."));
    }
  };

  // ---------- Head Office cash ----------
  const openHoForm = (kind: "in" | "out" | "deposit") => {
    setHoForm(kind);
    setHoEntry({ category: kind === "in" ? "cash_received_from_outlet" : kind === "out" ? "vendor_payment" : "bank_deposit", amount: "", description: "", reference: "", outlet_id: "", vendor_id: "", bank_account_id: "", transaction_date: "" });
  };

  const submitHo = async (e: React.FormEvent) => {
    e.preventDefault();
    setHoSaving(true);
    try {
      const isDeposit = hoForm === "deposit";
      const body = isDeposit
        ? { bank_account_id: hoEntry.bank_account_id, amount: hoEntry.amount, description: hoEntry.description, receipt_id: hoEntry.reference }
        : { type: hoForm === "in" ? "credit" : "debit", ...hoEntry };
      const res = await fetch(`${BACKEND_URL}/api/accounts/ho-cash${isDeposit ? "/deposit" : ""}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to save."));
      const j = await res.json();
      toast.success(j.message || "Saved.");
      setHoForm(null);
      loadHo();
      loadOverview();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setHoSaving(false);
    }
  };

  const reverseHo = async (t: HoTxn) => {
    const reason = prompt(`Reverse ${t.transaction_id} (${PKR(t.amount)})? Enter the reason:`);
    if (!reason?.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/ho-cash/${t.id}/reverse`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ reason }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to reverse."));
      toast.success("Entry reversed.");
      loadHo();
      loadOverview();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const hoColumns: ExportColumn<HoTxn>[] = [
    { header: "#", value: (_, i) => i + 1 },
    { header: "Date", value: (t) => fmt(t.transaction_date) },
    { header: "Transaction ID", value: (t) => t.transaction_id },
    { header: "Category", value: (t) => t.category_label },
    { header: "Description", value: (t) => t.description || "" },
    { header: "Outlet / Bank / Vendor", value: (t) => t.outlet?.name || (t.bank_account ? `${t.bank_account.bank_name} ${t.bank_account.account_number}` : "") || t.vendor?.name || "" },
    { header: "Reference", value: (t) => t.reference || "" },
    { header: "Cash In", value: (t) => (t.type === "credit" ? t.amount : ""), numeric: true },
    { header: "Cash Out", value: (t) => (t.type === "debit" ? t.amount : ""), numeric: true },
    { header: "Balance", value: (t) => t.balance_after, numeric: true },
    { header: "Recorded by", value: (t) => (t.created_by ? `${t.created_by.full_name} (${t.created_by.username})` : "") },
  ];

  const reportColumns: ExportColumn<ReportRow>[] = [
    { header: "Period", value: (r) => r.period },
    { header: "Opening", value: (r) => r.opening_cash, numeric: true },
    { header: "Installments & Down Payments", value: (r) => r.collections, numeric: true },
    { header: "Officer Submissions", value: (r) => r.officer_submissions, numeric: true },
    { header: "Cash Sales", value: (r) => r.cash_sales, numeric: true },
    { header: "Expenses & Refunds", value: (r) => -(r.expenses + r.refunds), numeric: true },
    { header: "Vendors (net)", value: (r) => r.vendor, numeric: true },
    { header: "Bank Deposits", value: (r) => -r.bank_deposits, numeric: true },
    { header: "Total In", value: (r) => r.cash_in, numeric: true },
    { header: "Total Out", value: (r) => r.cash_out, numeric: true },
    { header: "Closing", value: (r) => r.closing_cash, numeric: true },
  ];

  const subColumns: ExportColumn<SubmissionRow>[] = [
    { header: "#", value: (_, i) => i + 1 },
    { header: "Submitted at", value: (s) => fmt(s.submission_date) },
    { header: "Submission Ref", value: (s) => s.submission_ref },
    { header: "Transaction ID", value: (s) => s.transaction_id || "" },
    { header: "Officer", value: (s) => s.officer_name },
    { header: "Officer ID", value: (s) => s.officer_username || "" },
    { header: "Officer outlet", value: (s) => s.officer_outlet },
    { header: "Submitted to", value: (s) => s.submitted_to },
    { header: "Channel", value: (s) => s.channel },
    { header: "Orders", value: (s) => s.orders.join(", ") },
    { header: "Amount", value: (s) => s.amount, numeric: true },
    { header: "Status", value: (s) => s.status },
    { header: "Accepted by", value: (s) => s.accepted_by || "" },
    { header: "Accepted at", value: (s) => fmt(s.accepted_at) },
  ];

  const fetchAllSubs = async () => {
    const qs = new URLSearchParams({
      status: subStatus, page: "1", limit: "1000",
      ...(subRange.from && { startDate: subRange.from }), ...(subRange.to && { endDate: subRange.to }),
      ...(subOutlet && { outletId: subOutlet }), ...(subSearch.trim() && { search: subSearch.trim() }),
    });
    const j = await (await fetch(`${BACKEND_URL}/api/accounts/cash/submissions?${qs}`, { headers: authHeaders() })).json();
    return (j.data || []) as SubmissionRow[];
  };

  const headline = [
    { key: "total" as const, label: "Total Cash In Hand", value: data?.totalCashInHand || 0, note: "Outlets + officers + Head Office", icon: Wallet, tone: "emerald" },
    { key: "pending" as const, label: "Pending With Officers", value: data?.totalPending || 0, note: "Collected, not yet submitted", icon: Banknote, tone: "amber" },
    { key: "outlets" as const, label: "At Outlets", value: data?.outletCash || 0, note: "In outlet cash drawers", icon: Store, tone: "blue" },
    { key: "ho" as const, label: "Head Office Cash", value: data?.hoCash || 0, note: "Accounts office cash book", icon: Building2, tone: "violet" },
  ];
  const tone: Record<string, string> = {
    emerald: "from-emerald-50 border-emerald-100 text-emerald-700 ring-emerald-400/30 dark:from-emerald-500/10 dark:border-emerald-500/20",
    amber: "from-amber-50 border-amber-100 text-amber-700 ring-amber-400/30 dark:from-amber-500/10 dark:border-amber-500/20",
    blue: "from-blue-50 border-blue-100 text-blue-700 ring-blue-400/30 dark:from-blue-500/10 dark:border-blue-500/20",
    violet: "from-violet-50 border-violet-100 text-violet-700 ring-violet-400/30 dark:from-violet-500/10 dark:border-violet-500/20",
  };

  const officersOf = (outletId: number | null) => (data?.officerWise || []).filter((o) => (o.outlet_id ?? null) === outletId);

  return (
    <>
      <Breadcrumb pageName="Cash In Hand" />
      <PageHeader icon={Wallet} title="Cash In Hand" subtitle="Cash held by officers, at outlets and at Head Office — with every entry traceable." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map((h) => {
          const selected = h.key === "ho" ? view === "ho" : view === "entries" && scope === h.key;
          return (
            <button
              key={h.key}
              type="button"
              onClick={() => { if (h.key === "ho") setView("ho"); else { setScope(h.key); setView("entries"); } }}
              className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br to-white p-4 text-left transition dark:to-transparent ${tone[h.tone]} ${selected ? "ring-2" : "hover:shadow-sm"}`}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 dark:bg-white/10"><h.icon className="size-5" strokeWidth={2.25} /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{h.label}</p>
                <p className="truncate text-2xl font-black leading-tight">{loading ? "…" : <Money value={h.value} />}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{h.note}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === tab.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
          >
            <tab.icon className="size-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ---------------- All Entries ---------------- */}
      {view === "entries" && (
        loading ? <TableSkeleton /> : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
                {([["total", "All cash"], ["pending", "With officers"], ["outlets", "At outlets"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setScope(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${scope === k ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{l}</button>
                ))}
              </div>
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Transaction ID, order, officer, customer..." className={`${input} w-full py-2 pl-9`} />
              </div>
              <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className={`${input} py-2`}>
                <option value="">All outlets</option>
                {options.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="ml-auto">
                <ExportMenu title="Cash In Hand Entries" subtitle={`${scope === "total" ? "All cash" : scope === "pending" ? "With officers" : "At outlets"}${range.from || range.to ? ` ${range.from || "…"} to ${range.to || "…"}` : ""}`} columns={entryColumns} getRows={() => filteredEntries} />
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <DateRangeFilter value={range} onChange={setRange} />
              <p className="text-xs text-gray-500">
                {filteredEntries.length} entries — in <span className="font-bold text-emerald-600">{PKR(filteredIn)}</span>, out <span className="font-bold text-rose-600">{PKR(filteredOut)}</span>
              </p>
            </div>
            <div className={card}>
              {filteredEntries.length > 0 ? (
                <div className="max-h-[640px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={`${thead} sticky top-0 z-10`}>
                      <tr><th className={th}>#</th><th className={th}>Date</th><th className={th}>Transaction ID</th><th className={th}>Officer</th><th className={th}>Outlet</th><th className={th}>Description</th><th className={th}>Method</th><th className={thR}>Amount</th><th className={th}></th></tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, i) => (
                        <tr key={entry.id} className={tr}>
                          <td className="px-4 py-3 tabular-nums text-xs text-gray-400">{i + 1}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{fmt(entry.transaction_date)}</td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-semibold text-[#ff3d3d]">{entry.transaction_id}</p>
                            {entry.submission_ref && <p className="font-mono text-[10px] text-gray-400"># {entry.submission_ref}</p>}
                          </td>
                          <td className="px-4 py-3 font-medium text-dark dark:text-white">
                            {entry.officer ? <>{entry.officer.full_name} {entry.officer.username && <span className="text-xs font-normal text-gray-400">({entry.officer.username})</span>}</> : "—"}
                            <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${entry.source ? "text-blue-600" : "text-amber-600"}`}>{entry.source ? "At outlet" : "With officer"}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{entry.outlet?.name || "—"}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{entry.description}{entry.order_ref ? ` — ${entry.order_ref}` : ""}</td>
                          <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-300">{entry.payment_method}</td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${entry.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>{entry.amount < 0 ? `− ${PKR(-entry.amount)}` : PKR(entry.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openDetail(entry)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"><Eye className="size-3.5" /> View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={Wallet} title="No matching entries" description="Change the search, outlet or date filter." />}
            </div>
          </>
        )
      )}

      {/* ---------------- Outlet wise ---------------- */}
      {view === "outlet" && (
        loading ? <TableSkeleton /> : (
          <>
            <div className="mb-3 flex justify-between gap-3">
              <p className="text-xs text-gray-500">Click an outlet to see its officers and how much each one holds.</p>
              <ExportMenu title="Outlet Wise Cash" columns={[
                { header: "Outlet", value: (o: OutletRow) => o.outlet_name },
                { header: "Code", value: (o) => o.outlet_code || "" },
                { header: "In outlet drawer", value: (o) => o.at_outlet, numeric: true },
                { header: "With officers", value: (o) => o.pending, numeric: true },
                { header: "Total", value: (o) => o.total, numeric: true },
                { header: "Officers holding cash", value: (o) => o.officer_count },
              ]} getRows={() => data?.outletWise || []} />
            </div>
            <div className={card}>
              {data && data.outletWise.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={thead}>
                      <tr><th className={th}>Outlet</th><th className={thR}>In Outlet Drawer</th><th className={thR}>With Officers</th><th className={thR}>Officers</th><th className={thR}>Total Cash</th></tr>
                    </thead>
                    <tbody>
                      {data.outletWise.map((o) => {
                        const key = o.outlet_id ?? "unassigned";
                        const open = expandedOutlet === key;
                        return (
                          <React.Fragment key={key}>
                            <tr className={`${tr} cursor-pointer`} onClick={() => setExpandedOutlet(open ? null : key)}>
                              <td className="px-4 py-3.5 font-medium text-dark dark:text-white">
                                <span className="inline-flex items-center gap-1.5">{open ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}{o.outlet_name}</span>
                                {o.outlet_code && <span className="ml-2 text-xs text-gray-400">{o.outlet_code}</span>}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums"><Money value={o.at_outlet} /></td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-amber-700">{PKR(o.pending)}</td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{o.officer_count}</td>
                              <td className="px-4 py-3.5 text-right font-bold tabular-nums"><Money value={o.total} /></td>
                            </tr>
                            {open && (
                              <tr className="bg-slate-50/60 dark:bg-white/5">
                                <td colSpan={5} className="px-6 py-3">
                                  {officersOf(o.outlet_id).length ? (
                                    <table className="w-full text-left text-xs">
                                      <thead className="text-[10px] uppercase tracking-wide text-gray-400"><tr><th className="py-1.5">Officer</th><th className="py-1.5">Login ID</th><th className="py-1.5">Role</th><th className="py-1.5">Oldest unsubmitted</th><th className="py-1.5 text-right">Entries</th><th className="py-1.5 text-right">Holding</th></tr></thead>
                                      <tbody>
                                        {officersOf(o.outlet_id).map((of) => (
                                          <tr key={of.officer_id ?? "x"} className="border-t border-slate-100 dark:border-white/5">
                                            <td className="py-2 font-medium text-dark dark:text-white">{of.officer_name}</td>
                                            <td className="py-2 font-mono text-gray-500">{of.username || "—"}</td>
                                            <td className="py-2 text-gray-500">{of.role}</td>
                                            <td className="py-2 text-gray-500">{of.oldest_entry ? new Date(of.oldest_entry).toLocaleDateString() : "—"}</td>
                                            <td className="py-2 text-right tabular-nums text-gray-500">{of.count}</td>
                                            <td className="py-2 text-right font-bold tabular-nums text-amber-700">{PKR(of.pending)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : <p className="text-xs text-gray-500">No officer of this outlet is holding cash right now.</p>}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={Store} title="No outlet-wise data" />}
            </div>
          </>
        )
      )}

      {/* ---------------- Officer wise ---------------- */}
      {view === "officer" && (
        loading ? <TableSkeleton /> : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input value={officerSearch} onChange={(e) => setOfficerSearch(e.target.value)} placeholder="Officer name, login ID, phone..." className={`${input} w-full py-2 pl-9`} />
              </div>
              <select value={officerOutlet} onChange={(e) => setOfficerOutlet(e.target.value)} className={`${input} py-2`}>
                <option value="">All outlets</option>
                {options.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="unassigned">Unassigned</option>
              </select>
              <div className="ml-auto">
                <ExportMenu title="Officer Wise Cash" columns={[
                  { header: "Officer", value: (o: OfficerRow) => o.officer_name },
                  { header: "Login ID", value: (o) => o.username || "" },
                  { header: "Phone", value: (o) => o.phone || "" },
                  { header: "Role", value: (o) => o.role },
                  { header: "Outlet", value: (o) => o.outlet_name },
                  { header: "Unsubmitted entries", value: (o) => o.count },
                  { header: "Oldest unsubmitted", value: (o) => (o.oldest_entry ? new Date(o.oldest_entry).toLocaleDateString() : "") },
                  { header: "Holding (PKR)", value: (o) => o.pending, numeric: true },
                ]} getRows={() => filteredOfficers} />
              </div>
            </div>
            <div className={card}>
              {filteredOfficers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className={thead}>
                      <tr><th className={th}>#</th><th className={th}>Officer</th><th className={th}>Login ID</th><th className={th}>Role</th><th className={th}>Outlet</th><th className={th}>Oldest Unsubmitted</th><th className={thR}>Entries</th><th className={thR}>Holding</th></tr>
                    </thead>
                    <tbody>
                      {filteredOfficers.map((o, i) => (
                        <tr key={o.officer_id ?? "unassigned"} className={tr}>
                          <td className="px-4 py-3.5 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{o.officer_name}{o.phone && <p className="text-xs font-normal text-gray-400">{o.phone}</p>}</td>
                          <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{o.username || "—"}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.role}</td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{o.outlet_name}</td>
                          <td className="px-4 py-3.5 text-gray-500">{o.oldest_entry ? new Date(o.oldest_entry).toLocaleDateString() : "—"}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{o.count}</td>
                          <td className="px-4 py-3.5 text-right font-bold tabular-nums text-amber-700">{PKR(o.pending)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={UserRound} title="No officer is holding cash" />}
            </div>
          </>
        )
      )}

      {/* ---------------- Head Office cash ---------------- */}
      {view === "ho" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Head Office Cash In Hand</p>
              <p className="text-2xl font-black text-violet-700 dark:text-violet-300">{ho ? <Money value={ho.balance} /> : "…"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cash In (filtered)</p>
              <p className="text-2xl font-black text-emerald-600">{PKR(ho?.totalIn || 0)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cash Out (filtered)</p>
              <p className="text-2xl font-black text-rose-600">{PKR(ho?.totalOut || 0)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => openHoForm("in")} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><ArrowDownLeft className="size-4" /> Receive Cash</button>
            <button onClick={() => openHoForm("out")} className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"><ArrowUpRight className="size-4" /> Pay Out Cash</button>
            <button onClick={() => openHoForm("deposit")} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Landmark className="size-4" /> Deposit to Bank</button>
            <div className="relative ml-auto min-w-[200px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input value={hoSearch} onChange={(e) => setHoSearch(e.target.value)} placeholder="Search HOC ID, reference, outlet..." className={`${input} w-full py-2 pl-9`} />
            </div>
            <ExportMenu title="Head Office Cash Book" columns={hoColumns} getRows={() => ho?.transactions || []} />
          </div>
          <DateRangeFilter value={hoRange} onChange={setHoRange} />

          {hoForm && (
            <form onSubmit={submitHo} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <h3 className="mb-1 text-sm font-bold text-dark dark:text-white">{hoForm === "in" ? "Receive cash into Head Office" : hoForm === "out" ? "Pay cash out of Head Office" : "Deposit Head Office cash to bank"}</h3>
              <p className="mb-4 text-xs text-gray-500">
                {hoForm === "in" && "Cash received from an outlet is also taken out of that outlet's cash register."}
                {hoForm === "out" && "Cash going out of the Head Office drawer — the balance can't go below zero."}
                {hoForm === "deposit" && "Works like an outlet deposit: a Deposit Request is raised for verification. The bank is credited when it's verified; if it's rejected the cash comes back here."}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hoForm !== "deposit" && (
                  <label className="text-xs font-medium text-gray-500">Category
                    <select value={hoEntry.category} onChange={(e) => setHoEntry({ ...hoEntry, category: e.target.value })} className={`${input} mt-1 w-full`}>
                      {hoForm === "in" ? (
                        <><option value="cash_received_from_outlet">Cash received from outlet</option><option value="other_receipt">Other receipt</option><option value="adjustment">Adjustment (cash count excess)</option></>
                      ) : (
                        <><option value="vendor_payment">Vendor payment</option><option value="expense">Expense</option><option value="other_payment">Other payment</option><option value="adjustment">Adjustment (cash count short)</option></>
                      )}
                    </select>
                  </label>
                )}
                {hoForm === "in" && hoEntry.category === "cash_received_from_outlet" && (
                  <label className="text-xs font-medium text-gray-500">From outlet *
                    <select value={hoEntry.outlet_id} onChange={(e) => setHoEntry({ ...hoEntry, outlet_id: e.target.value })} className={`${input} mt-1 w-full`}>
                      <option value="">Select outlet...</option>
                      {options.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </label>
                )}
                {hoForm === "out" && hoEntry.category === "vendor_payment" && (
                  <label className="text-xs font-medium text-gray-500">Vendor
                    <select value={hoEntry.vendor_id} onChange={(e) => setHoEntry({ ...hoEntry, vendor_id: e.target.value })} className={`${input} mt-1 w-full`}>
                      <option value="">Select vendor...</option>
                      {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </label>
                )}
                {hoForm === "deposit" && (
                  <label className="text-xs font-medium text-gray-500">Bank account *
                    <select value={hoEntry.bank_account_id} onChange={(e) => setHoEntry({ ...hoEntry, bank_account_id: e.target.value })} className={`${input} mt-1 w-full`}>
                      <option value="">Select bank account...</option>
                      {banks.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                    </select>
                  </label>
                )}
                <label className="text-xs font-medium text-gray-500">Amount (PKR) *
                  <input type="number" min="1" value={hoEntry.amount} onChange={(e) => setHoEntry({ ...hoEntry, amount: e.target.value })} className={`${input} mt-1 w-full`} />
                </label>
                <label className="text-xs font-medium text-gray-500">{hoForm === "deposit" ? "Deposit slip / receipt no." : "Reference"}
                  <input value={hoEntry.reference} onChange={(e) => setHoEntry({ ...hoEntry, reference: e.target.value })} className={`${input} mt-1 w-full`} />
                </label>
                {hoForm !== "deposit" && (
                  <label className="text-xs font-medium text-gray-500">Date
                    <input type="date" value={hoEntry.transaction_date} onChange={(e) => setHoEntry({ ...hoEntry, transaction_date: e.target.value })} className={`${input} mt-1 w-full`} />
                  </label>
                )}
                <label className="text-xs font-medium text-gray-500 sm:col-span-2 lg:col-span-3">Description {hoForm !== "deposit" && "*"}
                  <input value={hoEntry.description} onChange={(e) => setHoEntry({ ...hoEntry, description: e.target.value })} placeholder="What is this cash for?" className={`${input} mt-1 w-full`} />
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={hoSaving} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{hoSaving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => setHoForm(null)} className="rounded-xl border border-stroke px-5 py-2.5 text-sm font-semibold text-gray-600 dark:border-dark-3 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          )}

          {hoLoading ? <TableSkeleton /> : ho && ho.transactions.length > 0 ? (
            <div className={card}>
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={`${thead} sticky top-0`}>
                    <tr><th className={th}>#</th><th className={th}>Date</th><th className={th}>Transaction ID</th><th className={th}>Category</th><th className={th}>Details</th><th className={thR}>In</th><th className={thR}>Out</th><th className={thR}>Balance</th><th className={th}>By</th><th className={th}></th></tr>
                  </thead>
                  <tbody>
                    {ho.transactions.map((t, i) => (
                      <tr key={t.id} className={tr}>
                        <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{fmt(t.transaction_date)}</td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[#ff3d3d]">{t.transaction_id}{t.reference && <p className="text-[10px] font-normal text-gray-400">ref {t.reference}</p>}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t.category_label}{t.reversed && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-white/10">reversed</span>}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {t.description}
                          <p className="text-xs text-gray-400">{t.outlet?.name || (t.bank_account ? `${t.bank_account.bank_name} ${t.bank_account.account_number}` : "") || t.vendor?.name}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600">{t.type === "credit" ? PKR(t.amount) : ""}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-600">{t.type === "debit" ? PKR(t.amount) : ""}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(t.balance_after)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{t.created_by?.full_name || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {!t.reversed && t.category !== "reversal" && t.category !== "bank_deposit" && (
                            <button onClick={() => reverseHo(t)} title="Reverse this entry" className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"><Undo2 className="size-4" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={card}><EmptyState icon={Building2} title="No Head Office cash entries yet" description="Use Receive Cash when an outlet hands cash over to Head Office." /></div>}
        </div>
      )}

      {/* ---------------- Reports ---------------- */}
      {view === "reports" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
              {(["daily", "weekly", "monthly"] as const).map((p) => (
                <button key={p} onClick={() => setReportPeriod(p)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${reportPeriod === p ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{p}</button>
              ))}
            </div>
            <select value={reportOutlet} onChange={(e) => setReportOutlet(e.target.value)} className={`${input} py-2`}>
              <option value="">All outlets + Head Office</option>
              {options.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="ml-auto"><ExportMenu title={`Cash Report ${reportPeriod}`} columns={reportColumns} getRows={() => reports} /></div>
          </div>
          <DateRangeFilter value={reportRange} onChange={setReportRange} />
          <p className="text-xs text-gray-500">Default window: last 90 days (daily), 26 weeks (weekly) or 24 months (monthly). Pick dates above to see any period. Figures are calculated live from every cash entry, not from saved daybook rows.</p>
          {reportMeta && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Opening", reportMeta.opening_cash], ["Total In", reportMeta.totals.cash_in || 0], ["Total Out", reportMeta.totals.cash_out || 0], ["Closing", reportMeta.closing_cash]].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
                  <p className="text-xl font-black text-dark dark:text-white"><Money value={v as number} /></p>
                </div>
              ))}
            </div>
          )}
          {reportsLoading ? <TableSkeleton /> : reports.length > 0 ? (
            <div className={card}>
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className={`${thead} sticky top-0`}>
                    <tr><th className={th}>Period</th><th className={thR}>Opening</th><th className={thR}>Installments & DP</th><th className={thR}>Officer Submissions</th><th className={thR}>Cash Sales</th><th className={thR}>Expenses & Refunds</th><th className={thR}>Vendors (net)</th><th className={thR}>Bank Deposits</th><th className={thR}>Closing</th></tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.period} className={tr}>
                        <td className="px-4 py-3 font-medium text-dark dark:text-white">{r.period}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500"><Money value={r.opening_cash} /></td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{PKR(r.collections)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{PKR(r.officer_submissions)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{PKR(r.cash_sales)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-rose-600">{PKR(-(r.expenses + r.refunds))}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${r.vendor < 0 ? "text-rose-600" : "text-emerald-600"}`}>{PKR(r.vendor)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-blue-600">{PKR(-r.bank_deposits)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-dark dark:text-white"><Money value={r.closing_cash} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={card}><EmptyState icon={FileBarChart} title="No cash movement in this period" /></div>}
        </div>
      )}

      {/* ---------------- Submission tracking ---------------- */}
      {view === "history" && (
        <div className="space-y-4">
          {subSummary && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["pending", "paid", "cancelled"] as const).map((k) => (
                <button key={k} onClick={() => setSubStatus(subStatus === k ? "all" : k)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition dark:bg-boxdark ${subStatus === k ? "border-[#ff3d3d] ring-2 ring-[#ff3d3d]/20" : "border-slate-100 dark:border-white/10"}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{k === "paid" ? "Accepted" : k === "pending" ? "Pending acceptance" : "Cancelled"}</p>
                  <p className="text-xl font-black text-dark dark:text-white">{PKR(subSummary[k]?.amount || 0)}</p>
                  <p className="text-xs text-gray-500">{subSummary[k]?.count || 0} submission(s)</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select value={subStatus} onChange={(e) => setSubStatus(e.target.value)} className={`${input} py-2`}>
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Accepted</option><option value="cancelled">Cancelled</option>
            </select>
            <select value={subOutlet} onChange={(e) => setSubOutlet(e.target.value)} className={`${input} py-2`}>
              <option value="">All outlets</option>
              {options.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input value={subSearch} onChange={(e) => setSubSearch(e.target.value)} placeholder="Ref, officer, login ID, order..." className={`${input} w-full py-2 pl-9`} />
            </div>
            <div className="ml-auto"><ExportMenu title="Cash Submission Tracking" columns={subColumns} getRows={fetchAllSubs} /></div>
          </div>
          <DateRangeFilter value={subRange} onChange={setSubRange} />
          {subsLoading ? <TableSkeleton /> : subs.length > 0 ? (
            <div className={card}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}>
                    <tr><th className={th}>#</th><th className={th}>Submitted</th><th className={th}>Ref / Txn</th><th className={th}>Submitted By</th><th className={th}>Outlet</th><th className={th}>Channel</th><th className={thR}>Amount</th><th className={th}>Status</th><th className={th}>Accepted By</th></tr>
                  </thead>
                  <tbody>
                    {subs.map((s, i) => (
                      <tr key={s.submission_ref} className={tr}>
                        <td className="px-4 py-3 text-xs text-gray-400">{(subPage - 1) * 50 + i + 1}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{fmt(s.submission_date)}</td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-semibold text-dark dark:text-white">{s.submission_ref}</p>
                          {s.transaction_id && (
                            <button onClick={() => setDetail({ source: "officer", id: s.transaction_id! })} className="font-mono text-[10px] text-blue-600 hover:underline">{s.transaction_id}</button>
                          )}
                          {s.orders.length > 0 && <p className="text-[10px] text-gray-400">{s.orders.slice(0, 3).join(", ")}{s.orders.length > 3 ? ` +${s.orders.length - 3}` : ""}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-dark dark:text-white">{s.officer_name}</p>
                          <p className="text-xs text-gray-400">ID: {s.officer_username || "—"}{s.officer_role ? ` · ${s.officer_role}` : ""}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.officer_outlet}<p className="text-xs text-gray-400">to: {s.submitted_to}</p></td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{s.channel}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(s.amount)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[s.status] || STATUS_STYLE.cancelled}`}>{s.status === "paid" ? "accepted" : s.status}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{s.accepted_by || "—"}{s.accepted_at && <p className="text-gray-400">{fmt(s.accepted_at)}</p>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {subTotalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-slate-50 p-3 text-sm dark:border-white/5">
                  <button disabled={subPage <= 1} onClick={() => loadSubs(subPage - 1)} className="rounded-lg border border-stroke px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-dark-3">Previous</button>
                  <span className="text-gray-500">Page {subPage} of {subTotalPages}</span>
                  <button disabled={subPage >= subTotalPages} onClick={() => loadSubs(subPage + 1)} className="rounded-lg border border-stroke px-3 py-1.5 font-semibold disabled:opacity-40 dark:border-dark-3">Next</button>
                </div>
              )}
            </div>
          ) : <div className={card}><EmptyState icon={History} title="No submissions match these filters" /></div>}
          <p className="text-xs text-gray-400">“Accepted by” is recorded from now on (the outlet user who enters the OTP). Older accepted submissions don’t have it.</p>
        </div>
      )}

      {/* ---------------- Limits ---------------- */}
      {view === "limits" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h2 className="mb-1 text-sm font-bold text-dark dark:text-white">Set Cash Limit</h2>
            <p className="mb-4 text-xs text-gray-500">The most cash an outlet (drawer + its officers) or a single officer may hold before submitting it. “Remaining” goes down as cash is collected and back up as it is submitted.</p>
            <form onSubmit={handleAddLimit} className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-gray-500">Limit for
                <select value={limitForm.scope_type} onChange={(e) => setLimitForm({ ...limitForm, scope_type: e.target.value, scope_id: "" })} className={`${input} mt-1 block`}>
                  <option value="outlet">Outlet</option>
                  <option value="officer">Officer</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-500">Outlet
                <select value={limitForm.outlet_id} onChange={(e) => setLimitForm({ ...limitForm, outlet_id: e.target.value, scope_id: "" })} className={`${input} mt-1 block w-56`}>
                  <option value="">Select outlet...</option>
                  {options.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ""}</option>)}
                </select>
              </label>
              {limitForm.scope_type === "officer" && (
                <label className="text-xs font-medium text-gray-500">Officer
                  <select value={limitForm.scope_id} onChange={(e) => setLimitForm({ ...limitForm, scope_id: e.target.value })} className={`${input} mt-1 block w-64`} disabled={!limitForm.outlet_id}>
                    <option value="">{limitForm.outlet_id ? "Select officer..." : "Select an outlet first"}</option>
                    {officersForOutlet.map((o) => <option key={o.id} value={o.id}>{o.full_name} ({o.username}){o.role ? ` — ${o.role}` : ""}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs font-medium text-gray-500">Limit (PKR)
                <input type="number" min="1" value={limitForm.daily_limit} onChange={(e) => setLimitForm({ ...limitForm, daily_limit: e.target.value })} className={`${input} mt-1 block w-40`} />
              </label>
              <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90"><Plus className="size-4" /> Save Limit</button>
            </form>
          </div>

          {limitsLoading ? <TableSkeleton /> : limits.length > 0 ? (
            <div className={card}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={thead}>
                    <tr><th className={th}>Scope</th><th className={th}>Name</th><th className={th}>Outlet</th><th className={thR}>Limit</th><th className={thR}>Holding Now</th><th className={thR}>Remaining</th><th className={th}>Used</th><th className={th}></th></tr>
                  </thead>
                  <tbody>
                    {limits.map((l) => (
                      <tr key={l.id} className={tr}>
                        <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{l.scope_type}</td>
                        <td className="px-4 py-3.5 font-medium text-dark dark:text-white">{l.name}</td>
                        <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{l.outlet_name}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{PKR(l.daily_limit)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300" title={l.scope_type === "outlet" ? `Drawer ${PKR(l.at_outlet)} + officers ${PKR(l.with_officers)}` : undefined}><Money value={l.current_pending} /></td>
                        <td className={`px-4 py-3.5 text-right font-bold tabular-nums ${l.remaining < 0 ? "text-rose-600" : "text-emerald-600"}`}>{l.remaining < 0 ? `− ${PKR(-l.remaining)}` : PKR(l.remaining)}</td>
                        <td className="w-40 px-4 py-3.5">
                          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className={`h-full ${l.is_over_limit ? "bg-rose-500" : l.used_pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, Math.max(0, l.used_pct))}%` }} /></div>
                          <p className={`mt-1 text-[11px] font-bold ${l.is_over_limit ? "text-rose-600" : "text-gray-500"}`}>{l.is_over_limit ? "Over limit" : `${l.used_pct}%`}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right"><button onClick={() => handleDeleteLimit(l.id)} className="text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : <div className={card}><EmptyState icon={ShieldAlert} title="No cash limits configured" /></div>}
        </div>
      )}

      {detail && <TransactionDetailModal source={detail.source} id={detail.id} onClose={() => setDetail(null)} />}
    </>
  );
}
