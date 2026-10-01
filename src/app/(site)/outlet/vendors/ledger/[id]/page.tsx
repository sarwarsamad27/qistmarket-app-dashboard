"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { 
    ArrowLeft, Printer, Download, Search, 
    TrendingDown, TrendingUp, Building2, 
    Calendar, FileText, Wallet, ArrowUpRight, ArrowDownLeft 
} from "lucide-react";
import Loader from "@/components/common/Loader";
import toast from "react-hot-toast";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

export default function VendorLedgerPage() {
    const { id } = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [vendor, setVendor] = useState<any>(null);
    const [ledger, setLedger] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        type: "out", // 'in' or 'out'
        amount: "",
        notes: ""
    });
    const [submittingPayment, setSubmittingPayment] = useState(false);

    const fetchLedger = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/ledger/${id}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setVendor(data.vendor);
                setLedger(data.ledger);
            } else {
                toast.error(data.message || "Failed to load ledger");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Network error"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchLedger();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingPayment(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/${id}/transaction`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(paymentForm)
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setIsPaymentModalOpen(false);
                setPaymentForm({ type: "out", amount: "", notes: "" });
                fetchLedger(); // Refresh ledger
            } else {
                toast.error(data.message || "Failed to record payment");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Network error"));
        } finally {
            setSubmittingPayment(false);
        }
    };

    const filteredLedger = ledger.filter(entry => 
        entry.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <Loader text="Loading account ledger..." />;
    if (!vendor) return <div className="p-20 text-center">Vendor not found</div>;

    const stats = {
        totalPurchases: ledger.filter(e => e.type === 'Purchase').reduce((sum, e) => sum + e.debit, 0),
        totalPayments: ledger.filter(e => e.type === 'Payment').reduce((sum, e) => sum + e.credit, 0),
        currentBalance: vendor.balance
    };

    return (
        <div className="mx-auto max-w-7xl print:pt-0 pb-20">
            <div className="print:hidden">
                <Breadcrumb pageName="Vendor Ledger" />
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()} 
                        className="p-3 rounded-2xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark hover:bg-gray-50 transition-all print:hidden"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                            {vendor.name} 
                            <span className="text-xs font-black px-3 py-1 bg-gray-100 dark:bg-meta-4 rounded-full text-gray-400 uppercase tracking-widest print:hidden">
                                Account Ledger
                            </span>
                        </h1>
                        <p className="text-sm text-gray-400 mt-1 font-bold flex items-center gap-2">
                             <Calendar size={14} /> Full transaction history and account balance tracker
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 print:hidden">
                    <button 
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="px-6 py-2.5 rounded-xl text-sm font-black bg-blue-600 text-white hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-lg"
                    >
                        <Wallet size={18} /> Record Payment
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="px-6 py-2.5 rounded-xl text-sm font-black bg-white dark:bg-boxdark border border-stroke dark:border-strokedark hover:bg-gray-50 transition-all flex items-center gap-2"
                    >
                        <Printer size={18} /> Print
                    </button>
                    <button 
                        className="px-6 py-2.5 rounded-xl text-sm font-black bg-primary text-white hover:bg-opacity-90 transition-all flex items-center gap-2 shadow-lg"
                    >
                        <Download size={18} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-boxdark p-6 rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center gap-3 text-gray-400 mb-2">
                        <TrendingDown size={18} className="text-red-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Total Purchases</span>
                    </div>
                    <div className="text-2xl font-black tabular-nums">PKR {stats.totalPurchases.toLocaleString()}</div>
                </div>
                <div className="bg-white dark:bg-boxdark p-6 rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center gap-3 text-gray-400 mb-2">
                        <TrendingUp size={18} className="text-green-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Total Payments</span>
                    </div>
                    <div className="text-2xl font-black tabular-nums">PKR {stats.totalPayments.toLocaleString()}</div>
                </div>
                <div className="bg-primary p-6 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                    <Wallet size={80} className="absolute -right-5 -bottom-5 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex items-center gap-3 text-white/60 mb-2">
                        <Building2 size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Payable Balance</span>
                    </div>
                    <div className="text-2xl font-black tabular-nums">PKR {stats.currentBalance.toLocaleString()}</div>
                </div>
            </div>

            {/* Search */}
            <div className="mb-6 relative print:hidden">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search ledger by reference or notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark outline-none focus:border-primary shadow-sm font-bold text-sm"
                />
            </div>

            {/* Ledger Table */}
            <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-meta-4 text-[10px] uppercase font-black tracking-widest text-gray-400">
                                <th className="p-5 border-b border-stroke dark:border-strokedark">Date</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark">Type</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark">Reference</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark">Due Date</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark text-right">Debit (+)</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark text-right">Credit (-)</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark text-right">Balance</th>
                                <th className="p-5 border-b border-stroke dark:border-strokedark print:hidden">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stroke dark:divide-strokedark text-sm">
                            {filteredLedger.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-gray-400 font-bold">No transactions found for this period.</td>
                                </tr>
                            ) : (
                                filteredLedger.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-all group">
                                        <td className="p-5 font-bold text-gray-500 whitespace-nowrap">
                                            {formatExactDate(entry.date, 'MMM DD, YYYY')}
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                (entry.type === 'Purchase' || entry.type === 'Payment In')
                                                    ? 'bg-red-100/50 text-red-600' 
                                                    : 'bg-green-100/50 text-green-600'
                                            }`}>
                                                {entry.type === 'Purchase' && <><ArrowUpRight size={10} className="inline mr-1" /> Procurement</>}
                                                {entry.type === 'Payment In' && <><TrendingUp size={10} className="inline mr-1" /> Payment In</>}
                                                {entry.type === 'Payment Out' && <><TrendingDown size={10} className="inline mr-1" /> Payment Out</>}
                                                {entry.type === 'Payment' && <><ArrowDownLeft size={10} className="inline mr-1" /> Settlement</>}
                                                {entry.type === 'Return' && <><ArrowDownLeft size={10} className="inline mr-1" /> Return</>}
                                            </span>
                                        </td>
                                        <td className="p-5 font-mono font-black text-gray-400">{entry.reference}</td>
                                        <td className="p-5">
                                            {entry.due_date ? (
                                                <div className={`text-xs font-bold ${new Date(entry.due_date) < new Date() && entry.running_balance > 0 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                                                    {formatExactDate(entry.due_date, 'MMM DD, YYYY')}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="p-5 text-right font-black tabular-nums text-red-500">
                                            {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                                        </td>
                                        <td className="p-5 text-right font-black tabular-nums text-green-500">
                                            {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                                        </td>
                                        <td className="p-5 text-right font-black tabular-nums text-gray-800 dark:text-white">
                                            {entry.running_balance.toLocaleString()}
                                        </td>
                                        <td className="p-5 text-gray-400 italic text-xs print:hidden max-w-xs">{entry.notes || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="bg-gray-50 dark:bg-meta-4/20 p-6 flex items-center justify-between">
                    <p className="text-xs text-gray-400 font-bold">End of ledger report for QM Vendor ID: {vendor.id}</p>
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Final Closing Balance</div>
                        <div className="text-xl font-black text-primary">PKR {vendor.balance.toLocaleString()}</div>
                    </div>
                </div>
            </div>
            
            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-boxdark w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-stroke dark:border-strokedark animate-fade-in-up">
                        <div className="p-6 border-b border-stroke dark:border-strokedark flex items-center justify-between bg-gray-50 dark:bg-meta-4/20">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                                    <Wallet size={20} className="text-primary" /> Record Payment
                                </h3>
                                <p className="text-xs text-gray-400 font-bold mt-1">Add a generic payment in/out transaction</p>
                            </div>
                            <button 
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-meta-4 text-gray-500 hover:text-red-500 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Payment Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${paymentForm.type === 'out' ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : 'border-gray-200 dark:border-strokedark hover:border-gray-300'}`}>
                                        <input type="radio" name="type" className="sr-only" checked={paymentForm.type === 'out'} onChange={() => setPaymentForm({...paymentForm, type: 'out'})} />
                                        <TrendingDown size={24} className={paymentForm.type === 'out' ? 'text-red-500' : 'text-gray-400'} />
                                        <span className={`text-sm font-bold ${paymentForm.type === 'out' ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>Payment Out (To Vendor)</span>
                                    </label>
                                    <label className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${paymentForm.type === 'in' ? 'border-green-500 bg-green-50 dark:bg-green-500/10' : 'border-gray-200 dark:border-strokedark hover:border-gray-300'}`}>
                                        <input type="radio" name="type" className="sr-only" checked={paymentForm.type === 'in'} onChange={() => setPaymentForm({...paymentForm, type: 'in'})} />
                                        <TrendingUp size={24} className={paymentForm.type === 'in' ? 'text-green-500' : 'text-gray-400'} />
                                        <span className={`text-sm font-bold ${paymentForm.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>Payment In (From Vendor)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Amount (PKR)</label>
                                <input 
                                    type="number" 
                                    required
                                    min="1"
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-meta-4 border-none text-gray-800 dark:text-white rounded-xl p-4 font-bold focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="e.g. 50000"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description / Notes</label>
                                <textarea 
                                    rows={3}
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                                    className="w-full bg-gray-50 dark:bg-meta-4 border-none text-gray-800 dark:text-white rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none resize-none"
                                    placeholder="Reference # or reason for payment..."
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={submittingPayment}
                                className="w-full py-4 rounded-xl bg-primary text-white font-black text-sm hover:bg-opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-primary/20 mt-4"
                            >
                                {submittingPayment ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'Confirm Transaction'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @media print {
                    .print\\:hidden, 
                    aside, 
                    header, 
                    .breadcrumb,
                    button,
                    input {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .mx-auto {
                        max-width: 100% !important;
                        width: 100% !important;
                    }
                    .bg-white, .bg-gray-50 {
                        background: transparent !important;
                        border-color: #eee !important;
                    }
                    .rounded-3xl, .rounded-2xl {
                        border-radius: 0 !important;
                    }
                    .shadow-sm, .shadow-xl {
                        shadow: none !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
