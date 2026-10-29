import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

type PaymentIds = {
    hasLedger: boolean;
    oneBillId?: string | null;
    deletedOneBillId?: string | null;
    smartPayId?: string | null;
    amount?: number;
    qrImage?: string | null;
};

const CopyRow = ({ label, value, deleted = false }: { label: string; value?: string | null; deleted?: boolean }) => (
    <div className={`flex items-center justify-between gap-3 rounded-lg p-3 shadow-sm ${deleted ? 'bg-gray-100 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'}`}>
        <div className="min-w-0">
            <p className={`text-xs ${deleted ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{label}{deleted ? ' · Deleted (view only)' : ''}</p>
            <p className={`break-all font-mono text-sm font-bold ${deleted ? 'text-gray-400' : 'text-dark dark:text-white'}`}>{value || 'Not generated'}</p>
        </div>
        {value && !deleted && (
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
export const OrderPaymentIds = ({
    orderId,
    ledgerId,
    canDelete = false,
    onSaved,
}: {
    orderId: number;
    ledgerId?: number;
    canDelete?: boolean;
    onSaved?: () => Promise<void> | void;
}) => {
    const [data, setData] = useState<PaymentIds | null>(null);
    const [loading, setLoading] = useState(true);
    const [qrLoading, setQrLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const deleteOneBillId = async () => {
        if (!ledgerId || !data?.oneBillId || !window.confirm(`Delete 1Bill ID ${data.oneBillId}? It will stop working for payments and remain visible in grey as history.`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/ledger/${ledgerId}/onebill`, {
                method: 'DELETE',
                headers: { Authorization: `******'auth_token')}` },
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to delete 1Bill ID');
            setData((prev) => prev ? { ...prev, oneBillId: null, deletedOneBillId: json.data?.deletedOneBillId || prev.oneBillId } : prev);
            toast.success(json.message);
            await onSaved?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete 1Bill ID');
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        const get = async (withQr: boolean) => {
            const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}/payment-ids${withQr ? '' : '?qr=0'}`, {
                headers: { Authorization: `Bearer ${Cookies.get('auth_token')}` },
            });
            const json = await res.json();
            return json.success ? (json.data as PaymentIds) : null;
        };
        (async () => {
            try {
                // IDs and amount first (instant); the QR can need a slow SmartPay call.
                const basic = await get(false);
                if (cancelled) return;
                setData(basic);
                setLoading(false);
                if (!basic?.hasLedger || !basic.smartPayId || !(basic.amount && basic.amount > 0)) return;
                setQrLoading(true);
                const full = await get(true);
                if (!cancelled && full) setData((prev) => ({ ...(prev || full), qrImage: full.qrImage }));
            } catch {
                /* card is informational — stay hidden on failure */
            } finally {
                if (!cancelled) { setLoading(false); setQrLoading(false); }
            }
        })();
        return () => { cancelled = true; };
    }, [orderId]);

    if (loading) return <p className="mb-4 text-xs text-gray-400">Loading payment IDs...</p>;
    if (!data?.hasLedger) return null;

    return (
        <div className="mb-4 grid gap-3 rounded-lg border border-stroke bg-white/60 p-3 dark:border-dark-3 dark:bg-dark-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
                {(data.oneBillId || !data.deletedOneBillId) && <CopyRow label="1Bill ID" value={data.oneBillId} />}
                {data.deletedOneBillId && <CopyRow label="1Bill ID" value={data.deletedOneBillId} deleted />}
                {canDelete && data.oneBillId && (
                    <button
                        type="button"
                        onClick={deleteOneBillId}
                        disabled={deleting}
                        className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950"
                    >
                        {deleting ? 'Deleting…' : 'Delete 1Bill ID'}
                    </button>
                )}
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
                ) : qrLoading ? (
                    <div className="flex h-36 w-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stroke text-xs text-gray-400 dark:border-dark-3">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                        Generating QR...
                    </div>
                ) : (
                    <p className="max-w-[9rem] text-center text-xs text-gray-400">
                        {data.amount ? 'QR could not be generated.' : 'No amount due — no QR.'}
                    </p>
                )}
            </div>
        </div>
    );
};
