"use client";

import { useEffect, useState, useMemo } from "react";
import Cookies from "js-cookie";
import {
    Search, RefreshCw, User, Calendar, Package, DollarSign, ArrowLeft, Filter, Download
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

type CashEntry = {
    id: number;
    amount: number;
    status: string;
    created_at: string;
    payment_method: string;
    cash_type: string;
    officer: {
        full_name: string;
        username: string;
        phone: string;
        image: string | null;
    };
    order: {
        order_ref: string;
        delivery?: {
            selected_plan: any;
        }
    };
};

export default function CashHistoryPage() {
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalVerifiedAmount, setTotalVerifiedAmount] = useState(0);
    const [totalRecordsCount, setTotalRecordsCount] = useState(0);

    useEffect(() => {
        fetchHistory();
    }, [page]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/api/outlet/cash-history`;
            const params = new URLSearchParams();
            if (dateFrom) params.append("date_from", dateFrom);
            if (dateTo) params.append("date_to", dateTo);
            params.append("page", page.toString());
            params.append("limit", "10");

            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setEntries(data.data);
                setTotalVerifiedAmount(data.totalAmount || 0);
                if (data.pagination) {
                    setTotalPages(data.pagination.pages);
                    setTotalRecordsCount(data.pagination.total);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, "Failed to fetch collection history"));
        } finally {
            setLoading(false);
        }
    };

    const filteredEntries = useMemo(() => {
        return entries.filter(e =>
            e.officer?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            e.order?.order_ref?.toLowerCase().includes(search.toLowerCase()) ||
            e.cash_type?.toLowerCase().includes(search.toLowerCase()) ||
            e.payment_method?.toLowerCase().includes(search.toLowerCase())
        );
    }, [entries, search]);

    const totalCollected = useMemo(() => {
        return filteredEntries.reduce((sum, e) => sum + e.amount, 0);
    }, [filteredEntries]);

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
                <Link href="/outlet/cash-in-hand" className="text-gray-500 hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
                    <ArrowLeft size={16} /> Back to Pending
                </Link>
            </div>

            <Breadcrumb pageName="Collection History" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Calendar size={24} className="text-primary" /> Collection History
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        View all verified cash collections received by this outlet.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => toast.success("Feature coming soon: Export to CSV")}
                        className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <Download size={16} /> Export
                    </button>
                    <button
                        onClick={fetchHistory}
                        className="bg-primary hover:bg-opacity-90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-opacity flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-boxdark rounded-xl shadow-sm border border-stroke dark:border-strokedark p-5 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Officer, Order Ref, Type..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-form-input border border-stroke dark:border-strokedark rounded-lg text-sm focus:border-primary outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-form-input border border-stroke dark:border-strokedark rounded-lg text-sm focus:border-primary outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-form-input border border-stroke dark:border-strokedark rounded-lg text-sm focus:border-primary outline-none"
                        />
                    </div>

                    <button
                        onClick={() => { setPage(1); fetchHistory(); }}
                        className="bg-gray-100 dark:bg-meta-4 hover:bg-gray-200 dark:hover:bg-opacity-80 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-gray-200 dark:border-strokedark"
                    >
                        <Filter size={16} /> Apply Filters
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-boxdark p-5 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Verified</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-black text-primary">PKR {totalVerifiedAmount.toLocaleString()}</p>
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-boxdark p-5 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Collections</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-black text-gray-800 dark:text-white">{totalRecordsCount.toLocaleString()}</p>
                        <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600">
                            <RefreshCw size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-boxdark rounded-2xl shadow-sm border border-stroke dark:border-strokedark overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark">
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Date & Time</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Officer</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Cash Type</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stroke dark:divide-strokedark">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                                        <p className="text-gray-500 text-sm">Loading history...</p>
                                    </td>
                                </tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center text-gray-500">
                                        No history found for the selected criteria.
                                    </td>
                                </tr>
                            ) : filteredEntries.map((entry) => (
                                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-meta-4/10 transition-colors group">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                            {formatExactDate(entry.created_at, 'MMM DD, YYYY')}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium">
                                            {formatExactDate(entry.created_at, 'h:mm A')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {entry.officer?.image ? (
                                                <img src={entry.officer.image} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-700" />
                                            ) : (
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white ring-2 ring-white dark:ring-gray-700">
                                                    {(entry.officer?.full_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{entry.officer?.full_name || 'Unknown'}</p>
                                                <p className="text-[10px] text-gray-500">@{entry.officer?.username || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="min-w-[150px]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <DollarSign size={14} className="text-primary" />
                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{entry.cash_type || 'Advance amount payment'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-sm font-black text-primary whitespace-nowrap">PKR {entry.amount.toLocaleString()}</p>
                                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{entry.payment_method || 'Cash'}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1.5 bg-green-50 dark:bg-green-900/10 py-1 px-2 rounded-lg border border-green-100 dark:border-green-900/20">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                            <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">{entry.status}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-center items-center gap-4 mt-6">
                <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-4 py-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                    Previous
                </button>
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
                <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-4 py-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
