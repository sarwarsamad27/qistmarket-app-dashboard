"use client";

import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import {
    History, Package, Truck, Store, ChevronDown, ChevronRight, Building2, X, KeyRound,
    CheckCircle2, RotateCcw, CheckSquare, Square, Trash2, RefreshCw
} from "lucide-react";
import Loader from "@/components/common/Loader";
import { toast } from "react-hot-toast";
import { useNotifications } from "../../../../../../../contexts/NotificationContext";
import { useAuth } from "../../../../../../../contexts/AuthContext";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

interface TransferRecord {
    id: number;
    from_type: string;
    from_id: number;
    to_type: string;
    to_id: number;
    inventory_id: number;
    quantity_transferred: number;
    status: string;
    created_at: string;
    updated_at: string;
    recipient_name: string;
    inventory: {
        product_name: string;
        category: string;
        color_variant?: string;
        imei_serial?: string;
        purchase_price: number;
        quantity: number;
        status?: string;
        is_used?: boolean;
    };
}

interface GroupedTransfer {
    key: string;
    product_name: string;
    category: string;
    color_variant?: string;
    to_type: string;
    recipient_name: string;
    total_quantity: number;
    latest_at: string;
    records: TransferRecord[];
}

export default function TransferHistoryPage() {
    const [loading, setLoading] = useState(true);
    const [transfers, setTransfers] = useState<TransferRecord[]>([]);
    const [activeTab, setActiveTab] = useState<"Delivery Officer" | "Outlet">("Delivery Officer");
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(20);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [search, setSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [direction, setDirection] = useState<"sent" | "received">("sent");
    const [statusFilter, setStatusFilter] = useState<string>("");

    // Single-item actions
    const [otpModalOpen, setOtpModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
    const [otp, setOtp] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [itemToCancel, setItemToCancel] = useState<number | null>(null);
    const [backConfirmModalOpen, setBackConfirmModalOpen] = useState(false);
    const [backConfirmData, setBackConfirmData] = useState<{id: number, name: string, imei: string} | null>(null);

    // ── Bulk selection state ─────────────────────────────────────────────────
    const [selectedPendingIds, setSelectedPendingIds] = useState<Set<number>>(new Set());
    const [bulkCancelModalOpen, setBulkCancelModalOpen] = useState(false);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [bulkVerifyData, setBulkVerifyData] = useState<TransferRecord[] | null>(null);

    // ── Bulk Transferred selection state (for Stock Back) ────────────────────
    const [selectedTransferredIds, setSelectedTransferredIds] = useState<Set<number>>(new Set());
    const [bulkStockBackModalOpen, setBulkStockBackModalOpen] = useState(false);

    const { socket } = useNotifications();
    const { user } = useAuth();

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let url = `${API_BASE}/api/outlet/inventory/transfers/history?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&direction=${direction}`;
            if (activeTab === "Delivery Officer" && direction === "sent") url += `&to_type=Delivery Officer`;
            if (activeTab === "Outlet") url += `&to_type=Outlet`;
            if (statusFilter) url += `&status=${statusFilter}`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;

            const res = await fetch(url, { headers: getAuthHeaders() });
            const json = await res.json();
            if (json.success) {
                setTransfers(json.transfers);
                setTotalPages(json.pagination.totalPages);
                setTotalItemsCount(json.pagination.total);
            }
        } catch {
            console.error("Failed to load transfer history");
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoryRef = useRef(fetchHistory);
    useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);

    useEffect(() => {
        fetchHistoryRef.current();
        setSelectedPendingIds(new Set()); // clear selection on filter change
    }, [page, search, activeTab, startDate, endDate, direction, statusFilter]);

    useEffect(() => {
        if (!socket || !user) return;
        const handleUpdate = () => { fetchHistoryRef.current(); };
        socket.on("stock_transfer_initiated", handleUpdate);
        socket.on("stock_transfer_cancelled", handleUpdate);
        socket.on("stock_transfer_completed", (data: any) => { 
            toast.success("Stock transfer confirmed!"); 
            setSelectedPendingIds(new Set()); 
            handleUpdate(); 
        });
        socket.on("stock_transfer_status", (data: any) => { 
            if (data.status === 'completed') toast.success("Transfer completed!"); 
            setSelectedPendingIds(new Set()); 
            handleUpdate(); 
        });
        socket.on("stock_back_initiated", (data: any) => { 
            toast.success("Stock back initiated!"); 
            handleUpdate(); 
        });
        socket.on("stock_back_completed", (data: any) => { 
            toast.success("Stock back confirmed!"); 
            setSelectedTransferredIds(new Set()); 
            handleUpdate(); 
        });
        return () => {
            socket.off("stock_transfer_initiated", handleUpdate);
            socket.off("stock_transfer_cancelled", handleUpdate);
            socket.off("stock_transfer_completed");
            socket.off("stock_transfer_status");
            socket.off("stock_back_initiated", handleUpdate);
            socket.off("stock_back_completed");
        };
    }, [socket, user]);

    // ── Single-item actions ──────────────────────────────────────────────────
    const handleVerify = async () => {
        if ((!selectedTransfer && !bulkVerifyData) || otp.length < 4) return;
        setActionLoading(true);
        try {
            const payload = bulkVerifyData
                ? bulkVerifyData.map(t => ({ id: t.inventory_id, quantity: t.quantity_transferred }))
                : [{ id: selectedTransfer!.inventory_id, quantity: selectedTransfer!.quantity_transferred }];
            
            const targetRec = bulkVerifyData ? bulkVerifyData[0] : selectedTransfer!;

            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/verify`, {
                method: "POST", headers: getAuthHeaders(),
                body: JSON.stringify({ otp, inventory_ids: payload, to_id: targetRec.to_id, to_type: targetRec.to_type }),
            });
            const data = await res.json();
            if (data.success) { 
                setOtpModalOpen(false); 
                setOtp(""); 
                setBulkVerifyData(null); 
                setSelectedTransfer(null); 
                setSelectedPendingIds(new Set()); // clear selection to remove bottom bar
                toast.success("Verification successful!"); 
                setTimeout(() => fetchHistory(), 500); 
            }
            else toast.error(data.message || "Verification failed.");
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setActionLoading(false); }
    };

    const handleCancel = (id: number) => { setItemToCancel(id); setConfirmModalOpen(true); };

    const executeCancel = async () => {
        if (!itemToCancel) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/cancel`, {
                method: "POST", headers: getAuthHeaders(),
                body: JSON.stringify({ transfer_ids: [itemToCancel], reason: "Cancelled by sender from history." }),
            });
            const data = await res.json();
            if (data.success) { toast.success("Transfer cancelled."); setConfirmModalOpen(false); setItemToCancel(null); fetchHistory(); }
            else toast.error(data.message || "Cancellation failed.");
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setActionLoading(false); }
    };

    const handleResendOTP = async (rec: TransferRecord) => {
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/resend-otp`, {
                method: "POST", headers: getAuthHeaders(),
                body: JSON.stringify({ to_id: rec.to_id, to_type: rec.to_type, transfer_ids: [rec.id] }),
            });
            const data = await res.json();
            if (data.success) { toast.success("OTP resent."); if (direction === 'sent') { setSelectedTransfer(rec); setOtpModalOpen(true); setOtp(""); } }
            else toast.error(data.message || "Failed to resend OTP.");
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setActionLoading(false); }
    };

    const handleInitiateStockBack = (id: number, name: string, imei: string) => { setBackConfirmData({ id, name, imei }); setBackConfirmModalOpen(true); };

    const executeStockBack = async () => {
        if (!backConfirmData) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/back/initiate`, {
                method: "POST", headers: getAuthHeaders(),
                body: JSON.stringify({ transfer_id: backConfirmData.id }),
            });
            const data = await res.json();
            if (data.success) { toast.success("Stock back initiated!"); setBackConfirmModalOpen(false); setBackConfirmData(null); fetchHistory(); }
            else toast.error(data.message || "Failed.");
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setActionLoading(false); }
    };

    // ── Bulk selection helpers ───────────────────────────────────────────────
    const allPendingIds = useMemo(() => transfers.filter(t => t.status === 'pending').map(t => t.id), [transfers]);
    const allPendingSelected = allPendingIds.length > 0 && allPendingIds.every(id => selectedPendingIds.has(id));
    const somePendingSelected = selectedPendingIds.size > 0;

    const togglePending = (id: number) => {
        setSelectedPendingIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const toggleAllPending = () => {
        if (allPendingSelected) {
            setSelectedPendingIds(new Set());
        } else {
            setSelectedPendingIds(new Set(allPendingIds));
            // Also expand all groups that have pending items
            const grpKeysWithPending = new Set<string>();
            transfers.filter(t => t.status === 'pending').forEach(t => {
                const otherPartyId = direction === 'sent' ? t.to_id : t.from_id;
                grpKeysWithPending.add(`${t.inventory.product_name}||${otherPartyId}`);
            });
            setExpandedKeys(prev => new Set([...prev, ...grpKeysWithPending]));
        }
    };

    // ── Bulk Cancel ──────────────────────────────────────────────────────────
    const executeBulkCancel = async () => {
        if (selectedPendingIds.size === 0) return;
        setBulkActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/cancel`, {
                method: "POST", headers: getAuthHeaders(),
                body: JSON.stringify({ transfer_ids: Array.from(selectedPendingIds), reason: "Bulk cancelled from transfer history." }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`${selectedPendingIds.size} transfer(s) cancelled.`);
                setSelectedPendingIds(new Set());
                setBulkCancelModalOpen(false);
                fetchHistory();
            } else toast.error(data.message || "Bulk cancel failed.");
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setBulkActionLoading(false); }
    };

    // ── Bulk Resend OTP / Verify Selected ─────────────────────────────────────────────────────
    const executeBulkResendOTP = async () => {
        if (selectedPendingIds.size === 0) return;
        setBulkActionLoading(true);
        try {
            const selectedRecords = transfers.filter(t => selectedPendingIds.has(t.id) && t.status === 'pending');
            const groups = new Map<string, { to_id: number; to_type: string; ids: number[]; records: TransferRecord[] }>();
            selectedRecords.forEach(rec => {
                const key = `${rec.to_type}:${rec.to_id}`;
                if (!groups.has(key)) groups.set(key, { to_id: rec.to_id, to_type: rec.to_type, ids: [], records: [] });
                groups.get(key)!.ids.push(rec.id);
                groups.get(key)!.records.push(rec);
            });

            if (groups.size > 1 && direction === 'sent') {
                toast.error("Please select items for only ONE recipient group to verify them together.");
                setBulkActionLoading(false);
                return;
            }

            let successCount = 0;
            let failCount = 0;
            const groupArray = Array.from(groups.values());
            
            await Promise.all(groupArray.map(async (grp) => {
                try {
                    const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/resend-otp`, {
                        method: "POST", headers: getAuthHeaders(),
                        body: JSON.stringify({ to_id: grp.to_id, to_type: grp.to_type, transfer_ids: grp.ids }),
                    });
                    const data = await res.json();
                    if (data.success) successCount++;
                    else failCount++;
                } catch { failCount++; }
            }));

            if (successCount > 0) {
                toast.success(`OTP resent to ${successCount} recipient group(s).`);
                if (direction === 'sent' && groupArray.length === 1) {
                    setBulkVerifyData(groupArray[0].records);
                    setOtpModalOpen(true);
                    setOtp("");
                }
            }
            if (failCount > 0) toast.error(`Failed for ${failCount} group(s).`);
            
            // Do not clear selection if we opened the modal, so they see what they are verifying
            if (!(direction === 'sent' && successCount > 0 && groupArray.length === 1)) {
                setSelectedPendingIds(new Set());
            }
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setBulkActionLoading(false); }
    };

    // ── Bulk Stock Back ────────────────────────────────────────────────────────
    const allTransferredIds = useMemo(() => transfers.filter(t => t.status === 'transferred').map(t => t.id), [transfers]);
    const allTransferredSelected = allTransferredIds.length > 0 && allTransferredIds.every(id => selectedTransferredIds.has(id));
    const someTransferredSelected = selectedTransferredIds.size > 0;

    const toggleTransferred = (id: number) => {
        setSelectedTransferredIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const toggleAllTransferred = () => {
        if (allTransferredSelected) {
            setSelectedTransferredIds(new Set());
        } else {
            setSelectedTransferredIds(new Set(allTransferredIds));
            const grpKeysWithTransferred = new Set<string>();
            transfers.filter(t => t.status === 'transferred').forEach(t => {
                const otherPartyId = direction === 'sent' ? t.to_id : t.from_id;
                grpKeysWithTransferred.add(`${t.inventory.product_name}||${otherPartyId}`);
            });
            setExpandedKeys(prev => new Set([...prev, ...grpKeysWithTransferred]));
        }
    };

    const executeBulkStockBack = async () => {
        if (selectedTransferredIds.size === 0) return;
        setBulkActionLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/transfer/back/initiate`, {
                method: "POST", headers: getAuthHeaders(),
                body: JSON.stringify({ transfer_ids: Array.from(selectedTransferredIds) }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Bulk stock back initiated! Verification required.");
                setBulkStockBackModalOpen(false);
                setSelectedTransferredIds(new Set());
                fetchHistory();
            } else toast.error(data.message || "Failed.");
        } catch (err) { toast.error(getErrorMessage(err, "Network error.")); } finally { setBulkActionLoading(false); }
    };

    const toggleExpand = (key: string) => {
        setExpandedKeys(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    };

    const grouped = useMemo<GroupedTransfer[]>(() => {
        const map = new Map<string, GroupedTransfer>();
        for (const t of transfers) {
            const otherPartyId = direction === 'sent' ? t.to_id : t.from_id;
            const key = `${t.inventory.product_name}||${otherPartyId}`;
            if (!map.has(key)) {
                map.set(key, { key, product_name: t.inventory.product_name, category: t.inventory.category, color_variant: undefined, to_type: t.to_type, recipient_name: direction === 'sent' ? (t as any).recipient_name : (t as any).sender_name, total_quantity: 0, latest_at: t.created_at, records: [] });
            }
            const grp = map.get(key)!;
            grp.total_quantity += t.quantity_transferred || 1;
            if (new Date(t.created_at) > new Date(grp.latest_at)) grp.latest_at = t.created_at;
            grp.records.push(t);
        }
        return Array.from(map.values());
    }, [transfers, direction]);

    const totalQty = grouped.reduce((s, g) => s + g.total_quantity, 0);

    if (loading && transfers.length === 0) return <Loader text="Loading Transfer History..." />;

    return (
        <div className="mx-auto max-w-7xl pb-32">
            <Breadcrumb pageName="Transfer History" />

            {/* Sent / Received tabs */}
            <div className="flex gap-4 mb-8 border-b border-stroke dark:border-strokedark">
                <button onClick={() => { setDirection("sent"); setPage(1); }} className={`pb-4 px-6 text-sm font-bold transition-all border-b-2 ${direction === "sent" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Sent History</button>
                <button onClick={() => { setDirection("received"); setPage(1); }} className={`pb-4 px-6 text-sm font-bold transition-all border-b-2 ${direction === "received" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Received History</button>
            </div>

            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800 dark:text-white">
                        <History size={24} className="text-primary" /> {direction === "sent" ? "Sent Transfers" : "Received Transfers"}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Stock {direction === "sent" ? "transferred out" : "transferred in"} — grouped by product & party.</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-xl px-4 py-2 text-center shadow-sm">
                        <div className="text-xl font-black text-primary">{totalItemsCount}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wide">Total Records</div>
                    </div>
                    {allPendingIds.length > 0 && direction === 'sent' && (
                        <div className="bg-white dark:bg-boxdark border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 text-center shadow-sm">
                            <div className="text-xl font-black text-amber-600">{allPendingIds.length}</div>
                            <div className="text-[10px] text-amber-500 uppercase tracking-wide">Pending</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-6">
                <div className="flex gap-4 border-b border-stroke dark:border-strokedark flex-1">
                    {direction === "sent" ? (
                        (["Delivery Officer", "Outlet"] as const).map(tab => (
                            <button key={tab} className={`pb-3 border-b-2 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => { setActiveTab(tab); setPage(1); }}>
                                {tab === "Delivery Officer" ? <Truck size={16} /> : <Store size={16} />}
                                {tab === "Delivery Officer" ? "To Delivery Officers" : "To Other Outlets"}
                            </button>
                        ))
                    ) : (
                        <div className="pb-3 border-b-2 border-primary text-primary text-sm font-semibold flex items-center gap-2"><Store size={16} /> From Other Outlets</div>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-4 w-full lg:max-w-3xl">
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="border border-stroke dark:border-strokedark rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-boxdark outline-none dark:text-white">
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="transferred">Transferred</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <div className="flex items-center gap-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg px-3 py-1.5 shadow-sm">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">From</span>
                        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="bg-transparent text-xs outline-none dark:text-white" />
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-lg px-3 py-1.5 shadow-sm">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">To</span>
                        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="bg-transparent text-xs outline-none dark:text-white" />
                    </div>
                    <div className="relative flex-1 min-w-[200px]">
                        <input type="text" placeholder="Search product/IMEI..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full border border-stroke dark:border-strokedark rounded-lg pl-4 pr-4 py-2 text-sm bg-gray-50 dark:bg-form-input focus:border-primary outline-none dark:text-white shadow-sm" />
                    </div>
                </div>
            </div>

            {/* Bulk Select All bar (only shown when there are pending items in sent view) */}
            {allPendingIds.length > 0 && direction === 'sent' && (
                <div className="mb-4 flex items-center gap-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                    <button onClick={toggleAllPending} className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 hover:opacity-80 transition-opacity">
                        {allPendingSelected ? <CheckSquare size={18} className="text-amber-600" /> : <Square size={18} className="text-amber-400" />}
                        {allPendingSelected ? "Deselect All Pending" : `Select All Pending (${allPendingIds.length})`}
                    </button>
                    {somePendingSelected && (
                        <span className="text-xs font-bold bg-amber-600 text-white px-2 py-0.5 rounded-full">
                            {selectedPendingIds.size} selected
                        </span>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-boxdark rounded-xl shadow border border-stroke dark:border-strokedark overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 py-4 px-6 border-b border-stroke dark:border-strokedark font-bold text-black dark:text-white uppercase text-xs tracking-wider">
                            <div className="col-span-12 md:col-span-4 flex items-center">
                                {/* Bulk Toggle Checkboxes */}
                                {statusFilter === 'pending' && (
                                    <div className="mr-3 flex items-center h-full">
                                        <input type="checkbox" checked={allPendingSelected} onChange={toggleAllPending} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:bg-meta-4 dark:border-strokedark cursor-pointer" />
                                    </div>
                                )}
                                {statusFilter === 'transferred' && (
                                    <div className="mr-3 flex items-center h-full">
                                        <input type="checkbox" checked={allTransferredSelected} onChange={toggleAllTransferred} className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-600 dark:bg-meta-4 dark:border-strokedark cursor-pointer" />
                                    </div>
                                )}
                                <span>Item & Recipient</span>
                            </div>
                            <div className="col-span-2 text-center">Variant</div>
                            <div className="col-span-1 text-center">Units</div>
                            <div className="col-span-2 text-center">Status</div>
                            <div className="col-span-3 text-right">Date</div>
                        </div>

                        {grouped.length === 0 ? (
                            <div className="p-16 text-center text-gray-500 dark:text-gray-400">
                                <div className="flex flex-col items-center gap-3 opacity-60"><Package size={44} /><span className="font-medium">No transfers found.</span></div>
                            </div>
                ) : grouped.map(grp => {
                    const isExpanded = expandedKeys.has(grp.key);
                    const grpPendingIds = grp.records.filter(r => r.status === 'pending').map(r => r.id);
                    const grpAllSelected = grpPendingIds.length > 0 && grpPendingIds.every(id => selectedPendingIds.has(id));
                    const grpSomeSelected = grpPendingIds.some(id => selectedPendingIds.has(id));

                    return (
                        <Fragment key={grp.key}>
                            <div onClick={() => toggleExpand(grp.key)} className={`grid grid-cols-12 gap-4 py-4 px-6 border-b border-stroke dark:border-strokedark cursor-pointer transition-colors ${isExpanded ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-meta-4/20"}`}>
                                <div className="col-span-12 md:col-span-4 flex items-center gap-3">
                                    <div className="text-gray-400">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                                    <div>
                                        <div className="font-bold text-black dark:text-white">{grp.product_name}</div>
                                        <div className="text-xs text-gray-500">{grp.recipient_name}</div>
                                    </div>
                                </div>
                                <div className="col-span-2 text-center text-sm my-auto">{grp.color_variant || "—"}</div>
                                <div className="col-span-1 text-center text-sm font-bold my-auto">{grp.total_quantity}</div>
                                <div className="col-span-2 text-center my-auto">
                                    {grp.records.some(r => r.status === 'pending') ? (
                                        <span className="px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded-md text-[10px] font-bold uppercase tracking-wider border border-amber-100 dark:border-amber-800">Pending</span>
                                    ) : (
                                        <span className="px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-md text-[10px] font-bold uppercase tracking-wider border border-green-100 dark:border-green-800">Transferred</span>
                                    )}
                                </div>
                                <div className="col-span-3 text-right text-xs text-gray-500 my-auto">{formatExactDate(grp.latest_at)}</div>
                            </div>

                            {isExpanded && grp.records.map((rec) => (
                                <div key={rec.id} className="grid grid-cols-12 gap-4 py-3 px-6 border-b border-stroke dark:border-strokedark last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-meta-4/20 transition-colors">
                                    <div className="col-span-12 md:col-span-4 flex items-center pl-6">
                                        {/* Pending select — only in Sent History */}
                                        {rec.status === 'pending' && direction === 'sent' && (
                                            <div className="mr-3" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedPendingIds.has(rec.id)} onChange={() => togglePending(rec.id)} className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary dark:bg-meta-4 dark:border-strokedark cursor-pointer" />
                                            </div>
                                        )}
                                        {/* Transferred select — both Sent & Received (for Stock Back) */}
                                        {rec.status === 'transferred' && (
                                            <div className="mr-3" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedTransferredIds.has(rec.id)} onChange={() => toggleTransferred(rec.id)} className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-600 dark:bg-meta-4 dark:border-strokedark cursor-pointer" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs">{rec.inventory.imei_serial || "Generic"}</span>
                                            {(rec.inventory.status === "Used Stock" || rec.inventory.is_used) && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 uppercase tracking-wider border border-orange-200 dark:border-orange-800">
                                                    Used Item
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-2 text-center text-xs my-auto">{rec.inventory.color_variant || "—"}</div>
                                    <div className="col-span-1 text-center text-xs my-auto">{rec.quantity_transferred}</div>
                                    <div className="col-span-2 text-center my-auto">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${(rec.status === 'transferred' || rec.status === 'delivered') ? "bg-green-100 text-green-700" : (rec.status === 'returned' || rec.status === 'Stock Back') ? "bg-green-100 text-green-800" : rec.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                                            {rec.status === 'returned' || rec.status === 'Stock Back' ? 'Stock Back' : rec.status === 'delivered' ? 'transferred' : rec.status}
                                        </span>
                                    </div>
                                    <div className="col-span-3 text-right text-xs text-gray-400 my-auto flex justify-end gap-2 items-center">
                                        {formatExactDate(rec.created_at)}
                                        {rec.status === 'pending' && direction === 'sent' && (
                                            <div className="flex gap-1 ml-2">
                                                {/* <button onClick={() => { setSelectedTransfer(rec); setOtpModalOpen(true); }} className="p-1.5 bg-primary text-white rounded hover:bg-opacity-90" title="Complete"><CheckCircle2 size={12} /></button> */}
                                                <button onClick={() => handleResendOTP(rec)} className="p-1.5 bg-blue-500 text-white rounded hover:bg-opacity-90" title="Resend"><KeyRound size={12} /></button>
                                                <button onClick={() => handleCancel(rec.id)} className="p-1.5 bg-red-500 text-white rounded hover:bg-opacity-90" title="Cancel"><X size={12} /></button>
                                            </div>
                                        )}
                                        {rec.status === 'transferred' && (
                                            <button onClick={() => handleInitiateStockBack(rec.id, rec.inventory.product_name, rec.inventory.imei_serial || "")} disabled={actionLoading} className="p-1.5 bg-indigo-500 text-white rounded hover:bg-opacity-90" title="Stock Back"><RotateCcw size={12} /></button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </Fragment>
                    );
                })}
                    </div>
                </div>
            </div>

            {/* Pagination */}
            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-boxdark p-4 rounded-xl border border-stroke dark:border-strokedark">
                <div className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalItemsCount)} of {totalItemsCount} Records
                </div>
                <div className="flex items-center gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all">Previous</button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button key={i} onClick={() => setPage(i + 1)} className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${page === i + 1 ? "bg-primary text-white" : "border border-stroke dark:border-strokedark hover:bg-gray-50"}`}>{i + 1}</button>
                    )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
                    <button disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all">Next</button>
                </div>
            </div>

            {/* FLOATING ACTION BAR FOR BULK PENDING */}
            {somePendingSelected && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-boxdark rounded-full shadow-2xl border border-stroke dark:border-strokedark px-6 py-3 flex items-center gap-6 z-50 animate-enter">
                    <span className="font-bold text-primary">{selectedPendingIds.size} Selected</span>
                    <div className="h-6 w-px bg-stroke dark:bg-strokedark"></div>
                    <button onClick={() => setBulkCancelModalOpen(true)} className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium transition-colors">
                        <Trash2 size={18} /> Bulk Cancel
                    </button>
                    <button onClick={executeBulkResendOTP} disabled={bulkActionLoading} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors">
                        <KeyRound size={18} /> {direction === 'sent' ? 'Verify Selected' : 'Resend OTP'}
                    </button>
                </div>
            )}

            {/* FLOATING ACTION BAR FOR BULK TRANSFERRED */}
            {someTransferredSelected && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-boxdark rounded-full shadow-2xl border border-stroke dark:border-strokedark px-6 py-3 flex items-center gap-6 z-50 animate-enter">
                    <span className="font-bold text-indigo-600">{selectedTransferredIds.size} Selected</span>
                    <div className="h-6 w-px bg-stroke dark:bg-strokedark"></div>
                    <button onClick={() => setBulkStockBackModalOpen(true)} className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                        <RotateCcw size={18} /> Bulk Stock Back
                    </button>
                </div>
            )}

            {/* Verify Modal (single item) */}
            {otpModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-60 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-sm w-full">
                        <h3 className="text-xl font-bold mb-4">Verify Receipt</h3>
                        <p className="text-sm text-gray-500 mb-6">Enter OTP to confirm receipt of stock.</p>
                        <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="Enter OTP" className="w-full border-2 border-stroke rounded-xl px-4 py-3 mb-6 outline-none focus:border-primary dark:bg-form-input dark:text-white" />
                        <div className="flex gap-3">
                            <button onClick={() => setOtpModalOpen(false)} className="flex-1 py-3 border rounded-xl">Cancel</button>
                            <button onClick={handleVerify} disabled={actionLoading} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">{actionLoading ? "Verifying..." : "Verify"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Single Cancel Modal */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 text-red-600"><X size={32} /></div>
                        <h3 className="text-xl font-bold text-center text-black dark:text-white mb-2">Cancel Transfer?</h3>
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-8 px-4">Are you sure you want to cancel this pending transfer?</p>
                        <div className="flex gap-4">
                            <button onClick={() => { setConfirmModalOpen(false); setItemToCancel(null); }} className="flex-1 bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white py-3 rounded-xl font-bold">No, Keep</button>
                            <button onClick={executeCancel} disabled={actionLoading} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">{actionLoading ? "Processing..." : "Yes, Cancel"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Cancel Confirm Modal */}
            {bulkCancelModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-70 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6 text-red-600"><Trash2 size={32} /></div>
                        <h3 className="text-xl font-bold text-center text-black dark:text-white mb-2">Bulk Cancel?</h3>
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-2 px-4">
                            You are about to cancel <strong className="text-red-600">{selectedPendingIds.size}</strong> pending transfer(s).
                        </p>
                        <p className="text-xs text-center text-amber-600 font-bold uppercase tracking-wider mb-8">Items will be returned to In Stock status</p>
                        <div className="flex gap-4">
                            <button onClick={() => setBulkCancelModalOpen(false)} className="flex-1 bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white py-3 rounded-xl font-bold">No, Keep</button>
                            <button onClick={executeBulkCancel} disabled={bulkActionLoading} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 shadow-lg shadow-red-600/20">{bulkActionLoading ? "Cancelling..." : `Cancel ${selectedPendingIds.size} Transfer(s)`}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Back Confirm Modal */}
            {backConfirmModalOpen && backConfirmData && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6 text-indigo-600"><RotateCcw size={32} /></div>
                        <h3 className="text-xl font-bold text-center text-black dark:text-white mb-2">Initiate Stock Back?</h3>
                        <div className="text-sm text-center text-gray-500 dark:text-gray-400 mb-8 px-4 space-y-2">
                            <p>Are you sure you want to reverse this transfer?</p>
                            <div className="p-3 bg-gray-50 dark:bg-meta-4 rounded-lg border border-stroke dark:border-strokedark mt-2">
                                <p className="font-bold text-black dark:text-white line-clamp-1">{backConfirmData.name}</p>
                                {backConfirmData.imei && <p className="text-[10px] text-primary font-mono mt-1">IMEI: {backConfirmData.imei}</p>}
                            </div>
                            <p className="text-[10px] font-bold text-amber-600 uppercase mt-4 text-center">Verification via OTP will be required</p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => { setBackConfirmModalOpen(false); setBackConfirmData(null); }} className="flex-1 bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white py-3 rounded-xl font-bold">Cancel</button>
                            <button onClick={executeStockBack} disabled={actionLoading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 shadow-lg shadow-indigo-600/20">{actionLoading ? "Processing..." : "Initiate"}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Stock Back Confirm Modal */}
            {bulkStockBackModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black bg-opacity-70 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6 text-indigo-600"><RotateCcw size={32} /></div>
                        <h3 className="text-xl font-bold text-center text-black dark:text-white mb-2">Bulk Stock Back?</h3>
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-2 px-4">
                            You are about to initiate stock back for <strong className="text-indigo-600">{selectedTransferredIds.size}</strong> transferred item(s).
                        </p>
                        <p className="text-xs text-center text-amber-600 font-bold uppercase tracking-wider mb-8">Verification via OTP will be required</p>
                        <div className="flex gap-4">
                            <button onClick={() => setBulkStockBackModalOpen(false)} className="flex-1 bg-gray-100 dark:bg-meta-4 text-gray-700 dark:text-white py-3 rounded-xl font-bold">Cancel</button>
                            <button onClick={executeBulkStockBack} disabled={bulkActionLoading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 shadow-lg shadow-indigo-600/20">{bulkActionLoading ? "Initiating..." : `Initiate ${selectedTransferredIds.size} Items`}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
