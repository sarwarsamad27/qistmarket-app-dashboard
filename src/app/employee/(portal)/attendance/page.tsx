"use client";

import { useEffect, useState } from "react";
import { employeeFetch } from "@/lib/employee-api";

interface AttendanceRecord {
  date: string;
  status: string;
  check_in?: string;
  check_out?: string;
  overtime_hrs?: number;
  missed_punch?: boolean;
  notes?: string;
}

const STATUS_ICON: Record<string, string> = {
  present: "✓",
  absent: "✗",
  late: "⚠",
  off: "—",
  holiday: "🎉",
  leave: "L",
  unpaid_leave: "U",
  weekly_off: "·",
};

const METHOD_COLORS: Record<string, string> = {
  manual: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  machine: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  bulk: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  fingerprint: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function getMethodFromNotes(notes?: string): string {
  if (!notes) return "";
  const m = notes.match(/\[method:(\w+)\]/);
  return m ? m[1] : "";
}

function getCleanNotes(notes?: string): string {
  if (!notes) return "";
  return notes.replace(/\[method:\w+\]\s*/g, "");
}

const to12h = (t?: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function parseDate(d: string | Date): Date {
  const s = typeof d === "string" ? d : d.toISOString();
  return new Date(s.slice(0, 10) + "T00:00:00Z");
}

export default function EmployeeAttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [policy, setPolicy] = useState<{ weekly_off_day: number; lates_per_off: number }>({ weekly_off_day: 0, lates_per_off: 3 });
  const [selectedDay, setSelectedDay] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    employeeFetch(`/employee/attendance?month=${month}&year=${year}`).then((r) => {
      setRecords(r.records);
      setSummary(r.summary);
      if (r.policy) setPolicy(r.policy);
    });
  }, [month, year]);

  const getDay = (d: string | Date) => parseDate(d).getUTCDate();
  const daysInMonth = new Date(year, month, 0).getDate();
  const recordMap = new Map(records.map((r) => [getDay(r.date), r]));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Attendance</h1>
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "long" })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-yellow-dark/30 bg-yellow-light-4/20 px-4 py-3 text-sm text-dark-5 dark:text-gray-6">
        <strong>Policy:</strong> {policy.lates_per_off} lates = 1 off deduction. An absence or off on the day before or after the weekly off ({["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][policy.weekly_off_day]}) also deducts the weekly off.
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Present", summary.present],
          ["Late", summary.late],
          ["Absent", summary.absent],
          ["Off", summary.off],
          ["Leave", (summary.leave || 0) + (summary.unpaid_leave || 0)],
          ["Overtime (hrs)", summary.overtime_hours],
          ["Missed Punches", summary.missed_punches],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-stroke bg-white p-3 text-center dark:border-stroke-dark dark:bg-dark-2">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold text-dark dark:text-white">{val ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-stroke bg-white p-4 text-sm dark:border-stroke-dark dark:bg-dark-2">
        <p className="mb-2 font-semibold text-dark dark:text-white">Salary deduction this month: {summary.deductible_days ?? 0} day(s)</p>
        <div className="grid gap-1 text-gray-600 dark:text-gray-400 sm:grid-cols-2">
          <span>Absent: {summary.absent ?? 0}</span>
          <span>Off: {summary.off ?? 0}</span>
          <span>Late penalty: {summary.late_penalty_offs ?? 0} ({summary.late ?? 0} lates ÷ {policy.lates_per_off})</span>
          <span>Saturday/Monday penalty: {summary.weekend_penalty_offs ?? 0}</span>
          <span>Unpaid leave: {summary.unpaid_leave ?? 0}</span>
          {summary.unmarked > 0 && <span className="text-yellow-dark">Not marked yet: {summary.unmarked} day(s) (not deducted)</span>}
        </div>
      </div>

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
          const dow = new Date(year, month - 1, day).getDay();
          const isWeeklyOff = dow === policy.weekly_off_day;
          const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isPenalty = (summary.penalty_dates || []).includes(dateKey);
          const status = rec?.status || (isWeeklyOff ? "weekly_off" : "unmarked");
          const missed = (summary.missed_punch_dates || []).includes(dateKey);
          return (
            <div
              key={day}
              onClick={() => rec && setSelectedDay(rec)}
              className={`cursor-pointer rounded-lg border p-2 text-center text-sm transition ${
                status === "present" ? "border-green/30 bg-green/10" :
                status === "late" ? "border-yellow-dark/30 bg-yellow-light-4/20" :
                status === "holiday" ? "border-blue-DEFAULT/30 bg-blue-light-5/20" :
                status === "leave" || status === "unpaid_leave" ? "border-blue-DEFAULT/30 bg-blue-light-5/10" :
                isPenalty ? "border-red/40 bg-red/10" :
                status === "absent" || status === "off" ? "border-red/30 bg-red/5" :
                "border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2"
              } ${missed ? "ring-2 ring-red/50" : ""}`}
            >
              <p className="font-medium">{day}</p>
              <p className="text-lg">{isPenalty ? "✗" : STATUS_ICON[status] || ""}</p>
              {(rec?.check_in || rec?.check_out) && (
                <p className="text-[10px] text-gray-500">{to12h(rec?.check_in) || "--"} – {to12h(rec?.check_out) || "--"}</p>
              )}
              {missed && <p className="mt-0.5 rounded bg-red/10 px-1 text-[10px] font-medium text-red">Missed punch</p>}
              {isPenalty && <p className="text-[10px] text-red">Sat/Mon penalty</p>}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-stroke bg-white p-6 shadow-xl dark:border-stroke-dark dark:bg-dark-2" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">Day Details</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Date:</span> {parseDate(selectedDay.date).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
              <p><span className="text-gray-500">Status:</span> <span className="font-medium capitalize">{selectedDay.status}</span></p>
              {(() => {
                const worked = ["present", "late"].includes(selectedDay.status);
                return worked ? (
                  <>
                    <p><span className="text-gray-500">Check In:</span> {selectedDay.check_in ? to12h(selectedDay.check_in) : <span className="text-red">Not recorded</span>}</p>
                    <p><span className="text-gray-500">Check Out:</span> {selectedDay.check_out ? to12h(selectedDay.check_out) : <span className="text-red">Not recorded</span>}</p>
                  </>
                ) : null;
              })()}
              {selectedDay.overtime_hrs ? <p><span className="text-gray-500">Overtime:</span> {selectedDay.overtime_hrs}h</p> : null}
              {(summary.missed_punch_dates || []).includes(String(selectedDay.date).slice(0, 10)) && (
                <p className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
                  <strong>Missed punch:</strong> your check-in or check-out was not recorded for this day. Please contact HR to correct it.
                </p>
              )}
              {(() => {
                const method = getMethodFromNotes(selectedDay.notes);
                const clean = getCleanNotes(selectedDay.notes);
                return method ? (
                  <p><span className="text-gray-500">Source:</span> <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${METHOD_COLORS[method] || "bg-gray-100 text-gray-700"}`}>{method}</span></p>
                ) : clean ? <p><span className="text-gray-500">Notes:</span> {clean}</p> : null;
              })()}
            </div>
            <button onClick={() => setSelectedDay(null)} className="mt-4 w-full rounded-lg border border-stroke px-4 py-2 text-sm dark:border-stroke-dark">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
