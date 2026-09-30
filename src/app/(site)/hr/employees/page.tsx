"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { hrFetch } from "@/lib/employee-api";
import {
  Plus, Eye, Search, Filter, Download, CheckSquare,
  Mail, Key, ToggleLeft, X, ChevronDown, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/Modals/ConfirmModal";

interface Employee {
  id: number; employee_id: string; full_name: string; department?: string;
  designation?: string; portal_active: boolean; status: string; phone?: string;
  email?: string; outlet?: { name: string }; device_user_id?: string | null;
}

export default function HrEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; action: string; message: string }>({ open: false, action: "", message: "" });
  // Employees queued for deletion — one (row button) or the current selection.
  const [deleteTarget, setDeleteTarget] = useState<Employee[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    hrFetch("/employees").then((r) => setEmployees(r.employees)).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return ["all", ...Array.from(depts)] as string[];
  }, [employees]);

  const filtered = useMemo(() => employees.filter((e) => {
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return e.full_name?.toLowerCase().includes(s) ||
      e.employee_id?.toLowerCase().includes(s) ||
      e.department?.toLowerCase().includes(s) ||
      e.designation?.toLowerCase().includes(s) ||
      e.phone?.includes(s);
  }), [employees, search, deptFilter]);

  const toggleSelect = (id: number) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleSelectAll = () => {
    if (selectAll) { setSelectedIds([]); setSelectAll(false); }
    else { setSelectedIds(filtered.map((e) => e.id)); setSelectAll(true); }
  };
  const clearSelection = () => { setSelectedIds([]); setSelectAll(false); };

  const handleBulk = async () => {
    if (selectedIds.length === 0) { toast.error("No employees selected"); return; }
    const action = confirmAction.action;
    setConfirmAction({ ...confirmAction, open: false });

    try {
      for (const id of selectedIds) {
        if (action === "toggle_portal") {
          const emp = employees.find((e) => e.id === id);
          if (emp) await hrFetch(`/employees/${id}/portal`, { method: "PATCH", body: JSON.stringify({ portal_active: !emp.portal_active }) });
        } else if (action === "reset_password") {
          await hrFetch(`/employees/${id}/reset-password`, { method: "POST" });
        } else if (action === "send_credentials") {
          await hrFetch(`/employees/${id}/send-credentials`, { method: "POST" });
        }
      }
      toast.success(`Bulk action completed for ${selectedIds.length} employees`);
      clearSelection();
      load();
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.length) return;
    setDeleting(true);
    let deleted = 0;
    const refused: string[] = [];
    for (const emp of deleteTarget) {
      try {
        await hrFetch(`/employees/${emp.id}`, { method: "DELETE" });
        deleted += 1;
      } catch (err) {
        refused.push((err as Error).message);
      }
    }
    setDeleting(false);
    setDeleteTarget(null);
    if (deleted) toast.success(`${deleted} employee(s) deleted`);
    refused.forEach((m) => toast.error(m, { duration: 8000 }));
    clearSelection();
    load();
  };

  const exportCsv = () => {
    const headers = ["ID", "Employee ID", "Name", "Department", "Designation", "Phone", "Email", "Portal", "Status", "Outlet"];
    const rows = filtered.map((e) => [
      e.id, e.employee_id, e.full_name, e.department || "", e.designation || "",
      e.phone || "", e.email || "", e.portal_active ? "Active" : "Inactive", e.status, e.outlet?.name || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const openBulkConfirm = (action: string) => {
    const messages: Record<string, string> = {
      toggle_portal: `Toggle portal access for ${selectedIds.length} employee(s)?`,
      reset_password: `Reset passwords for ${selectedIds.length} employee(s)? Passwords will be shown one by one.`,
      send_credentials: `Send credentials via WhatsApp to ${selectedIds.length} employee(s)?`,
    };
    setConfirmAction({ open: true, action, message: messages[action] || `Apply action to ${selectedIds.length} employee(s)?` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Employees</h1>
          <p className="text-sm text-gray-500">{employees.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <Link href="/hr/employees/create" className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Add Employee
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, department, phone..." className="w-full rounded-lg border border-stroke py-2 pl-9 pr-3 text-sm dark:border-stroke-dark dark:bg-dark-2" />
        </div>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="appearance-none rounded-lg border border-stroke py-2 pl-9 pr-8 text-sm dark:border-stroke-dark dark:bg-dark-2">
            <option value="all">All Departments</option>
            {departments.filter((d) => d !== "all").map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">{selectedIds.length}</span>
            <span className="text-gray-500">selected</span>
            <div className="ml-2 flex gap-1">
              <button onClick={() => openBulkConfirm("toggle_portal")} className="rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-dark-3"><ToggleLeft className="mr-1 inline h-3 w-3" />Toggle Portal</button>
              <button onClick={() => openBulkConfirm("reset_password")} className="rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-dark-3"><Key className="mr-1 inline h-3 w-3" />Reset Pass</button>
              <button onClick={() => openBulkConfirm("send_credentials")} className="rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-dark-3"><Mail className="mr-1 inline h-3 w-3" />Send Creds</button>
              <button onClick={() => setDeleteTarget(employees.filter((e) => selectedIds.includes(e.id)))} className="rounded bg-white px-2 py-1 text-xs text-red shadow-sm dark:bg-dark-3"><Trash2 className="mr-1 inline h-3 w-3" />Delete</button>
              <button onClick={clearSelection} className="rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-dark-3"><X className="h-3 w-3" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
              <th className="w-10 px-3 py-3"><input type="checkbox" checked={selectAll && filtered.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded text-primary" /></th>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Designation</th>
              <th className="px-4 py-3 text-left">Outlet</th>
              <th className="px-4 py-3 text-center">Portal</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Loading...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                {search || deptFilter !== "all" ? "No employees match your filters." : "No employees yet. Create your first employee."}
              </td></tr>
            )}
            {filtered.map((emp) => {
              const sel = selectedIds.includes(emp.id);
              return (
                <tr key={emp.id} className={`border-b border-stroke transition-colors dark:border-stroke-dark ${sel ? "bg-primary/5" : "hover:bg-gray-1 dark:hover:bg-dark-3"}`}>
                  <td className="px-3 py-3"><input type="checkbox" checked={sel} onChange={() => toggleSelect(emp.id)} className="h-4 w-4 rounded text-primary" /></td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-dark dark:text-white">{emp.full_name}</p>
                      <p className="text-xs font-mono text-gray-500">{emp.employee_id}{emp.device_user_id && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" title="Biometric device user ID">Device ID {emp.device_user_id}</span>}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.department || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.designation || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.outlet?.name || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${emp.portal_active ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                      {emp.portal_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      emp.status === "active" ? "bg-green/10 text-green" :
                      emp.status === "suspended" ? "bg-yellow-light-4/20 text-yellow-dark" : "bg-red/10 text-red"
                    }`}>{emp.status}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Link href={`/hr/employees/${emp.id}`} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-2 dark:hover:bg-dark-3" title="View Details">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button onClick={() => setDeleteTarget([emp])} className="rounded-lg p-1.5 text-gray-500 hover:bg-red/10 hover:text-red" title="Delete Employee">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk confirm modal */}
      <ConfirmModal
        open={confirmAction.open}
        onClose={() => setConfirmAction({ ...confirmAction, open: false })}
        onConfirm={handleBulk}
        title={`Bulk: ${confirmAction.action.replace(/_/g, " ")}`}
        message={confirmAction.message}
        confirmText={`Apply to ${selectedIds.length}`}
        variant="info"
      />

      {/* Delete confirm modal */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={deleteTarget?.length === 1 ? `Delete ${deleteTarget[0].full_name}?` : `Delete ${deleteTarget?.length || 0} employees?`}
        message={`This permanently deletes ${deleteTarget?.length === 1 ? "this employee" : "these employees"} with their attendance, leaves, payroll slips, loans, documents and timeline. It cannot be undone. Employees with paid salary or an unpaid loan are not deleted — mark them Resigned instead. Biometric punches stay on the Biometric Device page.`}
        confirmText={deleting ? "Deleting..." : "Delete permanently"}
        variant="danger"
      />
    </div>
  );
}
