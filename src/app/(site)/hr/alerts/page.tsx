"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Check, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const inputClass = "w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3";
const buttonClass = "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

type Outlet = { id: number; name: string; code?: string };
type Employee = { id: number; full_name: string; employee_id: string; outlet_id: number | null; department: string | null; status?: string };
type Alert = { id: number; type: string; severity: string; title: string; message: string; last_seen: string };
type Data = {
  alerts: Alert[];
  outlets: Outlet[];
  employees: Employee[];
  staffingTargets: { id: number; outlet_id: number; department: string; required_count: number; outlet: { name: string } }[];
  transfers: { id: number; employee: Employee; from_outlet?: { name: string }; to_outlet?: { name: string }; to_department?: string; created_at: string }[];
  replacementNeeds: { id: number; outlet_id: number; department: string; reason?: string; outlet: { name: string } }[];
  violations: { id: number; policy_name: string; description: string; employee?: { full_name: string }; outlet?: { name: string } }[];
  complianceTasks: { id: number; title: string; description?: string; due_date?: string; outlet: { name: string } }[];
};

const SECTION = "rounded-xl border border-stroke bg-white p-5 shadow-sm dark:border-stroke-dark dark:bg-dark-2";
const Heading = ({ children }: { children: React.ReactNode }) => <h2 className="mb-4 text-lg font-bold text-dark dark:text-white">{children}</h2>;

