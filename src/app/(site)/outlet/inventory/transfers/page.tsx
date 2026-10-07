"use client";

import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { Send, KeyRound, CheckCircle2, ChevronDown, ChevronRight, CheckSquare, Square, AlertTriangle, X } from "lucide-react";
import { useNotifications } from "../../../../../../contexts/NotificationContext";
import { useAuth } from "../../../../../../contexts/AuthContext";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface InventoryItem {
    id: number;
    product_name: string;
    category: string;
    imei_serial?: string;
    color_variant?: string;
    quantity: number;
    status: string;
    is_used: boolean;
}

interface GroupedItem {
    key: string;
    product_name: string;
    category: string;
    color_variant?: string;
    totalQty: number;
    children: InventoryItem[];
}

interface ConflictItem {
    transfer_id: number;
    imei: string;
    product_name: string;
}

interface DeliveryOfficer { id: number; full_name: string; username: string; }
interface Outlet { id: number; name: string; }

export default function TransfersPage() {
    const router = useRouter();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [officers, setOfficers] = useState<DeliveryOfficer[]>([]);
    const [outlets, setOutlets] = useState<Outlet[]>([]);

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [transferQuantities, setTransferQuantities] = useState<{ [id: number]: number }>({});
    
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(20);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [search, setSearch] = useState("");

    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const [transferType, setTransferType] = useState<"Delivery Officer" | "Outlet">("Delivery Officer");
    const [selectedTargetId, setSelectedTargetId] = useState("");

    const [otpModalOpen, setOtpModalOpen] = useState(false);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: "", text: "" });
    const [initiatedInventoryIds, setInitiatedInventoryIds] = useState<{ id: number; quantity: number }[]>([]);

    // ── Conflict modal state ──────────────────────────────────────────────────
    const [conflictModalOpen, setConflictModalOpen] = useState(false);
    const [conflictingItems, setConflictingItems] = useState<ConflictItem[]>([]);
    const [cancellingConflicts, setCancellingConflicts] = useState(false);

    const fetchData = async () => {
        try {
            const [invRes, offRes, outRes] = await Promise.all([
                fetch(`${API_BASE}/api/outlet/inventory/get/transfer?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE}/api/orders/outlet/officers`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE}/api/outlets`, { headers: getAuthHeaders() }),
            ]);
            const [invData, offData, outData] = await Promise.all([invRes.json(), offRes.json(), outRes.json()]);
            if (invData.success) {
                setInventory(invData.inventory || []);
                setTotalPages(invData.pagination.totalPages);
                setTotalItemsCount(invData.pagination.total);
            }
            if (offData.success) setOfficers(offData.data || []);
            if (outData.success) setOutlets(outData.outlets || outData.data || []);
        } catch (e) {
            console.error("Error fetching data", e);
        }
    };

    const { socket } = useNotifications();
    const { user } = useAuth();

    const fetchDataRef = useRef(fetchData);
    useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

    useEffect(() => {
        fetchDataRef.current();
        setSelectedTargetId("");
    }, [transferType, page, search]);

    useEffect(() => {
        if (!socket || !user) return;
        const handleUpdate = () => { fetchDataRef.current(); };
        socket.on("stock_transfer_initiated", handleUpdate);
        socket.on("stock_transfer_cancelled", handleUpdate);
        socket.on("stock_transfer_completed", handleUpdate);
        socket.on("stock_transfer_status", handleUpdate);
        return () => {
            socket.off("stock_transfer_initiated", handleUpdate);
            socket.off("stock_transfer_cancelled", handleUpdate);
            socket.off("stock_transfer_completed");
            socket.off("stock_transfer_status");
        };
    }, [socket, user]);

    const inStockItems = useMemo(() => inventory.filter(i => i.status === "In Stock" || i.status === "Used Stock"), [inventory]);

    const grouped = useMemo<GroupedItem[]>(() => {
        const map = new Map<string, GroupedItem>();
        for (const item of inStockItems) {
            const key = item.product_name;
            if (!map.has(key)) {
                map.set(key, { key, product_name: item.product_name, category: item.category, color_variant: undefined, totalQty: 0, children: [] });
            }
            const grp = map.get(key)!;
            grp.totalQty += item.quantity;
            grp.children.push(item);
        }
        return Array.from(map.values());
    }, [inStockItems]);

    const toggleExpand = (key: string) => {
        setExpandedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    };

    const toggleChild = (item: InventoryItem, grpKey: string) => {
        const isSelected = selectedIds.includes(item.id);
        if (isSelected) {
            setSelectedIds(prev => prev.filter(id => id !== item.id));
            setTransferQuantities(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        } else {
            setSelectedIds(prev => [...prev, item.id]);
            setTransferQuantities(prev => ({ ...prev, [item.id]: 1 }));
            setExpandedKeys(prev => new Set([...prev, grpKey]));
        }
    };

    const toggleGroup = (grp: GroupedItem) => {
        const ids = grp.children.map(c => c.id);
        const allSelected = ids.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
            setTransferQuantities(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n; });
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...ids])]);
            const newQtys: { [k: number]: number } = {};
            grp.children.forEach(c => newQtys[c.id] = 1);
            setTransferQuantities(prev => ({ ...prev, ...newQtys }));
            setExpandedKeys(prev => new Set([...prev, grp.key]));
        }
    };

    const updateQty = (id: number, val: number, max: number) => {
        let v = Math.max(1, Math.min(max, val || 1));
        setTransferQuantities(prev => ({ ...prev, [id]: v }));
        if (!selectedIds.includes(id)) setSelectedIds(prev => [...prev, id]);
    };

    const doInitiateTransfer = async () => {
        setLoading(true);
        setStatusMessage({ type: "", text: "" });
        try {
            const payloadArray = selectedIds.map(id => ({ id, quantity: transferQuantities[id] || 1 }));
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/initiate`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ inventory_ids: payloadArray, to_type: transferType, to_id: selectedTargetId }),
            });
            const data = await res.json();
            if (data.success) {
                setInitiatedInventoryIds(payloadArray);
                setOtpModalOpen(true);
                setOtp("");
                setStatusMessage({ type: "success", text: `OTP sent to ${transferType}.` });
            } else if (data.conflict) {
                // ── Duplicate IMEI conflict detected ─────────────────────────
                setConflictingItems(data.conflicting_imeis || []);
                setConflictModalOpen(true);
            } else {
                setStatusMessage({ type: "error", text: data.message || "Failed to initiate." });
            }
        } catch {
            setStatusMessage({ type: "error", text: "Network error." });
        } finally {
            setLoading(false);
        }
    };

    const initiateTransfer = async () => {
        if (selectedIds.length === 0 || !selectedTargetId) return;
        await doInitiateTransfer();
    };

    // Cancel conflicting pending transfers, then retry initiation
    const handleCancelConflictsAndRetry = async () => {
        setCancellingConflicts(true);
        try {
            const transferIds = conflictingItems.map(c => c.transfer_id);
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/cancel`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ transfer_ids: transferIds, reason: "Cancelled to retry new transfer." }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Conflicting transfers cancelled. Retrying...");
                setConflictModalOpen(false);
                setConflictingItems([]);
                await fetchData();
                // Small delay then retry
                setTimeout(() => doInitiateTransfer(), 800);
            } else {
                toast.error(data.message || "Failed to cancel conflicting transfers.");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Network error while cancelling."));
        } finally {
            setCancellingConflicts(false);
        }
    };

    const verifyTransfer = async () => {
        if (otp.length < 4) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/verify`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ otp, to_type: transferType, to_id: selectedTargetId, inventory_ids: initiatedInventoryIds }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpModalOpen(false);
                setStatusMessage({ type: "success", text: "Transfer completed successfully." });
                setSelectedIds([]);
                setTransferQuantities({});
                setExpandedKeys(new Set());
                fetchData();
            } else {
                setStatusMessage({ type: "error", text: data.message || "OTP verification failed." });
            }
        } catch {
            setStatusMessage({ type: "error", text: "Network error." });
        } finally {
            setLoading(false);
        }
    };

    const totalUnitsSelected = selectedIds.reduce((sum, id) => sum + (transferQuantities[id] || 1), 0);

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Initiate Stock Transfer" />

            {statusMessage.text && (
                <div className={`mb-6 p-4 rounded-lg font-medium text-sm border flex items-center gap-3 ${
                    statusMessage.type === "success"
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                }`}>
                    {statusMessage.type === "success" ? <CheckCircle2 size={18} /> : null}
                    {statusMessage.text}
                </div>
            )}

            <div className="bg-white dark:bg-boxdark rounded-xl shadow border border-stroke dark:border-strokedark p-6 mb-8">
                {/* Destination Bar */}
                <div className="mb-8 pb-6 border-b border-stroke dark:border-strokedark flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">1. Select Destination & Target</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Choose where you want to send the stock.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <select
                            value={transferType}
                            onChange={(e) => setTransferType(e.target.value as "Delivery Officer" | "Outlet")}
                            className="w-full sm:w-auto min-w-[200px] border border-stroke dark:border-strokedark rounded-lg px-4 py-2.5 text-sm bg-gray-50 outline-none focus:border-primary dark:bg-form-input dark:text-white"
                        >
                            <option value="Delivery Officer">Delivery Officer</option>
                            <option value="Outlet">General Outlet</option>
                        </select>
                        <select
                            value={selectedTargetId}
                            onChange={(e) => setSelectedTargetId(e.target.value)}
                            className="w-full sm:w-auto min-w-[250px] border border-stroke dark:border-strokedark rounded-lg px-4 py-2.5 text-sm bg-gray-50 outline-none focus:border-primary dark:bg-form-input dark:text-white"
                        >
                            <option value="">Select {transferType}</option>
                            {transferType === "Delivery Officer"
                                ? officers.map(off => <option key={off.id} value={off.id}>{off.full_name} ({off.username})</option>)
                                : outlets.map(out => <option key={out.id} value={out.id}>{out.name}</option>)
                            }
                        </select>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">2. Select Products</h2>
                    <div className="relative w-full mb-4">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="fill-gray-400" width="16" height="16" viewBox="0 0 18 18"><path d="M15.7781 14.4938L12.0656 10.7812C12.7969 9.79687 13.2187 8.57812 13.2187 7.28437C13.2187 3.99375 10.5187 1.29375 7.22812 1.29375C3.9375 1.29375 1.2375 3.99375 1.2375 7.28437C1.2375 10.575 3.9375 13.275 7.22812 13.275C8.52187 13.275 9.74062 12.8531 10.725 12.1219L14.4375 15.8344C14.6344 16.0312 14.8875 16.1156 15.1125 16.1156C15.3375 16.1156 15.5906 16.0312 15.7781 15.8344C16.1719 15.4688 16.1719 14.8688 15.7781 14.4938ZM2.72812 7.28437C2.72812 4.78125 4.75312 2.75625 7.25625 2.75625C9.75938 2.75625 11.7844 4.78125 11.7844 7.28437C11.7844 9.7875 9.75938 11.8125 7.25625 11.8125C4.75312 11.8125 2.72812 9.7875 2.72812 7.28437Z" fill=""></path></svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Search products by name or IMEI..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-full border border-stroke dark:border-strokedark rounded-lg pl-9 pr-4 py-2.5 text-sm bg-gray-50 outline-none focus:border-primary dark:bg-form-input dark:text-white"
                        />
                    </div>

                    <div className="overflow-x-auto border rounded-xl border-stroke dark:border-strokedark">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-meta-4 shadow-sm z-10">
                                <tr className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                    <th className="p-4 w-10" />
                                    <th className="p-4 w-10 text-center">Sel.</th>
                                    <th className="p-4">Product</th>
                                    <th className="p-4">Variant</th>
                                    <th className="p-4 text-center">Available Qty</th>
                                    <th className="p-4 text-center">Transfer Qty</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stroke dark:divide-strokedark">
                                {grouped.length === 0 ? (
                                    <tr><td colSpan={6} className="p-10 text-center text-gray-500">No in-stock items available for transfer.</td></tr>
                                ) : grouped.map(grp => {
                                    const isExpanded = expandedKeys.has(grp.key);
                                    const groupIds = grp.children.map(c => c.id);
                                    const allSelected = groupIds.every(id => selectedIds.includes(id));
                                    const someSelected = groupIds.some(id => selectedIds.includes(id));

                                    return (
                                        <Fragment key={grp.key}>
                                            <tr className={`cursor-pointer transition-colors ${isExpanded ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-meta-4/20"}`}>
                                                <td className="p-4 text-center" onClick={() => toggleExpand(grp.key)}>
                                                    {isExpanded ? <ChevronDown size={16} className="text-primary mx-auto" /> : <ChevronRight size={16} className="text-gray-400 mx-auto" />}
                                                </td>
                                                <td className="p-4 text-center" onClick={() => toggleGroup(grp)}>
                                                    {allSelected ? <CheckSquare size={18} className="text-primary mx-auto" /> : someSelected ? <div className="w-[18px] h-[18px] border-2 border-primary bg-primary/30 rounded mx-auto" /> : <Square size={18} className="text-gray-400 mx-auto" />}
                                                </td>
                                                <td className="p-4 font-bold text-black dark:text-white" onClick={() => toggleExpand(grp.key)}>
                                                    {grp.product_name}
                                                    <span className="ml-2 text-xs text-gray-400 font-normal">({grp.children.length} unit{grp.children.length !== 1 ? "s" : ""})</span>
                                                </td>
                                                <td className="p-4 text-gray-500" onClick={() => toggleExpand(grp.key)}>
                                                    {grp.color_variant ? <span className="px-2 py-0.5 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 rounded-full text-xs border border-violet-200 dark:border-violet-700">{grp.color_variant}</span> : <span className="text-gray-400 text-xs">{grp.category || "—"}</span>}
                                                </td>
                                                <td className="p-4 text-center font-black text-base" onClick={() => toggleExpand(grp.key)}>{grp.totalQty}</td>
                                                <td className="p-4 text-center text-xs text-gray-400">
                                                    <div className="flex items-center justify-center gap-3">
                                                        {someSelected ? <span className="font-bold text-primary">{groupIds.filter(id => selectedIds.includes(id)).reduce((s, id) => s + (transferQuantities[id] || 1), 0)} sel.</span> : "—"}
                                                    </div>
                                                </td>
                                            </tr>

                                            {isExpanded && grp.children.map((item, idx) => {
                                                const isSelected = selectedIds.includes(item.id);
                                                return (
                                                    <tr key={`child-${item.id}`} className={`border-t border-dashed border-stroke/50 dark:border-strokedark/50 transition-colors ${isSelected ? "bg-primary/5 dark:bg-primary/10" : "bg-gray-50/60 dark:bg-meta-4/10"}`}>
                                                        <td className="p-3 pl-6 text-center"><span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span></td>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => toggleChild(item, grp.key)}>
                                                                {isSelected ? <CheckSquare size={16} className="text-primary mx-auto" /> : <Square size={16} className="text-gray-400 mx-auto" />}
                                                            </button>
                                                        </td>
                                                        <td className="p-3 pl-8">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono bg-gray-100 dark:bg-meta-4 px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-strokedark text-gray-700 dark:text-gray-300">
                                                                    {item.imei_serial || "No IMEI"}
                                                                </span>
                                                                {(item.is_used || item.status === "Used Stock") && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 uppercase tracking-wider border border-orange-200 dark:border-orange-800">
                                                                        Used Item
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-gray-500 text-xs">{item.color_variant || "—"}</td>
                                                        <td className="p-3 text-center font-bold text-sm">{item.quantity}</td>
                                                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                            <div className="flex flex-col items-center gap-1">
                                                                <input
                                                                    type="number" min="1" max={item.quantity}
                                                                    value={isSelected ? (transferQuantities[item.id] || 1) : ""}
                                                                    placeholder="—"
                                                                    onChange={e => updateQty(item.id, parseInt(e.target.value), item.quantity)}
                                                                    disabled={!isSelected || !!item.imei_serial}
                                                                    className="w-16 text-center border rounded px-1 py-1 text-xs dark:bg-form-input dark:border-strokedark outline-none disabled:opacity-30"
                                                                />
                                                                {isSelected && item.quantity > 1 && <span className="text-[10px] text-gray-400">of {item.quantity}</span>}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-50 dark:bg-meta-4/20 p-4 rounded-xl border border-stroke dark:border-strokedark">
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        <p>Unit Records Selected: <strong className="text-black dark:text-white">{selectedIds.length}</strong></p>
                        <p className="text-xs text-gray-400 mt-0.5">Total Units to Transfer: <strong className="text-primary">{totalUnitsSelected}</strong></p>
                    </div>
                    <button
                        onClick={initiateTransfer}
                        disabled={selectedIds.length === 0 || !selectedTargetId || loading}
                        className="flex items-center gap-2 bg-primary hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg text-sm font-bold shadow-md transition-all"
                    >
                        <Send size={18} />
                        {loading && !otpModalOpen ? "Processing..." : "Initiate Transfer (OTP Required)"}
                    </button>
                </div>
            </div>

            {/* OTP Modal */}
            {otpModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                            <KeyRound size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-center text-black dark:text-white mb-2">Verification Required</h3>
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-8 px-4">
                            Enter the OTP sent to the {transferType.toLowerCase()} to complete this transfer of <strong>{totalUnitsSelected}</strong> unit(s).
                        </p>
                        <input
                            type="text" maxLength={6} value={otp}
                            onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                            placeholder="_ _ _ _ _ _"
                            className="w-full text-center tracking-[0.5em] text-2xl font-bold border-2 border-stroke dark:border-strokedark rounded-xl px-4 py-4 outline-none focus:border-primary dark:bg-form-input dark:text-white mb-6"
                        />
                        {statusMessage.type === "error" && <p className="text-red-500 text-sm text-center mb-4">{statusMessage.text}</p>}
                        <div className="flex gap-3">
                            <button onClick={() => setOtpModalOpen(false)} className="flex-1 border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-meta-4 transition-colors">Cancel</button>
                            <button onClick={verifyTransfer} disabled={otp.length < 4 || loading} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                                Verify & Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Conflict Modal (Duplicate IMEI) ──────────────────────────────── */}
            {conflictModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-70 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-md w-full shadow-2xl">
                        <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6 text-amber-600">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-center text-black dark:text-white mb-2">Pending Transfer Conflict</h3>
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6 px-2">
                            The following IMEI(s) are already in an active pending transfer. You must cancel those first or go to history to complete them.
                        </p>

                        {/* Conflicting list */}
                        <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden mb-6">
                            <div className="bg-amber-50 dark:bg-amber-900/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Conflicting Items ({conflictingItems.length})
                            </div>
                            <div className="divide-y divide-amber-100 dark:divide-amber-900/20 max-h-40 overflow-y-auto">
                                {conflictingItems.map(item => (
                                    <div key={item.transfer_id} className="flex items-center justify-between px-4 py-2.5">
                                        <div>
                                            <p className="text-xs font-bold text-black dark:text-white">{item.product_name}</p>
                                            <p className="text-[10px] font-mono text-primary mt-0.5">IMEI: {item.imei}</p>
                                        </div>
                                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded font-bold border border-amber-200 dark:border-amber-700">
                                            Transfer #{item.transfer_id}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleCancelConflictsAndRetry}
                                disabled={cancellingConflicts}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {cancellingConflicts ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <X size={16} />}
                                Cancel Pending Transfers & Retry
                            </button>
                            <button
                                onClick={() => { setConflictModalOpen(false); router.push("/outlet/inventory/transfers/history"); }}
                                className="w-full border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-meta-4 transition-colors"
                            >
                                Go to Transfer History
                            </button>
                            <button
                                onClick={() => { setConflictModalOpen(false); setConflictingItems([]); }}
                                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination */}
            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-boxdark p-4 rounded-xl border border-stroke dark:border-strokedark">
                <div className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItemsCount)} of {totalItemsCount} Stock Items
                </div>
                <div className="flex items-center gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all">Previous</button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button key={i} onClick={() => setPage(i + 1)} className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${page === i + 1 ? "bg-primary text-white shadow-lg shadow-primary/20" : "border border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4"}`}>{i + 1}</button>
                    )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
                    <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all">Next</button>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{totalItemsCount} items available across {totalPages} pages</div>
            </div>
        </div>
    );
}
