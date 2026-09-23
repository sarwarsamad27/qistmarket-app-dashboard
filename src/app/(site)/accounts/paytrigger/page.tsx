"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Lock, Unlock, CalendarClock, Smartphone, Search, Settings, ShieldCheck, Save, Loader2, Phone, AlertTriangle, CheckCircle2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

function parseLockMessage(raw: any): string {
  if (!raw) return "This device has been locked due to overdue installment payment. Please contact customer service.";
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed.execontent || parsed.message || raw;
    } catch {
      return raw;
    }
  }
  return raw.execontent || raw.message || String(raw);
}

interface Device {
  imei: string;
  remaining_balance?: number;
  order_ref: string | null;
  product_model: string | null;
  lock_status: string;
  enrollment_status: string;
  ptp_status: string;
  promised_date: string | null;
  expiration: string | null;
  order: { customer_name: string; order_ref: string; status: string; installment_ledger: { ledger_rows: any } | null } | null;
}

interface Summary {
  totalDevices: number;
  locked: number;
  unlockedUnpaid: number;
  ptp: { active: number; fulfilled: number; broken: number; none: number };
}

const remainingBalance = (ledgerRows: any): number => {
  const rows = Array.isArray(ledgerRows) ? ledgerRows : [];
  return rows.reduce((acc, r) => (r.status !== "paid" ? acc + Math.max(0, (r.amount || 0) - (r.paid_amount || 0)) : acc), 0);
};

