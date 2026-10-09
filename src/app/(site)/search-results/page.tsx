"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import { Loader2, Search, User, FileText, MapPin, Phone, UserCheck, ClipboardList, PartyPopper } from "lucide-react";
import { useProfileModal } from "../../../../contexts/ProfileModalContext";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

function SearchResultsContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type') || 'all';

    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { openProfile } = useProfileModal();

    useEffect(() => {
        if (query) {
            handleSearch();
        }
    }, [query, type]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/search?query=${encodeURIComponent(query)}&type=${type}`, {
                headers: {
                    Authorization: `Bearer ${Cookies.get("auth_token")}`,
                },
            });
            const data = await res.json();
            if (data.success) {
                setResults(data.results);
            }
        } catch (e) {
            console.error("Search error:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName={`Search Results: ${query}`} />

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Search size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Universal Search</h2>
                        <p className="text-sm text-gray-500">Showing all matches for "{query}"</p>
                    </div>
                </div>
                
                <div className="flex gap-2 bg-white dark:bg-boxdark p-1 rounded-xl shadow-sm border border-stroke dark:border-strokedark">
                    {['all', 'customers', 'orders'].map((t) => (
                        <a
                            key={t}
                            href={`/search-results?query=${query}&type=${t}`}
                            className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                type === t 
                                ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-meta-4'
                            }`}
                        >
                            {t}
                        </a>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex h-96 items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 text-sm font-black uppercase tracking-widest text-gray-500">Searching Records...</p>
                    </div>
                </div>
            ) : results.length > 0 ? (
                <div className="space-y-8">
                    {/* Customers Section */}
                    {(type === 'all' || type === 'customers') && results.filter(i => ['delivered', 'returned'].includes(String(i.status).toLowerCase())).length > 0 && (
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 text-green-500 text-xs font-black uppercase tracking-[0.2em] border border-green-500/20">
                                    <UserCheck size={16} /> Customers ({results.filter(i => ['delivered', 'returned'].includes(String(i.status).toLowerCase())).length})
                                </span>
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-green-500/20 to-transparent" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.filter(i => ['delivered', 'returned'].includes(String(i.status).toLowerCase())).map((item) => (
                                    <ResultCard key={item.id} item={item} onProfileClick={() => openProfile(item)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Orders Section */}
                    {(type === 'all' || type === 'orders') && results.filter(i => !['delivered', 'returned'].includes(String(i.status).toLowerCase())).length > 0 && (
                        <div>
                            <div className="flex items-center gap-4 mb-6">
                                <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 text-xs font-black uppercase tracking-[0.2em] border border-amber-500/20">
                                    <ClipboardList size={16} /> Orders ({results.filter(i => !['delivered', 'returned'].includes(String(i.status).toLowerCase())).length})
                                </span>
                                <div className="h-[1px] flex-1 bg-gradient-to-r from-amber-500/20 to-transparent" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.filter(i => !['delivered', 'returned'].includes(String(i.status).toLowerCase())).map((item) => (
                                    <ResultCard key={item.id} item={item} onProfileClick={() => openProfile(item)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex h-96 flex-col items-center justify-center rounded-[40px] bg-white dark:bg-boxdark shadow-sm border border-stroke dark:border-strokedark p-12 text-center">
                    <div className="w-24 h-24 bg-gray-50 dark:bg-meta-4 rounded-full flex items-center justify-center mb-6">
                        <Search size={40} className="text-gray-200" />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-white mb-3">No matching records found</h3>
                    <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                        We couldn't find any orders or customers matching your search query. Please try searching with different keywords like an IMEI/serial, CNIC, phone number, or order ID.
                    </p>
                    <button 
                        onClick={() => window.history.back()}
                        className="mt-8 px-8 py-3 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        Go Back
                    </button>
                </div>
            )}
        </div>
    );
}

function ResultCard({ item, onProfileClick }: { item: any, onProfileClick: () => void }) {
    const purchaserPhoto = item.verification?.documents?.find((d: any) => d.document_type === 'photo' && d.person_type === 'purchaser')?.file_url;
    const isDelivered = item.status === 'delivered';
    const isBlacklisted = item.is_blacklisted === true || item.verification?.is_blacklisted === true || item.verification?.purchaser?.is_blacklisted === true;

    return (
        <div className={`bg-white dark:bg-boxdark rounded-[32px] border overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group ${isBlacklisted ? 'bg-red-50/40 dark:bg-red-950/10 border-red-200 dark:border-red-900/30 hover:border-red-300' : 'border-stroke dark:border-strokedark'}`}>
            <div className="p-6">
                <div className="flex items-start gap-5 mb-6">
                    <div className="relative shrink-0">
                        <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                            {purchaserPhoto ? (
                                <img src={purchaserPhoto} alt={item.customer_name} className="w-full h-full object-cover" />
                            ) : (
                                <User size={32} className="text-gray-200" />
                            )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-lg border-2 border-white dark:border-boxdark text-[8px] font-black uppercase tracking-widest text-white ${isBlacklisted ? 'bg-red-600' : (isDelivered ? 'bg-green-500' : 'bg-amber-500')}`}>
                            {isBlacklisted ? 'Blacklisted' : item.status}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h4 className="font-black text-gray-900 dark:text-white text-lg truncate mb-1">
                            {item.customer_name}
                        </h4>
                        {item.is_legacy && <span className="rounded bg-blue-50 px-2 py-1 text-[10px] text-blue-700">Legacy import</span>}
                        {item.imei_serial && <span className="block font-mono text-xs text-gray-500">IMEI: {item.imei_serial}</span>}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-tight">
                            <span>S/O:</span>
                            <span className="truncate">{item.father_name || 'N/A'}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                             <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-meta-4 text-[9px] font-black uppercase tracking-widest text-gray-500 border border-stroke dark:border-strokedark">
                                REF: {item.order_ref}
                             </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 mb-6 bg-gray-50 dark:bg-meta-4/30 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <Phone size={14} className="text-primary/60 shrink-0" />
                        <span className="text-xs font-bold">{item.whatsapp_number || '--'}</span>
                    </div>
                    <div className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
                        <MapPin size={14} className="text-primary/60 shrink-0 mt-0.5" />
                        <span className="text-xs font-medium leading-relaxed line-clamp-2">
                            {item.address || 'No address recorded'}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    {item.verification && (
                        <button 
                            onClick={onProfileClick}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest dark:bg-blue-900/20 dark:text-blue-400"
                        >
                            <User size={14} /> Profile
                        </button>
                    )}
                    <a 
                        href={`/orders/${item.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest dark:bg-emerald-900/20 dark:text-emerald-400"
                    >
                        <FileText size={14} /> Details
                    </a>
                    {isDelivered && !isBlacklisted && item.is_ledger_cleared && (
                        <a 
                            href={`/convert-sale/${item.id}`}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest dark:bg-indigo-900/20 dark:text-indigo-400"
                        >
                            <PartyPopper size={14} /> Convert
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SearchResultsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <SearchResultsContent />
        </Suspense>
    );
}
