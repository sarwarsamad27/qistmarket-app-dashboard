"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Trophy, Headset, ShieldCheck, Truck, RotateCcw, TrendingUp, TrendingDown, Minus, Award, RefreshCw, Store } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { useAuth } from "../../../../../contexts/AuthContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface BadgeRow {
  id: number;
  full_name: string;
  username: string;
  outlet_name: string;
  department: string;
  badge_type: string;
  month: number;
  year: number;
  awarded_at: string;
}

const BADGE_LABEL: Record<string, string> = { champion: "🏆 Champion", top_performer: "⭐ Top Performer" };

interface RankRow {
  id: number;
  full_name: string;
  username: string;
  outlet_name: string;
  score: number;
  rank: number;
  trend: number;
  total_sales: number;
  unique_customers: number;
  delivered_customers: number;
  tier?: "Gold" | "Silver" | "Bronze";
  // Verification supplementary KPIs
  total_verifications?: number;
  approved_verifications?: number;
  rejected_verifications?: number;
  avg_verification_minutes?: number | null;
  delivered_count?: number;
  sale_amount?: number;
  achievement_percent?: number | null;
  trend_percent?: number;
  target?: number | null;
  // Delivery supplementary KPIs
  successful_deliveries?: number;
  failed_deliveries?: number;
  avg_delivery_minutes?: number | null;
  // Recovery supplementary KPIs
  visit_count?: number;
  recovery_amount?: number;
  missed_visits?: number;
  // CSR supplementary KPI
  conversion_rate?: number;
}

interface OutletRankRow {
  outlet_id: number;
  outlet_name: string;
  outlet_code: string;
  totalSales: number;
  recoveryPercentage: number;
  onTimePercentage: number;
  score: number;
  rank: number;
  tier: "Gold" | "Silver" | "Bronze";
}

interface RankingsData {
  period: { period: string; month: number; year: number };
  csr: RankRow[];
  verification: RankRow[];
  delivery: RankRow[];
  recovery: RankRow[];
}

