"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { hrFetch } from "@/lib/employee-api";
import { Fingerprint, RefreshCw, Search, Settings2, UserPlus, Link2, Unlink, CalendarDays, X } from "lucide-react";
import toast from "react-hot-toast";

interface Device {
  id: number; name?: string | null; ip: string; port: number; source?: string;
  user_count?: number | null; log_count?: number | null; log_capacity?: number | null;
  last_sync_at?: string | null; last_status?: string | null; last_error?: string | null; connected: boolean;
}
interface Stats {
  total_punches: number; today_punches: number; today_employees: number;
  device_users: number; linked_users: number; unlinked_users: number;
}
interface LinkedEmployee { id: number; employee_id: string; full_name: string; department?: string | null; designation?: string | null; status?: string }
interface DeviceUser {
  id: number; uid: number; user_id: string; name: string | null; role: number; is_admin: boolean;
  card_no: string | null; has_password: boolean; punch_count: number;
  first_punch: string | null; last_punch: string | null; employee: LinkedEmployee | null;
  device: { id: number; ip: string; name?: string | null };
}
interface Punch {
  id: number; user_sn: number; device_user_id: string; device_name: string | null;
  employee: { id: number; employee_id: string; full_name: string } | null;
  date: string; time: string; device: { ip: string; name?: string | null };
}
interface Day {
  date: string; status: string; check_in: string; check_out: string | null;
  overtime_hrs: number; missed_punch: boolean; punches: string[];
}
interface Employee { id: number; employee_id: string; full_name: string; device_user_id?: string | null; status?: string }
interface Credential { device_user_id: string; id: number; full_name: string; username: string; password: string; employee_id: string }

const pkDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const to12h = (t?: string | null) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const todayPk = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
const input = "rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3";
const card = "rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2";

