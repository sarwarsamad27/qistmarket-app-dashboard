"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import { Search, Fingerprint, RefreshCw, Clock } from "lucide-react";
import toast from "react-hot-toast";
import BulkAttendance from "@/components/EmployeePortal/BulkAttendance";

interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  department?: string;
}

interface AttendanceRecord {
  id: number;
  date: string;
  status: string;
  check_in?: string | null;
  check_out?: string | null;
  overtime_hrs?: number;
  missed_punch?: boolean;
  notes?: string;
}

interface Settings {
  shift_start: string;
  shift_end: string;
  grace_minutes: number;
  weekly_off_day: number;
  lates_per_off: number;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STATUSES: [string, string][] = [
  ["present", "Present"], ["late", "Late"], ["absent", "Absent"], ["off", "Off"],
  ["leave", "Leave (paid)"], ["unpaid_leave", "Unpaid Leave"], ["holiday", "Holiday"],
];
const STATUS_ICON: Record<string, string> = { present: "✓", late: "⚠", absent: "✗", off: "—", holiday: "🎉", leave: "L", unpaid_leave: "U" };
const STATUS_STYLE: Record<string, string> = {
  present: "border-green/30 bg-green/10",
  late: "border-yellow-dark/30 bg-yellow-light-4/20",
  absent: "border-red/30 bg-red/10",
  off: "border-red/20 bg-red/5",
  holiday: "border-blue-DEFAULT/30 bg-blue-light-5/20",
  leave: "border-blue-DEFAULT/30 bg-blue-light-5/10",
  unpaid_leave: "border-blue-DEFAULT/30 bg-blue-light-5/10",
};
const DEFAULT_SETTINGS: Settings = { shift_start: "09:00", shift_end: "18:00", grace_minutes: 15, weekly_off_day: 0, lates_per_off: 3 };

const cleanNotes = (n?: string) => (n || "").replace(/\[method:\w+\]\s*/g, "");
const methodOf = (n?: string) => n?.match(/\[method:(\w+)\]/)?.[1] || "";
const to12h = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function HrAttendancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<(Record<string, number> & { missed_punch_dates?: string[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<{ model?: string; ip?: string; port?: string; connected?: boolean } | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [editDay, setEditDay] = useState<{ date: string; rec?: AttendanceRecord } | null>(null);
  const [editStatus, setEditStatus] = useState("present");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hrFetch("/employees").then((r) => setEmployees(r.employees));
    hrFetch("/biometric/device-status").then((r) => setDeviceStatus(r.device)).catch(() => {});
    hrFetch("/attendance/settings").then((r) => setSettings(r.settings)).catch(() => {});
  }, []);

  const loadRecords = async () => {
    if (!selectedEmp) return;
    const r = await hrFetch(`/employees/${selectedEmp}/attendance?month=${month}&year=${year}`);
    setRecords(r.records);
    setSummary(r.summary || null);
  };

  useEffect(() => {
    if (!selectedEmp) return;
    setLoading(true);
    loadRecords().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmp, month, year]);

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  const getDay = (d: string | Date) => {
    const s = typeof d === "string" ? d : d.toISOString();
    return new Date(s.slice(0, 10) + "T00:00:00Z").getUTCDate();
  };
  const daysInMonth = new Date(year, month, 0).getDate();
  const recordMap = new Map(records.map((r) => [getDay(r.date), r]));

  const openDay = (day: number) => {
    const rec = recordMap.get(day);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setEditStatus(rec?.status || "present");
    setEditDay({ date, rec });
  };

  const saveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || !editDay) return;
    const fd = new FormData(e.target as HTMLFormElement);
    const worked = ["present", "late"].includes(editStatus);
    setSaving(true);
    try {
      const r = await hrFetch(`/employees/${selectedEmp}/attendance`, {
        method: "POST",
        body: JSON.stringify({
          date: editDay.date,
          status: editStatus,
          check_in: worked ? (fd.get("check_in") as string) || "" : "",
          check_out: worked ? (fd.get("check_out") as string) || "" : "",
          overtime_hrs: worked && fd.get("overtime_hrs") !== "" ? fd.get("overtime_hrs") : undefined,
          missed_punch: worked ? fd.get("missed_punch") === "on" : false,
          notes: (fd.get("notes") as string) || "",
          method: "manual",
        }),
      });
      toast.success(r.auto_late ? `Saved — marked Late (check-in after ${to12h(settings.shift_start)} + ${settings.grace_minutes} min)` : "Attendance saved");
      setEditDay(null);
      await loadRecords();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const clearDay = async () => {
    if (!selectedEmp || !editDay?.rec) return;
    try {
      await hrFetch(`/employees/${selectedEmp}/attendance/${editDay.date}`, { method: "DELETE" });
      toast.success("Day cleared");
      setEditDay(null);
      await loadRecords();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    try {
      const r = await hrFetch("/attendance/settings", {
        method: "PUT",
        body: JSON.stringify({
          shift_start: fd.get("shift_start"),
          shift_end: fd.get("shift_end"),
          grace_minutes: fd.get("grace_minutes"),
          weekly_off_day: fd.get("weekly_off_day"),
          lates_per_off: fd.get("lates_per_off"),
        }),
      });
      setSettings(r.settings);
      toast.success("Office timings saved");
      setShowSettings(false);
      loadRecords();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmp);
  const input = "w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Attendance Management</h1>
          <p className="text-xs text-gray-500">
            Office timings: {to12h(settings.shift_start)} – {to12h(settings.shift_end)} · Late after {settings.grace_minutes} min · Weekly off: {DAYS[settings.weekly_off_day]} · {settings.lates_per_off} lates = 1 off
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">
            <Clock className="mr-1 inline h-4 w-4" /> Office Timings
          </button>
          <button onClick={() => setShowBulk(!showBulk)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">
            {showBulk ? "Close Bulk" : "Bulk Attendance"}
          </button>
          <button onClick={() => setShowBiometric(!showBiometric)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">
            <Fingerprint className="mr-1 inline h-4 w-4" /> Biometric
          </button>
        </div>
      </div>

      {showSettings && (
        <form onSubmit={saveSettings} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <h3 className="mb-1 font-semibold">Office Timings &amp; Attendance Rules</h3>
          <p className="mb-4 text-xs text-gray-500">A check-in later than the start time plus grace minutes is marked Late automatically. Time after the end time counts as overtime.</p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <label className="text-xs text-gray-500">Office start time
              <input name="shift_start" type="time" defaultValue={settings.shift_start} required className={`mt-1 ${input}`} />
            </label>
            <label className="text-xs text-gray-500">Office end time
              <input name="shift_end" type="time" defaultValue={settings.shift_end} required className={`mt-1 ${input}`} />
            </label>
            <label className="text-xs text-gray-500">Grace (minutes)
              <input name="grace_minutes" type="number" min={0} max={240} defaultValue={settings.grace_minutes} className={`mt-1 ${input}`} />
            </label>
            <label className="text-xs text-gray-500">Weekly off day
              <select name="weekly_off_day" defaultValue={settings.weekly_off_day} className={`mt-1 ${input}`}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500">Lates = 1 off
              <input name="lates_per_off" type="number" min={0} max={31} defaultValue={settings.lates_per_off} className={`mt-1 ${input}`} />
            </label>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white">Save</button>
        </form>
      )}

      {showBiometric && deviceStatus && (
        <div className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <h3 className="mb-2 font-semibold">Biometric Device</h3>
          <p className="text-sm">Device: {deviceStatus.model} ({deviceStatus.ip}:{deviceStatus.port})</p>
          <p className="text-sm">Status: {deviceStatus.connected ? <span className="text-green">Connected</span> : <span className="text-red">Disconnected</span>}</p>
          <button onClick={async () => {
            await hrFetch("/biometric/sync", { method: "POST" });
            toast.success("Biometric sync initiated");
          }} className="mt-3 flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white">
            <RefreshCw className="h-3 w-3" /> Sync Now
          </button>
        </div>
      )}

      {showBulk && (
        <BulkAttendance shiftStart={settings.shift_start} shiftEnd={settings.shift_end} onSaved={loadRecords} />
      )}

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name or ID..."
            className="w-full rounded-lg border border-stroke py-2 pl-9 pr-3 text-sm dark:border-stroke-dark dark:bg-dark-2"
          />
        </div>
        <select
          value={selectedEmp || ""}
          onChange={(e) => setSelectedEmp(e.target.value ? parseInt(e.target.value) : null)}
          className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2"
        >
          <option value="">Select employee</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "long" })}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => setYear(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {selectedEmployee && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">Managing: <strong>{selectedEmployee.full_name}</strong> ({selectedEmployee.department || "No department"}) — click a day to set status and times.</p>
          {summary && (
            <p className="text-xs text-gray-500">
              Present {summary.present} · Late {summary.late} · Absent {summary.absent} · Off {summary.off} · OT {summary.overtime_hours}h ·{" "}
              {summary.missed_punches > 0 && <span className="text-red">Missed punch {summary.missed_punches} · </span>}
              <strong className="text-red">Deductible {summary.deductible_days} day(s)</strong>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading attendance...</p>
      ) : selectedEmp ? (
        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500">{d}</div>
          ))}
          {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const rec = recordMap.get(day);
            const isWeeklyOff = new Date(year, month - 1, day).getDay() === settings.weekly_off_day;
            const status = rec?.status;
            const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const missed = (summary?.missed_punch_dates || []).includes(dateKey);
            return (
              <button
                type="button"
                key={day}
                onClick={() => openDay(day)}
                className={`rounded-lg border p-2 text-center text-sm transition hover:shadow ${status ? STATUS_STYLE[status] || "" : "border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2"} ${missed ? "ring-2 ring-red/50" : ""}`}
              >
                <p className="font-medium">{day}</p>
                <p className="text-lg leading-6">{status ? STATUS_ICON[status] || "?" : isWeeklyOff ? <span className="text-xs text-gray-400">Weekly off</span> : <span className="text-gray-300">·</span>}</p>
                {(rec?.check_in || rec?.check_out) && (
                  <p className="text-[10px] text-gray-500">{to12h(rec?.check_in) || "--"} – {to12h(rec?.check_out) || "--"}</p>
                )}
                {missed && <p className="mt-0.5 rounded bg-red/10 px-1 text-[10px] font-medium text-red">Missed punch</p>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500">Select an employee to view attendance.</p>
      )}

      {editDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditDay(null)}>
          <form onSubmit={saveDay} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-dark-2">
            <h2 className="text-lg font-bold">
              {new Date(`${editDay.date}T00:00:00`).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h2>
            <p className="mb-4 text-xs text-gray-500">
              {selectedEmployee?.full_name}
              {editDay.rec && methodOf(editDay.rec.notes) ? ` · recorded via ${methodOf(editDay.rec.notes)}` : ""}
            </p>

            <label className="mb-3 block text-xs text-gray-500">Status
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={`mt-1 ${input}`}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>

            {["present", "late"].includes(editStatus) && (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="text-xs text-gray-500">Check-in
                    <input name="check_in" type="time" defaultValue={editDay.rec?.check_in || ""} className={`mt-1 ${input}`} />
                  </label>
                  <label className="text-xs text-gray-500">Check-out
                    <input name="check_out" type="time" defaultValue={editDay.rec?.check_out || ""} className={`mt-1 ${input}`} />
                  </label>
                </div>
                <label className="mb-3 block text-xs text-gray-500">Overtime (hours) — leave blank to calculate from check-out
                  <input name="overtime_hrs" type="number" step="0.25" min={0} defaultValue={editDay.rec?.overtime_hrs || ""} className={`mt-1 ${input}`} />
                </label>
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input name="missed_punch" type="checkbox" defaultChecked={!!editDay.rec?.missed_punch} /> Mark as missed punch
                  <span className="text-xs text-gray-400">(flagged automatically when check-in or check-out is missing)</span>
                </label>
                <p className="mb-3 rounded bg-gray-2 px-3 py-2 text-xs text-gray-500 dark:bg-dark-3">
                  Check-in after {to12h(settings.shift_start)} + {settings.grace_minutes} min is marked <strong>Late</strong> automatically.
                </p>
              </>
            )}

            <label className="mb-4 block text-xs text-gray-500">Notes
              <input name="notes" defaultValue={cleanNotes(editDay.rec?.notes)} className={`mt-1 ${input}`} />
            </label>

            <div className="flex gap-2">
              {editDay.rec && (
                <button type="button" onClick={clearDay} className="rounded-lg border border-red/40 px-3 py-2 text-sm text-red">Clear</button>
              )}
              <button type="button" onClick={() => setEditDay(null)} className="flex-1 rounded-lg border border-stroke py-2 text-sm dark:border-stroke-dark">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-primary py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
