"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Ban, Search, History, ShieldCheck, ShieldX, Loader2, ClipboardCheck, Check, X, Gauge } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface BlacklistedCustomer {
  customer: {
    name: string;
    cnic_number: string | null;
    whatsapp_number: string;
    city: string | null;
    area: string | null;
  };
  ledgerSummary: { totalOrders: number; totalPaid: number; totalRemaining: number };
}

interface SearchResult {
  id: number;
  verification_id: number;
  name: string;
  cnic_number: string;
  telephone_number: string;
  is_blacklisted: boolean;
  role: string;
}

interface HistoryRow {
  id: number;
  cnic: string;
  action: "blacklist" | "whitelist";
  category: string | null;
  reason_code: string | null;
  reason_label: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  created_by: { full_name: string } | null;
}
interface PendingRequest { id: number; cnic: string; reason: string | null; created_at: string; created_by: { full_name: string } | null }
interface RiskScore { cnic: string; score: number; tier: string; factors: string[] }

// The canonical blacklist reason buckets. Owned by the backend
// (src/utils/blacklistReasonUtils.js) and delivered with both the list and the
// history responses, so adding or renaming a bucket is a one-file change there
// and never needs a matching edit here.
interface ReasonType { code: string; label: string; description: string; manual: boolean }

export default function BlacklistPage() {
  const [tab, setTab] = useState<"list" | "manage" | "approvals" | "history">("list");

  // List tab
  const [customers, setCustomers] = useState<BlacklistedCustomer[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Manage tab
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actioningCnic, setActioningCnic] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("");
  const [reasonTypes, setReasonTypes] = useState<ReasonType[]>([]);
  const [riskLookup, setRiskLookup] = useState<RiskScore | null>(null);

  // Approvals tab
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // History tab
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchList = () => {
    setLoadingList(true);
    fetch(`${BACKEND_URL}/api/accounts/blacklist`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setCustomers(json.data.customers);
          setReasonTypes(json.data.reasonTypes ?? []);
        }
      })
      .catch((err) => console.error("Failed to load blacklist:", err))
      .finally(() => setLoadingList(false));
  };

  const fetchHistory = () => {
    setLoadingHistory(true);
    fetch(`${BACKEND_URL}/api/accounts/blacklist/history`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setHistory(json.data);
          // Backstop for the reason dropdown in case the list call above failed.
          if (json.reasonTypes) setReasonTypes(json.reasonTypes);
        }
      })
      .catch((err) => console.error("Failed to load history:", err))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  const fetchPending = () => {
    setPendingLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/blacklist/pending-whitelist`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((json) => { if (json.success) setPending(json.data); })
      .finally(() => setPendingLoading(false));
  };

  useEffect(() => {
    if (tab === "history") fetchHistory();
    if (tab === "approvals") fetchPending();
  }, [tab]);

  const handleDecidePending = async (id: number, decision: "approve" | "reject") => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/blacklist/${id}/${decision}`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed."));
      toast.success(`Whitelist request ${decision}d.`);
      fetchPending();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRiskLookup = async (cnic: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/blacklist/risk-score/${cnic}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setRiskLookup(json.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load risk score."));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) {
      toast.error("Enter at least 3 characters.");
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/blacklist/search?query=${encodeURIComponent(query)}`, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) setResults(json.data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleAction = async (cnic: string, action: "blacklist" | "whitelist") => {
    if (!reason.trim()) {
      toast.error(`Please enter a reason for ${action === "whitelist" ? "whitelisting" : "blacklisting"}.`);
      return;
    }
    // A blacklist must land in a canonical bucket — that bucket is what the
    // Blacklisted Customers "Reason" filter groups by. Whitelist reasons are
    // narrative, not a risk classification, so they stay untagged.
    if (action === "blacklist" && !category) {
      toast.error("Please select a reason type before blacklisting.");
      return;
    }

    setActioningCnic(cnic);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/blacklist/action`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ cnic, action, reason, category: category || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Action failed.", json));
      if (action === "blacklist") {
        toast.success(json.message || "Customer blacklisted.");
        setResults((prev) => prev.map((r) => (r.cnic_number === cnic ? { ...r, is_blacklisted: true } : r)));
      } else {
        toast.success(json.message || "Customer whitelisted.");
      }
      setReason("");
      setCategory("");
      if (tab === "list") fetchList();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActioningCnic(null);
    }
  };

  const TABS = [
    { key: "list" as const, label: "Blacklisted Customers", icon: Ban },
    { key: "manage" as const, label: "Search & Manage", icon: Search },
    { key: "approvals" as const, label: "Pending Approvals", icon: ClipboardCheck },
    { key: "history" as const, label: "Action History", icon: History },
  ];

  return (
    <>
      <Breadcrumb pageName="Blacklist / Whitelist" />
      <PageHeader icon={Ban} title="Blacklist / Whitelist Management" subtitle="Review auto-flagged customers and manually override blacklist status." />

      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        loadingList ? (
          <TableSkeleton />
        ) : customers.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-bold">Customer</th>
                    <th className="px-4 py-3 font-bold">CNIC</th>
                    <th className="px-4 py-3 font-bold">Phone</th>
                    <th className="px-4 py-3 font-bold">Reason</th>
                    <th className="px-4 py-3 text-right font-bold">Orders</th>
                    <th className="px-4 py-3 text-right font-bold">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={i} className="border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{c.customer.name}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{c.customer.cnic_number || "—"}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{c.customer.whatsapp_number}</td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 max-w-[150px] truncate" title={(c.customer as any).blacklist_reason}>{(c.customer as any).blacklist_reason || 'Auto-flagged (90+ days)'}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{c.ledgerSummary.totalOrders}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-rose-600">{PKR(c.ledgerSummary.totalRemaining)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <EmptyState icon={ShieldCheck} title="No blacklisted customers" description="Everyone is in good standing." />
          </div>
        )
      )}

      {tab === "manage" && (
        <div className="space-y-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by CNIC, phone, or name..."
              className="flex-1 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              title={reasonTypes.find((t) => t.code === category)?.description || "Reason type — required to blacklist"}
              className="rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            >
              <option value="">Reason type (required to blacklist)</option>
              {reasonTypes.filter((t) => t.manual).map((t) => (
                <option key={t.code} value={t.code} title={t.description}>{t.label}</option>
              ))}
            </select>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required for every action)"
              className="w-64 rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
            <button type="submit" disabled={searching} className="flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:opacity-50">
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
            </button>
          </form>

          {riskLookup && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Risk Score — {riskLookup.cnic}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${riskLookup.tier === "high" ? "bg-rose-100 text-rose-700" : riskLookup.tier === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{riskLookup.tier} · {riskLookup.score}/100</span>
              </div>
              {riskLookup.factors.length > 0 && <ul className="mt-2 list-inside list-disc text-xs text-indigo-600 dark:text-indigo-300">{riskLookup.factors.map((f, i) => <li key={i}>{f}</li>)}</ul>}
            </div>
          )}

          {results.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-bold">Name</th>
                    <th className="px-4 py-3 font-bold">Role</th>
                    <th className="px-4 py-3 font-bold">CNIC</th>
                    <th className="px-4 py-3 font-bold">Phone</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 text-right font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={`${r.role}-${r.id}`} className="border-t border-slate-50 dark:border-white/5">
                      <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">{r.name}</td>
                      <td className="px-4 py-3.5 text-gray-500">{r.role}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.cnic_number}</td>
                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{r.telephone_number}</td>
                      <td className="px-4 py-3.5">
                        {r.is_blacklisted ? (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 dark:bg-rose-500/10">Blacklisted</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:bg-emerald-500/10">Clear</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/verifications/${r.verification_id}`}
                            className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
                          >
                            Profile
                          </Link>
                          <button onClick={() => handleRiskLookup(r.cnic_number)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"><Gauge className="size-3.5" /> Risk</button>
                          {r.is_blacklisted ? (
                            <button
                              onClick={() => handleAction(r.cnic_number, "whitelist")}
                              disabled={actioningCnic === r.cnic_number}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-500/10 dark:text-emerald-400"
                            >
                              <ShieldCheck className="size-3.5" /> Request Whitelist
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(r.cnic_number, "blacklist")}
                              disabled={actioningCnic === r.cnic_number}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-500/10 dark:text-rose-400"
                            >
                              <ShieldX className="size-3.5" /> Blacklist
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <EmptyState icon={Search} title="Search for a customer" description="Look up by CNIC, phone number, or name to manage their blacklist status." />
            </div>
          )}
        </div>
      )}

      {tab === "approvals" && (
        pendingLoading ? <TableSkeleton /> : pending.length > 0 ? (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
                <div>
                  <p className="font-bold text-dark dark:text-white">{p.cnic}</p>
                  <p className="text-xs text-gray-500">{p.reason || "No reason given"} · requested by {p.created_by?.full_name || "—"} on {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleDecidePending(p.id, "approve")} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"><Check className="size-3.5" /> Approve</button>
                  <button onClick={() => handleDecidePending(p.id, "reject")} className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"><X className="size-3.5" /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={ClipboardCheck} title="No pending whitelist requests" /></div>
      )}

      {tab === "history" && (
        loadingHistory ? (
          <TableSkeleton />
        ) : history.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">CNIC</th>
                  <th className="px-4 py-3 font-bold">Action</th>
                  <th className="px-4 py-3 font-bold">Reason Type</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Reason</th>
                  <th className="px-4 py-3 font-bold">By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-50 dark:border-white/5">
                    <td className="px-4 py-3.5 text-gray-500">{new Date(h.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{h.cnic}</td>
                    <td className="px-4 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${h.action === "blacklist" ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"}`}>
                        {h.action === "blacklist" ? "Blacklisted" : "Whitelisted"}
                      </span>
                    </td>
                    {/* Whitelist rows carry no risk classification by design, so
                        the backend leaves their bucket off rather than tagging
                        a clearance with a blacklist reason. */}
                    <td className="px-4 py-3.5 text-gray-500">{h.action === "whitelist" ? "—" : h.reason_label || h.category?.replace("_", " ") || "—"}</td>
                    <td className="px-4 py-3.5 capitalize text-gray-500">{h.status}</td>
                    <td className="px-4 py-3.5 text-gray-500">{h.reason || "—"}</td>
                    <td className="px-4 py-3.5 text-gray-500">{h.created_by?.full_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
            <EmptyState icon={History} title="No manual actions yet" />
          </div>
        )
      )}
    </>
  );
}
