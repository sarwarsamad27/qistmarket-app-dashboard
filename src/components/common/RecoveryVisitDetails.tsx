import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { cn } from '@/lib/utils';
import { MediaCard } from "./MediaCard";
import toast from "react-hot-toast";
import { useAuth } from "../../../contexts/AuthContext";
import { formatExactDate } from "@/utils/dateUtils";
import { Modal } from "@/components/Modal/Modal";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const emptyVisitForm = {
    officer_id: '', visit_time: '', customer_feedback: '', visit_notes: '',
    payment_collected: false, amount_collected: '', fuel_charges: '', promised_date: '', latitude: '', longitude: '',
};

const toDateTimeLocalValue = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// RecoveryPhotoCard Component - Now replaced by shared MediaCard

export default function RecoveryVisitDetails({ 
    orderId,
    editHistory = [],
    onRefresh
}: { 
    orderId: string | number,
    editHistory?: any[],
    onRefresh?: () => Promise<void> | void
}) {
    const [recoveryVisits, setRecoveryVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedVisit, setExpandedVisit] = useState<number | null>(null);
    const { user } = useAuth();

    const [visitModalOpen, setVisitModalOpen] = useState(false);
    const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
    const [visitForm, setVisitForm] = useState(emptyVisitForm);
    const [savingVisit, setSavingVisit] = useState(false);
    const [recoveryOfficers, setRecoveryOfficers] = useState<{ id: number; full_name: string; username: string }[]>([]);
    const [deletingVisitId, setDeletingVisitId] = useState<number | null>(null);

    useEffect(() => {
        if (orderId) {
            fetchRecoveryVisits();
        }
    }, [orderId]);

    const handleReplaceMedia = async (file: File, photoId: number) => {
        const token = Cookies.get('auth_token');
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${BACKEND_URL}/api/recovery/visit-photo/${photoId}/replace`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error(await apiErrorMessage(res, "Replacement failed"));
            toast.success('Recovery visit photo replaced successfully');
            await fetchRecoveryVisits();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to replace media');
        }
    };

    const handleDeletePhoto = async (photoId: number) => {
        const token = Cookies.get('auth_token');
        const res = await fetch(`${BACKEND_URL}/api/recovery/visit-photo/${photoId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to delete photo');
        toast.success('Recovery visit photo deleted');
        await fetchRecoveryVisits();
        if (onRefresh) await onRefresh();
    };

    const openAddVisit = async () => {
        setVisitForm({ ...emptyVisitForm, visit_time: toDateTimeLocalValue(new Date().toISOString()) });
        setEditingVisitId(null);
        setVisitModalOpen(true);
        await ensureRecoveryOfficersLoaded();
    };

    const openEditVisit = async (visit: any) => {
        setVisitForm({
            officer_id: visit.officer_id != null ? String(visit.officer_id) : '',
            visit_time: toDateTimeLocalValue(visit.visit_time),
            customer_feedback: visit.customer_feedback || '',
            visit_notes: visit.visit_notes || '',
            payment_collected: !!visit.payment_collected,
            amount_collected: visit.amount_collected != null ? String(visit.amount_collected) : '',
            fuel_charges: visit.fuel_charges != null ? String(visit.fuel_charges) : '',
            promised_date: toDateTimeLocalValue(visit.promised_date),
            latitude: visit.latitude != null ? String(visit.latitude) : '',
            longitude: visit.longitude != null ? String(visit.longitude) : '',
        });
        setEditingVisitId(visit.id);
        setVisitModalOpen(true);
        await ensureRecoveryOfficersLoaded();
    };

    const ensureRecoveryOfficersLoaded = async () => {
        if (recoveryOfficers.length > 0) return;
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/assignments/officers?role=recovery&all=true&include_admins=true`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) setRecoveryOfficers(json.data);
        } catch (err) {
            console.error('Error fetching recovery officers:', err);
        }
    };

    const handleSaveVisit = async () => {
        const token = Cookies.get('auth_token');
        setSavingVisit(true);
        try {
            const body = {
                officer_id: visitForm.officer_id || undefined,
                visit_time: visitForm.visit_time ? new Date(visitForm.visit_time).toISOString() : undefined,
                customer_feedback: visitForm.customer_feedback,
                visit_notes: visitForm.visit_notes,
                payment_collected: visitForm.payment_collected,
                amount_collected: visitForm.amount_collected,
                fuel_charges: visitForm.fuel_charges,
                promised_date: visitForm.promised_date ? new Date(visitForm.promised_date).toISOString() : null,
                latitude: visitForm.latitude,
                longitude: visitForm.longitude,
            };
            const url = editingVisitId !== null
                ? `${BACKEND_URL}/api/recovery/visit/${editingVisitId}`
                : `${BACKEND_URL}/api/recovery/order/${orderId}/visit-manual`;
            const res = await fetch(url, {
                method: editingVisitId !== null ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to save recovery visit');
            toast.success(editingVisitId !== null ? 'Recovery visit updated' : 'Recovery visit added');
            setVisitModalOpen(false);
            await fetchRecoveryVisits();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save recovery visit');
        } finally {
            setSavingVisit(false);
        }
    };

    const handleDeleteVisit = async (visitId: number) => {
        if (!confirm('Delete this recovery visit (and its photos)? This cannot be undone.')) return;
        const token = Cookies.get('auth_token');
        setDeletingVisitId(visitId);
        try {
            const res = await fetch(`${BACKEND_URL}/api/recovery/visit/${visitId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.message || 'Failed to delete recovery visit');
            toast.success('Recovery visit deleted');
            await fetchRecoveryVisits();
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete recovery visit');
        } finally {
            setDeletingVisitId(null);
        }
    };

    const fetchRecoveryVisits = async () => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/recovery/order/${orderId}/visits`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setRecoveryVisits(json.data || []);
            } else {
                setError(json.error?.message || 'Failed to fetch recovery visits');
            }
        } catch (err: any) {
            console.error('Error fetching recovery visits:', err);
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount?.toLocaleString() || 0}`;
    };


    if (loading) {
        return (
            <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-8">
                <div className="flex items-center justify-center space-x-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span className="text-gray-600 dark:text-gray-400">Loading recovery visits...</span>
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
                        <h3 className="font-semibold text-red-800 dark:text-red-400">Unable to load recovery visits</h3>
                        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!recoveryVisits || recoveryVisits.length === 0) {
        return (
            <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
                <div className="text-center">
                    <span className="text-4xl">🔍</span>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">No recovery visits recorded for this order</p>
                    {user?.role === 'Super Admin' && (
                        <button onClick={openAddVisit} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
                            + Add Recovery Visit
                        </button>
                    )}
                </div>
                <RecoveryVisitModal
                    open={visitModalOpen}
                    onClose={() => setVisitModalOpen(false)}
                    isEditing={editingVisitId !== null}
                    form={visitForm}
                    setForm={setVisitForm}
                    onSave={handleSaveVisit}
                    saving={savingVisit}
                    officers={recoveryOfficers}
                />
            </div>
        );
    }

    // Calculate total recovery summary
    const totalVisits = recoveryVisits.length;
    const totalAmountCollected = recoveryVisits.reduce((sum, visit) => sum + (visit.amount_collected || 0), 0);
    const totalFuelCharges = recoveryVisits.reduce((sum, visit) => sum + (visit.fuel_charges || 0), 0);
    const visitsWithPayment = recoveryVisits.filter(v => v.payment_collected).length;

    return (
        <div className="space-y-6">
            {/* Recovery Summary Header */}
            <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800">
                <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                                <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </span>
                            <h2 className="text-xl font-bold text-dark dark:text-white">Recovery Visits</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                {totalVisits} Visit{totalVisits !== 1 ? 's' : ''}
                            </span>
                            {user?.role === 'Super Admin' && (
                                <button onClick={openAddVisit} className="text-xs font-bold text-primary hover:underline">
                                    + Add Visit
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Collected</p>
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(totalAmountCollected)}
                                </p>
                            </div>
                            <span className="text-3xl">💰</span>
                        </div>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Total Fuel Charges</p>
                                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                    {formatCurrency(totalFuelCharges)}
                                </p>
                            </div>
                            <span className="text-3xl">⛽</span>
                        </div>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Visits with Payment</p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {visitsWithPayment} / {totalVisits}
                                </p>
                            </div>
                            <span className="text-3xl">💳</span>
                        </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {Math.round((visitsWithPayment / totalVisits) * 100)}%
                                </p>
                            </div>
                            <span className="text-3xl">📊</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Individual Recovery Visits */}
            {recoveryVisits.map((visit, index) => (
                <div key={visit.id} className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 overflow-hidden">
                    {/* Visit Header */}
                    <div 
                        className="cursor-pointer border-b border-stroke bg-gray-50 px-6 py-4 transition-colors hover:bg-gray-100 dark:border-dark-3 dark:bg-dark-2 dark:hover:bg-dark-3"
                        onClick={() => setExpandedVisit(expandedVisit === index ? null : index)}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                                    {index + 1}
                                </span>
                                <div>
                                    <p className="font-semibold text-dark dark:text-white">
                                        Recovery Visit #{index + 1}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {formatExactDate(visit.visit_time)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {visit.payment_collected && (
                                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                        Payment Collected: {formatCurrency(visit.amount_collected)}
                                    </span>
                                )}
                                {user?.role === 'Super Admin' && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openEditVisit(visit); }}
                                            className="text-xs font-bold text-primary hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteVisit(visit.id); }}
                                            disabled={deletingVisitId === visit.id}
                                            className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                                        >
                                            {deletingVisitId === visit.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </>
                                )}
                                <svg
                                    className={cn("h-5 w-5 text-gray-500 transition-transform", expandedVisit === index && "rotate-180")}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedVisit === index && (
                        <div className="p-6">
                            {/* Officer Information */}
                            {visit.officer && (
                                <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-3">
                                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
                                        <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Recovery Officer Details
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400">Officer Name</label>
                                            <p className="font-medium text-dark dark:text-white">{visit.officer?.full_name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400">Username</label>
                                            <p className="font-medium text-dark dark:text-white">{visit.officer?.username || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Visit Location */}
                            {(visit.latitude || visit.longitude) && (
                                <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-dark-3">
                                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
                                        <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Visit Location
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {visit.latitude && (
                                            <div>
                                                <label className="text-xs text-gray-500 dark:text-gray-400">Latitude</label>
                                                <p className="font-mono text-sm text-dark dark:text-white">{visit.latitude}</p>
                                            </div>
                                        )}
                                        {visit.longitude && (
                                            <div>
                                                <label className="text-xs text-gray-500 dark:text-gray-400">Longitude</label>
                                                <p className="font-mono text-sm text-dark dark:text-white">{visit.longitude}</p>
                                            </div>
                                        )}
                                    </div>
                                    {(visit.latitude && visit.longitude) && (
                                        <div className="mt-3">
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                            >
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                                View on Google Maps
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customer Feedback & Notes */}
                            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {visit.customer_feedback && (
                                    <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/10">
                                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-400">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                            </svg>
                                            Customer Feedback
                                        </h4>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                            {visit.customer_feedback}
                                        </p>
                                    </div>
                                )}

                                {visit.visit_notes && (
                                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/10">
                                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Officer Notes
                                        </h4>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                            {visit.visit_notes}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Payment Details */}
                            {visit.payment_collected && (
                                <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/10">
                                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-400">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Payment Collected
                                    </h4>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400">Amount Collected</label>
                                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                                {formatCurrency(visit.amount_collected)}
                                            </p>
                                        </div>
                                        {visit.fuel_charges > 0 && (
                                            <div>
                                                <label className="text-xs text-gray-600 dark:text-gray-400">Fuel Charges</label>
                                                <p className="font-medium text-dark dark:text-white">
                                                    {formatCurrency(visit.fuel_charges)}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-gray-600 dark:text-gray-400">Net Collected</label>
                                            <p className="font-semibold text-dark dark:text-white">
                                                {formatCurrency((visit.amount_collected || 0) - (visit.fuel_charges || 0))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Photos Section */}
                            {visit.photos && visit.photos.length > 0 && (
                                <div>
                                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark dark:text-white">
                                        <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Visit Photos ({visit.photos.length})
                                    </h4>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {visit.photos.map((photo: any, photoIdx: number) => (
                                            <MediaCard
                                                key={photo.id || photoIdx}
                                                id={photo.id}
                                                title={`Visit #${index + 1} - Photo ${photoIdx + 1}`}
                                                subtitle={photo.photo_type?.replace(/_/g, ' ')}
                                                fileUrl={photo.file_url}
                                                uploadedAt={photo.uploaded_at}
                                                isEditable={user?.role === 'Super Admin'}
                                                onEdit={(file) => handleReplaceMedia(file, photo.id)}
                                                onDelete={user?.role === 'Super Admin' ? () => handleDeletePhoto(photo.id) : undefined}
                                                editHistory={editHistory}
                                                historyFilter={(h) => h.entity_type === 'recovery_visit_photo' && h.entity_id === photo.id}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}

            <RecoveryVisitModal
                open={visitModalOpen}
                onClose={() => setVisitModalOpen(false)}
                isEditing={editingVisitId !== null}
                form={visitForm}
                setForm={setVisitForm}
                onSave={handleSaveVisit}
                saving={savingVisit}
                officers={recoveryOfficers}
            />
        </div>
    );
};

type VisitForm = typeof emptyVisitForm;

function RecoveryVisitModal({
    open, onClose, isEditing, form, setForm, onSave, saving, officers,
}: {
    open: boolean;
    onClose: () => void;
    isEditing: boolean;
    form: VisitForm;
    setForm: React.Dispatch<React.SetStateAction<VisitForm>>;
    onSave: () => void;
    saving: boolean;
    officers: { id: number; full_name: string; username: string }[];
}) {
    return (
        <Modal open={open} onClose={onClose}>
            <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800 max-h-[85vh] overflow-y-auto">
                <h2 className="mb-4 text-lg font-bold dark:text-white">{isEditing ? 'Edit Recovery Visit' : 'Add Recovery Visit'}</h2>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Recovery Officer</label>
                            <select
                                value={form.officer_id}
                                onChange={(e) => setForm((f) => ({ ...f, officer_id: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            >
                                <option value="">-- Select --</option>
                                {officers.map((o) => (
                                    <option key={o.id} value={o.id}>{o.full_name} ({o.username})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Visit Time</label>
                            <input
                                type="datetime-local"
                                value={form.visit_time}
                                onChange={(e) => setForm((f) => ({ ...f, visit_time: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Latitude</label>
                            <input
                                type="text"
                                value={form.latitude}
                                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Longitude</label>
                            <input
                                type="text"
                                value={form.longitude}
                                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Customer Feedback</label>
                        <textarea
                            value={form.customer_feedback}
                            onChange={(e) => setForm((f) => ({ ...f, customer_feedback: e.target.value }))}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Officer Notes</label>
                        <textarea
                            value={form.visit_notes}
                            onChange={(e) => setForm((f) => ({ ...f, visit_notes: e.target.value }))}
                            rows={2}
                            className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-dark dark:text-white">
                        <input
                            type="checkbox"
                            checked={form.payment_collected}
                            onChange={(e) => setForm((f) => ({ ...f, payment_collected: e.target.checked }))}
                        />
                        Payment Collected
                    </label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Amount Collected</label>
                            <input
                                type="number"
                                value={form.amount_collected}
                                onChange={(e) => setForm((f) => ({ ...f, amount_collected: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Fuel Charges</label>
                            <input
                                type="number"
                                value={form.fuel_charges}
                                onChange={(e) => setForm((f) => ({ ...f, fuel_charges: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Promise to Pay Date</label>
                            <input
                                type="datetime-local"
                                value={form.promised_date}
                                onChange={(e) => setForm((f) => ({ ...f, promised_date: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} disabled={saving} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-300">
                            Cancel
                        </button>
                        <button onClick={onSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}