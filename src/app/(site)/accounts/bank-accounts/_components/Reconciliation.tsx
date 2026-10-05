"use client";

import { useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

interface Line {
  id: number; line_no: number; txn_date: string; description: string | null; reference: string | null; debit: number; credit: number; balance: number | null;
  status: "matched" | "unmatched" | "ignored"; matched_by: string | null;
  matched_transaction: { id: number; transaction_no: string; transaction_date: string; description: string | null; amount: number; type: string; category_label: string } | null;
}
interface SystemTxn { id: number; transaction_no: string; transaction_date: string; type: string; amount: number; description: string | null; reference: string | null; category_label: string; recorded_by: string | null }
interface Recon {
  statement: { id: number; file_name: string | null; file_url: string; period_start: string; period_end: string; closing_balance: number | null; uploaded_by: string; created_at: string; bank_account: { bank_name: string; account_number: string; current_balance: number } };
  summary: { lines: number; matched: number; unmatched: number; ignored: number; statement_credit: number; statement_debit: number; unmatched_statement_net: number; system_only_count: number; system_only_net: number };
  lines: Line[];
  system_only: SystemTxn[];
}

const STATUS: Record<string, string> = {
  matched: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  unmatched: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  ignored: "bg-gray-100 text-gray-500 dark:bg-white/10",
};

/** Bank statement vs. system transactions, line by line. */
export default function Reconciliation({ statementId, onBack, onChanged }: { statementId: number; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Recon | null>(null);
  const [filter, setFilter] = useState<"all" | "unmatched" | "matched" | "ignored">("unmatched");
  const [pick, setPick] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements/${statementId}/reconciliation`, { headers: authHeaders() })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [statementId]);
  useEffect(() => { load(); }, [load]);

  const act = async (lineId: number, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements/lines/${lineId}/action`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Action failed."));
      load(); onChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const rematch = async () => {
    setBusy(true);
    try {
      const j = await (await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements/${statementId}/auto-match`, { method: "POST", headers: authHeaders() })).json();
      toast.success(`${j.data?.matched || 0} more line(s) matched.`);
      load(); onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this imported statement? Everything it matched becomes un-reconciled again.")) return;
    const res = await fetch(`${BACKEND_URL}/api/accounts/bank-accounts/statements/${statementId}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) { toast.success("Statement deleted."); onChanged(); onBack(); } else toast.error(await apiErrorMessage(res, "Delete failed."));
  };

  if (!data) return <TableSkeleton />;
  const s = data.summary;
  const lines = data.lines.filter((l) => filter === "all" || l.status === filter);
  const pct = s.lines ? Math.round(((s.matched + s.ignored) / s.lines) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"><ArrowLeft className="size-4" /> Statements</button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-dark dark:text-white">{data.statement.file_name || `Statement #${data.statement.id}`}</p>
          <p className="text-xs text-gray-500">{day(data.statement.period_start)} – {day(data.statement.period_end)} · uploaded by {data.statement.uploaded_by || "—"}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={rematch} disabled={busy} className="flex items-center gap-1.5 rounded-xl border border-stroke px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#ff3d3d] hover:text-[#ff3d3d] dark:border-dark-3 dark:text-gray-300"><RefreshCw className="size-4" /> Auto-match again</button>
          <ExportMenu title={`Reconciliation ${data.statement.bank_account.bank_name}`} columns={[
            { header: "Line", value: (l: Line) => l.line_no },
            { header: "Date", value: (l) => day(l.txn_date) },
            { header: "Description", value: (l) => l.description || "" },
            { header: "Reference", value: (l) => l.reference || "" },
            { header: "Debit", value: (l) => l.debit || "", numeric: true },
            { header: "Credit", value: (l) => l.credit || "", numeric: true },
            { header: "Status", value: (l) => l.status },
            { header: "Matched to", value: (l) => l.matched_transaction?.transaction_no || "" },
          ]} getRows={() => data.lines} />
          <button onClick={remove} className="rounded-xl p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10" title="Delete statement"><Trash2 className="size-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reconciled</p>
          <p className="text-lg font-black text-emerald-600">{pct}%</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-[11px] text-gray-500">{s.matched} matched · {s.ignored} ignored · {s.unmatched} open</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Statement totals</p>
          <p className="text-sm font-bold text-emerald-600">+ {PKR(s.statement_credit)}</p>
          <p className="text-sm font-bold text-rose-600">− {PKR(s.statement_debit)}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">In bank, not in system</p>
          <p className="text-lg font-black text-amber-700">{PKR(s.unmatched_statement_net)}</p>
          <p className="text-[11px] text-gray-500">{s.unmatched} statement line(s)</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">In system, not in bank</p>
          <p className="text-lg font-black text-blue-700">{PKR(s.system_only_net)}</p>
          <p className="text-[11px] text-gray-500">{s.system_only_count} system transaction(s)</p>
        </div>
      </div>
      {data.statement.closing_balance !== null && (
        <p className="text-xs text-gray-500">Bank says closing balance <b>{PKR(data.statement.closing_balance)}</b>; system balance now <b>{PKR(data.statement.bank_account.current_balance)}</b>.</p>
      )}

      <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {(["unmatched", "matched", "ignored", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500"}`}>{f}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
              <tr><th className="px-3 py-3">#</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Bank description</th><th className="px-3 py-3 text-right">Debit</th><th className="px-3 py-3 text-right">Credit</th><th className="px-3 py-3">Status / Matched to</th><th className="px-3 py-3">Action</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const lineType = l.credit > 0 ? "credit" : "debit";
                const lineAmt = l.credit || l.debit;
                // Same-direction system entries, closest amount first.
                const candidates = data.system_only.filter((t) => t.type === lineType).sort((a, b) => Math.abs(a.amount - lineAmt) - Math.abs(b.amount - lineAmt)).slice(0, 25);
                return (
                  <tr key={l.id} className="border-t border-slate-50 align-top dark:border-white/5">
                    <td className="px-3 py-3 text-xs text-gray-400">{l.line_no}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">{day(l.txn_date)}</td>
                    <td className="max-w-[280px] px-3 py-3 text-gray-600 dark:text-gray-300"><p className="break-words">{l.description || "—"}</p>{l.reference && <p className="font-mono text-[10px] text-gray-400">ref {l.reference}</p>}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-rose-600">{l.debit ? PKR(l.debit) : ""}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-600">{l.credit ? PKR(l.credit) : ""}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS[l.status]}`}>{l.status}{l.matched_by === "auto" ? " (auto)" : ""}</span>
                      {l.matched_transaction && (
                        <p className="mt-1 text-xs text-gray-500"><CheckCircle2 className="mr-1 inline size-3 text-emerald-500" /><span className="font-mono">{l.matched_transaction.transaction_no}</span> · {l.matched_transaction.category_label}{Math.abs(l.matched_transaction.amount - lineAmt) > 1 && <span className="text-rose-600"> · differs {PKR(Math.abs(l.matched_transaction.amount - lineAmt))}</span>}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {l.status === "unmatched" && (
                        <div className="flex min-w-[220px] flex-col gap-1.5">
                          <div className="flex gap-1">
                            <select value={pick[l.id] || ""} onChange={(e) => setPick({ ...pick, [l.id]: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-stroke bg-white px-2 py-1 text-xs dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                              <option value="">Match to system entry...</option>
                              {candidates.map((t) => <option key={t.id} value={t.id}>{t.transaction_no} · {PKR(t.amount)} · {day(t.transaction_date)}</option>)}
                            </select>
                            <button disabled={!pick[l.id] || busy} onClick={() => act(l.id, { action: "match", transaction_id: pick[l.id] })} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40">Match</button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {lineType === "debit" && <button disabled={busy} onClick={() => act(l.id, { action: "create", category: "bank_charges" })} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">Book as bank charges</button>}
                            <button disabled={busy} onClick={() => act(l.id, { action: "create", category: lineType === "credit" ? "deposit" : "withdrawal" })} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300">Book as {lineType === "credit" ? "deposit" : "withdrawal"}</button>
                            <button disabled={busy} onClick={() => { const reason = prompt("Why ignore this line?"); if (reason !== null) act(l.id, { action: "ignore", reason }); }} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-600">Ignore</button>
                          </div>
                        </div>
                      )}
                      {l.status !== "unmatched" && (
                        <button disabled={busy} onClick={() => act(l.id, { action: "unmatch" })} className="text-xs font-semibold text-gray-400 hover:text-rose-500">{l.status === "ignored" ? "Un-ignore" : "Unmatch"}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!lines.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No {filter === "all" ? "" : filter} lines.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {data.system_only.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
          <h4 className="mb-2 text-sm font-bold text-dark dark:text-white">In the system but not on this statement</h4>
          <p className="mb-3 text-xs text-gray-500">Entries in this period that no statement line accounts for — a deposit recorded in the system that never reached the bank, a wrong amount, or simply one that clears later.</p>
          <div className="space-y-1.5">
            {data.system_only.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                <span><span className="font-mono font-semibold text-[#ff3d3d]">{t.transaction_no}</span> · {day(t.transaction_date)} · {t.category_label} · {t.description || "—"}{t.recorded_by ? ` · by ${t.recorded_by}` : ""}</span>
                <span className={`font-bold tabular-nums ${t.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>{t.type === "credit" ? "+" : "−"}{PKR(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
