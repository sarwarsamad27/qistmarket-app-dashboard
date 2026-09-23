'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Outlet {
  id: number;
  name: string;
  address: string | null;
}

interface OutletSelectorProps {
  onSelect: (outletId: string) => void;
  selectedId: string;
  /** Label for the value:"all" option. Most callers use this selector to FILTER a report
   * across every outlet at once, where "All Outlets (Aggregated)" is accurate. A caller
   * using it to pick the single target of a NEW record (e.g. "Create Expense", where
   * leaving it blank means Head Office, not "every outlet combined") should override this. */
  allLabel?: string;
}

export default function OutletSelector({ onSelect, selectedId, allLabel = "All Outlets (Aggregated)" }: OutletSelectorProps) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOutlets = async () => {
      const token = Cookies.get('auth_token');
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/outlet-reports/all-outlets`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          setOutlets(json.data);
        }
      } catch (error) {
        console.error('Error fetching outlets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOutlets();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        Outlet:
      </label>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm font-medium text-dark outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
      >
        <option value="all">{allLabel}</option>
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id.toString()}>
            {outlet.address ? `${outlet.name} (${outlet.address})` : outlet.name}
          </option>
        ))}
      </select>
    </div>
  );
}
