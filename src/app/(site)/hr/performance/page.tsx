"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import { Search, Star, TrendingUp, Target } from "lucide-react";
import toast from "react-hot-toast";

interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  department?: string;
}

interface Performance {
  id: number;
  month: number;
  year: number;
  kpi_score: number;
  attendance_score: number;
  targets: Record<string, number>;
  achieved: Record<string, number>;
  team_rank: number;
  remarks?: string;
}

export default function HrPerformancePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const [records, setRecords] = useState<Performance[]>([]);
  const [search, setSearch] = useState("");
  const [editRec, setEditRec] = useState<Performance | null>(null);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());

  useEffect(() => {
    hrFetch("/employees").then((r) => setEmployees(r.employees));
  }, []);

  useEffect(() => {
    if (!selectedEmp) return;
    hrFetch(`/employees/${selectedEmp}/performance`).then((r) => setRecords(r.records));
  }, [selectedEmp]);

  const submitPerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const targets: Record<string, number> = { sales: parseFloat(data.get("target_sales") as string) || 0, recovery: parseFloat(data.get("target_recovery") as string) || 0 };
    const achieved: Record<string, number> = { sales: parseFloat(data.get("achieved_sales") as string) || 0, recovery: parseFloat(data.get("achieved_recovery") as string) || 0 };
    await hrFetch(`/employees/${selectedEmp}/performance`, {
      method: "POST",
      body: JSON.stringify({
        month: editRec ? editRec.month : parseInt(data.get("month") as string),
        year: editRec ? editRec.year : parseInt(data.get("year") as string),
        kpi_score: parseFloat(data.get("kpi_score") as string),
        attendance_score: parseFloat(data.get("attendance_score") as string),
        targets,
        achieved,
        team_rank: parseInt(data.get("team_rank") as string) || 1,
        remarks: data.get("remarks") as string,
      }),
    });
    toast.success(editRec ? "Performance updated" : "Performance created");
    setEditRec(null);
    const r = await hrFetch(`/employees/${selectedEmp}/performance`);
    setRecords(r.records);
  };

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Performance Management</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="w-full rounded-lg border border-stroke py-2 pl-9 pr-3 text-sm dark:border-stroke-dark dark:bg-dark-2" />
        </div>
        <select value={selectedEmp || ""} onChange={(e) => setSelectedEmp(e.target.value ? parseInt(e.target.value) : null)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
          <option value="">Select employee</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
          ))}
        </select>
      </div>

      {selectedEmp && (
        <>
          {!editRec && (
            <form onSubmit={submitPerformance} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="mb-3 font-semibold">Add Performance Record</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input name="month" type="number" min="1" max="12" value={newMonth} onChange={(e) => setNewMonth(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" placeholder="Month" />
                <input name="year" type="number" value={newYear} onChange={(e) => setNewYear(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" placeholder="Year" />
                <input name="kpi_score" type="number" step="0.1" min={0} max={100} placeholder="KPI Score (0-100)" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="attendance_score" type="number" step="0.1" min={0} max={100} placeholder="Attendance Score (0-100)" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="target_sales" type="number" step="0.01" placeholder="Target Sales" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="target_recovery" type="number" step="0.01" placeholder="Target Recovery" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="achieved_sales" type="number" step="0.01" placeholder="Achieved Sales" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="achieved_recovery" type="number" step="0.01" placeholder="Achieved Recovery" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="team_rank" type="number" min={1} placeholder="Team Rank" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="remarks" placeholder="Remarks" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
              </div>
              <button type="submit" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white">Save Record</button>
            </form>
          )}

          {editRec && (
            <form onSubmit={submitPerformance} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="mb-3 font-semibold">Edit Performance ({editRec.month}/{editRec.year})</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input name="kpi_score" type="number" step="0.1" min={0} max={100} defaultValue={editRec.kpi_score} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="attendance_score" type="number" step="0.1" min={0} max={100} defaultValue={editRec.attendance_score} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="target_sales" type="number" step="0.01" defaultValue={editRec.targets?.sales || 0} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="target_recovery" type="number" step="0.01" defaultValue={editRec.targets?.recovery || 0} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="achieved_sales" type="number" step="0.01" defaultValue={editRec.achieved?.sales || 0} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="achieved_recovery" type="number" step="0.01" defaultValue={editRec.achieved?.recovery || 0} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="team_rank" type="number" min={1} defaultValue={editRec.team_rank} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="remarks" defaultValue={editRec.remarks || ""} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Update</button>
                <button type="button" onClick={() => setEditRec(null)} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-stroke-dark">Cancel</button>
              </div>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((rec) => {
              const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
              return (
                <div key={rec.id} className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold">{months[rec.month - 1]} {rec.year}</h4>
                    <button onClick={() => setEditRec(rec)} className="text-xs text-primary hover:underline">Edit</button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-gray-500"><Star className="h-3 w-3" /> KPI Score</span>
                      <span className="font-bold">{rec.kpi_score}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-gray-500"><TrendingUp className="h-3 w-3" /> Attendance</span>
                      <span className="font-bold">{rec.attendance_score}%</span>
                    </div>
                    {rec.targets && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-gray-500"><Target className="h-3 w-3" /> Sales</span>
                        <span>{rec.achieved?.sales || 0} / {rec.targets?.sales || 0}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Team Rank</span>
                      <span className="font-medium">#{rec.team_rank}</span>
                    </div>
                    {rec.remarks && <p className="mt-2 rounded bg-gray-2 px-2 py-1 text-xs dark:bg-dark-3">{rec.remarks}</p>}
                  </div>
                </div>
              );
            })}
            {records.length === 0 && <p className="col-span-full text-gray-500">No performance records yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
