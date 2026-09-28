"use client";

import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import InstallmentsTable from "@/components/Installments/InstallmentsTable";
import InstallmentPaymentModal from "@/components/Installments/InstallmentPaymentModal";
import SmartPayQrModal from "@/components/Installments/SmartPayQrModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatExactDate } from "@/utils/dateUtils";
import { findCurrentInstallmentIndex } from "@/lib/currentInstallment";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
    const token = Cookies.get("auth_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const pkr = (n: number) => `PKR ${Number(n || 0).toLocaleString()}`;

// ── Global Search Panel ──────────────────────────────────────────────────────
function GlobalInstallmentSearch({ onPay, onGenerateQR }: { onPay: (order: any, inst: any) => void, onGenerateQR: (order: any, inst: any) => void }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showPanel, setShowPanel] = useState(false);
    const timerRef = useRef<any>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    const search = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setResults([]); setShowPanel(false); return; }
        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/outlet/installments?search=${encodeURIComponent(q)}&limit=8&page=1&globalSearch=true`,
                { headers: getAuthHeaders() }
            );
            const data = await res.json();
            if (data.success) {
                setResults(data.data.installments || []);
                setShowPanel(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        clearTimeout(timerRef.current);
        if (query.trim().length >= 2) {
            timerRef.current = setTimeout(() => search(query), 350);
        } else {
            setResults([]);
            setShowPanel(false);
        }
        return () => clearTimeout(timerRef.current);
    }, [query, search]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setShowPanel(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={wrapRef} className="relative mb-8">
            {/* Search Banner */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 rounded-[28px] p-6 shadow-xl shadow-blue-200/40 dark:shadow-blue-900/30">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-3 text-white flex-shrink-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-black text-sm uppercase tracking-widest opacity-80">Global Search</p>
                            <p className="text-[10px] opacity-60 font-medium">Any name · phone · ref · IMEI · 1Bill</p>
                        </div>
                    </div>
                    <div className="relative flex-1 w-full">
                        <input
                            type="text"
                            placeholder="Customer name, phone, order ref, IMEI or 1Bill ID…"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onFocus={() => results.length > 0 && setShowPanel(true)}
                            className="w-full pl-5 pr-12 py-3.5 rounded-2xl bg-white/95 dark:bg-gray-900/80 text-gray-800 dark:text-white font-medium text-sm shadow-inner outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-400"
                        />
                        {loading ? (
                            <div className="absolute right-4 top-3.5">
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : query ? (
                            <button onClick={() => { setQuery(""); setResults([]); setShowPanel(false); }} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Results Dropdown */}
            {showPanel && (
                <div className="absolute z-50 left-0 right-0 top-full mt-3 bg-white dark:bg-gray-800 rounded-[24px] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden max-h-[80vh] overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            <p className="font-semibold text-sm">No orders found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center sticky top-0 z-10">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
                                <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600 text-xs font-bold">Close ✕</button>
                            </div>
                            {results.map(order => {
                                const { paidInstallments, totalInstallments, totalRemaining, totalArrears, grandTotalDue, grandTotalPaid, grandTotalRemaining, advanceAmount, advancePaid } = order.ledgerSummaries;
                                const progress = totalInstallments > 0 ? Math.round((paidInstallments / totalInstallments) * 100) : 0;
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const hasTps = order.tpsPayments?.length > 0;

                                return (
                                    <div key={order.order_id} className="p-5 hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">

                                        {/* ─── Order Header ─── */}
                                        <div className="flex items-start justify-between mb-4 gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm">
                                                    {order.customer_name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-gray-800 dark:text-gray-100 text-base truncate">{order.customer_name}</p>
                                                    <p className="text-[11px] text-gray-500 font-medium">#{order.order_ref} · {order.whatsapp_number}</p>
                                                    <p className="text-[11px] text-gray-400 truncate">{order.product_name}{order.imei_serial ? ` · IMEI: ${order.imei_serial}` : ''}</p>
                                                    {order.outlet_name && order.outlet_name !== 'N/A' && (
                                                        <p className="text-[10px] text-indigo-500 font-bold">{order.outlet_name} ({order.outlet_code})</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className={`text-base font-black ${totalRemaining > 0 ? 'text-red-500' : 'text-green-500'}`}>{pkr(totalRemaining)}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">{paidInstallments}/{totalInstallments} months paid</p>
                                                <div className="w-28 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1.5 ml-auto">
                                                    <div className={`h-1.5 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : progress > 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }} />
                                                </div>
                                                {(totalArrears || 0) > 0 && (
                                                    <p className="text-[10px] text-red-500 font-bold mt-1">⚠ Arrears: {pkr(totalArrears)}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* ─── People + 1Bill Info ─── */}
                                        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                                            {order.purchaser?.name && (
                                                <div className="flex items-center gap-2">
                                                    {order.purchaser.profile_photo ? (
                                                        <img src={order.purchaser.profile_photo.startsWith('http') ? order.purchaser.profile_photo : `${API_BASE.replace(/\/$/, '')}/${order.purchaser.profile_photo.replace(/^\//, '')}`} alt="Purchaser" className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-600 flex-shrink-0">P</div>
                                                    )}
                                                    <div className="text-[10px]">
                                                        <p className="font-bold text-gray-700 dark:text-gray-300">{order.purchaser.name}</p>
                                                        <p className="text-gray-500">Purchaser · CNIC: {order.purchaser.cnic_number || '—'}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {order.grantors?.map((g: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    {g.profile_photo ? (
                                                        <img src={g.profile_photo.startsWith('http') ? g.profile_photo : `${API_BASE.replace(/\/$/, '')}/${g.profile_photo.replace(/^\//, '')}`} alt={`Grantor ${i + 1}`} className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-black text-orange-600 flex-shrink-0">G{i + 1}</div>
                                                    )}
                                                    <div className="text-[10px]">
                                                        <p className="font-bold text-gray-700 dark:text-gray-300">{g.name}</p>
                                                        <p className="text-gray-500">Grantor {i + 1}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="ml-auto flex flex-col justify-center text-[10px] text-right">
                                                <p className="text-gray-500"><span className="font-bold">Date:</span> {formatExactDate(order.created_at, 'DD MMM YYYY, hh:mm A')}</p>
                                                {order.consumer_number && (
                                                    <p className="text-blue-600 font-bold mt-0.5">1Bill: {order.consumer_number}
                                                    </p>
                                                )}
                                                {order.smartpay_consumer_number && (
                                                    <p className="text-emerald-600 font-bold mt-0.5">SmartPay: {order.smartpay_consumer_number}
                                                    </p>
                                                )}
                                                {order.recovery_officer && (
                                                    <p className="text-gray-500 mt-0.5"><span className="font-bold">RO:</span> {order.recovery_officer.name}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* ─── Financial Summary Bar ─── */}
                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-2.5 text-center">
                                                <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Total Due</p>
                                                <p className="text-sm font-black text-blue-700 dark:text-blue-300">{pkr(grandTotalDue || 0)}</p>
                                            </div>
                                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-2.5 text-center">
                                                <p className="text-[9px] font-bold text-green-500 uppercase tracking-widest">Total Paid</p>
                                                <p className="text-sm font-black text-green-700 dark:text-green-300">{pkr(grandTotalPaid || 0)}</p>
                                            </div>
                                            <div className={`${(grandTotalRemaining || 0) > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700/30'} rounded-xl p-2.5 text-center`}>
                                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Remaining</p>
                                                <p className={`text-sm font-black ${(grandTotalRemaining || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{pkr(grandTotalRemaining || 0)}</p>
                                            </div>
                                        </div>

                                        {/* ─── Installment Ledger Table ─── */}
                                        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden mb-4">
                                            {/* Advance Row */}
                                            {(advanceAmount || 0) > 0 && (
                                                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-7 text-center">ADV</span>
                                                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Advance Payment</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{pkr(advanceAmount)}</span>
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${advancePaid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700'}`}>
                                                            {advancePaid ? '✓ PAID' : 'PENDING'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {(() => {
                                                const ledger = order.installmentLedger || [];
                                                // Only the running month is payable (the last one once the schedule has
                                                // ended); earlier unpaid months are locked and carried into it as arrears.
                                                const activePayableIndex = findCurrentInstallmentIndex(ledger);

                                                return ledger.map((inst: any, idx: number) => {
                                                const isPaid = inst.status === 'paid' || inst.status === 'Paid';
                                                const isPartial = inst.status === 'partial';
                                                const instDueDate = inst.dueDate ? new Date(inst.dueDate) : null;
                                                instDueDate?.setHours(0, 0, 0, 0);
                                                const isOverdue = !isPaid && instDueDate && instDueDate < today;
                                                const isPayable = idx === activePayableIndex;
                                                const hasArrears = (inst.arrears || 0) > 0;

                                                return (
                                                    <div key={idx} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors ${isPaid ? 'bg-green-50/30' : isPartial ? 'bg-blue-50/40' : isOverdue ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                                            <span className={`text-[10px] font-black w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${isPaid ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : isPartial ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' : isOverdue ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : 'text-gray-500 bg-gray-100 dark:bg-gray-700'}`}>
                                                                M{inst.monthNumber}
                                                            </span>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{pkr(inst.dueAmount)}</span>
                                                                    {hasArrears && (
                                                                        <span className="text-[9px] text-red-500 font-bold bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">+{pkr(inst.arrears)} arr.</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-col gap-1 mt-1">
                                                                    <span className="text-[9px] text-gray-400">Due: {instDueDate ? instDueDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                                                                    {inst.payment_history && inst.payment_history.length > 0 ? (
                                                                        <div className="flex flex-col gap-1 mt-0.5 border-l-2 border-emerald-100 pl-2">
                                                                            {inst.payment_history.map((ph: any, phi: number) => (
                                                                                <div key={phi} className="flex items-center gap-1.5 flex-wrap">
                                                                                    <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded shadow-sm">PAID: {pkr(ph.amount)}</span>
                                                                                    <span className="text-[9px] text-gray-400">on {formatExactDate(ph.date, 'DD MMM, hh:mm A')}</span>
                                                                                    <span className="text-[8px] font-semibold text-indigo-500 truncate max-w-[120px]" title={ph.method}>via {ph.method}</span>
                                                                                </div>
                                                                            ))}
                                                                            {isPartial && (
                                                                                <div className="mt-1">
                                                                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded shadow-sm">REM: {pkr(inst.remainingAmount ?? (inst.dueAmount - (inst.paidAmount || 0)))}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col gap-1">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                {inst.paymentMethod && (
                                                                                    <span className="text-[9px] text-indigo-500 font-semibold truncate max-w-[120px]">{inst.paymentMethod}</span>
                                                                                )}
                                                                                {inst.paidAt && (
                                                                                    <span className="text-[9px] text-emerald-600 font-semibold">· Paid {formatExactDate(inst.paidAt, 'DD MMM, hh:mm A')}</span>
                                                                                )}
                                                                            </div>
                                                                            {isPartial && (
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">PAID: {pkr(inst.paidAmount)}</span>
                                                                                    <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">REM: {pkr(inst.remainingAmount ?? (inst.dueAmount - (inst.paidAmount || 0)))}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                                                            <span className={`text-[9px] px-2 py-1 rounded-md font-black ${
                                                                isPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                : isPartial ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
                                                                : isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30'
                                                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30'
                                                            }`}>
                                                                {isPaid ? '✓ PAID' : isPartial ? 'PARTIAL' : isOverdue ? 'OVERDUE' : 'PENDING'}
                                                            </span>
                                                            {!isPaid && isPayable && (
                                                                <>
                                                                    <button
                                                                        onClick={() => { onPay(order, inst); setShowPanel(false); }}
                                                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm transition-colors"
                                                                    >
                                                                        {isPartial ? 'PAY REST' : 'PAY'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { onGenerateQR(order, inst); setShowPanel(false); }}
                                                                        className="text-gray-500 hover:text-[#2b6cb0] hover:bg-blue-50 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                                        title="Generate SmartPay QR"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                                                        </svg>
                                                                    </button>
                                                                </>
                                                            )}
                                                            {!isPaid && !isPayable && (
                                                                <span className="text-[8px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest cursor-not-allowed" title={isOverdue ? "Overdue — its remainder is carried into the current month as arrears" : "Opens in its due month"}>
                                                                    Locked
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                            })()}
                                        </div>
                                        

                                        {/* ─── Quick Pay Next Due Button ─── */}
                                        {(() => {
                                            const ledger = order.installmentLedger || [];
                                            const actIdx = findCurrentInstallmentIndex(ledger);
                                            const nextPending = actIdx !== -1 ? ledger[actIdx] : null;
                                            if (!nextPending) return null;

                                            const rem = nextPending.remainingAmount ?? (nextPending.dueAmount - (nextPending.paidAmount || 0));
                                            const totalNext = rem + (nextPending.arrears || 0);

                                            return (
                                                <button
                                                    onClick={() => { onPay(order, nextPending); setShowPanel(false); }}
                                                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-sm hover:opacity-90 transition-opacity"
                                                >
                                                    Collect Next Due · {pkr(totalNext)}
                                                    {(nextPending.arrears || 0) > 0 && ` (Base ${pkr(rem)} + ${pkr(nextPending.arrears)} arr.)`}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function InstallmentsContent() {
    const searchParams = useSearchParams();
    const initialSearch = searchParams.get("search") || "";

    const [data, setData] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(initialSearch);
    const [activeTab, setActiveTab] = useState<'all' | 'regular' | 'fresh' | 'overdue' | 'blacklist' | 'defaulter' | 'ptp' | 'paid'>('all');
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [stats, setStats] = useState<any>({});
    const [categoriesSummary, setCategoriesSummary] = useState<any>({});

    // Advanced Filters State
    const [item, setItem] = useState("");
    const [ptpStatus, setPtpStatus] = useState("");
    const [lockStatus, setLockStatus] = useState("");
    const [roId, setRoId] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [minBalance, setMinBalance] = useState("");
    const [maxBalance, setMaxBalance] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Selection state for export
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [selectedInstallment, setSelectedInstallment] = useState<any>(null);

    // QR Modal state
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrOrderId, setQrOrderId] = useState<number | null>(null);
    const [qrMonthNumber, setQrMonthNumber] = useState<number | null>(null);
    const [qrDefaultAmount, setQrDefaultAmount] = useState<number | null>(null);
    const [qrCustomerName, setQrCustomerName] = useState("");

    // Sync search from URL if it changes
    useEffect(() => {
        if (initialSearch) setSearch(initialSearch);
    }, [initialSearch]);

    useEffect(() => {
        fetchInstallments();
    }, [pagination.page, search, activeTab, startDate, endDate, item, ptpStatus, lockStatus, roId, minAmount, maxAmount, minBalance, maxBalance]);

    const fetchInstallments = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: pagination.page.toString(),
                search,
                category: activeTab,
                ...(startDate && { start_date: startDate }),
                ...(endDate && { end_date: endDate }),
                ...(item && { item }),
                ...(ptpStatus && { ptp: ptpStatus }),
                ...(lockStatus && { lock_status: lockStatus }),
                ...(roId && { ro_id: roId }),
                ...(minAmount && { min_amount: minAmount }),
                ...(maxAmount && { max_amount: maxAmount }),
                ...(minBalance && { min_balance: minBalance }),
                ...(maxBalance && { max_balance: maxBalance }),
            }).toString();

            const res = await fetch(`${API_BASE}/api/outlet/installments/due-list?${query}`, {
                headers: getAuthHeaders(),
            });
            const result = await res.json();
            if (result.success) {
                setData(result.data.installments);
                setPagination(result.data.pagination);
                setCategoriesSummary(result.data.categories_summary || {});
                setStats(result.data.stats || {});
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePayClick = (order: any, installment: any) => {
        setSelectedOrder(order);
        setSelectedInstallment(installment);
        setModalOpen(true);
    };

    const handleGenerateQR = (order: any, installment: any) => {
        setQrOrderId(order.order_id);
        setQrMonthNumber(installment.monthNumber);
        setQrDefaultAmount(installment.remainingAmount ?? (installment.dueAmount - (installment.paidAmount || 0)));
        setQrCustomerName(order.customer_name);
        setQrModalOpen(true);
    };

    const toggleRowSelection = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const exportToCSV = () => {
        const rowsToExport = selectedIds.length > 0
            ? data.filter(item => selectedIds.includes(item.order_id))
            : data;

        if (rowsToExport.length === 0) return;

        // Determine max months across all exported ledgers to create dynamic columns
        let maxMonths = 0;
        rowsToExport.forEach(item => {
            if (item.installmentLedger && item.installmentLedger.length > maxMonths) {
                maxMonths = item.installmentLedger.length;
            }
        });

        // Base Headers
        const headers = [
            "Order Ref", "Status", "Customer Name", "Customer CNIC", "Customer Phone",
            "Product", "IMEI", "Total Due", "Total Paid", "Remaining Balance",
            "Grantor 1 Name", "Grantor 1 CNIC", "Grantor 1 Phone",
            "Grantor 2 Name", "Grantor 2 CNIC", "Grantor 2 Phone"
        ];

        // Dynamic Ledger Headers
        for (let i = 1; i <= maxMonths; i++) {
            headers.push(`Month ${i} Amount`, `Month ${i} Status`, `Month ${i} Paid Date`);
        }

        const csvRows = [headers.join(",")];

        rowsToExport.forEach(item => {
            const p = item.purchaser || {};
            const g1 = item.grantors?.[0] || {};
            const g2 = item.grantors?.[1] || {};

            const safeString = (str: any) => `"${(str || '').toString().replace(/"/g, '""')}"`;

            const rowData = [
                safeString(item.order_ref),
                safeString(item.status),
                safeString(item.customer_name),
                safeString(p.cnic_number),
                safeString(item.whatsapp_number),
                safeString(item.product_name),
                safeString(item.imei_serial),
                item.ledgerSummaries.totalInstallmentDue || 0,
                item.ledgerSummaries.totalInstallmentPaid || 0,
                item.ledgerSummaries.totalRemaining || 0,
                safeString(g1.name), safeString(g1.cnic_number), safeString(g1.phone_number),
                safeString(g2.name), safeString(g2.cnic_number), safeString(g2.phone_number)
            ];

            // Append ledger details for each month
            for (let i = 0; i < maxMonths; i++) {
                const ledgerRow = item.installmentLedger[i];
                if (ledgerRow) {
                    rowData.push(
                        ledgerRow.dueAmount || 0,
                        safeString(ledgerRow.status || 'pending'),
                        safeString(ledgerRow.paidAt ? new Date(ledgerRow.paidAt).toISOString().split('T')[0] : 'N/A')
                    );
                } else {
                    rowData.push('""', '""', '""'); // empty cells if ledger doesn't go this high
                }
            }

            csvRows.push(rowData.join(","));
        });

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `installments_export_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        const rowsToExport = selectedIds.length > 0
            ? data.filter(item => selectedIds.includes(item.order_id))
            : data;

        if (rowsToExport.length === 0) return;

        const doc = new jsPDF('landscape');
        
        doc.setFontSize(16);
        doc.text(`Installments Report - ${activeTab.toUpperCase()}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString('en-PK')}`, 14, 22);

        const tableColumn = ["Ref", "Customer", "Phone", "Product", "IMEI", "Total Due", "Total Paid", "Remaining", "PTP Status"];
        const tableRows: any[] = [];

        rowsToExport.forEach(item => {
            const hasPtp = item.installmentLedger?.some((l: any) => l.ptp_date);
            const ptpStatus = hasPtp ? "Has PTP" : "No PTP";
            const rowData = [
                item.order_ref,
                item.customer_name,
                item.whatsapp_number,
                item.product_name,
                item.imei_serial || 'N/A',
                item.ledgerSummaries.totalInstallmentDue || 0,
                item.ledgerSummaries.totalInstallmentPaid || 0,
                item.ledgerSummaries.totalRemaining || 0,
                ptpStatus
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 28,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`installments_export_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleSendBulkReminders = async () => {
        if (selectedIds.length === 0) {
            alert("Please select at least one account to send reminders.");
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to send reminders to ${selectedIds.length} selected customers?`);
        if (!confirmed) return;

        try {
            const res = await fetch(`${API_BASE}/api/outlet/installments/reminders`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ order_ids: selectedIds })
            });
            const resultData = await res.json();
            if (resultData.success) {
                alert(`Successfully queued ${selectedIds.length} reminders!`);
                setSelectedIds([]);
            } else {
                alert(`Error: ${resultData.message}`);
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred while sending reminders.");
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen">
            <GlobalInstallmentSearch onPay={handlePayClick} onGenerateQR={handleGenerateQR} />

            {/* Header & Stats */}
            <div className="flex flex-col mb-8 gap-6">
                <div className="flex-1">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Installment Receiving</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">Tracking and recovering accounts across all categories.</p>
                </div>
                
                {/* Global Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Months Due</p>
                        <p className="text-xl font-black text-gray-900 dark:text-white">{pkr(stats.months_due || 0)}</p>
                    </div>
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-blue-800 hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1.5">Months Collected</p>
                        <p className="text-xl font-black text-blue-600 dark:text-blue-400">{pkr(stats.months_collected || 0)}</p>
                        <p className="text-[9px] text-gray-400 mt-1">Installments only</p>
                    </div>
                    <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-2xl shadow-sm border border-purple-100 dark:border-purple-800 hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-1.5">Down Payment Collected</p>
                        <p className="text-xl font-black text-purple-600 dark:text-purple-400">{pkr(stats.months_collected_advance || 0)}</p>
                    </div>
                    <div className="bg-red-50/50 dark:bg-red-900/10 p-4 rounded-2xl shadow-sm border border-red-100 dark:border-red-800 hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5">Months Remaining</p>
                        <p className="text-xl font-black text-red-600 dark:text-red-400">{pkr(stats.months_remaining || 0)}</p>
                    </div>
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-800 hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1.5">System Collected</p>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{pkr(stats.system_collected || 0)}</p>
                    </div>
                    <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-2xl shadow-sm border border-orange-100 dark:border-orange-800 hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1.5">System Outstanding</p>
                        <p className="text-xl font-black text-orange-600 dark:text-orange-400">{pkr(stats.system_outstanding || 0)}</p>
                    </div>
                </div>

                {/* Categories Tabs as Cards */}
                <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-1 snap-x hide-scrollbar">
                    {[
                        { id: 'all', label: 'All Accounts', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-100', activeRing: 'ring-gray-400', dot: 'bg-gray-500' },
                        { id: 'regular', label: 'Regular', bg: 'bg-blue-50 dark:bg-blue-900/40', text: 'text-blue-800 dark:text-blue-300', activeRing: 'ring-blue-500', dot: 'bg-blue-500' },
                        { id: 'fresh', label: 'Fresh', bg: 'bg-cyan-50 dark:bg-cyan-900/40', text: 'text-cyan-800 dark:text-cyan-300', activeRing: 'ring-cyan-500', dot: 'bg-cyan-500' },
                        { id: 'overdue', label: 'Overdue', bg: 'bg-orange-50 dark:bg-orange-900/40', text: 'text-orange-800 dark:text-orange-300', activeRing: 'ring-orange-500', dot: 'bg-orange-500' },
                        { id: 'blacklist', label: 'Blacklist', bg: 'bg-red-50 dark:bg-red-900/40', text: 'text-red-800 dark:text-red-300', activeRing: 'ring-red-500', dot: 'bg-red-500' },
                        { id: 'defaulter', label: 'Defaulter', bg: 'bg-rose-50 dark:bg-rose-900/40', text: 'text-rose-800 dark:text-rose-300', activeRing: 'ring-rose-500', dot: 'bg-rose-600' },
                        { id: 'ptp', label: 'PTP (Pending)', bg: 'bg-purple-50 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-300', activeRing: 'ring-purple-500', dot: 'bg-purple-500' },
                        { id: 'paid', label: 'Paid', bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-300', activeRing: 'ring-emerald-500', dot: 'bg-emerald-500' }
                    ].map(cat => {
                        const sum = categoriesSummary[cat.id] || { amount: 0, customers: 0 };
                        const isActive = activeTab === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveTab(cat.id as any); setPagination({ ...pagination, page: 1 }); }}
                                className={`flex-none snap-start p-4 rounded-[20px] text-left min-w-[160px] transition-all duration-300 border border-transparent 
                                    ${isActive 
                                        ? `shadow-lg scale-[1.05] ring-2 ring-offset-4 ring-offset-white dark:ring-offset-[#1a222c] ${cat.activeRing} ${cat.bg} ${cat.text}` 
                                        : `hover:bg-opacity-80 opacity-75 grayscale-[0.3] hover:grayscale-0 hover:opacity-100 ${cat.bg} ${cat.text}`
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={`w-2 h-2 rounded-full shadow-sm ${cat.dot} ${isActive ? 'animate-pulse' : ''}`}></div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90">{cat.label}</p>
                                </div>
                                <p className="text-xl font-black tracking-tight">{pkr(sum.amount)}</p>
                                <p className="text-[11px] font-bold opacity-60 mt-1">{sum.customers} {sum.customers === 1 ? 'Customer' : 'Customers'}</p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col lg:flex-row items-center gap-4">
                
                {/* Search */}
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        placeholder="Search customer, ref or IMEI..."
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border-none focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold dark:text-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <svg className="absolute left-4 top-4 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-700 hidden lg:block"></div>

                {/* Advanced Filters Toggle */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`w-full lg:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${showFilters ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    Filters
                </button>

                {/* Bulk Reminders */}
                <button
                    onClick={handleSendBulkReminders}
                    disabled={selectedIds.length === 0}
                    className="w-full lg:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-100 dark:hover:bg-purple-900/50"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    Send Reminders {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                </button>

                <div className="h-8 w-[1px] bg-gray-100 dark:bg-gray-700 hidden lg:block"></div>

                {/* Export Options */}
                <div className="flex w-full lg:w-auto gap-2">
                    <button
                        onClick={exportToCSV}
                        className="flex-1 lg:flex-none px-6 py-3.5 rounded-2xl bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        CSV {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="flex-1 lg:flex-none px-6 py-3.5 rounded-2xl bg-red-600 dark:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        PDF {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                    </button>
                </div>
            </div>

            {/* Advanced Filters Drawer */}
            {showFilters && (
                <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-[32px] border border-gray-100 dark:border-gray-700 mb-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in-down">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Installment Date</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                            <input type="date" className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <span className="text-gray-400 font-bold text-[10px]">TO</span>
                            <input type="date" className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Item / Product</label>
                        <input type="text" placeholder="e.g. iPhone 13" className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold outline-none focus:border-blue-500" value={item} onChange={e => setItem(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">PTP Status</label>
                        <select className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold outline-none focus:border-blue-500" value={ptpStatus} onChange={e => setPtpStatus(e.target.value)}>
                            <option value="">All</option>
                            <option value="yes">Has PTP</option>
                            <option value="no">No PTP</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Lock Status</label>
                        <select className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-semibold outline-none focus:border-blue-500" value={lockStatus} onChange={e => setLockStatus(e.target.value)}>
                            <option value="">All</option>
                            <option value="unlocked">Unlocked</option>
                            <option value="locked">Locked</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Inst. Amount Range</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                            <input type="number" placeholder="Min" className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 outline-none" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
                            <span className="text-gray-400 font-bold text-[10px]">TO</span>
                            <input type="number" placeholder="Max" className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 outline-none" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Balance Range</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                            <input type="number" placeholder="Min" className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 outline-none" value={minBalance} onChange={e => setMinBalance(e.target.value)} />
                            <span className="text-gray-400 font-bold text-[10px]">TO</span>
                            <input type="number" placeholder="Max" className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 outline-none" value={maxBalance} onChange={e => setMaxBalance(e.target.value)} />
                        </div>
                    </div>
                </div>
            )}

            {loading && data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-gray-700">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-gray-500 font-bold animate-pulse uppercase tracking-widest text-xs">Fetching Ledgers...</p>
                </div>
            ) : (
                <>
                    <InstallmentsTable
                        data={data}
                        onPay={handlePayClick}
                        selectedIds={selectedIds}
                        onSelectRow={toggleRowSelection}
                    />

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center items-center gap-3 mt-10">
                            <button
                                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                                disabled={pagination.page === 1}
                                className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center shadow-sm disabled:opacity-30 hover:border-blue-500 transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            <div className="px-6 py-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <span className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                                    Page {pagination.page} <span className="text-gray-300 mx-2">/</span> {pagination.totalPages}
                                </span>
                            </div>
                            <button
                                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                                disabled={pagination.page === pagination.totalPages}
                                className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center shadow-sm disabled:opacity-30 hover:border-blue-500 transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    )}
                </>
            )}

            <InstallmentPaymentModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={fetchInstallments}
                orderId={selectedOrder?.order_id}
                orderRef={selectedOrder?.order_ref}
                customerName={selectedOrder?.customer_name}
                installment={selectedInstallment}
            />

            <SmartPayQrModal 
                open={qrModalOpen} 
                onClose={() => setQrModalOpen(false)} 
                orderId={qrOrderId} 
                monthNumber={qrMonthNumber} 
                defaultAmount={qrDefaultAmount}
                customerName={qrCustomerName}
            />
        </div>
    );
}

export default function OutletInstallmentsPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center">Loading...</div>}>
            <InstallmentsContent />
        </Suspense>
    );
}
