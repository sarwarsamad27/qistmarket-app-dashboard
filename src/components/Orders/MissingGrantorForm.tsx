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
 */
export default function MissingGrantorForm({
    verificationId,
    grantorNumber,
    onSaved,
}: {
    verificationId: number;
    grantorNumber: number;
    onSaved: () => Promise<void> | void;
}) {
    const [form, setForm] = useState<Record<string, string>>({ employment_type: 'EMPLOYED' });
    const [saving, setSaving] = useState(false);

    const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

    const isSelfEmployed = form.employment_type === 'SELF_EMPLOYED';
    const fields: { label: string; field: string; required?: boolean }[] = [...COMMON_FIELDS, ...(isSelfEmployed ? SELF_EMPLOYED_FIELDS : EMPLOYED_FIELDS), ...TRAILING_FIELDS];

    const handleSave = async () => {
        const missing = COMMON_FIELDS.filter((f) => f.required && !(form[f.field] || '').trim()).map((f) => f.label);
        if (missing.length > 0) {
            toast.error(`Required: ${missing.join(', ')}`);
            return;
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
            setForm({ employment_type: 'EMPLOYED' });
            await onSaved();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save grantor');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mb-16">
            <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-2xl font-semibold text-dark dark:text-white">Grantor {grantorNumber} Details</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Not added yet
                </span>
            </div>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                This order has no Grantor {grantorNumber} on record. Fill in the details and save — document upload slots appear once it&apos;s saved.
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
