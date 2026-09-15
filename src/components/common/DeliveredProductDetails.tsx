import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { PaymentDetailsSection } from "./PaymentDetailsSection";
import { cn } from '@/lib/utils';
import { MediaCard } from "./MediaCard";
import toast from "react-hot-toast";
import { useAuth } from "../../../contexts/AuthContext";
import { formatExactDate } from "@/utils/dateUtils";
import { Modal } from "@/components/Modal/Modal";

const LabeledInput = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
    <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white transition focus:border-primary"
        />
    </div>
);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const formatDateTimeUTC = (value?: string): string => {
    if (!value) return "Not set";
    return formatExactDate(value, "MMM D, YYYY h:mm A");
};

const toDateTimeLocalValue = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// DeliveryPhotoCard Component - Now replaced by shared MediaCard

export default function DeliveredProductDetails({ 
    orderId, 
    editHistory = [],
    onRefresh
}: { 
    orderId: string | number,
    editHistory?: any[],
    onRefresh?: () => Promise<void> | void
}) {
    const [deliveredProduct, setDeliveredProduct] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedInstallments, setExpandedInstallments] = useState(true);
    const { user } = useAuth();

    const [editingProduct, setEditingProduct] = useState(false);
    const [productForm, setProductForm] = useState({ product_name: '', imei_serial: '', total_amount: '', advance_amount: '', monthly_amount: '', months: '' });
    const [savingProduct, setSavingProduct] = useState(false);
    const [outletInventory, setOutletInventory] = useState<{ id: number; product_name: string; imei_serial: string | null; color_variant: string | null; installment_price: number }[]>([]);
    const [selectedInventoryId, setSelectedInventoryId] = useState<string>('__custom__');
    const [inventorySearch, setInventorySearch] = useState('');
    // No outlet resolved for this order (order.outlet_id is null and no
    // stock unit's IMEI matched one either — see getDeliveredProductDetails'
    // resolvedOutletId fallback) — nothing to browse until one is connected.
    const [outletsForConnect, setOutletsForConnect] = useState<{ id: number; name: string; code: string }[]>([]);
    const [connectOutletId, setConnectOutletId] = useState('');
    const [connectingOutlet, setConnectingOutlet] = useState(false);

    const [editingDelivery, setEditingDelivery] = useState(false);
    const [deliveryForm, setDeliveryForm] = useState({ feedback: '', verified: false, self_pickup: false, delivery_agent_id: '', end_time: '' });
    const [savingDelivery, setSavingDelivery] = useState(false);
    const [deliveryOfficers, setDeliveryOfficers] = useState<{ id: number; full_name: string; username: string }[]>([]);

    const [addPhotoOpen, setAddPhotoOpen] = useState(false);
    const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
    const [savingNewPhoto, setSavingNewPhoto] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchDeliveredProductDetails();
        }
    }, [orderId]);

    const handleReplaceMedia = async (file: File, uploadId: number) => {
        const token = Cookies.get('auth_token');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${BACKEND_URL}/api/delivery/upload/${uploadId}/replace`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error('Replacement failed');
            toast.success('Delivery upload replaced successfully');
            await fetchDeliveredProductDetails();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to replace media');
        }
    };

    const handleDeleteUpload = async (uploadId: number) => {
        const token = Cookies.get('auth_token');
        const res = await fetch(`${BACKEND_URL}/api/delivery/upload/${uploadId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to delete upload');
        toast.success('Delivery upload deleted');
        await fetchDeliveredProductDetails();
        if (onRefresh) await onRefresh();
    };

    const openEditProduct = async () => {
        setProductForm({
            product_name: deliveredProduct.product_details?.product_name || '',
            imei_serial: deliveredProduct.product_details?.imei_serial || '',
            total_amount: deliveredProduct.product_details?.total_amount != null ? String(deliveredProduct.product_details.total_amount) : '',
            advance_amount: deliveredProduct.product_details?.advance_amount != null ? String(deliveredProduct.product_details.advance_amount) : '',
            monthly_amount: deliveredProduct.product_details?.monthly_amount != null ? String(deliveredProduct.product_details.monthly_amount) : '',
            months: deliveredProduct.product_details?.months != null ? String(deliveredProduct.product_details.months) : '',
        });
        setSelectedInventoryId('__custom__');
        setEditingProduct(true);

        const outletId = deliveredProduct.order_info?.outlet_id;
        if (outletId) {
            await fetchOutletInventoryFor(outletId);
        } else {
            setConnectOutletId('');
            try {
                const token = Cookies.get('auth_token');
                const res = await fetch(`${BACKEND_URL}/api/outlets`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const json = await res.json();
                if (json.success && Array.isArray(json.outlets)) setOutletsForConnect(json.outlets);
            } catch (err) {
                console.error('Error fetching outlets:', err);
            }
        }
    };

    const fetchOutletInventoryFor = async (outletId: number) => {
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/outlet/inventory/picker?outlet_id=${outletId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) setOutletInventory(json.data);
        } catch (err) {
            console.error('Error fetching outlet inventory:', err);
        }
    };

    const handleConnectOutlet = async () => {
        if (!connectOutletId) return;
        const token = Cookies.get('auth_token');
        setConnectingOutlet(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/orders/${deliveredProduct.order_info.id}/update-item`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ outlet_id: connectOutletId }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to connect outlet');
            toast.success('Outlet connected — loading its stock...');
            await fetchOutletInventoryFor(parseInt(connectOutletId, 10));
            await fetchDeliveredProductDetails();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to connect outlet');
        } finally {
            setConnectingOutlet(false);
        }
    };

    const handlePickInventoryItem = (idValue: string) => {
        setSelectedInventoryId(idValue);
        if (idValue === '__custom__') return;
        const item = outletInventory.find((i) => String(i.id) === idValue);
        if (item) {
            setProductForm((f) => ({
                ...f,
                product_name: item.product_name,
                imei_serial: item.imei_serial || '',
            }));
        }
    };

    const handleSaveProduct = async () => {
        const token = Cookies.get('auth_token');
        setSavingProduct(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/orders/${deliveredProduct.order_info.id}/update-item`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(productForm),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save changes');
            toast.success('Product & pricing details updated');
            setEditingProduct(false);
            await fetchDeliveredProductDetails();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save changes');
        } finally {
            setSavingProduct(false);
        }
    };

    const openEditDelivery = async () => {
        setDeliveryForm({
            feedback: deliveredProduct.delivery_details?.feedback || '',
            verified: !!deliveredProduct.delivery_details?.verified,
            self_pickup: !!deliveredProduct.delivery_details?.self_pickup,
            delivery_agent_id: deliveredProduct.delivery_details?.delivery_agent_id != null ? String(deliveredProduct.delivery_details.delivery_agent_id) : '',
            end_time: toDateTimeLocalValue(deliveredProduct.delivery_details?.end_time),
        });
        setEditingDelivery(true);
        if (deliveryOfficers.length === 0) {
            try {
                const token = Cookies.get('auth_token');
                const res = await fetch(`${BACKEND_URL}/api/assignments/officers?role=delivery&all=true&include_admins=true`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) setDeliveryOfficers(json.data);
            } catch (err) {
                console.error('Error fetching delivery officers:', err);
            }
        }
    };

    const handleSaveDelivery = async () => {
        const token = Cookies.get('auth_token');
        setSavingDelivery(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/delivery/${deliveredProduct.delivery_details.id}/details`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    ...deliveryForm,
                    end_time: deliveryForm.end_time ? new Date(deliveryForm.end_time).toISOString() : null,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save changes');
            toast.success('Delivery details updated');
            setEditingDelivery(false);
            await fetchDeliveredProductDetails();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save changes');
        } finally {
            setSavingDelivery(false);
        }
    };

    const handleAddPhoto = async () => {
        if (!newPhotoFile || !deliveredProduct.delivery_details?.id) return;
        const token = Cookies.get('auth_token');
        const formData = new FormData();
        formData.append('photos', newPhotoFile);
        formData.append('upload_type', 'face_photo');
        setSavingNewPhoto(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/delivery/${deliveredProduct.delivery_details.id}/upload-manual`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to add photo');
            toast.success('Delivery photo added');
            setAddPhotoOpen(false);
            setNewPhotoFile(null);
            await fetchDeliveredProductDetails();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to add photo');
        } finally {
            setSavingNewPhoto(false);
        }
    };

    const fetchDeliveredProductDetails = async () => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/delivered-product/order/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setDeliveredProduct(json.data);
            } else {
                setError(json.error?.message || 'Failed to fetch delivered product details');
            }
        } catch (err: any) {
            console.error('Error fetching delivered product:', err);
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-8">
                <div className="flex items-center justify-center space-x-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="text-gray-600 dark:text-gray-400">Loading delivered product details...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/10 p-6">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <h3 className="font-semibold text-red-800 dark:text-red-400">Unable to load delivered product details</h3>
                        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!deliveredProduct) return null;

    const isReturned = deliveredProduct.order_info?.status?.toLowerCase() === 'returned';
    // Once a ledger exists, the Pricing Plan/Payment Details cards below
    // read their numbers from IT, not these Order fields — so saving a
    // Total Amount that doesn't match Advance + Monthly x Months here would
    // just get silently recomputed by the backend to keep the two in sync.
    // Show that live instead of letting the admin type a number that won't
    // actually stick.
    const productEditLedgerId = deliveredProduct.payment_details?.installment_plan?.ledger_id;
    const computedTotalAmount = (parseFloat(productForm.advance_amount) || 0) + (parseFloat(productForm.monthly_amount) || 0) * (parseInt(productForm.months, 10) || 0);

    // Helper function to get delivery agent name
    const getDeliveryAgentName = () => {
        // First check if we have delivery agent details from API
        if (deliveredProduct.delivery_details?.delivery_agent_name) {
            return deliveredProduct.delivery_details.delivery_agent_name;
        }
        // Fallback to ID if name not available
        if (deliveredProduct.delivery_details?.delivery_agent_id) {
            return `Agent ID: ${deliveredProduct.delivery_details.delivery_agent_id}`;
        }
        return 'N/A';
    };

    return (
        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800">
            {/* Header */}
            <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            isReturned ? "bg-orange-100 dark:bg-orange-900/30" : "bg-green-100 dark:bg-green-900/30"
                        )}>
                            <svg className={cn("h-5 w-5", isReturned ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </span>
                        <h2 className="text-xl font-bold text-dark dark:text-white">
                            {isReturned ? 'Delivered & Returned Product Details' : 'Delivered Product Details'}
                        </h2>
                    </div>
                    {deliveredProduct.order_info?.delivered_at && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {isReturned ? 'Returned on' : 'Delivered on'}: {formatDateTimeUTC(deliveredProduct.order_info.delivered_at)}
                        </span>
                    )}
                </div>
            </div>

            <div className="p-6">
                {/* Order Reference */}
                <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Order Reference</p>
                            <p className="text-lg font-semibold text-dark dark:text-white">{deliveredProduct.order_info?.order_ref}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Token: {deliveredProduct.order_info?.token_number}</p>
                        </div>
                    </div>
                </div>

                {/* Product Information Section */}
                <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
                            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            Product Information
                        </h3>
                        {user?.role === 'Super Admin' && !editingProduct && (
                            <button onClick={openEditProduct} className="text-xs font-bold text-primary hover:underline">Edit</button>
                        )}
                    </div>
                    {editingProduct && !deliveredProduct.order_info?.outlet_id ? (
                        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                This order isn't connected to any outlet, so there's no stock to pick a product from. Connect an outlet first — the product picker will appear right after.
                            </p>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Outlet</label>
                                <select
                                    value={connectOutletId}
                                    onChange={(e) => setConnectOutletId(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                >
                                    <option value="">-- Select Outlet --</option>
                                    {outletsForConnect.map((o) => (
                                        <option key={o.id} value={o.id}>{o.name} ({o.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleConnectOutlet}
                                    disabled={!connectOutletId || connectingOutlet}
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                >
                                    {connectingOutlet ? 'Connecting...' : 'Connect Outlet'}
                                </button>
                                <button onClick={() => setEditingProduct(false)} disabled={connectingOutlet} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : editingProduct ? (
                        <div className="space-y-4 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3">
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                {productEditLedgerId
                                    ? 'Note: Advance/Monthly/Months corrections here also update the pending (unpaid) months in the ledger below — already-paid months are never touched. Total Amount is auto-calculated.'
                                    : 'Note: changing these does not update the installment ledger below — edit the ledger separately if it also needs correcting.'}
                            </p>
                            {outletInventory.length > 0 && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Pick From Outlet Stock (optional — auto-fills Product Name &amp; IMEI/Serial)</label>
                                    <input
                                        type="text"
                                        value={inventorySearch}
                                        onChange={(e) => setInventorySearch(e.target.value)}
                                        placeholder="Search stock by name, IMEI, color..."
                                        className="mt-1 mb-2 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                    />
                                    <select
                                        value={selectedInventoryId}
                                        onChange={(e) => handlePickInventoryItem(e.target.value)}
                                        className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                    >
                                        <option value="__custom__">-- Custom / type manually below --</option>
                                        {outletInventory
                                            .filter((item) => {
                                                if (!inventorySearch) return true;
                                                const q = inventorySearch.toLowerCase();
                                                return item.product_name?.toLowerCase().includes(q)
                                                    || item.imei_serial?.toLowerCase().includes(q)
                                                    || item.color_variant?.toLowerCase().includes(q);
                                            })
                                            .map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.product_name}{item.color_variant ? ` (${item.color_variant})` : ''} — {item.imei_serial || 'no IMEI'} — Rs. {item.installment_price?.toLocaleString()}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <LabeledInput label="Product Name" value={productForm.product_name} onChange={(v) => setProductForm((f) => ({ ...f, product_name: v }))} />
                                <LabeledInput label="IMEI / Serial Number" value={productForm.imei_serial} onChange={(v) => setProductForm((f) => ({ ...f, imei_serial: v }))} />
                                {productEditLedgerId ? (
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Total Amount (auto-calculated)</label>
                                        <input
                                            type="number"
                                            value={computedTotalAmount}
                                            disabled
                                            className="mt-1 w-full rounded-lg border border-stroke bg-gray-100 px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2/50 dark:text-white"
                                        />
                                    </div>
                                ) : (
                                    <LabeledInput label="Total Amount" type="number" value={productForm.total_amount} onChange={(v) => setProductForm((f) => ({ ...f, total_amount: v }))} />
                                )}
                                <LabeledInput label="Advance Amount" type="number" value={productForm.advance_amount} onChange={(v) => setProductForm((f) => ({ ...f, advance_amount: v }))} />
                                <LabeledInput label="Monthly Amount" type="number" value={productForm.monthly_amount} onChange={(v) => setProductForm((f) => ({ ...f, monthly_amount: v }))} />
                                <LabeledInput label="Plan Duration (Months)" type="number" value={productForm.months} onChange={(v) => setProductForm((f) => ({ ...f, months: v }))} />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleSaveProduct} disabled={savingProduct} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                    {savingProduct ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button onClick={() => setEditingProduct(false)} disabled={savingProduct} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Product Name</label>
                                <p className="mt-1 font-semibold text-dark dark:text-white">{deliveredProduct.product_details?.product_name || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">IMEI / Serial Number</label>
                                <p className="mt-1 font-mono text-sm text-dark dark:text-white">{deliveredProduct.product_details?.imei_serial || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Color Variant</label>
                                <p className="mt-1 text-dark dark:text-white">{deliveredProduct.product_details?.color_variant || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Category</label>
                                <p className="mt-1 text-dark dark:text-white">{deliveredProduct.product_details?.category || 'N/A'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Plan Details Section */}
                {!editingProduct && (deliveredProduct.product_details?.total_amount || deliveredProduct.product_details?.months) && (
                    <div className="mb-6">
                        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
                            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pricing Plan
                        </h3>
                        <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3 md:grid-cols-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Total Amount</label>
                                <p className="mt-1 text-lg font-bold text-primary">Rs. {deliveredProduct.product_details?.total_amount?.toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Advance Amount</label>
                                <p className="mt-1 font-semibold text-dark dark:text-white">Rs. {deliveredProduct.product_details?.advance_amount?.toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Monthly Amount</label>
                                <p className="mt-1 font-semibold text-dark dark:text-white">Rs. {deliveredProduct.product_details?.monthly_amount?.toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Plan Duration</label>
                                <p className="mt-1 font-semibold text-dark dark:text-white">{deliveredProduct.product_details?.months} Months</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delivery Information Section - Updated with Agent Name */}
                {deliveredProduct.delivery_details && (
                    <div className="mb-6">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
                                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 21h6M12 15v6" />
                                </svg>
                                Delivery Information
                            </h3>
                            {user?.role === 'Super Admin' && !editingDelivery && (
                                <button onClick={openEditDelivery} className="text-xs font-bold text-primary hover:underline">Edit</button>
                            )}
                        </div>
                        {editingDelivery ? (
                            <div className="space-y-4 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Feedback</label>
                                        <input
                                            type="text"
                                            value={deliveryForm.feedback}
                                            onChange={(e) => setDeliveryForm((f) => ({ ...f, feedback: e.target.value }))}
                                            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white transition focus:border-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Agent</label>
                                        <select
                                            value={deliveryForm.delivery_agent_id}
                                            onChange={(e) => setDeliveryForm((f) => ({ ...f, delivery_agent_id: e.target.value }))}
                                            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                                        >
                                            <option value="">-- Select --</option>
                                            {deliveredProduct.delivery_details.delivery_agent_id && !deliveryOfficers.some((o) => o.id === deliveredProduct.delivery_details.delivery_agent_id) && (
                                                <option value={deliveredProduct.delivery_details.delivery_agent_id}>{getDeliveryAgentName()}</option>
                                            )}
                                            {deliveryOfficers.map((o) => (
                                                <option key={o.id} value={o.id}>{o.full_name} ({o.username})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Date & Time</label>
                                        <input
                                            type="datetime-local"
                                            value={deliveryForm.end_time}
                                            onChange={(e) => setDeliveryForm((f) => ({ ...f, end_time: e.target.value }))}
                                            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white transition focus:border-primary"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm text-dark dark:text-white">
                                        <input type="checkbox" checked={deliveryForm.verified} onChange={(e) => setDeliveryForm((f) => ({ ...f, verified: e.target.checked }))} />
                                        Verified
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-dark dark:text-white">
                                        <input type="checkbox" checked={deliveryForm.self_pickup} onChange={(e) => setDeliveryForm((f) => ({ ...f, self_pickup: e.target.checked }))} />
                                        Self Pickup
                                    </label>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleSaveDelivery} disabled={savingDelivery} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                        {savingDelivery ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button onClick={() => setEditingDelivery(false)} disabled={savingDelivery} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke bg-gray-50 p-4 dark:border-dark-3 dark:bg-dark-3 md:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Status</label>
                                    <span className={cn(
                                        "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                        deliveredProduct.delivery_details.status === 'completed' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700"
                                    )}>
                                        {deliveredProduct.delivery_details.status}
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Feedback</label>
                                    <p className="mt-1 text-dark dark:text-white">{deliveredProduct.delivery_details.feedback || 'No feedback provided'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Verified</label>
                                    <p className="mt-1 text-dark dark:text-white">{deliveredProduct.delivery_details.verified ? 'Yes ✓' : 'No ✗'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Self Pickup</label>
                                    <p className="mt-1 text-dark dark:text-white">{deliveredProduct.delivery_details.self_pickup ? 'Yes' : 'No'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Agent</label>
                                    <p className="mt-1 font-semibold text-primary dark:text-primary">
                                        {getDeliveryAgentName()}
                                    </p>
                                </div>
                                {deliveredProduct.delivery_details.end_time && (
                                    <div className="md:col-span-2 lg:col-span-4">
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Date & Time</label>
                                        <p className="mt-1 text-dark dark:text-white">{formatDateTimeUTC(deliveredProduct.delivery_details.end_time)}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Delivery Uploads Section */}
                {deliveredProduct.delivery_details && (
                    <div className="mb-6">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
                                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Delivery Uploads
                            </h3>
                            {user?.role === 'Super Admin' && (
                                <button onClick={() => setAddPhotoOpen(true)} className="text-xs font-bold text-primary hover:underline">
                                    + Add Photo
                                </button>
                            )}
                        </div>
                        {deliveredProduct.delivery_details.uploads && deliveredProduct.delivery_details.uploads.length > 0 ? (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {deliveredProduct.delivery_details.uploads.map((upload: any, idx: number) => (
                                    <MediaCard
                                        key={upload.id || idx}
                                        id={upload.id}
                                        title={`Delivery Upload #${idx + 1}`}
                                        subtitle={upload.upload_type?.replace(/_/g, ' ')}
                                        fileUrl={upload.file_url}
                                        uploadedAt={upload.uploaded_at}
                                        isEditable={user?.role === 'Super Admin'}
                                        onEdit={(file) => handleReplaceMedia(file, upload.id)}
                                        onDelete={user?.role === 'Super Admin' ? () => handleDeleteUpload(upload.id) : undefined}
                                        editHistory={editHistory}
                                        historyFilter={(h) => h.entity_type === 'delivery_upload' && h.entity_id === upload.id}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">No delivery photos on record yet.</p>
                        )}
                    </div>
                )}

                <Modal open={addPhotoOpen} onClose={() => setAddPhotoOpen(false)}>
                    <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                        <h2 className="mb-4 text-lg font-bold dark:text-white">Add Delivery Photo</h2>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setNewPhotoFile(e.target.files?.[0] || null)}
                            className="mb-4 w-full text-sm text-gray-600 dark:text-gray-300"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => { setAddPhotoOpen(false); setNewPhotoFile(null); }} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300">
                                Cancel
                            </button>
                            <button onClick={handleAddPhoto} disabled={savingNewPhoto || !newPhotoFile} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                {savingNewPhoto ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* Payment Details Section */}
                <PaymentDetailsSection
                    paymentDetails={deliveredProduct.payment_details}
                    title={deliveredProduct.archived_deliveries?.length > 0 ? "Payment Details (New Product After Exchange)" : "Payment Details (Current Delivery)"}
                    editable={user?.role === 'Super Admin'}
                    orderId={deliveredProduct.order_info?.id}
                    onSaved={fetchDeliveredProductDetails}
                />

                {/* Return / Archived Delivery History */}
                {deliveredProduct.archived_deliveries && deliveredProduct.archived_deliveries.length > 0 && (
                    <div className="mb-6">
                        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
                            <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v1M3 10l4-4M3 10l4 4" />
                            </svg>
                            Returned Delivery History ({deliveredProduct.archived_deliveries.length})
                        </h3>
                        <div className="space-y-4">
                            {deliveredProduct.archived_deliveries.map((ad: any, adIdx: number) => (
                                <div key={ad.id || adIdx} className="rounded-lg border-2 border-orange-200 bg-orange-50/40 p-4 dark:border-orange-900/40 dark:bg-orange-900/5">
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                            Delivered &amp; Returned
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Returned on: {formatDateTimeUTC(ad.archived_at)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-3 md:grid-cols-2 lg:grid-cols-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">IMEI / Serial Number</label>
                                            <p className="mt-1 font-mono text-sm text-dark dark:text-white">{ad.product_imei || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Status</label>
                                            <p className="mt-1 text-dark dark:text-white">{ad.status || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Self Pickup</label>
                                            <p className="mt-1 text-dark dark:text-white">{ad.self_pickup ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivered On</label>
                                            <p className="mt-1 text-dark dark:text-white">{ad.end_time ? formatDateTimeUTC(ad.end_time) : 'N/A'}</p>
                                        </div>
                                        {ad.feedback && (
                                            <div className="md:col-span-2 lg:col-span-4">
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Delivery Feedback</label>
                                                <p className="mt-1 text-dark dark:text-white">{ad.feedback}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <h4 className="mb-3 text-sm font-medium text-dark dark:text-white">Product Information</h4>
                                        <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-3 md:grid-cols-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Product Name</label>
                                                <p className="mt-1 font-semibold text-dark dark:text-white">{ad.product_details?.product_name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Color Variant</label>
                                                <p className="mt-1 text-dark dark:text-white">{ad.product_details?.color_variant || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Category</label>
                                                <p className="mt-1 text-dark dark:text-white">{ad.product_details?.category || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <h4 className="mb-3 text-sm font-medium text-dark dark:text-white">Pricing Plan</h4>
                                        <div className="grid grid-cols-1 gap-4 rounded-lg border border-stroke bg-white p-4 dark:border-dark-3 dark:bg-dark-3 md:grid-cols-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Total Amount</label>
                                                <p className="mt-1 font-bold text-primary">{ad.product_details?.total_amount != null ? `Rs. ${ad.product_details.total_amount.toLocaleString()}` : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Advance Amount</label>
                                                <p className="mt-1 font-semibold text-dark dark:text-white">{ad.product_details?.advance_amount != null ? `Rs. ${ad.product_details.advance_amount.toLocaleString()}` : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Monthly Amount</label>
                                                <p className="mt-1 font-semibold text-dark dark:text-white">{ad.product_details?.monthly_amount != null ? `Rs. ${ad.product_details.monthly_amount.toLocaleString()}` : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Plan Duration</label>
                                                <p className="mt-1 font-semibold text-dark dark:text-white">{ad.product_details?.months != null ? `${ad.product_details.months} Months` : 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {ad.uploads && ad.uploads.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="mb-3 text-sm font-medium text-dark dark:text-white">Delivery Uploads</h4>
                                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                                {ad.uploads.map((upload: any, idx: number) => (
                                                    <MediaCard
                                                        key={upload.id || idx}
                                                        id={upload.id}
                                                        title={`Delivery Upload #${idx + 1}`}
                                                        subtitle={upload.upload_type?.replace(/_/g, ' ')}
                                                        fileUrl={upload.file_url}
                                                        uploadedAt={upload.uploaded_at}
                                                        isEditable={false}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {ad.payment_details && (
                                        <div className="mt-4">
                                            {ad.payment_details.installment_plan && (
                                                <p className="mb-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 dark:border-orange-900/40 dark:bg-orange-900/10 dark:text-orange-300">
                                                    Installments stopped when this order was returned on {formatDateTimeUTC(ad.archived_at)} — any months due after that date were never collected and won't accrue further arrears.
                                                </p>
                                            )}
                                            <PaymentDetailsSection
                                                paymentDetails={ad.payment_details}
                                                title="Payment Details (Cleared due to Return)"
                                                returned
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* No Data Message */}
                {!deliveredProduct.product_details && !deliveredProduct.delivery_details && !deliveredProduct.payment_details && (!deliveredProduct.archived_deliveries || deliveredProduct.archived_deliveries.length === 0) && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center dark:border-yellow-800 dark:bg-yellow-900/10">
                        <p className="text-yellow-800 dark:text-yellow-400">No delivered product details available for this order.</p>
                    </div>
                )}
            </div>
        </div>
    );
};