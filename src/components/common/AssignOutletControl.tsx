'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Outlet {
  id: number;
  name: string;
}

interface AssignOutletControlProps {
  orderId: number;
  /** Pre-selected outlet (e.g. the delivering officer's outlet). */
  suggestedOutletId?: number | null;
  onAssigned?: (outlet: Outlet) => void;
  compact?: boolean;
}

// Shared outlet list for every control on the page (the Unassigned Accounts list renders one per row).
let outletsRequest: Promise<Outlet[]> | null = null;
const loadOutlets = () => {
  if (!outletsRequest) {
    outletsRequest = fetch(`${BACKEND_URL}/api/outlet-reports/all-outlets`, { headers: { Authorization: `Bearer ${Cookies.get('auth_token')}` } })
      .then((r) => r.json())
      .then((json) => (json.success ? json.data : []))
      .catch(() => { outletsRequest = null; return []; });
  }
  return outletsRequest;
};

/**
 * Gives an account its outlet (PATCH /admin-panel/orders/:id/outlet) — only the outlet
 * changes, never the order's status. Super Admin / granted Sub Admin only (backend-enforced).
 */
export default function AssignOutletControl({ orderId, suggestedOutletId, onAssigned, compact }: AssignOutletControlProps) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState(suggestedOutletId ? String(suggestedOutletId) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadOutlets().then(setOutlets); }, []);

  const assign = async () => {
    if (!outletId) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/orders/${orderId}/outlet`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${Cookies.get('auth_token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: Number(outletId) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || json.error?.message || 'Could not assign outlet');
      toast.success(json.message);
      onAssigned?.(json.data.outlet);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'mt-2'}`}>
      <select
        value={outletId}
        onChange={(e) => setOutletId(e.target.value)}
        className="min-w-[150px] rounded-lg border border-stroke bg-white px-2.5 py-1.5 text-xs font-medium text-dark outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
      >
        <option value="">Select outlet…</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>{o.name}{suggestedOutletId === o.id ? ' (suggested)' : ''}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={assign}
        disabled={!outletId || saving}
        className="whitespace-nowrap rounded-lg bg-[#ff3d3d] px-3 py-1.5 text-xs font-bold text-white hover:bg-opacity-90 disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Assign'}
      </button>
    </div>
  );
}
