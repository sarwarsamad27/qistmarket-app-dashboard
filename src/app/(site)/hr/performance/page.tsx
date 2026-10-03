"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import { Search, Star, TrendingUp, Target, Trophy, Wallet, Users, Pencil, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  department?: string;
}

type Metric = "sales" | "recovery" | "customers";
type Figures = Partial<Record<Metric, number>>;

interface Overrides {
  kpi_score?: number;
  attendance_score?: number;
  recovery_pct?: number;
  team_rank?: number;
  targets?: Figures;
  achieved?: Figures;
}

interface Performance {
  id: number;
  month: number;
  year: number;
  kpi_score: number;
  attendance_score: number;
  recovery_pct?: number | null;
  targets: Figures;
  achieved: Figures;
  team_rank?: number | null;
  team_size?: number;
  remarks?: string | null;
  overrides?: Overrides;
  calculated?: {
    kpi_score: number;
    attendance_score: number;
    recovery_pct: number | null;
    team_rank: number;
    targets: Figures;
    achieved: Figures;
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const METRICS: { key: Metric; label: string; money: boolean; icon: typeof Target }[] = [
  { key: "sales", label: "Sales", money: true, icon: Target },
  { key: "recovery", label: "Recovery", money: true, icon: Wallet },
  { key: "customers", label: "Customers", money: false, icon: Users },
];
const fmt = (v: number | null | undefined, money: boolean) =>
  v == null ? "—" : money ? `Rs. ${Number(v).toLocaleString()}` : Number(v).toLocaleString();

export default function HrPerformancePage() {
  const now = new Date();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const [records, setRecords] = useState<Performance[]>([]);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hrFetch("/employees").then((r) => setEmployees(r.employees));
  }, []);

