"use client";

import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
    const token = Cookies.get("auth_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const pkr = (n: number) => `PKR ${Number(n || 0).toLocaleString()}`;

type Props = {
    open: boolean;
    onClose: () => void;
    orderId: number | null;
    monthNumber: number | null;
    defaultAmount: number | null;
    customerName: string;
};

export default function SmartPayQrModal({ open, onClose, orderId, monthNumber, defaultAmount, customerName }: Props) {
    const [loading, setLoading] = useState(false);
    const [qrData, setQrData] = useState<any>(null);
    const [amount, setAmount] = useState<string>("");
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && orderId && monthNumber !== null) {
            setAmount(defaultAmount ? defaultAmount.toString() : "");
            setQrData(null);
            setError(null);
            checkExistingQr();
        }
    }, [open, orderId, monthNumber]);

    const checkExistingQr = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/installment/check-smartpay-qr?order_id=${orderId}&month_number=${monthNumber}`, {
                headers: getAuthHeaders(),
            });
            const result = await res.json();
            if (result.success && result.data) {
                setQrData(result.data);
                if (result.data.amount) {
                    setAmount(result.data.amount.toString());
                }
            }
        } catch (e) {
            console.error("Error checking QR", e);
        } finally {
            setLoading(false);
        }
    };

    const generateQr = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        setGenerating(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/installment/generate-smartpay-qr`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    order_id: orderId,
                    month_number: monthNumber,
                    amount: amt,
                    force_regenerate: true
                }),
            });
            const result = await res.json();
            if (result.success && result.data) {
                setQrData(result.data);
            } else {
                setError(result.message || "Failed to generate QR");
            }
        } catch (e) {
            console.error("Error generating QR", e);
            setError(getErrorMessage(e, "Something went wrong"));
        } finally {
            setGenerating(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-sm rounded-[32px] bg-white dark:bg-gray-900 shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 animate-fade-in-up">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#1a365d] to-[#2b6cb0] p-6 text-white text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="w-12 h-12 bg-white rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-lg">
                        <svg className="w-7 h-7 text-[#2b6cb0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                    </div>
                    <h3 className="font-black text-xl tracking-tight">SmartPay DQR</h3>
                    <p className="text-xs font-medium text-blue-100 opacity-80 mt-1">
                        Month {monthNumber} • {customerName}
                    </p>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <div className="w-8 h-8 border-4 border-[#2b6cb0] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-semibold text-gray-500 mt-4">Checking QR Status...</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {error && (
                                <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl border border-red-100">
                                    {error}
                                </div>
                            )}

                            {/* View Mode (QR Exists & Not Expired) */}
                            {qrData && !qrData.is_expired ? (
                                <div className="flex flex-col items-center text-center">
                                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-4">
                                        <img src={qrData.qr_image_base64} alt="SmartPay QR" className="w-48 h-48 object-contain" />
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">To Pay</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">{pkr(qrData.amount)}</p>
                                    
                                    {qrData.expires_at && (
                                        <p className="text-xs text-orange-500 font-bold mt-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                                            Expires: {formatExactDate(qrData.expires_at)}
                                        </p>
                                    )}

                                    <div className="w-full h-[1px] bg-gray-100 dark:bg-gray-800 my-5"></div>
                                    
                                    <p className="text-xs text-gray-500 font-medium mb-3">Want to change the amount?</p>
                                    <button
                                        onClick={() => setQrData(null)}
                                        className="w-full py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm hover:border-[#2b6cb0] hover:text-[#2b6cb0] transition-colors"
                                    >
                                        Regenerate QR
                                    </button>
                                </div>
                            ) : (
                                /* Generate or Expired Mode */
                                <div className="space-y-4">
                                    {qrData && qrData.is_expired && (
                                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center mb-6">
                                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                            <h4 className="font-bold text-red-800 text-sm">QR Code Expired</h4>
                                            <p className="text-xs text-red-600 mt-1">The previous QR of {pkr(qrData.amount)} has expired. Please generate a new one.</p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                                            Amount to Collect (PKR)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rs.</span>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-black text-lg outline-none focus:ring-2 focus:ring-[#2b6cb0] transition-shadow"
                                                placeholder="0"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-2 ml-1 font-medium">
                                            Leave as default for full due amount, or change for partial payment.
                                        </p>
                                    </div>

                                    <button
                                        onClick={generateQr}
                                        disabled={generating || !amount || parseFloat(amount) <= 0}
                                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1a365d] to-[#2b6cb0] text-white font-black text-sm shadow-lg shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4"
                                    >
                                        {generating ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Generating...
                                            </>
                                        ) : (
                                            <>Generate QR</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
