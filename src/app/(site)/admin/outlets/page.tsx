"use client";

import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Store, Plus, Search, Warehouse, PackageCheck, Wallet, Pencil, Users2, X, Trash2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface Outlet {
  id: number;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: string;
  type: string;
}

interface Performance {
  outlet_id: number;
  totalOrders: number;
  statusBreakdown: Record<string, number>;
  pendingCash: number;
}

interface AttendanceRow { outlet_id: number; outlet_name: string; totalStaff: number; present: number; absent: number; notMarked: number; unlinkedOfficers: number }
interface StaffMember { id: number; full_name: string; username: string; phone: string | null; status: string; is_online: boolean; role: string; has_employee_record: boolean }

export default function AdminOutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [performance, setPerformance] = useState<Record<number, Performance>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState({ code: "", name: "", address: "", phone: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState<Record<number, AttendanceRow>>({});
  const [staffPanel, setStaffPanel] = useState<Outlet | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${BACKEND_URL}/api/outlets`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/admin-panel/outlets/performance`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND_URL}/api/admin-panel/attendance`, { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([outletsJson, perfJson, attendanceJson]) => {
        if (outletsJson.success) setOutlets(outletsJson.outlets || []);
        if (perfJson.success) {
          const map: Record<number, Performance> = {};
          for (const p of perfJson.data || []) map[p.outlet_id] = p;
          setPerformance(map);
        }
        if (attendanceJson.success) {
          const map: Record<number, AttendanceRow> = {};
          for (const a of attendanceJson.data || []) map[a.outlet_id] = a;
          setAttendance(map);
        }
      })
      .catch((err) => console.error("Failed to load outlets:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openStaffPanel = (outlet: Outlet) => {
    setStaffPanel(outlet);
    setStaffLoading(true);
    fetch(`${BACKEND_URL}/api/admin-panel/outlets/staff?outlet_id=${outlet.id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setStaff(json.data || []); })
      .catch((err) => console.error("Failed to load outlet staff:", err))
      .finally(() => setStaffLoading(false));
  };

  const totals = useMemo(() => {
    const list = Object.values(performance);
    return {
      outlets: outlets.filter((o) => o.type !== "warehouse").length,
      warehouses: outlets.filter((o) => o.type === "warehouse").length,
      totalOrders: list.reduce((sum, p) => sum + p.totalOrders, 0),
      pendingCash: list.reduce((sum, p) => sum + p.pendingCash, 0),
    };
  }, [outlets, performance]);

  const filtered = outlets.filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || (o.address || "").toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", address: "", phone: "", status: "active" });
    setShowForm(true);
  };

  const openEdit = (o: Outlet) => {
    setEditing(o);
    setForm({ code: o.code, name: o.name, address: o.address || "", phone: o.phone || "", status: o.status });
    setShowForm(true);
  };

  const handleDelete = async (o: Outlet) => {
    if (!confirm(`Move "${o.name}" to the Recycle Bin? It will disappear from outlet lists everywhere until restored.`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlets/${o.id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Delete failed.");
      toast.success(data.message || "Outlet moved to Recycle Bin.");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `${BACKEND_URL}/api/outlets/${editing.id}` : `${BACKEND_URL}/api/outlets`;
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Save failed.");
      toast.success(editing ? "Outlet updated." : "Outlet created.");
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Outlets Management" />
      <PageHeader
        icon={Store}
        title="Outlets Management"
        subtitle="Every outlet and warehouse, with live performance at a glance."
        actions={
          <button onClick={openCreate} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90">
            <Plus className="size-4" /> Add Outlet
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Store} label="Outlets" value={totals.outlets} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
        <StatCard icon={Warehouse} label="Warehouses" value={totals.warehouses} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
        <StatCard icon={PackageCheck} label="Total Orders" value={totals.totalOrders.toLocaleString()} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
        <StatCard icon={Wallet} label="Pending Cash" value={PKR(totals.pendingCash)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h2 className="mb-4 text-sm font-bold text-dark dark:text-white">{editing ? `Edit ${editing.name}` : "Add New Outlet"}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Code *" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <button type="submit" disabled={saving} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{saving ? "Saving..." : editing ? "Update Outlet" : "Create Outlet"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search outlet name, code, address..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Store} title={search ? "No matching outlets" : "No outlets found"} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 font-bold">Outlet</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Total Orders</th>
                <th className="px-4 py-3 text-right font-bold">Delivered</th>
                <th className="px-4 py-3 text-right font-bold">Pending Cash</th>
                <th className="px-4 py-3 font-bold">Attendance Today</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const p = performance[o.id];
                const a = attendance[o.id];
                const delivered = (p?.statusBreakdown?.delivered || 0) + (p?.statusBreakdown?.completed || 0);
                return (
                  <tr key={o.id} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-dark dark:text-white">{o.name}</p>
                      <p className="text-xs text-gray-400">{o.code} {o.address ? `· ${o.address}` : ""} {o.phone ? `· ${o.phone}` : ""}</p>
                    </td>
                    <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{o.type}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${o.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{(p?.totalOrders || 0).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600 font-semibold">{delivered.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-orange-600">{PKR(p?.pendingCash || 0)}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {a ? <span><span className="font-semibold text-emerald-600">{a.present}</span>/{a.totalStaff} present</span> : "—"}
                      {a && a.unlinkedOfficers > 0 && <p className="mt-0.5 text-[10px] font-bold text-amber-600">+{a.unlinkedOfficers} officer(s) not in HR</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => openStaffPanel(o)} className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:underline dark:text-gray-300">
                          <Users2 className="size-3.5" /> Staff
                        </button>
                        <button onClick={() => openEdit(o)} className="inline-flex items-center gap-1 text-xs font-bold text-[#ff3d3d] hover:underline">
                          <Pencil className="size-3.5" /> Edit
                        </button>
                        <button onClick={() => handleDelete(o)} className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-red-600 hover:underline">
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {staffPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-dark dark:text-white">{staffPanel.name} — Staff</h2>
              <button onClick={() => setStaffPanel(null)} className="text-gray-400 hover:text-gray-600"><X className="size-4" /></button>
            </div>
            {staffLoading ? (
              <p className="py-6 text-center text-sm text-gray-400">Loading...</p>
            ) : staff.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No staff assigned to this outlet.</p>
            ) : (
              <div className="space-y-2">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-sm dark:border-white/10">
                    <div>
                      <p className="font-semibold text-dark dark:text-white">{s.full_name}</p>
                      <p className="text-xs text-gray-400">@{s.username} · {s.role}{s.phone ? ` · ${s.phone}` : ""}</p>
                      {!s.has_employee_record && <p className="mt-0.5 text-[10px] font-bold text-amber-600">⚠ No HR employee record — missing from Attendance</p>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.is_online ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" : "bg-gray-100 text-gray-500 dark:bg-white/10"}`}>{s.is_online ? "Online" : "Offline"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-500">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
    </div>
  );
}
