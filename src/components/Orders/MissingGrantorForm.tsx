'use client';

import { useState } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Same field set (and order) as the order detail page's "Grantor N Details"
// section, so a grantor added here later looks identical to one captured
// during verification or imported from the legacy sheet.
const COMMON_FIELDS: { label: string; field: string; required?: boolean }[] = [
    { label: 'Name', field: 'name', required: true },
    { label: 'Father/Husband Name', field: 'father_husband_name' },
    { label: 'Present Address', field: 'present_address' },
    { label: 'Permanent Address', field: 'permanent_address' },
    { label: 'CNIC Number', field: 'cnic_number', required: true },
    { label: 'Telephone Number', field: 'telephone_number', required: true },
    { label: 'Job Type', field: 'job_type' },
];
const EMPLOYED_FIELDS = [
    { label: 'Designation', field: 'designation' },
    { label: 'Official Number', field: 'official_number' },
    { label: 'Office Address', field: 'office_address' },
    { label: 'Company Name', field: 'company_name' },
    { label: 'Years in Company', field: 'years_in_company' },
    { label: 'Monthly Income', field: 'monthly_income' },
];
const SELF_EMPLOYED_FIELDS = [
    { label: 'Business Name', field: 'business_name' },
    { label: 'Established Since', field: 'established_since' },
    { label: 'Business Address', field: 'business_address' },
    { label: 'Net Income', field: 'net_income' },
];
const TRAILING_FIELDS = [
    { label: 'Full Residential Address', field: 'full_residential_address' },
    { label: 'Relationship', field: 'relationship' },
    { label: 'Nearest Location', field: 'nearest_location' },
];

/**
 * Blank "Grantor N Details" form for an order that never got that grantor
 * (e.g. a legacy import whose sheet row left Guarantor 1 empty). Saving goes
 * through the same POST /verification/:id/grantor/:number endpoint the
 * verification app uses — it creates the grantor record and runs the same
 * blacklist check — after which the page re-fetches and renders the normal
 * editable section + document slots in its place.
 *
 * Documents can be uploaded straight away too, before any details are
 * typed: the grantor document endpoint creates a bare grantor record on its
 * own if none exists yet. If details HAVE been typed, they're saved first so
 * the upload (which re-renders the page into the normal section) can't
 * silently discard them.
 */
export default function MissingGrantorForm({
    verificationId,
    grantorNumber,
    onSaved,
    onUploadDocument,
}: {
    verificationId: number;
    grantorNumber: number;
    onSaved: () => Promise<void> | void;
    onUploadDocument: (file: File, documentType: string) => Promise<void> | void;
}) {
    const [form, setForm] = useState<Record<string, string>>({ employment_type: 'EMPLOYED' });
    const [saving, setSaving] = useState(false);
    const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

    const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

    const isSelfEmployed = form.employment_type === 'SELF_EMPLOYED';
    const fields: { label: string; field: string; required?: boolean }[] = [...COMMON_FIELDS, ...(isSelfEmployed ? SELF_EMPLOYED_FIELDS : EMPLOYED_FIELDS), ...TRAILING_FIELDS];

    const hasTypedDetails = Object.entries(form).some(([k, v]) => k !== 'employment_type' && (v || '').trim() !== '');

    // Returns true once the grantor's details are saved. Doesn't re-fetch the
    // page itself — callers decide (Save re-fetches, an upload re-fetches
    // after the file goes up).
    const saveDetails = async (): Promise<boolean> => {
        const missing = COMMON_FIELDS.filter((f) => f.required && !(form[f.field] || '').trim()).map((f) => f.label);
        if (missing.length > 0) {
            toast.error(`Required: ${missing.join(', ')}`);
            return false;
        }
        setSaving(true);
        try {
            const token = Cookies.get('auth_token');
            const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
            const res = await fetch(`${BACKEND_URL}/api/verification/${verificationId}/grantor/${grantorNumber}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) throw new Error(json.message || json.error?.message || 'Failed to save grantor');
            toast.success(`Grantor ${grantorNumber} added`);
            return true;
        } catch (err: any) {
            toast.error(err.message || 'Failed to save grantor');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (await saveDetails()) await onSaved();
    };

    const handleUpload = async (file: File, documentType: string) => {
        if (hasTypedDetails && !(await saveDetails())) return;
        setUploadingSlot(documentType);
        try {
            await onUploadDocument(file, documentType);
        } finally {
            setUploadingSlot(null);
        }
    };

    const documentSlots = [
        { key: 'cnic_front', title: `Grantor ${grantorNumber} CNIC Front` },
        { key: 'cnic_back', title: `Grantor ${grantorNumber} CNIC Back` },
        { key: 'utility_bill', title: `Grantor ${grantorNumber} Utility Bill / Proof` },
        { key: 'service_card', title: `Grantor ${grantorNumber} Salary Slip / Service Card` },
        { key: 'signature', title: `Grantor ${grantorNumber} Signature` },
        { key: 'photo', title: `Grantor ${grantorNumber} Live Photo` },
    ];

    return (
        <div className="mb-16">
            <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-2xl font-semibold text-dark dark:text-white">Grantor {grantorNumber} Details</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Not added yet
                </span>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                This order has no Grantor {grantorNumber} on record. Fill in the details and save, and/or upload documents below.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {fields.slice(0, COMMON_FIELDS.length).map((f) => (
                    <FormInput key={f.field} label={f.label} required={f.required} value={form[f.field] || ''} onChange={(v) => set(f.field, v)} />
                ))}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">Employment Type</label>
                    <select
                        value={form.employment_type}
                        onChange={(e) => set('employment_type', e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                    >
                        <option value="EMPLOYED">Employed</option>
                        <option value="SELF_EMPLOYED">Self Employed</option>
                    </select>
                </div>
                {fields.slice(COMMON_FIELDS.length).map((f) => (
                    <FormInput key={f.field} label={f.label} value={form[f.field] || ''} onChange={(v) => set(f.field, v)} />
                ))}
            </div>
            <button
                onClick={handleSave}
                disabled={saving}
                className="mt-6 rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
                {saving ? 'Saving...' : `Save Grantor ${grantorNumber}`}
            </button>

            {/* Same 6 standard slots the page shows for an existing grantor */}
            <div className="mt-8">
                <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-indigo-400">Grantor {grantorNumber} Documents</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {documentSlots.map((slot) => (
                        <div key={slot.key} className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 text-center min-h-[170px]">
                            <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 mb-3">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">{slot.title}</p>
                            <p className="text-xs text-gray-400 mb-3">{uploadingSlot === slot.key ? 'Uploading...' : 'Not uploaded'}</p>
                            <label className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-sm transition ${saving || uploadingSlot ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                Upload {slot.title}
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    disabled={saving || !!uploadingSlot}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleUpload(file, slot.key);
                                        e.target.value = '';
                                    }}
                                    className="sr-only"
                                />
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function FormInput({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            />
        </div>
    );
}
