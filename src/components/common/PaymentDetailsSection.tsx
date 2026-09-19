import React, { useState } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { formatExactDate } from '@/utils/dateUtils';
import { Modal } from '@/components/Modal/Modal';
import { OrderPaymentIds } from './OrderPaymentIds';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

type EditableRow = {
    month: number;
    label: string;
    due_date: string;
    amount: string; // kept as string while editing, parsed on save
    paid_amount: string;
    payment_method: string;
};

export const PaymentDetailsSection = ({
    paymentDetails,
    title = "Payment Details",
    editable = false,
    orderId,
    onSaved,
    returned = false,
}: {
    paymentDetails: any,
    title?: string,
    editable?: boolean,
    /** Needed only for the missing-ledger repair action. */
    orderId?: number,
    onSaved?: () => Promise<void> | void,
    /** This is a returned order's historical schedule — the row carrying
     * arrears is where collection actually stopped, not an active "still
     * owed" balance, so it gets a clearer label than the live-ledger "arr" badge. */
    returned?: boolean,
}) => {
    const [expandedInstallments, setExpandedInstallments] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedRows, setEditedRows] = useState<EditableRow[]>([]);
    const [savingRows, setSavingRows] = useState(false);
    const [monthsInput, setMonthsInput] = useState('');
    const [confirmMonthsOpen, setConfirmMonthsOpen] = useState(false);
    const [savingMonths, setSavingMonths] = useState(false);
    const [isEditingAdvance, setIsEditingAdvance] = useState(false);
    const [advanceForm, setAdvanceForm] = useState({ amount: '', paid_amount: '', payment_method: '' });
    const [savingAdvance, setSavingAdvance] = useState(false);
    const [rebuildingLedger, setRebuildingLedger] = useState(false);

    if (!paymentDetails) return null;

    const ledgerId = paymentDetails.installment_plan?.ledger_id;
    const installments = paymentDetails.installment_plan?.installments || [];
    // Set by the API when the order has a delivery but no ledger row at all —
    // i.e. delivery completed but the ledger write failed afterwards.
    const ledgerMissing = !!paymentDetails.ledger_missing && !ledgerId;

    const handleRebuildLedger = async () => {
        if (!orderId) return;
        const token = Cookies.get('auth_token');
        if (!token) {
            toast.error('Authentication required');
            return;
        }
        setRebuildingLedger(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/ledger/rebuild/${orderId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to generate ledger');
            toast.success(json.message || 'Ledger generated successfully');
            if (onSaved) await onSaved();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to generate ledger');
        } finally {
            setRebuildingLedger(false);
        }
    };

    const startEdit = () => {
        setEditedRows(installments.map((inst: any) => ({
            month: inst.month,
            label: inst.label,
            due_date: inst.due_date ? new Date(inst.due_date).toISOString().slice(0, 10) : '',
            amount: String(inst.due_amount ?? 0),
            paid_amount: String(inst.paid_amount ?? 0),
            payment_method: inst.payment_method || '',
        })));
        setIsEditMode(true);
    };

    const updateRow = (month: number, field: keyof EditableRow, value: string) => {
        setEditedRows((rows) => rows.map((r) => (r.month === month ? { ...r, [field]: value } : r)));
    };

    const handleSaveRows = async () => {
        if (!ledgerId) return;
        const token = Cookies.get('auth_token');
        if (!token) {
            toast.error('Authentication required');
            return;
        }
        setSavingRows(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/ledger/${ledgerId}/edit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    rows: editedRows.map((r) => ({
                        month: r.month,
                        label: r.label,
                        due_date: r.due_date,
                        amount: parseFloat(r.amount) || 0,
                        paid_amount: parseFloat(r.paid_amount) || 0,
                        payment_method: r.payment_method || null,
                    })),
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save ledger');
            toast.success('Ledger updated successfully');
            setIsEditMode(false);
            if (onSaved) await onSaved();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to save ledger');
        } finally {
            setSavingRows(false);
        }
    };

    const startEditAdvance = () => {
        setAdvanceForm({
            amount: String(paymentDetails.advance_payment?.amount ?? 0),
            paid_amount: paymentDetails.advance_payment?.status === 'paid' || paymentDetails.advance_payment?.status === 'partial'
                ? String(paymentDetails.advance_payment?.amount ?? 0)
                : '0',
            payment_method: paymentDetails.advance_payment?.payment_method || '',
        });
        setIsEditingAdvance(true);
    };

    const handleSaveAdvance = async () => {
        if (!ledgerId) return;
        const token = Cookies.get('auth_token');
        if (!token) {
            toast.error('Authentication required');
            return;
        }
        setSavingAdvance(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/ledger/${ledgerId}/edit`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    advance_payment: {
                        amount: parseFloat(advanceForm.amount) || 0,
                        paid_amount: parseFloat(advanceForm.paid_amount) || 0,
                        payment_method: advanceForm.payment_method || null,
                    },
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save advance payment');
            toast.success('Advance payment updated');
            setIsEditingAdvance(false);
            if (onSaved) await onSaved();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to save advance payment');
        } finally {
            setSavingAdvance(false);
        }
    };

    const openMonthsConfirm = () => {
        setMonthsInput(String(paymentDetails.installment_plan?.summary?.total_installments || installments.length));
        setConfirmMonthsOpen(true);
    };

    const handleSaveMonths = async () => {
        if (!ledgerId) return;
        const months = parseInt(monthsInput, 10);
        if (!months || months < 1) {
            toast.error('Enter a valid number of months');
            return;
        }
        const token = Cookies.get('auth_token');
        if (!token) {
            toast.error('Authentication required');
            return;
        }
        setSavingMonths(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/ledger/${ledgerId}/set-months`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ months }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to change installment plan');
            toast.success('Installment plan updated');
            setConfirmMonthsOpen(false);
            // The row count just changed underneath any in-progress row edit —
            // drop out of edit mode so a stale editedRows array (built for the
            // old month count) can't be submitted against the new one.
            setIsEditMode(false);
            if (onSaved) await onSaved();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to change installment plan');
        } finally {
            setSavingMonths(false);
        }
    };

    return (
        <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                {title}
            </h3>

            {/* Delivered, but the ledger row was never written. Without this the
                whole card just renders empty and looks like "no data yet". */}
            {ledgerMissing && (
                <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-500/40 dark:bg-orange-500/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <svg className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <div>
                                <h4 className="font-semibold text-orange-800 dark:text-orange-300">Installment ledger missing</h4>
                                <p className="mt-1 text-sm text-orange-700 dark:text-orange-200">
                                    This order was delivered but no installment ledger was created, so there is no
                                    payment schedule, no ledger PDF and no recovery entries for it.
                                    {editable
                                        ? ' Generate it from the delivery record — the schedule will start from the original delivery date.'
                                        : ' Please ask a Super Admin to generate it.'}
                                </p>
                            </div>
                        </div>
                        {editable && orderId && (
                            <button
                                onClick={handleRebuildLedger}
                                disabled={rebuildingLedger}
                                className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {rebuildingLedger ? 'Generating…' : 'Generate Ledger'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Advance Payment */}
            {paymentDetails.advance_payment && (
                <div className="mb-4 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-medium text-dark dark:text-white">Advance Payment</h4>
                        {editable && ledgerId && !isEditingAdvance && (
                            <button onClick={startEditAdvance} className="text-xs font-bold text-primary hover:underline">
                                Edit
                            </button>
                        )}
                    </div>
                    {!isEditingAdvance ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Amount</label>
                                <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
                                    Rs. {paymentDetails.advance_payment.amount?.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Payment Method</label>
                                <p className="mt-1 text-dark dark:text-white">{paymentDetails.advance_payment.payment_method || 'Cash'}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Status</label>
                                <span className={cn(
                                    "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                    paymentDetails.advance_payment.status === 'paid' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                    {paymentDetails.advance_payment.status}
                                </span>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Payment Date</label>
                                <p className="mt-1 text-sm text-dark dark:text-white">
                                    {paymentDetails.advance_payment.paid_at ? formatExactDate(paymentDetails.advance_payment.paid_at) : 'N/A'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Amount</label>
                                    <input
                                        type="number"
                                        value={advanceForm.amount}
                                        onChange={(e) => setAdvanceForm((f) => ({ ...f, amount: e.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Paid Amount</label>
                                    <input
                                        type="number"
                                        value={advanceForm.paid_amount}
                                        onChange={(e) => setAdvanceForm((f) => ({ ...f, paid_amount: e.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Payment Method</label>
                                    <input
                                        type="text"
                                        value={advanceForm.payment_method}
                                        onChange={(e) => setAdvanceForm((f) => ({ ...f, payment_method: e.target.value }))}
                                        placeholder="Cash"
                                        className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">Status &amp; Payment Date are recalculated automatically from Amount vs Paid Amount.</p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSaveAdvance}
                                    disabled={savingAdvance}
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                >
                                    {savingAdvance ? 'Saving...' : 'Save Advance Payment'}
                                </button>
                                <button
                                    onClick={() => setIsEditingAdvance(false)}
                                    disabled={savingAdvance}
                                    className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Installment Plan */}
            {paymentDetails.installment_plan && (
                <div className="rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h4 className="font-medium text-dark dark:text-white">Installment Plan</h4>
                        <div className="flex items-center gap-3">
                            {paymentDetails.installment_plan.token && (
                                <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-mono dark:bg-dark-2">
                                    Token: {paymentDetails.installment_plan.token}
                                </span>
                            )}
                            {editable && ledgerId && (
                                <>
                                    {/* Available in both view and edit mode — it's an independent
                                        action (opens its own modal), no need to Cancel row-editing first. */}
                                    <button
                                        onClick={openMonthsConfirm}
                                        className="text-xs font-bold text-primary hover:underline"
                                    >
                                        Change Total Months
                                    </button>
                                    {!isEditMode && (
                                        <button
                                            onClick={startEdit}
                                            className="text-xs font-bold text-primary hover:underline"
                                        >
                                            Edit Ledger
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-gray-800">
                            <p className="text-2xl font-bold text-primary">
                                {paymentDetails.installment_plan.summary?.total_installments || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total Installments</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-gray-800">
                            <p className="text-2xl font-bold text-green-600">
                                {paymentDetails.installment_plan.summary?.paid_installments || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-gray-800">
                            <p className="text-2xl font-bold text-yellow-600">
                                {paymentDetails.installment_plan.summary?.pending_installments || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                        </div>
                        <div className="rounded-lg bg-white p-3 text-center shadow-sm dark:bg-gray-800">
                            <p className="text-sm font-bold text-dark dark:text-white">
                                Rs. {paymentDetails.installment_plan.summary?.total_paid_amount?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Paid / {paymentDetails.installment_plan.summary?.total_due_amount?.toLocaleString()}</p>
                        </div>
                    </div>

                    {orderId && ledgerId && !returned && <OrderPaymentIds orderId={orderId} />}

                    {/* Progress Bar */}
                    {paymentDetails.installment_plan.summary?.total_installments > 0 && (
                        <div className="mb-4">
                            <div className="mb-1 flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">Payment Progress</span>
                                <span className="font-medium text-dark dark:text-white">
                                    {Math.round((paymentDetails.installment_plan.summary?.paid_installments /
                                       paymentDetails.installment_plan.summary?.total_installments) * 100)}%
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{
                                        width: `${(paymentDetails.installment_plan.summary?.paid_installments /
                                                 paymentDetails.installment_plan.summary?.total_installments) * 100}%`
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Installments Table */}
                    {installments.length > 0 && (
                        <div className="mt-4">
                            <button
                                onClick={() => setExpandedInstallments(!expandedInstallments)}
                                className="mb-3 flex w-full items-center justify-between rounded-lg bg-white px-4 py-2 text-left text-sm font-medium text-dark shadow-sm hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                            >
                                <span>Installment Schedule{isEditMode ? ' (Editing)' : ''}</span>
                                <svg
                                    className={cn("h-4 w-4 transition-transform", expandedInstallments && "rotate-180")}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {expandedInstallments && (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                        <thead className="bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Month</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Due Date</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Amount Due</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Paid</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Remaining</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Status</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Payment Date</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Method</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                                            {!isEditMode ? installments.map((inst: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-4 py-2 text-sm text-dark dark:text-white">{inst.label || `Month ${inst.month}`}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                        {inst.due_date ? new Date(inst.due_date).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm font-medium text-dark dark:text-white">
                                                        Rs. {inst.due_amount?.toLocaleString()}
                                                        {inst.arrears > 0 && (
                                                            returned ? (
                                                                <div className="mt-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                                                    Installments stopped here (+Rs. {inst.arrears?.toLocaleString()} unpaid)
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] text-red-500 font-medium">
                                                                    +{inst.arrears?.toLocaleString()} arr
                                                                </div>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm font-bold text-green-600 dark:text-green-400">
                                                        {inst.paid_amount > 0 ? `Rs. ${inst.paid_amount.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm font-bold text-red-500">
                                                        {inst.remaining_amount > 0 ? `Rs. ${inst.remaining_amount.toLocaleString()}` : '-'}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className={cn(
                                                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
                                                            inst.status === 'paid'
                                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                : (inst.paid_amount > 0 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400")
                                                        )}>
                                                            {inst.paid_amount > 0 && inst.status !== 'paid' ? 'Partial' : inst.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                        {inst.paid_at ? formatExactDate(inst.paid_at, 'DD MMM YYYY, hh:mm A') : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                                                        {inst.payment_method || '-'}
                                                    </td>
                                                </tr>
                                            )) : editedRows.map((row) => (
                                                <tr key={row.month} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-4 py-2 text-sm text-dark dark:text-white whitespace-nowrap">{row.label || `Month ${row.month}`}</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="date"
                                                            value={row.due_date}
                                                            onChange={(e) => updateRow(row.month, 'due_date', e.target.value)}
                                                            className="w-36 rounded border border-stroke bg-white px-2 py-1 text-xs dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.amount}
                                                            onChange={(e) => updateRow(row.month, 'amount', e.target.value)}
                                                            className="w-24 rounded border border-stroke bg-white px-2 py-1 text-xs dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                                        />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="number"
                                                            value={row.paid_amount}
                                                            onChange={(e) => updateRow(row.month, 'paid_amount', e.target.value)}
                                                            className="w-24 rounded border border-stroke bg-white px-2 py-1 text-xs dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-gray-400">
                                                        {(parseFloat(row.amount) || 0) - (parseFloat(row.paid_amount) || 0)}
                                                    </td>
                                                    <td className="px-4 py-2 text-xs text-gray-400 italic">auto</td>
                                                    <td className="px-4 py-2 text-xs text-gray-400">—</td>
                                                    <td className="px-2 py-2">
                                                        <input
                                                            type="text"
                                                            value={row.payment_method}
                                                            onChange={(e) => updateRow(row.month, 'payment_method', e.target.value)}
                                                            placeholder="Cash"
                                                            className="w-24 rounded border border-stroke bg-white px-2 py-1 text-xs dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {isEditMode && (
                                <div className="mt-4 flex items-center gap-3">
                                    <button
                                        onClick={handleSaveRows}
                                        disabled={savingRows}
                                        className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                    >
                                        {savingRows ? 'Saving...' : 'Save Ledger Changes'}
                                    </button>
                                    <button
                                        onClick={() => setIsEditMode(false)}
                                        disabled={savingRows}
                                        className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <span className="text-xs text-gray-400">Status is recalculated automatically from Amount Due vs Paid.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Modal open={confirmMonthsOpen} onClose={() => setConfirmMonthsOpen(false)}>
                <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                    <h2 className="mb-2 text-lg font-bold dark:text-white">Change Total Installment Months</h2>
                    <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                        This regenerates every pending (unpaid) month, spreading the outstanding balance evenly across the new count.
                        Already paid/partial months are never touched.
                    </p>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">New total installment months</label>
                    <input
                        type="number"
                        value={monthsInput}
                        onChange={(e) => setMonthsInput(e.target.value)}
                        className="mb-4 w-full rounded border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-3 dark:text-white"
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setConfirmMonthsOpen(false)}
                            disabled={savingMonths}
                            className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveMonths}
                            disabled={savingMonths}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                            {savingMonths ? 'Saving...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
