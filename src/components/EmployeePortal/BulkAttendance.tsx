"use client";

import { useEffect, useMemo, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import toast from "react-hot-toast";

interface DayEmployee {
  id: number;
  employee_id: string;
  full_name: string;
  department?: string | null;
  designation?: string | null;
  outlet?: { name: string } | null;
  attendance: { status: string; check_in?: string | null; check_out?: string | null } | null;
}

interface Row {
  selected: boolean;
  status: string;
  check_in: string;
  check_out: string;
  existing: boolean;
  dirty: boolean;
}

const STATUSES: [string, string][] = [
  ["present", "Present"], ["late", "Late"], ["absent", "Absent"], ["off", "Off"],
  ["leave", "Leave (paid)"], ["unpaid_leave", "Unpaid Leave"], ["holiday", "Holiday"],
];
const WORKED = ["present", "late"];
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Props {
  shiftStart: string;
  shiftEnd: string;
  onSaved?: () => void;
}

/**
 * Bulk attendance for one date: every active employee in a table. Pick the
 * people, set status/times once with "Apply to selected", adjust any row
 * individually, then save. Rows already marked for that date load in, so
 * nothing is overwritten unless HR changes it.
 */
export default function BulkAttendance({ shiftStart, shiftEnd, onSaved }: Props) {
  const [date, setDate] = useState(todayStr());
  const [employees, setEmployees] = useState<DayEmployee[]>([]);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [weeklyOff, setWeeklyOff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);
  const [apply, setApply] = useState({ status: "present", check_in: shiftStart, check_out: shiftEnd });
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => { setApply((a) => ({ ...a, check_in: shiftStart, check_out: shiftEnd })); }, [shiftStart, shiftEnd]);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const r = await hrFetch(`/attendance/day?date=${d}`);
      const list: DayEmployee[] = r.employees || [];
      setEmployees(list);
      setWeeklyOff(!!r.weekly_off);
      const next: Record<number, Row> = {};
      for (const e of list) {
        next[e.id] = {
          selected: false,
          status: e.attendance?.status || "present",
          check_in: e.attendance?.check_in || "",
          check_out: e.attendance?.check_out || "",
          existing: !!e.attendance,
          dirty: false,
        };
      }
      setRows(next);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]);

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean) as string[])].sort(), [employees]);

  const visible = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (q && !e.full_name.toLowerCase().includes(q) && !e.employee_id.toLowerCase().includes(q)) return false;
    if (dept && e.department !== dept) return false;
    if (onlyUnmarked && rows[e.id]?.existing) return false;
    return true;
  });

  const setRow = (id: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const allVisibleSelected = visible.length > 0 && visible.every((e) => rows[e.id]?.selected);
  const toggleAll = () => {
    const to = !allVisibleSelected;
    setRows((r) => {
      const next = { ...r };
      for (const e of visible) next[e.id] = { ...next[e.id], selected: to };
      return next;
    });
  };
  const selectedIds = employees.filter((e) => rows[e.id]?.selected).map((e) => e.id);

  const applyToSelected = () => {
    if (!selectedIds.length) { toast.error("Select employees first"); return; }
    const worked = WORKED.includes(apply.status);
    setRows((r) => {
      const next = { ...r };
      for (const id of selectedIds) {
        next[id] = { ...next[id], status: apply.status, check_in: worked ? apply.check_in : "", check_out: worked ? apply.check_out : "", dirty: true };
      }
      return next;
    });
    toast.success(`Applied to ${selectedIds.length} employee(s) — review and Save`);
  };

  const toSave = employees.filter((e) => rows[e.id]?.dirty);

  const save = async () => {
    if (!toSave.length) { toast.error("Nothing changed yet"); return; }
    setSaving(true);
    try {
      const records = toSave.map((e) => {
        const r = rows[e.id];
        const worked = WORKED.includes(r.status);
        return { employee_id: e.employee_id, date, status: r.status, check_in: worked ? r.check_in : "", check_out: worked ? r.check_out : "" };
      });
      const res = await hrFetch("/attendance/bulk", { method: "POST", body: JSON.stringify({ records }) });
      toast.success(`${res.count} attendance record(s) saved`);
      await load(date);
      onSaved?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = ((new FormData(e.target as HTMLFormElement).get("entries") as string) || "").trim();
    const records = raw.split("\n").filter(Boolean).map((line) => line.split(/[,\t]/).map((s) => s.trim()))
      .filter((p) => p.length >= 2)
      .map((p) => ({ employee_id: p[0], date: p[1], status: p[2] || "present", check_in: p[3] || "", check_out: p[4] || "" }));
    if (!records.length) { toast.error("No valid lines"); return; }
    try {
      const res = await hrFetch("/attendance/bulk", { method: "POST", body: JSON.stringify({ records }) });
      toast.success(`${res.count} record(s) saved${res.skipped?.length ? ` — unknown IDs skipped: ${res.skipped.join(", ")}` : ""}`, { duration: 7000 });
      (e.target as HTMLFormElement).reset();
      await load(date);
      onSaved?.();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const input = "rounded-lg border border-stroke px-2 py-1.5 text-sm dark:border-stroke-dark dark:bg-dark-3";

  return (
    <div className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">Bulk Attendance</h3>
          <p className="text-xs text-gray-500">Pick a date, select employees, set status &amp; time once — or edit any row individually — then Save.</p>
        </div>
        <label className="text-xs text-gray-500">Date
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`ml-2 ${input}`} />
        </label>
      </div>

      {weeklyOff && (
        <p className="mb-3 rounded-lg bg-yellow-light-4/30 px-3 py-2 text-xs text-yellow-dark">This date is the weekly off day.</p>
      )}

      {/* Apply-to-selected bar */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg bg-gray-2 p-3 dark:bg-dark-3">
        <span className="self-center text-sm font-medium">{selectedIds.length} selected →</span>
        <label className="text-xs text-gray-500">Status
          <select value={apply.status} onChange={(e) => setApply({ ...apply, status: e.target.value })} className={`mt-1 block ${input}`}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {WORKED.includes(apply.status) && (
          <>
            <label className="text-xs text-gray-500">Check-in
              <input type="time" value={apply.check_in} onChange={(e) => setApply({ ...apply, check_in: e.target.value })} className={`mt-1 block ${input}`} />
            </label>
            <label className="text-xs text-gray-500">Check-out
              <input type="time" value={apply.check_out} onChange={(e) => setApply({ ...apply, check_out: e.target.value })} className={`mt-1 block ${input}`} />
            </label>
          </>
        )}
        <button type="button" onClick={applyToSelected} className="rounded-lg bg-dark px-4 py-2 text-sm text-white dark:bg-white dark:text-dark">Apply to selected</button>
      </div>

      {/* Filters */}
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID..." className={`min-w-[180px] flex-1 ${input}`} />
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={input}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnmarked} onChange={(e) => setOnlyUnmarked(e.target.checked)} /> Only not-yet-marked
        </label>
      </div>

      <div className="max-h-[480px] overflow-auto rounded-lg border border-stroke dark:border-stroke-dark">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-2 dark:bg-dark-3">
            <tr>
              <th className="px-3 py-2 text-left"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} title="Select all shown" /></th>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Check-in</th>
              <th className="px-3 py-2 text-left">Check-out</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Loading...</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">No employees</td></tr>}
            {!loading && visible.map((e) => {
              const r = rows[e.id];
              if (!r) return null;
              const worked = WORKED.includes(r.status);
              return (
                <tr key={e.id} className={`border-t border-stroke dark:border-stroke-dark ${r.selected ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={r.selected} onChange={(ev) => setRow(e.id, { selected: ev.target.checked })} /></td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{e.full_name}</p>
                    <p className="text-xs text-gray-500">{e.employee_id}{e.designation ? ` · ${e.designation}` : ""}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{e.department || "-"}</td>
                  <td className="px-3 py-2">
                    <select value={r.status} onChange={(ev) => setRow(e.id, { status: ev.target.value, dirty: true })} className={input}>
                      {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="time" disabled={!worked} value={worked ? r.check_in : ""} onChange={(ev) => setRow(e.id, { check_in: ev.target.value, dirty: true })} className={`${input} disabled:opacity-40`} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="time" disabled={!worked} value={worked ? r.check_out : ""} onChange={(ev) => setRow(e.id, { check_out: ev.target.value, dirty: true })} className={`${input} disabled:opacity-40`} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.dirty ? <span className="text-yellow-dark">Unsaved</span> : r.existing ? <span className="text-green">Marked</span> : <span className="text-gray-400">Not marked</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">A check-in after the office start time (plus grace) is saved as Late automatically.</p>
        <button type="button" onClick={save} disabled={saving || !toSave.length} className="rounded-lg bg-primary px-5 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Saving..." : `Save ${toSave.length} change(s)`}
        </button>
      </div>

      <button type="button" onClick={() => setShowPaste(!showPaste)} className="mt-4 text-xs text-primary hover:underline">
        {showPaste ? "Hide" : "Paste from Excel instead"}
      </button>
      {showPaste && (
        <form onSubmit={pasteSubmit} className="mt-2">
          <p className="mb-2 text-xs text-gray-500">One line per entry: employee_id, date (YYYY-MM-DD), status, check-in, check-out — comma or tab separated (copy columns straight from Excel).</p>
          <textarea name="entries" rows={4} placeholder={"QMK-2026-0001, 2026-09-01, present, 09:05, 18:30"} className="mb-2 w-full rounded-lg border border-stroke px-3 py-2 font-mono text-sm dark:border-stroke-dark dark:bg-dark-3" />
          <button type="submit" className="rounded-lg border border-primary px-4 py-2 text-sm text-primary">Submit pasted lines</button>
        </form>
      )}
    </div>
  );
}
