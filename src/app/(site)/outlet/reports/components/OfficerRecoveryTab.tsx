"use client";

import React, { useEffect, useState, useRef } from 'react';
import Loader from '@/components/common/Loader';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { formatExactDate } from '@/utils/dateUtils';
import { pickedDay } from '@/utils/pkt';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface OfficerRecoveryTabProps {
    token: string;
    startDate: Date | null;
    endDate: Date | null;
    searchQuery: string;
}

export default function OfficerRecoveryTab({ token, startDate, endDate, searchQuery }: OfficerRecoveryTabProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const printRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = `${API_BASE}/api/outlet-reports/officer-recoveries`;
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
        documentTitle: 'Officer_Recovery_Report',
    });

    const handleExportCSV = () => {
        if (!data || data.length === 0) return;
        
        // Flatten the data for CSV
        const rows: any[] = [];
        data.forEach(officer => {
            if (officer.recoveries && officer.recoveries.length > 0) {
                officer.recoveries.forEach((r: any) => {
                    rows.push({
                        "Officer Name": officer.officer_name,
                        "Officer Phone": `"${officer.officer_phone}"`,
                        "Total Recovered By Officer": officer.total_recovered,
                        "Assigned Orders": officer.assigned_orders,
                        "Recovery Date": formatExactDate(r.paid_at, 'DD MMM YYYY, hh:mm A'),
                        "Order Ref": r.order_ref,
                        "Amount Recovered": r.amount
                    });
                });
            } else {
                rows.push({
                    "Officer Name": officer.officer_name,
                    "Officer Phone": `"${officer.officer_phone}"`,
                    "Total Recovered By Officer": 0,
                    "Assigned Orders": officer.assigned_orders,
                    "Recovery Date": "N/A",
                    "Order Ref": "N/A",
                    "Amount Recovered": 0
                });
            }
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Officer Recoveries");
        XLSX.writeFile(wb, "Officer_Recovery_Report.xlsx");
    };

    const filteredData = data.filter((officer: any) => 
        officer.officer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        officer.officer_phone?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalRecoveredAcrossAll = filteredData.reduce((acc: number, off: any) => acc + (off.total_recovered || 0), 0);
    const totalOfficersActive = filteredData.length;

    if (loading) return <div className="p-8 text-center"><Loader /></div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Officer Recovery Performance</h2>
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
                    <h1 className="text-2xl font-bold text-gray-800">Officer Recovery Report</h1>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Officers Active</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalOfficersActive}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/20">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Revenue Collected By Officers</p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">Rs {totalRecoveredAcrossAll.toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    {filteredData.length > 0 ? filteredData.map((officer: any) => (
                        <div key={officer.officer_id} className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{officer.officer_name}</h3>
                                    <p className="text-sm text-gray-500">{officer.officer_phone}</p>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Assigned Orders</p>
                                        <p className="font-bold text-gray-800 dark:text-white">{officer.assigned_orders}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-emerald-600 uppercase font-semibold">Cash Collected</p>
                                        <p className="font-bold text-emerald-600 text-lg">Rs {officer.total_recovered?.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {officer.recoveries && officer.recoveries.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                                        <thead className="bg-white dark:bg-gray-800 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-2 font-medium dark:border-gray-700">S.No</th><th className="px-4 py-2 font-medium border-b dark:border-gray-700">Date</th>
                                                <th className="px-4 py-2 font-medium border-b dark:border-gray-700">Order Ref</th>
                                                <th className="px-4 py-2 font-medium border-b dark:border-gray-700 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {officer.recoveries.map((r: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-2 text-gray-500 tabular-nums">{idx + 1}</td>
                                                    <td className="px-4 py-2">{formatExactDate(r.paid_at, 'DD MMM YYYY, hh:mm A')}</td>
                                                    <td className="px-4 py-2 font-medium text-blue-600">{r.order_ref}</td>
                                                    <td className="px-4 py-2 font-medium text-right text-emerald-600">Rs {r.amount?.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 text-sm text-gray-500 text-center">No cash collections recorded in this period.</div>
                            )}
                        </div>
                    )) : (
                        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800 text-gray-500">
                            No officer recovery data found for this period.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
