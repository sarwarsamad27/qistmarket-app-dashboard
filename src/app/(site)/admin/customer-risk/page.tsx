"use client";

import { useState } from "react";
import Cookies from "js-cookie";
import { ShieldAlert, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

interface RiskResult {
  cnic: string;
  score: number;
  tier: "high" | "medium" | "low";
  factors: string[];
  history: { id: number; action: string; category: string | null; reason: string | null; created_at: string }[];
}

const TIER_STYLE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export default function AdminCustomerRiskPage() {
  const [cnic, setCnic] = useState("");
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnic.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/blacklist/risk-score/${encodeURIComponent(cnic.trim())}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setResult(json.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Customer Risk Score" />
      <PageHeader icon={ShieldAlert} title="Customer Risk Score" subtitle="Look up a customer's fraud/risk profile by CNIC." />

      <form onSubmit={handleSearch} className="mb-6 flex max-w-md gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="Enter CNIC (e.g. 42101-1234567-1)..." className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
        </div>
        <button type="submit" disabled={loading} className="rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">{loading ? "..." : "Search"}</button>
      </form>

      {searched && !loading && !result && (
        <p className="text-sm text-gray-400">No record found for this CNIC.</p>
      )}

      {result && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">CNIC</p>
                <p className="font-mono text-lg font-bold text-dark dark:text-white">{result.cnic}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Risk Score</p>
                <p className="text-3xl font-black text-dark dark:text-white">{result.score}<span className="text-sm text-gray-400">/100</span></p>
              </div>
            </div>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase ${TIER_STYLE[result.tier]}`}>{result.tier} risk</span>

            {result.factors.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Risk Factors</p>
                <ul className="space-y-1">
                  {result.factors.map((f, idx) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-300">• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {result.history.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400"><tr><th className="px-4 py-3 font-bold">S.No</th><th className="px-4 py-3 font-bold">Action</th><th className="px-4 py-3 font-bold">Category</th><th className="px-4 py-3 font-bold">Reason</th><th className="px-4 py-3 font-bold">Date</th></tr></thead>
                <tbody>
                  {result.history.map((h, idx) => (
                    <tr key={h.id} className="border-t border-slate-50 dark:border-white/5"><td className="px-4 py-3.5 font-semibold text-gray-500 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-semibold capitalize text-dark dark:text-white">{h.action}</td>
                      <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{h.category || "—"}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{h.reason || "—"}</td>
                      <td className="px-4 py-3.5 text-gray-500">{new Date(h.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
