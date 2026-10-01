"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import Loader from "@/components/common/Loader";
import InstallmentPaymentModal from "@/components/Installments/InstallmentPaymentModal";
import { toast } from "react-hot-toast";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

type LedgerRow = {
    monthNumber: number;
    dueDate: string | null;
    dueAmount: number;
    status: string;
    paidAt: string | null;
    paymentMethod: string | null;
};

type Order = {
    id: number;
    order_ref: string;
    status: string;
    is_delivered: boolean;
    delivery_date: string | null;
    product_details: {
        product_name: string;
        imei_serial: string;
    };
    ledger: {
        installment_ledger: LedgerRow[];
        summary: {
            grandTotalRemaining: number;
            totalInstallmentRemaining: number;
            pendingInstallments: number;
        };
    };
};

type CustomerGroup = {
    customer: {
        name: string;
        whatsapp_number: string;
        present_address: string;
        area: string;
        city: string;
        profile_photo: string | null;
    };
    orders: Order[];
};

export default function RecoveryPortalPage() {
    const [customers, setCustomers] = useState<CustomerGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<{ id: number; ref: string; name: string } | null>(null);
    const [selectedInstallment, setSelectedInstallment] = useState<LedgerRow | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = Cookies.get("auth_token");
            const res = await fetch(`${API_BASE}/api/recovery/customers`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success) {
                setCustomers(json.data.customers);
                // Expand first customer by default if only one
                if (json.data.customers.length === 1) {
                    setExpandedCustomer(json.data.customers[0].customer.whatsapp_number);
                }
            } else {
                toast.error(json.message || "Failed to load recovery data");
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "Error loading data"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePayClick = (order: Order, customerName: string, inst: LedgerRow) => {
        setSelectedOrder({ id: order.id, ref: order.order_ref, name: customerName });
        setSelectedInstallment(inst);
        setIsPaymentModalOpen(true);
    };

    if (loading) return <Loader text="Loading your recovery assignments..." />;

    return (
        <div className="mx-auto max-w-7xl px-4 md:px-6 2xl:px-10">
            <Breadcrumb pageName="My Recovery Orders" />

            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Active Recoveries</h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage your assigned installment collections</p>
                </div>
                <button onClick={fetchData} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary py-2 px-6 text-white hover:bg-opacity-90 transition-all font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Refresh
                </button>
            </div>

            {customers.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="flex justify-center mb-4">
                        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">No Assigned Recoveries</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-2">You don't have any active recovery assignments at the moment. New assignments will appear here.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {customers.map((group) => (
                        <div key={group.customer.whatsapp_number} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:shadow-md">
                            <div 
                                className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                                onClick={() => setExpandedCustomer(expandedCustomer === group.customer.whatsapp_number ? null : group.customer.whatsapp_number)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-shrink-0 items-center justify-center border-2 border-primary/20">
                                        {group.customer.profile_photo ? (
                                            <img src={group.customer.profile_photo} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-2xl font-bold text-primary">{group.customer.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{group.customer.name}</h3>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                                {group.customer.whatsapp_number}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                {group.customer.area}, {group.customer.city}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding Balance</p>
                                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                            PKR {group.orders.reduce((sum, ord) => sum + ord.ledger.summary.grandTotalRemaining, 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <svg className={`w-6 h-6 transform transition-transform ${expandedCustomer === group.customer.whatsapp_number ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>

                            {expandedCustomer === group.customer.whatsapp_number && (
                                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Detailed Address</p>
                                            <p className="text-gray-800 dark:text-gray-200">{group.customer.present_address}</p>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Location Map</p>
                                            <button className="flex items-center gap-2 text-primary hover:underline font-semibold">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                                                Open in Google Maps
                                            </button>
                                        </div>
                                    </div>

                                    {group.orders.map((order) => (
                                        <div key={order.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                            <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-primary">#{order.order_ref}</span>
                                                    <span className="text-gray-400">|</span>
                                                    <span className="text-sm font-medium dark:text-gray-300">{order.product_details.product_name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">Remaining:</span>
                                                    <span className="text-sm font-bold text-red-600 dark:text-red-400">PKR {order.ledger.summary.grandTotalRemaining.toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="p-0 overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs font-semibold text-gray-500 uppercase bg-gray-50/50 dark:bg-gray-700/30">
                                                        <tr>
                                                            <th className="px-6 py-3">Month</th>
                                                            <th className="px-6 py-3">Due Date</th>
                                                            <th className="px-6 py-3">Amount</th>
                                                            <th className="px-6 py-3">Status</th>
                                                            <th className="px-6 py-3 text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {order.ledger.installment_ledger.map((inst) => (
                                                            <tr key={inst.monthNumber} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                                                                <td className="px-6 py-4 font-semibold">Month {inst.monthNumber}</td>
                                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                                                                    {inst.dueDate ? new Date(inst.dueDate).toLocaleDateString() : 'N/A'}
                                                                </td>
                                                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                                                                    PKR {inst.dueAmount.toLocaleString()}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                                                        inst.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                        inst.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                                    }`}>
                                                                        {inst.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    {inst.status !== 'paid' ? (
                                                                        <button
                                                                            onClick={() => handlePayClick(order, group.customer.name, inst)}
                                                                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition shadow-sm font-semibold text-xs"
                                                                        >
                                                                            Collect
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-[10px] text-gray-400 uppercase font-bold">Paid via {inst.paymentMethod || 'N/A'}</span>
                                                                            <span className="text-xs font-medium text-gray-500">{inst.paidAt ? formatExactDate(inst.paidAt, 'DD MMM YYYY, hh:mm A') : ''}</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {selectedOrder && (
                <InstallmentPaymentModal
                    open={isPaymentModalOpen}
                    onClose={() => {
                        setIsPaymentModalOpen(false);
                        setSelectedOrder(null);
                        setSelectedInstallment(null);
                    }}
                    onSuccess={fetchData}
                    orderId={selectedOrder.id}
                    orderRef={selectedOrder.ref}
                    customerName={selectedOrder.name}
                    installment={selectedInstallment}
                />
            )}
        </div>
    );
}