export default function HrBiometricPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<DeviceUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState<"users" | "punches">("users");
  const [syncing, setSyncing] = useState(false);
  const [editDevice, setEditDevice] = useState<Partial<Device> | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<Credential[] | null>(null);

  const [daysFor, setDaysFor] = useState<DeviceUser | null>(null);
  const [daysMonth, setDaysMonth] = useState(new Date().getMonth() + 1);
  const [daysYear, setDaysYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<Day[]>([]);

  const [punches, setPunches] = useState<Punch[]>([]);
  const [punchTotal, setPunchTotal] = useState(0);
  const [punchPages, setPunchPages] = useState(1);
  const [punchPage, setPunchPage] = useState(1);
  const [punchFrom, setPunchFrom] = useState(todayPk());
  const [punchTo, setPunchTo] = useState(todayPk());
  const [punchUser, setPunchUser] = useState("");

  const loadStatus = useCallback(() => hrFetch("/biometric/device-status").then((r) => { setDevices(r.devices || []); setStats(r.stats || null); }).catch((e) => toast.error(e.message)), []);
  const loadUsers = useCallback(() => hrFetch("/biometric/device-users").then((r) => setUsers(r.users || [])).catch((e) => toast.error(e.message)), []);
  const loadEmployees = useCallback(() => hrFetch("/employees").then((r) => setEmployees(r.employees || [])).catch(() => {}), []);
  const loadPunches = useCallback(() => {
    const q = new URLSearchParams({ page: String(punchPage), limit: "50" });
    if (punchFrom) q.set("from", punchFrom);
    if (punchTo) q.set("to", punchTo);
    if (punchUser) q.set("device_user_id", punchUser);
    return hrFetch(`/biometric/punches?${q}`).then((r) => { setPunches(r.punches || []); setPunchTotal(r.total || 0); setPunchPages(r.totalPages || 1); }).catch((e) => toast.error(e.message));
  }, [punchPage, punchFrom, punchTo, punchUser]);

  useEffect(() => { loadStatus(); loadUsers(); loadEmployees(); }, [loadStatus, loadUsers, loadEmployees]);
  useEffect(() => { if (tab === "punches") loadPunches(); }, [tab, loadPunches]);
  useEffect(() => {
    if (!daysFor) return;
    hrFetch(`/biometric/device-users/${encodeURIComponent(daysFor.user_id)}/days?month=${daysMonth}&year=${daysYear}`)
      .then((r) => setDays(r.days || [])).catch((e) => toast.error(e.message));
  }, [daysFor, daysMonth, daysYear]);

  const refreshAll = () => Promise.all([loadStatus(), loadUsers(), loadEmployees(), tab === "punches" ? loadPunches() : null]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const r = await hrFetch("/biometric/sync", { method: "POST", body: JSON.stringify({}) });
      toast.success(r.message);
      await refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
      loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  const saveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDevice) return;
    try {
      await hrFetch("/biometric/device", { method: "PUT", body: JSON.stringify(editDevice) });
      toast.success("Device saved — syncing…");
      setEditDevice(null);
      await loadStatus();
      syncNow();
    } catch (err) { toast.error((err as Error).message); }
  };

  const link = async (deviceUserId: string, employeeId: string | null) => {
    try {
      const r = await hrFetch("/biometric/device-users/link", { method: "POST", body: JSON.stringify({ device_user_id: deviceUserId, employee_id: employeeId ? parseInt(employeeId) : null }) });
      toast.success(r.message);
      await Promise.all([loadUsers(), loadEmployees(), loadStatus()]);
    } catch (e) { toast.error((e as Error).message); }
  };

  const createEmployees = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`Create ${ids.length} new HR employee(s) from the device, each linked to its device ID? Their past punches will fill their attendance.`)) return;
    try {
      const r = await hrFetch("/biometric/device-users/create-employees", { method: "POST", body: JSON.stringify({ device_user_ids: ids }) });
      toast.success(`${r.created.length} employee(s) created${r.skipped.length ? `, ${r.skipped.length} skipped (already linked)` : ""}`);
      if (r.created.length) setCredentials(r.created);
      setSelected([]);
      await Promise.all([loadUsers(), loadEmployees(), loadStatus()]);
    } catch (e) { toast.error((e as Error).message); }
  };

  const filteredUsers = useMemo(() => users.filter((u) => {
    const s = userSearch.toLowerCase();
    if (s && !(`${u.user_id} ${u.name || ""} ${u.employee?.full_name || ""} ${u.employee?.employee_id || ""}`.toLowerCase().includes(s))) return false;
    if (userFilter === "linked" && !u.employee) return false;
    if (userFilter === "unlinked" && u.employee) return false;
    return true;
  }), [users, userSearch, userFilter]);

  const unlinkedEmployees = employees.filter((e) => !e.device_user_id);
  const selectableIds = filteredUsers.filter((u) => !u.employee).map((u) => u.user_id);
  const device = devices[0];

  const statCards: [string, number | undefined, string][] = [
    ["Total punches stored", stats?.total_punches, "All punches read from the device"],
    ["Punches today", stats?.today_punches, "Since 12:00 AM (PKT)"],
    ["Employees punched today", stats?.today_employees, "Distinct device IDs"],
    ["Users on device", stats?.device_users, "Enrolled on the device"],
    ["Linked to HR", stats?.linked_users, "Attendance flows to HR"],
    ["Not linked", stats?.unlinked_users, "Link or create employees"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-dark dark:text-white"><Fingerprint className="h-6 w-6 text-primary" /> Biometric Device</h1>
          <p className="text-xs text-gray-500">Branch attendance devices via ZKBio Zlink — punches sync automatically every few minutes; linked employees&apos; attendance is filled from them. Manual entries are never overwritten.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/hr/attendance" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">Attendance</Link>
          <button onClick={syncNow} disabled={syncing || !device} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </div>

      {/* Devices */}
      <div className={card}>
        {!device && !editDevice && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">No device added yet.</p>
            <button onClick={() => setEditDevice({ ip: "", port: 4370, name: "Attendance Device" })} className="rounded-lg bg-primary px-3 py-2 text-sm text-white">Add Device</button>
          </div>
        )}
        {device && !editDevice && (
          <div className="divide-y divide-stroke dark:divide-stroke-dark">
            {devices.map((d) => (
              <div key={d.id} className="flex flex-wrap items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="space-y-1 text-sm">
                  <p className="text-base font-semibold text-dark dark:text-white">
                    {d.name || "Attendance Device"}{" "}
                    <span className="font-mono text-sm font-normal text-gray-500">{d.source === "zlink" ? `ZKBio Zlink · SN ${d.ip}` : `${d.ip}:${d.port}`}</span>
                  </p>
                  <p>
                    Status:{" "}
                    {d.connected ? <span className="rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green">{d.source === "zlink" ? "Syncing" : "Connected"}</span>
                      : d.last_status === "error" ? <span className="rounded-full bg-red/10 px-2 py-0.5 text-xs font-medium text-red">Not reachable</span>
                        : <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs text-gray-500 dark:bg-dark-3">Not synced recently</span>}
                    <span className="ml-3 text-xs text-gray-500">Last sync: {pkDateTime(d.last_sync_at)}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {d.source === "zlink" ? "People seen" : "Users on device"}: <strong>{d.user_count ?? "—"}</strong> · {d.source === "zlink" ? "Punches stored" : "Logs on device"}: <strong>{d.log_count?.toLocaleString() ?? "—"}</strong>
                    {d.log_capacity ? <> / {d.log_capacity.toLocaleString()} capacity ({Math.round(((d.log_count || 0) / d.log_capacity) * 100)}% used)</> : null}
                  </p>
                  {d.last_status === "error" && d.last_error && <p className="rounded bg-red/5 px-2 py-1 text-xs text-red">{d.last_error}</p>}
                </div>
                {d.source !== "zlink" && (
                  <button onClick={() => setEditDevice(d)} className="flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 text-xs dark:border-stroke-dark"><Settings2 className="h-3.5 w-3.5" /> Device settings</button>
                )}
              </div>
            ))}
          </div>
        )}
        {editDevice && (
          <form onSubmit={saveDevice} className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500">Name
              <input value={editDevice.name || ""} onChange={(e) => setEditDevice({ ...editDevice, name: e.target.value })} className={`mt-1 block ${input}`} />
            </label>
            <label className="text-xs text-gray-500">Device IP
              <input required value={editDevice.ip || ""} onChange={(e) => setEditDevice({ ...editDevice, ip: e.target.value })} placeholder="192.168.1.201" className={`mt-1 block font-mono ${input}`} />
            </label>
            <label className="text-xs text-gray-500">Port
              <input required type="number" value={editDevice.port || 4370} onChange={(e) => setEditDevice({ ...editDevice, port: parseInt(e.target.value) })} className={`mt-1 block w-28 ${input}`} />
            </label>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Save &amp; Sync</button>
            <button type="button" onClick={() => setEditDevice(null)} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-stroke-dark">Cancel</button>
          </form>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map(([label, value, hint]) => (
          <div key={label} className={card}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-dark dark:text-white">{value?.toLocaleString() ?? "—"}</p>
            <p className="text-[10px] text-gray-400">{hint}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stroke dark:border-stroke-dark">
        {([["users", `Device Users (${users.length})`], ["punches", "Punch Log"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-dark dark:hover:text-white"}`}>{label}</button>
        ))}
      </div>

      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search device ID, name or employee…" className={`w-full pl-9 ${input}`} />
            </div>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value as typeof userFilter)} className={input}>
              <option value="all">All users</option><option value="linked">Linked to HR</option><option value="unlinked">Not linked</option>
            </select>
            <button onClick={() => createEmployees(selected)} disabled={!selected.length} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-white disabled:opacity-40">
              <UserPlus className="h-4 w-4" /> Create employees ({selected.length})
            </button>
          </div>
          <p className="text-xs text-gray-500">Link each device user to their HR employee (or create one). Once linked, all of that person&apos;s punches — past and future — become their attendance.</p>

          <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-1 text-xs text-gray-500 dark:bg-dark-3">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selectableIds.length > 0 && selectableIds.every((i) => selected.includes(i))}
                      onChange={(e) => setSelected(e.target.checked ? selectableIds : [])} title="Select all not-linked users" />
                  </th>
                  <th className="px-3 py-3 text-left">Device ID</th>
                  <th className="px-3 py-3 text-left">Name on device</th>
                  <th className="px-3 py-3 text-left">Role / Card</th>
                  <th className="px-3 py-3 text-right">Punches</th>
                  <th className="px-3 py-3 text-left">First punch</th>
                  <th className="px-3 py-3 text-left">Last punch</th>
                  <th className="px-3 py-3 text-left">HR employee</th>
                  <th className="px-3 py-3 text-center">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-500">{users.length ? "No users match." : "No device users yet — press Sync Now."}</td></tr>}
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-t border-stroke dark:border-stroke-dark">
                    <td className="px-3 py-2 text-center">
                      {!u.employee && <input type="checkbox" checked={selected.includes(u.user_id)} onChange={(e) => setSelected(e.target.checked ? [...selected, u.user_id] : selected.filter((i) => i !== u.user_id))} />}
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold">{u.user_id}</td>
                    <td className="px-3 py-2">{u.name || <span className="text-gray-400">(no name)</span>}</td>
                    <td className="px-3 py-2 text-xs">
                      {u.is_admin ? <span className="rounded bg-yellow-light-4/30 px-1.5 py-0.5 text-yellow-dark">Device admin</span> : <span className="text-gray-500">User</span>}
                      {u.card_no && <span className="ml-1 text-gray-500">· Card {u.card_no}</span>}
                      {u.has_password && <span className="ml-1 text-gray-500">· PIN</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{u.punch_count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{pkDateTime(u.first_punch)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{pkDateTime(u.last_punch)}</td>
                    <td className="px-3 py-2">
                      {u.employee ? (
                        <div className="flex items-center gap-2">
                          <Link href={`/hr/employees/${u.employee.id}`} className="text-primary hover:underline">{u.employee.full_name}</Link>
                          <span className="font-mono text-xs text-gray-500">{u.employee.employee_id}</span>
                          <button onClick={() => { if (confirm(`Unlink device ID ${u.user_id} from ${u.employee?.full_name}? Attendance already recorded stays.`)) link(u.user_id, null); }} title="Unlink" className="text-gray-400 hover:text-red"><Unlink className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <select value={linkChoice[u.user_id] || ""} onChange={(e) => setLinkChoice({ ...linkChoice, [u.user_id]: e.target.value })} className="max-w-[180px] rounded border border-stroke px-2 py-1 text-xs dark:border-stroke-dark dark:bg-dark-3">
                            <option value="">Link to employee…</option>
                            {unlinkedEmployees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>)}
                          </select>
                          <button onClick={() => link(u.user_id, linkChoice[u.user_id])} disabled={!linkChoice[u.user_id]} title="Link" className="rounded border border-stroke p-1 text-primary disabled:opacity-30 dark:border-stroke-dark"><Link2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => createEmployees([u.user_id])} title="Create new HR employee from this device user" className="rounded border border-stroke p-1 text-primary dark:border-stroke-dark"><UserPlus className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { setDays([]); setDaysFor(u); }} className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-1 text-xs dark:border-stroke-dark"><CalendarDays className="h-3.5 w-3.5" /> Days</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "punches" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500">From<input type="date" value={punchFrom} onChange={(e) => { setPunchFrom(e.target.value); setPunchPage(1); }} className={`mt-1 block ${input}`} /></label>
            <label className="text-xs text-gray-500">To<input type="date" value={punchTo} onChange={(e) => { setPunchTo(e.target.value); setPunchPage(1); }} className={`mt-1 block ${input}`} /></label>
            <label className="text-xs text-gray-500">Device user
              <select value={punchUser} onChange={(e) => { setPunchUser(e.target.value); setPunchPage(1); }} className={`mt-1 block ${input}`}>
                <option value="">Everyone</option>
                {users.map((u) => <option key={u.id} value={u.user_id}>ID {u.user_id} — {u.employee?.full_name || u.name || "(no name)"}</option>)}
              </select>
            </label>
            <button onClick={() => { setPunchFrom(""); setPunchTo(""); setPunchPage(1); }} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">All dates</button>
            <span className="ml-auto text-sm text-gray-500">{punchTotal.toLocaleString()} punch(es)</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-1 text-xs text-gray-500 dark:bg-dark-3">
                <tr>
                  <th className="px-3 py-3 text-left">Log #</th><th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Time</th>
                  <th className="px-3 py-3 text-left">Device ID</th><th className="px-3 py-3 text-left">Name on device</th><th className="px-3 py-3 text-left">HR employee</th><th className="px-3 py-3 text-left">Device</th>
                </tr>
              </thead>
              <tbody>
                {punches.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-500">No punches for this filter.</td></tr>}
                {punches.map((p) => (
                  <tr key={p.id} className="border-t border-stroke dark:border-stroke-dark">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.user_sn}</td>
                    <td className="px-3 py-2">{new Date(`${p.date}T00:00:00`).toLocaleDateString("en-PK", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-3 py-2 font-medium">{to12h(p.time)}</td>
                    <td className="px-3 py-2 font-mono">{p.device_user_id}</td>
                    <td className="px-3 py-2">{p.device_name || "—"}</td>
                    <td className="px-3 py-2">{p.employee ? <Link href={`/hr/employees/${p.employee.id}`} className="text-primary hover:underline">{p.employee.full_name}</Link> : <span className="text-xs text-gray-400">Not linked</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{p.device.name || p.device.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {punchPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <button disabled={punchPage <= 1} onClick={() => setPunchPage(punchPage - 1)} className="rounded border border-stroke px-3 py-1 disabled:opacity-40 dark:border-stroke-dark">Prev</button>
              <span>Page {punchPage} of {punchPages}</span>
              <button disabled={punchPage >= punchPages} onClick={() => setPunchPage(punchPage + 1)} className="rounded border border-stroke px-3 py-1 disabled:opacity-40 dark:border-stroke-dark">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Day-by-day attendance of one device user */}
      {daysFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDaysFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-dark-2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Device ID {daysFor.user_id} — {daysFor.employee?.full_name || daysFor.name || "(no name)"}</h2>
                <p className="text-xs text-gray-500">
                  Attendance worked out from the punches (first = check-in, last = check-out; punches before the day-start time count for the previous day).
                  {!daysFor.employee && " Not linked yet — link to an employee to save this to HR attendance."}
                </p>
              </div>
              <button onClick={() => setDaysFor(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-3 flex gap-2">
              <select value={daysMonth} onChange={(e) => setDaysMonth(+e.target.value)} className={input}>
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("default", { month: "long" })}</option>)}
              </select>
              <select value={daysYear} onChange={(e) => setDaysYear(+e.target.value)} className={input}>
                {[daysYear - 1, daysYear, daysYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="ml-auto self-center text-xs text-gray-500">
                {days.length} day(s) · Late {days.filter((d) => d.status === "late").length} · Missed punch {days.filter((d) => d.missed_punch).length} · OT {days.reduce((s, d) => s + d.overtime_hrs, 0).toFixed(1)}h
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500"><tr className="border-b border-stroke dark:border-stroke-dark">
                <th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-left">Check-in</th>
                <th className="px-2 py-2 text-left">Check-out</th><th className="px-2 py-2 text-left">OT</th><th className="px-2 py-2 text-left">All punches</th>
              </tr></thead>
              <tbody>
                {days.length === 0 && <tr><td colSpan={6} className="px-2 py-8 text-center text-gray-500">No punches this month.</td></tr>}
                {days.map((d) => (
                  <tr key={d.date} className="border-b border-stroke dark:border-stroke-dark">
                    <td className="px-2 py-1.5">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-PK", { weekday: "short", day: "2-digit", month: "short" })}</td>
                    <td className="px-2 py-1.5"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${d.status === "late" ? "bg-yellow-light-4/20 text-yellow-dark" : "bg-green/10 text-green"}`}>{d.status}</span></td>
                    <td className="px-2 py-1.5">{to12h(d.check_in)}</td>
                    <td className="px-2 py-1.5">{d.check_out ? to12h(d.check_out) : d.missed_punch ? <span className="rounded bg-red/10 px-1.5 py-0.5 text-xs text-red">Missed punch</span> : "—"}</td>
                    <td className="px-2 py-1.5">{d.overtime_hrs ? `${d.overtime_hrs}h` : "—"}</td>
                    <td className="px-2 py-1.5 text-xs text-gray-500">{d.punches.map(to12h).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Portal logins for employees created from the device */}
      {credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-dark-2">
            <h2 className="text-lg font-bold">Employees created</h2>
            <p className="mb-3 text-xs text-red">Save these portal passwords now — they are not shown again (use Reset Password on the employee page later).</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500"><tr className="border-b border-stroke dark:border-stroke-dark">
                <th className="px-2 py-2 text-left">Device ID</th><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2 text-left">Employee ID</th><th className="px-2 py-2 text-left">Username</th><th className="px-2 py-2 text-left">Password</th>
              </tr></thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.id} className="border-b border-stroke dark:border-stroke-dark">
                    <td className="px-2 py-1.5 font-mono">{c.device_user_id}</td>
                    <td className="px-2 py-1.5"><Link href={`/hr/employees/${c.id}`} className="text-primary hover:underline">{c.full_name}</Link></td>
                    <td className="px-2 py-1.5 font-mono text-xs">{c.employee_id}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{c.username}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">Open each employee to add department, designation, salary and other details.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(credentials.map((c) => `${c.full_name}\t${c.employee_id}\t${c.username}\t${c.password}`).join("\n")).then(() => toast.success("Copied"))} className="flex-1 rounded-lg border border-stroke py-2 text-sm dark:border-stroke-dark">Copy all</button>
              <button onClick={() => setCredentials(null)} className="flex-1 rounded-lg bg-primary py-2 text-sm text-white">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
