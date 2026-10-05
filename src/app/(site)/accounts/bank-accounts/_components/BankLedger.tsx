"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Search, X, CheckCircle2, Clock } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu, { ExportColumn } from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import { ListOrdered } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

export interface LedgerRow {
  id: number;
  transaction_no: string;
  transaction_date: string;
  type: "credit" | "debit";
  category: string | null;
  category_label: string;
  description: string | null;
  reference: string | null;
  party: string | null;
  debit: number;
  credit: number;
  amount: number;
  balance: number;
  recorded_by: string | null;
  verified_by: string | null;
  submitted_by: string | null;
  deposit: { id: number; method: string; receipt_id: string | null; gateway_txn: string | null; receipt_photo_url: string | null; submitted_at: string } | null;
  transfer_group: string | null;
  reconciled: boolean;
  statement: { id: number; file_name: string | null } | null;
  created_at: string;
}
interface Summary { opening_balance: number; total_credit: number; total_debit: number; closing_balance: number; current_balance: number; balance_difference: number; unreconciled_count: number }

const input = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";

/** Bank-statement style ledger of one account, with filters, details and export. */
export default function BankLedger({ account, refreshKey }: { account: { id: number; bank_name: string; account_number: string; account_title: string }; refreshKey: number }) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [reconciled, setReconciled] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<LedgerRow | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 400); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      ...(range.from && { startDate: range.from }), ...(range.to && { endDate: range.to }),
      ...(category && { category }), ...(type && { type }), ...(reconciled && { reconciled }), ...(debounced.trim() && { search: debounced.trim() }),
    });
    fetch(`${BACKEND_URL}/api/accounts/bank-accounts/${account.id}/statement?${qs}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => { if (j.success) { setRows(j.data.transactions); setSummary(j.data.summary); setCategories(j.data.categories); } })
      .finally(() => setLoading(false));
  }, [account.id, range, category, type, reconciled, debounced, refreshKey]);

  const columns: ExportColumn<LedgerRow>[] = [
    { header: "#", value: (_, i) => i + 1 },
    { header: "Date", value: (r) => fmt(r.transaction_date) },
    { header: "Transaction No", value: (r) => r.transaction_no },
    { header: "Type", value: (r) => r.category_label },
    { header: "Description", value: (r) => r.description || "" },
    { header: "Party (whose payment)", value: (r) => r.party || "" },
    { header: "Reference", value: (r) => r.reference || r.deposit?.receipt_id || "" },
    { header: "Debit", value: (r) => r.debit || "", numeric: true },
    { header: "Credit", value: (r) => r.credit || "", numeric: true },
    { header: "Balance", value: (r) => r.balance, numeric: true },
    { header: "Recorded by", value: (r) => r.recorded_by || "" },
    { header: "Verified by", value: (r) => r.verified_by || "" },
    { header: "Reconciled", value: (r) => (r.reconciled ? "Yes" : "No") },
  ];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Opening", summary.opening_balance, "text-dark dark:text-white"],
            ["Credits (in)", summary.total_credit, "text-emerald-600"],
            ["Debits (out)", summary.total_debit, "text-rose-600"],
            ["Closing", summary.closing_balance, "text-dark dark:text-white"],
            ["Not reconciled", summary.unreconciled_count, "text-amber-600"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
              <p className={`text-lg font-black ${c}`}>{l === "Not reconciled" ? v : PKR(v as number)}</p>
            </div>
          ))}
        </div>
      )}
      {summary && Math.abs(summary.balance_difference) > 0.5 && (
        <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          The account balance ({PKR(summary.current_balance)}) differs from what its entries add up to by {PKR(summary.balance_difference)} — record a Balance Adjustment with the reason to correct it.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Txn no, reference, party, verifier..." className={`${input} w-full pl-9`} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
          <option value="">All types</option>
          {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
          <option value="">In & out</option><option value="credit">Credits only</option><option value="debit">Debits only</option>
        </select>
        <select value={reconciled} onChange={(e) => setReconciled(e.target.value)} className={input}>
          <option value="">Any status</option><option value="yes">Reconciled</option><option value="no">Not reconciled</option>
        </select>
        <div className="ml-auto">
          <ExportMenu title={`Bank Statement ${account.bank_name} ${account.account_number}`} subtitle={account.account_title} columns={columns} getRows={() => [...rows].reverse()} />
        </div>
      </div>
      <DateRangeFilter value={range} onChange={setRange} />

      {loading ? <TableSkeleton /> : rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3 font-bold">#</th><th className="px-3 py-3 font-bold">Date</th><th className="px-3 py-3 font-bold">Txn No / Type</th>
                  <th className="px-3 py-3 font-bold">Details</th><th className="px-3 py-3 text-right font-bold">Debit</th><th className="px-3 py-3 text-right font-bold">Credit</th>
                  <th className="px-3 py-3 text-right font-bold">Balance</th><th className="px-3 py-3 font-bold">Verified / By</th><th className="px-3 py-3 font-bold"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-3 py-3 text-xs text-gray-400">{i + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">{fmt(r.transaction_date)}</td>
                    <td className="px-3 py-3"><p className="font-mono text-xs font-semibold text-[#ff3d3d]">{r.transaction_no}</p><p className="text-[11px] text-gray-500">{r.category_label}</p></td>
                    <td className="max-w-[320px] px-3 py-3 text-gray-600 dark:text-gray-300">
                      <p className="truncate">{r.description || "—"}</p>
                      {r.party && <p className="truncate text-xs text-gray-400">{r.party}</p>}
                      {(r.reference || r.deposit?.receipt_id) && <p className="font-mono text-[10px] text-gray-400">ref {r.reference || r.deposit?.receipt_id}</p>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-rose-600">{r.debit ? PKR(r.debit) : ""}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-600">{r.credit ? PKR(r.credit) : ""}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(r.balance)}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{r.verified_by || r.recorded_by || "—"}</td>
                    <td className="px-3 py-3">{r.reconciled ? <CheckCircle2 className="size-4 text-emerald-500" aria-label="Reconciled" /> : <Clock className="size-4 text-gray-300" aria-label="Not reconciled" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={ListOrdered} title="No transactions match" /></div>}

      {selected && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div><h3 className="text-sm font-bold text-dark dark:text-white">{selected.category_label}</h3><p className="font-mono text-[11px] text-gray-400">{selected.transaction_no}</p></div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="size-4" /></button>
            </div>
            <div className="p-5">
              <p className={`mb-4 text-2xl font-black ${selected.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>{selected.type === "credit" ? "+ " : "− "}{PKR(selected.amount)}</p>
              <dl className="divide-y divide-slate-100 text-sm dark:divide-white/10">
                {[
                  ["Transaction date", fmt(selected.transaction_date)],
                  ["Entered on", fmt(selected.created_at)],
                  ["Description", selected.description],
                  ["Party (whose payment)", selected.party],
                  ["Reference", selected.reference],
                  ["Submitted by", selected.submitted_by],
                  ["Deposit method", selected.deposit?.method],
                  ["Deposit slip / voucher", selected.deposit?.receipt_id],
                  ["Gateway / deposit txn", selected.deposit?.gateway_txn],
                  ["Verified by", selected.verified_by],
                  ["Recorded by", selected.recorded_by],
                  ["Transfer group", selected.transfer_group],
                  ["Balance after", PKR(selected.balance)],
                  ["Reconciled", selected.reconciled ? `Yes${selected.statement ? ` — statement ${selected.statement.file_name || `#${selected.statement.id}`}` : ""}` : "No"],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string} className="flex justify-between gap-4 py-2"><dt className="shrink-0 text-gray-500">{l}</dt><dd className="text-right font-medium text-dark dark:text-white">{v}</dd></div>
                ))}
              </dl>
              {selected.deposit?.receipt_photo_url && (
                <a href={`${BACKEND_URL}${selected.deposit.receipt_photo_url}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-bold text-blue-600 hover:underline">View deposit receipt photo</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
