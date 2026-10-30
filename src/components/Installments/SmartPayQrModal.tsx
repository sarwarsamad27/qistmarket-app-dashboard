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
    const [loading, setLoading] = useState(true);
    const [qrData, setQrData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!open || !orderId || monthNumber === null) return;
        let active = true;
        const controller = new AbortController();
        setLoading(true);
        setQrData(null);
        setError(null);
        const load = async () => {
            try {
                const amount = Number(defaultAmount);
                if (!Number.isFinite(amount) || amount <= 0) throw new Error('No payable amount available. Refresh the installment list.');
                const existingResponse = await fetch(`${API_BASE}/api/outlet/installment/check-smartpay-qr?order_id=${orderId}&month_number=${monthNumber}`, {
                    headers: getAuthHeaders(), signal: controller.signal,
                });
                const existing = await existingResponse.json();
                if (!existingResponse.ok || !existing.success) throw new Error(existing.message || 'Unable to check QR status');
                const saved = existing.data;
                const valid = saved && !saved.is_expired && Number(saved.amount) === amount
                    && (!saved.expires_at || new Date(saved.expires_at).getTime() > Date.now());
                if (!active) return;
                if (valid) {
                    setQrData(saved);
                } else {
                    const response = await fetch(`${API_BASE}/api/outlet/installment/generate-smartpay-qr`, {
                        method: 'POST', headers: getAuthHeaders(), signal: controller.signal,
                        body: JSON.stringify({ order_id: orderId, month_number: monthNumber, amount, force_regenerate: !!saved }),
                    });
                    const result = await response.json();
                    if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'Failed to generate QR');
                    if (active) setQrData(result.data);
                }
            } catch (e) {
                if (active) setError(getErrorMessage(e, 'Unable to generate QR'));
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; controller.abort(); };
    }, [open, orderId, monthNumber, defaultAmount, retry]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div role="dialog" aria-modal="true" aria-label="SmartPay QR" className="relative w-full max-w-sm rounded-[32px] bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#1a365d] to-[#2b6cb0] p-6 text-white text-center">
                    <button onClick={onClose} aria-label="Close QR" className="absolute right-4 top-4 rounded-full px-3 py-1 bg-white/10">?</button>
                    <h3 className="font-black text-xl">SmartPay DQR</h3>
                    <p className="text-xs mt-2">Month {monthNumber} ? {customerName}</p>
                </div>
                <div className="p-6 text-center">
                    {loading ? <div role="status" className="py-10">
                        <div className="mx-auto w-8 h-8 border-4 border-[#2b6cb0] border-t-transparent rounded-full animate-spin" />
                        <p className="mt-4 text-sm">Generating QR...</p>
                    </div> : error ? <div>
                        <p role="alert" className="text-sm text-red-600">{error}</p>
                        <button onClick={() => setRetry(r => r + 1)} className="mt-4 rounded-xl bg-[#2b6cb0] px-6 py-3 text-white font-bold">Retry</button>
                    </div> : qrData ? <div className="flex flex-col items-center">
                        <div className="bg-white p-3 rounded-2xl border mb-4">
                            <img src={qrData.qr_image_base64} alt="SmartPay QR" className="w-48 h-48 object-contain" />
                        </div>
                        <p className="text-xs text-gray-500">Amount to pay</p>
                        <p className="text-2xl font-black dark:text-white">{pkr(qrData.amount)}</p>
                        {qrData.expires_at && <p className="mt-3 text-xs text-orange-600">Expires: {formatExactDate(qrData.expires_at)}</p>}
                    </div> : null}
                </div>
            </div>
        </div>
    );
}
