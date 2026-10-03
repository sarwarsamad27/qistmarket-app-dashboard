'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Link from 'next/link';
import { Loader2, RotateCcw, Trash2, Search, X } from 'lucide-react';
import { useAuth } from "../../../../../contexts/AuthContext";
import { apiErrorMessage } from "@/lib/apiErrors";

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

type BinUser = {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  role: string | null;
  outlet: string | null;
  deleted_at: string;
  deleted_by_name: string | null;
};

// Backend linkedRecords report: where a record is still used.
type LinkItem = { table: string; label: string; count: number; via?: string };
type Links = { blocking: LinkItem[]; removed: LinkItem[]; unlinked: LinkItem[] };

type Tab = 'orders' | 'outlets' | 'users';

const ENDPOINTS: Record<Tab, { list: string; restore: string; remove: string; bodyKey: string; links?: (id: number) => string }> = {
  orders: {
    list: '/api/admin-panel/orders/recycle-bin',
    restore: '/api/admin-panel/orders/recycle-bin/restore',
    remove: '/api/admin-panel/orders/recycle-bin/permanent-delete',
    bodyKey: 'orderIds',
  },
  outlets: {
    list: '/api/outlets/recycle-bin',
    restore: '/api/outlets/recycle-bin/restore',
    remove: '/api/outlets/recycle-bin/permanent-delete',
    bodyKey: 'outletIds',
    links: (id) => `/api/outlets/recycle-bin/${id}/links`,
  },
  users: {
    list: '/api/users-recycle-bin',
    restore: '/api/users-recycle-bin/restore',
    remove: '/api/users-recycle-bin/permanent-delete',
    bodyKey: 'userIds',
    links: (id) => `/api/users-recycle-bin/${id}/links`,
  },
};

