"use client";

import React, { useEffect, useState, useRef } from 'react';
import Loader from '@/components/common/Loader';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { formatExactDate } from '@/utils/dateUtils';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface SalesReportTabProps {
    token: string;
    startDate: Date | null;
    endDate: Date | null;
    searchQuery: string;
}

export default function SalesReportTab({ token, startDate, endDate, searchQuery }: SalesReportTabProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>({ summary: {}, orders: [] });
    const printRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = `${API_BASE}/api/outlet-reports/sales`;
                const params = new URLSearchParams();
                if (startDate) params.append('startDate', startDate.toISOString());
                if (endDate) params.append('endDate', endDate.toISOString());
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
        documentTitle: 'Sales_Report',
    });

    const handleExportCSV = () => {
        if (!data.orders || data.orders.length === 0) return;
        const rows = data.orders.map((o: any, index: number) => ({
            "Serial No": index + 1,
            "Date": formatExactDate(o.delivered_at || o.updated_at || o.created_at, 'DD MMM YYYY, hh:mm A'),
            "Order ID": o.order_ref,
            "Customer Name": o.customer_name,
            "Product": o.product_name,
            "Type": o.sale_type === 'cash' ? 'Cash' : 'Installment',
            "Sales Value": o.sales_value,
            "Down Payment": o.down_payment_amount,
            "Balance": o.balance,
            "Tenure": o.tenure,
            "Installment": o.installment_amount
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
        XLSX.writeFile(wb, "Sales_Report.xlsx");
    };

    const filteredOrders = data.orders?.filter((o: any) => 
        o.order_ref?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.whatsapp_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    if (loading) return <div className="p-8 text-center"><Loader /></div>;

    return (
        <div className="flex flex-col gap-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Sales Report</h2>
                <div className="flex gap-3">
                    <button onClick={handleExportCSV} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700">
                        Export CSV
                    </button>
                    <button onClick={handlePrint} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                        Print / PDF
                    </button>
                </div>
            </div>

            {/* Print Container */}
            <div ref={printRef} className="print:p-6 flex flex-col gap-6">
                <div className="hidden print:block mb-4 border-b pb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Sales Report</h1>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {/* Summary Cards */}
                {(() => {
                    // Pure installment recovery only - no down payment mixed in.
                    const installmentReceived = data.summary.totalInstallmentsReceived ?? (
                        filteredOrders.filter((o: any) => o.sale_type === 'installment').reduce((sum: number, o: any) => sum + (o.down_payment_amount || 0), 0)
                    );
                    const cashSalesReceived = data.summary.totalCashSalesReceived ?? (
                        filteredOrders.filter((o: any) => o.sale_type === 'cash').reduce((sum: number, o: any) => sum + (o.down_payment_amount || o.sales_value || 0), 0)
                    );
                    // Down payment / advance cash collected in this date range.
                    const downPaymentReceived = data.summary.totalAdvanceReceived ?? 0;
                    // Down payment + installment combined.
                    const totalCollected = data.summary.totalCollectedInRange ?? (downPaymentReceived + installmentReceived);

                    return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</p>
                                <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.summary.totalOrders || filteredOrders.length}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Gross Sales Value</p>
                                <p className="text-2xl font-bold text-blue-600">Rs {(data.summary.totalGrossAmount ?? 0).toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Cash Sale</p>
                                <p className="text-2xl font-bold text-amber-600">Rs {cashSalesReceived.toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Amount Received</p>
                                {/* All money actually received in the range: down payments + installments (by payment date) + cash sales */}
                                <p className="text-2xl font-bold text-green-600">Rs {(totalCollected + cashSalesReceived).toLocaleString()}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Installment Recovery</p>
                                <p className="text-2xl font-bold text-indigo-600">Rs {installmentReceived.toLocaleString()}</p>
                                <p className="text-xs text-gray-400 mt-1">Installments only, no down payment</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Down Payment Received</p>
                                <p className="text-2xl font-bold text-purple-600">Rs {downPaymentReceived.toLocaleString()}</p>
                                <p className="text-xs text-gray-400 mt-1">Advance/down payment only</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Collected</p>
                                <p className="text-2xl font-bold text-teal-600">Rs {totalCollected.toLocaleString()}</p>
                                <p className="text-xs text-gray-400 mt-1">Down payment + installments</p>
                            </div>
                        </div>
                    );
                })()}

                {/* Table */}
                <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                            <thead className="bg-gray-50 text-gray-800 dark:bg-gray-900/50 dark:text-white">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Sr #</th>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium">Order ID</th>
                                    <th className="px-4 py-3 font-medium">Customer Name</th>
                                    <th className="px-4 py-3 font-medium">Product</th>
                                    <th className="px-4 py-3 font-medium">Type</th>
                                    <th className="px-4 py-3 font-medium">Sales Value</th>
                                    <th className="px-4 py-3 font-medium">Down Payment</th>
                                    <th className="px-4 py-3 font-medium">Balance</th>
                                    <th className="px-4 py-3 font-medium">Tenure</th>
                                    <th className="px-4 py-3 font-medium">Installment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredOrders.length > 0 ? filteredOrders.map((order: any, index: number) => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3">{index + 1}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{formatExactDate(order.delivered_at || order.updated_at || order.created_at, 'DD MMM YYYY, hh:mm A')}</td>
                                        <td className="px-4 py-3 font-medium text-blue-600">{order.order_ref}</td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-800 dark:text-white">{order.customer_name}</p>
                                            <p className="text-xs text-gray-500">{order.whatsapp_number}</p>
                                        </td>
                                        <td className="px-4 py-3">{order.product_name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${order.sale_type === 'cash' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                {order.sale_type === 'cash' ? 'Cash' : 'Installment'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">Rs {(order.sales_value ?? 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 font-medium">Rs {(order.down_payment_amount ?? 0).toLocaleString()}</td>
                                        <td className="px-4 py-3 font-medium">Rs {(order.balance ?? 0).toLocaleString()}</td>
                                        <td className="px-4 py-3">{order.sale_type === 'cash' ? '—' : `${order.tenure ?? 0} months`}</td>
                                        <td className="px-4 py-3 font-medium">Rs {(order.installment_amount ?? 0).toLocaleString()}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">No sales data found for the selected range.</td>
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
