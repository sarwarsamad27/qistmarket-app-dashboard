"use client";

import { useEffect, useState, Fragment } from "react";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import io from "socket.io-client";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { CheckCircle, XCircle, Clock, ExternalLink, Image as ImageIcon } from "lucide-react";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

type DepositRequest = {
    id: number;
    amount: number;
    payment_method: string;
    receipt_id: string;
    receipt_photo_url: string;
    description: string;
    status: string;
    created_at: string;
    submitted_by: { full_name: string; username: string };
    bank_account?: { bank_name: string; account_number: string };
    outlet?: { name: string; code: string };
    accountant?: { id: number; full_name: string } | null;
    consumer_number?: string | null;
    qr_image_base64?: string | null;
    expires_at?: string | null;
    transaction_id?: string | null;
};

const isExpired = (expiresAt?: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() < Date.now();
};

export default function AccountsCashDepositsPage() {
    const [deposits, setDeposits] = useState<DepositRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState("pending");
    const [selectedMethod, setSelectedMethod] = useState("all");
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const methodTabs: { key: string; label: string }[] = [
        { key: "all", label: "All Methods" },
        { key: "manual_deposit", label: "Manual" },
        { key: "1bill", label: "1Bill" },
        { key: "qr_payment", label: "QR Payment" },
    ];
    const visibleDeposits = selectedMethod === "all"
        ? deposits
        : deposits.filter((d) => d.payment_method === selectedMethod);
    const methodCount = (key: string) =>
        key === "all" ? deposits.length : deposits.filter((d) => d.payment_method === key).length;

    useEffect(() => {
        fetchDeposits();
    }, [selectedStatus]);

    // Live updates: refetch the moment a 1Bill/QR deposit is auto-verified by the webhook.
    // Re-attached whenever selectedStatus changes so the refetch always uses the current filter.
    useEffect(() => {
        const token = Cookies.get("auth_token");
        if (!token) return;
        const socket = io(API_BASE, { auth: { token }, reconnection: true });
        socket.on("bank_deposit_updated", () => {
            fetchDeposits();
        });
        return () => { socket.disconnect(); };
    }, [selectedStatus]);

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied!");
    };

    const fetchDeposits = async () => {
        setLoading(true);
        try {
            const url = new URL(`${API_BASE}/api/accounts/bank-deposits`);
            if (selectedStatus !== "all") {
                url.searchParams.append("status", selectedStatus);
            }
            const res = await fetch(url.toString(), { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setDeposits(data.data);
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Failed to fetch deposit requests."));
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (id: number, status: "verified" | "rejected") => {
        const remarks = prompt(`Enter remarks for ${status === "verified" ? "verification" : "rejection"} (optional):`);
        if (remarks === null) return; // cancelled

        try {
            const res = await fetch(`${API_BASE}/api/accounts/bank-deposits/${id}/verify`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ status, remarks }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Deposit request ${status} successfully.`);
                fetchDeposits();
            } else {
                toast.error(data.message || "Failed to process request.");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "An error occurred."));
        }
    };

    return (
        <>
            <Breadcrumb pageName="Bank Deposit Requests" />
            <div className="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-xl font-semibold text-black dark:text-white">Deposit Requests</h4>
                    <div className="flex gap-3">
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="rounded border border-stroke bg-transparent py-2 px-4 outline-none dark:border-strokedark dark:bg-meta-4"
                        >
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All</option>
                        </select>
                        <button onClick={fetchDeposits} className="rounded bg-primary py-2 px-4 text-white hover:bg-opacity-90">
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                    {methodTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedMethod(tab.key)}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                                selectedMethod === tab.key
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-2 text-body-color hover:bg-gray-3 dark:bg-meta-4 dark:hover:bg-meta-3'
                            }`}
                        >
                            {tab.label} ({methodCount(tab.key)})
                        </button>
                    ))}
                </div>

                <div className="max-w-full overflow-x-auto">
                    <table className="w-full table-auto">
                        <thead>
                            <tr className="bg-gray-2 text-left dark:bg-meta-4">
                                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">Date</th>
                                <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">Outlet / User</th>
                                <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">Amount / Method</th>
                                <th className="min-w-[130px] py-4 px-4 font-medium text-black dark:text-white">Consumer No.</th>
                                <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">Destination Bank</th>
                                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">Proof</th>
                                <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">Status</th>
                                <th className="py-4 px-4 font-medium text-black dark:text-white text-center">Actions</th>
                                <th className="py-4 px-4 font-medium text-black dark:text-white"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="text-center py-4">Loading...</td></tr>
                            ) : visibleDeposits.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-4">No requests found.</td></tr>
                            ) : (
                                visibleDeposits.map((deposit) => {
                                    const hasExtra = deposit.payment_method === '1bill' || deposit.payment_method === 'qr_payment';
                                    const expired = isExpired(deposit.expires_at);
                                    return (
                                    <Fragment key={deposit.id}>
                                    <tr>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            <p className="text-black dark:text-white">{formatExactDate(deposit.created_at, 'DD MMM YYYY')}</p>
                                            <p className="text-xs text-body-color">{formatExactDate(deposit.created_at, 'hh:mm A')}</p>
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            <p className="text-black dark:text-white font-medium">{deposit.outlet?.name || "Head Office"}</p>
                                            <p className="text-xs text-body-color">{deposit.submitted_by.full_name}</p>
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            <p className="text-black dark:text-white font-semibold">PKR {deposit.amount.toLocaleString()}</p>
                                            <p className="text-xs text-primary">{deposit.payment_method}</p>
                                            {hasExtra && expired && deposit.status === 'pending' && (
                                                <span className="mt-1 inline-flex rounded-full bg-danger bg-opacity-10 py-0.5 px-2 text-xs font-medium text-danger">Expired</span>
                                            )}
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            {deposit.consumer_number ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{deposit.consumer_number}</span>
                                                    <button onClick={() => copyText(deposit.consumer_number!)} className="text-xs text-primary hover:underline text-left">Copy</button>
                                                </div>
                                            ) : (
                                                <span className="text-body-color italic text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            {deposit.bank_account ? (
                                                <>
                                                    <p className="text-black dark:text-white">{deposit.bank_account.bank_name}</p>
                                                    <p className="text-xs text-body-color">{deposit.bank_account.account_number}</p>
                                                </>
                                            ) : (
                                                <p className="text-body-color italic text-sm">Not specified</p>
                                            )}
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            {deposit.transaction_id && (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-mono text-xs">TxID: {deposit.transaction_id}</span>
                                                    <button onClick={() => copyText(deposit.transaction_id!)} className="text-xs text-primary hover:underline">Copy</button>
                                                </div>
                                            )}
                                            {deposit.receipt_id && <p className="text-sm font-medium">Ref: {deposit.receipt_id}</p>}
                                            {deposit.receipt_photo_url && (
                                                <a href={`${API_BASE}${deposit.receipt_photo_url}`} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                                                    <ImageIcon size={14} /> View Photo
                                                </a>
                                            )}
                                            {!deposit.transaction_id && !deposit.receipt_id && !deposit.receipt_photo_url && '—'}
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark">
                                            <span className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                                                deposit.status === 'verified' ? 'bg-success text-success' :
                                                deposit.status === 'rejected' ? 'bg-danger text-danger' :
                                                'bg-warning text-warning'
                                            }`}>
                                                {deposit.status === 'verified' && <CheckCircle className="mr-1 h-4 w-4" />}
                                                {deposit.status === 'rejected' && <XCircle className="mr-1 h-4 w-4" />}
                                                {deposit.status === 'pending' && <Clock className="mr-1 h-4 w-4" />}
                                                {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center">
                                            {deposit.status === 'pending' && deposit.payment_method === 'manual_deposit' && (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <button onClick={() => handleVerify(deposit.id, 'verified')} className="hover:text-success" title="Verify">
                                                        <CheckCircle className="h-5 w-5" />
                                                    </button>
                                                    <button onClick={() => handleVerify(deposit.id, 'rejected')} className="hover:text-danger" title="Reject">
                                                        <XCircle className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="border-b border-[#eee] py-5 px-4 dark:border-strokedark text-center">
                                            {hasExtra && (
                                                <button onClick={() => setExpandedId(expandedId === deposit.id ? null : deposit.id)} className="text-primary hover:underline text-xs">
                                                    {expandedId === deposit.id ? 'Hide' : 'Details'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                    {hasExtra && expandedId === deposit.id && (
                                        <tr>
                                            <td colSpan={9} className="border-b border-[#eee] bg-gray-50 py-4 px-4 dark:border-strokedark dark:bg-meta-4">
                                                <div className="flex flex-col gap-2 text-sm">
                                                    <p><span className="text-body-color">Outlet / Submitted By:</span> {deposit.outlet?.name || "Head Office"} — {deposit.submitted_by?.full_name || "—"}</p>
                                                    {deposit.consumer_number && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-body-color">{deposit.payment_method === 'qr_payment' ? 'SmartPay Consumer Number:' : '1Bill Consumer Number:'}</span>
                                                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{deposit.consumer_number}</span>
                                                            <button onClick={() => copyText(deposit.consumer_number!)} className="text-xs text-primary hover:underline">Copy</button>
                                                        </div>
                                                    )}
                                                    {deposit.payment_method === 'qr_payment' && deposit.qr_image_base64 && deposit.status === 'pending' && (
                                                        <img src={deposit.qr_image_base64} alt="QR" className="h-40 w-40" />
                                                    )}
                                                    {deposit.status === 'pending' && deposit.expires_at && (
                                                        <p className={expired ? "text-danger" : "text-body-color"}>
                                                            {expired ? 'Expired at' : 'Valid until'} {new Date(deposit.expires_at).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    </Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
