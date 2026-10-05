"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Lock, Unlock, CalendarClock, Smartphone, Settings, ShieldCheck, Save, Loader2, Phone, AlertTriangle, CheckCircle2, WifiOff, ListChecks } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage } from "@/lib/apiErrors";
import DeviceList, { DeviceView, PtSummary } from "./_components/DeviceList";

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

export default function PayTriggerPage() {
  const [tab, setTab] = useState<DeviceView | "settings">("unlocked_overdue");
  const [summary, setSummary] = useState<PtSummary | null>(null);
  const [outlets, setOutlets] = useState<{ id: number; name: string }[]>([]);

  const [config, setConfig] = useState<any>(null);
  const [license, setLicense] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [ruleNum, setRuleNum] = useState("1");
  const [savingRule, setSavingRule] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/cash/limit-options`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setOutlets(j.data.outlets); }).catch(() => {});
  }, []);

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
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to update rule."));
      toast.success("Company lock rule updated.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingRule(false);
    }
  };

  const TABS: { key: DeviceView | "settings"; label: string; icon: any; count?: number }[] = [
    { key: "unlocked_overdue", label: "Unlocked & Overdue", icon: Unlock, count: summary?.unlocked_overdue },
    { key: "locked", label: "Locked Devices", icon: Lock, count: summary?.locked },
    { key: "locked_paid", label: "Locked but Paid", icon: CheckCircle2, count: summary?.locked_paid },
    { key: "ptp", label: "PTP Customers", icon: CalendarClock, count: summary?.ptp_active },
    { key: "offline", label: "Offline > 7 days", icon: WifiOff, count: summary?.offline_7d },
    { key: "all", label: "All Devices", icon: ListChecks, count: summary?.total },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      <Breadcrumb pageName="Software Activation" />
      <PageHeader icon={Smartphone} title="Software Activation (PayTrigger)" subtitle="Device locks checked against each customer's real ledger — who should be locked, who should be unlocked, and promise-to-pay follow-up." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {!summary ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryTile icon={Smartphone} label="Devices (active)" value={summary.active} color="text-slate-600" bg="bg-slate-100 dark:bg-white/10" note={`${summary.total} total · ${summary.pending_enrollment} pending`} />
            <SummaryTile icon={Lock} label="Locked" value={summary.locked} color="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" />
            <SummaryTile icon={Unlock} label="Unlocked & Overdue" value={summary.unlocked_overdue} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" note={`${PKR(summary.unlocked_overdue_amount)} overdue`} />
            <SummaryTile icon={CheckCircle2} label="Locked but Paid" value={summary.locked_paid} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" note="should be unlocked" />
            <SummaryTile icon={CalendarClock} label="Active PTPs" value={summary.ptp_active} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" note={`${summary.ptp_due_today} due today · ${summary.ptp_overdue} date passed`} />
            <SummaryTile icon={WifiOff} label="Offline > 7 days" value={summary.offline_7d} color="text-gray-600" bg="bg-gray-100 dark:bg-white/10" />
          </>
        )}
      </div>

      <div className="mb-4 flex w-fit flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}{t.count !== undefined && <span className="rounded-full bg-gray-200 px-1.5 text-[10px] dark:bg-white/10">{t.count}</span>}
          </button>
        ))}
      </div>

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
) : (
        <DeviceList view={tab} outlets={outlets} onSummary={setSummary} />
      )}
    </>
  );
}

function SummaryTile({ icon: Icon, label, value, color, bg, note }: { icon: any; label: string; value: number; color: string; bg: string; note?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
      <div className={`flex size-10 items-center justify-center rounded-xl ${bg} ${color}`}>
        <Icon className="size-4" strokeWidth={2.25} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-xl font-black text-dark dark:text-white">{value}</p>
        {note && <p className="text-[11px] text-gray-500">{note}</p>}
      </div>
    </div>
  );
}
