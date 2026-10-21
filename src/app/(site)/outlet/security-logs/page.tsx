"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import {
    ShieldCheck,
    Search,
    User,
    Calendar,
    Filter,
    ChevronLeft,
    ChevronRight,
    Activity,
    CreditCard,
    Package,
    AlertCircle,
    Info,
    ExternalLink
} from "lucide-react";
import axios from "axios";
import Cookies from "js-cookie";
import { formatExactDate } from "@/utils/dateUtils";

interface LogEntry {
    id: number;
    action: string;
    details: string;
    target_id: number | null;
    target_type: string | null;
    created_at: string;
    user_name: string;
    user: {
        username: string;
        full_name: string;
        image: string | null;
    };
}

const ACTION_TYPES = [
    { label: "All Actions", value: "" },
    { label: "Stock Addition", value: "STOCK_ADDITION" },
    { label: "Order Created", value: "ORDER_CREATION" },
    { label: "Order Cancelled", value: "ORDER_CANCELLATION" },
    { label: "Order Updated", value: "ORDER_UPDATE" },
    { label: "Installment Collected", value: "INSTALLMENT_COLLECTION" },
    { label: "Expense Entry", value: "EXPENSE_ENTRY" },
    { label: "Expense Deleted", value: "EXPENSE_DELETION" },
    { label: "Vendor Purchase", value: "VENDOR_PURCHASE" },
    { label: "Vendor Payment", value: "VENDOR_PAYMENT" },
];

export default function SecurityLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);

    // Filters
    const [actionFilter, setActionFilter] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    const fetchLogs = async () => {
        const token = Cookies.get("auth_token");
        if (!token) return;

        setLoading(true);
        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/security-logs`, {
                params: {
                    page,
                    limit: 15,
                    action: actionFilter,
                },
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setLogs(response.data.logs);
                setTotalPages(response.data.pagination.totalPages);
                setTotalLogs(response.data.pagination.total);
            }
        } catch (error) {
            console.error("Fetch Logs Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, actionFilter]);

    const getActionBadge = (action: string) => {
        const styles: any = {
            STOCK_ADDITION: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400",
            ORDER_CREATION: "bg-green-50 text-green-600 border-green-100 dark:bg-green-500/10 dark:text-green-400",
            ORDER_CANCELLATION: "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400",
            INSTALLMENT_COLLECTION: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400",
            EXPENSE_ENTRY: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400",
            VENDOR_PURCHASE: "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400",
        };

        const style = styles[action] || "bg-gray-50 text-gray-600 border-gray-100 dark:bg-white/5 dark:text-gray-400";
        return (
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${style}`}>
                {action.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Security Audit Logs" />

            {/* Header Stats & Info */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-boxdark p-6 rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">System Status</p>
                        <h4 className="text-xl font-black text-gray-800 dark:text-white">Active Logs</h4>
                    </div>
                </div>

                <div className="bg-white dark:bg-boxdark p-6 rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-meta-3/5 flex items-center justify-center text-meta-3">
                        <Activity size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Total Records</p>
                        <h4 className="text-xl font-black text-gray-800 dark:text-white">{totalLogs} Entries</h4>
                    </div>
                </div>

                <div className="bg-white dark:bg-boxdark p-6 rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-meta-6/5 flex items-center justify-center text-meta-6">
                        <Calendar size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Retention Policy</p>
                        <h4 className="text-xl font-black text-gray-800 dark:text-white">Permanent</h4>
                    </div>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white dark:bg-boxdark p-6 rounded-[2.5rem] border border-stroke dark:border-strokedark shadow-sm mb-8">
                <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 min-w-[200px] lg:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by details..."
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark rounded-2xl text-sm focus:border-primary outline-none transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="px-5 py-3.5 bg-gray-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark rounded-2xl text-sm outline-none w-full lg:w-60 font-medium"
                            value={actionFilter}
                            onChange={(e) => {
                                setActionFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            {ACTION_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={() => fetchLogs()} className="p-3.5 bg-primary text-white rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20">
                            <Activity size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-boxdark rounded-[2.5rem] border border-stroke dark:border-strokedark shadow-xl overflow-hidden mb-10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-meta-4/10">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">S.No</th><th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Timestamp</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Action Type</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Performed By</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Activity Details</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stroke dark:divide-strokedark">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-8 py-6 h-16 bg-gray-50/50 dark:bg-meta-4/5" />
                                    </tr>
                                ))
                            ) : logs.length > 0 ? (
                                logs.map((log, idx) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-meta-4/10 transition-colors group"><td className="px-8 py-6 text-gray-500 tabular-nums">{(page - 1) * 15 + idx + 1}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatExactDate(log.created_at, 'hh:mm A')}</span>
                                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-tighter">{formatExactDate(log.created_at, 'DD MMM YYYY')}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary/5 flex items-center justify-center border border-stroke dark:border-strokedark shadow-sm">
                                                    {log.user?.image ? <img src={log.user.image} className="w-full h-full object-cover" /> : <User size={18} className="text-primary" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-none mb-1">{log.user?.full_name || log.user_name}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">@{log.user?.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 max-w-md">
                                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium capitalize">
                                                {log.details}
                                            </p>
                                        </td>
                                        <td className="px-8 py-6">
                                            {log.target_id && (
                                                <button className="p-2 text-gray-400 hover:text-primary transition-colors">
                                                    <ExternalLink size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-meta-4/20 flex items-center justify-center text-gray-300">
                                                <Info size={40} />
                                            </div>
                                            <p className="text-sm font-bold text-gray-400">No logs found for the selected filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 border-t border-stroke dark:border-strokedark flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Showing <span className="text-primary">{logs.length}</span> of <span className="text-gray-800 dark:text-white">{totalLogs}</span> entries
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2.5 rounded-xl border border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 disabled:opacity-30 transition-all font-bold"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-xs font-black uppercase tracking-widest w-20 text-center">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2.5 rounded-xl border border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 disabled:opacity-30 transition-all"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Security Advisory */}
            <div className="bg-amber-50/50 dark:bg-amber-500/5 p-8 rounded-[2rem] border border-amber-100 dark:border-amber-500/10 flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 shrink-0 rounded-2xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <AlertCircle size={32} />
                </div>
                <div>
                    <h4 className="text-lg font-black text-amber-900 dark:text-amber-400 tracking-tight mb-1 uppercase text-sm">Integrity Advisory</h4>
                    <p className="text-sm text-amber-700/80 dark:text-amber-500/60 leading-relaxed font-medium">
                        Security logs are immutable and cannot be altered or deleted. They serve as a permanent record of all administrative actions for audit and compliance purposes.
                        Unauthorized access to sensitive logs is strictly prohibited.
                    </p>
                </div>
            </div>
        </div>
    );
}
