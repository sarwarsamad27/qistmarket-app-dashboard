"use client";

import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  CreditCard,
  Receipt,
  Tags,
  Store,
  Building2,
  Plus,
  ClipboardCheck,
  Users2,
  Trash2,
  Check,
  X,
  Upload,
  ExternalLink,
  Loader2,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  FileText,
  Calendar
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import OutletSelector from "@/components/common/OutletSelector";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";
import DeletedBadge, { askDeleteReason, deletedRowClass } from "@/components/common/DeletedBadge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface ExpenseSummary {
  selectedMonthLabel?: string;
  selectedMonthKey?: string;
  availableMonths?: string[];
  today: number;
  thisMonth: number;
  headOfficeMonth?: number;
  outletsMonth?: number;
  headOfficeToday?: number;
  outletsToday?: number;
  topCategories: { category: string; amount: number }[];
  outletWise: { outlet_id: number | null; outlet_name: string; count?: number; thisMonth: number; is_head_office?: boolean }[];
}

interface AllExpensesRow {
  deleted_at?: string | null;
  deleted_by_name?: string | null;
  delete_reason?: string | null;
  id: number;
  voucher_number: string;
  total_amount: number;
  payment_method: string;
  date: string;
  notes: string | null;
  status: string;
  invoice_url: string | null;
  created_at: string;
  is_head_office: boolean;
  source_name: string;
  outlet: { id: number; name: string } | null;
  items: { category: string; amount: number; description: string | null }[];
  approved_by: { full_name: string } | null;
}

interface ExpenseVoucher {
  id: number;
  voucher_number: string;
  total_amount: number;
  status: string;
  date: string;
  invoice_url: string | null;
  outlet: { name: string } | null;
  items: { category: string; amount: number; description: string | null }[];
}

interface SalaryMonth { month: string; total: number; paid: number; pending: number; count: number }
interface SalarySlip {
  id: number;
  employee_name: string;
  department?: string;
  month: number;
  year: number;
  net_payable: number;
  status: string;
  paid_date?: string;
}

const TABS = [
  { key: "summary" as const, label: "Summary & All Expenses", icon: CreditCard },
  { key: "create" as const, label: "Create Expense", icon: Plus },
  { key: "approvals" as const, label: "Approvals Queue", icon: ClipboardCheck },
  { key: "salary" as const, label: "Salary Expenses", icon: Users2 },
];

