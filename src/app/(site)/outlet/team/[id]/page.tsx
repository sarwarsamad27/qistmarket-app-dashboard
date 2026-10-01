"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
    X, Package, ShoppingBag, Banknote, Calendar,
    User, Phone, Hash, ChevronRight, ArrowUpRight,
    RefreshCw, FileText, ArrowLeft,
    MapPin, ToggleLeft, ToggleRight, Map, Clock
} from "lucide-react";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function OfficerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: officerId } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'inventory' | 'delivered' | 'cash' | 'verification' | 'assigned_orders'>('inventory');
    const [orderStatusFilter, setOrderStatusFilter] = useState<string>('Pending');

    const [statusLoading, setStatusLoading] = useState(false);
    const [traceModalOpen, setTraceModalOpen] = useState(false);
    const [traceDate, setTraceDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [locationHistory, setLocationHistory] = useState<any[]>([]);
    const [fetchingTrace, setFetchingTrace] = useState(false);

    const fetchDetails = async () => {
        if (!officerId) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/team/details/${officerId}`, {
                headers: {
                    Authorization: `Bearer ${Cookies.get("auth_token")}`,
                }
            });
            const data = await res.json();
            if (data.success) {
                setDetails(data);
                if (data.officer?.role_id === 1) {
                    setActiveTab('verification');
                    setOrderStatusFilter('Pending');
                } else if (data.officer?.role_id === 3) {
                    setActiveTab('assigned_orders');
                } else if (data.officer?.role_id === 2) {
                    setActiveTab('assigned_orders');
                }
            } else {
                toast.error(data.message || "Failed to load officer details");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Failed to load officer details"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [officerId]);

    const toggleStatus = async () => {
        if (!details?.officer) return;
        setStatusLoading(true);
        try {
            const currentStatus = details.officer.status;
            const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
            const res = await fetch(`${API_BASE}/api/users/${officerId}/status`, {
                method: "PATCH",
                headers: { 
                    Authorization: `Bearer ${Cookies.get("auth_token")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Officer ${details.officer.status === 'active' ? 'disabled' : 'enabled'} successfully`);
                setDetails({ ...details, officer: { ...details.officer, status: details.officer.status === 'active' ? 'inactive' : 'active' } });
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Failed to update status"));
        } finally {
            setStatusLoading(false);
        }
    };

    const fetchTrace = async () => {
        setFetchingTrace(true);
        try {
            const res = await fetch(`${API_BASE}/api/users/${officerId}/location-history?date=${traceDate}`, {
                headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` }
            });
            const data = await res.json();
            if (data.success) {
                setLocationHistory(data.data);
            } else {
                toast.error("Failed to load location history");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Failed to load location history"));
        } finally {
            setFetchingTrace(false);
        }
    };

    useEffect(() => {
        if (traceModalOpen) fetchTrace();
    }, [traceModalOpen, traceDate]);

    const verificationTabs = ['Pending', 'In Progress', 'Completed', 'Approved', 'Delivered', 'Rejected', 'Expired', ];

    if (loading) {
        return (
            <div className="min-h-screen py-24 flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-primary">
                        <RefreshCw size={24} className="animate-spin-slow" />
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-sm font-black uppercase tracking-widest text-gray-800 dark:text-white">Fetching Officer Profile</p>
                    <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-tighter">Syncing exact amounts and full history...</p>
                </div>
            </div>
        );
    }

    if (!details) {
        return <EmptyState icon={<User size={40} />} title="Officer Not Found" subtitle="We couldn't find the requested officer profile." />;
    }

    const isVerificationOfficer = details?.officer?.role_id === 1;
    const isDeliveryOfficer = details?.officer?.role_id === 2;
    const isRecoveryOfficer = details?.officer?.role_id === 3;

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 pt-6">
            {/* Nav area */}
            <div className="flex items-center gap-4 text-gray-400">
                <button onClick={() => router.back()} className="hover:text-primary transition-all p-2 bg-white dark:bg-boxdark rounded-xl shadow-sm border border-stroke dark:border-strokedark">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                    <span>Officer Team</span>
                    <ChevronRight size={12} />
                    <span className="text-primary">{details?.officer?.full_name}</span>
                </div>
            </div>

            <div className="bg-white dark:bg-boxdark rounded-[2.5rem] shadow-sm w-full overflow-hidden flex flex-col border border-stroke dark:border-strokedark animate-fade-in relative z-10">
                {/* Header */}
                <div className="p-10 border-b border-stroke dark:border-strokedark overflow-visible flex items-start justify-between relative bg-gradient-to-br from-white to-gray-50 dark:from-boxdark dark:to-boxdark/90">
                    <div className="flex items-center gap-6 z-10 relative">
                        <div className="w-20 h-20 rounded-[2rem] bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-3xl font-black shadow-inner ring-4 ring-white dark:ring-boxdark">
                            {details?.officer?.full_name?.charAt(0) || <User />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                                    {details?.officer?.full_name}
                                </h2>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                    isVerificationOfficer ? 'bg-blue-100 text-blue-600' :
                                    isDeliveryOfficer ? 'bg-orange-100 text-orange-600' :
                                    'bg-purple-100 text-purple-600'
                                }`}>
                                    {isVerificationOfficer ? 'Verification Officer' : isDeliveryOfficer ? 'Delivery Agent' : 'Recovery Officer'}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-500 bg-gray-100 dark:bg-meta-4 px-3 py-1 rounded-full">
                                    <Hash size={12} /> ID: {officerId}
                                </span>
                                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
                                    <Phone size={12} /> {details?.officer?.phone || "No Phone"}
                                </span>
                                <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                    details?.officer?.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                    Status: {details?.officer?.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={toggleStatus}
                            disabled={statusLoading}
                            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold shadow-sm transition-all ${
                                details?.officer?.status === 'active' 
                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                                    : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                            }`}
                        >
                            {statusLoading ? <RefreshCw size={18} className="animate-spin" /> : details?.officer?.status === 'active' ? <ToggleLeft size={18} /> : <ToggleRight size={18} />}
                            {details?.officer?.status === 'active' ? 'Disable Account' : 'Enable Account'}
                        </button>
                        <button 
                            onClick={() => setTraceModalOpen(true)}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all text-sm font-bold shadow-sm"
                        >
                            <MapPin size={18} />
                            Trace Location
                        </button>
                    </div>
                </div>

                {/* Financial Summary Row - For DO and RO */}
                {details?.stats && !isVerificationOfficer && (
                    <div className="px-10 py-8 bg-primary/[0.03] border-b border-stroke dark:border-strokedark grid grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:shadow-md hover:border-primary/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center justify-center gap-2"><Banknote size={14}/> Total Collection</p>
                            <p className="text-3xl font-black text-gray-800 dark:text-white tabular-nums">PKR {details.stats.total_collection?.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:shadow-md hover:border-green-500/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-green-500 mb-2 flex items-center justify-center gap-2"><RefreshCw size={14}/> Paid to Outlet</p>
                            <p className="text-3xl font-black text-green-600 tabular-nums">PKR {details.stats.paid_cash?.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:shadow-md hover:border-orange-500/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2 flex items-center justify-center gap-2"><ShoppingBag size={14}/> In Bag (Pending)</p>
                            <p className="text-3xl font-black text-orange-600 tabular-nums">PKR {details.stats.pending_cash?.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {/* Verification Summary Row - Only for VO */}
                {details?.stats && isVerificationOfficer && (
                    <div className="px-10 py-8 bg-blue-500/[0.03] border-b border-stroke dark:border-strokedark grid grid-cols-7 gap-6">
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-blue-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Pending</p>
                            <p className="text-2xl font-black text-blue-600 tabular-nums">{details.stats.verification_stats?.pending || 0}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-yellow-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600 mb-1">In Progress</p>
                            <p className="text-2xl font-black text-yellow-600 tabular-nums">{details.stats.verification_stats?.in_progress || 0}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-emerald-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Completed</p>
                            <p className="text-2xl font-black text-emerald-600 tabular-nums">{details.stats.verification_stats?.completed || 0}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-teal-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-1">Approved</p>
                            <p className="text-2xl font-black text-teal-600 tabular-nums">{details.stats.verification_stats?.approved || 0}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-purple-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-1">Delivered</p>
                            <p className="text-2xl font-black text-purple-600 tabular-nums">{details.stats.verification_stats?.delivered || 0}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-rose-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">Rejected</p>
                            <p className="text-2xl font-black text-rose-600 tabular-nums">{details.stats.verification_stats?.rejected || 0}</p>
                        </div>
                        <div className="text-center p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark shadow-sm transition-all hover:border-gray-500/30 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Expired</p>
                            <p className="text-2xl font-black text-gray-600 tabular-nums">{details.stats.verification_stats?.expired || 0}</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="px-10 pt-6 flex gap-10 border-b border-stroke dark:border-strokedark overflow-x-auto no-scrollbar">
                    {isVerificationOfficer ? (
                        // Verification Officer - Status Tabs
                        verificationTabs.map((status) => (
                            <button
                                key={status}
                                onClick={() => setOrderStatusFilter(status)}
                                className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative whitespace-nowrap ${
                                    orderStatusFilter === status ? "text-primary scale-105" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                }`}
                            >
                                {status}
                                {orderStatusFilter === status && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-t-full shadow-[0_-2px_12px_rgba(56,125,255,0.4)]" />
                                )}
                            </button>
                        ))
                    ) : isDeliveryOfficer ? (
                        // Delivery Officer Tabs
                        (['assigned_orders', 'inventory', 'delivered'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${
                                    activeTab === tab ? "text-primary scale-105" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                }`}
                            >
                                {tab === 'inventory' ? 'In Hand Stock' : 
                                 tab === 'delivered' ? 'Delivered Products' : 
                                 'Assigned Orders'}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-t-full shadow-[0_-2px_12px_rgba(56,125,255,0.4)]" />
                                )}
                            </button>
                        ))
                    ) : (
                        // Recovery Officer Tabs
                        (['assigned_orders', 'cash'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${
                                    activeTab === tab ? "text-primary scale-105" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                }`}
                            >
                                {tab === 'assigned_orders' ? 'Assigned Recoveries' : 'Financial Ledger'}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-t-full shadow-[0_-2px_12px_rgba(56,125,255,0.4)]" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar min-h-[40vh] bg-gray-50/50 dark:bg-meta-4/5">
                    
                    {/* ASSIGNED ORDERS - For both DO and RO */}
                    {activeTab === 'assigned_orders' && !isVerificationOfficer && (
                        <div className="space-y-6">
                            {!details?.assigned_orders || details?.assigned_orders?.length === 0 ? (
                                <EmptyState 
                                    icon={<FileText size={48} />}
                                    title={isRecoveryOfficer ? "No Assigned Recoveries" : "No Assigned Deliveries"} 
                                    subtitle={`This officer has no ${isRecoveryOfficer ? 'recovery' : 'delivery'} tasks assigned.`} 
                                />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {details?.assigned_orders.map((order: any, idx: number) => (
                                        <div 
                                            key={idx} 
                                            className={`p-5 bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark flex justify-between shadow-sm hover:shadow-md transition-all ${
                                                isRecoveryOfficer ? 'hover:border-purple-500/30' : 'hover:border-primary/30'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex gap-2 items-center mb-1">
                                                    <span className={`font-black ${isRecoveryOfficer ? 'text-purple-600' : 'text-primary'}`}>
                                                        #{order.order_ref}
                                                    </span>
                                                    <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md bg-gray-100 dark:bg-meta-4 text-gray-500 font-bold">
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{order.customer_name}</p>
                                                <p className="text-[10px] text-gray-500 mt-0.5">{order.product_name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] uppercase tracking-widest font-black text-gray-400">Area</p>
                                                <p className="text-[11px] font-bold text-gray-600 line-clamp-1 max-w-[120px]">
                                                    {order.area || order.address || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* INVENTORY - Only for DO */}
                    {activeTab === 'inventory' && isDeliveryOfficer && (
                        <div className="space-y-6">
                            {details?.inventory?.length === 0 ? (
                                <EmptyState icon={<Package size={48} />} title="No Stock in Hand" subtitle="This officer currently has no units transferred." />
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {details?.inventory?.map((item: any, idx: number) => (
                                        <div key={`inv-${item.id}-${idx}`} className="p-6 bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark flex items-start justify-between group hover:border-primary/30 hover:shadow-xl transition-all hover:-translate-y-1">
                                            <div>
                                                <h4 className="font-black text-gray-800 dark:text-white text-base group-hover:text-primary transition-colors">{item.product_name}</h4>
                                                <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{item.category} • {item.color_variant || 'Default'}</p>
                                                <div className="mt-4 flex items-center gap-2">
                                                    <span className="text-[10px] font-black bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark px-3 py-1.5 rounded-xl shadow-sm text-gray-600 dark:text-gray-300">
                                                        #{item.imei_serial}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-gray-50 dark:bg-meta-4 rounded-2xl shadow-sm text-gray-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                <Package size={20} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* DELIVERED PRODUCTS - Only for DO */}
                    {activeTab === 'delivered' && isDeliveryOfficer && (
                        <div className="space-y-4">
                            {!details?.delivered_products || details?.delivered_products?.length === 0 ? (
                                <EmptyState icon={<ShoppingBag size={48} />} title="No Deliveries Yet" subtitle="This officer has not delivered any products." />
                            ) : (
                                <div className="bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50 dark:bg-meta-4/30 border-b border-stroke dark:border-strokedark">
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Product / IMEI</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Delivery Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stroke dark:divide-strokedark">
                                            {details?.delivered_products?.map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-meta-4/10 transition-colors group">
                                                    <td className="px-8 py-5">
                                                        <p className="text-sm font-black text-gray-800 dark:text-white group-hover:text-primary transition-colors">{item.product_name}</p>
                                                        <p className="text-[10px] text-primary font-bold mt-1 tracking-wider">#{item.imei_serial}</p>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{item.customer_name}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">Order: #{item.order_ref}</p>
                                                    </td>
                                                    <td className="px-8 py-5 text-right text-xs text-gray-500 font-bold tabular-nums">
                                                        {new Date(item.delivery_date).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VERIFICATION ORDERS - Only for VO */}
                    {isVerificationOfficer && (
                        <div className="space-y-6">
                            {!details?.verifications || details?.verifications?.length === 0 ? (
                                <EmptyState icon={<FileText size={48} />} title="No Assigned Orders" subtitle="This officer has no orders to verify." />
                            ) : (
                                <>
                                    {(() => {
                                        const filtered = details?.verifications?.filter((v: any) => {
                                            const orderStatus = (v.status || "").toLowerCase();
                                            
                                            if (orderStatusFilter === 'Delivered') {
                                                return v.is_delivered === true || orderStatus === 'delivered';
                                            } else if (orderStatusFilter === 'Pending') {
                                                return ['pending verification', 'pending', 'new'].includes(orderStatus);
                                            } else if (orderStatusFilter === 'In Progress') {
                                                return ['verification in progress', 'in_progress', 'in progress'].includes(orderStatus);
                                            } else if (orderStatusFilter === 'Completed') {
                                                return orderStatus === 'completed';
                                            } else if (orderStatusFilter === 'Approved') {
                                                return ['approved', 'verified', 'ready for delivery'].includes(orderStatus);
                                            } else if (orderStatusFilter === 'Rejected') {
                                                return orderStatus === 'rejected';
                                            } else if (orderStatusFilter === 'Expired') {
                                                return orderStatus === 'expired';
                                            }
                                            
                                            return false;
                                        }) || [];
                                        
                                        return filtered.length === 0 ? (
                                            <EmptyState 
                                                icon={<FileText size={48} />} 
                                                title={`No ${orderStatusFilter.toUpperCase()} Orders`} 
                                                subtitle={`No orders with ${orderStatusFilter} status assigned to this officer.`} 
                                            />
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {filtered.map((item: any, idx: number) => {
                                                    const orderStatus = item.status || 'Pending';
                                                    const isDelivered = item.is_delivered;

                                                    let statusColor = 'bg-white dark:bg-boxdark border-gray-200 dark:border-gray-500/20';
                                                    let statusBadgeColor = 'bg-gray-100 text-gray-600';
                                                    let hoverRing = 'hover:ring-gray-200';
                                                    let textColor = 'text-gray-800 dark:text-white';
                                                    let productTextColor = 'text-gray-800 dark:text-white';
                                                    let customerTextColor = 'text-gray-600 dark:text-gray-300';
                                                    let orderRefColor = 'text-primary';

                                                    const displayStatus = isDelivered ? 'Delivered' : orderStatus;
                                                    const lowerStatus = (displayStatus || "").toLowerCase();

                                                    if (isDelivered || lowerStatus === 'completed' || lowerStatus === 'verified' || lowerStatus === 'approved') {
                                                        statusColor = 'bg-white dark:bg-boxdark border-emerald-200 dark:border-emerald-500/30';
                                                        statusBadgeColor = 'bg-emerald-100 text-emerald-700';
                                                        hoverRing = 'hover:ring-emerald-300';
                                                        textColor = 'text-emerald-800 dark:text-emerald-200';
                                                        productTextColor = 'text-emerald-900 dark:text-emerald-100';
                                                        customerTextColor = 'text-emerald-700 dark:text-emerald-300';
                                                        orderRefColor = 'text-emerald-600';
                                                    } else if (lowerStatus.includes('pending')) {
                                                        statusColor = 'bg-white dark:bg-boxdark border-blue-200 dark:border-blue-500/30';
                                                        statusBadgeColor = 'bg-blue-100 text-blue-700';
                                                        hoverRing = 'hover:ring-blue-300';
                                                        textColor = 'text-blue-800 dark:text-blue-200';
                                                        productTextColor = 'text-blue-900 dark:text-blue-100';
                                                        customerTextColor = 'text-blue-700 dark:text-blue-300';
                                                        orderRefColor = 'text-blue-600';
                                                    } else if (lowerStatus === 'in progress' || lowerStatus === 'in_progress') {
                                                        statusColor = 'bg-white dark:bg-boxdark border-amber-200 dark:border-amber-500/30';
                                                        statusBadgeColor = 'bg-amber-100 text-amber-700';
                                                        hoverRing = 'hover:ring-amber-300';
                                                        textColor = 'text-amber-800 dark:text-amber-200';
                                                        productTextColor = 'text-amber-900 dark:text-amber-100';
                                                        customerTextColor = 'text-amber-700 dark:text-amber-300';
                                                        orderRefColor = 'text-amber-600';
                                                    } else if (lowerStatus === 'rejected') {
                                                        statusColor = 'bg-white dark:bg-boxdark border-rose-200 dark:border-rose-500/30';
                                                        statusBadgeColor = 'bg-rose-100 text-rose-700';
                                                        hoverRing = 'hover:ring-rose-300';
                                                        textColor = 'text-rose-800 dark:text-rose-200';
                                                        productTextColor = 'text-rose-900 dark:text-rose-100';
                                                        customerTextColor = 'text-rose-700 dark:text-rose-300';
                                                        orderRefColor = 'text-rose-600';
                                                    } else if (lowerStatus === 'cancelled') {
                                                        statusColor = 'bg-white dark:bg-boxdark border-orange-200 dark:border-orange-500/30';
                                                        statusBadgeColor = 'bg-orange-100 text-orange-700';
                                                        hoverRing = 'hover:ring-orange-300';
                                                        textColor = 'text-orange-800 dark:text-orange-200';
                                                        productTextColor = 'text-orange-900 dark:text-orange-100';
                                                        customerTextColor = 'text-orange-700 dark:text-orange-300';
                                                        orderRefColor = 'text-orange-600';
                                                    } else if (lowerStatus === 'expired') {
                                                        statusColor = 'bg-white dark:bg-boxdark border-gray-300 dark:border-gray-600/30';
                                                        statusBadgeColor = 'bg-gray-200 text-gray-700';
                                                        hoverRing = 'hover:ring-gray-400';
                                                        textColor = 'text-gray-700 dark:text-gray-300';
                                                        productTextColor = 'text-gray-800 dark:text-gray-200';
                                                        customerTextColor = 'text-gray-600 dark:text-gray-400';
                                                        orderRefColor = 'text-gray-500';
                                                    }

                                                    return (
                                                        <div 
                                                            key={idx} 
                                                            className={`p-6 rounded-[2rem] border-2 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 hover:ring-4 ${statusColor} ${hoverRing}`}
                                                        >
                                                            <div className="flex flex-col h-full justify-between">
                                                                <div>
                                                                    <div className="flex items-start justify-between gap-3 mb-4">
                                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${statusBadgeColor}`}>
                                                                            {displayStatus.toUpperCase()}
                                                                        </span>
                                                                        <div className="text-right">
                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-0.5">Date</p>
                                                                            <p className={`text-[11px] font-bold tabular-nums ${textColor}`}>
                                                                                {new Date(item.created_at).toLocaleDateString()}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <h3 className={`text-lg font-black mb-2 leading-tight ${productTextColor}`}>
                                                                        {item.product_name}
                                                                    </h3>
                                                                    <p className={`text-sm font-bold ${customerTextColor}`}>
                                                                        {item.customer_name}
                                                                    </p>
                                                                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-2">
                                                                        Order: <span className={`font-black uppercase tracking-widest ${orderRefColor}`}>#{item.order_ref}</span>
                                                                    </p>
                                                                    
                                                                    {item.home_location_verified && (
                                                                        <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                                                                Location Verified
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {item.verification_feedback && (
                                                                    <div className="mt-6 pt-4 border-t border-stroke dark:border-strokedark">
                                                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Feedback</p>
                                                                        <p className="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2">"{item.verification_feedback}"</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </>
                            )}
                        </div>
                    )}

                    {/* CASH LEDGER / SUBMISSIONS - Only for RO */}
                    {activeTab === 'cash' && isRecoveryOfficer && (
                        <div className="space-y-8">
                            {details?.submission_history?.length > 0 ? (
                                <div className="bg-white dark:bg-boxdark rounded-[2rem] border border-stroke dark:border-strokedark overflow-hidden shadow-sm">
                                    <div className="p-6 border-b border-stroke dark:border-strokedark bg-green-50/50 dark:bg-green-500/5">
                                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-green-600 flex items-center gap-2">
                                            <ArrowUpRight size={16} /> Outlet Submission History
                                        </h4>
                                    </div>
                                    <div className="divide-y divide-stroke dark:divide-strokedark">
                                        {details?.submission_history?.map((h: any, idx: number) => (
                                            <div key={`sub-${h.id}-${idx}`} className="flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-[1rem] bg-green-100 flex items-center justify-center text-green-600">
                                                        <Banknote size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-black text-gray-800 dark:text-white tabular-nums">PKR {h.amount.toLocaleString()}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">#{h.order_ref}</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                            <p className="text-[10px] text-gray-400 font-bold">{new Date(h.date).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-3 py-1.5 rounded-xl border border-green-200">
                                                    {h.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>


                                </div>
                            ) : (
                                <EmptyState icon={<Banknote size={48} />} title="No Submissions" subtitle="There are no cash submissions to the outlet yet." />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Location Trace Modal */}
            {traceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-boxdark rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-stroke dark:border-strokedark animate-slide-up">
                        <div className="p-6 border-b border-stroke dark:border-strokedark flex items-center justify-between bg-gray-50 dark:bg-meta-4/20">
                            <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary"><MapPin size={24} /></div>
                                Location Trace History
                            </h3>
                            <button onClick={() => setTraceModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors p-2 bg-white dark:bg-meta-4 rounded-full shadow-sm"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 border-b border-stroke dark:border-strokedark flex items-center gap-4 bg-white dark:bg-boxdark">
                            <label className="text-sm font-bold text-gray-600 dark:text-gray-300">Select Date:</label>
                            <input 
                                type="date" 
                                value={traceDate} 
                                onChange={(e) => setTraceDate(e.target.value)}
                                className="border border-stroke dark:border-strokedark rounded-xl px-4 py-2 bg-gray-50 dark:bg-meta-4 text-sm font-medium focus:border-primary outline-none"
                            />
                            <button onClick={fetchTrace} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-colors">
                                <RefreshCw size={18} className={fetchingTrace ? "animate-spin" : ""} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-meta-4/10">
                            {fetchingTrace ? (
                                <div className="py-20 flex justify-center"><RefreshCw size={30} className="animate-spin text-primary opacity-50" /></div>
                            ) : locationHistory.length === 0 ? (
                                <div className="py-20 text-center">
                                    <Map size={48} className="mx-auto text-gray-300 mb-4" />
                                    <p className="text-lg font-bold text-gray-500">No Location Data</p>
                                    <p className="text-sm text-gray-400">No tracing logs were recorded for this date.</p>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-primary/20 ml-4 space-y-6 pb-4">
                                    {locationHistory.map((loc, idx) => (
                                        <div key={loc.id} className="relative pl-6">
                                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white dark:bg-boxdark border-4 border-primary"></div>
                                            <div className="bg-white dark:bg-boxdark p-4 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-2">
                                                        <Clock size={14} className="text-primary" /> {new Date(loc.timestamp).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <div className="flex gap-4 text-xs font-bold text-gray-500 bg-gray-50 dark:bg-meta-4 p-2 rounded-xl">
                                                    <span>Lat: <span className="text-gray-800 dark:text-white">{loc.latitude.toFixed(6)}</span></span>
                                                    <span>Lng: <span className="text-gray-800 dark:text-white">{loc.longitude.toFixed(6)}</span></span>
                                                    <a 
                                                        href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        className="ml-auto text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        View Map <ArrowUpRight size={12} />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EmptyState({ icon, title, subtitle }: { icon: any, title: string, subtitle: string }) {
    return (
        <div className="py-24 text-center flex flex-col items-center justify-center animate-fade-in bg-white dark:bg-boxdark rounded-[2.5rem] border border-dashed border-stroke dark:border-strokedark shadow-sm">
            <div className="text-gray-300 dark:text-gray-600 mb-6 bg-gray-50 dark:bg-meta-4 p-6 rounded-full">{icon}</div>
            <h3 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">{title}</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-[280px] mx-auto font-bold">{subtitle}</p>
        </div>
    );
}