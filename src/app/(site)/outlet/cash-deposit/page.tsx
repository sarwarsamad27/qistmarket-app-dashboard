"use client";

import { useState, useEffect, Fragment } from "react";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import io from "socket.io-client";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { formatExactDate } from "@/utils/dateUtils";
import { DollarSign, Building, FileText, CheckCircle, XCircle, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { getErrorMessage } from "@/lib/apiErrors";
import { ListSkeleton, ValueSkeleton } from "@/components/ui/LoadingStates";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
});

type BankAccount = {
    id: number;
    bank_name: string;
    account_number: string;
    account_title: string;
};

type Outlet = {
    id: number;
    name: string;
    code: string;
};

type TransferRequest = {
    id: number;
    amount: number;
    status: string;
    description: string | null;
    created_at: string;
    receipt_photo_url: string | null;
    receipt_id: string | null;
    sender_outlet?: { id: number; name: string };
    receiver_outlet?: { id: number; name: string };
};

type BankDeposit = {
    id: number;
    amount: number;
    payment_method: string;
    status: string;
    receipt_id: string | null;
    receipt_photo_url: string | null;
    description: string | null;
    created_at: string;
    bank_account?: { bank_name: string; account_number: string } | null;
    accountant?: { id: number; full_name: string } | null;
    submitted_by?: { id: number; full_name: string } | null;
    outlet?: { id: number; name: string } | null;
    consumer_number?: string | null;
    qr_image_base64?: string | null;
    expires_at?: string | null;
    transaction_id?: string | null;
};

const isExpired = (expiresAt?: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
};

