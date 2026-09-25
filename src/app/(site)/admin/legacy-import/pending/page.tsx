'use client';

import React, { useEffect, useState } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Link from 'next/link';
import { ImageIcon, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from "../../../../../../contexts/AuthContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type PendingOrder = {
  id: number;
  order_ref: string;
  customer_name: string;
  whatsapp_number: string;
  product_name: string;
  status: string;
  needs_media_upload: boolean;
  needs_location: boolean;
  created_at: string;
};

export default function PendingLegacyProfilesPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || "").toLowerCase() === "super admin";

  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<'complete' | 'delete' | null>(null);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Rows that leave the list (completed / deleted) must leave the selection too.
  const dropFromList = (ids: number[]) => {
    const gone = new Set(ids);
    setOrders((prev) => prev.filter((o) => !gone.has(o.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
  };

  const bulkMarkComplete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Mark ${ids.length} profile(s) complete?\n\nThey will leave this list and start showing everywhere (orders, reports, recovery, dashboards) right away.`)) return;
    setBulkBusy('complete');
    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/legacy-import/mark-complete-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to mark complete');
      dropFromList(data.data?.completed_ids || []);
      toast.success(data.message);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to mark complete');
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`DELETE ${ids.length} selected order(s)?\n\nThey will be moved to the Recycle Bin (restore or permanently delete them from there), and any product unit still marked Sold will be returned to stock.`)) return;
    setBulkBusy('delete');
    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/orders/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_ids: ids }),
      });
      const data = await res.json();
      const results: { id: number; success: boolean; message?: string }[] = data.data?.results || [];
      dropFromList(results.filter((r) => r.success).map((r) => r.id));
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete orders');
      toast.success(data.message);
      const failed = results.filter((r) => !r.success);
      if (failed.length) toast.error(`${failed.length} could not be deleted — ${failed[0].message}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete orders');
    } finally {
      setBulkBusy(null);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    const load = async () => {
      setLoading(true);
      try {
        const token = Cookies.get('auth_token');
        const res = await fetch(`${BACKEND_URL}/api/admin-panel/legacy-import/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setOrders(data.data || []);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || 'Failed to load pending profiles');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isSuperAdmin]);

  const markComplete = async (orderId: number) => {
    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/legacy-import/${orderId}/mark-complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update');
      dropFromList([orderId]);
      toast.success('Profile marked complete');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to mark complete');
    }
  };

  const deletePermanently = async (orderId: number, orderRef: string, customerName: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE order ${orderRef} (${customerName})?\n\nThis will completely remove the order, purchaser/grantor verification, installment ledger, and customer records. This action CANNOT be undone.`)) {
      return;
    }

    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/orders/${orderId}/permanent-delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete order');
      dropFromList([orderId]);
      toast.success(data.message || 'Order deleted permanently');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete order');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <Breadcrumb pageName="Pending Legacy Profiles" />
        <p className="text-gray-500 dark:text-gray-400">Only Super Admin (Head Office) can access this page.</p>
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return o.customer_name?.toLowerCase().includes(q) || o.order_ref?.toLowerCase().includes(q) || o.whatsapp_number?.includes(q);
  });
  // "Select all" works on what's currently visible (i.e. after the search filter).
  const allVisibleSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.id));
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((o) => next.delete(o.id));
      else filtered.forEach((o) => next.add(o.id));
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Pending Legacy Profiles" />

      <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Profiles Awaiting Media / Location</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Imported legacy customers still missing photos and/or GPS location. Open a profile in the
              verification screen to add them — the flag below clears automatically once saved.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search name, order ref, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm"
          />
        </div>

        {selected.size > 0 && (
          <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-500/30 dark:bg-blue-500/10">
            <div className="flex items-center gap-3 text-sm font-semibold text-blue-800 dark:text-blue-200">
              {selected.size} selected
              <button onClick={() => setSelected(new Set())} className="text-xs font-medium text-blue-600 hover:underline">
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkMarkComplete}
                disabled={!!bulkBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {bulkBusy === 'complete' && <Loader2 className="w-4 h-4 animate-spin" />}
                Mark Complete ({selected.size})
              </button>
              <button
                onClick={bulkDelete}
                disabled={!!bulkBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {bulkBusy === 'delete' && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete Permanently ({selected.size})
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">No pending legacy profiles — everything's been completed.</p>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold text-xs">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 cursor-pointer accent-red-600"
                    />
                  </th>
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Item</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Missing</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((o) => (
                  <tr key={o.id} className={selected.has(o.id) ? 'bg-blue-50/60 dark:bg-blue-500/5' : ''}>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${o.order_ref}`}
                        checked={selected.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        className="h-4 w-4 cursor-pointer accent-red-600"
                      />
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{o.order_ref}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.customer_name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.whatsapp_number}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.product_name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200 capitalize">{o.status}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {o.needs_media_upload && (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">
                            <ImageIcon className="w-3 h-3" /> Media
                          </span>
                        )}
                        {o.needs_location && (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">
                            <MapPin className="w-3 h-3" /> Location
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-3">
                        {/* The Installment Plan / ledger only renders on the Order
                            Details page (via PaymentDetailsSection) — the
                            Verification Details page never had that section, so
                            linking there left admins unable to see/fix the ledger
                            from this list. Order Details also already has the
                            documents + location editing this list is meant to
                            drive completion of. */}
                        <Link href={`/orders/${o.id}`} className="text-blue-600 font-semibold hover:underline">
                          Open Profile
                        </Link>
                        <button
                          onClick={() => markComplete(o.id)}
                          className="text-green-600 font-semibold hover:underline"
                        >
                          Mark Complete
                        </button>
                        <button
                          onClick={() => deletePermanently(o.id, o.order_ref, o.customer_name)}
                          className="text-red-600 font-semibold hover:underline"
                        >
                          Delete Permanently
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

