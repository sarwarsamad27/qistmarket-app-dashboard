"use client";

import { Fragment, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Search, MonitorSmartphone, Globe } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import ExportMenu from "@/components/Accounts/ExportMenu";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Device { device: string; last_used: string; first_seen: string | null; is_new: boolean }
interface UserRow { user_id: number; name: string; username: string | null; role: string | null; outlet: string; logins: number; failed: number; last_login: string | null; last_ip: string | null; ips: string[]; ip_count: number; devices: Device[]; device_count: number; new_devices: number }
interface IpRow { ip: string; users: string[]; user_count: number; logins: number; failed: number; last_seen: string }

/** Short, readable name for a user-agent string. */
const deviceName = (ua: string) => {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : /okhttp|Dart/i.test(ua) ? "Mobile app" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /Dart|okhttp/i.test(ua) ? "App" : "";
  return `${os}${browser ? ` · ${browser}` : ""}`;
};

/** Which IPs and devices every user logs in from, and which accounts share an IP. */
export default function DeviceTracking() {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [view, setView] = useState<"users" | "ips">("users");
  const [data, setData] = useState<{ users: UserRow[]; ips: IpRow[] } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setDq(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    setData(null);
    fetch(`${BACKEND_URL}/api/accounts/audit/devices?days=${days}&search=${encodeURIComponent(dq)}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [days, dq]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          <button onClick={() => setView("users")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "users" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}><MonitorSmartphone className="size-3.5" /> By user</button>
          <button onClick={() => setView("ips")} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === "ips" ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}><Globe className="size-3.5" /> By IP address</button>
        </div>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="rounded-xl border border-stroke bg-white px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white">
          {[7, 30, 90, 180].map((d) => <option key={d} value={d}>Last {d} days</option>)}
        </select>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="User, login ID, IP, outlet..." className="w-full rounded-xl border border-stroke bg-white py-2 pl-9 pr-3 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
        <div className="ml-auto">
          {view === "users" ? (
            <ExportMenu title="Device & IP tracking by user" columns={[
              { header: "User", value: (u: UserRow) => u.name },
              { header: "Login ID", value: (u) => u.username || "" },
              { header: "Role", value: (u) => u.role || "" },
              { header: "Outlet", value: (u) => u.outlet },
              { header: "Logins", value: (u) => u.logins, numeric: true },
              { header: "Failed", value: (u) => u.failed, numeric: true },
              { header: "IPs", value: (u) => u.ips.join(", ") },
              { header: "Devices", value: (u) => u.devices.map((d) => deviceName(d.device)).join(", ") },
              { header: "New devices (7d)", value: (u) => u.new_devices, numeric: true },
              { header: "Last login", value: (u) => (u.last_login ? new Date(u.last_login).toLocaleString() : "") },
            ]} getRows={() => data?.users || []} />
          ) : (
            <ExportMenu title="Device & IP tracking by IP" columns={[
              { header: "IP", value: (i: IpRow) => i.ip },
              { header: "Accounts", value: (i) => i.users.join(", ") },
              { header: "Account count", value: (i) => i.user_count, numeric: true },
              { header: "Logins", value: (i) => i.logins, numeric: true },
              { header: "Failed", value: (i) => i.failed, numeric: true },
              { header: "Last seen", value: (i) => new Date(i.last_seen).toLocaleString() },
            ]} getRows={() => data?.ips || []} />
          )}
        </div>
      </div>

      {!data ? <TableSkeleton /> : view === "users" ? (
        data.users.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3 text-right">Logins</th><th className="px-4 py-3 text-right">Failed</th><th className="px-4 py-3 text-right">IPs</th><th className="px-4 py-3 text-right">Devices</th><th className="px-4 py-3">Last Login</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <Fragment key={u.user_id}>
                    <tr onClick={() => setExpanded(expanded === u.user_id ? null : u.user_id)} className="cursor-pointer border-t border-slate-50 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{u.name}</p><p className="text-xs text-gray-400">{u.username}{u.role ? ` · ${u.role}` : ""}</p></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.outlet}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.logins}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${u.failed ? "font-semibold text-rose-600" : ""}`}>{u.failed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.ip_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.device_count}{u.new_devices > 0 && <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10">{u.new_devices} new</span>}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{u.last_login ? new Date(u.last_login).toLocaleString() : "—"}<p className="font-mono">{u.last_ip}</p></td>
                    </tr>
                    {expanded === u.user_id && (
                      <tr className="bg-slate-50/60 dark:bg-white/5">
                        <td colSpan={7} className="px-6 py-3 text-xs">
                          <p className="mb-1 font-bold text-gray-500">IP addresses: <span className="font-mono font-normal">{u.ips.join(", ") || "—"}</span></p>
                          <div className="space-y-1">
                            {u.devices.map((d, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-dark dark:text-white">{deviceName(d.device)}</span>
                                {d.is_new && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">new this week</span>}
                                <span className="text-gray-400">first seen {d.first_seen ? new Date(d.first_seen).toLocaleDateString() : "—"} · last used {new Date(d.last_used).toLocaleString()}</span>
                                <span className="w-full truncate text-[10px] text-gray-400" title={d.device}>{d.device}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={MonitorSmartphone} title="No logins in this period" /></div>
      ) : (
        data.ips.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3">IP Address</th><th className="px-4 py-3">Accounts using it</th><th className="px-4 py-3 text-right">Logins</th><th className="px-4 py-3 text-right">Failed</th><th className="px-4 py-3">Last Seen</th></tr></thead>
              <tbody>
                {data.ips.map((i) => (
                  <tr key={i.ip} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3 font-mono text-xs text-dark dark:text-white">{i.ip}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300"><span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${i.user_count >= 3 ? "bg-amber-50 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{i.user_count}</span>{i.users.slice(0, 8).join(", ")}{i.users.length > 8 ? "…" : ""}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{i.logins}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${i.failed ? "font-semibold text-rose-600" : ""}`}>{i.failed}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(i.last_seen).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Globe} title="No IP data in this period" /></div>
      )}
    </div>
  );
}
