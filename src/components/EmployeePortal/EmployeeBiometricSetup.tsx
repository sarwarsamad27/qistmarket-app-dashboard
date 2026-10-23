"use client";
import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import toast from "react-hot-toast";
type Setup = { employee_code: string; state: string; error?: string; device_id?: number };
type Config = { device_id: number; department_id: string };
type Status = { setup: Setup | null; config: Config | null; outlet_id: number | null; devices: { id: number; name: string; ip: string }[] };
export default function EmployeeBiometricSetup({ employeeId, outletId, onUpdated }: { employeeId: string; outletId?: number | null; onUpdated: () => void }) {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [device, setDevice] = useState("");
  const [department, setDepartment] = useState("");
  const load = async () => {
    const r: Status = await hrFetch(`/employees/${employeeId}/zlink`);
    setData(r); setDevice(String(r.config?.device_id || "")); setDepartment(r.config?.department_id || ""); setError("");
  };
  useEffect(() => { setData(null); load().catch(e => setError(e.message)); }, [employeeId, outletId]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (e) { setError((e as Error).message); toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const field = "rounded-lg border border-stroke p-2 text-sm dark:border-stroke-dark dark:bg-dark-3";
  return <section className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2 lg:col-span-2">
    <h3 className="mb-3 font-semibold">Biometric Device Setup</h3>
    {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}
    {!data ? <button disabled={busy} onClick={() => run(load)} className={field}>Load device setup</button> : <>
      <p className="text-sm">Biometric ID: {data.setup?.employee_code || "Not assigned"}</p>
      <p className="text-sm">Status: {data.setup?.state === "assigned" ? "Assigned in Zlink; physical enrollment not confirmed" : data.setup?.state || "Not configured"}</p>
      {data.setup?.error && <p className="mt-2 text-sm text-amber-600">{data.setup.error}</p>}
      {data.setup?.device_id && data.config && data.setup.device_id !== data.config.device_id && <p className="text-sm text-amber-600">Outlet device changed. Assign this employee to the new device below.</p>}
      <p className="mt-2 text-sm">Outlet device: {data.devices.find(d => d.id === data.config?.device_id)?.name || "Not configured"}</p>
      {!data.outlet_id && <p className="mt-2 text-sm">Assign an outlet through Edit Profile first.</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        <button disabled={busy || !data.outlet_id} className={field} onClick={() => run(async () => { const r = await hrFetch("/zlink/catalog"); setDepartments(r.departments); setEditing(true); })}>Configure outlet device</button>
        <button disabled={busy || !data.config} className="rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-50" onClick={() => run(async () => {
          try { const r = await hrFetch(`/employees/${employeeId}/zlink/provision`, { method: "POST", body: "{}" }); toast.success(r.message); }
          finally { await load(); onUpdated(); }
        })}>{busy ? "Working..." : "Create / assign on outlet device"}</button>
        <button disabled={busy} className={field} onClick={() => run(load)}>Refresh status</button>
      </div>
      {editing && <div className="mt-4 space-y-3">
        <p className="text-sm">This mapping applies to all employees at this outlet. Choose the department for newly created Zlink employees.</p>
        <div className="flex flex-wrap gap-3">
          <select aria-label="Outlet attendance device" className={field} value={device} onChange={e => setDevice(e.target.value)}><option value="">Select device</option>{data.devices.map(d => <option key={d.id} value={d.id}>{d.name || d.ip} ({d.ip})</option>)}</select>
          <select aria-label="Zlink department" className={field} value={department} onChange={e => setDepartment(e.target.value)}><option value="">Select Zlink department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <button disabled={busy || !device || !department} className={field} onClick={() => run(async () => { await hrFetch(`/employees/${employeeId}/zlink/config`, { method: "PUT", body: JSON.stringify({ device_id: Number(device), department_id: department }) }); await load(); setEditing(false); toast.success("Outlet device mapping saved"); })}>Save mapping</button>
        </div>
      </div>}
      <p className="mt-4 text-xs text-gray-500">After assignment, enroll fingerprint/face using the machine or Zlink, then make a test attendance punch. Existing assignments on a previous outlet device are retained for HR to review in Zlink.</p>
      <a href="https://zlink.minervaiot.com" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary">Open Zlink for verification enrollment</a>
    </>}
  </section>;
}