function formatMonthLabel(monthKey: string) {
  if (!monthKey || monthKey === "all") return "All Time / All Months";
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${monthNames[m - 1]} ${y}`;
}

export default function AccountsExpensesPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("summary");
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Global Month Filter state ('YYYY-MM' | 'all')
  const [globalMonthFilter, setGlobalMonthFilter] = useState<string>("");

  // All Expenses Tracker state
  const [allExpenses, setAllExpenses] = useState<AllExpensesRow[]>([]);
  const [allExpensesLoading, setAllExpensesLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form states
  const [form, setForm] = useState({ outlet_id: "", payment_method: "Cash", notes: "" });
  const [items, setItems] = useState([{ category: "General", amount: "", description: "" }]);
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // Approvals state
  const [approvals, setApprovals] = useState<ExpenseVoucher[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<number | null>(null);
  const invoiceInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Salary state
  const [salaryMonths, setSalaryMonths] = useState<SalaryMonth[]>([]);
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [availableSalaryMonths, setAvailableSalaryMonths] = useState<string[]>([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");
  const [salarySearch, setSalarySearch] = useState<string>("");
  const [salaryStatusFilter, setSalaryStatusFilter] = useState<string>("all");

  const fetchSummary = (month = globalMonthFilter) => {
    setLoading(true);
    const query = new URLSearchParams();
    if (month) query.set("month", month);

    fetch(`${BACKEND_URL}/api/accounts/expenses/summary?${query.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setSummary(json.summary);
          if (!globalMonthFilter && json.summary.selectedMonthKey) {
            setGlobalMonthFilter(json.summary.selectedMonthKey);
          }
        }
      })
      .catch((err) => console.error("Failed to load expense summary:", err))
      .finally(() => setLoading(false));
  };

  const fetchAllExpenses = (month = globalMonthFilter) => {
    setAllExpensesLoading(true);
    const query = new URLSearchParams();
    if (month) query.set("month", month);
    if (sourceFilter !== "all") query.set("source", sourceFilter);
    if (statusFilter !== "all") query.set("status", statusFilter);
    if (searchQuery.trim()) query.set("search", searchQuery.trim());
    if (showDeleted) query.set("includeDeleted", "1");

    fetch(`${BACKEND_URL}/api/accounts/expenses/all?${query.toString()}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setAllExpenses(json.data || []); })
      .catch((err) => console.error("Failed to fetch all expenses:", err))
      .finally(() => setAllExpensesLoading(false));
  };

  useEffect(() => {
    fetchSummary(globalMonthFilter);
  }, [globalMonthFilter]);

  useEffect(() => {
    if (tab === "summary") {
      fetchAllExpenses(globalMonthFilter);
    } else if (tab === "approvals") {
      fetchApprovals();
    } else if (tab === "salary") {
      setSalaryLoading(true);
      const query = new URLSearchParams();
      if (globalMonthFilter && globalMonthFilter !== "all") {
        query.set("month", globalMonthFilter);
      }
      fetch(`${BACKEND_URL}/api/accounts/expenses/salary?${query.toString()}`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setSalaryMonths(json.data.months || []);
            setSalarySlips(json.data.slips || []);
            if (json.data.availableSalaryMonths) {
              setAvailableSalaryMonths(json.data.availableSalaryMonths);
            }
          }
        })
        .finally(() => setSalaryLoading(false));
    }
  }, [tab, globalMonthFilter, sourceFilter, statusFilter, showDeleted]);

  const fetchApprovals = () => {
    setApprovalsLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/expenses/approvals?status=pending`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setApprovals(json.data); })
      .finally(() => setApprovalsLoading(false));
  };

  const maxCategory = summary?.topCategories.reduce((m, c) => Math.max(m, c.amount), 0) || 0;
  const maxOutletAmount = summary?.outletWise.reduce((m, o) => Math.max(m, o.thisMonth), 0) || 0;

  const addItem = () => setItems([...items, { category: "General", amount: "", description: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: string) => setItems(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.amount && parseFloat(it.amount) > 0);
    if (validItems.length === 0) {
      toast.error("Add at least one item with an amount.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...form, outlet_id: form.outlet_id || null, items: validItems }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to create expense.", json));

      // If user selected an invoice file during creation, attach it now
      if (createFile && json.data?.id) {
        try {
          const fd = new FormData();
          fd.append("file", createFile);
          await fetch(`${BACKEND_URL}/api/accounts/expenses/${json.data.id}/invoice`, {
            method: "POST",
            headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
            body: fd,
          });
        } catch (fileErr) {
          console.error("Failed to attach invoice file:", fileErr);
        }
      }

      toast.success("Expense submitted for approval.");
      setForm({ outlet_id: "", payment_method: "Cash", notes: "" });
      setItems([{ category: "General", amount: "", description: "" }]);
      setCreateFile(null);
      fetchSummary(globalMonthFilter);
      fetchAllExpenses(globalMonthFilter);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleInvoiceUpload = async (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInvoiceId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses/${id}/invoice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to upload invoice.");
      toast.success("Invoice uploaded.");
      setApprovals((prev) => prev.map((v) => (v.id === id ? { ...v, invoice_url: json.data.invoice_url } : v)));
      setAllExpenses((prev) => prev.map((v) => (v.id === id ? { ...v, invoice_url: json.data.invoice_url } : v)));
    } catch (err: any) {
      toast.error(err.message || "Failed to upload invoice.");
    } finally {
      setUploadingInvoiceId(null);
      e.target.value = "";
    }
  };

  const handleDecision = async (id: number, decision: "approved" | "rejected") => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses/${id}/decision`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ decision }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Decision failed."));
      toast.success(`Expense ${decision}.`);
      fetchApprovals();
      fetchSummary(globalMonthFilter);
      fetchAllExpenses(globalMonthFilter);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteExpense = async (id: number, voucherNumber: string, amount: number) => {
    const reason = askDeleteReason(`expense voucher ${voucherNumber} (${PKR(amount)})`);
    if (reason === null) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/expenses/${id}?reason=${encodeURIComponent(reason)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to delete expense.", json));
      toast.success(json.message || "Expense deleted successfully.");
      fetchSummary(globalMonthFilter);
      fetchAllExpenses(globalMonthFilter);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete expense.");
    } finally {
      setDeletingId(null);
    }
  };

  const activeMonthLabel = summary?.selectedMonthLabel || "This Month";

  return (
    <>
      <Breadcrumb pageName="Expenses" />
      <PageHeader
        icon={CreditCard}
        title="Expenses & Outflows"
        subtitle="Consolidated expense tracking across Head Office and all retail outlets with month-wise filtering & deletion."
      />

      {/* Control Bar: Navigation Tabs + Prominent Month Selector */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Global Month Filter Selector */}
        {(tab === "summary" || tab === "salary") && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <Calendar className="size-4 text-[#ff3d3d]" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Month Filter:</span>
            <select
              value={globalMonthFilter}
              onChange={(e) => {
                setGlobalMonthFilter(e.target.value);
                setSelectedMonthFilter(e.target.value);
              }}
              className="rounded-lg border-0 bg-transparent py-0.5 text-xs font-black text-dark outline-none dark:text-white cursor-pointer"
            >
              <option value="all">All Months (All Time)</option>
              {(tab === "salary" && availableSalaryMonths.length > 0 ? availableSalaryMonths : summary?.availableMonths)?.map((mKey) => (
                <option key={mKey} value={mKey}>
                  {formatMonthLabel(mKey)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tab === "summary" && (
        <>
          {/* Top Stat Cards Grid (4 Cards) */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              <>
                <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
              </>
            ) : (
              <>
                {/* 1. Total Expenses */}
                <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm dark:border-rose-500/20 dark:from-rose-500/10 dark:to-transparent">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600">
                    <Receipt className="size-5" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600/80">
                      Total Expense ({activeMonthLabel})
                    </p>
                    <p className="text-2xl font-black leading-tight text-rose-700 dark:text-rose-400">{PKR(summary?.thisMonth || 0)}</p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Head Office + All Outlets</p>
                  </div>
                </div>

                {/* 2. Head Office Expenses */}
                <div className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm dark:border-purple-500/20 dark:from-purple-500/10 dark:to-transparent">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600">
                    <Building2 className="size-5" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-600/80">Head Office ({activeMonthLabel})</p>
                    <p className="text-2xl font-black leading-tight text-purple-700 dark:text-purple-400">{PKR(summary?.headOfficeMonth || 0)}</p>
                    <p className="text-[11px] font-medium text-purple-600/80">Today: {PKR(summary?.headOfficeToday || 0)}</p>
                  </div>
                </div>

                {/* 3. Outlets Expenses */}
                <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 shadow-sm dark:border-teal-500/20 dark:from-teal-500/10 dark:to-transparent">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600">
                    <Store className="size-5" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/80">All Outlets ({activeMonthLabel})</p>
                    <p className="text-2xl font-black leading-tight text-teal-700 dark:text-teal-400">{PKR(summary?.outletsMonth || 0)}</p>
                    <p className="text-[11px] font-medium text-teal-600/80">Today: {PKR(summary?.outletsToday || 0)}</p>
                  </div>
                </div>

                {/* 4. Today's Total Expense */}
                <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm dark:border-orange-500/20 dark:from-orange-500/10 dark:to-transparent">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-600">
                    <CreditCard className="size-5" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600/80">Today's Total Expense</p>
                    <p className="text-2xl font-black leading-tight text-orange-700 dark:text-orange-400">{PKR(summary?.today || 0)}</p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">All locations consolidated</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Side-by-Side Analytics Section */}
          {loading ? (
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2"><TableSkeleton rows={5} cols={2} /><TableSkeleton rows={5} cols={2} /></div>
          ) : (
            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Head Office vs Outlets Breakdown Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                      <Store className="size-4" />
                    </div>
                    <h2 className="text-sm font-bold text-dark dark:text-white">Location Breakdown ({activeMonthLabel})</h2>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{summary?.outletWise.length || 0} Locations</span>
                </div>

                {summary && summary.outletWise.length > 0 ? (
                  <div className="space-y-4">
                    {summary.outletWise.map((o) => {
                      const pct = summary.thisMonth > 0 ? (o.thisMonth / summary.thisMonth) * 100 : 0;
                      return (
                        <div key={o.outlet_id ?? "head_office"} className="rounded-xl border border-slate-50 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/5">
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 font-bold text-dark dark:text-white">
                              {o.is_head_office ? (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-extrabold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                                  <Building2 className="size-3.5" /> Head Office
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-100 px-2 py-0.5 text-xs font-extrabold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                                  <Store className="size-3.5" /> {o.outlet_name}
                                </span>
                              )}
                              {o.count ? <span className="text-xs font-normal text-gray-400">({o.count} vouchers)</span> : null}
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold tabular-nums text-dark dark:text-white">{PKR(o.thisMonth)}</span>
                              <span className="ml-2 text-xs font-semibold text-gray-400">{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-dark-3">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${o.is_head_office ? "bg-purple-500" : "bg-teal-500"}`}
                              style={{ width: `${maxOutletAmount > 0 ? (o.thisMonth / maxOutletAmount) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={Store} title="No expense locations recorded for this month" />
                )}
              </div>

              {/* Top Categories Card */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10">
                    <Tags className="size-4" />
                  </div>
                  <h2 className="text-sm font-bold text-dark dark:text-white">Top Expense Categories ({activeMonthLabel})</h2>
                </div>

                {summary && summary.topCategories.length > 0 ? (
                  <div className="space-y-4">
                    {summary.topCategories.map((c) => {
                      const pct = summary.thisMonth > 0 ? (c.amount / summary.thisMonth) * 100 : 0;
                      return (
                        <div key={c.category} className="rounded-xl border border-slate-50 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/5">
                          <div className="mb-1.5 flex items-center justify-between text-sm">
                            <span className="font-bold text-dark dark:text-white">{c.category}</span>
                            <div className="text-right">
                              <span className="font-extrabold tabular-nums text-dark dark:text-white">{PKR(c.amount)}</span>
                              <span className="ml-2 text-xs font-semibold text-gray-400">{pct.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-dark-3">
                            <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${maxCategory > 0 ? (c.amount / maxCategory) * 100 : 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState icon={Tags} title="No expense categories recorded for this month" />
                )}
              </div>
            </div>
          )}

          {/* Traceable All Expense Vouchers Table (Full History & Deletion) */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between dark:border-white/10">
              <div>
                <h3 className="text-base font-black text-dark dark:text-white flex items-center gap-2">
                  <FileText className="size-5 text-[#ff3d3d]" /> Traceable Expense Vouchers History ({activeMonthLabel})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Track, filter by month/source/status, view invoices, or delete any voucher</p>
              </div>

              {/* Filters Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search voucher #, notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchAllExpenses(globalMonthFilter); }}
                    className="w-44 rounded-xl border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                  />
                </div>

                {/* Month Filter Dropdown in Toolbar */}
                <select
                  value={globalMonthFilter}
                  onChange={(e) => setGlobalMonthFilter(e.target.value)}
                  className="rounded-xl border border-stroke bg-white px-3 py-1.5 text-xs font-bold text-[#ff3d3d] outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  {summary?.availableMonths?.map((mKey) => (
                    <option key={mKey} value={mKey}>
                      {formatMonthLabel(mKey)}
                    </option>
                  ))}
                  <option value="all">All Months (All Time)</option>
                </select>

                {/* Source Filter Dropdown */}
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="rounded-xl border border-stroke bg-white px-3 py-1.5 text-xs font-semibold outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="all">All Locations (HO & Outlets)</option>
                  <option value="ho">Head Office Only</option>
                  {summary?.outletWise.filter(o => !o.is_head_office).map((o) => (
                    <option key={o.outlet_id} value={o.outlet_id?.toString()}>{o.outlet_name}</option>
                  ))}
                </select>

                {/* Status Filter Dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-stroke bg-white px-3 py-1.5 text-xs font-semibold outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending Approval</option>
                  <option value="rejected">Rejected</option>
                </select>

                <label className="flex items-center gap-1.5 rounded-xl border border-stroke px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-dark-3 dark:text-gray-300">
                  <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="size-3.5 accent-[#ff3d3d]" /> Show deleted
                </label>

                <button
                  onClick={() => { fetchAllExpenses(globalMonthFilter); fetchSummary(globalMonthFilter); }}
                  className="flex items-center gap-1.5 rounded-xl border border-stroke bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-dark-3 dark:bg-white/5 dark:text-gray-300"
                >
                  <RefreshCw className="size-3.5" /> Refresh
                </button>
              </div>
            </div>

            {allExpensesLoading ? (
              <TableSkeleton rows={6} cols={7} />
            ) : allExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Voucher # & Date</th>
                      <th className="px-5 py-3.5 font-bold">Source / Location</th>
                      <th className="px-5 py-3.5 font-bold">Category & Details</th>
                      <th className="px-5 py-3.5 font-bold">Payment Method</th>
                      <th className="px-5 py-3.5 text-right font-bold">Amount</th>
                      <th className="px-5 py-3.5 text-center font-bold">Status</th>
                      <th className="px-5 py-3.5 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {allExpenses.map((v) => (
                      <tr key={v.id} className={`transition hover:bg-slate-50/70 dark:hover:bg-white/5 ${deletedRowClass(v)}`}>
                        {/* Voucher # & Date */}
                        <td className="px-5 py-3.5">
                          <p className="font-extrabold text-dark dark:text-white">{v.voucher_number}<DeletedBadge row={v} /></p>
                          {v.deleted_at && <p className="text-[10px] text-gray-500">{v.deleted_by_name ? `by ${v.deleted_by_name}` : ""}{v.delete_reason ? ` — ${v.delete_reason}` : ""}</p>}
                          <p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString()}</p>
                        </td>

                        {/* Source / Location */}
                        <td className="px-5 py-3.5">
                          {v.is_head_office ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                              <Building2 className="size-3" /> Head Office
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-400">
                              <Store className="size-3" /> {v.source_name}
                            </span>
                          )}
                        </td>

                        {/* Category & Details */}
                        <td className="px-5 py-3.5">
                          <div className="space-y-1">
                            {v.items && v.items.length > 0 ? (
                              v.items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700 dark:bg-white/10 dark:text-gray-200">{it.category}</span>
                                  {it.description ? <span className="truncate max-w-[200px] text-gray-500 dark:text-gray-400">— {it.description}</span> : null}
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">{v.notes || "No breakdown"}</span>
                            )}
                          </div>
                        </td>

                        {/* Payment Method */}
                        <td className="px-5 py-3.5 font-medium text-xs text-gray-600 dark:text-gray-300">
                          {v.payment_method}
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-3.5 text-right tabular-nums font-black text-dark dark:text-white">
                          {PKR(v.total_amount)}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 text-center">
                          {v.status === "approved" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" /> Approved
                            </span>
                          ) : v.status === "rejected" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                              <XCircle className="size-3" /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                              <Clock className="size-3" /> Pending
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              ref={(el) => { invoiceInputRefs.current[v.id] = el; }}
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => handleInvoiceUpload(v.id, e)}
                            />

                            {v.invoice_url ? (
                              <a
                                href={`${BACKEND_URL}${v.invoice_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View Attached Invoice File"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 transition"
                              >
                                <FileText className="size-3.5" /> View Invoice
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled={uploadingInvoiceId === v.id}
                                onClick={() => invoiceInputRefs.current[v.id]?.click()}
                                title="Upload Invoice/Receipt file for this voucher"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 disabled:opacity-50 transition"
                              >
                                {uploadingInvoiceId === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                {uploadingInvoiceId === v.id ? "Uploading..." : "Upload Invoice"}
                              </button>
                            )}

                            {!v.deleted_at && <button
                              onClick={() => handleDeleteExpense(v.id, v.voucher_number, v.total_amount)}
                              disabled={deletingId === v.id}
                              title="Delete Expense Voucher"
                              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 p-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 disabled:opacity-50 transition"
                            >
                              {deletingId === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            </button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8">
                <EmptyState icon={FileText} title="No expense vouchers found" description={`No expense records match your selected month (${activeMonthLabel}) or location filters.`} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Expense Tab */}
      {tab === "create" && (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <form onSubmit={handleCreateExpense} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Expense Location / Source</label>
                <OutletSelector selectedId={form.outlet_id || "all"} onSelect={(id) => setForm({ ...form, outlet_id: id === "all" ? "" : id })} allLabel="Head Office (No Outlet)" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Payment Method</label>
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-dark dark:text-white">Expense Items</label>
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-[#ff3d3d]"><Plus className="size-3.5" /> Add Item</button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)} placeholder="Category (e.g. Utility, Tea, Rent)" className="w-44 rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                    <input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Description / Details" className="flex-1 rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                    <input type="number" value={item.amount} onChange={(e) => updateItem(i, "amount", e.target.value)} placeholder="Amount (PKR)" className="w-36 rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                    {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-rose-500"><Trash2 className="size-4" /></button>}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Notes / References</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional notes for this voucher..." className="w-full rounded-xl border border-stroke bg-white px-4 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-dark dark:text-white">Upload Invoice / Receipt Document (Optional)</label>
                <div className="rounded-xl border border-dashed border-stroke bg-slate-50/50 p-2 dark:border-dark-3 dark:bg-white/5">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setCreateFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ff3d3d]/10 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#ff3d3d] hover:file:bg-[#ff3d3d]/20 dark:text-gray-400 dark:file:bg-[#ff3d3d]/20 dark:file:text-white"
                  />
                  {createFile ? <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Selected: {createFile.name}</p> : null}
                </div>
              </div>
            </div>

            <button type="submit" disabled={creating} className="rounded-xl bg-[#ff3d3d] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {creating ? "Submitting..." : "Submit Expense Voucher"}
            </button>
          </form>
        </div>
      )}

      {/* Approvals Queue Tab */}
      {tab === "approvals" && (
        approvalsLoading ? <TableSkeleton /> : approvals.length > 0 ? (
          <div className="space-y-4">
            {approvals.map((v) => (
              <div key={v.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-dark dark:text-white flex items-center gap-2">
                      {v.voucher_number}
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-gray-300">
                        {v.outlet?.name ? <Store className="size-3 text-teal-600" /> : <Building2 className="size-3 text-purple-600" />}
                        {v.outlet?.name || "Head Office"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{new Date(v.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-xl font-black text-dark dark:text-white">{PKR(v.total_amount)}</p>
                </div>
                <div className="mb-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  {v.items.map((it, i) => (
                    <div key={i} className="flex justify-between border-b border-slate-50 py-1 last:border-0 dark:border-white/5">
                      <span>{it.category}{it.description ? ` — ${it.description}` : ""}</span>
                      <span className="tabular-nums font-semibold">{PKR(it.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => handleDecision(v.id, "approved")} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Check className="size-3.5" /> Approve & Post to Cash Register
                  </button>
                  <button onClick={() => handleDecision(v.id, "rejected")} className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400">
                    <X className="size-3.5" /> Reject
                  </button>

                  <input
                    ref={(el) => { invoiceInputRefs.current[v.id] = el; }}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleInvoiceUpload(v.id, e)}
                  />
                  {v.invoice_url ? (
                    <a href={`${BACKEND_URL}${v.invoice_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-white/5 dark:text-gray-300">
                      <ExternalLink className="size-3.5" /> View Invoice
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={uploadingInvoiceId === v.id}
                      onClick={() => invoiceInputRefs.current[v.id]?.click()}
                      className="flex items-center gap-1.5 rounded-lg bg-[#ff3d3d]/10 px-4 py-2 text-xs font-bold text-[#ff3d3d] hover:bg-[#ff3d3d]/20 disabled:opacity-50"
                    >
                      {uploadingInvoiceId === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      {uploadingInvoiceId === v.id ? "Uploading..." : "Upload Invoice"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteExpense(v.id, v.voucher_number, v.total_amount)}
                    className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <EmptyState icon={ClipboardCheck} title="No expenses pending approval" description="Head office and outlet expenses requiring approval will appear here." />
          </div>
        )
      )}

      {/* Salary Expenses Tab */}
      {tab === "salary" && (
        salaryLoading ? <TableSkeleton /> : (salaryMonths.length > 0 || salarySlips.length > 0) ? (
          <div className="space-y-6">
            {/* Top Table: Monthly Summary */}
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
                <h3 className="font-bold text-dark dark:text-white">Monthly Salary Summary</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total payroll expense aggregated per month (click a row to filter employee list)</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr>
                    <th className="px-5 py-3 font-bold">Month</th>
                    <th className="px-5 py-3 text-right font-bold">Employees</th>
                    <th className="px-5 py-3 text-right font-bold">Paid / Approved</th>
                    <th className="px-5 py-3 text-right font-bold">Pending</th>
                    <th className="px-5 py-3 text-right font-bold">Total Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryMonths.map((m) => (
                    <tr
                      key={m.month}
                      onClick={() => setSelectedMonthFilter(selectedMonthFilter === m.month ? "all" : m.month)}
                      className={`cursor-pointer border-t border-slate-50 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 ${selectedMonthFilter === m.month ? "bg-amber-50/50 dark:bg-amber-500/10" : ""}`}
                    >
                      <td className="px-5 py-3.5 font-bold text-dark dark:text-white flex items-center gap-2">
                        {m.month}
                        {selectedMonthFilter === m.month && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">Filtered</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{m.count}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-emerald-600">{PKR(m.paid)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-amber-600">{PKR(m.pending)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{PKR(m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Table: Individual Employee Breakdown */}
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <div>
                  <h3 className="font-bold text-dark dark:text-white">Employee Salary Breakdown</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Individual status per employee salary slip</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search employee or dept..."
                      value={salarySearch}
                      onChange={(e) => setSalarySearch(e.target.value)}
                      className="w-48 rounded-xl border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                    />
                  </div>

                  <select
                    value={selectedMonthFilter}
                    onChange={(e) => {
                      setSelectedMonthFilter(e.target.value);
                      setGlobalMonthFilter(e.target.value);
                    }}
                    className="rounded-xl border border-stroke bg-white px-3 py-1.5 text-xs font-bold text-[#ff3d3d] outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white cursor-pointer"
                  >
                    <option value="all">All Months (All Time)</option>
                    {(availableSalaryMonths.length > 0 ? availableSalaryMonths : salaryMonths.map((m) => m.month)).map((mKey) => (
                      <option key={mKey} value={mKey}>
                        {formatMonthLabel(mKey)} ({mKey})
                      </option>
                    ))}
                  </select>

                  <select
                    value={salaryStatusFilter}
                    onChange={(e) => setSalaryStatusFilter(e.target.value)}
                    className="rounded-xl border border-stroke bg-white px-3 py-1.5 text-xs font-medium outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="paid">Approved & Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              {salarySlips.filter((s) => {
                const monthKey = `${s.year}-${String(s.month).padStart(2, "0")}`;
                if (selectedMonthFilter !== "all" && monthKey !== selectedMonthFilter) return false;
                if (salaryStatusFilter !== "all" && s.status !== salaryStatusFilter) return false;
                if (salarySearch.trim()) {
                  const q = salarySearch.toLowerCase();
                  const nameMatch = s.employee_name?.toLowerCase().includes(q);
                  const deptMatch = s.department?.toLowerCase().includes(q);
                  if (!nameMatch && !deptMatch) return false;
                }
                return true;
              }).length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3 font-bold">Employee Name</th>
                      <th className="px-5 py-3 font-bold">Department</th>
                      <th className="px-5 py-3 font-bold">Month / Year</th>
                      <th className="px-5 py-3 text-right font-bold">Net Salary</th>
                      <th className="px-5 py-3 text-center font-bold">Status</th>
                      <th className="px-5 py-3 text-right font-bold">Paid Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salarySlips
                      .filter((s) => {
                        const monthKey = `${s.year}-${String(s.month).padStart(2, "0")}`;
                        if (selectedMonthFilter !== "all" && monthKey !== selectedMonthFilter) return false;
                        if (salaryStatusFilter !== "all" && s.status !== salaryStatusFilter) return false;
                        if (salarySearch.trim()) {
                          const q = salarySearch.toLowerCase();
                          const nameMatch = s.employee_name?.toLowerCase().includes(q);
                          const deptMatch = s.department?.toLowerCase().includes(q);
                          if (!nameMatch && !deptMatch) return false;
                        }
                        return true;
                      })
                      .map((s) => (
                        <tr key={s.id} className="border-t border-slate-50 dark:border-white/5">
                          <td className="px-5 py-3.5 font-bold text-dark dark:text-white">
                            {s.employee_name || "Unknown Employee"}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                            {s.department ? (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-gray-300">
                                {s.department}
                              </span>
                            ) : (
                              "N/A"
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {s.year}-{String(s.month).padStart(2, "0")}
                          </td>
                          <td className="px-5 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">
                            {PKR(s.net_payable)}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {s.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" /> Approved & Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                <Clock className="size-3" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right text-xs text-gray-500 dark:text-gray-400">
                            {s.paid_date ? new Date(s.paid_date).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6">
                  <EmptyState icon={Users2} title="No employee slips matching filter" description="Try selecting a different month or status filter." />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <EmptyState icon={Users2} title="No payroll data yet" description="Salary expenses are pulled from the HR module's payroll slips." />
          </div>
        )
      )}
    </>
  );
}
