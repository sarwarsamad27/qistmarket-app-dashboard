"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { KeyRound, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { roleLabel } from "@/lib/roleLabels";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

// Fail-open by design (see permissionMiddleware.js): an unset key means
// "allowed". These toggles only ever set explicit true/false — they never
// clear the flag back to "unset" from the UI, matching the middleware's model.
const CURATED_KEYS = [
  { key: "reschedule_installments", label: "Reschedule Installments", description: "Allows moving an installment's due date from the Installment Aging page." },
  { key: "manage_outlets", label: "Manage Outlets", description: "Allows creating and editing outlets from Outlets Management." },
  { key: "approve_discounts", label: "Approve Discounts", description: "Allows approving or rejecting discount requests." },
  { key: "manage_inventory", label: "Manage Inventory", description: "Allows marking inventory items as damaged from Inventory & Warehouse." },
];

interface UserRow {
  id: number;
  full_name: string;
  username: string;
  role: string;
  permissions: Record<string, any> | null;
}

export default function AdminPermissionsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "200", search, sortBy: "full_name", sortDir: "asc" });
    fetch(`${BACKEND_URL}/api/users?${params.toString()}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setUsers(json.data.users || []); })
      .catch((err) => console.error("Failed to load users:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const isAllowed = (user: UserRow, key: string) => user.permissions?.[key] !== false;

  const toggle = async (key: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      // Merge, never blind-replace — this field is shared with the
      // existing User Management permissions flow (create_order, etc).
      const merged = { ...(selected.permissions || {}), [key]: !isAllowed(selected, key) };
      const res = await fetch(`${BACKEND_URL}/api/users/${selected.id}/permissions`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ permissions_json: merged }),
      });
      if (!res.ok) throw new Error("Failed to update permission.");
      toast.success("Permission updated.");
      setSelected({ ...selected, permissions: merged });
      setUsers((prev) => prev.map((u) => (u.id === selected.id ? { ...u, permissions: merged } : u)));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Permissions" />
      <PageHeader icon={KeyRound} title="Permissions" subtitle="Fail-open by design — unset permissions stay allowed; only explicit restrictions block access." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <div className="max-h-[500px] overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            {loading ? (
              <p className="p-4 text-center text-sm text-gray-400">Loading...</p>
            ) : users.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">No users found.</p>
            ) : (
              users.map((u) => (
                <button key={u.id} onClick={() => setSelected(u)} className={`block w-full border-b border-slate-50 p-3 text-left text-sm transition last:border-0 dark:border-white/5 ${selected?.id === u.id ? "bg-[#ff3d3d]/5" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}>
                  <p className="font-semibold text-dark dark:text-white">{u.full_name}</p>
                  <p className="text-xs text-gray-400">@{u.username} · {roleLabel(u.role)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-gray-400 dark:border-white/10">
              Select a user to manage their permissions.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <h2 className="mb-1 text-sm font-bold text-dark dark:text-white">{selected.full_name}</h2>
              <p className="mb-4 text-xs text-gray-400">@{selected.username} · {roleLabel(selected.role)}</p>
              <div className="space-y-3">
                {CURATED_KEYS.map((k) => {
                  const allowed = isAllowed(selected, k.key);
                  return (
                    <div key={k.key} className="flex items-center justify-between rounded-xl border border-slate-100 p-4 dark:border-white/10">
                      <div>
                        <p className="text-sm font-semibold text-dark dark:text-white">{k.label}</p>
                        <p className="text-xs text-gray-400">{k.description}</p>
                      </div>
                      <button
                        disabled={saving}
                        onClick={() => toggle(k.key)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${allowed ? "bg-emerald-500" : "bg-gray-300 dark:bg-white/20"} disabled:opacity-50`}
                      >
                        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${allowed ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
