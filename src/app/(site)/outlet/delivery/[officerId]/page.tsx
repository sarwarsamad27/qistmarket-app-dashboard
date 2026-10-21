"use client";

import { useEffect, useState, use } from "react";
import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

type Order = {
    id: number;
    order_ref: string;
    customer_name: string;
    whatsapp_number: string;
    product_name: string;
    total_amount: number;
    status: string;
    created_at: string;
};

type Officer = {
    id: number;
    full_name: string;
    username: string;
    phone: string;
    image: string | null;
};

type InventoryItem = {
    id: number;
    imei_serial: string;
    product_name: string;
    status: string;
};

export default function OfficerOrdersPage({ params }: { params: Promise<{ officerId: string }> }) {
    const { officerId } = use(params);
    const [officer, setOfficer] = useState<Officer | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Handover Modal State
    const [handoverModalOpen, setHandoverModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [selectedImei, setSelectedImei] = useState("");
    const [handoverOtp, setHandoverOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [officerId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Officer Details
            const officersRes = await fetch(`${BACKEND_URL}/api/orders/outlet/officers`, { headers: getAuthHeaders() });
            const officersData = await officersRes.json();
            if (officersData.success) {
                const found = officersData.data.find((o: Officer) => o.id === Number(officerId));
                setOfficer(found || null);
            }

            // Fetch Approved Orders
            const ordersRes = await fetch(`${BACKEND_URL}/api/orders/outlet/officers/${officerId}/approved`, { headers: getAuthHeaders() });
            const ordersData = await ordersRes.json();
            if (ordersData.success) {
                setOrders(ordersData.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchInventory = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/outlet/inventory`, { headers: getAuthHeaders() });
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    setInventoryItems(json.inventory.filter((i: InventoryItem) => i.status === "In Stock"));
                }
            }
        } catch (err) {
            console.error('Failed to fetch inventory', err);
        }
    };

    const openHandoverModal = (order: Order) => {
        setSelectedOrder(order);
        setHandoverModalOpen(true);
        setOtpSent(false);
        setHandoverOtp("");
        setSelectedImei("");
        fetchInventory();
    };

    const initiateHandover = async () => {
        if (!selectedOrder) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/initiate-handover`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            const json = await res.json();
            if (json.success) {
                setOtpSent(true);
                alert('Handover OTP sent to delivery officer');
            } else {
                alert(json.message || 'Failed to initiate handover');
            }
        } catch (err) {
            alert('Handover initiation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const completeHandover = async () => {
        if (!selectedOrder || !handoverOtp || !selectedImei) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/verify-handover`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    otp: handoverOtp,
                    imei_serial: selectedImei
                }),
            });
            const json = await res.json();
            if (json.success) {
                alert('Stock handover completed successfully');
                setHandoverModalOpen(false);
                fetchData(); // Refresh list
            } else {
                alert(json.message || 'Verification failed');
            }
        } catch (err) {
            alert('Handover verification failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading && !officer) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8 flex items-center gap-4">
                <Link href="/outlet/delivery" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Back">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Officer Orders</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Stock handover for <span className="font-semibold text-gray-900 dark:text-white">{officer?.full_name}</span>
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700 text-left border-b border-gray-100 dark:border-gray-600">
                                <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">S.No</th><th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">Order Ref</th>
                                <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">Product</th>
                                <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-gray-500 dark:text-gray-400">
                                        No approved orders assigned to this officer.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order, idx) => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-750/30 transition-colors"><td className="px-6 py-4 font-bold text-gray-500 tabular-nums">{idx + 1}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{order.order_ref}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-800 dark:text-gray-200">{order.customer_name}</div>
                                            <div className="text-xs text-gray-500">{order.whatsapp_number}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{order.product_name}</td>
                                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 uppercase">
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => openHandoverModal(order)}
                                                className="bg-primary hover:bg-opacity-90 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm"
                                            >
                                                HANDOVER
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Handover Modal */}
            {handoverModalOpen && selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Stock Handover</h3>
                                <p className="text-xs text-gray-500 mt-1">Order: {selectedOrder.order_ref}</p>
                            </div>
                            <button onClick={() => setHandoverModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            {!otpSent ? (
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Initiate Authentication</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Send a secure OTP to the delivery officer to confirm handover.</p>
                                    <button 
                                        onClick={initiateHandover}
                                        disabled={isSubmitting}
                                        className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? "SENDING..." : "SEND OTP VIA WHATSAPP"}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-xl flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        <p className="text-sm text-green-700 dark:text-green-400 font-medium whitespace-pre-wrap">OTP has been sent to the delivery officer's phone.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Select IMEI / Serial</label>
                                        <select 
                                            value={selectedImei}
                                            onChange={(e) => setSelectedImei(e.target.value)}
                                            className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl p-3.5 text-sm font-medium dark:text-white focus:ring-2 focus:ring-primary transition-all"
                                        >
                                            <option value="">Choose from inventory...</option>
                                            {inventoryItems.map(item => (
                                                <option key={item.id} value={item.imei_serial}>
                                                    {item.imei_serial} ({item.product_name})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Enter Verification OTP</label>
                                        <input 
                                            type="text" 
                                            value={handoverOtp}
                                            onChange={(e) => setHandoverOtp(e.target.value)}
                                            placeholder="5-digit code from DO"
                                            maxLength={5}
                                            className="w-full bg-gray-50 dark:bg-gray-700 border-none rounded-xl p-3.5 text-center text-xl font-bold tracking-[0.5em] dark:text-white focus:ring-2 focus:ring-primary transition-all"
                                        />
                                    </div>

                                    <button 
                                        onClick={completeHandover}
                                        disabled={isSubmitting || !handoverOtp || !selectedImei}
                                        className="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {isSubmitting ? "VERIFYING..." : "COMPLETE HANDOVER"}
                                    </button>
                                    
                                    <button 
                                        onClick={() => setOtpSent(false)} 
                                        className="w-full text-gray-500 text-xs font-bold uppercase hover:text-gray-700 transition-colors"
                                    >
                                        Resend Code
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
