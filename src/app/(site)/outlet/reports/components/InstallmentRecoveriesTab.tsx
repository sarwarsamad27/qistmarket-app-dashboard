"use client";

import React, { useEffect, useState, useRef } from 'react';
import Loader from '@/components/common/Loader';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { formatExactDate } from '@/utils/dateUtils';
import { pickedDay } from '@/utils/pkt';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface InstallmentRecoveriesTabProps {
    token: string;
    startDate: Date | null;
    endDate: Date | null;
    searchQuery: string;
}

export default function InstallmentRecoveriesTab({ token, startDate, endDate, searchQuery }: InstallmentRecoveriesTabProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ recoveries: [], totalRecovered: 0 });
    const printRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = `${API_BASE}/api/outlet-reports/installment-recoveries`;
                const params = new URLSearchParams();
                if (startDate) params.append('startDate', pickedDay(startDate));
                if (endDate) params.append('endDate', pickedDay(endDate));
                if (params.toString()) url += `?${params.toString()}`;

                const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.success) setData(json.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [token, startDate, endDate]);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Installment_Recoveries_Report',
    });

    const handleExportCSV = () => {
        if (!data.recoveries || data.recoveries.length === 0) return;
        const rows = data.recoveries.map((r: any) => ({
            "Paid Date": formatExactDate(r.paid_at, 'DD MMM YYYY, hh:mm A'),
            "Order Ref": r.order_ref,
            "Customer": r.customer_name,
            "Phone": `"${r.whatsapp_number}"`,
            "Installment Month": r.label,
            "Amount Recovered": r.amount,
            "Payment Method": r.payment_method,
            "Customer Arrears": r.arrears || 0,
            "Edited": r.edited ? "Edited" : "",
            "Originally Entered": r.original_paid_at ? formatExactDate(r.original_paid_at, 'DD MMM YYYY, hh:mm A') : ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recoveries");
        XLSX.writeFile(wb, "Installment_Recoveries_Report.xlsx");
    };

    const filteredRecoveries = data.recoveries?.filter((r: any) => 
        r.order_ref?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.whatsapp_number?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const totalRecoveredAmount = filteredRecoveries.reduce((acc: number, r: any) => acc + (r.amount || 0), 0);

    if (loading) return <div className="p-8 text-center"><Loader /></div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Installment Recoveries (Cash Inflow)</h2>
                <div className="flex gap-3">
                    <button onClick={handleExportCSV} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700">
                        Export CSV
                    </button>
                    <button onClick={handlePrint} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                        Print / PDF
                    </button>
                </div>
            </div>

            <div ref={printRef} className="print:p-6 flex flex-col gap-6">
                <div className="hidden print:block mb-4 border-b pb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Installment Recoveries Report</h1>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Payments Received</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{filteredRecoveries.length}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-900/20">
                        <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Total Cash Recovered</p>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">Rs {totalRecoveredAmount.toLocaleString()}</p>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                            <thead className="bg-gray-50 text-gray-800 dark:bg-gray-900/50 dark:text-white">
                                <tr>
                                    <th className="px-4 py-3 font-medium">S.No</th><th className="px-4 py-3 font-medium">Paid Date</th>
                                    <th className="px-4 py-3 font-medium">Order Ref</th>
                                    <th className="px-4 py-3 font-medium">Customer</th>
                                    <th className="px-4 py-3 font-medium">Installment</th>
                                    <th className="px-4 py-3 font-medium">Method</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                                    <th className="px-4 py-3 font-medium text-right">Arrears</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredRecoveries.length > 0 ? filteredRecoveries.map((r: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-3 whitespace-nowrap text-gray-500 tabular-nums">{idx + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {formatExactDate(r.paid_at, 'DD MMM YYYY, hh:mm A')}
                                            {/* Corrected in Edit Ledger — same EDITED badge as the ledger. */}
                                            {r.edited && (
                                                <span className="mt-1 block w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">EDITED</span>
                                            )}
                                            {r.original_paid_at && (
                                                <span className="mt-0.5 block text-[10px] text-gray-400">Entered {formatExactDate(r.original_paid_at, 'DD MMM YYYY, hh:mm A')}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-blue-600">{r.order_ref}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-800 dark:text-white">{r.customer_name}</p>
                                            <p className="text-xs text-gray-500">{r.whatsapp_number}</p>
                                        </td>
                                        <td className="px-4 py-3 text-purple-600 font-medium">{r.label}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                {r.payment_method}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-bold text-emerald-600 text-right">Rs {r.amount?.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            {r.arrears > 0 ? (
                                                <span className="font-bold text-red-600">Rs {r.arrears.toLocaleString()}</span>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No recoveries found for this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