export default function PayTriggerPage() {
  const [tab, setTab] = useState<"locked" | "unpaid" | "ptp" | "settings">("locked");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [ptpStatus, setPtpStatus] = useState<"active" | "fulfilled" | "broken">("active");
  const [promisedFrom, setPromisedFrom] = useState("");
  const [promisedTo, setPromisedTo] = useState("");

  const [config, setConfig] = useState<any>(null);
  const [license, setLicense] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [ruleNum, setRuleNum] = useState("1");
  const [savingRule, setSavingRule] = useState(false);
  const [actionImei, setActionImei] = useState<string | null>(null);

  const reloadDevices = () => {
    setLoadingList(true);
    const params = new URLSearchParams({ limit: "100" });
    if (search) params.set("search", search);
    if (tab === "locked") params.set("lock_status", "locked");
    if (tab === "ptp") {
      params.set("ptp_status", ptpStatus);
      if (promisedFrom) params.set("promisedFrom", promisedFrom);
      if (promisedTo) params.set("promisedTo", promisedTo);
    }
    fetch(`${BACKEND_URL}/api/paytrigger/devices?${params}`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          let list: Device[] = json.data;
          if (tab === "unpaid") {
            list = list.filter((d) => d.lock_status !== "locked" && (d.remaining_balance ?? remainingBalance(d.order?.installment_ledger?.ledger_rows)) > 0);
          }
          setDevices(list);
        }
      })
      .catch((err) => console.error("Failed to load devices:", err))
      .finally(() => setLoadingList(false));
    fetch(`${BACKEND_URL}/api/paytrigger/devices/summary`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setSummary(json.data); })
      .catch(() => {});
  };

  const handleLockToggle = async (d: Device) => {
    const locking = d.lock_status !== "locked";
    setActionImei(d.imei);
    try {
      const res = await fetch(`${BACKEND_URL}/api/paytrigger/device/${encodeURIComponent(d.imei)}/${locking ? "lock" : "unlock"}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success && (!data.data || data.data.code === 200 || !data.data.code)) {
        toast.success(`Device ${locking ? "locked" : "unlocked"} successfully.`);
        reloadDevices();
      } else {
        toast.error(data.message || `Failed to ${locking ? "lock" : "unlock"} device.`);
      }
    } catch (err: any) {
      toast.error("Connection failed.");
    } finally {
      setActionImei(null);
    }
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/paytrigger/devices/summary`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setSummary(json.data); })
      .catch((err) => console.error("Failed to load PayTrigger summary:", err))
      .finally(() => setLoadingSummary(false));
  }, []);

  useEffect(() => {
    if (tab === "settings") return;
    reloadDevices();
  }, [tab, search, ptpStatus, promisedFrom, promisedTo]);

  useEffect(() => {
    if (tab === "settings" && !config) {
      setConfigLoading(true);
      Promise.all([
        fetch(`${BACKEND_URL}/api/paytrigger/company/config`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${BACKEND_URL}/api/paytrigger/company/license`, { headers: authHeaders() }).then((r) => r.json()),
      ]).then(([configJson, licenseJson]) => {
        if (configJson.success) setConfig(configJson.data);
        if (licenseJson.success) setLicense(licenseJson.data);
      }).finally(() => setConfigLoading(false));
    }
  }, [tab]);

  const handleSaveRule = async () => {
    setSavingRule(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/paytrigger/company/lock-rule`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ ruleNum: parseInt(ruleNum) }) });
      if (!res.ok) throw new Error("Failed to update rule.");
      toast.success("Company lock rule updated.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingRule(false);
    }
  };

  const TABS = [
    { key: "locked" as const, label: "Lock Devices", icon: Lock },
    { key: "unpaid" as const, label: "Unlocked & Unpaid", icon: Unlock },
    { key: "ptp" as const, label: "PTP Customers", icon: CalendarClock },
    { key: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <>
      <Breadcrumb pageName="Software Activation" />
      <PageHeader icon={Smartphone} title="Software Activation" subtitle="Device lock status, unpaid unlocked devices, and promise-to-pay tracking." />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {loadingSummary ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryTile icon={Smartphone} label="Total Devices" value={summary?.totalDevices ?? 0} color="text-slate-600" bg="bg-slate-100 dark:bg-white/10" />
            <SummaryTile icon={Lock} label="Locked" value={summary?.locked ?? 0} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" />
            <SummaryTile icon={Unlock} label="Unlocked & Unpaid" value={summary?.unlockedUnpaid ?? 0} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" />
            <SummaryTile icon={CalendarClock} label="Active PTPs" value={summary?.ptp.active ?? 0} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" />
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {tab !== "settings" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search IMEI, order ref..."
              className="w-64 rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
        )}
      </div>

      {tab === "ptp" && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">PTP Status</label>
            <select value={ptpStatus} onChange={(e) => setPtpStatus(e.target.value as any)} className="rounded-xl border border-stroke bg-white px-4 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white">
              <option value="active">Active</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="broken">Broken</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Promised From</label>
            <input type="date" value={promisedFrom} onChange={(e) => setPromisedFrom(e.target.value)} className="rounded-xl border border-stroke bg-white px-4 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Promised To</label>
            <input type="date" value={promisedTo} onChange={(e) => setPromisedTo(e.target.value)} className="rounded-xl border border-stroke bg-white px-4 py-2 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
        </div>
      )}

      {tab === "settings" ? (
        configLoading ? (
          <TableSkeleton rows={3} cols={2} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* License Status Card */}
            {(() => {
              const licObj = license?.data || license || {};
              const totalLic = licObj.totalAmountOfLicense ?? licObj.totalNum ?? 0;
              const usedLic = licObj.amountUsedOfLicense ?? licObj.usedNum ?? 0;
              const remainLic = licObj.remainingAmountOfLicense ?? licObj.availableLicenses ?? licObj.unusedNum ?? Math.max(0, totalLic - usedLic);
              const pctUsed = totalLic > 0 ? Math.round((usedLic / totalLic) * 100) : 0;

              return (
                <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                          <ShieldCheck className="size-4" />
                        </div>
                        <h2 className="text-sm font-bold text-dark dark:text-white">License Status</h2>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10">
                        <CheckCircle2 className="size-3.5" /> License Active
                      </span>
                    </div>

                    <div className="mb-5 grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Quota</p>
                        <p className="mt-1 text-xl font-black text-slate-700 dark:text-white">{totalLic}</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                        <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">Activated</p>
                        <p className="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">{usedLic}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Available</p>
                        <p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-400">{remainLic}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">Quota Allocation</span>
                        <span className="text-slate-700 dark:text-slate-200">{pctUsed}% Utilized</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-dark-3">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, pctUsed)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500 dark:border-white/5 dark:bg-white/5">
                    <strong>Note:</strong> Each newly activated/enrolled device consumes 1 license from the available pool.
                  </div>
                </div>
              );
            })()}

            {/* Company Lock Rule Card */}
            {(() => {
              const cfgObj = config?.data || config || {};
              const helpline = cfgObj.customerServiceNum || "3041111144";
              const whitelistPhone = cfgObj.whitelistPhoneNum || "None";
              const lockMsg = parseLockMessage(cfgObj.screenBlockedContent);
              const simMsg = cfgObj.watermarkOfSimRemovedContent || "This device is under a financial installment plan. To avoid lock, please make payments on time.";

              return (
                <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-boxdark">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                          <Settings className="size-4" />
                        </div>
                        <h2 className="text-sm font-bold text-dark dark:text-white">Company Lock Rule</h2>
                      </div>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-500/10">
                        Rule #{ruleNum} Active
                      </span>
                    </div>

                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <Phone className="size-3" /> Customer Helpline
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-dark dark:text-white">{helpline}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5">
                        <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <Phone className="size-3" /> Whitelisted Numbers
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {whitelistPhone !== "None" && whitelistPhone !== "" ? whitelistPhone : "Standard Emergency Calls Only"}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 space-y-3">
                      <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 dark:border-rose-500/20 dark:bg-rose-500/10">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                          <Lock className="size-3.5" /> Screen Lock Display Message
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{lockMsg}"</p>
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="size-3.5" /> SIM Removal Warning Message
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic">"{simMsg}"</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">Rule Profile Number</label>
                      <input
                        type="number"
                        value={ruleNum}
                        onChange={(e) => setRuleNum(e.target.value)}
                        className="w-full rounded-xl border border-stroke bg-white px-4 py-2 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                      />
                    </div>
                    <button
                      onClick={handleSaveRule}
                      disabled={savingRule}
                      className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50"
                    >
                      {savingRule ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save Rule
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )
      ) : loadingList ? (
        <TableSkeleton />
      ) : devices.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-bold">IMEI</th>
                  <th className="px-4 py-3 font-bold">Order Ref</th>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 font-bold">Product</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  {tab === "unpaid" && <th className="px-4 py-3 text-right font-bold">Outstanding</th>}
                  {tab === "ptp" && <th className="px-4 py-3 font-bold">Promised Date</th>}
                  <th className="px-4 py-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.imei} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{d.imei}</td>
                    <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{d.order_ref || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{d.order?.customer_name || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{d.product_model || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${d.lock_status === "locked" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"}`}>
                        {d.lock_status}
                      </span>
                    </td>
                    {tab === "unpaid" && (
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-amber-600">{PKR(d.remaining_balance ?? remainingBalance(d.order?.installment_ledger?.ledger_rows))}</td>
                    )}
                    {tab === "ptp" && (
                      <td className="px-4 py-3.5 text-gray-500">{d.promised_date ? new Date(d.promised_date).toLocaleDateString() : "—"}</td>
                    )}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleLockToggle(d)}
                        disabled={actionImei === d.imei}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${d.lock_status === "locked" ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10" : "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10"}`}
                      >
                        {actionImei === d.imei ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : d.lock_status === "locked" ? (
                          <Unlock className="size-3.5" />
                        ) : (
                          <Lock className="size-3.5" />
                        )}
                        {d.lock_status === "locked" ? "Unlock" : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <EmptyState icon={Smartphone} title="No devices found" description="Nothing matches this filter right now." />
        </div>
      )}
    </>
  );
}

function SummaryTile({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <div className={`flex size-10 items-center justify-center rounded-xl ${bg} ${color}`}>
        <Icon className="size-4" strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-xl font-black text-dark dark:text-white">{value}</p>
      </div>
    </div>
  );
}
