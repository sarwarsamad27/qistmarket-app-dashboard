'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Link from 'next/link';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from "../../../../../contexts/AuthContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type BinOrder = {
  id: number;
  order_ref: string;
  customer_name: string;
  whatsapp_number: string;
  product_name: string;
  total_amount: number;
  status: string;
  deleted_at: string;
  deleted_by_name: string | null;
};

type BinOutlet = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  type: string;
  deleted_at: string;
  deleted_by_name: string | null;
  order_count: number;
  user_count: number;
};

export default function RecycleBinPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || "").toLowerCase() === "super admin";

  const [tab, setTab] = useState<'orders' | 'outlets'>('orders');

  const [orders, setOrders] = useState<BinOrder[]>([]);
  const [outlets, setOutlets] = useState<BinOutlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get('auth_token')}` });

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'orders') {
        const res = await fetch(`${BACKEND_URL}/api/admin-panel/orders/recycle-bin`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
        setOrders(data.orders || []);
      } else {
        const res = await fetch(`${BACKEND_URL}/api/outlets/recycle-bin`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
        setOutlets(data.outlets || []);
      }
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to load Recycle Bin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, tab]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.customer_name?.toLowerCase().includes(q) ||
      o.order_ref?.toLowerCase().includes(q) ||
      o.whatsapp_number?.includes(q)
    );
  }, [orders, search]);

  const filteredOutlets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return outlets;
    return outlets.filter((o) =>
      o.name?.toLowerCase().includes(q) ||
      o.code?.toLowerCase().includes(q) ||
      (o.address || '').toLowerCase().includes(q)
    );
  }, [outlets, search]);

  const filtered = tab === 'orders' ? filteredOrders : filteredOutlets;

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) return new Set();
      return new Set(filtered.map((o) => o.id));
    });
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const restore = async (ids: number[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const url = tab === 'orders'
        ? `${BACKEND_URL}/api/admin-panel/orders/recycle-bin/restore`
        : `${BACKEND_URL}/api/outlets/recycle-bin/restore`;
      const bodyKey = tab === 'orders' ? 'orderIds' : 'outletIds';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ [bodyKey]: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to restore');
      toast.success(data.message || `${tab === 'orders' ? 'Order' : 'Outlet'}(s) restored`);
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to restore');
    } finally {
      setBusy(false);
    }
  };

  const deletePermanently = async (ids: number[], confirmMessage: string) => {
    if (ids.length === 0) return;
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const url = tab === 'orders'
        ? `${BACKEND_URL}/api/admin-panel/orders/recycle-bin/permanent-delete`
        : `${BACKEND_URL}/api/outlets/recycle-bin/permanent-delete`;
      const bodyKey = tab === 'orders' ? 'orderIds' : 'outletIds';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ [bodyKey]: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete');
      toast.success(data.message || `${tab === 'orders' ? 'Order' : 'Outlet'}(s) permanently deleted`);
      if (data.results) {
        data.results.filter((r: any) => !r.success).forEach((r: any) => toast.error(r.message));
      }
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to permanently delete');
    } finally {
      setBusy(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <Breadcrumb pageName="Recycle Bin" />
        <p className="text-gray-500 dark:text-gray-400">Only Super Admin (Head Office) can access this page.</p>
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Recycle Bin" />

      <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8">
        <div className="mb-6 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => { setTab('orders'); setSearch(''); }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === 'orders' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Deleted Orders
          </button>
          <button
            onClick={() => { setTab('outlets'); setSearch(''); }}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === 'outlets' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            Deleted Outlets
          </button>
        </div>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{tab === 'orders' ? 'Deleted Orders' : 'Deleted Outlets'}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {tab === 'orders'
                ? 'Orders deleted from the app land here first. Restore to bring one back exactly as it was, or delete permanently to remove it and all its records for good — that step cannot be undone.'
                : 'Outlets deleted from the app land here first. Restore to bring one back exactly as it was, or delete permanently to remove it together with its inventory, cash, expenses and vendors for good (its staff accounts, orders and customer ledgers are kept, unlinked) — that step cannot be undone.'}
            </p>
          </div>
          <input
            type="text"
            placeholder={tab === 'orders' ? 'Search name, order ref, phone…' : 'Search name, code, address…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm"
          />
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-500/10 px-4 py-3">
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">{selectedCount} selected</span>
            <div className="flex items-center gap-4">
              <button
                disabled={busy}
                onClick={() => restore(Array.from(selectedIds))}
                className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 font-semibold hover:underline disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" /> Restore Selected ({selectedCount})
              </button>
              <button
                disabled={busy}
                onClick={() => deletePermanently(
                  Array.from(selectedIds),
                  tab === 'orders'
                    ? `Permanently delete ${selectedCount} order(s)? This will remove them and all associated records (verification, ledger, deliveries, payments, etc.) for good. This action CANNOT be undone.`
                    : `Permanently delete ${selectedCount} outlet(s)? This deletes the outlet together with its inventory, cash, expenses, vendors and bank accounts. Its staff accounts and orders are kept (unlinked from the outlet). This action CANNOT be undone.`
                )}
                className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400 font-semibold hover:underline disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Delete Permanently ({selectedCount})
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">Recycle Bin is empty.</p>
        ) : tab === 'orders' ? (
          <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold text-xs">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Item</th>
                  <th className="py-3 px-3">Deleted At</th>
                  <th className="py-3 px-3">Deleted By</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className={selectedIds.has(o.id) ? 'bg-blue-50/60 dark:bg-blue-500/5' : undefined}>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select order ${o.order_ref}`}
                      />
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">
                      <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">{o.order_ref}</Link>
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.customer_name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.whatsapp_number}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.product_name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{new Date(o.deleted_at).toLocaleString()}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.deleted_by_name || '—'}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-3">
                        <button
                          disabled={busy}
                          onClick={() => restore([o.id])}
                          className="inline-flex items-center gap-1 text-green-600 font-semibold hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => deletePermanently(
                            [o.id],
                            `Permanently delete order ${o.order_ref} (${o.customer_name})? This will remove it and all associated records (verification, ledger, deliveries, payments, etc.) for good. This action CANNOT be undone.`
                          )}
                          className="inline-flex items-center gap-1 text-red-600 font-semibold hover:underline disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold text-xs">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Address</th>
                  <th className="py-3 px-3">Linked Records</th>
                  <th className="py-3 px-3">Deleted At</th>
                  <th className="py-3 px-3">Deleted By</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOutlets.map((o) => (
                  <tr key={o.id} className={selectedIds.has(o.id) ? 'bg-blue-50/60 dark:bg-blue-500/5' : undefined}>
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select outlet ${o.name}`}
                      />
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{o.code}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.name}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.address || '—'}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                      {o.order_count > 0 || o.user_count > 0
                        ? <span className="text-amber-600 font-semibold">{o.order_count} order(s), {o.user_count} staff</span>
                        : <span className="text-gray-400">none</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{new Date(o.deleted_at).toLocaleString()}</td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{o.deleted_by_name || '—'}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-3">
                        <button
                          disabled={busy}
                          onClick={() => restore([o.id])}
                          className="inline-flex items-center gap-1 text-green-600 font-semibold hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => deletePermanently(
                            [o.id],
                            `Permanently delete outlet ${o.name} (${o.code})? ${o.order_count > 0 || o.user_count > 0 ? `It still has ${o.order_count} order(s) and ${o.user_count} staff — deletion will be refused until those are cleared.` : 'This action CANNOT be undone.'}`
                          )}
                          className="inline-flex items-center gap-1 text-red-600 font-semibold hover:underline disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
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
