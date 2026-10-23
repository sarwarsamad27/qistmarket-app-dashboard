'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Officer {
  id: number;
  full_name: string;
}

interface RecoveryOfficerSelectorProps {
  onSelect: (officerId: string) => void;
  selectedId: string;
  allLabel?: string;
}

export default function RecoveryOfficerSelector({
  onSelect,
  selectedId,
  allLabel = 'All Recovery Officers',
}: RecoveryOfficerSelectorProps) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOfficers = async () => {
      const token = Cookies.get('auth_token');
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/outlet-reports/all-recovery-officers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) {
          setOfficers(json.data);
        }
      } catch (error) {
        console.error('Error fetching recovery officers:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOfficers();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        Officer:
      </label>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm font-medium text-dark outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
      >
        <option value="all">{allLabel}</option>
        {officers.map((officer) => (
          <option key={officer.id} value={officer.id.toString()}>
            {officer.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}
