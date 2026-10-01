"use client";

import { useEffect, useState, useCallback } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  Banknote, ShieldCheck, Plus, Trash2, RefreshCw, AlertTriangle,
  Building2, User, ChevronDown, AlertCircle, CheckCircle2
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { roleLabel } from "@/lib/roleLabels";
import { getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

export default function CashLimitsPage() {
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Form state
  const [scopeType, setScopeType] = useState<"delivery" | "recovery">("delivery");
  const [scopeId, setScopeId] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");

  const [deliveryOptions, setDeliveryOptions] = useState<any[]>([]);
  const [recoveryOptions, setRecoveryOptions] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);

  const fetchLimits = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/cash/limits`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setLimits(data.data);
      else toast.error(data.message || "Failed to load limits");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load limits"));
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficerOptions = async (roleId: number, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/users?role_id=${roleId}&limit=100`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success) {
        setter(data.data?.users || data.users || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchLimits();
    fetchOfficerOptions(2, setDeliveryOptions);
    fetchOfficerOptions(3, setRecoveryOptions);
  }, []);

  const selectEntity = (entity: any) => {
    setSelectedEntity(entity);
    setScopeId(String(entity.id));
  };

  const handleAddLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeId) return toast.error("Please select a target");
    setAdding(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/cash/limits`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ scope_type: "officer", scope_id: parseInt(scopeId), daily_limit: parseFloat(dailyLimit) })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Cash limit configured successfully");
        setScopeId(""); setDailyLimit(""); setSelectedEntity(null);
        fetchLimits();
      } else {
        toast.error(data.message || "Failed to add cash limit");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to add cash limit"));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this cash limit?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/cash/limits/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (data.success) { toast.success("Cash limit removed"); setLimits(limits.filter(l => l.id !== id)); }
      else toast.error(data.message || "Failed to remove limit");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove limit"));
    }
  };

  const officerLimits = limits.filter((l) => l.scope_type === 'officer');
  const overLimitCount = officerLimits.filter((l) => l.is_over_limit).length;

  return (
    <>
      <Breadcrumb pageName="Cash Limits Management" />
      <div className="mx-auto max-w-7xl space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-800 dark:text-white flex items-center gap-3">
              <div className="p-2.5 bg-green-500/10 rounded-2xl text-green-500"><Banknote size={28} /></div>
              Cash Limit Management
            </h1>
            <p className="text-sm text-gray-400 mt-2 font-bold">Set maximum allowed cash in hand for delivery and recovery officers only.</p>
          </div>
          <button onClick={fetchLimits} className="flex items-center gap-2 bg-white dark:bg-boxdark border border-stroke dark:border-strokedark px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-gray-50 transition-all">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Alert banner */}
        {overLimitCount > 0 && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <p className="text-sm font-bold text-red-600 dark:text-red-400">
              ⚠️ <strong>{overLimitCount}</strong> officer{overLimitCount > 1 ? "s are" : " is"} currently over their cash limit — immediate submission required.
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Rules", value: officerLimits.length, icon: <ShieldCheck size={20} />, container: "bg-sky-50 text-sky-600" },
            { label: "Officer Limits", value: officerLimits.length, icon: <User size={20} />, container: "bg-violet-50 text-violet-600" },
            { label: "Over Limit", value: overLimitCount, icon: <AlertTriangle size={20} />, container: "bg-rose-50 text-rose-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)]">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${s.container}`}>
                {s.icon}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-400 mb-3">{s.label}</p>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Limit Form */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded-[2.5rem] shadow-[0_28px_50px_-38px_rgba(15,23,42,0.18)] p-8 sticky top-24">
              <div className="mb-6">
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-primary" /> Set Cash Limit
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Quickly assign daily cash limits for delivery or recovery officers. Select an officer, enter the amount, and save.</p>
              </div>
              <form onSubmit={handleAddLimit} className="space-y-5">
                {/* Scope Type Toggle */}
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">Officer Type</label>
                  <div className="flex bg-gray-50 dark:bg-meta-4 rounded-xl p-1">
                    {(["delivery", "recovery"] as const).map((type) => (
                      <button key={type} type="button" onClick={() => { setScopeType(type); setScopeId(""); setSelectedEntity(null); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${scopeType === type ? "bg-white dark:bg-boxdark shadow-sm text-primary" : "text-gray-500 hover:text-gray-700"}`}>
                        <User size={16} />
                        {type === "delivery" ? "Delivery Officer" : "Recovery Officer"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                    Select {scopeType === "delivery" ? "Delivery Officer" : "Recovery Officer"}
                  </label>
                  <div className="relative">
                    <select
                      value={scopeId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setScopeId(id);
                        const list = scopeType === "delivery" ? deliveryOptions : recoveryOptions;
                        const entity = list.find((item) => String(item.id) === id) || null;
                        setSelectedEntity(entity);
                      }}
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                      <option value="">Select {scopeType === "delivery" ? "Delivery Officer" : "Recovery Officer"}</option>
                      {(scopeType === "delivery" ? deliveryOptions : recoveryOptions).map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.full_name || item.username}{item.role ? ` (${roleLabel(item.role.name || item.role)})` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  </div>
                  {selectedEntity && (
                    <div className="mt-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                      <CheckCircle2 size={14} className="text-primary" />
                      <span className="text-sm font-bold text-primary">{selectedEntity.full_name || selectedEntity.username} (ID: {selectedEntity.id})</span>
                    </div>
                  )}
                </div>

                {/* Limit Amount */}
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">Daily Cash Limit (PKR)</label>
                  <input
                    type="number" required value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl px-4 py-3 text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>

                <button type="submit" disabled={adding || !scopeId}
                  className="w-full bg-primary text-white rounded-2xl py-3.5 text-sm font-black uppercase tracking-[0.24em] hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {adding ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                  Save Limit
                </button>
              </form>
            </div>
          </div>

          {/* Limits List */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-gray-100 dark:bg-meta-4 rounded-3xl animate-pulse" />)}
              </div>
            ) : limits.length === 0 ? (
              <div className="py-24 text-center bg-white dark:bg-boxdark rounded-[2.5rem] border border-stroke dark:border-strokedark">
                <Banknote size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-xl font-bold text-gray-500">No Cash Limits Configured</p>
                <p className="text-sm text-gray-400 mt-2">Add a limit using the form to get started.</p>
              </div>
            ) : (
              officerLimits.map((l) => {
              const utilization = l.daily_limit > 0 ? Math.min(100, Math.round(((l.current_pending || 0) / l.daily_limit) * 100)) : 0;
              const isOver = l.is_over_limit;

              return (
                <div key={l.id} className={`bg-white dark:bg-boxdark rounded-3xl border p-6 flex flex-col gap-5 transition-all hover:shadow-lg ${isOver ? "border-red-300 dark:border-red-700/50" : "border-stroke dark:border-strokedark"}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center bg-purple-50 text-purple-600 shadow-sm">
                        <User size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-gray-900 dark:text-white">{l.name || l.full_name || "Officer"}</h4>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                          <span className="bg-gray-100 dark:bg-meta-4 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full border border-gray-200 dark:border-strokedark">Officer · ID {l.scope_id}</span>
                          <span className={`px-2 py-1 rounded-full border text-xs font-bold ${isOver ? "bg-red-100 border-red-200 text-red-600" : "bg-emerald-100 border-emerald-200 text-emerald-700"}`}>
                            {isOver ? "Over Limit" : "Within Limit"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center rounded-2xl bg-slate-50 dark:bg-meta-4 px-4 py-2 text-sm font-bold uppercase tracking-[0.25em] text-slate-500">
                      {l.scope_type === "officer" ? (l.role?.name || (l.type || "Officer")) : "Officer"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-meta-4 rounded-3xl p-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Set limit</p>
                      <p className="text-xl font-black text-gray-900 dark:text-white">PKR {(l.daily_limit || 0).toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Pending now</p>
                      <p className={`text-xl font-black flex items-center gap-2 ${isOver ? "text-red-500" : "text-emerald-600"}`}>
                        {isOver && <AlertTriangle size={14} />}
                        PKR {(l.current_pending || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Utilization</p>
                      <div className="space-y-2">
                        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-meta-3 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${utilization}%` }} />
                        </div>
                        <p className={`text-xs font-black ${isOver ? "text-red-500" : "text-emerald-600"}`}>{utilization}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Updated from backend rules and officer activity.</div>
                    <button onClick={() => handleDelete(l.id)}
                      className="w-12 h-12 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-500/10 rounded-2xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
            )}
          </div>
        </div>
      </div>
    </>
  );
}

