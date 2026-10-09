"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import {
    Edit, Trash2, Search, CheckSquare, Square, Package,
    AlertCircle, RefreshCw, ChevronDown, ChevronRight, Save, X, Plus, RotateCcw
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

type InventoryItem = {
    id: number;
    product_name: string;
    category: string;
    imei_serial?: string;
    color_variant?: string;
    quantity: number;
    purchase_price: number;
    installment_price: number;
    status: string;
    is_used?: boolean;
};

// A "group" is formed by unique (product_name + color_variant).
// For IMEI-based items (qty=1 each), they are children.
// For bulk generic items (qty>1), they are standalone but also grouped.
type GroupedItem = {
    key: string;          // product_name + || + color_variant
    product_name: string;
    category: string;
    color_variant?: string;
    purchase_price: number;
    totalQty: number;     // sum of all child quantities
    inStockQty: number;
    children: InventoryItem[];
};

const STATUS_COLORS: Record<string, string> = {
    "In Stock": "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    "Used Stock": "bg-primary/10 text-primary border border-primary/20 dark:bg-primary/5 dark:text-primary",
    "Sold": "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    "Out Of Stock": "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};

export default function OutletInventoryPage() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(20);
    const [totalItemsCount, setTotalItemsCount] = useState(0);
    const [totalStats, setTotalStats] = useState({ totalStock: 0, inStock: 0, sold: 0 });

    // Expanded group keys
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    // Alert
    const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Selected individual IDs (for bulk actions)
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});

    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<GroupedItem | null>(null);
    const [unitRows, setUnitRows] = useState<{ imei_serial: string, color_variant: string, purchase_price: number, quantity: number }[]>([]);

    useEffect(() => {
        fetchInventory();
    }, [page, search]);


    const fetchInventory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/used?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setInventory(data.inventory);
                setTotalPages(data.pagination.totalPages);
                setTotalItemsCount(data.pagination.total);
                setTotalStats(data.stats);
                setSelectedIds([]);
            }
        } catch {
            showAlert("error", "Network error fetching inventory.");
        } finally {
            setLoading(false);
        }
    };

    const syncStock = async () => {
        setSyncing(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/used/sync`, {
                method: "POST", headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Stock sync failed.");
            showAlert("success", data.message);
            if (page === 1) await fetchInventory();
            else setPage(1);
        } catch (error) {
            showAlert("error", error instanceof Error ? error.message : "Stock sync failed.");
        } finally {
            setSyncing(false);
        }
    };

    const showAlert = (type: "success" | "error", message: string) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 3500);
    };

    // Group items by product_name + color_variant
    const grouped = useMemo<GroupedItem[]>(() => {
        const map = new Map<string, GroupedItem>();

        for (const item of inventory) {
            const key = item.product_name; // Group by product name only
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    product_name: item.product_name,
                    category: item.category,
                    color_variant: undefined, // Multiple variants might exist
                    purchase_price: item.purchase_price,
                    totalQty: 0,
                    inStockQty: 0,
                    children: [],
                });
            }
            const grp = map.get(key)!;
            grp.totalQty += item.quantity;
            if (item.status === "In Stock" || item.status === "Used Stock") grp.inStockQty += item.quantity;
            grp.children.push(item);
        }

        return Array.from(map.values()).sort((a, b) => {
            if (b.inStockQty === 0 && a.inStockQty > 0) return -1;
            if (a.inStockQty === 0 && b.inStockQty > 0) return 1;
            return b.inStockQty - a.inStockQty;
        });
    }, [inventory]);

    const toggleExpand = (key: string) => {
        setExpandedKeys(prev => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });
    };

    const toggleChildSelection = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleGroupSelection = (grp: GroupedItem) => {
        const ids = grp.children.map(c => c.id);
        const allSelected = ids.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...ids])]);
        }
    };

    // Quick Status Toggle (Inline)
    const toggleStatus = async (item: InventoryItem) => {
        const newStatus = item.status === "In Stock" ? "Out Of Stock" : "In Stock";
        const res = await fetch(`${API_BASE}/api/outlet/inventory/${item.id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus }),
        });
        const data = await res.json();
        if (data.success) {
            setInventory(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
            showAlert("success", `${item.product_name} marked ${newStatus}`);
        } else {
            showAlert("error", "Failed to update status.");
        }
    };

    const startEdit = (item: InventoryItem) => {
        setEditingId(item.id);
        setEditForm({
            product_name: item.product_name,
            category: item.category,
            imei_serial: item.imei_serial,
            color_variant: item.color_variant,
            quantity: item.quantity,
            purchase_price: item.purchase_price,
            status: item.status,
        });
    };

    const reverseUsedStatus = async (item: InventoryItem) => {
        if (!confirm(`Reverse used status for ${item.product_name}?`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/outlet/inventory/${item.id}`, {
                method: "PATCH",
                headers: getAuthHeaders(),
                body: JSON.stringify({ is_used: false, status: "Sold" }),
            });
            const data = await res.json();
            if (data.success) {
                setInventory(prev => prev.filter(i => i.id !== item.id));
                showAlert("success", `${item.product_name} reversed to available stock.`);
            } else {
                showAlert("error", data.message || "Could not reverse item.");
            }
        } catch {
            showAlert("error", "Network error while reversing item.");
        }
    };

    const saveEdit = async (id: number) => {
        // If it's a quick edit (not in full edit mode), we use the item from inventory state
        const item = inventory.find(i => i.id === id);
        const body = editingId === id ? editForm : item;

        const res = await fetch(`${API_BASE}/api/outlet/inventory/${id}`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
            if (editingId === id) setEditingId(null);
            showAlert("success", "Item updated.");
        } else {
            showAlert("error", "Update failed.");
        }
    };

    const deleteItem = async (id: number) => {
        if (!confirm("Delete this inventory record?")) return;
        const res = await fetch(`${API_BASE}/api/outlet/inventory/${id}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (data.success) {
            setInventory(prev => prev.filter(i => i.id !== id));
            showAlert("success", "Item deleted.");
        } else {
            showAlert("error", "Could not delete item.");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Delete ${selectedIds.length} item(s)?`)) return;
        const res = await fetch(`${API_BASE}/api/outlet/inventory/bulk-delete`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ ids: selectedIds }),
        });
        const data = await res.json();
        if (data.success) {
            setInventory(prev => prev.filter(i => !selectedIds.includes(i.id)));
            setSelectedIds([]);
            showAlert("success", `${data.count} items deleted.`);
        } else {
            showAlert("error", "Bulk delete failed.");
        }
    };

    const handleBulkStatusChange = async (targetStatus: string) => {
        if (selectedIds.length === 0) return;
        const res = await fetch(`${API_BASE}/api/outlet/inventory/bulk-edit`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ ids: selectedIds, data: { status: targetStatus } }),
        });
        const data = await res.json();
        if (data.success) {
            setInventory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, status: targetStatus } : i));
            setSelectedIds([]);
            showAlert("success", `${data.count} items → ${targetStatus}`);
        } else {
            showAlert("error", "Bulk status update failed.");
        }
    };

    // Overall stats
    const openAddItem = (grp: GroupedItem) => {
        setSelectedGroup(grp);
        setUnitRows([{
            imei_serial: "",
            color_variant: grp.color_variant || "",
            purchase_price: grp.purchase_price || 0,
            quantity: 1
        }]);
        setShowAddItemModal(true);
    };

    const addUnitRow = () => {
        if (!selectedGroup) return;
        setUnitRows([...unitRows, {
            imei_serial: "",
            color_variant: selectedGroup.color_variant || "",
            purchase_price: selectedGroup.purchase_price || 0,
            quantity: 1
        }]);
    };

    const removeUnitRow = (index: number) => {
        setUnitRows(unitRows.filter((_, i) => i !== index));
    };

    const updateUnitRow = (index: number, field: string, value: any) => {
        const newRows = [...unitRows];
        newRows[index] = { ...newRows[index], [field]: value };
        // Force qty to 1 if IMEI is present
        if (field === "imei_serial" && value.trim()) {
            newRows[index].quantity = 1;
        }
        setUnitRows(newRows);
    };

    const handleAddItem = async () => {
        if (!selectedGroup || unitRows.length === 0) return;
        setLoading(true);
        try {
            const itemsToCreate = unitRows.map(row => ({
                product_name: selectedGroup.product_name,
                category: selectedGroup.category,
                imei_serial: row.imei_serial.trim() || null,
                color_variant: row.color_variant,
                quantity: row.imei_serial.trim() ? 1 : row.quantity,
                purchase_price: row.purchase_price,
                status: "In Stock"
            }));

            const res = await fetch(`${API_BASE}/api/outlet/inventory`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ items: itemsToCreate }),
            });
            const data = await res.json();
            if (data.success) {
                showAlert("success", `${itemsToCreate.length} unit(s) added.`);
                fetchInventory();
                setShowAddItemModal(false);
            } else {
                showAlert("error", data.message || "Failed to add.");
            }
        } catch {
            showAlert("error", "Network error.");
        } finally {
            setLoading(false);
        }
    };

    // Overall stats
    const totalItems = inventory.reduce((s, i) => s + i.quantity, 0);
    const totalInStock = inventory.filter(i => i.status === "In Stock" || i.status === "Used Stock").reduce((s, i) => s + i.quantity, 0);
    const totalSold = inventory.filter(i => i.status === "Sold").reduce((s, i) => s + i.quantity, 0);
    const totalStockValue = inventory.filter(i => i.status === "In Stock" || i.status === "Used Stock").reduce((s, i) => s + (i.quantity * (i.purchase_price || 0)), 0);

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto relative">
            <Breadcrumb pageName="Used Stock" />

            {/* Floating Alert */}
            {alert && (
                <div className={`fixed top-4 right-4 z-[99] px-6 py-4 rounded-xl shadow-lg border flex items-center gap-3 animate-fadeIn ${alert.type === "success"
                        ? "bg-white border-green-200 text-green-700 dark:bg-boxdark dark:border-green-900/50"
                        : "bg-white border-red-200 text-red-700 dark:bg-boxdark dark:border-red-900/50"
                    }`}>
                    {alert.type === "success" ? <CheckSquare size={20} /> : <AlertCircle size={20} />}
                    <span className="font-semibold text-sm">{alert.message}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Package size={24} className="text-primary" /> Used Stock Inventory
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Grouped by product & variant — expand to manage individual units.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/outlet/inventory/used/history" className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
                        <RotateCcw size={16} /> View Reversal History
                    </Link>
                    <button onClick={syncStock} disabled={syncing} className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-meta-4 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors">
                        <RefreshCw size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Sync Stock"}
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            {/* <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {[
                    { label: "Total Item", val: totalStats.totalStock, color: "text-primary" },
                    { label: "In Stock", val: totalStats.inStock, color: "text-green-600 dark:text-green-400" },
                    { label: "Sold", val: totalStats.sold, color: "text-blue-600 dark:text-blue-400" },
                    { label: "Out of Stock", val: totalStats.outOfStock || 0, color: "text-red-600 dark:text-red-400" },
                    { label: "Stock Value", val: `PKR ${totalStockValue.toLocaleString()}`, color: "text-amber-600 dark:text-amber-400" },
                ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-xl p-4 shadow-sm text-center flex flex-col justify-center items-center">
                        <div className={`text-2xl md:text-xl lg:text-2xl font-black ${s.color}`}>{s.val}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium uppercase tracking-wide">{s.label}</div>
                    </div>
                ))}
            </div> */}

            {/* Toolbar */}
            <div className="bg-white dark:bg-boxdark rounded-xl shadow-sm border border-stroke dark:border-strokedark p-4 mb-4 flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="relative w-full lg:max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name, IMEI, category, variant..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full border border-stroke dark:border-strokedark rounded-lg pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-form-input focus:border-primary outline-none dark:text-white"
                    />
                </div>
            </div>

            {/* Inventory Grouped Table */}
            <div className="bg-white dark:bg-boxdark rounded-xl shadow border border-stroke dark:border-strokedark overflow-hidden">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
                        <p className="text-sm font-medium">Loading inventory...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 font-semibold uppercase text-xs tracking-wider">
                                    <th className="px-4 py-4 w-10" />
                                    <th className="px-4 py-4">Product</th>
                                    <th className="px-4 py-4">Category</th>
                                    <th className="px-4 py-4">Variant / Color</th>
                                    <th className="px-4 py-4 text-center">Qty</th>
                                    <th className="px-4 py-4">Base Price</th>
                                    <th className="px-4 py-4">Stock Value</th>
                                    <th className="px-4 py-4 text-center">Units</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grouped.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-16 text-gray-500 font-medium">
                                            No inventory found. Try a different search or add stock.
                                        </td>
                                    </tr>
                                ) : grouped.map((grp) => {
                                    const isExpanded = expandedKeys.has(grp.key);
                                    const groupIds = grp.children.map(c => c.id);
                                    const allSelected = groupIds.every(id => selectedIds.includes(id));
                                    const someSelected = groupIds.some(id => selectedIds.includes(id));

                                    return (
                                        <Fragment key={grp.key}>
                                            {/* ── GROUP (MASTER) ROW ── */}
                                            <tr
                                                key={`grp-${grp.key}`}
                                                className={`border-b border-stroke dark:border-strokedark cursor-pointer transition-colors ${isExpanded ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-gray-50 dark:hover:bg-meta-4/20"
                                                    }`}
                                            >
                                                {/* Expand toggle */}
                                                <td className="px-4 py-4 text-center" onClick={() => toggleExpand(grp.key)}>
                                                    {isExpanded
                                                        ? <ChevronDown size={18} className="text-primary mx-auto" />
                                                        : <ChevronRight size={18} className="text-gray-400 mx-auto" />
                                                    }
                                                </td>

                                                <td className="px-4 py-4" onClick={() => toggleExpand(grp.key)}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-black dark:text-white">{grp.product_name}</span>
                                                        <span className="px-1.5 py-0.5 text-[10px] tracking-wider uppercase font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded">Used</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-gray-500 dark:text-gray-400" onClick={() => toggleExpand(grp.key)}>
                                                    {grp.category || "—"}
                                                </td>
                                                <td className="px-4 py-4" onClick={() => toggleExpand(grp.key)}>
                                                    {grp.color_variant
                                                        ? <span className="px-2 py-1 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 rounded-full text-xs font-medium border border-violet-200 dark:border-violet-700">{grp.color_variant}</span>
                                                        : <span className="text-gray-400">—</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-4 text-center font-black text-lg" onClick={() => toggleExpand(grp.key)}>
                                                    <span className={`${grp.inStockQty > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                                                        {grp.inStockQty}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4" onClick={() => toggleExpand(grp.key)}>
                                                    <span className="font-medium text-gray-700 dark:text-gray-200">PKR {grp.purchase_price?.toLocaleString() || 0}</span>
                                                </td>
                                                <td className="px-4 py-4" onClick={() => toggleExpand(grp.key)}>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">PKR {(grp.inStockQty * (grp.purchase_price || 0)).toLocaleString()}</span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleExpand(grp.key); }}
                                                            className="text-xs text-gray-400 font-semibold hover:text-primary transition-colors"
                                                        >
                                                            {isExpanded ? "Hide" : `${grp.children.length} unit${grp.children.length > 1 ? "s" : ""}`}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* ── CHILD (DETAIL) ROWS ── shown when expanded */}
                                            {isExpanded && grp.children.map((item, idx) => {
                                                const isEditing = editingId === item.id;
                                                const isChildSelected = selectedIds.includes(item.id);

                                                // Quick edit state for skeletons
                                                const hasImei = !!item.imei_serial;
                                                const hasColor = !!item.color_variant;

                                                return (
                                                    <tr
                                                        key={`child-${item.id}`}
                                                        className={`border-b border-dashed border-stroke/50 dark:border-strokedark/50 text-sm ${isChildSelected ? "bg-primary/5 dark:bg-primary/10" : "bg-gray-50/50 dark:bg-meta-4/10"
                                                            } ${isEditing ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}`}
                                                    >
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex justify-center">
                                                                <div className="w-4 h-px bg-gray-300 dark:bg-gray-600 mt-2.5 mr-1" />
                                                                <span className="text-[10px] text-gray-400 font-mono">#{idx + 1}</span>
                                                            </div>
                                                        </td>

                                                        {/* IMEI / Product Column */}
                                                        <td className="px-4 py-3">
                                                            <span className="text-gray-600 dark:text-gray-300 text-xs pl-2">
                                                                <span className="font-mono bg-gray-100 dark:bg-meta-4 px-2 py-0.5 rounded text-xs border border-gray-200 dark:border-strokedark">
                                                                    {item.imei_serial || "—"}
                                                                </span>
                                                            </span>
                                                        </td>

                                                        {/* Category */}
                                                        <td className="px-4 py-3">
                                                            {isEditing ? (
                                                                <input
                                                                    type="text"
                                                                    value={editForm.category || ""}
                                                                    onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                                    className="w-full border rounded px-2 py-1 text-xs dark:bg-form-input dark:border-strokedark outline-none"
                                                                />
                                                            ) : (
                                                                <span className="text-gray-500 dark:text-gray-400 text-xs">{item.category || "—"}</span>
                                                            )}
                                                        </td>

                                                        {/* Variant */}
                                                        <td className="px-4 py-3">
                                                            <span className="text-gray-500 dark:text-gray-400 text-xs">{item.color_variant || "—"}</span>
                                                        </td>

                                                        {/* Quantity */}
                                                        <td className="px-4 py-3 text-center">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={editForm.quantity || 1}
                                                                    onChange={e => {
                                                                        const base = { ...editForm, quantity: parseInt(e.target.value) || 1 };
                                                                        // If it's a serialized record, we lock to 1
                                                                        if (item.imei_serial) base.quantity = 1;
                                                                        setEditForm(base);
                                                                    }}
                                                                    disabled={!!item.imei_serial}
                                                                    className="w-16 text-center border rounded px-1 py-1 text-xs disabled:opacity-50 dark:bg-form-input dark:border-strokedark outline-none mx-auto"
                                                                />
                                                            ) : (
                                                                <span className="font-bold"></span>
                                                            )}
                                                        </td>

                                                        {/* In-Stock count (same as qty for child row) */}
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-600"}`}>
                                                                {item.status === "In Stock" || item.status === "Used Stock" ? item.quantity : 0}
                                                            </span>
                                                        </td>

                                                        {/* Purchase Price */}
                                                        <td className="px-4 py-3">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    value={editForm.purchase_price || 0}
                                                                    onChange={e => setEditForm({ ...editForm, purchase_price: parseFloat(e.target.value) })}
                                                                    className="w-full border rounded px-2 py-1 text-xs dark:bg-form-input dark:border-strokedark outline-none"
                                                                />
                                                            ) : (
                                                                <span className="text-xs text-gray-600 dark:text-gray-300">PKR {item.purchase_price?.toLocaleString()}</span>
                                                            )}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[item.status] || "bg-gray-100 text-gray-600"}`}>
                                                                    {item.status === "Used Stock" ? "In Stock" : item.status}
                                                                </span>
                                                                {item.status === "Used Stock" && (
                                                                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 uppercase tracking-wider border border-orange-200 dark:border-orange-800">
                                                                        Used Item
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); reverseUsedStatus(item); }}
                                                                    className="mt-1 px-2 py-1 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors"
                                                                >
                                                                    Reverse
                                                                </button>
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
                )}
            </div>

            {/* Pagination & Summary */}
            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-boxdark p-4 rounded-xl border border-stroke dark:border-strokedark">
                <div className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                    Showing {totalItemsCount === 0 ? 0 : (page - 1) * limit + 1} to {Math.min(page * limit, totalItemsCount)} of {totalItemsCount} Records
                </div>

                <div className="flex items-center gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                    >
                        Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setPage(i + 1)}
                            className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${page === i + 1
                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                    : "border border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4"
                                }`}
                        >
                            {i + 1}
                        </button>
                    )).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))}
                    <button
                        disabled={page >= totalPages || totalPages === 0}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-bold disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
                    >
                        Next
                    </button>
                </div>

                <div className="text-xs text-gray-400 dark:text-gray-500">
                    {grouped.length} product group{grouped.length !== 1 ? "s" : ""} · {inventory.length} units on this page
                </div>
            </div>

            {showAddItemModal && selectedGroup && (
                <div className="fixed inset-0 z-[999] bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-boxdark rounded-2xl p-6 max-w-4xl w-full shadow-2xl border border-stroke dark:border-strokedark animate-fadeIn flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-black dark:text-white">Add Units</h3>
                                <p className="text-xs text-gray-500 font-medium">{selectedGroup.product_name} ({selectedGroup.category || "General"})</p>
                            </div>
                            <button onClick={() => setShowAddItemModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white dark:bg-boxdark z-10 border-b border-stroke dark:border-strokedark">
                                    <tr className="text-[10px] uppercase tracking-wider font-black text-gray-400">
                                        <th className="py-3 px-2">IMEI / Serial</th>
                                        <th className="py-3 px-2">Color / Variant</th>
                                        <th className="py-3 px-2 w-16 text-center">Qty</th>
                                        <th className="py-3 px-2 w-32">Price (PKR)</th>
                                        <th className="py-3 px-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unitRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-stroke/50 dark:border-strokedark/50 group">
                                            <td className="py-3 px-2">
                                                <input
                                                    type="text"
                                                    placeholder="Scan or Type..."
                                                    value={row.imei_serial}
                                                    onChange={e => updateUnitRow(idx, "imei_serial", e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-xs focus:border-primary outline-none transition-all font-mono"
                                                />
                                            </td>
                                            <td className="py-3 px-2">
                                                <input
                                                    type="text"
                                                    placeholder="Color..."
                                                    value={row.color_variant}
                                                    onChange={e => updateUnitRow(idx, "color_variant", e.target.value)}
                                                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-xs focus:border-primary outline-none transition-all"
                                                />
                                            </td>
                                            <td className="py-3 px-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={row.quantity}
                                                    disabled={!!row.imei_serial.trim()}
                                                    onChange={e => updateUnitRow(idx, "quantity", parseInt(e.target.value) || 1)}
                                                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-lg px-2 py-2 text-xs text-center focus:border-primary outline-none disabled:opacity-40"
                                                />
                                            </td>
                                            <td className="py-3 px-2">
                                                <input
                                                    type="number"
                                                    value={row.purchase_price}
                                                    onChange={e => updateUnitRow(idx, "purchase_price", parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-lg px-3 py-2 text-xs focus:border-primary outline-none font-bold"
                                                />
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                {unitRows.length > 1 && (
                                                    <button
                                                        onClick={() => removeUnitRow(idx)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button
                                onClick={addUnitRow}
                                className="mt-4 flex items-center gap-2 text-primary font-bold text-xs hover:underline px-2"
                            >
                                <Plus size={14} />
                                Add New Row
                            </button>
                        </div>

                        <div className="mt-6 flex gap-3 border-t border-stroke dark:border-strokedark pt-6">
                            <button
                                onClick={() => setShowAddItemModal(false)}
                                className="flex-1 border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-meta-4 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddItem}
                                disabled={loading}
                                className="flex-2 bg-primary text-white py-3 rounded-xl font-black hover:bg-opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg transition-all text-sm px-12"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                                Save All Units ({unitRows.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
