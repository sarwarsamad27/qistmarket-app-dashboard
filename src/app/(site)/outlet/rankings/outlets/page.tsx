"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Trophy, Store, TrendingUp, TrendingDown, Minus, RefreshCw, Medal, Award, Calendar, Settings2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import ScoringConfigModal from "@/components/Admin/ScoringConfigModal";
import { getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

const tierStyles: Record<string, { bg: string; badge: string; label: string }> = {
    Gold:   { bg: "from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border-yellow-200 dark:border-yellow-700/30", badge: "bg-yellow-100 text-yellow-700", label: "🥇 Gold" },
    Silver: { bg: "from-slate-50 to-gray-50 dark:from-slate-900/10 dark:to-gray-900/10 border-slate-200 dark:border-slate-700/30", badge: "bg-slate-100 text-slate-700", label: "🥈 Silver" },
    Bronze: { bg: "from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-200 dark:border-orange-700/30", badge: "bg-orange-100 text-orange-700", label: "🥉 Bronze" },
    _:      { bg: "from-white to-gray-50 dark:from-boxdark dark:to-boxdark/90 border-stroke dark:border-strokedark", badge: "bg-gray-100 text-gray-500", label: "" },
};

function tierFor(score: number): "Gold" | "Silver" | "Bronze" {
    if (score >= 1000) return "Gold";
    if (score >= 500) return "Silver";
    if (score >= 200) return "Bronze";
    return "Bronze";
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function OutletRankingsPage() {
    const [outlets, setOutlets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isScoringModalOpen, setIsScoringModalOpen] = useState(false);

    const now = new Date();
    // "YYYY-MM" for the native month input, defaulting to the current month.
    const [selectedMonth, setSelectedMonth] = useState(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    );

    const fetchRankings = async (monthValue = selectedMonth) => {
        setLoading(true);
        try {
            const [year, month] = monthValue.split("-").map(Number);
            const userRes = await fetch(`${BACKEND_URL}/api/user/me`, { headers: authHeaders() });
            const userData = await userRes.json();
            if (userData.success) setCurrentUser(userData.data);
            const res = await fetch(`${BACKEND_URL}/api/admin-panel/outlets/rankings?year=${year}&month=${month}`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                setOutlets(data.data);
            } else {
                toast.error(data.message || "Failed to load rankings");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Failed to load rankings"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRankings(selectedMonth); }, [selectedMonth]);

    const [selYear, selMonth] = selectedMonth.split("-").map(Number);
    const selectedMonthLabel = `${MONTH_NAMES[selMonth - 1]} ${selYear}`;
    const isAdminOrSuper = ["super admin", "admin"].includes((currentUser?.role || "").toLowerCase());

    return (
        <>
            <Breadcrumb pageName="Outlet Rankings" />
            <ScoringConfigModal
                isOpen={isScoringModalOpen}
                onClose={() => setIsScoringModalOpen(false)}
                onSaved={() => fetchRankings()}
            />
            <div className="mx-auto max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary"><Store size={28} /></div>
                            Outlet Rankings
                        </h1>
                        <p className="text-sm text-gray-400 mt-2 font-bold">Outlet performance leaderboard — {selectedMonthLabel}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {isAdminOrSuper && (
                            <button
                                onClick={() => setIsScoringModalOpen(true)}
                                className="flex items-center gap-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark px-4 py-2.5 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 transition-all"
                            >
                                <Settings2 size={16} className="text-primary" /> Scoring Rules
                            </button>
                        )}
                        <div className="relative">
                            <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="month"
                                value={selectedMonth}
                                max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}
                                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                                className="pl-11 pr-4 py-2.5 rounded-2xl bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-sm font-bold outline-none focus:border-primary transition-all"
                            />
                        </div>
                        <button onClick={() => fetchRankings()} className="flex items-center gap-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-all">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="h-64 bg-gray-100 dark:bg-meta-4 rounded-[2.5rem] animate-pulse" />
                        ))}
                    </div>
                ) : outlets.length === 0 ? (
                    <div className="py-24 text-center">
                        <Store size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-xl font-bold text-gray-500">No outlet data available</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {outlets.map((outlet, idx) => {
                            const t = tierFor(outlet.score);
                            const style = tierStyles[t] || tierStyles._;
                            return (
                                <div key={outlet.outlet_id} className={`rounded-[2.5rem] border-2 bg-gradient-to-br p-8 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 ${style.bg}`}>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-16 rounded-[1.5rem] bg-white dark:bg-boxdark flex items-center justify-center text-2xl font-black shadow-inner border border-stroke dark:border-strokedark text-primary">
                                                #{outlet.rank}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-gray-800 dark:text-white leading-tight">
                                                    {outlet.outlet_name}
                                                    {currentUser?.outlet_id === outlet.outlet_id && <span className="ml-2 text-sm text-primary">(You)</span>}
                                                </h3>
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{outlet.outlet_code}</p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${style.badge}`}>{style.label || t}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-white/70 dark:bg-boxdark/60 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Sales</p>
                                            <p className="text-lg font-black text-gray-800 dark:text-white">PKR {outlet.totalSales?.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/70 dark:bg-boxdark/60 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Blended Score</p>
                                            <p className="text-lg font-black text-primary">{outlet.score?.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/70 dark:bg-boxdark/60 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1">Recovery %</p>
                                            <p className="text-lg font-black text-green-600">{outlet.recoveryPercentage?.toFixed(1)}%</p>
                                        </div>
                                        <div className="bg-white/70 dark:bg-boxdark/60 rounded-2xl p-4 text-center">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Delivered Orders</p>
                                            <p className="text-lg font-black text-blue-600">{outlet.customerCount?.toLocaleString() || 0}</p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-stroke/30 dark:border-strokedark/30 flex justify-between text-xs font-bold text-gray-400">
                                        <span>Recovered: PKR {outlet.recoveredAmount?.toLocaleString()}</span>
                                        <span>Total Sales: PKR {outlet.totalSales?.toLocaleString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
