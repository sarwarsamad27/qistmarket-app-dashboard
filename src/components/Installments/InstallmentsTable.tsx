"use client";

import React, { useState } from "react";
import Cookies from "js-cookie";
import SmartPayQrModal from "./SmartPayQrModal";
import { formatExactDate } from "@/utils/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const pkr = (n: number) => `PKR ${Number(n || 0).toLocaleString()}`;
const getImageUrl = (path: string | undefined | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};
const getAuthHeaders = () => {
    const token = Cookies.get("auth_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

type InstallmentRow = {
    monthNumber: number;
    label: string;
    dueDate: string | null;
    dueAmount: number;
    status: string;
    paidAt: string | null;
    paymentMethod: string | null;
    arrears?: number;
    paidAmount?: number;
    remainingAmount?: number;
    payment_history?: { amount: number; date: string; method: string }[];
    month?: number;
    due_date?: string | null;
};

type OrderInstallment = {
    order_id: number;
    order_ref: string;
    customer_name: string;
    whatsapp_number: string;
    product_name: string;
    imei_serial: string;
    ledger_short_id: string | null;
    purchaser: any;
    grantors: any[];
    ledgerSummaries: {
        advanceAmount: number;
        monthlyAmount: number;
        totalMonths: number;
        totalInstallmentDue: number;
        totalInstallmentPaid: number;
        totalRemaining: number;
        paidInstallments: number;
        totalInstallments: number;
    };
    installmentLedger: InstallmentRow[];
    consumer_number: string | null;
    smartpay_consumer_number: string | null;
    consumer_bill_status: string | null;
    recovery_officer: { id: number; name: string; phone: string } | null;
    tpsPayments?: any[];
    paytrigger_status?: string | null;
};

type Props = {
    data: OrderInstallment[];
    onPay: (order: OrderInstallment, installment: InstallmentRow) => void;
    selectedIds?: number[];
    onSelectRow?: (id: number) => void;
};

export default function InstallmentsTable({ data, onPay, selectedIds = [], onSelectRow }: Props) {
    const [expandedRows, setExpandedRows] = useState<number[]>([]);

    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrOrderId, setQrOrderId] = useState<number | null>(null);
    const [qrMonthNumber, setQrMonthNumber] = useState<number | null>(null);
    const [qrDefaultAmount, setQrDefaultAmount] = useState<number | null>(null);
    const [qrCustomerName, setQrCustomerName] = useState("");

    // PTP Modal state
    const [ptpModalOpen, setPtpModalOpen] = useState(false);
    const [ptpOrder, setPtpOrder] = useState<OrderInstallment | null>(null);
    const [ptpDate, setPtpDate] = useState("");
    const [ptpLoading, setPtpLoading] = useState(false);

    // Get tomorrow's date string for min date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // PTP can unlock the device for at most 10 days
    const maxPtp = new Date();
    maxPtp.setDate(maxPtp.getDate() + 10);
    const maxPtpStr = maxPtp.toISOString().split("T")[0];

    // Pre-fill date 7 days from now (matching recovery app default)
    const defaultPtpDate = new Date();
    defaultPtpDate.setDate(defaultPtpDate.getDate() + 7);
    const defaultPtpDateStr = defaultPtpDate.toISOString().split("T")[0];

    const openPtpModal = (order: OrderInstallment) => {
        setPtpOrder(order);
        setPtpDate(defaultPtpDateStr);
        setPtpModalOpen(true);
    };

    const handleSubmitPtp = async () => {
        if (!ptpOrder || !ptpDate) return;
        if (!ptpOrder.imei_serial) {
            alert("No IMEI/device associated with this order");
            return;
        }
        if (ptpDate > maxPtpStr) {
            alert("Promised payment date cannot be more than 10 days from today");
            return;
        }

        const promisedDate = new Date(ptpDate);
        promisedDate.setHours(23, 59, 59, 999);

        setPtpLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/paytrigger/device/${ptpOrder.imei_serial}/ptp`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    promised_date: promisedDate.toISOString(),
                }),
            });
            const d = await res.json();
            if (d.success) {
                alert(`✅ PTP activated! Device temporarily unlocked until ${new Date(ptpDate).toLocaleDateString('en-PK')}. Customer notified via WhatsApp.`);
                setPtpModalOpen(false);
            } else {
                alert(`❌ ${d.message || "Failed to activate PTP"}`);
            }
        } catch (e) {
            console.error(e);
            alert("Error communicating with Software Activation");
        } finally {
            setPtpLoading(false);
        }
    };

    const toggleRow = (id: number) => {
        setExpandedRows(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 text-xs font-semibold uppercase tracking-wider">
                            <th className="px-6 py-4 w-10">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    onChange={(e) => {
                                        if (onSelectRow) {
                                            data.forEach(order => {
                                                if (e.target.checked && !selectedIds.includes(order.order_id)) {
                                                    onSelectRow(order.order_id);
                                                } else if (!e.target.checked && selectedIds.includes(order.order_id)) {
                                                    onSelectRow(order.order_id);
                                                }
                                            });
                                        }
                                    }}
                                />
                            </th>
                            <th className="px-6 py-4">Order Ref</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Product</th>
                            <th className="px-6 py-4">Next Due</th>
                            <th className="px-6 py-4">Installments</th>
                            <th className="px-6 py-4">Progress</th>
                            <th className="px-6 py-4 text-center">Software Activation</th>
                            <th className="px-6 py-4 text-center">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data.map((order) => {
                            const isExpanded = expandedRows.includes(order.order_id);
                            const nextPending = order.installmentLedger?.find(r => r.status === 'pending');
                            const { paidInstallments = 0, totalInstallments = 0, totalRemaining = 0, advanceAmount = 0,
                                totalInstallmentDue = 0, totalInstallmentPaid = 0 } = order.ledgerSummaries || {};
                            const progress = totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;
                            const allPaid = totalInstallments > 0 && paidInstallments === totalInstallments;

                            return (
                                <React.Fragment key={order.order_id}>
                                    {/* ── Summary Row ──────────────────────────────────── */}
                                    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${selectedIds.includes(order.order_id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(order.order_id)}
                                                onChange={() => onSelectRow?.(order.order_id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-gray-800 dark:text-gray-200">#{order.order_ref}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {order.purchaser?.profile_photo ? (
                                                    <img
                                                        src={getImageUrl(order.purchaser.profile_photo)}
                                                        alt={order.customer_name}
                                                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                        {order.customer_name.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-800 dark:text-gray-200">{order.customer_name}</p>
                                                    <p className="text-xs text-gray-500">{order.whatsapp_number}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm dark:text-gray-300">{order.product_name}</p>
                                            <p className="text-[10px] text-gray-400">IMEI: {order.imei_serial || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const ledgerRows = order.installmentLedger || [];
                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                // "Current" = the most recently overdue unpaid row (latest due date
                                                // that has already passed) — catch-up first, matching the backend's
                                                // getNormalizedLedger arrears rule. Falls back to the earliest
                                                // unpaid row when nothing has come due yet.
                                                const unpaid = ledgerRows.map((r, i) => ((r.monthNumber ?? r.month ?? 0) > 0 && r.status !== 'paid') ? i : -1).filter(i => i !== -1);
                                                let actIdx = -1;
                                                for (const i of unpaid) {
                                                    const dueDate = ledgerRows[i].dueDate || ledgerRows[i].due_date;
                                                    const d = dueDate ? new Date(dueDate) : null;
                                                    if (!d || isNaN(d.getTime())) { actIdx = i; continue; }
                                                    d.setHours(0, 0, 0, 0);
                                                    if (d <= today) actIdx = i;
                                                }
                                                if (actIdx === -1 && unpaid.length > 0) actIdx = unpaid[0];
                                                const activeNext = actIdx !== -1 ? ledgerRows[actIdx] : null;
                                                if (!activeNext) return <span className="text-xs text-green-500 font-semibold">✓ Fully Paid</span>;

                                                const rem = activeNext.remainingAmount ?? (activeNext.dueAmount - (activeNext.paidAmount || 0));
                                                const totalPayable = rem + (activeNext.arrears || 0);

                                                return (
                                                    <div>
                                                        <p className={`text-sm font-black ${activeNext.paidAmount && activeNext.paidAmount > 0 ? 'text-blue-600' : 'text-gray-800 dark:text-gray-200'}`}>
                                                            {pkr(totalPayable)}
                                                        </p>
                                                        {activeNext.paidAmount && activeNext.paidAmount > 0 ? (
                                                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">
                                                                Partial: {pkr(activeNext.paidAmount)}
                                                            </p>
                                                        ) : null}
                                                        {activeNext.arrears ? (
                                                            <p className="text-[10px] text-red-500 font-medium mt-0.5">
                                                                (Base {pkr(rem)} + {pkr(activeNext.arrears)} arrears)
                                                            </p>
                                                        ) : null}
                                                        <p className="text-[10px] text-gray-500 mt-1">
                                                            {activeNext.label} · {activeNext.dueDate ? new Date(activeNext.dueDate).toLocaleDateString('en-PK') : 'N/A'}
                                                        </p>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className={`text-sm font-bold ${totalRemaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {pkr(totalRemaining)}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {paidInstallments}/{totalInstallments} paid · Adv: {pkr(advanceAmount)}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${allPaid ? 'bg-green-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${Math.min(100, progress)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1">{Math.round(progress)}% done</p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {order.paytrigger_status ? (
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg ${
                                                    order.paytrigger_status === 'locked' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    order.paytrigger_status === 'unlocked' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    order.paytrigger_status === 'active_lock' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    order.paytrigger_status === 'pre_enrolled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                }`}>
                                                    {order.paytrigger_status === 'locked' ? '🔒 LOCKED' :
                                                     order.paytrigger_status === 'unlocked' ? '🔓 UNLOCKED' :
                                                     order.paytrigger_status === 'active_lock' ? '⚠ ACTIVE LOCK' :
                                                     order.paytrigger_status === 'pre_enrolled' ? '📱 PRE-ENROLLED' :
                                                     order.paytrigger_status.toUpperCase()}
                                                </span>
                                            ) : (
                                                <span className="text-[9px] text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleRow(order.order_id)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-blue-600"
                                                title={isExpanded ? "Collapse" : "Expand Ledger"}
                                            >
                                                {isExpanded ? (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                )}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* ── Expanded Ledger Panel ────────────────────────── */}
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-8 bg-gray-50/70 dark:bg-gray-800/60 border-t border-gray-100 dark:border-gray-700">

                                                <div className="flex flex-col xl:flex-row gap-8">
                                                    {/* Left Side: People Details */}
                                                    <div className="xl:w-1/3 space-y-6">
                                                        {/* Purchaser */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                                Purchaser Details
                                                            </h4>
                                                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                                                                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                                                    {order.purchaser?.profile_photo ? (
                                                                        <img src={getImageUrl(order.purchaser.profile_photo)} className="w-full h-full object-cover" alt="" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{order.customer_name}</p>
                                                                    <p className="text-xs text-gray-500 mt-1">CNIC: {order.purchaser?.cnic_number || 'N/A'}</p>
                                                                    <p className="text-xs text-gray-500">S/O: {order.purchaser?.father_husband_name || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Grantors */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                Guarantors
                                                            </h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {order.grantors?.map((g, gi) => (
                                                                    <div key={gi} className="bg-white dark:bg-gray-800 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                                                                            {g.profile_photo ? (
                                                                                <img src={getImageUrl(g.profile_photo)} className="w-full h-full object-cover" alt="" />
                                                                            ) : (
                                                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{g.name}</p>
                                                                            <p className="text-[9px] text-gray-500 truncate">{g.relationship || 'Grantor'}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {(!order.grantors || order.grantors.length === 0) && (
                                                                    <p className="text-xs text-gray-400 italic col-span-2">No grantor data available</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Consumer Numbers */}
                                                        {order.consumer_number && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                                    1Bill Consumer No.
                                                                </h4>
                                                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                    <p className="font-mono font-bold text-lg text-gray-800 dark:text-gray-100 tracking-widest">
                                                                        {order.consumer_number}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {order.smartpay_consumer_number && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                    SmartPay Consumer No.
                                                                </h4>
                                                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
                                                                    <p className="font-mono font-bold text-lg text-gray-800 dark:text-gray-100 tracking-widest">
                                                                        {order.smartpay_consumer_number}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Recovery Officer */}
                                                        {order.recovery_officer && (
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                                    Recovery Officer
                                                                </h4>
                                                                <div className="bg-white dark:bg-gray-800 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 font-bold text-xs flex-shrink-0">
                                                                        {order.recovery_officer.name.charAt(0)}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{order.recovery_officer.name}</p>
                                                                        <p className="text-xs text-gray-500">{order.recovery_officer.phone || 'N/A'}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right Side: Ledger and Summaries */}
                                                    <div className="xl:w-2/3">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                            Installment Ledger
                                                        </h4>

                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 text-center">
                                                                <p className="text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-tight">Advance</p>
                                                                <p className="text-amber-800 dark:text-amber-300 text-sm font-extrabold mt-1">{pkr(advanceAmount)}</p>
                                                            </div>
                                                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 text-center">
                                                                <p className="text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-tight">Total Due</p>
                                                                <p className="text-blue-800 dark:text-blue-300 text-sm font-extrabold mt-1">{pkr(totalInstallmentDue)}</p>
                                                            </div>
                                                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-xl p-3 text-center">
                                                                <p className="text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-tight">Collected</p>
                                                                <p className="text-green-800 dark:text-green-300 text-sm font-extrabold mt-1">{pkr(totalInstallmentPaid)}</p>
                                                            </div>
                                                            <div className={`${totalRemaining > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100' : 'bg-green-50 dark:bg-green-900/20 border-green-100'} border rounded-xl p-3 text-center`}>
                                                                <p className={`${totalRemaining > 0 ? 'text-red-600' : 'text-green-600'} text-[10px] font-bold uppercase tracking-tight`}>Remaining</p>
                                                                <p className={`${totalRemaining > 0 ? 'text-red-800' : 'text-green-800'} text-sm font-extrabold mt-1`}>{pkr(totalRemaining)}</p>
                                                            </div>
                                                        </div>

                                                        {/* ── Per-Month Payment Detail Rows ── */}
                                                        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                                            {/* Header */}
                                                            <div className="grid grid-cols-[52px_1fr_auto_auto_auto] gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700/60 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                                <span>Month</span>
                                                                <span>Amount / Details</span>
                                                                <span className="text-right">Paid</span>
                                                                <span className="text-right">Remaining</span>
                                                                <span className="text-center">Action</span>
                                                            </div>
                                                            {(() => {
                                                                const ledgerRows = order.installmentLedger || [];
                                                                const today = new Date(); today.setHours(0, 0, 0, 0);

                                                                const unpaidIndices = ledgerRows
                                                                    .map((r, i) => ((r.monthNumber ?? r.month ?? 0) > 0 && r.status !== 'paid') ? i : -1)
                                                                    .filter(i => i !== -1);

                                                                // Active open/payable index: the most recently overdue unpaid
                                                                // month (latest due date that has already passed) — catch up
                                                                // on backlog first, matching getNormalizedLedger's arrears
                                                                // rule. Falls back to the earliest unpaid month when nothing
                                                                // has come due yet.
                                                                let activePayableIndex = -1;
                                                                for (const i of unpaidIndices) {
                                                                    const dueDate = ledgerRows[i].dueDate || ledgerRows[i].due_date;
                                                                    const d = dueDate ? new Date(dueDate) : null;
                                                                    if (!d || isNaN(d.getTime())) { activePayableIndex = i; continue; }
                                                                    d.setHours(0, 0, 0, 0);
                                                                    if (d <= today) activePayableIndex = i;
                                                                }
                                                                if (activePayableIndex === -1 && unpaidIndices.length > 0) {
                                                                    activePayableIndex = unpaidIndices[0];
                                                                }
                                                                // The final unpaid installment must never stay locked once it's due -
                                                                // otherwise the customer has no way left to finish paying off the loan.
                                                                const lastUnpaidIndex = unpaidIndices.length > 0 ? unpaidIndices[unpaidIndices.length - 1] : -1;

                                                                return ledgerRows.map((inst, idx) => {
                                                                const isPaid = inst.status === 'paid';
                                                                const isPartial = inst.status === 'partial' || (!isPaid && (inst.paidAmount || 0) > 0);
                                                                const isNext = !isPaid && !isPartial && (order.installmentLedger || [])
                                                                    .filter(r => r.monthNumber < inst.monthNumber)
                                                                    .every(r => r.status === 'paid');
                                                                const instDueDate = inst.dueDate ? new Date(inst.dueDate) : null;
                                                                instDueDate?.setHours(0, 0, 0, 0);
                                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                                const isOverdue = !isPaid && instDueDate && instDueDate < today;
                                                                const isFinalDueUnlock = idx === lastUnpaidIndex && !isPaid && instDueDate !== null && instDueDate <= today;
                                                                const isPayable = idx === activePayableIndex || isFinalDueUnlock;
                                                                const hasArrears = (inst.arrears || 0) > 0;
                                                                const paidAmt = inst.paidAmount || 0;
                                                                const remAmt = inst.remainingAmount ?? (inst.dueAmount - paidAmt);

                                                                const rowBg = isPaid
                                                                    ? 'bg-green-50/50 dark:bg-green-900/5'
                                                                    : isPartial
                                                                        ? 'bg-blue-50/60 dark:bg-blue-900/10'
                                                                        : isOverdue
                                                                            ? 'bg-red-50/50 dark:bg-red-900/10'
                                                                            : isNext
                                                                                ? 'bg-orange-50/60 dark:bg-orange-900/10'
                                                                                : '';

                                                                const statusBadge = isPaid
                                                                    ? <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">✓ PAID</span>
                                                                    : isPartial
                                                                        ? <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40">PARTIAL</span>
                                                                        : isOverdue
                                                                            ? <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black bg-red-100 text-red-700 dark:bg-red-900/40">OVERDUE</span>
                                                                            : isNext
                                                                                ? <span className="text-[7px] px-1.5 py-0.5 rounded-full font-black bg-orange-100 text-orange-700 dark:bg-orange-900/40">NEXT DUE</span>
                                                                                : <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black bg-gray-100 text-gray-500">PENDING</span>;

                                                                return (
                                                                    <div
                                                                        key={`${order.order_id}-inst-${inst.monthNumber}-${idx}`}
                                                                        className={`grid grid-cols-[52px_1fr_auto_auto_auto] gap-2 items-center px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors ${rowBg}`}
                                                                    >
                                                                        {/* Month label + status */}
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <span className={`text-[10px] font-black w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/40'
                                                                                    : isPartial ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40'
                                                                                        : isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/40'
                                                                                            : isNext ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40'
                                                                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700'
                                                                                }`}>M{inst.monthNumber}</span>
                                                                            {statusBadge}
                                                                        </div>

                                                                        {/* Amount details */}
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{pkr(inst.dueAmount)}</span>
                                                                                {hasArrears && (
                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black bg-red-100 text-red-600 dark:bg-red-900/30">+{pkr(inst.arrears || 0)} arrears</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col gap-1 mt-1">
                                                                                <span className="text-[9px] text-gray-400">Due: {instDueDate ? instDueDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                                                                                {/* Render explicit payment history if available (for multiple partial payments) */}
                                                                                {inst.payment_history && inst.payment_history.length > 0 ? (
                                                                                    <div className="flex flex-col gap-1 mt-1 border-l-2 border-emerald-100 pl-2">
                                                                                        {inst.payment_history.map((ph: any, phi: number) => (
                                                                                            <div key={phi} className="flex items-center gap-1.5 flex-wrap">
                                                                                                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm">PAID: {pkr(ph.amount)}</span>
                                                                                                <span className="text-[9px] text-gray-400">on {formatExactDate(ph.date, 'DD MMM, hh:mm A')}</span>
                                                                                                <span className="text-[8px] font-semibold text-indigo-500 truncate max-w-[120px]" title={ph.method}>via {ph.method}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                                                        {inst.paymentMethod && (
                                                                                            <span className="text-[9px] font-semibold text-indigo-500 truncate max-w-[140px]" title={inst.paymentMethod}>via {inst.paymentMethod}</span>
                                                                                        )}
                                                                                        {inst.paidAt && (
                                                                                            <span className="text-[9px] text-emerald-600 font-semibold">· Paid on {formatExactDate(inst.paidAt, 'DD MMM, hh:mm A')}</span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Paid amount */}
                                                                        <div className="text-right">
                                                                            {paidAmt > 0 ? (
                                                                                <span className="text-sm font-black text-emerald-600">{pkr(paidAmt)}</span>
                                                                            ) : (
                                                                                <span className="text-[10px] text-gray-300">—</span>
                                                                            )}
                                                                        </div>

                                                                        {/* Remaining */}
                                                                         <div className="text-right">
                                                                             {!isPaid && (remAmt + (inst.arrears || 0)) > 0 ? (
                                                                                 <div>
                                                                                     <span className="text-sm font-black text-red-500">{pkr(remAmt + (inst.arrears || 0))}</span>
                                                                                     {hasArrears ? (
                                                                                         <p className="text-[9px] text-gray-400">({pkr(remAmt)} + {pkr(inst.arrears || 0)} arr.)</p>
                                                                                     ) : null}
                                                                                 </div>
                                                                             ) : isPaid ? (
                                                                                 <span className="text-[10px] text-green-500 font-bold">✓ Done</span>
                                                                             ) : (
                                                                                 <span className="text-[10px] text-gray-300">—</span>
                                                                             )}
                                                                         </div>

                                                                        {/* Action */}
                                                                        <div className="flex justify-center gap-2 items-center">
                                                                            {isPaid ? (
                                                                                <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                                                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                                                                </div>
                                                                            ) : isPayable ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => onPay(order, inst)}
                                                                                        className={`text-[9px] font-black py-1.5 px-3 rounded-lg shadow-sm transition-opacity hover:opacity-80 ${isNext ? 'bg-orange-500 text-white' : isOverdue ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}
                                                                                    >
                                                                                        {isPartial ? 'PAY REST' : 'PAY'}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setQrOrderId(order.order_id);
                                                                                            setQrMonthNumber(inst.monthNumber);
                                                                                            setQrDefaultAmount(remAmt + (inst.arrears || 0));
                                                                                            setQrCustomerName(order.customer_name);
                                                                                            setQrModalOpen(true);
                                                                                        }}
                                                                                        className="text-gray-500 hover:text-[#2b6cb0] hover:bg-blue-50 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                                                        title="Generate SmartPay QR"
                                                                                    >
                                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                                                        </svg>
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <span
                                                                                    className="text-[8px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest cursor-not-allowed"
                                                                                    title="Collect the earlier month(s) first"
                                                                                >
                                                                                    Locked
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const printWindow = window.open('', '_blank');
                                                                if (printWindow) {
                                                                    printWindow.document.write(`
                                                                        <html>
                                                                            <head>
                                                                                <title>Order Details - ${order.order_ref}</title>
                                                                                <style>
                                                                                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                                                                                    h1, h2, h3 { margin-top: 0; }
                                                                                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
                                                                                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
                                                                                    .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
                                                                                    table { w-full; border-collapse: collapse; margin-top: 20px; width: 100%; }
                                                                                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                                                                    th { background-color: #f9f9f9; }
                                                                                    .status-paid { color: #16a34a; font-weight: bold; }
                                                                                    .status-partial { color: #2563eb; font-weight: bold; }
                                                                                    .status-pending { color: #ea580c; font-weight: bold; }
                                                                                    .summary-box { display: flex; justify-content: space-between; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
                                                                                    .summary-item { text-align: center; }
                                                                                    .summary-value { font-size: 1.2rem; font-weight: bold; margin-top: 5px; color: #0f172a; }
                                                                                    @media print { body { padding: 0; } .no-print { display: none; } }
                                                                                </style>
                                                                            </head>
                                                                            <body>
                                                                                <div class="header">
                                                                                    <div>
                                                                                        <h1>Qist Market - Order Summary</h1>
                                                                                        <p>Order Reference: <strong>#${order.order_ref}</strong></p>
                                                                                        <p>Product: <strong>${order.product_name}</strong> (IMEI: ${order.imei_serial || 'N/A'})</p>
                                                                                    </div>
                                                                                    <div style="text-align: right;">
                                                                                        <p>Date Printed: ${new Date().toLocaleDateString()}</p>
                                                                                    </div>
                                                                                </div>

                                                                                <div class="summary-box">
                                                                                    <div class="summary-item">
                                                                                        <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Total Due</div>
                                                                                        <div class="summary-value">${pkr(totalInstallmentDue)}</div>
                                                                                    </div>
                                                                                    <div class="summary-item">
                                                                                        <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Total Collected</div>
                                                                                        <div class="summary-value" style="color: #16a34a;">${pkr(totalInstallmentPaid)}</div>
                                                                                    </div>
                                                                                    <div class="summary-item">
                                                                                        <div style="font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Remaining Balance</div>
                                                                                        <div class="summary-value" style="color: #dc2626;">${pkr(totalRemaining)}</div>
                                                                                    </div>
                                                                                </div>

                                                                                <div class="grid-2">
                                                                                    <div class="card">
                                                                                        <h3>Purchaser Details</h3>
                                                                                        <p><strong>Name:</strong> ${order.customer_name}</p>
                                                                                        <p><strong>Phone:</strong> ${order.whatsapp_number}</p>
                                                                                        <p><strong>CNIC:</strong> ${order.purchaser?.cnic_number || 'N/A'}</p>
                                                                                        <p><strong>Father/Husband:</strong> ${order.purchaser?.father_husband_name || 'N/A'}</p>
                                                                                    </div>
                                                                                    <div class="card">
                                                                                        <h3>Guarantors Details</h3>
                                                                                        ${order.grantors?.map(g => `
                                                                                            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                                                                                                <p style="margin:0 0 5px 0;"><strong>${g.name}</strong> (${g.relationship || 'Grantor'})</p>
                                                                                                <p style="margin:0; font-size: 0.9em; color: #555;">CNIC: ${g.cnic_number || 'N/A'} | Phone: ${g.phone_number || 'N/A'}</p>
                                                                                            </div>
                                                                                        `).join('') || '<p>No guarantors data</p>'}
                                                                                    </div>
                                                                                </div>

                                                                                <h3>Installment Ledger Overview</h3>
                                                                                <table>
                                                                                    <thead>
                                                                                        <tr>
                                                                                            <th>Month</th>
                                                                                            <th>Amount Due</th>
                                                                                            <th>Paid</th>
                                                                                            <th>Remaining</th>
                                                                                            <th>Status</th>
                                                                                            <th>Due Date</th>
                                                                                            <th>Payment Date</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        ${(order.installmentLedger || []).map(inst => `
                                                                                            <tr>
                                                                                                <td>${inst.label || `Month ${inst.monthNumber}`}</td>
                                                                                                <td style="font-weight:bold;">${pkr(inst.dueAmount)} ${inst.arrears ? ` <div style="color:#ef4444; font-size:10px;">(+ ${pkr(inst.arrears)} arr)</div>` : ''}</td>
                                                                                                <td style="color:#16a34a; font-weight:bold;">${inst.paidAmount && inst.paidAmount > 0 ? pkr(inst.paidAmount) : '-'}</td>
                                                                                                <td style="color:#dc2626; font-weight:bold;">${inst.remainingAmount && inst.remainingAmount > 0 ? pkr(inst.remainingAmount) : '-'}</td>
                                                                                                <td class="status-${(inst.paidAmount && inst.paidAmount > 0 && inst.status !== 'paid') ? 'partial' : (inst.status || 'pending').toLowerCase()}">${(inst.paidAmount && inst.paidAmount > 0 && inst.status !== 'paid') ? 'PARTIAL' : (inst.status || 'PENDING').toUpperCase()}</td>
                                                                                                <td>${inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : 'N/A'}</td>
                                                                                                <td>${inst.paidAt ? formatExactDate(inst.paidAt, 'DD MMM YYYY, hh:mm A') : '-'}</td>
                                                                                            </tr>
                                                                                        `).join('')}
                                                                                    </tbody>
                                                                                </table>
                                                                                
                                                                                <div style="margin-top: 50px; text-align: center; color: #888; font-size: 0.9em;">
                                                                                    <p>Generated by Qist Market Software Dashboard</p>
                                                                                </div>
                                                                            </body>
                                                                        </html>
                                                                    `);
                                                                    printWindow.document.close();
                                                                    printWindow.focus();
                                                                    setTimeout(() => {
                                                                        printWindow.print();
                                                                    }, 250);
                                                                }
                                                            }}
                                                            className="flex items-center gap-2 text-[11px] font-bold text-gray-600 hover:text-gray-800 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 px-4 py-2 rounded-xl transition-all"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4" /></svg>
                                                            Print
                                                        </button>
                                                    </div>
                                                    {order.ledger_short_id && (
                                                        <a
                                                            href={`${API_BASE}/api/ledger/${order.ledger_short_id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl transition-all"
                                                        >
                                                            View Online Ledger →
                                                        </a>
                                                    )}
                                                    {/* ── PayTrigger Actions ── */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mr-1">PT:</span>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch(`${API_BASE}/api/paytrigger/device/${encodeURIComponent(order.imei_serial)}/lock`, {
                                                                        method: 'POST',
                                                                        headers: getAuthHeaders(),
                                                                        body: JSON.stringify({ order_ref: order.order_ref }),
                                                                    });
                                                                    const d = await res.json();
                                                                    alert(d.message || (d.success ? 'Lock sent' : 'Failed'));
                                                                } catch (e) { console.error(e); alert('Error communicating with PayTrigger'); }
                                                            }}
                                                            className="text-[9px] font-black px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
                                                            disabled={!order.imei_serial}
                                                        >
                                                            Lock
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetch(`${API_BASE}/api/paytrigger/device/${encodeURIComponent(order.imei_serial)}/unlock`, {
                                                                        method: 'POST',
                                                                        headers: getAuthHeaders(),
                                                                        body: JSON.stringify({ order_ref: order.order_ref }),
                                                                    });
                                                                    const d = await res.json();
                                                                    alert(d.message || (d.success ? 'Unlock sent' : 'Failed'));
                                                                } catch (e) { console.error(e); alert('Error communicating with PayTrigger'); }
                                                            }}
                                                            className="text-[9px] font-black px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-40"
                                                            disabled={!order.imei_serial}
                                                        >
                                                            Unlock
                                                        </button>
                                                        <button
                                                            onClick={() => openPtpModal(order)}
                                                            className="text-[9px] font-black px-2.5 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40"
                                                            disabled={!order.imei_serial}
                                                            title={!order.imei_serial ? 'No device IMEI registered' : 'Set Promise to Pay date'}
                                                        >
                                                            PTP
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>

                {data.length === 0 && (
                    <div className="py-20 text-center">
                        <div className="bg-gray-50 dark:bg-gray-800 inline-block p-6 rounded-full mb-4">
                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-800 dark:text-white">No delivered orders found</h3>
                        <p className="text-gray-500 max-w-sm mx-auto mt-2 text-sm">
                            Once orders are delivered, they will appear here for installment tracking and collection.
                        </p>
                    </div>
                )}
            </div>

            <SmartPayQrModal 
                open={qrModalOpen} 
                onClose={() => setQrModalOpen(false)} 
                orderId={qrOrderId} 
                monthNumber={qrMonthNumber} 
                defaultAmount={qrDefaultAmount}
                customerName={qrCustomerName}
            />

            {/* ── PTP MODAL ───────────────────────────────────────────────── */}
            {ptpModalOpen && ptpOrder && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-amber-500/15 p-2">
                                        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Promise to Pay</h3>
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold tracking-widest mt-0.5">DEVICE TEMP-UNLOCK</p>
                                    </div>
                                </div>
                                <button onClick={() => setPtpModalOpen(false)} className="text-gray-400 hover:text-red-500 p-2 rounded-xl transition-all cursor-pointer">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 flex flex-col gap-5">

                            {/* Customer Info */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl flex flex-col gap-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">{ptpOrder.customer_name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{ptpOrder.order_ref} &bull; {ptpOrder.product_name}</p>
                                <p className="text-[10px] text-gray-400 mt-1">IMEI: <span className="font-mono">{ptpOrder.imei_serial || 'N/A'}</span></p>
                            </div>

                            {/* Date Picker */}
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Promised Payment Date</label>
                                <input
                                    type="date"
                                    min={tomorrowStr}
                                    max={maxPtpStr}
                                    value={ptpDate}
                                    onChange={(e) => setPtpDate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 font-bold text-amber-700 dark:text-amber-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm cursor-pointer"
                                />
                                <p className="text-[10px] text-gray-400 mt-1.5 pl-1">The device will be temporarily unlocked until this date (max 10 days). If payment is not received by then, the device will auto-lock again.</p>
                            </div>

                            {/* Quick date preset buttons */}
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Quick Select</p>
                                <div className="flex gap-2 flex-wrap">
                                    {[3, 7, 10].map(days => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + days);
                                        const dStr = d.toISOString().split('T')[0];
                                        return (
                                            <button
                                                key={days}
                                                onClick={() => setPtpDate(dStr)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                                                    ptpDate === dStr
                                                        ? 'bg-amber-500 text-white border-amber-500'
                                                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-amber-300'
                                                }`}
                                            >
                                                +{days}d
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Info Banner */}
                            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/40">
                                <svg className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-[10px] text-blue-600 dark:text-blue-300 font-medium leading-relaxed">
                                    A WhatsApp confirmation will be sent to <strong>{ptpOrder.whatsapp_number || ptpOrder.purchaser?.telephone_number || 'customer'}</strong> with the promised date and due amount.
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    onClick={() => setPtpModalOpen(false)}
                                    className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitPtp}
                                    disabled={ptpLoading || !ptpDate}
                                    className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-200 dark:shadow-none disabled:opacity-50 cursor-pointer text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                                >
                                    {ptpLoading ? (
                                        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Activating...</>
                                    ) : (
                                        <>Activate PTP &amp; Unlock Device</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
