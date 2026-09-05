"use client";

import { useEffect, useState, use, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from 'js-cookie';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/Modal/Modal';
import Loader from '@/components/common/Loader';
import toast from "react-hot-toast";
import { useAuth } from '../../../../../contexts/AuthContext';
import DeliveredProductDetails from '@/components/common/DeliveredProductDetails';
import RecoveryVisitDetails from '@/components/common/RecoveryVisitDetails';
import { MediaCard } from '@/components/common/MediaCard';
import { formatExactDate } from "@/utils/dateUtils";
import LinkedAccountsBadge from '@/components/common/LinkedAccountsBadge';
import EditTimelineDatesModal from '@/components/Orders/EditTimelineDatesModal';
import { Ban, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// --- Editable Field Component ---
const EditableField = ({
    label,
    value,
    fieldName,
    entityType,
    entityId,
    onSave,
    className = "",
    editHistory = []
}: {
    label: string;
    value: any;
    fieldName: string;
    entityType: 'purchaser' | 'grantor';
    entityId: number;
    onSave: (fieldName: string, newValue: string, entityType: string, entityId: number) => Promise<void>;
    className?: string;
    editHistory?: any[]
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [inputValue, setInputValue] = useState(value || '')
    const [isSaving, setIsSaving] = useState(false)
    const [showHistory, setShowHistory] = useState(false)

    const fieldHistory = editHistory.filter(h => h.field_name === fieldName).sort((a, b) =>
        new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime()
    )

    const handleSave = async () => {
        if (inputValue === value) {
            setIsEditing(false)
            return
        }

        setIsSaving(true)
        try {
            await onSave(fieldName, inputValue, entityType, entityId)
            setIsEditing(false)
            toast.success(`${label} updated successfully`)
        } catch (error) {
            console.error('Save error:', error)
            toast.error('Failed to save changes')
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setInputValue(value || '')
        setIsEditing(false)
    }

    if (!shouldDisplay(value) && !isEditing) return null

    return (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                {label}
            </label>

            {isEditing ? (
                <div className="mt-1">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 p-2 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        rows={3}
                        disabled={isSaving}
                        placeholder={`Enter ${label.toLowerCase()}...`}
                    />
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:bg-gray-400"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="rounded bg-gray-500 px-3 py-1 text-xs text-white hover:bg-gray-600 disabled:bg-gray-400"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className="mt-1 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-2 transition-colors group relative"
                    onClick={() => setIsEditing(true)}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex-1 whitespace-pre-wrap">
                            {value}
                        </div>
                        <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                            Click to edit
                        </span>
                    </div>

                    {fieldHistory.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowHistory(!showHistory)
                            }}
                            className="mt-1 text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                        >
                            <span>📋 {fieldHistory.length} edit{fieldHistory.length > 1 ? 's' : ''}</span>
                        </button>
                    )}

                    {showHistory && fieldHistory.length > 0 && (
                        <div className="absolute z-10 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
                            <div className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
                                Edit History
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {fieldHistory.map((history: any) => (
                                    <div key={history.id} className="text-xs border-b border-gray-100 dark:border-gray-700 pb-2">
                                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                            <span className="font-medium">{history.edited_by_name}</span>
                                            <span>{formatExactDate(history.edited_at)}</span>
                                        </div>
                                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                                            <span className="line-through text-red-500">{history.old_value || '(empty)'}</span>
                                            <span className="mx-1">→</span>
                                            <span className="text-green-500">{history.new_value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Reusable Media Components have been moved to shared components directory.

// LocationPhotoCard Component - Now replaced by shared MediaCard

// --- Verification Data Types (copied from verification page) ---
interface VerificationReview {
    id: number;
    approved: boolean;
    remarks: string | null;
    created_at: string;
    reviewer: {
        full_name: string;
        username: string;
    };
}

interface VerificationData {
    id: number;
    order_id: number;
    verification_officer_id: number;
    status: string;
    start_time: string;
    end_time: string | null;
    created_at: string;
    updated_at: string;
    order: {
        id: number;
        order_ref: string;
        status: string;
    };
    verification_officer: {
        full_name: string;
        username: string;
    };
    verification_feedback: string | 'hello';
    purchaser: any;
    grantors: any[];
    nextOfKin: any;
    locations: any[];
    verification_locations: any[];
    documents: any[];
    reviews: VerificationReview[];
    edit_history?: any[];
    home_location_required: boolean;
    home_location_verified: boolean;
}



const shouldDisplay = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value).length === 0) return false;
    return true;
};
// --- Verification Section Components (Field, Modal, etc.) ---
const Field = ({ label, value, className = "" }: { label: string; value: any; className?: string }) => {
    if (!shouldDisplay(value)) return null;
    const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
    return (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{label}</label>
            <div className="mt-1 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3 dark:text-gray-300">
                {displayValue}
            </div>
        </div>
    );
};
// --- Main Component ---

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface DummyCustomer {
    id: number;
    customer_name: string | null;
    whatsapp_number: string | null;
    alternate_contact?: string | null;
    address: string | null;
    city: string | null;
    area: string | null;
    block?: string | null;
    house_no?: string | null;
    street?: string | null;
    zone?: string | null;
    moved_at: string;
}

interface Order {
    id: number;
    order_ref: string;
    token_number: string;
    customer_name: string;
    whatsapp_number: string;
    alternate_contact?: string | null;
    address: string;
    order_notes?: string | null;
    gender?: string | null;
    residential_type?: string | null;
    assigned_to: { username: string; full_name: string } | null;
    assigned_to_user_id: number;
    zone?: string | null;
    block?: string | null;
    house_no?: string | null;
    street?: string | null;
    city: string | null;
    area: string | null;
    product_name: string;
    total_amount: number;
    advance_amount: number;
    monthly_amount: number;
    months: number;
    channel: string;
    status: string;
    created_at: string;
    cancelled_reason?: string | null;
    postponed_feedback?: string | null;
    cancelled_at?: string | null;
    created_by: { username: string; full_name: string } | null;
    delivery_officer?: { username: string; full_name: string; id: number } | null;
    recovery_officer?: { username: string; full_name: string; id: number } | null;
    delivery_assigned_at?: string | null;
    recovery_assigned_at?: string | null;
    verification_assigned_at?: string | null;
    recovery_visits?: any[];
    recovery_officer_id?: number | null;
    installment_ledger?: { short_id?: string | null } | null;
    productHistories?: {
        id: number;
        previous_product: string;
        current_product: string;
        changed_at: string;
        changed_by: { username: string, full_name: string };
    }[];
    statusHistories?: {
        id: number;
        old_status: string | null;
        new_status: string;
        created_at: string;
        user?: { username: string, full_name: string } | null;
        role_name?: string | null;
    }[];
    complaints?: {
        id: number;
        complaint_id: string;
        description: string;
        status: string;
        resolution_note: string | null;
        created_at: string;
        created_by?: { username: string; full_name: string } | null;
        assigned_to?: { username: string; full_name: string } | null;
    }[];
    verification?: VerificationData | null;
    dummyCustomer?: DummyCustomer | null;
}

export default function OrderDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // --- Verification State ---
    const [verification, setVerification] = useState<VerificationData | null>(null);
    const [verificationLoading, setVerificationLoading] = useState(true);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    // Modal state for home location assignment
    const [modalOpen, setModalOpen] = useState(false);
    const [modalOfficerType, setModalOfficerType] = useState<'vo' | 'do' | null>(null);
    const [locationRequestPending, setLocationRequestPending] = useState(false);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const { user } = useAuth();
    // Fetch verification data for this order
    const fetchVerification = async () => {
        try {
            setVerificationLoading(true);
            setVerificationError(null);
            const token = Cookies.get('auth_token');
            if (!token) throw new Error('Authentication required');
            const res = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok && json.success && json.data?.verification) {
                setVerification(json.data.verification);
            } else if (res.status === 404 || (json.error?.code === 404)) {
                // soft state: no verification yet
                setVerification(null);
                setVerificationError(null);
            } else if (json.success === false && json.error?.message) {
                setVerificationError(json.error.message);
            } else {
                setVerificationError('No verification data found');
            }
        } catch (err: any) {
            setVerificationError(err.message || 'An error occurred');
        } finally {
            setVerificationLoading(false);
        }
    };

    // States for Edit / Cancel
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [newProductName, setNewProductName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [handoverModalOpen, setHandoverModalOpen] = useState(false);
    const [handoverOtp, setHandoverOtp] = useState('');
    const [selectedImei, setSelectedImei] = useState('');
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [otpSent, setOtpSent] = useState(false);

    // Send Ledger state
    const [sendLedgerModalOpen, setSendLedgerModalOpen] = useState(false);
    const [sendLedgerTarget, setSendLedgerTarget] = useState('primary');
    const [isSendingLedger, setIsSendingLedger] = useState(false);

    // Timeline collapse states
    const [isAssignmentTimelineCollapsed, setIsAssignmentTimelineCollapsed] = useState(true);
    const [isStatusTimelineCollapsed, setIsStatusTimelineCollapsed] = useState(true);

    // Edit Timeline Dates modal (legacy import orders)
    const [editTimelineModalOpen, setEditTimelineModalOpen] = useState(false);

    // Product dynamic data
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [subcategories, setSubcategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubcategory, setSelectedSubcategory] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Order not found');
            const json = await res.json();
            if (json.success) setOrder(json.data.order);
            else throw new Error(json.message || 'Failed to fetch order');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchOrder();
            fetchVerification();
        }
    }, [id]);
    // Verification Edit Handlers
    const handleFieldSave = async (fieldName: string, newValue: string, entityType: string, entityId: number) => {
        if (!verification) return;
        const token = Cookies.get('auth_token');
        const url = entityType === 'purchaser' 
            ? `${BACKEND_URL}/api/verification/${verification.id}/purchaser/field`
            : `${BACKEND_URL}/api/verification/${verification.id}/grantor/${entityId}/field`;

        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ field_name: fieldName, new_value: newValue })
        });

        if (!res.ok) throw new Error('Update failed');
        await fetchVerification();
    };

    const handleMediaReplace = async (file: File, documentId: number, documentType: string, personType: string, personId: number | null) => {
        if (!verification) return;
        const token = Cookies.get('auth_token');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_id', String(documentId));
        formData.append('document_type', documentType);
        formData.append('person_type', personType);
        if (personId) formData.append('person_id', String(personId));

        const res = await fetch(`${BACKEND_URL}/api/verification/${verification.id}/media`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        if (!res.ok) throw new Error('Media replacement failed');
        toast.success('Media replaced successfully');
        await fetchVerification();
    };

    const handleLocationMediaReplace = async (file: File, photoId: number) => {
        const token = Cookies.get('auth_token');
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${BACKEND_URL}/api/location-photo/${photoId}/replace`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        if (!res.ok) throw new Error('Location media replacement failed');
        toast.success('Location photo replaced successfully');
        await fetchVerification();
    };

    // Home location assignment action
    const handleLocationAction = async (action: 'send-to-vo' | 'send-to-do', officerId: string) => {
        if (!verification?.id) return;
        const token = Cookies.get('auth_token');
        try {
            const res = await fetch(`${BACKEND_URL}/api/verification/${verification.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ officer_id: officerId })
            });
            if (!res.ok) throw new Error('Failed to assign officer for location capture');
            toast.success(action === 'send-to-vo' ? 'Successfully sent to Verification Officer' : 'Successfully sent to Delivery Officer');
            // Refresh verification data
            await fetchVerification();
        } catch (err: any) {
            toast.error(err.message || 'Error assigning officer');
        }
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const token = Cookies.get('auth_token');
                const res = await fetch(`${BACKEND_URL}/api/products`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.success) {
                        setProducts(json.data);
                        const uniqueCategories = Array.from(new Set(json.data.map((p: any) => p.category_name))) as string[];
                        setCategories(uniqueCategories.sort());
                    }
                }
            } catch (err) {
                console.error('Failed to load products', err);
            }
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        if (selectedCategory) {
            const filteredSubcats = Array.from(new Set(
                products
                    .filter(p => p.category_name === selectedCategory)
                    .map(p => p.subcategory_name)
            )) as string[];
            setSubcategories(filteredSubcats.sort());
            setSelectedSubcategory('');
            setSelectedProduct(null);
            setSelectedPlan(null);
        } else {
            setSubcategories([]);
        }
    }, [selectedCategory, products]);

    const confirmEdit = async () => {
        if (!order || !selectedProduct || !selectedPlan) return;
        setIsSubmitting(true);
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/orders/${order.id}/update-item`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    product_name: selectedProduct.name,
                    advance_amount: selectedPlan.advance,
                    monthly_amount: selectedPlan.monthlyAmount,
                    months: selectedPlan.months,
                    total_amount: selectedPlan.totalPrice
                }),
            });
            if (!res.ok) throw new Error('Update failed');
            await fetchOrder();
            setEditModalOpen(false);
            // Reset selection states
            setSelectedProduct(null);
            setSelectedPlan(null);
            setSelectedCategory('');
            setSelectedSubcategory('');
        } catch (err) {
            alert('Update failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmCancel = async () => {
        if (!order || !cancelReason.trim()) return;
        setIsSubmitting(true);
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/orders/${order.id}/cancel`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ reason: cancelReason }),
            });
            if (!res.ok) throw new Error('Cancellation failed');
            await fetchOrder();
            setCancelModalOpen(false);
        } catch (err) {
            alert('Cancellation failed');
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleSendLedger = async () => {
        if (!order?.installment_ledger?.short_id) return;
        setIsSendingLedger(true);
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/ledger/${order.installment_ledger.short_id}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ targetPhone: sendLedgerTarget }),
            });
            const json = await res.json();
            if (json.success) {
                toast.success('Ledger sent successfully');
                setSendLedgerModalOpen(false);
            } else {
                toast.error(json.message || 'Failed to send ledger');
            }
        } catch (err) {
            toast.error('Failed to send ledger');
        } finally {
            setIsSendingLedger(false);
        }
    };

    if (loading) return <Loader text="Loading order details..." />;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!order) return <div className="p-8 text-center text-gray-500">Order not found.</div>;

    const cancellationHistory = order.statusHistories?.find(h => h.new_status.toLowerCase() === 'cancelled');
    const postponementHistory = order.statusHistories?.find(h => h.new_status.toLowerCase() === 'postponed');

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName={`Order: ${order.order_ref}`} />

            {order.channel === 'Repeat Customer' && (
                <div className="mb-6 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700 border border-emerald-200 shadow-sm animate-bounce-subtle">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812z"></path><path fillRule="evenodd" d="M13.477 7.078a1 1 0 01.022 1.413l-3.5 3.5a1 1 0 01-1.414 0l-1.5-1.5a1 1 0 011.414-1.414L9.25 9.828l2.813-2.812a1 1 0 011.414.062z" clipRule="evenodd"></path></svg>
                        Repeat Customer Verified
                    </span>
                </div>
            )}

            {order.channel === 'legacy_import' && (
                <div className="mb-6 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-800 border border-amber-200 shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Legacy Import — Old Paper-Ledger Record
                    </span>
                </div>
            )}

            <div className="mt-4 flex flex-wrap justify-end gap-3 mb-6 font-medium">
                {order.status !== "delivered" && (
                    <button
                    onClick={() => {
                        setNewProductName(order.product_name);
                        setSelectedCategory('');
                        setSelectedSubcategory('');
                        setSelectedProduct(null);
                        setSelectedPlan(null);
                        setEditModalOpen(true);
                    }}
                    className="rounded-md bg-primary px-6 py-2 text-white hover:bg-opacity-90 shadow-md transition-colors"
                >
                    Edit Item
                </button>
                )}
                {order.status !== "delivered" && order.status !== "cancelled" && order.status !== "rejected" && order.status !== "approved" && (
                <button
                    onClick={() => {
                        setCancelReason('');
                        setCancelModalOpen(true);
                    }}
                    className="rounded-md bg-red-600 px-6 py-2 text-white hover:bg-opacity-90 shadow-md"
                >
                    Cancel Order
                </button>
                )}
                {order.installment_ledger && (
                    <button
                        onClick={() => setSendLedgerModalOpen(true)}
                        className="rounded-md bg-green-600 px-6 py-2 text-white hover:bg-opacity-90 shadow-md transition-colors"
                    >
                        📤 Send Ledger
                    </button>
                )}
                {/* Edit Timeline Dates — only for legacy import orders (Pending Legacy Profiles) */}
                {order.channel === 'legacy_import' && (user?.role === 'Super Admin' || user?.role === 'Admin') && (
                    <button
                        onClick={() => setEditTimelineModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-6 py-2 font-bold text-white hover:bg-amber-600 shadow-md transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Edit Timeline Dates
                    </button>
                )}

                {user?.role === 'Super Admin' && (
                    <button
                        onClick={async () => {
                            if (!confirm(`Move Order #${order.order_ref} to the Recycle Bin? It will disappear from the app but can be restored from the Recycle Bin later.`)) return;
                            const token = Cookies.get('auth_token');
                            try {
                                const res = await fetch(`${API_BASE}/api/admin-panel/orders/${order.id}/permanent-delete`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const json = await res.json();
                                if (json.success) {
                                    toast.success('Order moved to Recycle Bin');
                                    if (window.history.length > 1) {
                                        router.back();
                                    } else {
                                        router.push('/orders');
                                    }
                                } else {
                                    toast.error(json.message || 'Failed to delete order');
                                }
                            } catch (e: any) {
                                console.error(e);
                                toast.error(e.message || 'Error deleting order');
                            }
                        }}
                        className="rounded-md bg-red-700 px-6 py-2 font-bold text-white hover:bg-red-800 shadow-md transition-colors"
                    >
                        Delete Order
                    </button>
                )}

                {/* Mark Blacklist button for authorized roles */}
                {['admin', 'super admin', 'accountant'].includes(user?.role?.toLowerCase() || '') && (
                    ((order as any).is_blacklisted || order.verification?.purchaser?.is_blacklisted || order.verification?.grantors?.some((g: any) => g.is_blacklisted)) ? (
                        <span className="inline-flex items-center gap-2 rounded-md bg-red-100 px-6 py-2 font-bold text-red-600 border border-red-200 shadow-sm">
                            <AlertTriangle className="h-4 w-4" /> Account Blacklisted
                        </span>
                    ) : (
                        <button
                            onClick={async () => {
                                const cnic = order.verification?.purchaser?.cnic_number || (order as any).dummyCustomer?.cnic_number || (order as any).cnic_number || (order as any).cnic;
                                if (!cnic) {
                                    toast.error('No CNIC found for this account — cannot blacklist.');
                                    return;
                                }
                                const reason = window.prompt(`Reason for blacklisting account (${order.customer_name || 'Customer'}):`, '');
                                if (reason === null) return;
                                if (!reason.trim()) {
                                    toast.error('A reason is required to blacklist an account.');
                                    return;
                                }

                                try {
                                    const token = Cookies.get('auth_token');
                                    const res = await fetch(`${API_BASE}/api/accounts/blacklist/action`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                            cnic,
                                            action: 'blacklist',
                                            targetType: 'all',
                                            verificationId: order.verification?.id,
                                            reason: reason.trim()
                                        })
                                    });
                                    const json = await res.json();
                                    if (!res.ok || json.success === false) throw new Error(json.message || 'Failed to blacklist account');

                                    toast.success(json.message || 'Account blacklisted successfully.');
                                    setOrder((prev: any) => prev ? { ...prev, is_blacklisted: true } : prev);
                                    setVerification((prev: any) => prev ? { ...prev, purchaser: { ...prev.purchaser, is_blacklisted: true } } : prev);
                                } catch (e: any) {
                                    console.error(e);
                                    toast.error(e.message || 'Error blacklisting account');
                                }
                            }}
                            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-2 font-bold text-white hover:bg-red-700 shadow-md transition-colors"
                        >
                            <Ban className="h-4 w-4" /> Mark Blacklist
                        </button>
                    )
                )}
            </div>

            {order.dummyCustomer && (
                <div className="mb-8 rounded-xl border-l-4 border-primary bg-white p-6 shadow-md dark:bg-gray-800 animate-fade-in">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Initial Placement Details</h3>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                These are the initial details provided during order placement.
                            </p>
                            
                            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Customer Name</p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">{order.dummyCustomer.customer_name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">WhatsApp Number</p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">{order.dummyCustomer.whatsapp_number || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Alternate Contact</p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">{order.dummyCustomer.alternate_contact || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Captured At</p>
                                    <p className="font-semibold text-gray-900 dark:text-gray-200">{formatExactDate(order.dummyCustomer.moved_at, 'MMM D, YYYY h:mm A')}</p>
                                </div>
                            </div>
                            
                            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
                                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Initial Address</p>
                                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-300">
                                    {order.dummyCustomer.address ? order.dummyCustomer.address : (
                                        [
                                            order.dummyCustomer.house_no,
                                            order.dummyCustomer.street,
                                            order.dummyCustomer.block,
                                            order.dummyCustomer.area,
                                            order.dummyCustomer.city,
                                            order.dummyCustomer.zone
                                        ].filter(Boolean).join(', ') || 'No address details recorded'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Customer Info Card */}
                <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                    <h3 className="text-xl font-bold border-b pb-4 mb-4 dark:text-white">Customer Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                            <p className="font-semibold">{order.customer_name || 'N/A'}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">WhatsApp Number</p>
                            <p className="font-semibold">{order.whatsapp_number || 'N/A'}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Alternate Contact</p>
                            <p className="font-semibold">{order.alternate_contact || 'N/A'}</p>
                        </div>
                        {order.address && order.address.trim() !== '' ? (
                            <div className="sm:col-span-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                                <p className="font-semibold">{order.address}</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">City</p>
                                    <p className="font-semibold">{order.city || 'N/A'}</p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Area</p>
                                    <p className="font-semibold">{order.area || 'N/A'}</p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Zone / Block</p>
                                    <p className="font-semibold">{order.zone || order.block || 'N/A'}</p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">House No / Street</p>
                                    <p className="font-semibold">
                                        {[
                                            order.house_no || null,
                                            order.street || null
                                        ].filter(Boolean).join(', ') || 'N/A'}
                                    </p>
                                </div>
                            </>
                        )}
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Gender</p>
                            <p className="font-semibold">{order.gender || 'N/A'}</p>
                        </div>

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Residential Type</p>
                            <p className="font-semibold">{order.residential_type || 'N/A'}</p>
                        </div>

                        <div className="sm:col-span-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Order Notes</p>
                            <p className="font-semibold whitespace-pre-wrap">{order.order_notes || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Order Info Card */}
                <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                    <h3 className="text-xl font-bold border-b pb-4 mb-4 dark:text-white">Order Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                            <span className={cn(
                                "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase mt-1",
                                order.status === 'cancelled' || order.status === 'expired' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                            )}>
                                {order.status}
                            </span>
                            {user?.role === 'Super Admin' && (
                                <div className="mt-3 flex items-center gap-2">
                                    <select
                                        className="w-full rounded border border-stroke bg-gray-50 px-3 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-700 dark:text-white"
                                        defaultValue=""
                                        onChange={(e) => {
                                            const newStatus = e.target.value;
                                            if (!newStatus) { e.target.value = ""; return; }
                                            setPendingStatus(newStatus);
                                            setStatusModalOpen(true);
                                            e.target.value = "";
                                        }}
                                    >
                                        <option value="" disabled>Change status...</option>
                                        <option value="approved">Approved</option>
                                        <option value="picked">Picked</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Reference Number</p>
                            <p className="font-semibold">{order.order_ref}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Suggested Product Name</p>
                            <p className="font-semibold">{order.product_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
                            <p className="font-semibold">Rs. {order.total_amount.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Advance / Monthly</p>
                            <p className="font-semibold">Rs. {order.advance_amount.toLocaleString()} / Rs. {order.monthly_amount.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
                            <p className="font-semibold">{order.months} Months</p>
                        </div>
                    </div>
                </div>

                {/* Cancellation Info (Spans full width if shown) */}
                {order.status === 'cancelled' && (
                    <div className="lg:col-span-2 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-900/10">
                        <h3 className="text-xl font-bold text-red-800 dark:text-red-400 mb-4">Cancellation Details</h3>
                        <div className="space-y-2">
                            <p><span className="font-medium text-red-700 dark:text-red-300">Reason:</span> {order.cancelled_reason}</p>
                            <p><span className="font-medium text-red-700 dark:text-red-300">Cancelled At:</span> {order.cancelled_at ? formatExactDate(new Date(order.cancelled_at)) : 'N/A'}</p>
                            {cancellationHistory && (
                                <p>
                                    <span className="font-medium text-red-700 dark:text-red-300">Cancelled By:</span> {cancellationHistory.user?.full_name || 'System'} (@{cancellationHistory.user?.username || 'system'}) [{cancellationHistory.role_name || 'N/A'}]
                                </p>
                            )}
                        </div>
                    </div>
                )}
                {order.status === 'postponed' && (
                    <div className="lg:col-span-2 rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900/30 dark:bg-yellow-900/10">
                        <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-400 mb-4">Postponed Details</h3>
                        <div className="space-y-2">
                            <p><span className="font-medium text-yellow-700 dark:text-yellow-300">Reason:</span> {order.postponed_feedback}</p>
                            {postponementHistory && (
                                <>
                                    <p>
                                        <span className="font-medium text-yellow-700 dark:text-yellow-300">Postponed By:</span> {postponementHistory.user?.full_name || 'System'} (@{postponementHistory.user?.username || 'system'}) [{postponementHistory.role_name || 'N/A'}]
                                    </p>
                                    <p>
                                        <span className="font-medium text-yellow-700 dark:text-yellow-300">Postponed At:</span> {formatExactDate(new Date(postponementHistory.created_at))}
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Verification Reviews (Spans full width) */}
                {verification && verification.reviews && verification.reviews.length > 0 && (
                    <div className="lg:col-span-2 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                        <h3 className="text-xl font-bold border-b pb-4 mb-4 dark:text-white flex items-center justify-between">
                            Verification Reviews
                            <span className="text-sm font-medium text-gray-500">
                                {verification.reviews.length} Review(s)
                            </span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {verification.reviews.map((review) => (
                                <div 
                                    key={review.id} 
                                    className={cn(
                                        "p-4 rounded-xl border-2 transition-all",
                                        review.approved 
                                            ? "bg-green-50 border-green-100 dark:bg-green-950/10 dark:border-green-900/30" 
                                            : "bg-red-50 border-red-100 dark:bg-red-950/10 dark:border-red-900/30"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs",
                                                review.approved ? "bg-green-500" : "bg-red-500"
                                            )}>
                                                {review.reviewer?.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 dark:text-white">
                                                    {review.reviewer?.full_name || 'Unknown Reviewer'}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    @{review.reviewer?.username || 'unknown'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                            review.approved 
                                                ? "bg-green-500 text-white" 
                                                : "bg-red-500 text-white"
                                        )}>
                                            {review.approved ? 'Approved' : 'Rejected'}
                                        </span>
                                    </div>
                                    
                                    {review.remarks && (
                                        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mt-2">
                                            <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                                                "{review.remarks}"
                                            </p>
                                        </div>
                                    )}
                                    
                                    <div className="mt-3 text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {formatExactDate(review.created_at)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Product History Card (Spans full width) */}
                {order.productHistories && order.productHistories.length > 0 && (
                    <div className="lg:col-span-2 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                        <h3 className="text-xl font-bold border-b pb-4 mb-4 dark:text-white">Product Name History</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border dark:border-dark-3">
                                <thead className="bg-gray-50 dark:bg-dark-2 uppercase font-medium">
                                    <tr>
                                        <th className="px-4 py-3 border dark:border-dark-3">Previous Product</th>
                                        <th className="px-4 py-3 border dark:border-dark-3">Current Product</th>
                                        <th className="px-4 py-3 border dark:border-dark-3">Changed By</th>
                                        <th className="px-4 py-3 border dark:border-dark-3">Changed At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.productHistories.map((h) => (
                                        <tr key={h.id} className="border-t dark:border-dark-3 hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors">
                                            <td className="px-4 py-3 border dark:border-dark-3 font-medium">{h.previous_product}</td>
                                            <td className="px-4 py-3 border dark:border-dark-3 font-medium text-primary">{h.current_product}</td>
                                            <td className="px-4 py-3 border dark:border-dark-3">{h.changed_by.full_name} (@{h.changed_by.username})</td>
                                            <td className="px-4 py-3 border dark:border-dark-3">{formatExactDate(new Date(h.changed_at))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Assignment Timeline Card (Spans full width) */}
            <div className="mt-8 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold dark:text-white">Assignment Timeline</h3>
                        {order.channel === 'legacy_import' && (user?.role === 'Super Admin' || user?.role === 'Admin') && (
                            <button
                                onClick={() => setEditTimelineModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                title="Edit Assignment Timeline Dates & Events"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit Timeline
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setIsAssignmentTimelineCollapsed(!isAssignmentTimelineCollapsed)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors"
                        title={isAssignmentTimelineCollapsed ? "Expand" : "Collapse"}
                    >
                        <svg
                            className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isAssignmentTimelineCollapsed ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </button>
                </div>

                {!isAssignmentTimelineCollapsed && (
                <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                    {/* Order Creation - Always shown first */}
                    <div className="mb-8 relative">
                        <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-blue-500 dark:border-gray-800 shadow-sm"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm transition-all hover:shadow-md">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="font-bold text-[15px] tracking-wide text-blue-800 dark:text-blue-300 uppercase">
                                        Order Created
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                                            {order.created_by?.full_name?.charAt(0) || 'C'}
                                        </div>
                                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                                            {order.created_by?.full_name || 'System'} (@{order.created_by?.username || 'system'})
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-blue-700 dark:text-blue-400 mt-2 font-medium">
                                    Channel: <span className="font-bold">{order.channel}</span>
                                </div>
                            </div>
                            <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {formatExactDate(order.created_at)}
                            </div>
                        </div>
                    </div>

                    {/* Verification Officer Assignment */}
                    {order.verification_assigned_at && order.assigned_to && (
                        <div className="mb-8 relative">
                            <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-indigo-500 dark:border-gray-800 shadow-sm"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm transition-all hover:shadow-md">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="font-bold text-[15px] tracking-wide text-indigo-800 dark:text-indigo-300 uppercase">
                                            Verification Officer Assigned
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                                                {order.assigned_to?.full_name?.charAt(0) || 'V'}
                                            </div>
                                            <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                                                {order.assigned_to?.full_name} (@{order.assigned_to?.username})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatExactDate(order.verification_assigned_at)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delivery Officer Assignment */}
                    {order.delivery_assigned_at && order.delivery_officer && (
                        <div className="mb-8 relative">
                            <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-green-500 dark:border-gray-800 shadow-sm"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 shadow-sm transition-all hover:shadow-md">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="font-bold text-[15px] tracking-wide text-green-800 dark:text-green-300 uppercase">
                                            Delivery Officer Assigned
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                                                {order.delivery_officer?.full_name?.charAt(0) || 'D'}
                                            </div>
                                            <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                                                {order.delivery_officer?.full_name} (@{order.delivery_officer?.username})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatExactDate(order.delivery_assigned_at)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recovery Officer Assignment */}
                    {order.recovery_assigned_at && order.recovery_officer && (
                        <div className="mb-8 relative">
                            <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-orange-500 dark:border-gray-800 shadow-sm"></div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 shadow-sm transition-all hover:shadow-md">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="font-bold text-[15px] tracking-wide text-orange-800 dark:text-orange-300 uppercase">
                                            Recovery Officer Assigned
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-orange-300">
                                                {order.recovery_officer?.full_name?.charAt(0) || 'R'}
                                            </div>
                                            <span className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                                                {order.recovery_officer?.full_name} (@{order.recovery_officer?.username})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatExactDate(order.recovery_assigned_at)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>

            {/* Order Status History Card (Spans full width) */}
            {order.statusHistories && order.statusHistories.length > 0 && (
                <div className="mt-8 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-6">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold dark:text-white">Order Status Timeline</h3>
                            {order.channel === 'legacy_import' && (user?.role === 'Super Admin' || user?.role === 'Admin') && (
                                <button
                                    onClick={() => setEditTimelineModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                    title="Edit Order Status Timeline Dates & Statuses"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Statuses & Dates
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsStatusTimelineCollapsed(!isStatusTimelineCollapsed)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors"
                            title={isStatusTimelineCollapsed ? "Expand" : "Collapse"}
                        >
                            <svg
                                className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isStatusTimelineCollapsed ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                    </div>

                    {!isStatusTimelineCollapsed && (
                    <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                        {[...(order.statusHistories || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((h) => (
                            <div key={h.id} className="mb-8 relative">
                                <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-primary dark:border-gray-800 shadow-sm"></div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-dark-2 p-4 rounded-xl border border-gray-100 dark:border-dark-3 shadow-sm transition-all hover:shadow-md">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-bold text-[15px] tracking-wide text-gray-800 dark:text-white uppercase">
                                                {h.new_status.replace(/_/g, ' ')}
                                            </span>
                                            {h.old_status && (
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                                    </svg>
                                                    <span className="bg-gray-200 dark:bg-gray-700 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                                        {h.old_status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    {h.user?.full_name?.charAt(0) || 'S'}
                                                </div>
                                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    {h.user ? h.user.full_name : 'System'}
                                                </span>
                                            </div>
                                            {h.role_name && (
                                                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full tracking-wider uppercase">
                                                    {h.role_name}
                                                </span>
                                            )}
                                        </div>
                                        {(h as any).remarks && (
                                            <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 inline-block">
                                                <span className="text-[11px] font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    {(h as any).remarks}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {formatExactDate(h.created_at)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </div>
            )}

            {/* Linked Complaints — complaints a CSR has confirmed belong to this
                customer's order (see /csr/complaints "Link & View"), so this
                order's page becomes their permanent record of it. */}
            {order.complaints && order.complaints.length > 0 && (
                <div className="mt-8 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                    <div className="flex items-center justify-between border-b pb-4 mb-6">
                        <h3 className="text-xl font-bold dark:text-white">Linked Complaints</h3>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{order.complaints.length} total</span>
                    </div>

                    <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                        {order.complaints.map((c) => {
                            const statusColor = c.status === 'Solved'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : c.status === 'Pending'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
                            return (
                                <div key={c.id} className="mb-8 relative">
                                    <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-[#ff3d3d] dark:border-gray-800 shadow-sm"></div>
                                    <div className="bg-gray-50 dark:bg-dark-2 p-4 rounded-xl border border-gray-100 dark:border-dark-3 shadow-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-sm text-gray-800 dark:text-white">{c.complaint_id}</span>
                                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusColor}`}>{c.status}</span>
                                            </div>
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{formatExactDate(c.created_at)}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.description}</p>
                                        {c.resolution_note && (
                                            <div className="mt-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-xs text-green-800 dark:text-green-300 italic">
                                                "{c.resolution_note}"
                                            </div>
                                        )}
                                        {(c.assigned_to || c.created_by) && (
                                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                {c.assigned_to ? `Handled by ${c.assigned_to.full_name}` : `Filed by ${c.created_by?.full_name}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- Verification Section (View + Home Location) --- */}
            <div className="mt-10">
                <h2 className="text-2xl font-bold mb-4 dark:text-white">Verification & Home Location</h2>
                {verificationLoading ? (
                    <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-8">
                        <div className="flex items-center justify-center space-x-3">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                            <span className="text-gray-600 dark:text-gray-400">Loading verification details...</span>
                        </div>
                    </div>
                ) : verificationError ? (
                    <div className="text-red-600 py-8">{verificationError}</div>
                ) : !verification ? (
                    <div className="text-gray-600 py-8">No verification record exists for this order yet.</div>
                ) : (
                    <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Field label="Verification ID" value={verification.id} />
                            <Field label="Order ID" value={verification.order_id} />
                            <Field label="Status" value={verification.status} />
                            {order.assigned_to && (
                                <Field label="Verification Officer" value={`${order.assigned_to?.full_name} (${order.assigned_to?.username})`} />
                            )}
                            {order.delivery_officer && (
                                <Field label="Delivery Officer" value={`${order.delivery_officer.full_name} (${order.delivery_officer.username})`} />
                            )}
                            <Field label="Start Time" value={verification.start_time ? formatExactDate(verification.start_time) : null} />
                            <Field label="End Time" value={verification.end_time ? formatExactDate(verification.end_time) : null} />
                            <Field label="Verification Feedback" value={verification.verification_feedback} />
                        </div>
                        {verification.home_location_required && (
                            <div className={cn(
                                "flex items-center gap-2 rounded-lg p-4 font-bold border-2 mb-4",
                                verification.home_location_verified
                                    ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/10 dark:border-green-800"
                                    : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-800 animate-pulse"
                            )}>
                                <span className="text-xl">📍</span>
                                <span>HOME LOCATION REQUIRED</span>
                                {verification.home_location_verified && (
                                    <span className="ml-auto text-sm font-medium bg-green-100 px-2 py-0.5 rounded text-green-800">Verified</span>
                                )}
                            </div>
                        )}
                        {/* Home Location Assignment Actions */}
                        {verification.home_location_required && !verification.home_location_verified && (
                            <div className="mb-6 rounded-xl border border-warning bg-warning/5 p-6 dark:border-warning/30">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-2xl">📍</span>
                                    <h3 className="text-xl font-bold text-yellow-700 dark:text-yellow-300">Home Location Assignment Required</h3>
                                </div>
                                <p className="mb-6 text-gray-700 dark:text-gray-300 text-sm">
                                    This verification requires a customer home location capture. Assign an officer to proceed. Once a request is sent, you cannot assign again until the current request is resolved.
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    {order.assigned_to && (
                                        <button
                                            onClick={() => {
                                                setModalOfficerType('vo');
                                                setModalOpen(true);
                                            }}
                                            className={cn(
                                                "rounded-lg px-6 py-2.5 font-semibold shadow-sm transition-colors",
                                                locationRequestPending || verification.status === 'location_capture_pending'
                                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                    : "bg-primary text-white hover:bg-primary/90"
                                            )}
                                            disabled={locationRequestPending || verification.status === 'location_capture_pending'}
                                        >
                                            Option 1: Send to Verification Officer
                                        </button>
                                    )}
                                    {order.delivery_officer && (
                                    <button
                                        onClick={() => {
                                        setModalOfficerType('do');
                                        setModalOpen(true);
                                        }}
                                        className={cn(
                                        "rounded-lg px-6 py-2.5 font-semibold shadow-sm transition-colors",
                                        locationRequestPending || verification.status === 'location_capture_pending'
                                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                            : "bg-dark text-white hover:bg-dark/90"
                                        )}
                                        disabled={locationRequestPending || verification.status === 'location_capture_pending'}
                                    >
                                        Option 2: Send to Delivery Officer
                                    </button>
                                    )}
                                </div>
                                {(locationRequestPending || verification.status === 'location_capture_pending') && (
                                    <div className="mt-6 flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-base font-medium">
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                                        Officer assignment is pending. Please wait for completion before assigning again.
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Officer Selection Modal */}
                        <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                        <h2 className="text-lg font-bold mb-4">
                            {modalOfficerType === 'vo' ? 'Send to Verification Officer' : 'Send to Delivery Officer'}
                        </h2>
                        {modalOfficerType === 'vo' && order.assigned_to && (
                            <div className="mb-4 p-3 rounded bg-gray-100 dark:bg-gray-800">
                            <div className="font-semibold">Officer Details:</div>
                            <div>Name: {order.assigned_to.full_name}</div>
                            <div>Username: {order.assigned_to.username}</div>
                            </div>
                        )}
                        {modalOfficerType === 'do' && order.delivery_officer && (
                            <div className="mb-4 p-3 rounded bg-gray-100 dark:bg-gray-800">
                            <div className="font-semibold">Officer Details:</div>
                            <div>Name: {order.delivery_officer.full_name}</div>
                            <div>Username: {order.delivery_officer.username}</div>
                            </div>
                        )}
                        <div className="flex gap-4">
                            <button
                            className="bg-primary text-white px-4 py-2 rounded"
                            onClick={async () => {
                                setLocationRequestPending(true);
                                setModalOpen(false);
                                await handleLocationAction(
                                modalOfficerType === 'vo' ? 'send-to-vo' : 'send-to-do',
                                modalOfficerType === 'vo' ? String( order.assigned_to_user_id) : String(order.delivery_officer?.id ?? '')
                                );
                                setLocationRequestPending(false);
                            }}
                            disabled={locationRequestPending || (modalOfficerType === 'vo' && !verification.verification_officer) || (modalOfficerType === 'do' && !order.delivery_officer)}
                            >
                            Confirm & Send
                            </button>
                            <button
                            className="bg-gray-300 px-4 py-2 rounded"
                            onClick={() => setModalOpen(false)}
                            >
                            Cancel
                            </button>
                        </div>
                        </div>
                    </Modal>

                        {/* Purchaser Details */}
                        {verification.purchaser && (
                            <div className="mb-12">
                                <div className="flex flex-wrap items-center gap-3 mb-4">
                                    <h2 className="text-2xl font-semibold text-dark dark:text-white">Purchaser Details</h2>
                                    <LinkedAccountsBadge cnic={verification.purchaser.cnic_number} currentOrderId={order.id} />
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {[
                                        { label: "Name", field: "name" },
                                        { label: "Father/Husband Name", field: "father_husband_name" },
                                        { label: "Present Address", field: "present_address" },
                                        { label: "Permanent Address", field: "permanent_address" },
                                        { label: "CNIC Number", field: "cnic_number" },
                                        { label: "Telephone Number", field: "telephone_number" },
                                        { label: "Employment Type", field: "employment_type" },
                                        { label: "Job Type", field: "job_type" },
                                        { label: "Employer Name", field: "employer_name" },
                                        { label: "Employer Address", field: "employer_address" },
                                        { label: "Designation", field: "designation" },
                                        { label: "Official Number", field: "official_number" },
                                        { label: "Business Name", field: "business_name" },
                                        { label: "Established Since", field: "established_since" },
                                        { label: "Business Address", field: "business_address" },
                                        { label: "Net Income", field: "net_income" },
                                        { label: "Years in Company", field: "years_in_company" },
                                        { label: "Gross Salary", field: "gross_salary" },
                                        { label: "Nearest Location", field: "nearest_location" }
                                    ].map(f => {
                                        const isEditable = user?.role === 'Super Admin' && order.status === 'delivered';
                                        return isEditable ? (
                                            <EditableField
                                                key={f.field}
                                                label={f.label}
                                                value={verification.purchaser[f.field]}
                                                fieldName={f.field}
                                                entityType="purchaser"
                                                entityId={verification.purchaser.id}
                                                onSave={handleFieldSave}
                                                editHistory={verification.purchaser.edit_history || []}
                                            />
                                        ) : (
                                            <Field key={f.field} label={f.label} value={verification.purchaser[f.field]} />
                                        );
                                    })}
                                </div>
                                {/* Purchaser Documents — 6 standard slots */}
                                {(() => {
                                    const purchaserDocs = verification.documents.filter((doc: any) => doc.person_type === 'purchaser');
                                    const purchaserStandardSlots = [
                                        { key: 'cnic_front', title: 'CNIC Front' },
                                        { key: 'cnic_back', title: 'CNIC Back' },
                                        { key: 'utility_bill', title: 'Utility Bill' },
                                        { key: 'service_card', title: 'Salary Slip / Service Card' },
                                        { key: 'signature', title: 'Signature' },
                                        { key: 'photo', title: 'Purchaser Live Photo' },
                                    ];
                                    const purchaserMatchedKeys = new Set<string>();
                                    return (
                                        <div className="mt-8">
                                            <h3 className="mb-4 text-xl font-semibold text-blue-700 dark:text-blue-400">Purchaser Documents</h3>
                                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                {purchaserStandardSlots.map((slot) => {
                                                    const doc = purchaserDocs.find((d: any) => d.document_type === slot.key);
                                                    if (doc) purchaserMatchedKeys.add(doc.document_type);
                                                    return doc ? (
                                                        <MediaCard
                                                            key={slot.key}
                                                            id={doc.id}
                                                            title={doc.label || slot.title}
                                                            subtitle={doc.document_type?.replace(/_/g, ' ')}
                                                            fileUrl={doc.file_url}
                                                            uploadedAt={doc.uploaded_at}
                                                            isEditable={user?.role === 'Super Admin' && order.status === 'delivered'}
                                                            onEdit={(file) => handleMediaReplace(file, doc.id, doc.document_type, doc.person_type, doc.person_id)}
                                                            editHistory={verification.edit_history || []}
                                                            historyFilter={(h) =>
                                                                h.field_name === doc.document_type &&
                                                                (h.entity_type === doc.person_type || (h.entity_id !== null && h.entity_id === doc.person_id))
                                                            }
                                                        />
                                                    ) : (
                                                        <div key={slot.key} className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 text-center min-h-[170px]">
                                                            <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 mb-3">
                                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">{slot.title}</p>
                                                            <p className="text-xs text-gray-400">Not uploaded</p>
                                                        </div>
                                                    );
                                                })}
                                                {purchaserDocs.filter((d: any) => !purchaserMatchedKeys.has(d.document_type)).map((doc: any) => (
                                                    <MediaCard
                                                        key={doc.id}
                                                        id={doc.id}
                                                        title={doc.label || doc.document_type}
                                                        subtitle={doc.document_type?.replace(/_/g, ' ')}
                                                        fileUrl={doc.file_url}
                                                        uploadedAt={doc.uploaded_at}
                                                        isEditable={user?.role === 'Super Admin' && order.status === 'delivered'}
                                                        onEdit={(file) => handleMediaReplace(file, doc.id, doc.document_type, doc.person_type, doc.person_id)}
                                                        editHistory={verification.edit_history || []}
                                                        historyFilter={(h) =>
                                                            h.field_name === doc.document_type &&
                                                            (h.entity_type === doc.person_type || (h.entity_id !== null && h.entity_id === doc.person_id))
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Grantors */}
                        {verification.grantors && verification.grantors.map((grantor: any) => {
                            const isEditable = user?.role === 'Super Admin' && order.status === 'delivered';
                            return (
                                <div key={grantor.id} className="mb-16">
                                    <div className="flex flex-wrap items-center gap-3 mb-4">
                                        <h2 className="text-2xl font-semibold text-dark dark:text-white">Grantor {grantor.grantor_number} Details</h2>
                                        <LinkedAccountsBadge cnic={grantor.cnic_number} currentOrderId={order.id} />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {[
                                            { label: "Name", field: "name" },
                                            { label: "Father/Husband Name", field: "father_husband_name" },
                                            { label: "Present Address", field: "present_address" },
                                            { label: "Permanent Address", field: "permanent_address" },
                                            { label: "CNIC Number", field: "cnic_number" },
                                            { label: "Telephone Number", field: "telephone_number" },
                                            { label: "Employment Type", field: "employment_type" },
                                            { label: "Job Type", field: "job_type" },
                                            { label: "Designation", field: "designation" },
                                            { label: "Official Number", field: "official_number" },
                                            { label: "Office Address", field: "office_address" },
                                            { label: "Company Name", field: "company_name" },
                                            { label: "Years in Company", field: "years_in_company" },
                                            { label: "Monthly Income", field: "monthly_income" },
                                            { label: "Business Name", field: "business_name" },
                                            { label: "Established Since", field: "established_since" },
                                            { label: "Business Address", field: "business_address" },
                                            { label: "Net Income", field: "net_income" },
                                            { label: "Full Residential Address", field: "full_residential_address" },
                                            { label: "Relationship", field: "relationship" },
                                            { label: "Nearest Location", field: "nearest_location" }
                                        ].map(f => {
                                            return isEditable ? (
                                                <EditableField
                                                    key={f.field}
                                                    label={f.label}
                                                    value={grantor[f.field]}
                                                    fieldName={f.field}
                                                    entityType="grantor"
                                                    entityId={grantor.id}
                                                    onSave={handleFieldSave}
                                                    editHistory={grantor.edit_history || []}
                                                />
                                            ) : (
                                                <Field key={f.field} label={f.label} value={grantor[f.field]} />
                                            );
                                        })}
                                    </div>
                                    {/* Grantor Documents — same 6 standard slots as Purchaser */}
                                    {(() => {
                                        const grantorPersonType = `grantor${grantor.grantor_number}`;
                                        const grantorDocs = verification.documents.filter((doc: any) => doc.person_type === grantorPersonType);
                                        const gNum = grantor.grantor_number;
                                        const standardSlots = [
                                            { key: 'cnic_front', title: `Grantor ${gNum} CNIC Front` },
                                            { key: 'cnic_back', title: `Grantor ${gNum} CNIC Back` },
                                            { key: 'utility_bill', title: `Grantor ${gNum} Utility Bill / Proof` },
                                            { key: 'service_card', title: `Grantor ${gNum} Salary Slip / Service Card` },
                                            { key: 'signature', title: `Grantor ${gNum} Signature` },
                                            { key: 'photo', title: `Grantor ${gNum} Live Photo` },
                                        ];
                                        const matchedKeys = new Set<string>();
                                        return (
                                            <div className="mt-8">
                                                <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-indigo-400">Grantor {gNum} Documents</h3>
                                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                    {standardSlots.map((slot) => {
                                                        const doc = grantorDocs.find((d: any) => d.document_type === slot.key);
                                                        if (doc) matchedKeys.add(doc.document_type);
                                                        return doc ? (
                                                            <MediaCard
                                                                key={slot.key}
                                                                id={doc.id}
                                                                title={doc.label || slot.title}
                                                                subtitle={doc.document_type?.replace(/_/g, ' ')}
                                                                fileUrl={doc.file_url}
                                                                uploadedAt={doc.uploaded_at}
                                                                isEditable={isEditable}
                                                                onEdit={(file) => handleMediaReplace(file, doc.id, doc.document_type, doc.person_type, doc.person_id)}
                                                                editHistory={verification.edit_history || []}
                                                                historyFilter={(h) =>
                                                                    h.field_name === doc.document_type &&
                                                                    (h.entity_type === doc.person_type || (h.entity_id !== null && h.entity_id === doc.person_id))
                                                                }
                                                            />
                                                        ) : (
                                                            <div key={slot.key} className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 text-center min-h-[170px]">
                                                                <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 mb-3">
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                </div>
                                                                <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">{slot.title}</p>
                                                                <p className="text-xs text-gray-400">Not uploaded</p>
                                                            </div>
                                                        );
                                                    })}
                                                    {/* Any extra non-standard docs */}
                                                    {grantorDocs.filter((d: any) => !matchedKeys.has(d.document_type)).map((doc: any) => (
                                                        <MediaCard
                                                            key={doc.id}
                                                            id={doc.id}
                                                            title={doc.label || doc.document_type}
                                                            subtitle={doc.document_type?.replace(/_/g, ' ')}
                                                            fileUrl={doc.file_url}
                                                            uploadedAt={doc.uploaded_at}
                                                            isEditable={isEditable}
                                                            onEdit={(file) => handleMediaReplace(file, doc.id, doc.document_type, doc.person_type, doc.person_id)}
                                                            editHistory={verification.edit_history || []}
                                                            historyFilter={(h) =>
                                                                h.field_name === doc.document_type &&
                                                                (h.entity_type === doc.person_type || (h.entity_id !== null && h.entity_id === doc.person_id))
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}

                        {/* Next of Kin (view-only, verification page order/logic) */}
                        {verification.nextOfKin && Object.values(verification.nextOfKin).some(val => shouldDisplay(val)) && (
                            <div className="mb-12">
                                <h2 className="mb-4 text-2xl font-semibold text-dark dark:text-white">Next of Kin Details</h2>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    <Field label="Name" value={verification.nextOfKin.name} />
                                    <Field label="CNIC Number" value={verification.nextOfKin.cnic_number} />
                                    <Field label="Relation" value={verification.nextOfKin.relation} />
                                    <Field label="Phone Number" value={verification.nextOfKin.phone_number} />
                                </div>
                            </div>
                        )}

                        {/* Locations (view-only, verification page order/logic) */}
                        {(verification.locations.length > 0 || verification.verification_locations.length > 0) && (
                            <div className="mb-12">
                                <h2 className="mb-4 text-2xl font-semibold text-dark dark:text-white">Location Tracking</h2>

                                {verification.locations.length > 0 && (
                                    <div className="mb-8">
                                        <h3 className="mb-3 text-xl font-semibold text-dark dark:text-white">GPS Locations</h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr className="border-b border-stroke dark:border-dark-3">
                                                        <th className="px-4 py-2 text-left">Label</th>
                                                        <th className="px-4 py-2 text-left">Latitude</th>
                                                        <th className="px-4 py-2 text-left">Longitude</th>
                                                        <th className="px-4 py-2 text-left">Accuracy</th>
                                                        <th className="px-4 py-2 text-left">Timestamp</th>
                                                        <th className="px-4 py-2 text-left">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {verification.locations.map((loc) => (
                                                        <tr key={loc.id} className="border-b border-stroke dark:border-dark-3">
                                                            <td className="px-4 py-2">{loc.label}</td>
                                                            <td className="px-4 py-2">{loc.latitude}</td>
                                                            <td className="px-4 py-2">{loc.longitude}</td>
                                                            <td className="px-4 py-2">{loc.accuracy ? `${loc.accuracy} meters` : '—'}</td>
                                                            <td className="px-4 py-2">{formatExactDate(loc.timestamp)}</td>
                                                            <td className="px-4 py-2">
                                                                <a
                                                                    href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary hover:underline font-medium"
                                                                >
                                                                    View on Map
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {verification.verification_locations.length > 0 && (
                                    <div>
                                        <h3 className="mb-3 text-xl font-semibold text-dark dark:text-white">Location Photos</h3>
                                        <div className="space-y-6">
                                            {verification.verification_locations.map((loc) => (
                                                <div key={loc.id} className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                                                    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                                        <Field label="Location Type" value={loc.location_type} />
                                                        <Field label="Label" value={loc.label} />
                                                        <Field label="Person Type" value={loc.person_type} />
                                                        <div className="flex flex-col">
                                                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Coordinates</label>
                                                            <div className="mt-1 flex items-center gap-3 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3">
                                                                <span className="dark:text-gray-300">
                                                                    {loc.latitude && loc.longitude ? `${loc.latitude}, ${loc.longitude}` : '—'}
                                                                </span>
                                                                {loc.latitude && loc.longitude && (
                                                                    <a
                                                                        href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs font-bold text-primary hover:underline ml-auto"
                                                                    >
                                                                        VIEW ON GOOGLE MAP
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Field label="Address" value={loc.address} />
                                                        <Field label="Captured At" value={loc.created_at ? formatExactDate(loc.created_at) : null} />
                                                    </div>

                                                    {loc.photos && loc.photos.length > 0 && (
                                                        <div>
                                                            <h4 className="mb-3 font-medium text-gray-700 dark:text-gray-300">Photos</h4>
                                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                                                {loc.photos.map((photo: any) => (
                                                                    <MediaCard 
                                                                        key={photo.id} 
                                                                        id={photo.id}
                                                                        title={`${loc.label} - Photo`}
                                                                        fileUrl={photo.file_url}
                                                                        uploadedAt={photo.uploaded_at}
                                                                        isEditable={user?.role === 'Super Admin' && order.status === 'delivered'}
                                                                                                                                                 onEdit={(file) => handleLocationMediaReplace(file, photo.id)}
                                                                         editHistory={verification?.edit_history}
                                                                         historyFilter={(h) => h.entity_type === 'location_photo' && h.entity_id === photo.id}

                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {(order.status === 'delivered' || order.status?.toLowerCase() === 'returned') && (
                <div className="mt-10">
                    <DeliveredProductDetails 
                        orderId={order.id} 
                        editHistory={verification?.edit_history} 
                        onRefresh={fetchVerification}
                    />
                </div>
            )}

            {/* Recovery Visits Section - Show for all orders that might have recovery visits */}
            {(order.recovery_officer_id) && (
                <div className="mt-10">
                    <RecoveryVisitDetails 
                        orderId={order.id} 
                        editHistory={verification?.edit_history} 
                        onRefresh={fetchVerification}
                    />
                </div>
            )}

            {/* Action Modals (Edit/Cancel) */}
            <Modal open={statusModalOpen} onClose={() => { if (!isUpdatingStatus) { setStatusModalOpen(false); setPendingStatus(null); } }}>
                <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                    <h2 className="text-xl font-bold mb-2 dark:text-white">Change Order Status</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Change status from <strong>{order?.status}</strong> to <strong>{pendingStatus}</strong>?
                    </p>
                    <div className="flex justify-end gap-3 text-sm font-medium">
                        <button
                            onClick={() => { setStatusModalOpen(false); setPendingStatus(null); }}
                            disabled={isUpdatingStatus}
                            className="rounded border border-stroke px-6 py-2 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-2"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={async () => {
                                if (!pendingStatus) return;
                                setIsUpdatingStatus(true);
                                const token = Cookies.get('auth_token');
                                try {
                                    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/orders/${order?.id}/status`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ status: pendingStatus, remarks: `Status changed to ${pendingStatus} by Super Admin` }),
                                    });
                                    const json = await res.json();
                                    if (json.success) {
                                        toast.success(json.message);
                                        setOrder(prev => ({ ...(prev as Order), status: pendingStatus }));
                                    } else {
                                        toast.error(json.message || 'Failed to update status');
                                    }
                                } catch {
                                    toast.error('Failed to update status');
                                } finally {
                                    setIsUpdatingStatus(false);
                                    setStatusModalOpen(false);
                                    setPendingStatus(null);
                                }
                            }}
                            disabled={isUpdatingStatus}
                            className="bg-primary text-white rounded px-8 py-2 hover:bg-opacity-90 disabled:opacity-50"
                        >
                            {isUpdatingStatus ? 'Updating...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)}>
                <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800 max-w-lg w-full">
                    <h2 className="text-2xl font-bold mb-4 dark:text-white">Edit Product Selection</h2>
                    <p className="mb-6 text-gray-600 dark:text-gray-400 text-sm">
                        Select a new product for order <strong>{order.order_ref}</strong>. This update will include new pricing and installment details.
                    </p>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Current Product:</label>
                            <div className="p-3 bg-gray-50 dark:bg-dark-3 rounded-lg border border-stroke dark:border-dark-3 text-sm font-medium">
                                {order.product_name}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Category:</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3 text-sm"
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Subcategory:</label>
                                <select
                                    value={selectedSubcategory}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSubcategory(e.target.value)}
                                    disabled={!selectedCategory}
                                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3 text-sm disabled:bg-gray-100 dark:disabled:bg-dark-2"
                                >
                                    <option value="">Select Subcategory</option>
                                    {subcategories.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-gray-300">New Product:</label>
                            <select
                                disabled={!selectedSubcategory}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    const prod = products.find(p => p.name === e.target.value);
                                    if (prod) setSelectedProduct(prod);
                                }}
                                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-primary dark:border-dark-3 text-sm disabled:bg-gray-100 dark:disabled:bg-dark-2"
                            >
                                <option value="">Select Product</option>
                                {products
                                    .filter(p => p.category_name === selectedCategory && p.subcategory_name === selectedSubcategory)
                                    .map((p: any) => (
                                        <option key={p.id} value={p.name}>
                                            {p.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {selectedProduct && (
                            <div className="space-y-3 pt-2">
                                <label className="block text-sm font-medium dark:text-gray-300">Installment Plan:</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {selectedProduct.ProductInstallments?.filter((p: any) => p.isActive).map((plan: any) => (
                                        <label
                                            key={plan.id}
                                            className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedPlan?.id === plan.id
                                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                : 'border-stroke hover:border-primary/50 dark:border-dark-3'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                className="sr-only"
                                                checked={selectedPlan?.id === plan.id}
                                                onChange={() => setSelectedPlan(plan)}
                                            />
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-dark dark:text-white">{plan.months} Months</span>
                                                <div className="text-right text-xs space-y-0.5">
                                                    <div className="text-gray-500">Advance: <span className="text-dark dark:text-white font-medium">Rs. {plan.advance.toLocaleString()}</span></div>
                                                    <div className="text-gray-500">Monthly: <span className="text-dark dark:text-white font-medium">Rs. {plan.monthlyAmount.toLocaleString()}</span></div>
                                                    <div className="text-gray-500">Total: <span className="text-dark dark:text-white font-medium">Rs. {plan.totalPrice.toLocaleString()}</span></div>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t mt-6 dark:border-dark-3">
                        <button
                            onClick={() => setEditModalOpen(false)}
                            className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium dark:border-dark-3 hover:bg-gray-50 dark:hover:bg-dark-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmEdit}
                            disabled={isSubmitting || !selectedProduct || !selectedPlan}
                            className="bg-primary text-white rounded-lg px-8 py-2.5 text-sm font-bold shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isSubmitting ? 'Updating...' : 'Update Order Item'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
                <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-red-600">Cancel Order</h2>
                    <div className="mb-6">
                        <label className="mb-2.5 block text-black dark:text-white font-medium">Cancellation Reason <span className="text-red-500">*</span></label>
                        <textarea
                            rows={4}
                            value={cancelReason}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCancelReason(e.target.value)}
                            placeholder="Please provide a reason for cancellation..."
                            className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
                        ></textarea>
                    </div>
                    <div className="flex justify-end gap-3 text-sm font-medium">
                        <button onClick={() => setCancelModalOpen(false)} className="rounded border border-stroke px-6 py-2 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-2">Back</button>
                        <button
                            onClick={confirmCancel}
                            disabled={isSubmitting || !cancelReason.trim()}
                            className="bg-red-600 text-white rounded px-8 py-2 hover:bg-opacity-90 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Processing...' : 'Confirm Cancellation'}
                        </button>
                    </div>
                </div>
            </Modal>
            
            <Modal open={sendLedgerModalOpen} onClose={() => setSendLedgerModalOpen(false)}>
                <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
                    <h3 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Send Ledger via WhatsApp</h3>
                    <div className="space-y-4">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="radio" 
                                name="sendLedgerTarget" 
                                value="primary" 
                                checked={sendLedgerTarget === 'primary'}
                                onChange={(e) => setSendLedgerTarget(e.target.value)}
                                className="form-radio h-5 w-5 text-primary"
                            />
                            <span className="text-gray-900 dark:text-white">
                                Primary Number ({order?.verification?.purchaser?.telephone_number || order?.whatsapp_number || 'N/A'})
                            </span>
                        </label>
                        
                        {order?.verification?.purchaser?.alternate_phone_number && (
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="sendLedgerTarget" 
                                    value="alternate" 
                                    checked={sendLedgerTarget === 'alternate'}
                                    onChange={(e) => setSendLedgerTarget(e.target.value)}
                                    className="form-radio h-5 w-5 text-primary"
                                />
                                <span className="text-gray-900 dark:text-white">
                                    Alternate Number ({order?.verification?.purchaser?.alternate_phone_number})
                                </span>
                            </label>
                        )}

                        {order?.verification?.purchaser?.alternate_phone_number && (
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="sendLedgerTarget" 
                                    value="both" 
                                    checked={sendLedgerTarget === 'both'}
                                    onChange={(e) => setSendLedgerTarget(e.target.value)}
                                    className="form-radio h-5 w-5 text-primary"
                                />
                                <span className="text-gray-900 dark:text-white">Both Numbers</span>
                            </label>
                        )}
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={() => setSendLedgerModalOpen(false)}
                            disabled={isSendingLedger}
                            className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSendLedger}
                            disabled={isSendingLedger}
                            className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-opacity-90 disabled:opacity-50"
                        >
                            {isSendingLedger ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Timeline Dates Modal — Legacy Import Orders */}
            <EditTimelineDatesModal
                isOpen={editTimelineModalOpen}
                onClose={() => setEditTimelineModalOpen(false)}
                order={order}
                onSaved={() => { fetchOrder(); }}
            />
        </div>
    );
}