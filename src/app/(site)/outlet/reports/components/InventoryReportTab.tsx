"use client";

import React, { useEffect, useState, useRef } from 'react';
import Loader from '@/components/common/Loader';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import { pickedDay } from '@/utils/pkt';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface InventoryReportTabProps {
    token: string;
    startDate: Date | null;
    endDate: Date | null;
    searchQuery: string;
}

export default function InventoryReportTab({ token, startDate, endDate, searchQuery }: InventoryReportTabProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
    const printRef = useRef(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                let url = `${API_BASE}/api/outlet-reports/stock-summary`;
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
        documentTitle: 'Inventory_Report',
        // This table has 6 data columns plus a full Serial Numbers list per
        // row — in portrait with the on-screen font size, everything past
        // "Product Name" overflowed the page width and was silently clipped
        // (the on-screen overflow-x-auto scrollbar has nothing to scroll on
        // a printed page). Landscape + smaller print-only text/padding
        // (applied on the table below) keeps every column on the page.
        pageStyle: `@page { size: landscape; margin: 10mm; }`,
    });

    const handleExportCSV = () => {
        if (!data || data.length === 0) return;
        const rows = data.map((item: any) => ({
            "Product Name": item.product,
            "Total In Stock": item.inStock,
            "Sold": item.sold,
            "Total Movement": item.total,
            "Stock Value (Cost)": item.valuation,
            "Serial Numbers": Array.isArray(item.serials) ? item.serials.join(", ") : ""
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");
        XLSX.writeFile(wb, "Inventory_Report.xlsx");
    };

    const filteredData = data
        .filter((item: any) => item.product?.toLowerCase().includes(searchQuery.toLowerCase()))
        // Items currently in stock float to the top (highest stock first); items
        // with none in stock sink to the bottom, instead of appearing in whatever
        // order the database happened to return them in.
        .sort((a: any, b: any) => {
            if ((b.inStock || 0) === 0 && (a.inStock || 0) > 0) return -1;
            if ((a.inStock || 0) === 0 && (b.inStock || 0) > 0) return 1;
            return (b.inStock || 0) - (a.inStock || 0);
        });

    const totalStockValuation = filteredData.reduce((acc: number, item: any) => acc + (item.valuation || 0), 0);
    const totalItemsInStock = filteredData.reduce((acc: number, item: any) => acc + (item.inStock || 0), 0);
    const totalItemsSold = filteredData.reduce((acc: number, item: any) => acc + (item.sold || 0), 0);

    if (loading) return <div className="p-8 text-center"><Loader /></div>;

    return (
        <div className="flex flex-col gap-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Inventory Movement Report</h2>
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
                    <h1 className="text-2xl font-bold text-gray-800">Inventory Movement Report</h1>
                    <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Items in Stock</p>
                        <p className="text-2xl font-bold text-green-600">{totalItemsInStock}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Items Sold in Period</p>
                        <p className="text-2xl font-bold text-blue-600">{totalItemsSold}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Current Stock Value (Cost Price)</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">Rs {totalStockValuation.toLocaleString()}</p>
                        {/* <p className="text-xs text-gray-400 mt-1">Sum of purchase price × qty for items in stock today</p> */}
                    </div>
                </div>

                {/* Table */}
                <style jsx>{`
                    @media print {
                        table th,
                        table td {
                            padding: 4px 6px !important;
                            font-size: 10px !important;
                        }
                    }
                `}</style>
                <div className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-400">
                            <thead className="bg-gray-50 text-gray-800 dark:bg-gray-900/50 dark:text-white">
                                <tr>
                                    <th className="px-4 py-3 font-medium">S.No</th>
                                    <th className="px-4 py-3 font-medium">Product Name</th>
                                    <th className="px-4 py-3 font-medium">Currently In Stock</th>
                                    <th className="px-4 py-3 font-medium">Sold</th>
                                    <th className="px-4 py-3 font-medium">Total Movement</th>
                                    <th className="px-4 py-3 font-medium">Stock Value (Cost)</th>
                                    <th className="px-4 py-3 font-medium">Serial Numbers</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredData.length > 0 ? filteredData.map((item: any, idx: number) => {
                                    const serials: string[] = Array.isArray(item.serials) ? item.serials : [];
                                    const isExpanded = expandedProduct === item.product;
                                    return (
                                        <React.Fragment key={idx}>
                                            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{item.product}</td>
                                                <td className="px-4 py-3 font-medium text-green-600">{item.inStock}</td>
                                                <td className="px-4 py-3 font-medium text-blue-600">{item.sold}</td>
                                                <td className="px-4 py-3">{item.total}</td>
                                                <td className="px-4 py-3">Rs {item.valuation?.toLocaleString()}</td>
                                                <td className="px-4 py-3">
                                                    {serials.length > 0 ? (
                                                        <>
                                                            <button
                                                                onClick={() => setExpandedProduct(isExpanded ? null : item.product)}
                                                                className="text-primary hover:underline text-xs font-medium print:hidden"
                                                            >
                                                                {isExpanded ? "Hide" : `${serials.length} serial${serials.length > 1 ? "s" : ""}`}
                                                            </button>
                                                            {/* Print/PDF has no click interaction, so list serials
                                                                out directly here instead of relying on the expand
                                                                toggle above (which stays screen-only). */}
                                                            <span className="hidden print:inline font-mono text-xs">
                                                                {serials.join(", ")}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                            {isExpanded && serials.length > 0 && (
                                                <tr className="bg-gray-50 dark:bg-gray-900/30 print:hidden">
                                                    <td />
                                                    <td colSpan={6} className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            {serials.map((s) => (
                                                                <span key={s} className="rounded-md border border-gray-200 bg-white px-2 py-1 font-mono text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                                                                    {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No inventory data found.</td>
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
