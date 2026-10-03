"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { formatExactDate } from "@/utils/dateUtils";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { 
    Plus, Search, Download, Upload, Printer, Trash2, 
    ChevronDown, ChevronRight, FileText, ShoppingCart, 
    CreditCard, AlertCircle, CheckCircle2, History, X,
    Filter, Settings, CheckSquare, Square, Edit, Clock,
    RotateCcw, MessageSquare, Calculator
} from "lucide-react";
import * as XLSX from "xlsx";
import Loader from "@/components/common/Loader";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface PurchaseItem {
    id: number;
    product_name: string;
    category?: string;
    color_variant?: string;
    imei_serial?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}

interface Purchase {
    id: number;
    invoice_number: string;
    vendor_id?: number;
    vendor?: { id: number; name: string };
    vendor_name: string;
    total_amount: number;
    paid_amount: number;
    balance: number;
    status: string;
    purchase_date: string;
    due_date?: string;
    notes?: string;
    items: PurchaseItem[];
    returns?: any[];
}

export default function VendorPurchasesPage() {
    const router = useRouter();
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [view, setView] = useState<'purchases' | 'returns'>('purchases');

    // Return Modal State
    const [returnModalPurchase, setReturnModalPurchase] = useState<Purchase | null>(null);
    const [returnItems, setReturnItems] = useState<{item_id: number, qty: number, reason: string}[]>([]);
    const [returnNotes, setReturnNotes] = useState("");
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
    
    // Returns List State
    const [returns, setReturns] = useState<any[]>([]);
    const [loadingReturns, setLoadingReturns] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<any | null>(null);

    // Advanced Export State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportOptions, setExportOptions] = useState({
        includeItems: true,
        selectedVendors: [] as string[]
    });

    const [historyModalPurchaseId, setHistoryModalPurchaseId] = useState<number | null>(null);
    const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => { 
        if (view === 'purchases') fetchPurchases(); 
        else fetchReturns();
    }, [view]);

    const fetchReturns = async () => {
        setLoadingReturns(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/returns`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setReturns(data.returns);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingReturns(false);
        }
    };

    const fetchPurchases = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/purchases`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setPurchases(data.purchases);
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

    const requestDelete = (id: number) => {
        setConfirmDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!confirmDeleteId) return;
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        setDeletingId(id);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/purchases/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setPurchases(prev => prev.filter(p => p.id !== id));
                toast.success(data.message || "Purchase deleted successfully.");
            } else {
                toast.error(data.message || "Failed to delete purchase.");
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "An error occurred while deleting the purchase."));
        } finally {
            setDeletingId(null);
        }
    };

    const handleReturnSubmit = async () => {
        if (!returnModalPurchase) return;
        
        const itemsToReturn = returnItems.filter(ri => ri.qty > 0).map(ri => {
            const originalItem = returnModalPurchase.items.find(i => i.id === ri.item_id);
            return {
                purchase_item_id: ri.item_id,
                product_name: originalItem?.product_name,
                category: originalItem?.category,
                color_variant: originalItem?.color_variant,
                imei_serial: originalItem?.imei_serial,
                quantity: ri.qty,
                unit_price: originalItem?.unit_price,
                reason: ri.reason
            };
        });

        if (itemsToReturn.length === 0) {
            toast.error("Please select at least one item to return.");
            return;
        }

        setIsSubmittingReturn(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/returns`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    purchase_id: returnModalPurchase.id,
                    vendor_id: (returnModalPurchase as any).vendor_id || (returnModalPurchase as any).vendor?.id,
                    notes: returnNotes,
                    items: itemsToReturn
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Return recorded successfully.");
                setReturnModalPurchase(null);
                fetchPurchases();
            } else {
                toast.error(data.message || "Failed to record return.");
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "Error submitting return."));
        } finally {
            setIsSubmittingReturn(false);
        }
    };

    const fetchPurchaseHistory = async (id: number) => {
        setHistoryModalPurchaseId(id);
        setLoadingHistory(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/purchases/${id}/history`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                setPurchaseHistory(data.history);
            } else {
                toast.error("Failed to load history");
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "Error loading history"));
        } finally {
            setLoadingHistory(false);
        }
    };

    const filteredPurchases = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return purchases;
        return purchases.filter(p =>
            p.vendor_name.toLowerCase().includes(term) ||
            p.invoice_number.toLowerCase().includes(term) ||
            p.items?.some(item =>
                (item.imei_serial && item.imei_serial.toLowerCase().includes(term)) ||
                (item.product_name && item.product_name.toLowerCase().includes(term))
            )
        );
    }, [purchases, searchTerm]);

    const uniqueVendors = useMemo(() => {
        return Array.from(new Set(purchases.map(p => p.vendor_name))).sort();
    }, [purchases]);

    const stats = useMemo(() => {
        const totalPurchased = purchases.reduce((s, p) => s + p.total_amount, 0);
        const totalPaid = purchases.reduce((s, p) => s + p.paid_amount, 0);
        const totalBalance = purchases.reduce((s, p) => s + p.balance, 0);
        return { totalPurchased, totalPaid, totalBalance };
    }, [purchases]);

    const handleAdvancedExport = () => {
        let dataToExport: any[] = [];
        
        // Filter by selected vendors
        const baseFiltered = filteredPurchases.filter(p => 
            exportOptions.selectedVendors.length === 0 || exportOptions.selectedVendors.includes(p.vendor_name)
        );

        if (exportOptions.includeItems) {
            // Detailed Export (with Item Details)
            baseFiltered.forEach(p => {
                p.items.forEach(item => {
                    dataToExport.push({
                        "Invoice #": p.invoice_number,
                        "Date": new Date(p.purchase_date).toLocaleDateString(),
                        "Vendor": p.vendor_name,
                        "Product": item.product_name,
                        "Category": item.category || "N/A",
                        "Variant": item.color_variant || "N/A",
                        "IMEI/Serial": item.imei_serial || "Batch",
                        "Qty": item.quantity,
                        "Unit Price": item.unit_price,
                        "Subtotal": item.total_price,
                        "Invoice Status": p.status
                    });
                });
            });
        } else {
            // Summary Export (Invoice only)
            dataToExport = baseFiltered.map(p => ({
                "Invoice #": p.invoice_number,
                "Date": new Date(p.purchase_date).toLocaleDateString(),
                "Vendor": p.vendor_name,
                "Billed Amount": p.total_amount,
                "Paid Amount": p.paid_amount,
                "Balance Due": p.balance,
                "Status": p.status,
                "Notes": p.notes || ""
            }));
        }

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, exportOptions.includeItems ? "Detailed_Report" : "Summary_Report");
        XLSX.writeFile(workbook, `Procurement_${exportOptions.includeItems ? 'Detailed' : 'Summary'}_${new Date().toISOString().split('T')[0]}.xlsx`);
        setShowExportModal(false);
    };

    const handlePrintNewTab = (id: number) => {
        window.open(`/outlet/vendors/purchases/invoice/${id}`, '_blank');
    };

    if (loading) return <Loader text="Loading Vendor Purchases..." />;

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName={view === 'purchases' ? "Vendor Purchases" : "Purchase Returns"} />

            {/* Tab Navigation */}
            <div className="mb-6 flex p-1.5 bg-gray-100 dark:bg-meta-4 rounded-2xl w-fit">
                <button 
                    onClick={() => setView('purchases')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${view === 'purchases' ? 'bg-white dark:bg-boxdark text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Purchases
                </button>
                <button 
                    onClick={() => setView('returns')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${view === 'returns' ? 'bg-white dark:bg-boxdark text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Returns History
                </button>
            </div>

            {/* Header Section */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ShoppingCart className="text-primary" /> Vendor Purchase Inventory
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage vendor procurement and purchase history</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => router.push("/outlet/vendors/purchases/add")}
                        className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                        <Upload size={16} /> Import Items
                    </button>
                    <button 
                        onClick={() => setShowExportModal(true)}
                        className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
                    >
                        <Download size={16} /> Advanced Export
                    </button>
                    <button 
                        onClick={() => router.push("/outlet/vendors/purchases/add")}
                        className="bg-primary hover:bg-opacity-90 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
                    >
                        <Plus size={18} /> New Purchase
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-boxdark p-5 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <ShoppingCart size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Purchases</span>
                    </div>
                    <div className="text-2xl font-black text-gray-800 dark:text-white">PKR {stats.totalPurchased.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Lifetime procurement value</div>
                </div>

                <div className="bg-white dark:bg-boxdark p-5 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400">
                            <CheckCircle2 size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paid Amount</span>
                    </div>
                    <div className="text-2xl font-black text-green-600 dark:text-green-400">PKR {stats.totalPaid.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Total payments processed</div>
                </div>

                <div className="bg-white dark:bg-boxdark p-5 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400">
                            <AlertCircle size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance Due</span>
                    </div>
                    <div className="text-2xl font-black text-red-600 dark:text-red-400">PKR {stats.totalBalance.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500 mt-1">Outstanding vendor liability</div>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white dark:bg-boxdark rounded-2xl border border-stroke dark:border-strokedark shadow-sm overflow-hidden">
                <div className="p-4 border-b border-stroke dark:border-strokedark flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by vendor, invoice, product or IMEI/serial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark focus:border-primary outline-none text-sm transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {view === 'purchases' ? (
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-meta-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="p-4 w-10" />
                                    <th className="p-4">Invoice / Date</th>
                                    <th className="p-4">Vendor</th>
                                    <th className="p-4">Due Date</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Paid</th>
                                    <th className="p-4">Balance</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPurchases.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-20 text-center text-gray-400 opacity-60">
                                            <ShoppingCart size={48} className="mx-auto mb-4" />
                                            <div className="font-medium">No purchase records found</div>
                                        </td>
                                    </tr>
                                ) : filteredPurchases.map(p => {
                                    const isExpanded = expandedIds.has(p.id);
                                    return (
                                        <Fragment key={p.id}>
                                            <tr 
                                                onClick={() => toggleExpand(p.id)}
                                                className={`group border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                            >
                                                <td className="p-4 text-center">
                                                    {isExpanded ? <ChevronDown size={16} className="text-primary mx-auto" /> : <ChevronRight size={16} className="text-gray-400 mx-auto" />}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-800 dark:text-white uppercase tracking-tight">{p.invoice_number}</div>
                                                    <div className="text-[10px] text-gray-500 mt-0.5">{new Date(p.purchase_date).toLocaleDateString("en-PK", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-gray-700 dark:text-gray-300">{p.vendor_name}</div>
                                                    <div className="text-[10px] text-gray-400 font-mono">ID: #{p.id}</div>
                                                </td>
                                                <td className="p-4">
                                                    {p.due_date ? (
                                                        <div className={`text-xs font-bold ${new Date(p.due_date) < new Date() && p.balance > 0 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
                                                            {new Date(p.due_date).toLocaleDateString()}
                                                            {new Date(p.due_date) < new Date() && p.balance > 0 && <span className="block text-[8px] uppercase tracking-tighter">Overdue</span>}
                                                        </div>
                                                    ) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="p-4 font-black">PKR {p.total_amount.toLocaleString()}</td>
                                                <td className="p-4 text-green-600 dark:text-green-400 font-bold">PKR {p.paid_amount.toLocaleString()}</td>
                                                <td className="p-4 text-red-600 dark:text-red-400 font-bold">PKR {p.balance.toLocaleString()}</td>
                                                <td className="p-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                        p.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        p.status === 'Partial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setReturnModalPurchase(p);
                                                                setReturnItems(p.items.map(i => ({ item_id: i.id, qty: 0, reason: "" })));
                                                                setReturnNotes("");
                                                            }}
                                                            title="Return Items" 
                                                            className="p-2 hover:bg-orange-100 text-orange-600 rounded-lg transition-all active:scale-95"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => fetchPurchaseHistory(p.id)}
                                                            title="View History" 
                                                            className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition-all active:scale-95"
                                                        >
                                                            <Clock size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => router.push(`/outlet/vendors/purchases/edit/${p.id}`)}
                                                            title="Edit Purchase" 
                                                            className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition-all active:scale-95"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handlePrintNewTab(p.id)}
                                                            title="Print Invoice / Generate PDF" 
                                                            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-all active:scale-95"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                        <button 
                                                            onClick={() => requestDelete(p.id)}
                                                            disabled={deletingId === p.id}
                                                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
    
                                            {/* ITEMS EXPANSION */}
                                            {isExpanded && (
                                                <tr className="bg-gray-50/50 dark:bg-meta-4/10">
                                                    <td colSpan={9} className="p-0 border-b border-stroke dark:border-strokedark">
                                                        <div className="px-14 py-6">
                                                            <div className="mb-4 flex items-center justify-between">
                                                                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                                    <FileText size={14} className="text-primary" /> Purchase Items
                                                                </div>
                                                                {p.notes && (
                                                                    <div className="text-xs text-gray-400 italic">" {p.notes} "</div>
                                                                )}
                                                            </div>
                                                            <div className="overflow-hidden rounded-xl border border-stroke dark:border-strokedark bg-white dark:bg-boxdark">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark text-gray-500">
                                                                            <th className="p-3">#</th>
                                                                            <th className="p-3">Product Item</th>
                                                                            <th className="p-3">Variant</th>
                                                                            <th className="p-3">IMEI / Serial</th>
                                                                            <th className="p-3 text-center">Billed Qty</th>
                                                                            <th className="p-3 text-center">Ret. Qty</th>
                                                                            <th className="p-3 text-center">Actual Stock</th>
                                                                            <th className="p-3 text-right">Unit Price</th>
                                                                            <th className="p-3 text-right">Subtotal</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                            {p.items.map((item, idx) => {
                                                                                const returnedQty = (p.returns || []).reduce((acc, ret) => {
                                                                                    const retItem = ret.items.find((ri: any) => ri.purchase_item_id === item.id);
                                                                                    return acc + (retItem?.quantity || 0);
                                                                                }, 0);
                                                                                const actualQty = item.quantity - returnedQty;

                                                                                return (
                                                                                    <tr key={item.id} className="border-b border-stroke dark:border-strokedark last:border-0 hover:bg-gray-50 dark:hover:bg-meta-4/20">
                                                                                        <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                                                                                        <td className="p-3">
                                                                                            <div className="font-bold text-gray-800 dark:text-white">{item.product_name}</div>
                                                                                            <div className="text-[10px] text-gray-400">{item.category || 'N/A'}</div>
                                                                                        </td>
                                                                                        <td className="p-3">
                                                                                            {item.color_variant ? (
                                                                                                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 rounded-full text-[10px] font-bold lowercase">
                                                                                                    {item.color_variant}
                                                                                                </span>
                                                                                            ) : '—'}
                                                                                        </td>
                                                                                        <td className="p-3 font-mono text-gray-600 dark:text-gray-400">
                                                                                            {item.imei_serial || 'Generic'}
                                                                                            {actualQty === 0 && (
                                                                                                <div className="text-[8px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md mt-1 w-fit uppercase">Fully Returned</div>
                                                                                            )}
                                                                                            {returnedQty > 0 && actualQty > 0 && (
                                                                                                <div className="text-[8px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md mt-1 w-fit uppercase">Partial Return</div>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="p-3 text-center font-bold text-gray-400 line-through">{item.quantity}</td>
                                                                                        <td className="p-3 text-center font-bold text-orange-600">{returnedQty > 0 ? returnedQty : '—'}</td>
                                                                                        <td className="p-3 text-center font-black text-primary bg-primary/5">{actualQty}</td>
                                                                                        <td className="p-3 text-right">PKR {item.unit_price.toLocaleString()}</td>
                                                                                        <td className="p-3 text-right font-bold text-gray-900 dark:text-white">PKR {item.total_price.toLocaleString()}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr className="bg-gray-50/50 dark:bg-meta-4/30 font-bold">
                                                                            <td colSpan={8} className="p-3 text-right uppercase text-gray-500 tracking-wider">Invoice Total</td>
                                                                            <td className="p-3 text-right text-primary text-base">PKR {p.total_amount.toLocaleString()}</td>
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
                    ) : (
                        /* RETURNS HISTORY TABLE */
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-meta-4 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    <th className="p-4">Return # / Date</th>
                                    <th className="p-4">Vendor</th>
                                    <th className="p-4">Linked Purchase</th>
                                    <th className="p-4">Total Amount</th>
                                    <th className="p-4">Items Count</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingReturns ? (
                                    <tr><td colSpan={6} className="p-10 text-center"><Loader text="Loading returns..." /></td></tr>
                                ) : returns.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-20 text-center text-gray-400 opacity-60">
                                            <RotateCcw size={48} className="mx-auto mb-4" />
                                            <div className="font-medium">No return records found</div>
                                        </td>
                                    </tr>
                                ) : returns.map(r => (
                                    <tr key={r.id} className="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-gray-800 dark:text-white uppercase tracking-tight">{r.return_number}</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">{formatExactDate(r.return_date, 'DD MMM YYYY, hh:mm A')}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold text-gray-700 dark:text-gray-300">{r.vendor_name}</div>
                                        </td>
                                        <td className="p-4">
                                            {r.purchase ? (
                                                <div className="text-xs font-bold text-primary uppercase">{r.purchase.invoice_number}</div>
                                            ) : <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="p-4 font-black">PKR {r.total_amount.toLocaleString()}</td>
                                        <td className="p-4">{r.items?.length || 0} items</td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => setSelectedReturn(r)}
                                                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                                            >
                                                <Search size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ADVANCED EXPORT MODAL */}
            {showExportModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
                    <div className="relative w-full max-w-lg bg-white dark:bg-boxdark rounded-3xl shadow-2xl overflow-hidden border border-stroke dark:border-strokedark animate-zoom-in">
                        <div className="p-6 bg-primary text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <Download size={24} /> Advanced Data Export
                                </h2>
                                <p className="text-[10px] opacity-70 uppercase tracking-widest font-black mt-1">Excel & Spreadsheet Selection</p>
                            </div>
                            <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Option 1: Detailed Items Toggles */}
                            <div className="space-y-4">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Export Detail Level</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setExportOptions({...exportOptions, includeItems: false})}
                                        className={`p-4 rounded-2xl border-2 flex flex-col gap-1.5 transition-all text-left ${!exportOptions.includeItems ? 'border-primary bg-primary/5' : 'border-stroke dark:border-strokedark'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <FileText size={20} className={!exportOptions.includeItems ? 'text-primary' : 'text-gray-400'} />
                                            {!exportOptions.includeItems ? <CheckSquare className="text-primary" size={16} /> : <Square className="text-gray-300" size={16} />}
                                        </div>
                                        <div className="font-black text-sm">Summary Only</div>
                                        <div className="text-[10px] text-gray-400 italic">One row per invoice. Quick financial overview.</div>
                                    </button>
                                    <button 
                                        onClick={() => setExportOptions({...exportOptions, includeItems: true})}
                                        className={`p-4 rounded-2xl border-2 flex flex-col gap-1.5 transition-all text-left ${exportOptions.includeItems ? 'border-primary bg-primary/5' : 'border-stroke dark:border-strokedark'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <Settings size={20} className={exportOptions.includeItems ? 'text-primary' : 'text-gray-400'} />
                                            {exportOptions.includeItems ? <CheckSquare className="text-primary" size={16} /> : <Square className="text-gray-300" size={16} />}
                                        </div>
                                        <div className="font-black text-sm">Detailed Items</div>
                                        <div className="text-[10px] text-gray-400 italic">Include every item, IMEI, and color variant.</div>
                                    </button>
                                </div>
                            </div>

                            {/* Option 2: Selective Vendors */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Vendors</label>
                                    <button 
                                        onClick={() => setExportOptions({...exportOptions, selectedVendors: []})}
                                        className="text-[10px] font-black text-primary uppercase"
                                    >
                                        Reset Selected
                                    </button>
                                </div>
                                <div className="bg-gray-50 dark:bg-meta-4 rounded-2xl border border-stroke dark:border-strokedark p-4 max-h-[200px] overflow-y-auto space-y-2">
                                    {uniqueVendors.length === 0 ? (
                                        <div className="text-[10px] text-gray-400 text-center py-4 uppercase font-black">No vendors available</div>
                                    ) : uniqueVendors.map(v => (
                                        <label key={v} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-boxdark rounded-xl cursor-pointer transition-colors group">
                                            <input 
                                                type="checkbox"
                                                checked={exportOptions.selectedVendors.includes(v)}
                                                onChange={() => {
                                                    const current = exportOptions.selectedVendors;
                                                    setExportOptions({
                                                        ...exportOptions,
                                                        selectedVendors: current.includes(v) ? current.filter(x => x !== v) : [...current, v]
                                                    });
                                                }}
                                                className="hidden"
                                            />
                                            {exportOptions.selectedVendors.includes(v) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} className="text-gray-300 group-hover:text-gray-400" />}
                                            <span className={`text-sm font-bold ${exportOptions.selectedVendors.includes(v) ? 'text-gray-800' : 'text-gray-400'}`}>{v}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleAdvancedExport}
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                            >
                                <Download size={20} /> Prepare & Download Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM DELETE MODAL */}
            {confirmDeleteId !== null && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-boxdark rounded-[2rem] shadow-2xl p-8 text-center animate-zoom-in border border-stroke dark:border-strokedark">
                        <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <AlertCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">Delete Invoice?</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-8 font-bold leading-relaxed max-w-xs mx-auto">
                            Are you sure you want to delete this purchase invoice? This action <span className="text-red-500 font-black">cannot be undone</span> and will not automatically remove items from inventory.
                        </p>
                        <div className="flex items-center gap-3 w-full">
                            <button 
                                onClick={() => setConfirmDeleteId(null)}
                                className="flex-1 py-3.5 bg-gray-100 dark:bg-meta-4 text-gray-500 dark:text-gray-300 rounded-2xl font-black hover:bg-gray-200 dark:hover:bg-meta-4/80 transition-all active:scale-95 text-sm uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="flex-1 py-3.5 bg-red-500 text-white rounded-2xl font-black hover:bg-red-600 shadow-xl shadow-red-500/20 transition-all active:scale-95 text-sm uppercase tracking-widest"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PURCHASE RETURN MODAL */}
            {returnModalPurchase && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReturnModalPurchase(null)} />
                    <div className="relative w-full max-w-2xl bg-white dark:bg-boxdark rounded-3xl shadow-2xl overflow-hidden border border-stroke dark:border-strokedark animate-zoom-in">
                        <div className="p-6 bg-orange-600 text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <RotateCcw size={24} /> Process Purchase Return
                                </h2>
                                <p className="text-[10px] opacity-70 uppercase tracking-widest font-black mt-1">Invoice: {returnModalPurchase.invoice_number} | Vendor: {returnModalPurchase.vendor_name}</p>
                            </div>
                            <button onClick={() => setReturnModalPurchase(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                            <div className="space-y-4">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Select Items & Quantities to Return</label>
                                {returnModalPurchase.items
                                    .map(item => {
                                        const returnedQty = (returnModalPurchase.returns || []).reduce((acc, ret) => {
                                            const retItem = ret.items.find((ri: any) => ri.purchase_item_id === item.id);
                                            return acc + (retItem?.quantity || 0);
                                        }, 0);
                                        return { ...item, remainingQty: item.quantity - returnedQty };
                                    })
                                    .filter(item => item.remainingQty > 0)
                                    .map((item, idx) => (
                                    <div key={item.id} className="p-4 rounded-2xl border border-stroke dark:border-strokedark bg-gray-50/50 dark:bg-meta-4/10 space-y-3">
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => {
                                                    const current = returnItems.find(ri => ri.item_id === item.id);
                                                    const isSelected = (current?.qty || 0) > 0;
                                                    setReturnItems(prev => prev.map(ri => ri.item_id === item.id ? { ...ri, qty: isSelected ? 0 : item.remainingQty } : ri));
                                                }}
                                                className="focus:outline-none transition-transform active:scale-90"
                                            >
                                                {(returnItems.find(ri => ri.item_id === item.id)?.qty || 0) > 0 ? (
                                                    <CheckSquare size={24} className="text-orange-600" />
                                                ) : (
                                                    <Square size={24} className="text-gray-300 hover:text-gray-400" />
                                                )}
                                            </button>
                                            <div className="flex-1 flex items-center justify-between">
                                                <div>
                                                    <div className="font-bold text-gray-800 dark:text-white">{item.product_name}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{item.imei_serial || 'Generic'} • {item.color_variant || 'N/A'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Available to Return</div>
                                                    <div className="font-black text-primary">{item.remainingQty} Units</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Qty to Return</label>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    max={item.remainingQty}
                                                    disabled={(returnItems.find(ri => ri.item_id === item.id)?.qty || 0) === 0}
                                                    value={returnItems.find(ri => ri.item_id === item.id)?.qty || 0}
                                                    onChange={(e) => {
                                                        const val = Math.min(item.remainingQty, Math.max(0, parseInt(e.target.value) || 0));
                                                        setReturnItems(prev => prev.map(ri => ri.item_id === item.id ? { ...ri, qty: val } : ri));
                                                    }}
                                                    className="w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-xl px-4 py-2 font-bold outline-none focus:border-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Reason / Feedback</label>
                                                <input 
                                                    type="text"
                                                    placeholder="e.g. Damaged, Wrong model..."
                                                    disabled={(returnItems.find(ri => ri.item_id === item.id)?.qty || 0) === 0}
                                                    value={returnItems.find(ri => ri.item_id === item.id)?.reason || ""}
                                                    onChange={(e) => {
                                                        setReturnItems(prev => prev.map(ri => ri.item_id === item.id ? { ...ri, reason: e.target.value } : ri));
                                                    }}
                                                    className="w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-xl px-4 py-2 text-sm outline-none focus:border-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {returnModalPurchase.items
                                    .map(item => {
                                        const returnedQty = (returnModalPurchase.returns || []).reduce((acc, ret) => {
                                            const retItem = ret.items.find((ri: any) => ri.purchase_item_id === item.id);
                                            return acc + (retItem?.quantity || 0);
                                        }, 0);
                                        return item.quantity - returnedQty;
                                    })
                                    .every(rem => rem === 0) && (
                                        <div className="py-10 text-center space-y-4">
                                            <CheckCircle2 size={48} className="text-green-500 mx-auto" />
                                            <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">All items in this invoice have been returned.</div>
                                        </div>
                                    )}
                            </div>

                            <div>
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">General Return Notes</label>
                                <textarea 
                                    rows={3}
                                    value={returnNotes}
                                    onChange={(e) => setReturnNotes(e.target.value)}
                                    placeholder="Any additional details about this return..."
                                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-2xl p-4 outline-none focus:border-orange-500 text-sm"
                                />
                            </div>

                            <div className="p-4 bg-orange-50 dark:bg-orange-500/10 rounded-2xl border border-orange-200 dark:border-orange-500/30">
                                <div className="flex items-center justify-between text-orange-800 dark:text-orange-400">
                                    <span className="text-sm font-bold flex items-center gap-2">
                                        <Calculator size={18} /> Estimated Credit Note
                                    </span>
                                    <span className="text-lg font-black">
                                        PKR {returnItems.reduce((acc, ri) => {
                                            const original = returnModalPurchase.items.find(i => i.id === ri.item_id);
                                            return acc + (ri.qty * (original?.unit_price || 0));
                                        }, 0).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-[10px] text-orange-600 dark:text-orange-500 mt-1 font-bold italic uppercase">
                                    This amount will be deducted from your balance with {returnModalPurchase.vendor_name}.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-stroke dark:border-strokedark bg-gray-50 dark:bg-meta-4 flex gap-3">
                            <button 
                                onClick={() => setReturnModalPurchase(null)}
                                className="flex-1 py-3 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-xl font-bold hover:bg-gray-100 transition-colors uppercase tracking-widest text-xs"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleReturnSubmit}
                                disabled={isSubmittingReturn || returnItems.every(ri => ri.qty === 0)}
                                className="flex-[2] py-3 bg-orange-600 text-white rounded-xl font-black shadow-xl shadow-orange-500/20 hover:bg-orange-700 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                {isSubmittingReturn ? "Processing..." : "Complete Return"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORY MODAL */}
            {historyModalPurchaseId !== null && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryModalPurchaseId(null)} />
                    <div className="relative w-full max-w-2xl bg-white dark:bg-boxdark rounded-3xl shadow-2xl overflow-hidden border border-stroke dark:border-strokedark animate-zoom-in">
                        <div className="p-6 bg-gray-800 text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <History size={24} /> Purchase Edit History
                                </h2>
                                <p className="text-[10px] opacity-70 uppercase tracking-widest font-black mt-1">Audit Trail for Invoice ID: #{historyModalPurchaseId}</p>
                            </div>
                            <button onClick={() => setHistoryModalPurchaseId(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[60vh] overflow-y-auto">
                            {loadingHistory ? (
                                <div className="py-20 text-center">
                                    <Loader text="Fetching audit logs..." />
                                </div>
                            ) : purchaseHistory.length === 0 ? (
                                <div className="py-20 text-center text-gray-400 opacity-60">
                                    <History size={48} className="mx-auto mb-4" />
                                    <div className="font-medium">No edit history found for this invoice.</div>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-stroke dark:border-strokedark ml-4 space-y-8 pb-4">
                                    {purchaseHistory.map((h, idx) => (
                                        <div key={h.id} className="relative pl-8">
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-boxdark shadow-sm" />
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-md">
                                                    {formatExactDate(h.edited_at)}
                                                </div>
                                                <div className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                                    Edited by: <span className="text-gray-800 dark:text-gray-200">ID #{h.edited_by_id || 'System'}</span>
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark">
                                                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                    {h.changes_summary || "Manual adjustment recorded."}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-stroke dark:border-strokedark flex justify-end">
                            <button 
                                onClick={() => setHistoryModalPurchaseId(null)}
                                className="px-8 py-3 bg-gray-800 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg"
                            >
                                Close History
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* VIEW RETURN DETAILS MODAL */}
            {selectedReturn && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedReturn(null)} />
                    <div className="relative w-full max-w-3xl bg-white dark:bg-boxdark rounded-3xl shadow-2xl overflow-hidden border border-stroke dark:border-strokedark animate-zoom-in">
                        <div className="p-6 bg-gray-800 text-white flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <FileText size={24} /> Return Details: {selectedReturn.return_number}
                                </h2>
                                <p className="text-[10px] opacity-70 uppercase tracking-widest font-black mt-1">Vendor: {selectedReturn.vendor_name} | Date: {formatExactDate(selectedReturn.return_date, 'DD MMM YYYY, hh:mm A')}</p>
                            </div>
                            <button onClick={() => setSelectedReturn(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto">
                            <div className="mb-8 grid grid-cols-2 gap-8">
                                <div className="p-4 bg-gray-50 dark:bg-meta-4 rounded-2xl border border-stroke dark:border-strokedark">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Return Information</div>
                                    <div className="space-y-1">
                                        <div className="text-sm font-bold text-gray-800 dark:text-white">Amount: PKR {selectedReturn.total_amount.toLocaleString()}</div>
                                        <div className="text-xs text-gray-500">Items Count: {selectedReturn.items?.length || 0}</div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-meta-4 rounded-2xl border border-stroke dark:border-strokedark">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Linked Purchase</div>
                                    <div className="space-y-1">
                                        <div className="text-sm font-bold text-primary uppercase">{selectedReturn.purchase?.invoice_number || 'None'}</div>
                                        <div className="text-xs text-gray-500">Original Date: {selectedReturn.purchase ? new Date(selectedReturn.purchase.purchase_date).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Returned Items Breakdown</label>
                                <div className="rounded-2xl border border-stroke dark:border-strokedark overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark text-gray-500 font-bold">
                                                <th className="p-3 text-left">Product</th>
                                                <th className="p-3 text-left">IMEI / Serial</th>
                                                <th className="p-3 text-center">Qty</th>
                                                <th className="p-3 text-right">Unit Price</th>
                                                <th className="p-3 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedReturn.items?.map((item: any) => (
                                                <Fragment key={item.id}>
                                                    <tr className="border-b border-stroke dark:border-strokedark last:border-0 hover:bg-gray-50/50 dark:hover:bg-meta-4/10">
                                                        <td className="p-3">
                                                            <div className="font-bold text-gray-800 dark:text-white">{item.product_name}</div>
                                                            <div className="text-[10px] text-gray-500">{item.category} • {item.color_variant}</div>
                                                        </td>
                                                        <td className="p-3 font-mono text-gray-500">{item.imei_serial || 'Generic'}</td>
                                                        <td className="p-3 text-center font-black">{item.quantity}</td>
                                                        <td className="p-3 text-right">PKR {item.unit_price.toLocaleString()}</td>
                                                        <td className="p-3 text-right font-bold">PKR {item.total_price.toLocaleString()}</td>
                                                    </tr>
                                                    {item.reason && (
                                                        <tr className="bg-orange-50/30 dark:bg-orange-500/5">
                                                            <td colSpan={5} className="px-3 py-2">
                                                                <div className="flex items-start gap-2 text-orange-600 dark:text-orange-400">
                                                                    <MessageSquare size={12} className="mt-0.5" />
                                                                    <span className="text-[10px] font-bold italic">Feedback: {item.reason}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 dark:bg-meta-4 font-black">
                                                <td colSpan={4} className="p-3 text-right uppercase tracking-widest text-[10px] text-gray-500">Total Returned Value</td>
                                                <td className="p-3 text-right text-orange-600 dark:text-orange-400 text-sm">PKR {selectedReturn.total_amount.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {selectedReturn.notes && (
                                <div className="mt-8 p-4 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-dashed border-stroke dark:border-strokedark">
                                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <History size={14} /> General Notes
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{selectedReturn.notes}"</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-stroke dark:border-strokedark flex justify-end">
                            <button 
                                onClick={() => setSelectedReturn(null)}
                                className="px-8 py-3 bg-gray-800 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