export default function HrAlertsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/api/hr/alerts`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not load HR alerts.");
      setData(result as Data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load HR alerts.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>, path: string) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      const body: Record<string, string> = {};
      new FormData(event.currentTarget).forEach((value, key) => { body[key] = String(value); });
      const response = await fetch(`${API}/api/hr${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not save this HR record.");
      form.reset();
      toast.success("Saved.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this HR record.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (path: string, status: string) => {
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/hr${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Could not update this HR record.");
      toast.success(result.message || "Updated.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update this HR record.");
    } finally {
      setBusy(false);
    }
  };

  const selectOutlet = (name = "outlet_id") => (
    <select name={name} required className={inputClass} defaultValue="">
      <option value="" disabled>Select outlet</option>
      {data?.outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name} ({outlet.code})</option>)}
    </select>
  );
  const selectEmployee = (name = "employee_id", required = true, activeOnly = true) => (
    <select name={name} required={required} className={inputClass} defaultValue="">
      <option value="">{required ? "Select employee" : "No specific employee"}</option>
      {data?.employees.filter((employee) => !activeOnly || employee.status === "active").map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_id})</option>)}
    </select>
  );
  const formButton = (text: string) => <button disabled={busy} className={buttonClass}>{busy ? "Saving…" : text}</button>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-dark dark:text-white"><Bell className="size-6 text-primary" /> HR Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">Staffing, attendance, approvals, employment dates and branch compliance.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className={`${buttonClass} inline-flex items-center gap-2`}><RefreshCw className="size-4" /> Refresh</button>
      </div>

      <section className={SECTION}>
        <Heading>Active notifications ({data?.alerts.length ?? 0})</Heading>
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <p className="text-sm text-gray-500">Checking HR conditions…</p> : !data?.alerts.length ? (
          <p className="text-sm text-gray-500">No active HR alerts.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.alerts.map((alert) => (
              <article key={alert.id} className={`rounded-lg border p-4 ${alert.severity === "critical" ? "border-red-300 bg-red-50 dark:bg-red-950/20" : alert.severity === "warning" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-blue-200 bg-blue-50 dark:bg-blue-950/20"}`}>
                <h3 className="flex items-center gap-2 font-semibold text-dark dark:text-white"><AlertTriangle className="size-4 shrink-0 text-primary" />{alert.title}</h3>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{alert.message}</p>
                <p className="mt-2 text-xs text-gray-500">Last checked: {new Date(alert.last_seen).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</p>
                <Link href={alert.type === "pending_hr_approval" ? "/hr/leaves" : alert.type === "employee_transfer" || alert.type === "staff_replacement_required" ? "/hr/alerts" : alert.type === "contract_expiry" ? "/hr/employees" : "/hr/attendance"} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">Open HR records →</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className={SECTION}>
          <Heading>Required headcount by outlet / department</Heading>
          <form onSubmit={(event) => void submit(event, "/staffing-targets")} className="grid gap-3 sm:grid-cols-2">
            {selectOutlet()}
            <input name="department" required placeholder="Department" className={inputClass} />
            <input name="required_count" required type="number" min="0" step="1" placeholder="Required staff count" className={inputClass} />
            <div className="sm:col-span-2">{formButton("Save staffing target")}</div>
          </form>
          <div className="mt-4 space-y-2 text-sm">
            {data?.staffingTargets.map((target) => <p key={target.id} className="rounded-lg bg-gray-50 p-3 dark:bg-dark-3">{target.outlet.name} · {target.department}: <b>{target.required_count}</b> required</p>)}
          </div>
        </section>

        <section className={SECTION}>
          <Heading>Employee transfer approval</Heading>
          <form onSubmit={(event) => void submit(event, "/transfers")} className="grid gap-3 sm:grid-cols-2">
            {selectEmployee()}
            {selectOutlet("to_outlet_id")}
            <input name="to_department" placeholder="Destination department (optional)" className={inputClass} />
            <input name="reason" placeholder="Reason (optional)" className={inputClass} />
            <div className="sm:col-span-2">{formButton("Create transfer request")}</div>
          </form>
          <div className="mt-4 space-y-2">
            {data?.transfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-dark-3">
                <span>{transfer.employee.full_name}: {transfer.from_outlet?.name || "—"} → {transfer.to_outlet?.name || transfer.to_department || "—"}</span>
                <span className="flex gap-2"><button disabled={busy} onClick={() => void update(`/transfers/${transfer.id}`, "approved")} className="rounded bg-green-600 px-2 py-1 text-white">Approve</button><button disabled={busy} onClick={() => void update(`/transfers/${transfer.id}`, "rejected")} className="rounded bg-red-600 px-2 py-1 text-white">Reject</button></span>
              </div>
            ))}
          </div>
        </section>

        <section className={SECTION}>
          <Heading>Staff replacement required</Heading>
          <form onSubmit={(event) => void submit(event, "/replacement-needs")} className="grid gap-3 sm:grid-cols-2">
            {selectOutlet()}
            <input name="department" required placeholder="Department / role" className={inputClass} />
            {selectEmployee("former_employee_id", false, false)}
            <input name="reason" placeholder="Reason / vacancy details" className={inputClass} />
            <div className="sm:col-span-2">{formButton("Open replacement request")}</div>
          </form>
          <div className="mt-4 space-y-2">
            {data?.replacementNeeds.map((need) => <div key={need.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-dark-3"><span>{need.outlet.name} · {need.department} {need.reason ? `— ${need.reason}` : ""}</span><button disabled={busy} onClick={() => void update(`/replacement-needs/${need.id}`, "filled")} className="rounded bg-green-600 px-2 py-1 text-white"><Check className="size-4" /></button></div>)}
          </div>
        </section>

        <section className={SECTION}>
          <Heading>Record HR policy violation</Heading>
          <form onSubmit={(event) => void submit(event, "/policy-violations")} className="grid gap-3 sm:grid-cols-2">
            <input name="policy_name" required placeholder="Policy / rule" className={inputClass} />
            {selectEmployee("employee_id", false)}
            {selectOutlet("outlet_id")}
            <textarea name="description" required placeholder="Violation details" className={`${inputClass} min-h-20 sm:col-span-2`} />
            <div className="sm:col-span-2">{formButton("Record violation")}</div>
          </form>
          <div className="mt-4 space-y-2">
            {data?.violations.map((violation) => <div key={violation.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-dark-3"><span>{violation.policy_name}: {violation.employee?.full_name || violation.outlet?.name} — {violation.description}</span><button disabled={busy} onClick={() => void update(`/policy-violations/${violation.id}`, "resolved")} className="rounded bg-green-600 px-2 py-1 text-white">Resolve</button></div>)}
          </div>
        </section>

        <section className={`${SECTION} xl:col-span-2`}>
          <Heading>Branch HR compliance tasks</Heading>
          <form onSubmit={(event) => void submit(event, "/compliance-tasks")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {selectOutlet()}
            <input name="title" required placeholder="Required record / task" className={inputClass} />
            <input name="due_date" type="date" className={inputClass} />
            <input name="description" placeholder="Details (optional)" className={inputClass} />
            <div className="sm:col-span-2 xl:col-span-4">{formButton("Add compliance task")}</div>
          </form>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data?.complianceTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-dark-3"><span>{task.outlet.name} · {task.title}{task.due_date ? ` (due ${task.due_date.slice(0, 10)})` : ""}</span><button disabled={busy} onClick={() => void update(`/compliance-tasks/${task.id}`, "completed")} className="rounded bg-green-600 px-2 py-1 text-white">Complete</button></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
