"use client";

import {
    X, User, Phone, MapPin, Hash, ShieldCheck,
    CreditCard, Calendar, Briefcase, Building,
    Wallet, Camera, Download, CheckCircle2,
    Home, Smartphone, Notebook, UserPlus, Image as ImageIcon,
    Activity, Globe, Fingerprint, ExternalLink, AlertTriangle, ArrowRight, Ban
} from "lucide-react";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import LinkedAccountsBadge from "./LinkedAccountsBadge";
import { useAuth } from "../../../contexts/AuthContext";

interface ProfileModalProps {
    open: boolean;
    onClose: () => void;
    data: any;
}

export default function CustomerProfileModal({ open, onClose, data }: ProfileModalProps) {
    const { user } = useAuth();
    const canWhitelist = ['admin', 'super admin', 'accountant'].includes(user?.role?.toLowerCase() || '');

    const [activeTab, setActiveTab] = useState("personal");
    const [cnicOrders, setCnicOrders] = useState<any>({});
    const [isCheckingCnic, setIsCheckingCnic] = useState(false);
    const [wasEverBlacklisted, setWasEverBlacklisted] = useState(false);

    const [purchaserState, setPurchaserState] = useState<any>(null);
    const [grantorsState, setGrantorsState] = useState<any[]>([]);
    const [whitelistingEntityId, setWhitelistingEntityId] = useState<string | number | null>(null);

    // Sync state when modal data updates
    useEffect(() => {
        if (open && data && data.verification) {
            setPurchaserState(data.verification.purchaser ? { ...data.verification.purchaser } : null);
            setGrantorsState(data.verification.grantors ? data.verification.grantors.map((g: any) => ({ ...g })) : []);
        }
    }, [open, data]);

    // Non-gated blacklist history check
    useEffect(() => {
        const cnic = data?.verification?.purchaser?.cnic_number;
        if (!open || !cnic) {
            setWasEverBlacklisted(false);
            return;
        }
        const fetchBlacklistStatus = async () => {
            try {
                const token = Cookies.get("auth_token");
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/customers/blacklist-status/${encodeURIComponent(cnic)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const result = await res.json();
                if (result.success) {
                    setWasEverBlacklisted(!!result.data.wasEverBlacklisted);
                }
            } catch (e) {
                console.error("Blacklist status check error:", e);
            }
        };
        fetchBlacklistStatus();
    }, [open, data?.verification?.purchaser?.cnic_number]);

    useEffect(() => {
        if (open && data && data.verification) {
            const fetchCnicOrders = async () => {
                setIsCheckingCnic(true);
                try {
                    const cnics = [
                        data.verification.purchaser?.cnic_number,
                        ...(data.verification.grantors || []).map((g: any) => g.cnic_number)
                    ].filter(Boolean);

                    if (cnics.length > 0) {
                        const token = Cookies.get("auth_token");
                        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/check-cnic`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({ cnics })
                        });
                        const result = await res.json();
                        if (result.success) {
                            setCnicOrders(result.results);
                        }
                    }
                } catch (e) {
                    console.error("CNIC check error:", e);
                } finally {
                    setIsCheckingCnic(false);
                }
            };
            fetchCnicOrders();
        }
    }, [open, data]);

    if (!open || !data) return null;

    const verification = data.verification;
    const purchaser = purchaserState || verification?.purchaser;
    const grantors = grantorsState.length > 0 ? grantorsState : (verification?.grantors || []);
    const documents = verification?.documents || [];
    const order = data;

    // Extract Purchaser Portrait
    const purchaserPhoto = documents.find((d: any) => d.person_type === 'purchaser' && d.document_type === 'photo')?.file_url;

    // Mapping details
    const displayName = purchaser?.name;
    const displayPhone = purchaser?.telephone_number;

    const tabs = [
        { id: "personal", label: "Identity", icon: <Fingerprint size={14} /> },
        { id: "employment", label: "Work Profile", icon: <Briefcase size={14} /> },
        { id: "guarantors", label: `Guarantors`, icon: <UserPlus size={14} /> },
        ...(order.status === 'delivered' || order.clear_reason === 'returned' ? [{ id: "financials", label: "Ledger Summary", icon: <Wallet size={14} /> }] : []),
        { id: "documents", label: "Media Assets", icon: <ImageIcon size={14} /> },
    ];

    if (!purchaser) {
        return (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-fade-in" onClick={onClose} />
                <div className="relative w-full max-w-lg bg-white dark:bg-boxdark rounded-[2rem] p-10 text-center shadow-2xl animate-zoom-in border border-stroke dark:border-strokedark">
                    <div className="bg-primary/5 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-primary/10">
                        <Activity className="text-primary animate-pulse" size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2 tracking-tight">Profile Initializing</h2>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-8 leading-relaxed">
                        Verification is currently in progress. Complete purchaser details will be synced once the field visit is finalized.
                    </p>
                    <div className="bg-gray-50 dark:bg-meta-4/30 p-6 rounded-2xl border border-stroke dark:border-strokedark mb-8 text-left space-y-4">
                        <InfoRow label="Order Reference" value={order.order_ref} />
                        <InfoRow label="Applicant Name" value={order.customer_name} />
                        <InfoRow label="Visit Status" value={order.status} isStatus />
                    </div>
                    <button onClick={onClose} className="w-full py-4 bg-primary text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:opacity-90 transition-all">Close Window</button>
                </div>
            </div>
        )
    }

    // Blacklist Account Handler (Marks Purchaser and linked Guarantors as Blacklisted)
    const handleBlacklistAccount = async () => {
        const cnic = purchaser?.cnic_number;
        if (!cnic) {
            toast.error("Account has no CNIC on file — cannot blacklist.");
            return;
        }
        const reason = window.prompt(`Reason for blacklisting account (${displayName}):`, "");
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("A reason is required to blacklist an account.");
            return;
        }

        setWhitelistingEntityId(`account-blacklist-${cnic}`);
        try {
            const token = Cookies.get("auth_token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/accounts/blacklist/action`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    cnic,
                    action: "blacklist",
                    targetType: "all",
                    verificationId: verification?.id,
                    reason: reason.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json.message || "Failed to blacklist account");

            toast.success(json.message || "Account blacklisted successfully.");
            setPurchaserState((prev: any) => (prev ? { ...prev, is_blacklisted: true } : prev));
            setGrantorsState((prev: any[]) => prev.map((g) => ({ ...g, is_blacklisted: true })));
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to blacklist account");
        } finally {
            setWhitelistingEntityId(null);
        }
    };

    // Whitelist Handlers for Individual Entities inside Modal
    const handleWhitelistPurchaser = async () => {
        const cnic = purchaser?.cnic_number;
        if (!cnic) {
            toast.error("Purchaser has no CNIC on file — cannot whitelist.");
            return;
        }
        const reason = window.prompt(`Reason for whitelisting Purchaser Identity (${purchaser.name}):`, "");
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("A reason is required to whitelist.");
            return;
        }

        setWhitelistingEntityId(`purchaser-${cnic}`);
        try {
            const token = Cookies.get("auth_token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/accounts/blacklist/action`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    cnic,
                    action: "whitelist",
                    targetType: "purchaser",
                    reason: reason.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json.message || "Failed to whitelist purchaser identity");

            toast.success(json.message || "Purchaser identity whitelisted successfully.");
            setPurchaserState((prev: any) => (prev ? { ...prev, is_blacklisted: false } : prev));
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to whitelist purchaser identity");
        } finally {
            setWhitelistingEntityId(null);
        }
    };

    const handleWhitelistGrantor = async (grantor: any) => {
        const cnic = grantor?.cnic_number;
        if (!cnic) {
            toast.error("Guarantor has no CNIC on file — cannot whitelist.");
            return;
        }
        const reason = window.prompt(`Reason for whitelisting Guarantor ${grantor.grantor_number} (${grantor.name}):`, "");
        if (reason === null) return;
        if (!reason.trim()) {
            toast.error("A reason is required to whitelist.");
            return;
        }

        setWhitelistingEntityId(`grantor-${grantor.id}`);
        try {
            const token = Cookies.get("auth_token");
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000"}/api/accounts/blacklist/action`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    cnic,
                    action: "whitelist",
                    targetType: "grantor",
                    grantorId: grantor.id,
                    reason: reason.trim(),
                }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json.message || "Failed to whitelist guarantor");

            toast.success(json.message || `Guarantor ${grantor.grantor_number} whitelisted successfully.`);
            setGrantorsState((prev: any[]) =>
                prev.map((g) => (g.id === grantor.id ? { ...g, is_blacklisted: false } : g))
            );
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to whitelist guarantor");
        } finally {
            setWhitelistingEntityId(null);
        }
    };

    // Dynamic Blacklist Status Calculation
    const purchaserBlacklisted = !!purchaser?.is_blacklisted;
    const anyGrantorBlacklisted = grantors.some((g: any) => g.is_blacklisted);

    const getBlacklistStatus = () => {
        if (purchaserBlacklisted || anyGrantorBlacklisted) return true;

        const ledger = data?.delivery?.installment_ledger || data?.installment_ledger || data?.ledger?.installment_ledger;
        if (!ledger) return false;

        let rows = [];
        try {
            const rawRows = ledger.ledger_rows || ledger.installment_ledger || (Array.isArray(ledger) ? ledger : null);
            if (!rawRows) return false;
            rows = typeof rawRows === 'string' ? JSON.parse(rawRows) : rawRows;
        } catch (e) { return false; }
        
        if (!Array.isArray(rows)) return false;

        const today = new Date();
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);

        const installments = rows.filter((r: any) => (r.month || r.monthNumber) > 0);
        if (installments.length === 0) return false;

        const paidCount = installments.filter((r: any) => (r.status === 'paid' || r.status === 'Paid')).length;
        const deliveryDate = new Date(data.delivery?.end_time || data.updated_at || data.created_at);
        
        if (paidCount === 0 && deliveryDate < ninetyDaysAgo) return true;

        const anyVeryOverdue = installments.some((r: any) => {
            const dDate = r.due_date || r.dueDate;
            if (!dDate) return false;
            const dueDate = new Date(dDate);
            return (r.status !== 'paid' && r.status !== 'Paid') && dueDate < ninetyDaysAgo;
        });

        return anyVeryOverdue;
    };

    const isBlacklisted = getBlacklistStatus();

    const getClearedStatus = () => {
        const ledger = data?.delivery?.installment_ledger || data?.installment_ledger || data?.ledger?.installment_ledger;
        if (!ledger) return false;

        let rows = [];
        try {
            const rawRows = ledger.ledger_rows || ledger.installment_ledger || (Array.isArray(ledger) ? ledger : null);
            if (!rawRows) return false;
            rows = typeof rawRows === 'string' ? JSON.parse(rawRows) : rawRows;
        } catch (e) { return false; }
        
        if (!Array.isArray(rows)) return false;

        const installments = rows.filter((r: any) => (r.month || r.monthNumber) > 0);
        if (installments.length === 0) return false;

        const pendingCount = installments.filter((r: any) => (r.status !== 'paid' && r.status !== 'Paid')).length;
        
        const advanceRow = rows.find((r: any) => (r.month === 0 || r.monthNumber === 0));
        const isAdvancePaid = advanceRow ? (advanceRow.status === 'paid' || advanceRow.status === 'Paid') : true;

        return pendingCount === 0 && isAdvancePaid;
    };

    const clearReason: 'completed' | 'returned' | null = order.clear_reason || null;
    const isCleared = !isBlacklisted && (clearReason ? true : getClearedStatus());

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />
            <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-boxdark rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.2)] overflow-hidden border border-stroke dark:border-strokedark animate-zoom-in my-8">

                {/* Premium Header */}
                <div className="shrink-0 bg-gray-50 dark:bg-meta-4/20 p-8 md:p-12 border-b border-stroke dark:border-strokedark relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50" />

                    <button
                        onClick={onClose}
                        className="absolute right-8 top-8 p-3 bg-white dark:bg-boxdark hover:text-red-500 rounded-2xl transition-all border border-stroke dark:border-strokedark shadow-sm z-10"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
                        {/* Vendor-Style Avatar */}
                        <div className="relative shrink-0">
                            <div className="w-32 h-32 md:w-36 md:h-36 rounded-3xl bg-white dark:bg-boxdark p-1 border border-stroke dark:border-strokedark shadow-xl overflow-hidden group/photo">
                                {purchaserPhoto ? (
                                    <img src={purchaserPhoto} alt={displayName} className="w-full h-full object-cover rounded-2xl transition-transform duration-500 group-hover/photo:scale-110" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-meta-4 rounded-2xl">
                                        <User size={64} className="text-gray-200" />
                                    </div>
                                )}
                            </div>
                            <div className={`absolute -bottom-2 -right-2 ${isBlacklisted ? 'bg-red-500' : (isCleared ? 'bg-emerald-500' : 'bg-green-500')} w-8 h-8 rounded-full border-4 border-white dark:border-boxdark shadow-lg flex items-center justify-center`}>
                                {isBlacklisted ? <X size={16} className="text-white" /> : <CheckCircle2 size={16} className="text-white" />}
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 text-center md:text-left pt-2">
                            <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
                                <h2 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-white tracking-tight">{displayName}</h2>
                                {isBlacklisted ? (
                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-red-500 text-white animate-pulse border-2 border-red-200 shadow-lg shadow-red-500/20">
                                        <AlertTriangle size={14} />
                                        {purchaserBlacklisted && anyGrantorBlacklisted
                                            ? "ACCOUNT BLACKLISTED"
                                            : purchaserBlacklisted
                                            ? "PURCHASER BLACKLISTED"
                                            : "GUARANTOR BLACKLISTED"}
                                    </span>
                                ) : isCleared ? (
                                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-500 text-white border-2 border-emerald-200 shadow-lg shadow-emerald-500/20">
                                        <CheckCircle2 size={14} /> CLEARED
                                        {clearReason === 'returned' && (
                                            <span className="inline-flex items-center gap-1.5 opacity-90">
                                                <ArrowRight size={12} /> DUE TO RETURN
                                            </span>
                                        )}
                                    </span>
                                ) : (
                                    <span className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] bg-primary/5 text-primary border border-primary/10">
                                        {order.status?.replace('_', ' ')}
                                    </span>
                                )}
                                {!isBlacklisted && wasEverBlacklisted && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40">
                                        <ShieldCheck size={12} /> Previously Blacklisted — Whitelisted
                                    </span>
                                )}
                                {canWhitelist && !isBlacklisted && (
                                    <button
                                        onClick={handleBlacklistAccount}
                                        disabled={whitelistingEntityId === `account-blacklist-${purchaser.cnic_number}`}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                    >
                                        <Ban size={14} />
                                        {whitelistingEntityId === `account-blacklist-${purchaser.cnic_number}` ? "Blacklisting..." : "Mark Blacklist"}
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-x-8 gap-y-4 mt-6 justify-center md:justify-start">
                                <MetaItem icon={<Smartphone size={16} />} label="Mobile" value={displayPhone} />
                                <MetaItem icon={<ShieldCheck size={16} />} label="CNIC" value={purchaser.cnic_number} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modern Tabs */}
                <div className="shrink-0 flex bg-white dark:bg-boxdark px-8 md:px-12 border-b border-stroke dark:border-strokedark overflow-x-auto no-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 py-6 px-6 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === tab.id
                                    ? 'text-primary'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-full shadow-[0_-4px_10px_rgba(59,130,246,0.3)]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 p-8 md:p-12 lg:p-16 overflow-y-auto custom-scrollbar bg-white dark:bg-boxdark">
                    {activeTab === "personal" && (
                        <div className="space-y-8 animate-fade-in-up">
                            {/* Individual Purchaser Whitelist Action Header */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-meta-4/20 border border-stroke dark:border-strokedark">
                                <div className="flex items-center gap-3">
                                    {purchaser?.is_blacklisted ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500 text-white animate-pulse">
                                            <AlertTriangle size={12} /> Purchaser Identity Blacklisted
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            <CheckCircle2 size={12} /> Purchaser Identity Cleared
                                        </span>
                                    )}
                                </div>
                                {canWhitelist && purchaser?.is_blacklisted && (
                                    <button
                                        onClick={handleWhitelistPurchaser}
                                        disabled={whitelistingEntityId === `purchaser-${purchaser.cnic_number}`}
                                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                    >
                                        <ShieldCheck size={14} />
                                        {whitelistingEntityId === `purchaser-${purchaser.cnic_number}` ? "Whitelisting..." : "Whitelist Purchaser"}
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
                                <SectionNew title="Identity Breakdown" icon={<Fingerprint size={18} />}>
                                    <DetailCardNew label="Purchaser Name" value={purchaser.name} />
                                    <DetailCardNew label="Father/Husband" value={purchaser.father_husband_name} />
                                    <DetailCardNew label="Telephone" value={purchaser.telephone_number} />
                                    <div>
                                        <DetailCardNew label="Identity Card" value={purchaser.cnic_number} />
                                        <CnicWarning cnic={purchaser.cnic_number} orders={cnicOrders[purchaser.cnic_number] || []} currentOrderId={order.id} />
                                    </div>
                                    <DetailCardNew label="Landmark" value={purchaser.nearest_location} />
                                </SectionNew>

                                <SectionNew title="Resident Profile" icon={<Home size={18} />}>
                                    <DetailCardNew label="Full Present Address" value={purchaser.present_address} isFull />
                                    {!purchaser.present_address && (
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:col-span-2">
                                            <MiniCard label="House" value={purchaser.present_house_no} />
                                            <MiniCard label="Street" value={purchaser.present_street} />
                                            <MiniCard label="Area" value={purchaser.present_area} />
                                            <MiniCard label="Zone" value={purchaser.present_zone} />
                                        </div>
                                    )}
                                    
                                    {purchaser.present_address === purchaser.permanent_address ? (
                                        <div className="sm:col-span-2 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-2xl">
                                            <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Permanent Address</p>
                                            <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Same as Present Address</p>
                                        </div>
                                    ) : (
                                        <>
                                            <DetailCardNew label="Full Permanent Address" value={purchaser.permanent_address} isFull />
                                            {!purchaser.permanent_address && (
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:col-span-2">
                                                    <MiniCard label="House" value={purchaser.permanent_house_no} />
                                                    <MiniCard label="Street" value={purchaser.permanent_street} />
                                                    <MiniCard label="Area" value={purchaser.permanent_area} />
                                                    <MiniCard label="Zone" value={purchaser.permanent_zone} />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </SectionNew>
                            </div>
                        </div>
                    )}

                    {activeTab === "employment" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16 animate-fade-in-up">
                            <SectionNew title="Employment Details" icon={<Briefcase size={18} />}>
                                <DetailCardNew label="Work Type" value={purchaser.employment_type} />
                                <DetailCardNew label="Job Title" value={purchaser.designation} />
                                <DetailCardNew label="Employer" value={purchaser.employer_name || purchaser.business_name} />
                                <DetailCardNew label="Experience" value={purchaser.established_since || purchaser.years_in_company} />
                                <DetailCardNew label="Official Contact" value={purchaser.official_number} />
                            </SectionNew>

                            <SectionNew title="Financial Health" icon={<Wallet size={18} />}>
                                <DetailCardNew label="Monthly Income" value={purchaser.net_income || purchaser.gross_salary} />
                                <DetailCardNew label="Workplace Address" value={purchaser.employer_address || purchaser.business_address} isFull />
                            </SectionNew>
                        </div>
                    )}

                    {activeTab === "guarantors" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
                            {grantors.length > 0 ? grantors.map((g: any, idx: number) => {
                                const gPhoto = documents.find((d: any) => d.person_type === `grantor${g.grantor_number}` && d.document_type === 'photo')?.file_url;
                                return (
                                    <div key={idx} className="bg-gray-50 dark:bg-meta-4/10 p-8 rounded-[2.5rem] border border-stroke dark:border-strokedark transition-all hover:border-primary/20">
                                        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark flex items-center justify-center overflow-hidden">
                                                    {gPhoto ? <img src={gPhoto} alt={g.name} className="w-full h-full object-cover" /> : <User size={24} className="text-gray-200" />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-gray-800 dark:text-white">{g.name}</p>
                                                    <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-0.5">Guarantor {g.grantor_number} • {g.relationship}</p>
                                                </div>
                                            </div>

                                            {/* Individual Guarantor Status Badge & Whitelist Action */}
                                            <div className="flex items-center gap-2">
                                                {g.is_blacklisted ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500 text-white animate-pulse">
                                                        <AlertTriangle size={12} /> Blacklisted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        <CheckCircle2 size={12} /> Whitelisted
                                                    </span>
                                                )}
                                                {canWhitelist && g.is_blacklisted && (
                                                    <button
                                                        onClick={() => handleWhitelistGrantor(g)}
                                                        disabled={whitelistingEntityId === `grantor-${g.id}`}
                                                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                                    >
                                                        <ShieldCheck size={12} />
                                                        {whitelistingEntityId === `grantor-${g.id}` ? "Whitelisting..." : "Whitelist"}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                                            <SubDetail label="Phone" value={g.telephone_number} />
                                            <SubDetail label="CNIC" value={g.cnic_number} />
                                            <div className="col-span-2">
                                                <CnicWarning cnic={g.cnic_number} orders={cnicOrders[g.cnic_number] || []} currentOrderId={order.id} />
                                            </div>
                                            <SubDetail label="Income" value={g.monthly_income} />
                                            <SubDetail label="Job" value={g.designation} />
                                            <SubDetail label="Office" value={g.office_address} isFull />
                                            <SubDetail label="Residence" value={g.present_address} isFull />
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="col-span-full py-24 text-center">
                                    <UserPlus size={64} className="mx-auto text-gray-100 dark:text-meta-4 mb-6 opacity-30" />
                                    <p className="text-sm font-bold text-gray-400">No guarantor data available.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "financials" && (
                        <FinancialsTab orderId={order.id} orderRef={order.order_ref} />
                    )}

                    {activeTab === "documents" && (
                        <div className="space-y-16 animate-fade-in-up">
                            <DocSectionNew title="Purchaser Documentation" person="purchaser" docs={documents} />
                            {grantors.map((g: any) => (
                                <DocSectionNew
                                    key={g.id}
                                    title={`Guarantor ${g.grantor_number} Documents (${g.name})`}
                                    person={`grantor${g.grantor_number}`}
                                    docs={documents}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Elegant Footer */}
                <div className="shrink-0 px-8 md:px-12 py-8 border-t border-stroke dark:border-strokedark flex flex-col sm:flex-row justify-between items-center gap-6 bg-gray-50 dark:bg-meta-4/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2lx bg-primary/5 flex items-center justify-center border border-primary/10">
                            <ShieldCheck size={20} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Status</p>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-tighter">Identity Cleared & Verified</p>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-800 dark:hover:text-white transition-all font-bold"
                        >
                            Back
                        </button>
                        <a
                            href={`/orders/${data.id || data.order_id}`}
                            className="flex-1 sm:flex-none px-10 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-center leading-none flex items-center justify-center gap-2"
                        >
                            View Case Details <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionNew({ title, icon, children }: any) {
    return (
        <div className="space-y-8">
            <h3 className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                {icon}
                {title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                {children}
            </div>
        </div>
    );
}

function DetailCardNew({ label, value, isFull = false }: any) {
    return (
        <div className={isFull ? 'sm:col-span-2' : ''}>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">{label}</p>
            <div className="bg-gray-50 dark:bg-meta-4/20 p-4 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{value || '--'}</p>
            </div>
        </div>
    );
}

function SubDetail({ label, value, isFull = false }: any) {
    return (
        <div className={isFull ? 'col-span-2' : ''}>
            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-snug">{value || '--'}</p>
        </div>
    );
}

function MiniCard({ label, value }: any) {
    return (
        <div className="p-3 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-xl text-center shadow-sm">
            <p className="text-[8px] font-black text-gray-400 uppercase mb-0.5">{label}</p>
            <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200">{value || '-'}</p>
        </div>
    );
}

function DocSectionNew({ title, person, docs }: any) {
    // Define the 6 standard document slots for every person
    const isPurchaser = person === 'purchaser';
    const grantorNum = !isPurchaser ? person.replace('grantor', '') : '';

    const standardSlots: { key: string; label: string }[] = isPurchaser
        ? [
            { key: 'cnic_front', label: 'CNIC Front' },
            { key: 'cnic_back', label: 'CNIC Back' },
            { key: 'utility_bill', label: 'Utility Bill' },
            { key: 'service_card', label: 'Salary Slip / Service Card' },
            { key: 'signature', label: 'Signature' },
            { key: 'photo', label: 'Live Photo' },
        ]
        : [
            { key: 'cnic_front', label: `Grantor ${grantorNum} CNIC Front` },
            { key: 'cnic_back', label: `Grantor ${grantorNum} CNIC Back` },
            { key: 'utility_bill', label: `Grantor ${grantorNum} Utility Bill` },
            { key: 'service_card', label: `Grantor ${grantorNum} Salary Slip / Service Card` },
            { key: 'signature', label: `Grantor ${grantorNum} Signature` },
            { key: 'photo', label: `Grantor ${grantorNum} Live Photo` },
        ];

    const personDocs = docs.filter((d: any) => d.person_type === person);
    const matchedKeys = new Set<string>();

    return (
        <div className="space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 pl-1 border-l-2 border-primary ml-1">
                {title}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {standardSlots.map((slot) => {
                    const doc = personDocs.find((d: any) => d.document_type === slot.key);
                    if (doc) matchedKeys.add(doc.document_type);
                    return doc ? (
                        <div key={slot.key} className="group relative rounded-3xl border border-stroke dark:border-strokedark bg-white dark:bg-meta-4 shadow-sm hover:shadow-xl transition-all overflow-hidden border-b-4 border-b-transparent hover:border-b-primary">
                            <div className="aspect-[4/3] overflow-hidden bg-gray-50 dark:bg-boxdark p-1">
                                <img src={doc.file_url} alt={doc.label} className="w-full h-full object-cover rounded-2xl transition-transform group-hover:scale-105" />
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black uppercase text-gray-800 dark:text-white truncate">{doc.label?.split('-')[0] || slot.label}</p>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Verified Asset</p>
                                </div>
                                <a href={doc.file_url} target="_blank" className="p-2 bg-gray-50 dark:bg-meta-4 hover:text-primary transition-colors rounded-lg">
                                    <Download size={14} />
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div key={slot.key} className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-meta-4/10 text-center min-h-[140px]">
                            <div className="p-2 rounded-full bg-gray-100 dark:bg-meta-4 text-gray-300 mb-2">
                                <ImageIcon size={18} />
                            </div>
                            <p className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400 truncate w-full px-1">{slot.label}</p>
                            <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">Not uploaded</p>
                        </div>
                    );
                })}
                {/* Extra non-standard docs */}
                {personDocs.filter((d: any) => !matchedKeys.has(d.document_type)).map((doc: any, i: number) => (
                    <div key={i} className="group relative rounded-3xl border border-stroke dark:border-strokedark bg-white dark:bg-meta-4 shadow-sm hover:shadow-xl transition-all overflow-hidden border-b-4 border-b-transparent hover:border-b-primary">
                        <div className="aspect-[4/3] overflow-hidden bg-gray-50 dark:bg-boxdark p-1">
                            <img src={doc.file_url} alt={doc.label} className="w-full h-full object-cover rounded-2xl transition-transform group-hover:scale-105" />
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black uppercase text-gray-800 dark:text-white truncate">{doc.label?.split('-')[0] || doc.document_type}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Verified Asset</p>
                            </div>
                            <a href={doc.file_url} target="_blank" className="p-2 bg-gray-50 dark:bg-meta-4 hover:text-primary transition-colors rounded-lg">
                                <Download size={14} />
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CnicWarning({ cnic, orders, currentOrderId }: { cnic: string, orders: any[], currentOrderId: number }) {
    return (
        <div className="mt-2">
            <LinkedAccountsBadge cnic={cnic} orders={orders} currentOrderId={currentOrderId} />
        </div>
    );
}

function MetaItem({ icon, label, value }: any) {
    return (
        <div className="flex items-center gap-3">
            <div className="text-primary/50">{icon}</div>
            <div>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                <p className="text-xs font-bold text-gray-800 dark:text-white leading-none">{value}</p>
            </div>
        </div>
    );
}

function InfoRow({ label, value, isStatus = false }: any) {
    return (
        <div className="flex justify-between items-center gap-4">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{label}</span>
            <span className={`text-xs font-bold ${isStatus ? 'px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase text-[9px]' : 'text-gray-800 dark:text-white'}`}>
                {value}
            </span>
        </div>
    );
}

function FinancialsTab({ orderId, orderRef }: { orderId: number, orderRef: string }) {
    const [loading, setLoading] = useState(true);
    const [ledger, setLedger] = useState<any>(null);
    const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

    useEffect(() => {
        const fetchLedger = async () => {
            try {
                const token = Cookies.get("auth_token");
                const res = await fetch(`${API_BASE}/api/customers/ledger/${orderRef}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const result = await res.json();
                if (result.success && result.data.installments?.length > 0) {
                    setLedger(result.data.installments[0]);
                }
            } catch (e) {
                console.error("Ledger fetch error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchLedger();
    }, [orderRef]);

    if (loading) return (
        <div className="py-20 text-center animate-pulse">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Syncing Ledger Data...</p>
        </div>
    );

    if (!ledger) return (
        <div className="py-20 text-center">
            <Activity size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-sm font-bold text-gray-400">No active ledger found for this case.</p>
        </div>
    );

    const { ledgerSummaries, installmentLedger } = ledger;

    return (
        <div className="space-y-12 animate-fade-in-up">
            {/* Financial Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Plan Total" value={`PKR ${ledgerSummaries.totalInstallmentDue?.toLocaleString()}`} color="primary" />
                <SummaryCard label="Paid Amount" value={`PKR ${ledgerSummaries.totalInstallmentPaid?.toLocaleString()}`} color="green" />
                <SummaryCard label="Remaining" value={`PKR ${ledgerSummaries.totalRemaining?.toLocaleString()}`} color="red" />
                <SummaryCard label="Progress" value={`${ledgerSummaries.paidInstallments} / ${ledgerSummaries.totalInstallments} Months`} color="amber" />
            </div>

            {/* Installment Timeline */}
            <SectionNew title="Installment Schedule" icon={<Calendar size={18} />}>
                <div className="col-span-full overflow-hidden rounded-[2rem] border border-stroke dark:border-strokedark">
                    <table className="w-full text-left bg-gray-50/50 dark:bg-meta-4/10">
                        <thead>
                            <tr className="border-b border-stroke dark:border-strokedark">
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Month</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Due Date</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Due</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Paid</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400 text-right">Remaining</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stroke dark:divide-strokedark">
                            {installmentLedger.map((inst: any, idx: number) => (
                                <tr key={idx} className="hover:bg-white dark:hover:bg-meta-4/20 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-gray-700 dark:text-gray-200">{inst.label}</td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-gray-500">{new Date(inst.dueDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-[10px] font-bold text-gray-800 dark:text-gray-100">PKR {inst.dueAmount?.toLocaleString()}</div>
                                        {inst.arrears ? (
                                            <div className="text-[9px] text-red-500 font-medium">
                                                +{inst.arrears?.toLocaleString()} arr
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-emerald-600 text-right">{inst.paidAmount > 0 ? `PKR ${inst.paidAmount.toLocaleString()}` : '-'}</td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-red-500 text-right">{inst.remainingAmount > 0 ? `PKR ${inst.remainingAmount.toLocaleString()}` : '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                                            inst.status === 'paid' ? 'bg-green-100 text-green-600' : 
                                            (inst.paidAmount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600')
                                        }`}>
                                            {inst.paidAmount > 0 && inst.status !== 'paid' ? 'Partial' : inst.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionNew>
        </div>
    );
}

function SummaryCard({ label, value, color }: any) {
    const colors: any = {
        primary: 'text-primary bg-primary/5 border-primary/10',
        green: 'text-green-600 bg-green-50 border-green-100',
        red: 'text-red-600 bg-red-50 border-red-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100'
    };
    return (
        <div className={`p-6 rounded-3xl border ${colors[color]} text-center`}>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">{label}</p>
            <p className="text-lg font-black tracking-tight">{value}</p>
        </div>
    );
}
