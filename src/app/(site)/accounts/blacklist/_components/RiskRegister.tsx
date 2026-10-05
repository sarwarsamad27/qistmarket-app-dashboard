"use client";

import { Fragment, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Search, ShieldAlert } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Row {
  cnic: string; name: string; phone: string; is_blacklisted: boolean; order_refs: string[]; outlets: string[];
  score: number; tier: "high" | "medium" | "low"; factors: string[];
  stats: { orders: number; outstanding: number; overdue: number; missed: number; max_days_late: number; pay_ratio: number; worst_status: string; bad_guarantees: number };
}

const TIER_STYLE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
};

/** Every customer ranked by an explainable risk score — the risk-management view. */
export default function RiskRegister({ onAct }: { onAct: (cnic: string) => void }) {
  const [tier, setTier] = useState("");
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [data, setData] = useState<{ summary: { high: number; medium: number; low: number; total_outstanding_high: number }; rows: Row[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setDq(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    setData(null);
    fetch(`${BACKEND_URL}/api/accounts/blacklist/risk-register?tier=${tier}&search=${encodeURIComponent(dq)}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [tier, dq]);

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["high", "medium", "low"] as const).map((t) => (
            <button key={t} onClick={() => setTier(tier === t ? "" : t)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm dark:bg-boxdark ${tier === t ? "border-[#ff3d3d] ring-2 ring-[#ff3d3d]/20" : "border-slate-100 dark:border-white/10"}`}>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${TIER_STYLE[t]}`}>{t} risk</span>
              <p className="mt-1.5 text-2xl font-black text-dark dark:text-white">{data.summary[t]}</p>
            </button>
          ))}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Owed by high-risk customers</p>
            <p className="text-xl font-black text-rose-600">{PKR(data.summary.total_outstanding_high)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, CNIC, phone, order ref..." className="w-full rounded-xl border border-stroke bg-white py-2 pl-9 pr-3 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
        <p className="text-xs text-gray-500">Score 0–100 from payment behaviour, blacklist / fraud record and bad guarantees. Click a row to see why.</p>
        <div className="ml-auto">
          <ExportMenu title="Customer Risk Register" columns={[
            { header: "Customer", value: (r: Row) => r.name },
            { header: "CNIC", value: (r) => r.cnic },
            { header: "Phone", value: (r) => r.phone },
            { header: "Orders", value: (r) => r.order_refs.join(", ") },
            { header: "Score", value: (r) => r.score, numeric: true },
            { header: "Tier", value: (r) => r.tier },
            { header: "Outstanding", value: (r) => r.stats.outstanding, numeric: true },
            { header: "Overdue", value: (r) => r.stats.overdue, numeric: true },
            { header: "Missed installments", value: (r) => r.stats.missed, numeric: true },
            { header: "Paid % of due", value: (r) => r.stats.pay_ratio, numeric: true },
            { header: "Blacklisted", value: (r) => (r.is_blacklisted ? "Yes" : "No") },
            { header: "Why", value: (r) => r.factors.join("; ") },
          ]} getRows={() => data?.rows || []} />
        </div>
      </div>
      {!data ? <TableSkeleton /> : data.rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3 text-right">Missed</th><th className="px-4 py-3 text-right">Paid % of due</th><th className="px-4 py-3"></th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <Fragment key={r.cnic}>
                    <tr onClick={() => setOpen(open === r.cnic ? null : r.cnic)} className="cursor-pointer border-t border-slate-50 hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3"><p className="font-medium text-dark dark:text-white">{r.name}{r.is_blacklisted && <span className="ml-1.5 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">blacklisted</span>}</p><p className="font-mono text-[11px] text-gray-400">{r.cnic} · {r.phone}</p></td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${TIER_STYLE[r.tier]}`}>{r.tier} · {r.score}</span></td>
                      <td className="px-4 py-3 text-right tabular-nums">{PKR(r.stats.outstanding)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-rose-600">{r.stats.overdue ? PKR(r.stats.overdue) : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.stats.missed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.stats.pay_ratio}%</td>
                      <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); onAct(r.cnic); }} className="text-xs font-bold text-[#ff3d3d] hover:underline">Manage</button></td>
                    </tr>
                    {open === r.cnic && (
                      <tr className="bg-slate-50/60 dark:bg-white/5">
                        <td colSpan={7} className="px-6 py-3 text-xs text-gray-600 dark:text-gray-300">
                          <p className="mb-1 font-bold">Why this score</p>
                          <ul className="list-inside list-disc">{r.factors.map((f, i) => <li key={i}>{f}</li>)}</ul>
                          <p className="mt-1 text-gray-400">Orders: {r.order_refs.join(", ")}{r.outlets.length ? ` · ${r.outlets.join(", ")}` : ""}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={ShieldAlert} title="No customers match" /></div>}
    </div>
  );
}