export default function CashDepositPage() {
    const [activeTab, setActiveTab] = useState<"deposit" | "transfer">("deposit");

    // Deposit State
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("manual_deposit");
    const [bankAccountId, setBankAccountId] = useState("");
    const [receiptId, setReceiptId] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [, setTick] = useState(0); // periodic re-render so expiry badges stay current
    const [depositSearch, setDepositSearch] = useState("");

    // Transfer State
    const [transferAmount, setTransferAmount] = useState("");
    const [receiverOutletId, setReceiverOutletId] = useState("");
    const [transferReceiptId, setTransferReceiptId] = useState("");
    const [transferDesc, setTransferDesc] = useState("");
    const [transferFile, setTransferFile] = useState<File | null>(null);
    const [outlets, setOutlets] = useState<Outlet[]>([]);
    
    const [incomingTransfers, setIncomingTransfers] = useState<TransferRequest[]>([]);
    const [outgoingTransfers, setOutgoingTransfers] = useState<TransferRequest[]>([]);
    const [depositHistory, setDepositHistory] = useState<BankDeposit[]>([]);
    // Lists show a skeleton until their first load, not "No ... yet".
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [transfersLoaded, setTransfersLoaded] = useState(false);
    const [cashInHand, setCashInHand] = useState<number | null>(null);

    const fetchBanks = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/accounts/bank-accounts`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setBanks(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchOutlets = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/outlet/list/basic`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setOutlets(data.data);
        } catch (err) { console.error(err); }
    };

    const fetchDepositHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/outlet/bank-deposits`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setDepositHistory(data.data || []);
        } catch (err) { console.error(err); }
        finally { setHistoryLoaded(true); }
    };

    const fetchCashInHand = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/outlet/cash-register?filter=today`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setCashInHand(data.metrics?.closing_cash ?? 0);
        } catch (err) { console.error(err); }
    };

    const fetchTransfers = async () => {
        try {
            const [inRes, outRes] = await Promise.all([
                fetch(`${API_BASE}/api/outlet/cash-transfers/incoming`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE}/api/outlet/cash-transfers/outgoing`, { headers: getAuthHeaders() })
            ]);
            const inData = await inRes.json();
            const outData = await outRes.json();
            if (inData.success) setIncomingTransfers(inData.data);
            if (outData.success) setOutgoingTransfers(outData.data);
        } catch (err) { console.error(err); }
        finally { setTransfersLoaded(true); }
    };

    useEffect(() => {
        fetchBanks();
        fetchOutlets();
        fetchTransfers();
        fetchDepositHistory();
        fetchCashInHand();
    }, []);

    // Periodic tick so "expired" badges update without needing a manual refresh.
    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    // Live updates: the moment 1Bill/QR payment is confirmed by the webhook,
    // refresh history + accountant busy-state without a manual refresh.
    useEffect(() => {
        const token = Cookies.get("auth_token");
        if (!token) return;
        const socket = io(API_BASE, { auth: { token }, reconnection: true });
        socket.on("bank_deposit_updated", () => {
            fetchDepositHistory();
            fetchCashInHand();
        });
        return () => { socket.disconnect(); };
    }, []);

    const isRoutedMethod = paymentMethod === "1bill" || paymentMethod === "qr_payment";

    const handleDepositSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // 1bill/qr_payment never attach a file — send them as plain JSON instead
        // of multipart/form-data. A production-only proxy/WAF in front of this
        // endpoint was interfering with multipart POSTs here specifically (the
        // JSON-only SmartPay QR endpoint elsewhere in the app was unaffected),
        // which surfaced as a generic "Network error" with no server response.
        let body: FormData | string;
        let extraHeaders: Record<string, string> = {};
        if (isRoutedMethod) {
            body = JSON.stringify({ amount, payment_method: paymentMethod });
            extraHeaders = { "Content-Type": "application/json" };
        } else {
            const formData = new FormData();
            formData.append("amount", amount);
            formData.append("payment_method", paymentMethod);
            if (bankAccountId) formData.append("bank_account_id", bankAccountId);
            if (receiptId) formData.append("receipt_id", receiptId);
            if (description) formData.append("description", description);
            if (file) formData.append("receipt_photo", file);
            body = formData;
        }

        const doFetch = () => fetch(`${API_BASE}/api/outlet/bank-deposits`, {
            method: "POST", headers: { ...getAuthHeaders(), ...extraHeaders }, body,
        });

        try {
            let res: Response;
            try {
                res = await doFetch();
            } catch (err) {
                // A raw fetch failure (not an error response) for the QR/1bill
                // path is usually a transient hiccup reaching the payment
                // gateway — worth one retry before giving up, since the manual
                // deposit path doesn't hit that gateway at all.
                if (!isRoutedMethod) throw err;
                await new Promise((resolve) => setTimeout(resolve, 800));
                res = await doFetch();
            }
            let data: any = null;
            try {
                data = await res.json();
            } catch {
                // Server didn't return JSON (e.g. a proxy/gateway timeout page) —
                // surface the HTTP status instead of a completely opaque error.
                toast.error(`Server error (HTTP ${res.status}). Please try again in a moment.`);
                return;
            }
            if (data.success) {
                toast.success(isRoutedMethod ? "Generated — check history below." : "Deposit request submitted successfully!");
                setAmount(""); setBankAccountId(""); setReceiptId(""); setDescription(""); setFile(null);
                fetchDepositHistory();
                fetchCashInHand();
            } else { toast.error(data.message || "Failed to submit request."); }
        } catch (err) {
            toast.error(isRoutedMethod
                ? "Could not reach the payment gateway after retrying. Please try again in a moment."
                : "Network error — could not reach the server. Please check your connection and try again.");
        }
        finally { setLoading(false); }
    };

    const handleCancel = async (id: number) => {
        if (!confirm("Cancel this pending deposit request?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/outlet/bank-deposits/${id}/cancel`, {
                method: "PATCH", headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Request cancelled.");
                fetchDepositHistory();
                fetchCashInHand();
            } else { toast.error(data.message || "Failed to cancel request."); }
        } catch (err) { toast.error(getErrorMessage(err, "An error occurred. Please try again.")); }
    };

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied!");
    };

    const handleTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        formData.append("amount", transferAmount);
        formData.append("receiver_outlet_id", receiverOutletId);
        if (transferReceiptId) formData.append("receipt_id", transferReceiptId);
        if (transferDesc) formData.append("description", transferDesc);
        if (transferFile) formData.append("receipt_photo", transferFile);

        try {
            const res = await fetch(`${API_BASE}/api/outlet/cash-transfers`, {
                method: "POST", headers: getAuthHeaders(), body: formData,
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Transfer request submitted successfully!");
                setTransferAmount(""); setReceiverOutletId(""); setTransferReceiptId(""); setTransferDesc(""); setTransferFile(null);
                fetchTransfers();
            } else { toast.error(data.message || "Failed to submit request."); }
        } catch (err) { toast.error(getErrorMessage(err, "An error occurred. Please try again.")); } 
        finally { setLoading(false); }
    };

    const handleTransferAction = async (id: number, action: 'accept' | 'reject') => {
        if (!confirm(`Are you sure you want to ${action} this transfer? This action cannot be undone.`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/outlet/cash-transfers/${id}/${action}`, {
                method: "POST", headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Transfer ${action}ed successfully!`);
                fetchTransfers();
            } else { toast.error(data.message || `Failed to ${action} transfer.`); }
        } catch (err) { toast.error(getErrorMessage(err, "An error occurred. Please try again.")); }
    };

    const filteredDepositHistory = depositHistory.filter((dep) => {
        const q = depositSearch.trim().toLowerCase();
        if (!q) return true;
        return (
            (dep.receipt_id || "").toLowerCase().includes(q) ||
            (dep.transaction_id || "").toLowerCase().includes(q) ||
            (dep.consumer_number || "").toLowerCase().includes(q) ||
            (dep.payment_method || "").replace(/_/g, " ").toLowerCase().includes(q) ||
            (dep.status || "").toLowerCase().includes(q) ||
            (dep.description || "").toLowerCase().includes(q) ||
            String(dep.amount).includes(q)
        );
    });

    return (
        <>
            <Breadcrumb pageName="Cash Deposit & Transfers" />
            <div className="mx-auto max-w-5xl">

                {/* Tabs Header */}
                <div className="mb-6 flex space-x-4 border-b border-stroke dark:border-strokedark">
                    <button
                        className={`pb-3 px-4 font-medium text-sm flex items-center gap-2 transition-colors duration-200 ease-in-out
                            ${activeTab === 'deposit' 
                                ? 'text-primary border-b-2 border-primary' 
                                : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'}`}
                        onClick={() => setActiveTab('deposit')}
                    >
                        <Building size={18} /> Bank Deposit
                    </button>
                    <button
                        className={`pb-3 px-4 font-medium text-sm flex items-center gap-2 transition-colors duration-200 ease-in-out
                            ${activeTab === 'transfer' 
                                ? 'text-primary border-b-2 border-primary' 
                                : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white'}`}
                        onClick={() => setActiveTab('transfer')}
                    >
                        <ArrowRightLeft size={18} /> Outlet Cash Transfer
                    </button>
                </div>

                {activeTab === 'deposit' && (
                    <div className="flex flex-col gap-6">
                    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex flex-wrap items-center justify-between gap-3">
                            <h3 className="font-medium text-black dark:text-white flex items-center gap-2">
                                <Building className="h-5 w-5" /> Submit Bank Deposit
                            </h3>
                            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-4 py-2">
                                <DollarSign className="h-4 w-4 text-primary" />
                                <span className="text-xs font-medium text-body-color">Cash in Hand:</span>
                                <span className="text-sm font-bold text-primary">
                                    {cashInHand === null ? <ValueSkeleton className="h-6 w-28" /> : `Rs ${cashInHand.toLocaleString()}`}
                                </span>
                            </div>
                        </div>
                        <form onSubmit={handleDepositSubmit} className="p-6.5">
                            <div className="mb-4.5 flex flex-col gap-6 xl:flex-row">
                                <div className="w-full xl:w-1/2">
                                    <label className="mb-2.5 block text-black dark:text-white">Amount (PKR) <span className="text-meta-1">*</span></label>
                                    <div className="relative">
                                        <span className="absolute left-4.5 top-4"><DollarSign size={20} /></span>
                                        <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter amount" className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 pl-12 pr-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary" />
                                    </div>
                                    {cashInHand !== null && cashInHand > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setAmount(String(cashInHand))}
                                            className="mt-1.5 text-xs font-medium text-primary hover:underline"
                                        >
                                            Use full amount (Rs {cashInHand.toLocaleString()})
                                        </button>
                                    )}
                                    {cashInHand !== null && amount !== "" && !isNaN(Number(amount)) && (
                                        <p className={`mt-1.5 text-xs font-medium ${
                                            cashInHand - Number(amount) < 0 ? "text-danger" : "text-body-color"
                                        }`}>
                                            Remaining after this deposit: Rs {(cashInHand - Number(amount)).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <div className="w-full xl:w-1/2">
                                    <label className="mb-2.5 block text-black dark:text-white">Payment Method <span className="text-meta-1">*</span></label>
                                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary">
                                        <option value="manual_deposit">Manual Bank Deposit</option>
                                        <option value="1bill">1Bill Payment</option>
                                        <option value="qr_payment">QR Payment</option>
                                    </select>
                                </div>
                            </div>
                            {isRoutedMethod ? null : (
                                <>
                                    <div className="mb-4.5">
                                        <label className="mb-2.5 block text-black dark:text-white">Select Bank Account</label>
                                        <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary">
                                            <option value="">Select a bank (Optional)</option>
                                            {banks.map(b => (
                                                <option key={b.id} value={b.id}>{b.bank_name} - {b.account_title} ({b.account_number})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-4.5">
                                        <label className="mb-2.5 block text-black dark:text-white">Receipt ID / Reference No.</label>
                                        <input type="text" value={receiptId} onChange={(e) => setReceiptId(e.target.value)} placeholder="Enter receipt ID" className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary" />
                                    </div>
                                    <div className="mb-6">
                                        <label className="mb-2.5 block text-black dark:text-white">Receipt Photo</label>
                                        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full cursor-pointer rounded-lg border-[1.5px] border-stroke bg-transparent outline-none transition file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-whiter file:py-3 file:px-5 file:hover:bg-primary file:hover:bg-opacity-10 focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:file:border-form-strokedark dark:file:bg-white/30 dark:file:text-white dark:focus:border-primary" />
                                    </div>
                                    <div className="mb-6">
                                        <label className="mb-2.5 block text-black dark:text-white">Description (Optional)</label>
                                        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add any extra notes..." className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary" />
                                    </div>
                                </>
                            )}
                            <button disabled={loading} type="submit" className="flex w-full justify-center rounded bg-primary p-3 font-medium text-gray hover:bg-opacity-90 disabled:opacity-50">
                                {loading ? "Submitting..." : "Submit Bank Deposit"}
                            </button>
                        </form>
                    </div>

                    {/* Deposit History */}
                    <div className="mt-6 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                        <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
                            <h3 className="font-medium text-black dark:text-white flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" /> Bank Deposit History
                            </h3>
                        </div>
                        <div className="px-4 pt-4">
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
                                <input
                                    type="text"
                                    value={depositSearch}
                                    onChange={(e) => setDepositSearch(e.target.value)}
                                    placeholder="Search by receipt ID, TxID, consumer number, method, status, or amount..."
                                    className="w-full rounded border-[1.5px] border-stroke bg-transparent py-2.5 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                                />
                            </div>
                        </div>
                        <div className="p-4">
                            {!historyLoaded ? (
                                <ListSkeleton rows={3} />
                            ) : depositHistory.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">No deposit history yet.</p>
                            ) : filteredDepositHistory.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">No deposits match your search.</p>
                            ) : (
                                <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
                                    <table className="w-full table-auto">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-gray-2 text-left dark:bg-meta-4">
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Date</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Amount</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Method</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Consumer No.</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Receipt ID</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Status</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm">Receipt</th>
                                                <th className="py-3 px-4 font-medium text-black dark:text-white text-sm"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredDepositHistory.map(dep => {
                                                const hasExtra = dep.payment_method === '1bill' || dep.payment_method === 'qr_payment';
                                                const expired = isExpired(dep.expires_at);
                                                return (
                                                <Fragment key={dep.id}>
                                                <tr>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm">
                                                        {formatExactDate(dep.created_at)}
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm font-bold text-primary">
                                                        Rs {dep.amount.toLocaleString()}
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm capitalize">
                                                        {dep.payment_method?.replace(/_/g, ' ')}
                                                        {hasExtra && expired && dep.status === 'pending' && (
                                                            <span className="ml-2 inline-flex rounded-full bg-danger bg-opacity-10 py-0.5 px-2 text-xs font-medium text-danger normal-case">Expired</span>
                                                        )}
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm">
                                                        {dep.consumer_number ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{dep.consumer_number}</span>
                                                                <button onClick={() => copyText(dep.consumer_number!)} className="text-xs text-primary hover:underline">Copy</button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm text-gray-500">
                                                        {dep.receipt_id || '—'}
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm">
                                                        <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-xs font-medium ${
                                                            dep.status === 'verified' ? 'bg-success text-success' :
                                                            dep.status === 'rejected' ? 'bg-danger text-danger' :
                                                            'bg-warning text-warning'
                                                        }`}>
                                                            {dep.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm">
                                                        {dep.transaction_id && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-mono text-xs">TxID: {dep.transaction_id}</span>
                                                                <button onClick={() => copyText(dep.transaction_id!)} className="text-xs text-primary hover:underline">Copy</button>
                                                            </div>
                                                        )}
                                                        {dep.receipt_photo_url && (
                                                            <a href={`${API_BASE}${dep.receipt_photo_url}`} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">View</a>
                                                        )}
                                                        {!dep.transaction_id && !dep.receipt_photo_url && '—'}
                                                    </td>
                                                    <td className="border-b border-[#eee] py-3 px-4 dark:border-strokedark text-sm text-center">
                                                        <div className="flex items-center justify-center gap-3">
                                                            {hasExtra && (
                                                                <button onClick={() => setExpandedId(expandedId === dep.id ? null : dep.id)} className="text-primary hover:underline text-xs">
                                                                    {expandedId === dep.id ? 'Hide' : 'Details'}
                                                                </button>
                                                            )}
                                                            {dep.status === 'pending' && (
                                                                <button onClick={() => handleCancel(dep.id)} className="text-danger hover:underline text-xs">
                                                                    Cancel
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {hasExtra && expandedId === dep.id && (
                                                    <tr>
                                                        <td colSpan={8} className="border-b border-[#eee] bg-gray-50 py-3 px-4 dark:border-strokedark dark:bg-meta-4">
                                                            <div className="flex flex-col gap-2 text-sm">
                                                                <p><span className="text-body-color">Outlet / Submitted By:</span> {dep.outlet?.name || dep.submitted_by?.full_name || '—'}</p>
                                                                {dep.consumer_number && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-body-color">{dep.payment_method === 'qr_payment' ? 'SmartPay Consumer Number:' : '1Bill Consumer Number:'}</span>
                                                                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{dep.consumer_number}</span>
                                                                        <button onClick={() => copyText(dep.consumer_number!)} className="text-xs text-primary hover:underline">Copy</button>
                                                                    </div>
                                                                )}
                                                                {dep.payment_method === 'qr_payment' && dep.qr_image_base64 && dep.status === 'pending' && (
                                                                    <img src={dep.qr_image_base64} alt="QR" className="h-40 w-40" />
                                                                )}
                                                                {dep.status === 'pending' && dep.expires_at && (
                                                                    <p className={expired ? "text-danger" : "text-body-color"}>
                                                                        {expired ? 'Expired at' : 'Valid until'} {formatExactDate(dep.expires_at)}
                                                                    </p>
                                                                )}
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
                            )}
                        </div>
                    </div>
                </div>
                )}

                {activeTab === 'transfer' && (
                    <div className="flex flex-col gap-6">
                        {/* Send Transfer Form */}
                        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
                                <h3 className="font-medium text-black dark:text-white flex items-center gap-2">
                                    <ArrowRightLeft className="h-5 w-5 text-blue-500" /> Transfer Cash to Outlet
                                </h3>
                            </div>
                            <form onSubmit={handleTransferSubmit} className="p-6.5">
                                <div className="mb-4.5 flex flex-col gap-6 xl:flex-row">
                                    <div className="w-full xl:w-1/2">
                                        <label className="mb-2.5 block text-black dark:text-white">Amount (PKR) <span className="text-meta-1">*</span></label>
                                        <div className="relative">
                                            <span className="absolute left-4.5 top-4"><DollarSign size={20} /></span>
                                            <input type="number" required value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="Enter amount" className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 pl-12 pr-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary" />
                                        </div>
                                    </div>
                                    <div className="w-full xl:w-1/2">
                                        <label className="mb-2.5 block text-black dark:text-white">Target Outlet <span className="text-meta-1">*</span></label>
                                        <select required value={receiverOutletId} onChange={(e) => setReceiverOutletId(e.target.value)} className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary">
                                            <option value="">Select Outlet to send cash to</option>
                                            {outlets.map(o => (
                                                <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="mb-4.5">
                                    <label className="mb-2.5 block text-black dark:text-white">Receipt ID / Reference No.</label>
                                    <input type="text" value={transferReceiptId} onChange={(e) => setTransferReceiptId(e.target.value)} placeholder="Enter receipt ID" className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary" />
                                </div>
                                <div className="mb-6">
                                    <label className="mb-2.5 block text-black dark:text-white">Receipt Photo</label>
                                    <input type="file" onChange={(e) => setTransferFile(e.target.files?.[0] || null)} className="w-full cursor-pointer rounded-lg border-[1.5px] border-stroke bg-transparent outline-none transition file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-whiter file:py-3 file:px-5 file:hover:bg-primary file:hover:bg-opacity-10 focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:file:border-form-strokedark dark:file:bg-white/30 dark:file:text-white dark:focus:border-primary" />
                                </div>
                                <div className="mb-6">
                                    <label className="mb-2.5 block text-black dark:text-white">Description (Optional)</label>
                                    <textarea rows={3} value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} placeholder="Add any extra notes..." className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary" />
                                </div>
                                <button disabled={loading} type="submit" className="flex w-full justify-center rounded bg-blue-600 p-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                    {loading ? "Sending Transfer..." : "Send Transfer Request"}
                                </button>
                            </form>
                        </div>

                        {/* Incoming Requests */}
                        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark flex justify-between items-center">
                                <h3 className="font-medium text-black dark:text-white flex items-center gap-2">
                                    <ArrowDownLeft className="h-5 w-5 text-emerald-500" /> Incoming Requests (Needs Acceptance)
                                </h3>
                            </div>
                            <div className="p-4">
                                {!transfersLoaded ? (
                                    <ListSkeleton rows={2} />
                                ) : incomingTransfers.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-4">No incoming transfers.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto">
                                            <thead>
                                                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Date</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">From</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Amount</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Status</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {incomingTransfers.map(tr => (
                                                    <tr key={tr.id}>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm">
                                                            {new Date(tr.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm font-medium">
                                                            {tr.sender_outlet?.name}
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                            Rs {tr.amount.toLocaleString()}
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm">
                                                            <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-xs font-medium ${
                                                                tr.status === 'accepted' ? 'bg-success text-success' : tr.status === 'rejected' ? 'bg-danger text-danger' : 'bg-warning text-warning'
                                                            }`}>
                                                                {tr.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm">
                                                            {tr.status === 'pending' && (
                                                                <div className="flex items-center space-x-2">
                                                                    <button onClick={() => handleTransferAction(tr.id, 'accept')} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">Accept</button>
                                                                    <button onClick={() => handleTransferAction(tr.id, 'reject')} className="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Reject</button>
                                                                </div>
                                                            )}
                                                            {tr.status !== 'pending' && (
                                                                <span className="text-gray-400 text-xs">Action taken</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Outgoing Requests */}
                        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                            <div className="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
                                <h3 className="font-medium text-black dark:text-white flex items-center gap-2">
                                    <ArrowUpRight className="h-5 w-5 text-blue-500" /> Outgoing Transfer History
                                </h3>
                            </div>
                            <div className="p-4">
                                {!transfersLoaded ? (
                                    <ListSkeleton rows={2} />
                                ) : outgoingTransfers.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-4">No outgoing transfers.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-auto">
                                            <thead>
                                                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Date</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">To</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Amount</th>
                                                    <th className="py-3 px-4 font-medium text-black dark:text-white">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {outgoingTransfers.map(tr => (
                                                    <tr key={tr.id}>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm">
                                                            {new Date(tr.created_at).toLocaleString()}
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm">
                                                            {tr.receiver_outlet?.name}
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm font-medium">
                                                            Rs {tr.amount.toLocaleString()}
                                                        </td>
                                                        <td className="border-b border-[#eee] py-4 px-4 dark:border-strokedark text-sm">
                                                            <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-xs font-medium ${
                                                                tr.status === 'accepted' ? 'bg-success text-success' : tr.status === 'rejected' ? 'bg-danger text-danger' : 'bg-warning text-warning'
                                                            }`}>
                                                                {tr.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