  const load = async () => {
    if (!selectedEmp) return;
    setLoading(true);
    try {
      const r = await hrFetch(`/employees/${selectedEmp}/performance?month=${month}&year=${year}`);
      setRecords(r.records || []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditing(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmp, month, year]);

  const current = records.find((r) => r.month === month && r.year === year) || null;
  const ov = current?.overrides || {};
  const calc = current?.calculated;
  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    // Blank = use the calculated value.
    const val = (k: string) => (fd.get(k) as string) ?? "";
    const group = (prefix: string) => Object.fromEntries(METRICS.map((m) => [m.key, val(`${prefix}_${m.key}`)]));
    setSaving(true);
    try {
      await hrFetch(`/employees/${selectedEmp}/performance`, {
        method: "POST",
        body: JSON.stringify({
          month,
          year,
          kpi_score: val("kpi_score"),
          attendance_score: val("attendance_score"),
          recovery_pct: val("recovery_pct"),
          team_rank: val("team_rank"),
          targets: group("target"),
          achieved: group("achieved"),
          remarks: val("remarks"),
        }),
      });
      toast.success("Performance updated — the edited figures now show everywhere");
      setEditing(false);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = async () => {
    if (!confirm("Remove all HR edits for this month and go back to the calculated figures?")) return;
    try {
      await hrFetch(`/employees/${selectedEmp}/performance`, {
        method: "POST",
        body: JSON.stringify({
          month, year, kpi_score: "", attendance_score: "", recovery_pct: "", team_rank: "",
          targets: { sales: "", recovery: "", customers: "" },
          achieved: { sales: "", recovery: "", customers: "" },
        }),
      });
      toast.success("Back to calculated figures");
      setEditing(false);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  const input = "mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3";
  const editedBadge = <span className="ml-1 rounded-full bg-blue-light-5/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-dark">edited</span>;
  const hasEdits = Object.keys(ov).length > 0;

  // One figure: effective value, with the calculated one beside it when HR changed it.
  const Row = ({ icon: Icon, label, value, auto, edited }: { icon: typeof Star; label: string; value: string; auto?: string; edited: boolean }) => (
    <div className="flex items-center justify-between border-b border-stroke py-2 last:border-0 dark:border-stroke-dark">
      <span className="flex items-center gap-2 text-sm text-gray-500"><Icon className="h-4 w-4" /> {label}</span>
      <span className="text-right text-sm">
        <span className="font-semibold text-dark dark:text-white">{value}</span>
        {edited && editedBadge}
        {edited && auto !== undefined && <span className="block text-[11px] text-gray-400">calculated: {auto}</span>}
      </span>
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Performance Management</h1>
      </div>
      <p className="mb-6 text-xs text-gray-500">
        Calculated automatically every month — attendance score from attendance, sales and recovery from the employee&apos;s linked app account,
        targets from assigned officer targets, KPI = 40% attendance + 60% target achievement (attendance only when no targets), and team rank by KPI within the department.
        HR can edit any figure; the edited figure is what the employee portal and every report show.
      </p>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="w-full rounded-lg border border-stroke py-2 pl-9 pr-3 text-sm dark:border-stroke-dark dark:bg-dark-2" />
        </div>
        <select value={selectedEmp || ""} onChange={(e) => setSelectedEmp(e.target.value ? parseInt(e.target.value) : null)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
          <option value="">Select employee</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} className="w-24 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
      </div>

      {!selectedEmp && <p className="text-gray-500">Select an employee to view their performance.</p>}

      {selectedEmp && (
        <>
          <div className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {MONTHS[month - 1]} {year}
                {hasEdits && <span className="ml-2 text-xs font-normal text-blue-dark">includes HR edits</span>}
              </h3>
              {current && !editing && (
                <div className="flex gap-2">
                  {hasEdits && (
                    <button onClick={resetAll} className="flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 text-xs dark:border-stroke-dark">
                      <RotateCcw className="h-3.5 w-3.5" /> Reset to calculated
                    </button>
                  )}
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
              )}
            </div>

            {loading && <p className="text-sm text-gray-500">Calculating...</p>}
            {!loading && isFuture && <p className="text-sm text-gray-500">This month hasn&apos;t started yet.</p>}
            {!loading && !isFuture && !current && <p className="text-sm text-gray-500">No performance for this month — the employee may not have joined yet or is inactive.</p>}

            {!loading && current && !editing && (
              <div className="grid gap-x-8 md:grid-cols-2">
                <div>
                  <Row icon={Star} label="KPI Score" value={`${current.kpi_score}%`} auto={calc ? `${calc.kpi_score}%` : undefined} edited={ov.kpi_score != null} />
                  <Row icon={TrendingUp} label="Attendance Score" value={`${current.attendance_score}%`} auto={calc ? `${calc.attendance_score}%` : undefined} edited={ov.attendance_score != null} />
                  <Row icon={Wallet} label="Recovery %" value={current.recovery_pct != null ? `${current.recovery_pct}%` : "—"} auto={calc ? (calc.recovery_pct != null ? `${calc.recovery_pct}%` : "—") : undefined} edited={ov.recovery_pct != null} />
                  <Row icon={Trophy} label="Team Rank" value={current.team_rank ? `#${current.team_rank}${current.team_size ? ` of ${current.team_size}` : ""}` : "—"} auto={calc ? `#${calc.team_rank}` : undefined} edited={ov.team_rank != null} />
                </div>
                <div>
                  {METRICS.map((m) => {
                    const target = current.targets?.[m.key];
                    const achieved = current.achieved?.[m.key];
                    if (target == null && achieved == null) return null;
                    const edited = ov.targets?.[m.key] != null || ov.achieved?.[m.key] != null;
                    const autoText = calc ? `${fmt(calc.achieved?.[m.key], m.money)} / ${fmt(calc.targets?.[m.key], m.money)}` : undefined;
                    return (
                      <Row key={m.key} icon={m.icon} label={`${m.label} (achieved / target)`} value={`${fmt(achieved, m.money)} / ${fmt(target, m.money)}`} auto={autoText} edited={edited} />
                    );
                  })}
                  {METRICS.every((m) => current.targets?.[m.key] == null && current.achieved?.[m.key] == null) && (
                    <p className="py-2 text-sm text-gray-500">No sales / recovery figures — link the employee to their staff app account to track them automatically.</p>
                  )}
                  {current.remarks && <p className="mt-2 rounded bg-gray-2 px-2 py-1 text-xs dark:bg-dark-3">{current.remarks}</p>}
                </div>
              </div>
            )}

            {!loading && current && editing && (
              <form onSubmit={save}>
                <p className="mb-3 text-xs text-gray-500">Leave a field blank to use the calculated value (shown as the placeholder).</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs text-gray-500">KPI score (%)
                    <input name="kpi_score" type="number" step="0.1" min={0} max={100} defaultValue={ov.kpi_score ?? ""} placeholder={calc ? String(calc.kpi_score) : ""} className={input} />
                  </label>
                  <label className="text-xs text-gray-500">Attendance score (%)
                    <input name="attendance_score" type="number" step="0.1" min={0} max={100} defaultValue={ov.attendance_score ?? ""} placeholder={calc ? String(calc.attendance_score) : ""} className={input} />
                  </label>
                  <label className="text-xs text-gray-500">Recovery (%)
                    <input name="recovery_pct" type="number" step="0.1" min={0} max={100} defaultValue={ov.recovery_pct ?? ""} placeholder={calc?.recovery_pct != null ? String(calc.recovery_pct) : "—"} className={input} />
                  </label>
                  <label className="text-xs text-gray-500">Team rank
                    <input name="team_rank" type="number" min={1} defaultValue={ov.team_rank ?? ""} placeholder={calc ? String(calc.team_rank) : ""} className={input} />
                  </label>
                  {METRICS.map((m) => (
                    <label key={`t-${m.key}`} className="text-xs text-gray-500">Target {m.label.toLowerCase()}
                      <input name={`target_${m.key}`} type="number" step="0.01" min={0} defaultValue={ov.targets?.[m.key] ?? ""} placeholder={calc?.targets?.[m.key] != null ? String(calc.targets[m.key]) : "none"} className={input} />
                    </label>
                  ))}
                  {METRICS.map((m) => (
                    <label key={`a-${m.key}`} className="text-xs text-gray-500">Achieved {m.label.toLowerCase()}
                      <input name={`achieved_${m.key}`} type="number" step="0.01" min={0} defaultValue={ov.achieved?.[m.key] ?? ""} placeholder={calc?.achieved?.[m.key] != null ? String(calc.achieved[m.key]) : "0"} className={input} />
                    </label>
                  ))}
                  <label className="text-xs text-gray-500 sm:col-span-2">Remarks
                    <input name="remarks" defaultValue={current.remarks || ""} className={input} />
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                  <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-stroke-dark">Cancel</button>
                </div>
              </form>
            )}
          </div>

          <h3 className="mb-3 font-semibold">History</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((rec) => {
              const edited = Object.keys(rec.overrides || {}).length > 0;
              return (
                <button
                  key={rec.id}
                  onClick={() => { setMonth(rec.month); setYear(rec.year); }}
                  className={`rounded-xl border bg-white p-4 text-left dark:bg-dark-2 ${rec.month === month && rec.year === year ? "border-primary" : "border-stroke dark:border-stroke-dark"}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-semibold">{MONTHS[rec.month - 1]} {rec.year}</h4>
                    {edited && editedBadge}
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
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Team Rank</span>
                      <span className="font-medium">{rec.team_rank ? `#${rec.team_rank}` : "—"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {records.length === 0 && !loading && <p className="col-span-full text-gray-500">No performance records yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
