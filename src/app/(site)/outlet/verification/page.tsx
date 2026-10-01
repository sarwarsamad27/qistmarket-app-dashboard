"use client";

import { useState, useEffect, useCallback } from "react";
import Cookies from "js-cookie";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { Search, Phone, User, Eye, RefreshCw, Calendar, Shield, CheckCircle2, XCircle, FileText, TrendingUp } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

const TODAY = new Date().toISOString().split("T")[0];
const MONTH_START = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

export default function VerificationOfficersListing() {
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [from, setFrom] = useState(MONTH_START);
  const [to, setTo] = useState(TODAY);
  const router = useRouter();

  const fetchOfficers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role_id: "1", from, to, ...(statusFilter !== "all" ? { status: statusFilter } : {}) });
      const res = await fetch(`${API_BASE}/api/outlet/team/list?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setOfficers(data.officers || []);
      else toast.error(data.message || "Failed to load officers");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load verification officers"));
    } finally {
      setLoading(false);
    }
  }, [from, to, statusFilter]);

  useEffect(() => { fetchOfficers(); }, [fetchOfficers]);

  const filtered = officers.filter(o =>
    (o.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.username || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.phone || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = officers.filter(o => o.status === "active").length;
  const totalVerified = officers.reduce((s, o) => s + (o.verified_count || 0), 0);
  const totalOrders = officers.reduce((s, o) => s + (o.orders?.total || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Breadcrumb pageName="Verification Officers" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-2xl text-blue-600"><Shield size={30} strokeWidth={2.5} /></div>
            Verification Officers
          </h1>
          <p className="text-sm text-gray-400 mt-2 font-bold">Track verification throughput and case status per officer.</p>
        </div>
        <button onClick={fetchOfficers} className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 hover:bg-gray-50 px-6 py-2.5 rounded-2xl text-sm font-black flex items-center gap-2 shadow-sm transition-all active:scale-95">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Officers", value: officers.length, icon: <User size={20} />, color: "blue" },
          { label: "Active Now", value: activeCount, icon: <CheckCircle2 size={20} />, color: "green" },
          { label: "Total Orders", value: totalOrders, icon: <FileText size={20} />, color: "purple" },
          { label: "Verified", value: totalVerified, icon: <TrendingUp size={20} />, color: "teal" },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 bg-${card.color}-50 text-${card.color}-500`}>{card.icon}</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{card.label}</p>
            <p className="text-xl font-black text-gray-800 dark:text-white tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark p-5 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text" placeholder="Search by name, username, phone..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark text-sm font-bold focus:border-primary outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
          <Calendar size={16} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl px-3 py-2 text-sm font-medium focus:border-primary outline-none" />
          <span>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl px-3 py-2 text-sm font-medium focus:border-primary outline-none" />
        </div>
        <div className="flex bg-gray-50 dark:bg-meta-4 rounded-xl p-1 gap-1">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${statusFilter === s ? "bg-white dark:bg-boxdark shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 dark:bg-meta-4 rounded-[2.5rem] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Shield size={40} />} title="No Verification Officers" subtitle="No officers found matching your filters." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((officer) => (
            <VOCard key={officer.id} officer={officer} onClick={() => router.push(`/outlet/team/${officer.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function VOCard({ officer, onClick }: { officer: any; onClick: () => void }) {
  const isActive = officer.status === "active";
  const orders = officer.orders || {};
  return (
    <div className={`bg-white dark:bg-boxdark rounded-[2.5rem] border-2 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden group ${isActive ? "border-stroke dark:border-strokedark" : "border-red-200 dark:border-red-900/30"}`}>
      <div className="p-7">
        <div className="flex items-center justify-between mb-5">
          <div className="w-14 h-14 bg-blue-500/10 rounded-3xl flex items-center justify-center text-blue-600 font-black text-xl group-hover:scale-110 transition-transform">
            {(officer.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 ${isActive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
              {isActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {officer.status}
            </span>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ID: {officer.id}</span>
          </div>
        </div>

        <h3 className="text-lg font-black text-gray-800 dark:text-white truncate">{officer.full_name}</h3>
        <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5 mt-1">
          <Phone size={12} className="text-blue-500/50" /> {officer.phone || "No phone"}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Pending", value: orders.pending ?? 0, color: "text-yellow-600" },
            { label: "In Progress", value: orders.in_progress ?? 0, color: "text-blue-600" },
            { label: "Completed", value: orders.completed ?? 0, color: "text-teal-600" },
            { label: "Rejected", value: orders.rejected ?? 0, color: "text-red-500" },
            { label: "Delivered", value: orders.delivered ?? 0, color: "text-purple-600" },
            { label: "Expired", value: orders.expired ?? 0, color: "text-gray-400" },
          ].map(item => (
            <div key={item.label} className="p-2.5 bg-gray-50 dark:bg-meta-4/20 rounded-xl text-center">
              <p className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</p>
              <p className={`text-lg font-black tabular-nums ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-5 border-t border-stroke dark:border-strokedark flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Total: <span className="text-gray-700 dark:text-gray-200">{orders.total ?? 0} orders</span>
          </p>
          <button onClick={onClick} className="w-10 h-10 bg-gray-100 dark:bg-meta-4 rounded-2xl flex items-center justify-center text-gray-500 hover:bg-blue-500 hover:text-white transition-all">
            <Eye size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="bg-white dark:bg-boxdark p-20 rounded-[2.5rem] border border-stroke dark:border-strokedark text-center shadow-sm">
      <div className="w-20 h-20 bg-gray-50 dark:bg-meta-4 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">{icon}</div>
      <h3 className="font-black text-2xl text-gray-800 dark:text-white uppercase tracking-tight">{title}</h3>
      <p className="text-sm text-gray-400 mt-2 font-bold max-w-sm mx-auto">{subtitle}</p>
    </div>
  );
}
