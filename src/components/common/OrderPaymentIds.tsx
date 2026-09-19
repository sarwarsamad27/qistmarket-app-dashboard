import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

type PaymentIds = {
    hasLedger: boolean;
    oneBillId?: string | null;
    smartPayId?: string | null;
    amount?: number;
    qrImage?: string | null;
};

const CopyRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-gray-800">
        <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="break-all font-mono text-sm font-bold text-dark dark:text-white">{value || 'Not generated'}</p>
        </div>
        {value && (
            <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(value); toast.success(`${label} copied`); }}
                className="shrink-0 text-xs font-bold text-primary hover:underline"
            >
                Copy
            </button>
        )}
    </div>
);

/** Customer's 1Bill ID, SmartPay ID and a SmartPay QR for the amount payable now. */
export const OrderPaymentIds = ({ orderId }: { orderId: number }) => {
    const [data, setData] = useState<PaymentIds | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}/payment-ids`, {
                    headers: { Authorization: `Bearer ${Cookies.get('auth_token')}` },
                });
                const json = await res.json();
                if (!cancelled && json.success) setData(json.data);
            } catch {
                /* card is informational — stay hidden on failure */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [orderId]);

    if (loading) return <p className="mb-4 text-xs text-gray-400">Loading payment IDs...</p>;
    if (!data?.hasLedger) return null;

    return (
        <div className="mb-4 grid gap-3 rounded-lg border border-stroke bg-white/60 p-3 dark:border-dark-3 dark:bg-dark-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
                <CopyRow label="1Bill ID" value={data.oneBillId} />
                <CopyRow label="SmartPay Consumer No" value={data.smartPayId} />
                {!!data.amount && data.amount > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        QR amount (payable now): <span className="font-bold text-dark dark:text-white">Rs. {data.amount.toLocaleString()}</span>
                    </p>
                )}
            </div>
            <div className="flex flex-col items-center justify-center">
                {data.qrImage ? (
                    <>
                        <img src={data.qrImage} alt="SmartPay QR" className="h-36 w-36 rounded-lg border border-stroke bg-white object-contain p-1" />
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">SmartPay QR</p>
                    </>
                ) : (
                    <p className="max-w-[9rem] text-center text-xs text-gray-400">
                        {data.amount ? 'QR could not be generated.' : 'No amount due — no QR.'}
                    </p>
                )}
            </div>
        </div>
    );
};
