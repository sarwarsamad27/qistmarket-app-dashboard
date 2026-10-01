"use client";

import { useEffect, useState } from "react";
import { Modal } from "../Modal/Modal";
import {
    X, Package, ShoppingBag, Banknote, Calendar,
    User, Phone, Hash, ChevronRight, ArrowUpRight,
    RefreshCw
} from "lucide-react";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface OfficerDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    officerId: number | null;
}

export default function OfficerDetailsModal({ isOpen, onClose, officerId }: OfficerDetailsModalProps) {
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'inventory' | 'delivered' | 'cash'>('inventory');

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
                if (data.officer?.role_id === 3) {
                    setActiveTab('cash');
                } else if (data.officer?.role_id === 2) {
                    setActiveTab('inventory');
                }
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Failed to load officer details"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && officerId) {
            fetchDetails();
        }
    }, [isOpen, officerId]);

    if (!isOpen) return null;

    return (
        <Modal open={isOpen} onClose={onClose}>
            <div className="bg-white dark:bg-boxdark rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-stroke dark:border-strokedark animate-fade-in">
                {/* Header */}
                <div className="p-8 border-b border-stroke dark:border-strokedark overflow-visible flex items-start justify-between relative">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-black shadow-inner">
                            {details?.officer?.full_name?.charAt(0) || <User />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
                                {loading ? "Loading..." : details?.officer?.full_name}
                            </h2>
                            <div className="flex items-center gap-3 mt-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 dark:bg-meta-4 px-2 py-0.5 rounded-full">
                                    <Hash size={10} /> ID: {officerId}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    <Phone size={10} /> {details?.officer?.phone || "No Phone"}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-gray-50 dark:bg-meta-4 rounded-2xl text-gray-400 hover:text-red-500 hover:rotate-90 transition-all duration-300 shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Financial Summary Row */}
                {!loading && details?.stats && (
                    <div className="px-8 py-6 bg-primary/[0.03] border-b border-stroke dark:border-strokedark grid grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Collection</p>
                            <p className="text-lg font-black text-gray-800 dark:text-white tabular-nums">PKR {details.stats.total_collection?.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1">Paid to Outlet</p>
                            <p className="text-lg font-black text-green-600 tabular-nums">PKR {details.stats.paid_cash?.toLocaleString()}</p>
                        </div>
                        <div className="text-center p-4 bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm">
                            <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1">In Bag (Pending)</p>
                            <p className="text-lg font-black text-orange-600 tabular-nums">PKR {details.stats.pending_cash?.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="px-8 pt-4 flex gap-8 border-b border-stroke dark:border-strokedark">
                    {([
                        ...(details?.officer?.role_id === 2 ? ['inventory', 'delivered'] : []),
                        'cash'
                    ] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? "text-primary" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                }`}
                        >
                            {tab === 'inventory' ? 'In Hand Stock' : tab === 'delivered' ? 'Delivered Products' : 'Financial Ledger'}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(56,125,255,0.4)]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-6">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-primary">
                                    <RefreshCw size={20} className="animate-spin-slow" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-black uppercase tracking-widest text-gray-800 dark:text-white">Fetching Live Ledger</p>
                                <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">Syncing exact amounts and full history...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'inventory' && details?.officer?.role_id === 2 && (
                                <div className="space-y-4">
                                    {details?.inventory?.length === 0 ? (
                                        <EmptyState icon={<Package size={40} />} title="No Stock in Hand" subtitle="This officer currently has no units transferred." />
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {details?.inventory?.map((item: any) => (
                                                <div key={item.id} className="p-5 bg-gray-50 dark:bg-meta-4/20 rounded-3xl border border-stroke dark:border-strokedark flex items-start justify-between group hover:border-primary/30 transition-all">
                                                    <div>
                                                        <h4 className="font-black text-gray-800 dark:text-white text-sm group-hover:text-primary transition-colors">{item.product_name}</h4>
                                                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{item.category} • {item.color_variant || 'Default'}</p>
                                                        <div className="mt-3 flex items-center gap-2">
                                                            <span className="text-[9px] font-black bg-white dark:bg-boxdark border border-stroke dark:border-strokedark px-2 py-1 rounded-lg shadow-sm">
                                                                #{item.imei_serial}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 bg-white dark:bg-boxdark rounded-xl shadow-sm text-gray-300 group-hover:text-primary transition-colors">
                                                        <Package size={18} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'delivered' && details?.officer?.role_id === 2 && (
                                <div className="space-y-3">
                                    {!details?.delivered_products || details?.delivered_products?.length === 0 ? (
                                        <EmptyState icon={<ShoppingBag size={40} />} title="No Deliveries Yet" subtitle="This officer has not delivered any products." />
                                    ) : (
                                        <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark overflow-hidden">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-gray-50 dark:bg-meta-4/30 border-b border-stroke dark:border-strokedark">
                                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Product / IMEI</th>
                                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                                                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Delivery Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stroke dark:divide-strokedark">
                                                    {details?.delivered_products?.map((item: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-meta-4/10 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <p className="text-xs font-black text-gray-800 dark:text-white">{item.product_name}</p>
                                                                <p className="text-[9px] text-primary font-bold mt-0.5">#{item.imei_serial}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.customer_name}</p>
                                                                <p className="text-[9px] text-gray-400">Order: #{item.order_ref}</p>
                                                            </td>
                                                            <td className="px-6 py-4 text-right text-[10px] text-gray-400 font-bold tabular-nums">
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

                            {activeTab === 'cash' && (
                                <div className="space-y-8">
                                    {/* Summary or Collections list */}
                                    {/* <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 px-2">Recent Collections</h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            {details?.cash?.length === 0 ? (
                                                <div className="p-10 border-2 border-dashed border-stroke dark:border-strokedark rounded-3xl text-center text-gray-400 text-xs font-bold">No collections found</div>
                                            ) : (
                                                details?.cash?.map((entry: any) => (
                                                    <div key={entry.id} className="p-4 bg-gray-50 dark:bg-meta-4/20 rounded-2xl border border-stroke dark:border-strokedark flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2 rounded-xl shadow-sm ${entry.status === 'paid' ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500'}`}>
                                                                <Banknote size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs font-black text-gray-800 dark:text-white">PKR {entry.amount.toLocaleString()}</p>
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${entry.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'
                                                                        }`}>
                                                                        {entry.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-tighter">Ref: #{entry.order?.order_ref} • {new Date(entry.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</p>
                                                            <p className="text-xs font-black text-gray-800 dark:text-white tabular-nums">PKR {(entry.amount - entry.submitted_amount).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div> */}

                                    {/* Submission History */}
                                    {details?.submission_history?.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 mb-4 px-2">Outlet Submission History</h4>
                                            <div className="space-y-3">
                                                {details?.submission_history?.map((h: any) => (
                                                    <div key={h.id} className="flex items-center justify-between p-3 bg-green-500/[0.02] dark:bg-green-500/5 rounded-2xl border border-green-500/10">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                                                                <ArrowUpRight size={14} />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-gray-800 dark:text-white tabular-nums">PKR {h.amount.toLocaleString()}</p>
                                                                <p className="text-[8px] text-gray-400 font-bold">Order: #{h.order_ref} • {new Date(h.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                                                            {h.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer / Summary */}
                {!loading && (
                    <div className="p-8 bg-gray-50 dark:bg-meta-4/20 border-t border-stroke dark:border-strokedark flex items-center justify-between mt-auto">
                        <div className="flex gap-8">
                            {details?.officer?.role_id === 2 && (
                                <>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Stock Items</p>
                                        <p className="text-lg font-black text-gray-800 dark:text-white tabular-nums">{details?.inventory?.length || 0}</p>
                                    </div>
                                    <div className="w-px h-8 bg-stroke dark:border-strokedark self-center" />
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Delivered</p>
                                        <p className="text-lg font-black text-gray-800 dark:text-white tabular-nums">{details?.delivered_products?.length || 0}</p>
                                    </div>
                                </>
                            )}
                            {details?.officer?.role_id === 3 && (
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Successful Collections</p>
                                    <p className="text-lg font-black text-gray-800 dark:text-white tabular-nums">{details?.submission_history?.filter((h: any) => h.status === 'paid').length || 0}</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="bg-primary text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            Got It
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

function EmptyState({ icon, title, subtitle }: { icon: any, title: string, subtitle: string }) {
    return (
        <div className="py-20 text-center flex flex-col items-center justify-center animate-fade-in">
            <div className="text-gray-200 dark:text-gray-700 mb-4">{icon}</div>
            <h3 className="text-lg font-black text-gray-800 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-[200px] mx-auto font-bold">{subtitle}</p>
        </div>
    );
}
