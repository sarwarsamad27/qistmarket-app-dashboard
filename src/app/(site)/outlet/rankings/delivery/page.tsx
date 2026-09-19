"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Truck, RefreshCw, Store, Trophy, User, ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

const tierBadge: Record<string, string> = {
    Gold: "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/50",
    Silver: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    Bronze: "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50",
};

export default function DeliveryOfficerRankingsPage() {
    const [officers, setOfficers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [outlets, setOutlets] = useState<any[]>([]);
    const [selectedOutlet, setSelectedOutlet] = useState<string>("all");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [sortBy, setSortBy] = useState<'target' | 'achievement' | 'delivered' | 'score' | 'failed'>('achievement');

    const fetchRankings = async () => {
        setLoading(true);
        try {
            const userRes = await fetch(`${BACKEND_URL}/api/user/me`, { headers: authHeaders() });
            const userData = await userRes.json();
            if (userData.success) setCurrentUser(userData.data);
            const res = await fetch(`${BACKEND_URL}/api/admin-panel/rankings`, { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                const deliveryData = data.data?.delivery || [];
                setOfficers(deliveryData);
                const uniqueOutlets = [...new Map(
                    deliveryData
                        .filter((o: any) => o.outlet_id)
                        .map((o: any) => [o.outlet_id, { id: o.outlet_id, name: o.outlet_name }])
                ).values()];
                setOutlets(uniqueOutlets as any[]);
            } else {
                toast.error(data.message || "Failed to load rankings");
            }
        } catch {
            toast.error("Failed to load rankings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRankings(); }, []);

    const filtered = selectedOutlet === "all"
        ? officers
        : officers.filter(o => String(o.outlet_id) === selectedOutlet);

    const sortedOfficers = [...filtered].sort((a, b) => {
        if (sortBy === 'target') return (b.target_percent ?? -1) - (a.target_percent ?? -1) || (b.score || 0) - (a.score || 0);
        if (sortBy === 'achievement') {
            const totalA = (a.successful_deliveries || 0) + (a.failed_deliveries || 0);
            const totalB = (b.successful_deliveries || 0) + (b.failed_deliveries || 0);
            const pctA = totalA > 0 ? (a.successful_deliveries || 0) / totalA : 0;
            const pctB = totalB > 0 ? (b.successful_deliveries || 0) / totalB : 0;
            return pctB - pctA || (b.successful_deliveries || 0) - (a.successful_deliveries || 0);
        }
        if (sortBy === 'delivered') return (b.successful_deliveries || 0) - (a.successful_deliveries || 0);
        if (sortBy === 'failed') return (b.failed_deliveries || 0) - (a.failed_deliveries || 0);
        return (b.score || 0) - (a.score || 0);
    }).map((o, idx) => ({ ...o, displayRank: idx + 1 }));

    return (
        <>
            <Breadcrumb pageName="Delivery Officer Rankings" />
            <div className="mx-auto max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
                            <div className="p-2.5 bg-green-500/10 rounded-2xl text-green-500"><Truck size={28} /></div>
                            Delivery Officer Rankings
                        </h1>
                        <p className="text-sm text-gray-400 mt-2 font-bold">Global and per-outlet delivery officer performance — current month</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {outlets.length > 0 && (
                            <select
                                value={selectedOutlet}
                                onChange={(e) => setSelectedOutlet(e.target.value)}
                                className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-2xl px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-gray-200 outline-none focus:border-green-500 transition-all shadow-sm"
                            >
                                <option value="all">All Outlets</option>
                                {outlets.map((o) => (
                                    <option key={o.id} value={String(o.id)}>{o.name}</option>
                                ))}
                            </select>
                        )}
                        <button onClick={fetchRankings} className="flex items-center gap-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-gray-50 dark:hover:bg-meta-4/30 transition-all shadow-sm">
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-20 bg-gray-100 dark:bg-meta-4 rounded-[1.5rem] animate-pulse" />
                        ))}
                    </div>
                ) : sortedOfficers.length === 0 ? (
                    <div className="py-24 text-center bg-white dark:bg-boxdark rounded-3xl border border-gray-100 dark:border-strokedark">
                        <Truck size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-xl font-bold text-gray-500 dark:text-gray-400">No delivery officers ranked yet</p>
                        <p className="text-sm text-gray-400 mt-2">Rankings are computed from current month activity.</p>
                    </div>
                ) : (
                    <div className="flex flex-col w-full bg-white dark:bg-boxdark rounded-3xl overflow-hidden border border-gray-100 dark:border-strokedark shadow-xl shadow-gray-200/50 dark:shadow-none animate-in fade-in zoom-in-95 duration-700">
                        {/* Sorting Tabs */}
                        <div className="flex border-b border-gray-100 dark:border-strokedark bg-gray-50/50 dark:bg-meta-4/20 px-4 md:px-8 overflow-x-auto no-scrollbar shrink-0">
                            {[
                                { id: 'achievement', label: 'BY ACHIEVEMENT' },
                                { id: 'delivered', label: 'BY DELIVERED' },
                                { id: 'score', label: 'BY SCORE' },
                                { id: 'failed', label: 'BY FAILED' },
                                { id: 'target', label: 'BY TARGET %' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setSortBy(tab.id as any)}
                                    className={`whitespace-nowrap px-6 py-4 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${sortBy === tab.id ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto w-full custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead className="bg-gray-50/80 dark:bg-meta-4/30 border-b border-gray-100 dark:border-strokedark">
                                    <tr>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase min-w-[60px]">Rank</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase min-w-[220px]">Delivery Participant</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase text-center min-w-[100px]">Delivered</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase min-w-[150px]">Achievement</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase text-center min-w-[100px]">Failed</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase text-center min-w-[80px]">Score</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase text-center min-w-[110px]">Target %</th>
                                        <th className="px-6 py-4 text-[8px] md:text-[9px] font-black text-gray-400 uppercase text-right min-w-[80px]">Trend</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-strokedark">
                                    {sortedOfficers.map((item) => {
                                        const total = (item.successful_deliveries || 0) + (item.failed_deliveries || 0);
                                        const achievementPct = total > 0 ? Math.round(((item.successful_deliveries || 0) / total) * 100) : 0;
                                        const isCurrentUser = item.officer_id === currentUser?.id;
                                        const isSameOutlet = item.outlet_id === currentUser?.outlet_id;
                                        const rank = item.displayRank;

                                        return (
                                            <tr key={item.id} className={`hover:bg-gray-50/70 dark:hover:bg-meta-4/20 transition-colors ${isCurrentUser ? 'bg-green-50/30 dark:bg-green-500/10' : ''}`}>
                                                <td className="px-6 py-4 min-w-[60px]">
                                                    <div className="flex items-center justify-center">
                                                        {rank <= 3 ? (
                                                            <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-md ${rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-slate-300' : 'bg-orange-300'}`}>
                                                                <Trophy size={14} />
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-black text-gray-400">#{rank}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 min-w-[220px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 overflow-hidden rounded-2xl border border-gray-100 dark:border-strokedark bg-green-500/10 shrink-0 flex items-center justify-center text-green-600 font-black text-sm">
                                                            {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : item.full_name?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs md:text-sm font-black truncate ${isCurrentUser ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>{item.full_name}</span>
                                                                {isCurrentUser ? <span className="text-[10px] font-bold text-green-500">(You)</span> : isSameOutlet ? <span className="text-[9px] font-bold text-gray-400">(Your Team)</span> : null}
                                                                {item.tier && (
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${tierBadge[item.tier] || ''}`}>{item.tier}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                                                <span className="flex items-center gap-1"><Store size={10} />{item.outlet_name}</span>
                                                                <span>@{item.username}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-green-600 dark:text-green-400 text-sm min-w-[100px]">{item.successful_deliveries || 0}</td>
                                                <td className="px-6 py-4 min-w-[150px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 bg-gray-100 dark:bg-meta-4 h-2 rounded-full overflow-hidden shrink-0">
                                                            <div className={`h-full rounded-full transition-all duration-1000 ${achievementPct >= 80 ? 'bg-green-500' : achievementPct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, achievementPct)}%` }}></div>
                                                        </div>
                                                        <span className="text-xs font-black text-gray-800 dark:text-white shrink-0">{achievementPct}%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center font-black text-rose-500 text-sm min-w-[100px]">{item.failed_deliveries || 0}</td>
                                                <td className="px-6 py-4 text-center font-black text-green-600 dark:text-green-400 text-sm min-w-[80px]">{(item.score || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center min-w-[110px]">
                                                    {item.target_percent === null || item.target_percent === undefined ? (
                                                        <span className="text-xs font-bold text-gray-300">No target</span>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`text-xs font-black ${item.target_percent >= 100 ? 'text-emerald-500' : item.target_percent >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{item.target_percent}%</span>
                                                            <span className="text-[9px] font-bold text-gray-400">{(item.target_achieved || 0).toLocaleString()} / {item.target.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right min-w-[80px]">
                                                    <div className={`flex items-center justify-end gap-1 font-black text-xs ${(item.trend || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {(item.trend || 0) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                        {Math.abs(item.trend || 0)}%
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