const BOARDS = [
  { key: "csr" as const, label: "CSR", icon: Headset, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-500/10" },
  { key: "verification" as const, label: "Verification Officers", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  { key: "delivery" as const, label: "Delivery Officers", icon: Truck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10" },
  { key: "recovery" as const, label: "Recovery Officers", icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10" },
];

const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-700"];
const TIER_STYLE: Record<string, string> = {
  Gold: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  Silver: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  Bronze: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
};

function supplementaryKpiLine(board: string, r: RankRow): string | null {
  if (board === "verification" && r.delivered_count !== undefined) {
    const ach = r.achievement_percent === null || r.achievement_percent === undefined ? "no target" : `${r.achievement_percent}% of ${r.target} target`;
    return `${r.delivered_count} delivered · ${ach} · Rs. ${(r.sale_amount || 0).toLocaleString()} sales · ${(r.trend_percent || 0) >= 0 ? "▲" : "▼"} ${Math.abs(r.trend_percent || 0)}% vs last month`;
  }
  if (board === "delivery" && r.successful_deliveries !== undefined) {
    return `${r.successful_deliveries} successful · ${r.failed_deliveries} failed${r.avg_delivery_minutes ? ` · avg ${r.avg_delivery_minutes}m` : ""}`;
  }
  if (board === "recovery" && r.visit_count !== undefined) {
    return `${r.visit_count} visits · PKR ${(r.recovery_amount || 0).toLocaleString()} collected · ${r.missed_visits} missed`;
  }
  if (board === "csr" && r.conversion_rate !== undefined) {
    return `${r.conversion_rate}% conversion rate`;
  }
  return null;
}

// Derived, non-persisted achievement labels computed from the current
// period's rank/trend — no Badge/Achievement schema needed for this.
function achievementLabel(row: RankRow): { label: string; className: string } | null {
  if (row.rank === 1) return { label: "🏆 Department Champion", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" };
  if (row.rank <= 3) return { label: "⭐ Top Performer", className: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300" };
  if (row.trend > 0) return { label: "📈 Rising Star", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" };
  return null;
}

export default function AdminRankingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || "").toLowerCase() === "super admin";

  const [data, setData] = useState<RankingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [outletRankings, setOutletRankings] = useState<OutletRankRow[]>([]);
  const [outletLoading, setOutletLoading] = useState(true);

  const loadBadges = () => {
    setBadgesLoading(true);
    fetch(`${BACKEND_URL}/api/admin-panel/badges`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setBadges(json.data || []); })
      .catch((err) => console.error("Failed to load badges:", err))
      .finally(() => setBadgesLoading(false));
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin-panel/rankings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load rankings:", err))
      .finally(() => setLoading(false));
    loadBadges();
    fetch(`${BACKEND_URL}/api/admin-panel/outlets/rankings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setOutletRankings(json.data || []); })
      .catch((err) => console.error("Failed to load outlet rankings:", err))
      .finally(() => setOutletLoading(false));
  }, []);

  const handleSyncBadges = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/badges/sync`, { method: "POST", headers: authHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Sync failed.");
      toast.success(json.message);
      loadBadges();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const monthLabel = data ? new Date(data.period.year, data.period.month - 1).toLocaleString("default", { month: "long", year: "numeric" }) : "";

  return (
    <>
      <Breadcrumb pageName="Rankings & Leaderboards" />
      <PageHeader
        icon={Trophy}
        title="Rankings & Leaderboards"
        subtitle={data ? `Company-wide performance leaderboard for ${monthLabel}.` : "Company-wide performance leaderboard."}
        actions={
          isSuperAdmin ? (
            <button onClick={handleSyncBadges} disabled={syncing} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing..." : "Sync Badges"}
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TableSkeleton rows={5} cols={4} />
          <TableSkeleton rows={5} cols={4} />
          <TableSkeleton rows={5} cols={4} />
          <TableSkeleton rows={5} cols={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {BOARDS.map((board) => {
            const rows = data?.[board.key] || [];
            return (
              <div key={board.key} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div className="flex items-center gap-2.5 border-b border-slate-100 p-4 dark:border-white/10">
                  <div className={`flex size-8 items-center justify-center rounded-lg ${board.bg} ${board.color}`}><board.icon className="size-4" /></div>
                  <h2 className="text-sm font-bold text-dark dark:text-white">{board.label}</h2>
                </div>
                {rows.length === 0 ? (
                  <EmptyState icon={board.icon} title="No ranking data for this period" />
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                      <tr><th className="px-4 py-2.5 font-bold">#</th><th className="px-4 py-2.5 font-bold">Officer</th><th className="px-4 py-2.5 font-bold">Outlet</th><th className="px-4 py-2.5 text-right font-bold">Score</th><th className="px-4 py-2.5 text-right font-bold"></th></tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((r, idx) => {
                        const achievement = achievementLabel(r);
                        const kpiLine = supplementaryKpiLine(board.key, r);
                        return (
                        <tr key={r.id} className="border-t border-slate-50 dark:border-white/5">
                          <td className={`px-4 py-2.5 font-black ${idx < 3 ? MEDAL[idx] : "text-gray-400"}`}>{r.rank}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-dark dark:text-white">{r.full_name}</p>
                            <p className="text-xs text-gray-400">@{r.username}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.tier && <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_STYLE[r.tier]}`}>{r.tier}</span>}
                              {achievement && <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${achievement.className}`}>{achievement.label}</span>}
                            </div>
                            {kpiLine && <p className="mt-1 text-[10px] text-gray-400">{kpiLine}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.outlet_name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-dark dark:text-white">{r.score.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right">
                            {r.trend > 0 ? <TrendingUp className="ml-auto size-4 text-emerald-500" /> : r.trend < 0 ? <TrendingDown className="ml-auto size-4 text-rose-500" /> : <Minus className="ml-auto size-4 text-gray-300" />}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><Store className="size-4 text-blue-500" /> Outlet Ranking Board</h2>
        <p className="mb-3 text-xs text-gray-400">Computed live from this month's sales, recovery %, and on-time installment performance — not a persisted leaderboard like the officer boards above.</p>
        {outletLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : outletRankings.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Store} title="No outlet activity this month" /></div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3 font-bold">#</th><th className="px-4 py-3 font-bold">Outlet</th><th className="px-4 py-3 text-right font-bold">Sales</th><th className="px-4 py-3 text-right font-bold">Recovery %</th><th className="px-4 py-3 text-right font-bold">On-Time %</th><th className="px-4 py-3 text-right font-bold">Score</th></tr>
              </thead>
              <tbody>
                {outletRankings.map((o, idx) => (
                  <tr key={o.outlet_id} className="border-t border-slate-50 dark:border-white/5">
                    <td className={`px-4 py-3.5 font-black ${idx < 3 ? MEDAL[idx] : "text-gray-400"}`}>{o.rank}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-dark dark:text-white">{o.outlet_name}</p>
                      <div className="mt-1 flex gap-1">
                        <span className="text-xs text-gray-400">{o.outlet_code}</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${TIER_STYLE[o.tier]}`}>{o.tier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">PKR {o.totalSales.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-600">{o.recoveryPercentage}%</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{o.onTimePercentage}%</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-bold text-dark dark:text-white">{o.score.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-dark dark:text-white"><Award className="size-4 text-amber-500" /> Badge History</h2>
        {badgesLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : badges.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={Award} title="No badges awarded yet" description="Use Sync Badges to award this month's top performers." /></div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr><th className="px-4 py-3 font-bold">Officer</th><th className="px-4 py-3 font-bold">Department</th><th className="px-4 py-3 font-bold">Badge</th><th className="px-4 py-3 font-bold">Period</th><th className="px-4 py-3 font-bold">Awarded</th></tr>
              </thead>
              <tbody>
                {badges.map((b) => (
                  <tr key={b.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-dark dark:text-white">{b.full_name}</p>
                      <p className="text-xs text-gray-400">{b.outlet_name}</p>
                    </td>
                    <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{b.department}</td>
                    <td className="px-4 py-3.5 font-semibold">{BADGE_LABEL[b.badge_type] || b.badge_type}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{new Date(b.year, b.month - 1).toLocaleString("default", { month: "long", year: "numeric" })}</td>
                    <td className="px-4 py-3.5 text-gray-500">{new Date(b.awarded_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
