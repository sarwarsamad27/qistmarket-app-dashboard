"use client";

import React, { useEffect, useState, useRef } from 'react';
import Loader from '@/components/common/Loader';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { formatExactDate } from '@/utils/dateUtils';
import { pickedDay } from '@/utils/pkt';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface FinancialsTabProps {
    token: string;
    startDate: Date | null;
    endDate: Date | null;
    searchQuery: string;
}

export default function FinancialsTab({ token, startDate, endDate, searchQuery }: FinancialsTabProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ expenses: [], vendorPayments: [] });
    const printRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = `${API_BASE}/api/outlet-reports/financials`;
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
        documentTitle: 'Financial_Report',
    });

    const handleExportCSV = () => {
        const wb = XLSX.utils.book_new();

        if (data.expenses && data.expenses.length > 0) {
            const expRows = data.expenses.map((e: any) => ({
                "Date": new Date(e.date).toLocaleDateString(),
                "Voucher #": e.voucher_number,
                "Payment Method": e.payment_method,
                "Notes": e.notes || 'N/A',
                "Total Amount": e.total_amount
            }));
            const wsExp = XLSX.utils.json_to_sheet(expRows);
            XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");
        }

        if (data.vendorPayments && data.vendorPayments.length > 0) {
            const vpRows = data.vendorPayments.map((vp: any) => ({
                "Date": formatExactDate(vp.created_at, 'DD MMM YYYY, hh:mm A'),
                "Vendor": vp.vendor_name || vp.vendor?.name || 'N/A',
                "Amount Paid": vp.amount,
                "Payment Method": vp.payment_method || 'Cash'
            }));
            const wsVp = XLSX.utils.json_to_sheet(vpRows);
            XLSX.utils.book_append_sheet(wb, wsVp, "Vendor Payments");
        }

        XLSX.writeFile(wb, "Financial_Report.xlsx");
    };

    const filteredExpenses = data.expenses?.filter((e: any) =>
        e.voucher_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.notes?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const filteredVendorPayments = data.vendorPayments?.filter((vp: any) =>
        (vp.vendor_name || vp.vendor?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const totalExpenses = filteredExpenses.reduce((acc: number, e: any) => acc + (e.total_amount || 0), 0);
    const totalVendorPayments = filteredVendorPayments.reduce((acc: number, vp: any) => acc + (vp.amount || 0), 0);

    if (loading) return <div className="p-8 text-center"><Loader /></div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Financials Report (Cash Outflow)</h2>
                <div className="flex gap-3">
                    <button onClick={handleExportCSV} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700">
                        Export CSV
                    </button>
                    <button onClick={handlePrint} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                        Print / PDF
                    </button>
                </div>
            </div>

            <div ref={printRef} className="print:p-6 flex flex-col gap-8">
                <div className="hidden print:block mb-4 border-b pb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Financials Report</h1>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Outlet Expenses</p>
                        <p className="text-2xl font-bold text-red-600">Rs {totalExpenses.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Vendor Payments</p>
                        <p className="text-2xl font-bold text-orange-600">Rs {totalVendorPayments.toLocaleString()}</p>
                    </div>
                </div>

                {/* Expenses Section */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Outlet Expenses</h3>
                    <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                                <thead className="bg-gray-50 text-gray-800 dark:bg-gray-900/50 dark:text-white">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">S.No</th><th className="px-4 py-3 font-medium">Date</th>
                                        <th className="px-4 py-3 font-medium">Voucher #</th>
                                        <th className="px-4 py-3 font-medium">Payment Method</th>
                                        <th className="px-4 py-3 font-medium">Notes</th>
                                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredExpenses.length > 0 ? filteredExpenses.map((exp: any, idx: number) => (
                                        <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-3 text-gray-500 tabular-nums">{idx + 1}</td>
                                            <td className="px-4 py-3">{new Date(exp.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 font-medium text-blue-600">{exp.voucher_number}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                    {exp.payment_method || 'Cash'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500">{exp.notes || '—'}</td>
                                            <td className="px-4 py-3 font-bold text-red-600 text-right">Rs {exp.total_amount?.toLocaleString()}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No expenses found for this period.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Vendor Payments Section */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Vendor Payments</h3>
                    <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                                <thead className="bg-gray-50 text-gray-800 dark:bg-gray-900/50 dark:text-white">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">S.No</th><th className="px-4 py-3 font-medium">Date</th>
                                        <th className="px-4 py-3 font-medium">Vendor</th>
                                        <th className="px-4 py-3 font-medium">Method</th>
                                        <th className="px-4 py-3 font-medium text-right">Amount Paid</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredVendorPayments.length > 0 ? filteredVendorPayments.map((vp: any, idx: number) => (
                                        <tr key={vp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-3 text-gray-500 tabular-nums">{idx + 1}</td>
                                            <td className="px-4 py-3">{formatExactDate(vp.created_at, 'DD MMM YYYY, hh:mm A')}</td>
                                            <td className="px-4 py-3 font-medium">{vp.vendor_name || vp.vendor?.name || 'N/A'}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                    {vp.payment_method || 'Cash'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-bold text-orange-600 text-right">Rs {vp.amount?.toLocaleString()}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No vendor payments found for this period.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
