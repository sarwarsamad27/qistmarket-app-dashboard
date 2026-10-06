"use client";

import DeletedBadge, { askDeleteReason, deletedRowClass } from "@/components/common/DeletedBadge";
import { useEffect, useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import {
    Plus, Search, Download, FileText,
    ChevronDown, ChevronRight, Wallet,
    CreditCard, AlertCircle, CheckCircle2,
    Calendar, Trash2, PieChart, TrendingUp,
    Receipt, Pencil, Filter
} from "lucide-react";
import Loader from "@/components/common/Loader";
import { formatExactDate } from "@/utils/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface ExpenseItem {
    id: number;
    category: string;
    amount: number;
    description?: string;
}

interface ExpenseVoucher {
    deleted_at?: string | null;
    deleted_by_name?: string | null;
    delete_reason?: string | null;
    id: number;
    voucher_number: string;
    total_amount: number;
    payment_method: string;
    date: string;
    notes?: string;
    items: ExpenseItem[];
    created_at: string;
}

const EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const isWithinEditWindow = (createdAt: string) => (Date.now() - new Date(createdAt).getTime()) <= EDIT_WINDOW_MS;

interface ExpenseSummary {
    today: number;
    thisMonth: number;
    topCategories: { category: string; amount: number }[];
}

export default function ExpensesPage() {
    const router = useRouter();
    const [vouchers, setVouchers] = useState<ExpenseVoucher[]>([]);
    const [summary, setSummary] = useState<ExpenseSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const [showDeleted, setShowDeleted] = useState(false);

    useEffect(() => {
        fetchData();
    }, [showDeleted]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vRes, sRes] = await Promise.all([
                fetch(`${API_BASE}/api/outlet/expenses${showDeleted ? "?includeDeleted=1" : ""}`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE}/api/outlet/expenses/summary`, { headers: getAuthHeaders() })
            ]);

            const vData = await vRes.json();
            const sData = await sRes.json();

            if (vData.success) setVouchers(vData.vouchers);
            if (sData.success) setSummary(sData.summary);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const handleDelete = async (id: number) => {
        const reason = askDeleteReason("this expense voucher");
        if (reason === null) return;
        setDeletingId(id);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/expenses/${id}?reason=${encodeURIComponent(reason)}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                // Soft delete: reload so it shows greyed (if "Show deleted" is on) or drops out.
                fetchData();
                // Refresh summary after delete
                const sRes = await fetch(`${API_BASE}/api/outlet/expenses/summary`, { headers: getAuthHeaders() });
                const sData = await sRes.json();
                if (sData.success) setSummary(sData.summary);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDeletingId(null);
        }
    };

    const filteredVouchers = useMemo(() => {
        let list = vouchers;

        if (dateRange !== "all") {
            const now = new Date();
            let start: Date;
            let end: Date | null = null;

            if (dateRange === "today") {
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (dateRange === "week") {
                start = new Date(now);
                start.setDate(start.getDate() - 7);
            } else if (dateRange === "month") {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
            } else {
                start = customStart ? new Date(customStart) : new Date(0);
                end = customEnd ? new Date(new Date(customEnd).setHours(23, 59, 59, 999)) : null;
            }

            list = list.filter(v => {
                const created = new Date(v.created_at);
                if (created < start) return false;
                if (end && created > end) return false;
                return true;
            });
        }

        return list.filter(v =>
            v.voucher_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.payment_method.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.items.some(item => item.category.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [vouchers, searchTerm, dateRange, customStart, customEnd]);

    if (loading) return <Loader text="Loading Outlet Expenses..." />;

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Outlet Expenses" />

            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                        <Receipt className="text-primary w-8 h-8" /> Expense Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium italic">Track and categorize all outlet operational costs</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push("/outlet/expenses/add")}
                        className="bg-primary hover:bg-opacity-90 text-white px-6 py-3 rounded-2xl text-sm font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                        <Plus size={20} strokeWidth={3} /> Record New Expense
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-boxdark p-5 rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Today's Total</span>
                    </div>
                    <div className="text-2xl font-black text-gray-800 dark:text-white">PKR {(summary?.today || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 mt-1 font-bold">Daily operational drain</div>
                </div>

                <div className="bg-white dark:bg-boxdark p-5 rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                            <Calendar size={24} />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">This Month</span>
                    </div>
                    <div className="text-2xl font-black text-violet-600 dark:text-violet-400">PKR {(summary?.thisMonth || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 mt-1 font-bold">Consolidated monthly spend</div>
                </div>

                <div className="col-span-1 lg:col-span-2 bg-white dark:bg-boxdark p-5 rounded-3xl border border-stroke dark:border-strokedark shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <PieChart size={20} />
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Top Expense Categories</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-1">
                        {summary?.topCategories.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">No category data yet</div>
                        ) : summary?.topCategories.map((c, i) => (
                            <div key={i} className="flex flex-col">
                                <div className="text-[10px] font-black text-gray-400 uppercase">{c.category}</div>
                                <div className="text-sm font-black text-gray-800 dark:text-white">PKR {c.amount.toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm overflow-hidden">
                <div className="p-5 border-b border-stroke dark:border-strokedark flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search vouchers, categories, or method..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm transition-all font-medium"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                                className="pl-10 pr-8 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm font-bold transition-all appearance-none"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">This Month</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} className="size-4 accent-primary" /> Show deleted
                        </label>
                        {dateRange === "custom" && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="px-3 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm font-bold transition-all"
                                />
                                <span className="text-gray-400 text-xs font-bold">to</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="px-3 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm font-bold transition-all"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-meta-4 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
                                <th className="p-5 w-12" />
                                <th className="p-5">Voucher # / Date</th>
                                <th className="p-5">Payment Method</th>
                                <th className="p-5">Total Amount</th>
                                <th className="p-5">Items</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVouchers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-24 text-center text-gray-400 opacity-60">
                                        <div className="bg-gray-50 dark:bg-meta-4 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Receipt size={40} className="text-gray-300" />
                                        </div>
                                        <div className="font-black uppercase tracking-widest text-xs">No expense vouchers found</div>
                                    </td>
                                </tr>
                            ) : filteredVouchers.map(v => {
                                const isExpanded = expandedIds.has(v.id);
                                return (
                                    <Fragment key={v.id}>
                                        <tr
                                            onClick={() => toggleExpand(v.id)}
                                            className={`group border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-all cursor-pointer ${isExpanded ? 'bg-primary/5 dark:bg-primary/10' : ''} ${deletedRowClass(v)}`}
                                        >
                                            <td className="p-5 text-center">
                                                {isExpanded ? <ChevronDown size={18} className="text-primary mx-auto" strokeWidth={3} /> : <ChevronRight size={18} className="text-gray-300 mx-auto group-hover:text-primary transition-colors" />}
                                            </td>
                                            <td className="p-5">
                                                <div className="font-black text-gray-800 dark:text-white uppercase tracking-tight text-base">{v.voucher_number}<DeletedBadge row={v} /></div>
                                                {v.deleted_at && <div className="text-[10px] text-gray-500 normal-case">{v.deleted_by_name ? `by ${v.deleted_by_name}` : ""}{v.delete_reason ? ` — ${v.delete_reason}` : ""}</div>}
                                                <div className="text-[10px] text-gray-500 mt-0.5 font-bold flex items-center gap-1.5 uppercase">
                                                    <Calendar size={10} /> {formatExactDate(v.created_at, 'DD MMM YYYY, hh:mm A')}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex items-center gap-2">
                                                    {v.payment_method === 'Cash' ? (
                                                        <Wallet size={14} className="text-orange-500" />
                                                    ) : (
                                                        <CreditCard size={14} className="text-blue-500" />
                                                    )}
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">{v.payment_method}</span>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="text-base font-black text-gray-900 dark:text-white">PKR {v.total_amount.toLocaleString()}</div>
                                            </td>
                                            <td className="p-5 text-gray-500 font-bold">
                                                {v.items.length} Category record{v.items.length !== 1 ? 's' : ''}
                                            </td>
                                            <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    {!v.deleted_at && isWithinEditWindow(v.created_at) && (
                                                        <>
                                                            <button
                                                                onClick={() => router.push(`/outlet/expenses/edit/${v.id}`)}
                                                                className="p-2.5 hover:bg-blue-50 text-blue-500 rounded-xl transition-all active:scale-95 border border-transparent hover:border-blue-100"
                                                            >
                                                                <Pencil size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(v.id)}
                                                                disabled={deletingId === v.id}
                                                                className="p-2.5 hover:bg-red-50 text-red-500 rounded-xl transition-all active:scale-95 disabled:opacity-50 border border-transparent hover:border-red-100"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* DETAIL ITEMS */}
                                        {isExpanded && (
                                            <tr className="bg-gray-50/30 dark:bg-meta-4/10">
                                                <td colSpan={6} className="p-0 border-b border-stroke dark:border-strokedark">
                                                    <div className="px-16 py-8 animate-fade-in">
                                                        <div className="mb-6 flex items-center justify-between">
                                                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                <FileText size={14} className="text-primary" /> Multi-Line Breakdown
                                                            </div>
                                                            {v.notes && (
                                                                <div className="px-4 py-2 rounded-2xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-xs text-gray-500 italic shadow-sm">
                                                                    "{v.notes}"
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="overflow-hidden rounded-3xl border border-stroke dark:border-strokedark bg-white dark:bg-boxdark shadow-sm">
                                                            <table className="w-full text-xs">
                                                                <thead>
                                                                    <tr className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark text-gray-500">
                                                                        <th className="p-4 w-12 text-center">#</th>
                                                                        <th className="p-4">Category</th>
                                                                        <th className="p-4">Description / Purpose</th>
                                                                        <th className="p-4 text-right">Amount (PKR)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                                    {v.items.map((item, idx) => (
                                                                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-meta-4/20 transition-colors">
                                                                            <td className="p-4 text-center text-gray-400 font-mono font-bold">{idx + 1}</td>
                                                                            <td className="p-4">
                                                                                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                                                                                    {item.category}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-4 text-gray-600 dark:text-gray-400 font-medium">
                                                                                {item.description || 'No detailed memo provided'}
                                                                            </td>
                                                                            <td className="p-4 text-right font-black text-gray-900 dark:text-white">
                                                                                {item.amount.toLocaleString()}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                                <tfoot>
                                                                    <tr className="bg-gray-50/50 dark:bg-meta-4/30 font-black">
                                                                        <td colSpan={3} className="p-4 text-right uppercase text-gray-400 tracking-[0.2em] text-[10px]">Total Voucher Value</td>
                                                                        <td className="p-4 text-right text-base text-gray-900 dark:text-white">PKR {v.total_amount.toLocaleString()}</td>
                                                                    </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