const LinkGroup = ({ title, items, tone }: { title: string; items: LinkItem[]; tone: 'red' | 'gray' | 'blue' }) => {
  if (!items.length) return null;
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300';
  return (
    <div className="mb-4">
      <h4 className={`mb-1.5 text-sm font-bold ${color}`}>{title}</h4>
      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
        {items.map((it, i) => (
          <li key={i} className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 px-3 py-1.5 dark:bg-gray-800">
            <span>{it.label}{it.via ? <span className="text-xs text-gray-400"> — via {it.via}</span> : null}</span>
            <span className="font-semibold">{it.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function RecycleBinPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || "").toLowerCase() === "super admin";

  const [tab, setTab] = useState<Tab>('orders');

  const [orders, setOrders] = useState<BinOrder[]>([]);
  const [outlets, setOutlets] = useState<BinOutlet[]>([]);
  const [users, setUsers] = useState<BinUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  // "Where is it still used?" popup — opened by the button, or by a refused delete.
  const [linksView, setLinksView] = useState<{ title: string; message?: string; links: Links | null; loading: boolean } | null>(null);

  const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get('auth_token')}` });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}${ENDPOINTS[tab].list}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load');
      if (tab === 'orders') setOrders(data.orders || []);
      else if (tab === 'outlets') setOutlets(data.outlets || []);
      else setUsers(data.users || []);
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

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.full_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      (u.phone || '').includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  }, [users, search]);

  const filtered: { id: number }[] = tab === 'orders' ? filteredOrders : tab === 'outlets' ? filteredOutlets : filteredUsers;

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));

  const toggleAll = () => {
    setSelectedIds(() => {
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

  const noun = tab === 'orders' ? 'Order' : tab === 'outlets' ? 'Outlet' : 'User';

  const restore = async (ids: number[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}${ENDPOINTS[tab].restore}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ [ENDPOINTS[tab].bodyKey]: ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to restore');
      toast.success(data.message || `${noun}(s) restored`);
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to restore');
    } finally {
      setBusy(false);
    }
  };

  const showLinks = async (id: number, title: string) => {
    const linksUrl = ENDPOINTS[tab].links;
    if (!linksUrl) return;
    setLinksView({ title, links: null, loading: true });
    try {
      const res = await fetch(`${BACKEND_URL}${linksUrl(id)}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to check');
      setLinksView({ title, links: data.links, loading: false });
    } catch (err: any) {
      setLinksView(null);
      toast.error(err.message || 'Failed to check where it is used');
    }
  };

  const deletePermanently = async (ids: number[], confirmMessage: string) => {
    if (ids.length === 0) return;
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}${ENDPOINTS[tab].remove}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ [ENDPOINTS[tab].bodyKey]: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to delete", data));
      const failed = (data.results || []).filter((r: any) => !r.success);
      if (failed.length < ids.length) toast.success(data.message || `${noun}(s) permanently deleted`);
      // A refused delete opens the full "where is it used" breakdown, so it can be
      // sorted out right here instead of guessing from a one-line error.
      const withLinks = failed.find((r: any) => r.links);
      if (withLinks) {
        setLinksView({ title: `Could not delete permanently`, message: withLinks.message, links: withLinks.links, loading: false });
        failed.filter((r: any) => r !== withLinks).forEach((r: any) => toast.error(r.message, { duration: 8000 }));
      } else {
        failed.forEach((r: any) => toast.error(r.message, { duration: 8000 }));
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
  const tabButton = (t: Tab, label: string) => (
    <button
      onClick={() => { setTab(t); setSearch(''); }}
      className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${tab === t ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
    >
      {label}
    </button>
  );
  const bulkConfirm =
    tab === 'orders'
      ? `Permanently delete ${selectedCount} order(s)? This will remove them and all associated records (verification, ledger, deliveries, payments, etc.) for good. This action CANNOT be undone.`
      : tab === 'outlets'
        ? `Permanently delete ${selectedCount} outlet(s)? This deletes the outlet together with its inventory, cash, expenses, vendors and bank accounts. Its staff accounts and orders are kept (unlinked from the outlet). This action CANNOT be undone.`
        : `Permanently delete ${selectedCount} user account(s)? Only accounts nothing else uses are removed — the rest stay in the Recycle Bin and you'll see what still uses them. This action CANNOT be undone.`;

  const actions = (id: number, label: string, confirmMessage: string) => (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <button
        disabled={busy}
        onClick={() => restore([id])}
        className="inline-flex items-center gap-1 text-green-600 font-semibold hover:underline disabled:opacity-50"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Restore
      </button>
      {ENDPOINTS[tab].links && (
        <button
          disabled={busy}
          onClick={() => showLinks(id, `Where "${label}" is used`)}
          className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline disabled:opacity-50"
        >
          <Search className="w-3.5 h-3.5" /> Where used
        </button>
      )}
      <button
        disabled={busy}
        onClick={() => deletePermanently([id], confirmMessage)}
        className="inline-flex items-center gap-1 text-red-600 font-semibold hover:underline disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
      </button>
    </div>
  );

  const th = "py-3 px-3";
  const td = "py-2 px-3 text-gray-700 dark:text-gray-200";
  const selectAll = (
    <th className="py-3 px-3 w-10">
      <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Select all" />
    </th>
  );
  const rowClass = (id: number) => (selectedIds.has(id) ? 'bg-blue-50/60 dark:bg-blue-500/5' : undefined);
  const selectOne = (id: number, label: string) => (
    <td className="py-2 px-3">
      <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleOne(id)} aria-label={`Select ${label}`} />
    </td>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Recycle Bin" />

      <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8">
        <div className="mb-6 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800">
          {tabButton('orders', 'Deleted Orders')}
          {tabButton('outlets', 'Deleted Outlets')}
          {tabButton('users', 'Deleted Users')}
        </div>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
              {tab === 'orders' ? 'Deleted Orders' : tab === 'outlets' ? 'Deleted Outlets' : 'Deleted Users'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {tab === 'orders'
                ? 'Orders deleted from the app land here first. Restore to bring one back exactly as it was, or delete permanently to remove it and all its records for good — that step cannot be undone.'
                : tab === 'outlets'
                  ? 'Outlets deleted from the app land here first. Wherever they still appear they read "(Deleted)". Restore to bring one back exactly as it was, or delete permanently to remove it together with its inventory, cash, expenses and vendors for good (its staff accounts, orders and customer ledgers are kept, unlinked) — that step cannot be undone. "Where used" shows exactly what would block it.'
                  : 'Staff accounts of any role (CSR, Sub Admin, verification / delivery / recovery officer …) deleted from User Management land here. They can\'t log in or be selected anywhere; every order, payment and report they\'re part of still shows them as "(Deleted)", read only. Restore brings one back as it was. "Where used" shows what still points at an account — only an account nothing uses can be deleted permanently.'}
            </p>
          </div>
          <input
            type="text"
            placeholder={tab === 'orders' ? 'Search name, order ref, phone…' : tab === 'outlets' ? 'Search name, code, address…' : 'Search name, username, phone, role…'}
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
                onClick={() => deletePermanently(Array.from(selectedIds), bulkConfirm)}
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
                  {selectAll}
                  <th className={th}>Order Ref</th>
                  <th className={th}>Name</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Item</th>
                  <th className={th}>Deleted At</th>
                  <th className={th}>Deleted By</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className={rowClass(o.id)}>
                    {selectOne(o.id, `order ${o.order_ref}`)}
                    <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">
                      <Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline">{o.order_ref}</Link>
                    </td>
                    <td className={td}>{o.customer_name}</td>
                    <td className={td}>{o.whatsapp_number}</td>
                    <td className={td}>{o.product_name}</td>
                    <td className={td}>{new Date(o.deleted_at).toLocaleString()}</td>
                    <td className={td}>{o.deleted_by_name || '—'}</td>
                    <td className="py-2 px-3">
                      {actions(o.id, o.order_ref, `Permanently delete order ${o.order_ref} (${o.customer_name})? This will remove it and all associated records (verification, ledger, deliveries, payments, etc.) for good. This action CANNOT be undone.`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === 'outlets' ? (
          <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold text-xs">
                  {selectAll}
                  <th className={th}>Code</th>
                  <th className={th}>Name</th>
                  <th className={th}>Address</th>
                  <th className={th}>Linked Records</th>
                  <th className={th}>Deleted At</th>
                  <th className={th}>Deleted By</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredOutlets.map((o) => (
                  <tr key={o.id} className={rowClass(o.id)}>
                    {selectOne(o.id, `outlet ${o.name}`)}
                    <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{o.code}</td>
                    <td className={td}>{o.name}</td>
                    <td className={td}>{o.address || '—'}</td>
                    <td className={td}>
                      {o.order_count > 0 || o.user_count > 0
                        ? <span className="text-amber-600 font-semibold">{o.order_count} order(s), {o.user_count} staff</span>
                        : <span className="text-gray-400">none</span>}
                    </td>
                    <td className={td}>{new Date(o.deleted_at).toLocaleString()}</td>
                    <td className={td}>{o.deleted_by_name || '—'}</td>
                    <td className="py-2 px-3">
                      {actions(o.id, o.name, `Permanently delete outlet ${o.name} (${o.code})? Its inventory, cash, expenses, vendors and bank accounts go with it; staff accounts and orders are kept, unlinked. If anything else still uses it, nothing is deleted and you'll see what. This action CANNOT be undone.`)}
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
                  {selectAll}
                  <th className={th}>Name</th>
                  <th className={th}>Username</th>
                  <th className={th}>Role</th>
                  <th className={th}>Outlet</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Deleted At</th>
                  <th className={th}>Deleted By</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={rowClass(u.id)}>
                    {selectOne(u.id, `user ${u.full_name}`)}
                    <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">{u.full_name}</td>
                    <td className={td}>@{u.username}</td>
                    <td className={td}>{u.role || '—'}</td>
                    <td className={td}>{u.outlet || '—'}</td>
                    <td className={td}>{u.phone || '—'}</td>
                    <td className={td}>{new Date(u.deleted_at).toLocaleString()}</td>
                    <td className={td}>{u.deleted_by_name || '—'}</td>
                    <td className="py-2 px-3">
                      {actions(u.id, u.full_name, `Permanently delete ${u.full_name} (@${u.username})? Only possible if nothing else uses this account — otherwise nothing is deleted and you'll see what still uses it. This action CANNOT be undone.`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {linksView && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setLinksView(null)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-dark" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">{linksView.title}</h3>
              <button onClick={() => setLinksView(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {linksView.message && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{linksView.message}</p>}
            {linksView.loading || !linksView.links ? (
              <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</p>
            ) : (
              <>
                {linksView.links.blocking.length === 0 ? (
                  <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300">Nothing blocks a permanent delete.</p>
                ) : null}
                <LinkGroup title="Blocking the delete — clear or move these first" items={linksView.links.blocking} tone="red" />
                <LinkGroup title="Deleted together with it" items={linksView.links.removed} tone="gray" />
                <LinkGroup title="Kept, just unlinked from it" items={linksView.links.unlinked} tone="blue" />
                {linksView.links.blocking.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Not urgent: while it stays in the Recycle Bin it already can&apos;t be used anywhere — it only shows, marked &quot;(Deleted)&quot;, where it was part of past records.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
