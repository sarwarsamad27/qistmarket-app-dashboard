"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { Plus, Search, User, Phone, Mail, MapPin, IndianRupee, History, Edit, Trash2, Eye, ExternalLink } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
    Authorization: `Bearer ${Cookies.get("auth_token")}`,
    "Content-Type": "application/json",
});

export default function VendorManagementPage() {
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState<any>(null);

    // Delete confirmation — shows exactly what will be removed and requires the
    // vendor's name to be typed, since the delete is permanent and cascades.
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [deletePreview, setDeletePreview] = useState<any>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [deleting, setDeleting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        address: ""
    });

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) setVendors(data.vendors);
        } catch (err) {
            toast.error("Failed to load vendors");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVendors();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingVendor 
                ? `${API_BASE}/api/outlet/vendors/${editingVendor.id}`
                : `${API_BASE}/api/outlet/vendors`;
            const method = editingVendor ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success(editingVendor ? "Vendor updated" : "Vendor created");
                setShowModal(false);
                setEditingVendor(null);
                setFormData({ name: "", phone: "", email: "", address: "" });
                fetchVendors();
            } else {
                toast.error(data.message || "Operation failed");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const openDelete = async (vendor: any) => {
        setDeleteTarget(vendor);
        setDeletePreview(null);
        setDeleteConfirmText("");
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/${vendor.id}/delete-preview`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setDeletePreview(data.data);
            else toast.error(data.message || "Could not load vendor details");
        } catch {
            toast.error("Network error");
        }
    };

    const closeDelete = () => {
        if (deleting) return;
        setDeleteTarget(null);
        setDeletePreview(null);
        setDeleteConfirmText("");
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/vendors/${deleteTarget.id}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete vendor");
            toast.success(data.message || "Vendor deleted");
            setVendors((prev) => prev.filter((v) => v.id !== deleteTarget.id));
            setDeleteTarget(null);
            setDeletePreview(null);
            setDeleteConfirmText("");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete vendor");
        } finally {
            setDeleting(false);
        }
    };

    const nameMatches = !!deleteTarget && deleteConfirmText.trim().toLowerCase() === String(deleteTarget.name).trim().toLowerCase();

    const filteredVendors = vendors.filter(v => 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.phone?.includes(searchTerm)
    );

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Vendor Management" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <User className="text-primary" /> Suppliers & Vendors
                    </h1>
                    <p className="text-sm text-gray-400 mt-1 font-bold">Manage accounts, track balances and view payment history</p>
                </div>
                <button 
                    onClick={() => { setEditingVendor(null); setShowModal(true); setFormData({ name: "", phone: "", email: "", address: "" }); }}
                    className="bg-primary hover:bg-opacity-90 text-white px-6 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 shadow-lg transition-all active:scale-95"
                >
                    <Plus size={18} /> Add New Vendor
                </button>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by vendor name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-3.5 rounded-2xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark outline-none focus:border-primary shadow-sm font-bold text-sm transition-all"
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-200 dark:bg-meta-4 rounded-3xl" />)}
                </div>
            ) : filteredVendors.length === 0 ? (
                <div className="bg-white dark:bg-boxdark p-20 rounded-3xl border border-stroke dark:border-strokedark text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-meta-4 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User size={30} className="text-gray-300" />
                    </div>
                    <h3 className="font-black text-lg text-gray-800 dark:text-white">No Vendors Found</h3>
                    <p className="text-sm text-gray-400 mt-1">Start by adding your first supplier to track inventory sourcing.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredVendors.map((vendor) => (
                        <div key={vendor.id} className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark shadow-sm hover:shadow-md transition-all overflow-hidden group">
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-black group-hover:scale-110 transition-transform">
                                        {vendor.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => { setEditingVendor(vendor); setFormData({ name: vendor.name, phone: vendor.phone || "", email: vendor.email || "", address: vendor.address || "" }); setShowModal(true); }}
                                            className="p-2 text-gray-400 hover:text-primary transition-colors"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => openDelete(vendor)}
                                            title="Delete vendor"
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="font-black text-gray-800 dark:text-white group-hover:text-primary transition-colors truncate">{vendor.name}</h3>
                                
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                        <Phone size={12} /> {vendor.phone || "No phone"}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                        <MapPin size={12} /> {vendor.address || "No address"}
                                    </div>
                                </div>

                                <div className="mt-6 pt-6 border-t border-stroke dark:border-strokedark flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Balance Owed</div>
                                        <div className={`text-lg font-black tabular-nums ${vendor.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            PKR {vendor.balance.toLocaleString()}
                                        </div>
                                    </div>
                                    <Link 
                                        href={`/outlet/vendors/ledger/${vendor.id}`}
                                        className="p-3 bg-gray-50 dark:bg-meta-4 rounded-xl text-gray-500 hover:text-primary hover:bg-primary/10 transition-all flex items-center gap-2 group/btn"
                                    >
                                        <History size={18} className="transition-transform group-hover/btn:rotate-12" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Ledger</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* DELETE CONFIRMATION */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeDelete}>
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-800 dark:text-white">Delete vendor permanently?</h3>
                                <p className="text-xs font-bold text-gray-400">{deleteTarget.name}</p>
                            </div>
                        </div>

                        {!deletePreview ? (
                            <p className="text-sm text-gray-500">Loading details…</p>
                        ) : (
                            <>
                                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                                    This deletes the vendor <strong>and its entire history</strong>. It cannot be undone.
                                </p>
                                <ul className="mb-4 space-y-1 rounded-2xl bg-gray-50 p-4 text-sm font-bold text-gray-700 dark:bg-meta-4 dark:text-gray-200">
                                    <li>Balance owed: <span className="text-red-500">PKR {Number(deletePreview.vendor?.balance || 0).toLocaleString()}</span></li>
                                    <li>{deletePreview.purchases} purchase(s) with their items</li>
                                    <li>{deletePreview.payments} payment(s)</li>
                                    <li>{deletePreview.returns} purchase return(s)</li>
                                    <li>{deletePreview.cash_transactions} cash transaction(s)</li>
                                    <li>{deletePreview.scheduled_payments} scheduled payment(s)</li>
                                </ul>
                                <p className="mb-4 text-xs text-gray-400">
                                    Stock items that came in through these purchases stay in inventory (they may already be sold or delivered).
                                    Past reports and totals that included this vendor will change.
                                </p>
                                <label className="mb-1 block text-xs font-black uppercase tracking-widest text-gray-500">
                                    Type the vendor name to confirm
                                </label>
                                <input
                                    autoFocus
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder={deleteTarget.name}
                                    className="mb-5 w-full rounded-2xl border border-stroke bg-transparent px-4 py-3 text-sm font-bold outline-none focus:border-red-500 dark:border-strokedark"
                                />
                            </>
                        )}

                        <div className="flex gap-3">
                            <button onClick={closeDelete} disabled={deleting} className="flex-1 rounded-2xl px-6 py-3 text-sm font-black text-gray-500 transition-all hover:bg-gray-100 disabled:opacity-50">
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={!deletePreview || !nameMatches || deleting}
                                className="flex-1 rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {deleting ? "Deleting…" : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-boxdark w-full max-w-md rounded-3xl shadow-2xl animate-fade-in overflow-hidden">
                        <div className="p-6 border-b border-stroke dark:border-strokedark flex items-center justify-between">
                            <h2 className="text-xl font-black text-gray-800 dark:text-white">
                                {editingVendor ? "Edit Vendor" : "Add New Supplier"}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 rotate-0 hover:rotate-90 transition-all">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Full Name / Company *</label>
                                <input 
                                    type="text" required
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="Enter vendor name..."
                                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                                    <input 
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        placeholder="0300..."
                                        className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                                    <input 
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        placeholder="optional..."
                                        className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Address</label>
                                <textarea 
                                    rows={2}
                                    value={formData.address}
                                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                                    placeholder="Street, Area, City..."
                                    className="w-full px-5 py-3 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark outline-none focus:border-primary text-sm font-medium"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 rounded-2xl text-sm font-black text-gray-500 hover:bg-gray-100 transition-all font-bold">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-2xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm">
                                    {editingVendor ? "Save Changes" : "Create Vendor"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
