"use client";

import { useState, useEffect, useRef } from "react";
import { Search, User, FileText, ClipboardList, Loader2, X, Hash, MapPin, Phone, ArrowRight, UserCheck, ExternalLink, Ban, ShieldCheck } from "lucide-react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { useProfileModal } from "../../../contexts/ProfileModalContext";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const statusColors: any = {
    'delivered': 'bg-green-500/10 text-green-500 border-green-500/20',
    'confirmed': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'pending': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'in_progress': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'cancelled': 'bg-red-500/10 text-red-500 border-red-500/20',
    'approved': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'rejected': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    'default': 'bg-gray-500/10 text-gray-500 border-gray-500/20'
};

import { cn } from "@/lib/utils";

export default function GlobalSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [searchType, setSearchType] = useState("all");
    const { openProfile } = useProfileModal();
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 3) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, searchType]);

    const handleSearch = async () => {
        setLoading(true);
        setIsOpen(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/search?query=${query}&type=${searchType}`, {
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

    console.log("Search results:", results);

    return (
        <div className="relative w-full max-w-xl mx-4 group" ref={searchRef}>
            <div className={`relative flex items-center transition-all duration-500 ${isOpen && query.length >= 3 ? 'z-[1001]' : ''}`}>
                <div className="absolute left-5 text-gray-400 group-focus-within:text-primary transition-colors">
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                </div>
                <input 
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 3 && setIsOpen(true)}
                    placeholder="Search Number, CNIC, IMEI, Name..."
                    className="w-full pl-14 pr-12 py-3.5 rounded-[22px] bg-gray-100 dark:bg-meta-4 border-2 border-transparent focus:border-primary/50 focus:bg-white dark:focus:bg-boxdark outline-none shadow-sm group-hover:shadow-md transition-all font-semibold text-sm"
                />
                {query && !loading && (
                    <button 
                        onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
                        className="absolute right-5 text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && query.length >= 3 && (
                <div className="absolute top-full mt-3 w-full bg-white dark:bg-boxdark rounded-[28px] border border-stroke dark:border-strokedark shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden z-[1000] animate-fade-in-up">
                    <div className="p-5 bg-gray-50/80 dark:bg-meta-4/50 border-b border-stroke dark:border-strokedark">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Universal Matches</span>
                            </div>
                            {loading && <Loader2 size={14} className="animate-spin text-primary" />}
                        </div>
                        
                        <div className="flex gap-2">
                            {['all', 'customers', 'orders'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setSearchType(t)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                        searchType === t 
                                        ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                        : 'bg-white dark:bg-boxdark text-gray-500 hover:bg-gray-100 dark:hover:bg-meta-4 border border-stroke dark:border-strokedark'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {results.length > 0 ? (
                            <div className="p-4 space-y-6">
                                {/* Customers Section */}
                                {(searchType === 'all' || searchType === 'customers') && results.filter(i => i.status === 'delivered').length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4 px-2">
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-stroke dark:via-strokedark to-transparent" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-500 flex items-center gap-2">
                                                <UserCheck size={12} /> Customers (Took Product)
                                            </span>
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-stroke dark:via-strokedark to-transparent" />
                                        </div>
                                        <div className="grid gap-4">
                                            {results.filter(i => i.status === 'delivered').slice(0, searchType === 'all' ? 5 : 10).map((item) => (
                                                <ResultItem key={item.id} item={item} openProfile={openProfile} setIsOpen={setIsOpen} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Orders Section */}
                                {(searchType === 'all' || searchType === 'orders') && results.filter(i => i.status !== 'delivered').length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4 px-2">
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-stroke dark:via-strokedark to-transparent" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-2">
                                                <ClipboardList size={12} /> Orders (In Process)
                                            </span>
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-stroke dark:via-strokedark to-transparent" />
                                        </div>
                                        <div className="grid gap-4">
                                            {results.filter(i => i.status !== 'delivered').slice(0, searchType === 'all' ? 5 : 10).map((item) => (
                                                <ResultItem key={item.id} item={item} openProfile={openProfile} setIsOpen={setIsOpen} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : !loading ? (
                            <div className="p-16 text-center">
                                <div className="w-20 h-20 bg-gray-50 dark:bg-meta-4 rounded-full flex items-center justify-center mx-auto mb-5 border border-stroke dark:border-strokedark">
                                    <Search size={32} className="text-gray-200" />
                                </div>
                                <h3 className="text-base font-bold text-gray-800 dark:text-white mb-2">No matching records</h3>
                                <p className="text-xs text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                                    Try searching with a full CNIC, WhatsApp number or Order reference ID.
                                </p>
                            </div>
                        ) : null}
                    </div>
                    
                    {results.length > 0 && (
                        <div className="p-4 bg-gray-50 dark:bg-meta-4/80 border-t border-stroke dark:border-strokedark">
                            <a 
                                href={`/search-results?query=${query}&type=${searchType}`}
                                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-md shadow-primary/20"
                                onClick={() => setIsOpen(false)}
                            >
                                View All Results ({results.length}) <ExternalLink size={14} />
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ResultItem({ item, openProfile, setIsOpen }: any) {
    const purchaserPhoto = item.verification?.documents?.find((d: any) => d.document_type === 'photo' && d.person_type === 'purchaser')?.file_url;
    const isBlacklisted = item.is_blacklisted === true || item.verification?.is_blacklisted === true || item.verification?.purchaser?.is_blacklisted === true;

    return (
        <div key={item.id} className="bg-white dark:bg-meta-4/20 rounded-2xl border border-stroke dark:border-strokedark hover:border-primary/30 hover:shadow-lg transition-all overflow-hidden group/item">
            <div className="p-4">
                <div className="flex items-start gap-4 mb-4">
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center overflow-hidden transition-transform group-hover/item:scale-105 shadow-sm">
                            {purchaserPhoto ? (
                                <img src={purchaserPhoto} alt={item.verification?.purchaser?.name} className="w-full h-full object-cover" />
                            ) : (
                                <User size={28} className="text-primary/40" />
                            )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white dark:border-boxdark ${isBlacklisted ? 'bg-red-500 animate-pulse' : (item.status === 'delivered' ? 'bg-green-500' : 'bg-amber-500')}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-black text-gray-800 dark:text-white text-base pr-2 truncate">
                                {item.verification?.purchaser?.name || item.customer_name} 
                            </h4>
                        </div>
                        {item.father_name && item.father_name !== 'N/A' && (
                            <span className="text-gray-400 font-bold text-xs uppercase tracking-tight">S/O {item.father_name}</span>
                        )}
                        <div className="space-y-1.5 mt-2">
                            <ResultMeta icon={<Phone size={11} />} text={item.verification?.purchaser?.telephone_number || item.whatsapp_number} />
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Customer Status:</span>
                                {isBlacklisted ? (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border bg-red-500/10 text-red-500 border-red-500/20">
                                        Blacklisted
                                    </span>
                                ) : (
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border",
                                        statusColors[item.status?.toLowerCase()] || statusColors.default
                                    )}>
                                        {item.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-stroke/50 dark:border-strokedark/50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <MapPin size={11} className="text-gray-400 shrink-0" />
                        <span className="text-[10px] font-bold text-gray-400 truncate">
                            {item.verification?.purchaser?.permanent_address || 
                             `${item.verification?.purchaser?.permanent_house_no || ''} ${item.verification?.purchaser?.permanent_block || ''} ${item.verification?.purchaser?.permanent_area || ''}`.trim() || 
                             'No address recorded'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {item.verification && (
                            <ActionIconButton 
                                icon={<User size={16} />} 
                                label="Profile"
                                color="blue"
                                onClick={() => { openProfile(item); setIsOpen(false); }}
                            />
                        )}
                        <ActionIconButton 
                            icon={<FileText size={16} />} 
                            label="Order"
                            color="emerald"
                            href={`/orders/${item.id}`}
                        />
                        {!isBlacklisted && (
                            <ActionIconButton 
                                icon={<Ban size={16} />} 
                                label="Mark Blacklist"
                                color="red"
                                onClick={async () => {
                                    const cnic = item.verification?.purchaser?.cnic_number || item.cnic_number || item.cnic;
                                    if (!cnic) {
                                        toast.error("No CNIC on file — cannot blacklist.");
                                        return;
                                    }
                                    const reason = window.prompt(`Reason for blacklisting ${item.verification?.purchaser?.name || item.customer_name}:`, "");
                                    if (reason === null) return;
                                    if (!reason.trim()) {
                                        toast.error("A reason is required to blacklist.");
                                        return;
                                    }

                                    try {
                                        const token = Cookies.get("auth_token");
                                        const res = await fetch(`${API_BASE}/api/accounts/blacklist/action`, {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                Authorization: `Bearer ${token}`,
                                            },
                                            body: JSON.stringify({
                                                cnic,
                                                action: "blacklist",
                                                targetType: "all",
                                                verificationId: item.verification?.id,
                                                reason: reason.trim(),
                                            }),
                                        });
                                        const json = await res.json();
                                        if (!res.ok || json.success === false) throw new Error(json.message || "Failed to blacklist account");

                                        toast.success(json.message || "Account blacklisted successfully.");
                                        item.is_blacklisted = true;
                                        if (item.verification?.purchaser) item.verification.purchaser.is_blacklisted = true;
                                        setIsOpen(false);
                                    } catch (err: any) {
                                        console.error(err);
                                        toast.error(err.message || "Failed to blacklist account");
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ResultMeta({ icon, text, isTruncate = false }: any) {
    return (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 min-w-0">
            <span className="shrink-0 text-primary/70">{icon}</span>
            <span className={`text-[11px] font-bold ${isTruncate ? 'truncate' : ''}`}>
                {text || '--'}
            </span>
        </div>
    );
}

function ActionIconButton({ icon, label, color, href, onClick }: any) {
    const colors: any = {
        blue: 'text-blue-600 bg-blue-50 hover:bg-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-600',
        emerald: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-600',
        indigo: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-600',
        red: 'text-red-600 bg-red-50 hover:bg-red-600 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600',
    };

    const content = (
        <div className="relative group/tooltip">
            {icon}
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none uppercase tracking-widest z-10 whitespace-nowrap">
                {label}
            </span>
        </div>
    );

    const className = `p-2.5 rounded-xl transition-all border border-transparent hover:text-white active:shadow-inner ${colors[color] || ''}`;

    if (href) return <a href={href} className={className}>{content}</a>;
    return <button onClick={onClick} className={className}>{content}</button>;
}
