"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Clock, RefreshCw, Smartphone, DollarSign, ArrowLeft, X, CheckCircle } from "lucide-react";
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

type PendingSubmission = {
    submission_ref: string;
    total_amount: number;
    submitted_at: string;
    payment_method: string;
    officer: {
        id: number;
        full_name: string;
        username: string;
        phone: string;
        image: string | null;
    } | null;
    order_refs: string[];
};

// ── OTP Verification Popup ─────────────────────────────────────────────────────
function OtpVerifyPopup({
    submission,
    onClose,
    onVerified,
}: {
    submission: PendingSubmission;
    onClose: () => void;
    onVerified: () => void;
}) {
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleVerify = async () => {
        if (otp.length < 4) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/verify-cash-otp`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ otp }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(true);
                toast.success("Cash submission verified successfully!");
                setTimeout(() => {
                    onVerified();
                    onClose();
                }, 1800);
            } else {
                toast.error(data.message || "Invalid OTP, try again.");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Verification failed. Please retry."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-boxdark rounded-3xl shadow-2xl border border-stroke dark:border-strokedark w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Top bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 to-amber-500" />

                <div className="p-6">
                    {success ? (
                        <div className="flex flex-col items-center py-6 gap-4 text-center">
                            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4">
                                <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-black text-gray-800 dark:text-white">Verified!</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Cash submission has been confirmed.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">
                                        Cash Collection
                                    </h2>
                                    <span className="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mt-1 animate-pulse">
                                        Awaiting OTP
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Officer info */}
                            <div className="bg-gray-50 dark:bg-meta-4/30 rounded-2xl p-4 mb-4 flex items-center gap-3 border border-gray-100 dark:border-strokedark">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                                    {submission.officer?.full_name?.substring(0, 2).toUpperCase() ?? "?"}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                                        {submission.officer?.full_name ?? "Unknown"}
                                    </p>
                                    <p className="text-xs text-gray-500">@{submission.officer?.username}</p>
                                </div>
                                <div className="ml-auto text-right shrink-0">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Amount</p>
                                    <p className="font-black text-base text-primary">PKR {submission.total_amount.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* OTP input */}
                            <div className="mb-5">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                    Enter 4-Digit OTP from Officer&apos;s App
                                </label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    placeholder="0  0  0  0"
                                    autoFocus
                                    className="w-full px-4 py-4 bg-gray-50 dark:bg-form-input border-2 border-gray-200 dark:border-strokedark rounded-2xl focus:border-primary outline-none text-center text-4xl tracking-widest font-black text-gray-800 dark:text-white transition-all shadow-inner"
                                    maxLength={4}
                                    onKeyDown={(e) => { if (e.key === "Enter" && otp.length === 4) handleVerify(); }}
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3.5 rounded-2xl bg-gray-100 dark:bg-meta-4 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-meta-4/70 transition-all"
                                >
                                    Later
                                </button>
                                <button
                                    onClick={handleVerify}
                                    disabled={loading || otp.length < 4}
                                    className="flex-[2] bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-3.5 rounded-2xl font-black shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : "Verify & Complete"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PendingSubmissionsPage() {
    const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [resendingOtpFor, setResendingOtpFor] = useState<string | null>(null);
    const [verifyingSubmission, setVerifyingSubmission] = useState<PendingSubmission | null>(null);

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/pending-cash-submissions`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setSubmissions(data.data);
            } else {
                toast.error(data.message || "Failed to fetch pending submissions");
            }
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, "Failed to fetch pending submissions"));
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP → then open OTP verify popup in the dashboard
    const resendAndVerify = async (submission: PendingSubmission) => {
        setResendingOtpFor(submission.submission_ref);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/resend-cash-otp`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ submission_ref: submission.submission_ref }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("OTP sent to officer's app");
                // Open OTP verification popup immediately
                setVerifyingSubmission(submission);
            } else {
                toast.error(data.message || "Failed to resend OTP");
            }
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error, "Failed to resend OTP"));
        } finally {
            setResendingOtpFor(null);
        }
    };

    const handleVerified = () => {
        // Remove the verified submission from list, then refresh
        if (verifyingSubmission) {
            setSubmissions(prev => prev.filter(s => s.submission_ref !== verifyingSubmission.submission_ref));
        }
        fetchSubmissions();
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* OTP Popup */}
            {verifyingSubmission && (
                <OtpVerifyPopup
                    submission={verifyingSubmission}
                    onClose={() => setVerifyingSubmission(null)}
                    onVerified={handleVerified}
                />
            )}

            <div className="flex items-center gap-2 mb-4">
                <Link
                    href="/outlet/cash-in-hand"
                    className="text-gray-500 hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
                >
                    <ArrowLeft size={16} /> Back to Cash in Hand
                </Link>
            </div>

            <Breadcrumb pageName="Pending Submissions" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Clock size={24} className="text-amber-500" /> Pending Submissions
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Officers who submitted cash but OTP verification is pending.
                    </p>
                </div>
                <button
                    onClick={fetchSubmissions}
                    className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
                    <p className="text-sm font-medium">Loading submissions...</p>
                </div>
            ) : submissions.length === 0 ? (
                <div className="bg-white dark:bg-boxdark rounded-2xl border border-dashed border-stroke dark:border-strokedark p-20 text-center text-gray-500 shadow-sm">
                    <Clock size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-1">All clear!</h3>
                    <p>No submissions are currently awaiting OTP verification.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {submissions.map((sub) => (
                        <div
                            key={sub.submission_ref}
                            className="bg-white dark:bg-boxdark rounded-2xl shadow-sm border border-orange-200 dark:border-orange-900 overflow-hidden hover:shadow-lg transition-all duration-300"
                        >
                            {/* Top Orange Bar */}
                            <div className="h-2 w-full bg-gradient-to-r from-orange-400 to-amber-500" />

                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-2 rounded-lg">
                                            <DollarSign size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount</p>
                                            <p className="text-xl font-black text-gray-800 dark:text-white">
                                                PKR {sub.total_amount.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400">
                                        <Clock size={10} /> Awaiting OTP
                                    </span>
                                </div>

                                {/* Officer */}
                                <div className="bg-gray-50 dark:bg-meta-4/30 rounded-xl p-3 mb-4 border border-gray-100 dark:border-strokedark">
                                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Submitted By</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shadow-inner">
                                            {sub.officer?.full_name ? sub.officer.full_name.substring(0, 2).toUpperCase() : "?"}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">
                                                {sub.officer?.full_name ?? "Unknown"}
                                            </p>
                                            <p className="text-xs text-gray-500">@{sub.officer?.username}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Meta */}
                                <div className="flex flex-col gap-2 mb-5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400 font-medium">Ref ID:</span>
                                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-meta-4 px-2 py-0.5 rounded">
                                            {sub.submission_ref}
                                        </span>
                                    </div>
                                    {sub.order_refs.length > 0 && (
                                        <div className="flex justify-between items-start text-sm">
                                            <span className="text-gray-500 dark:text-gray-400 font-medium mt-0.5">Orders:</span>
                                            <span className="font-bold text-gray-700 dark:text-gray-300 text-right max-w-[160px] leading-tight">
                                                {sub.order_refs.join(", ")}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400 font-medium">Time:</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">
                                            {formatExactDate(sub.submitted_at,)}
                                        </span>
                                    </div>
                                </div>

                                {/* Action button */}
                                <button
                                    onClick={() => resendAndVerify(sub)}
                                    disabled={resendingOtpFor === sub.submission_ref}
                                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-3 rounded-xl font-black text-sm transition-all shadow-md shadow-orange-500/20 disabled:opacity-50"
                                >
                                    {resendingOtpFor === sub.submission_ref ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    ) : (
                                        <Smartphone size={16} />
                                    )}
                                    {resendingOtpFor === sub.submission_ref ? "Sending OTP..." : "Resend OTP & Verify"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
