"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { ArrowLeft, Layers, Upload, CheckCircle2, Landmark, X } from "lucide-react";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

interface DailyRow { date: string; channel: string; channel_label: string; count: number; amount: number; batched: number; settled: number; pending: number }
interface Batch {
  id: number; batch_no: string; channel: string; channel_label: string; period_start: string; period_end: string; expected_count: number; expected_amount: number;
  sheet_count: number | null; sheet_amount: number | null; sheet_file_name: string | null; received_amount: number | null; charges: number | null; difference: number | null;
  bank_account: string | null; bank_account_id: number | null; status: string; notes: string | null; created_at: string; verified_at: string | null; settled_at: string | null;
  created_by?: string | null; verified_by?: string | null; settled_by?: string | null;
  summary: { matched: number; amount_mismatch: number; missing_in_sheet: number; missing_in_system: number; pending: number; sheet_only_amount: number; not_on_sheet_amount: number };
  items?: { id: number; gateway_txn_id: string; consumer_number: string | null; payer: string | null; amount: number; sheet_amount: number | null; txn_date: string | null; status: string }[];
}

const BATCH_STATUS: Record<string, string> = {
  open: "bg-slate-100 text-slate-600 dark:bg-white/10",
  imported: "bg-blue-50 text-blue-700 dark:bg-blue-500/10",
  verified: "bg-amber-50 text-amber-700 dark:bg-amber-500/10",
  settled: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  cancelled: "bg-gray-100 text-gray-400 dark:bg-white/10",
};
const ITEM_STATUS: Record<string, string> = {
  matched: "bg-emerald-50 text-emerald-700",
  amount_mismatch: "bg-amber-50 text-amber-700",
  missing_in_sheet: "bg-rose-50 text-rose-700",
  missing_in_system: "bg-violet-50 text-violet-700",
  pending: "bg-slate-100 text-slate-600",
};
const ITEM_LABEL: Record<string, string> = { matched: "Matched", amount_mismatch: "Amount differs", missing_in_sheet: "Not on gateway sheet", missing_in_system: "Only on gateway sheet", pending: "Sheet not imported" };

/** Day-wise settlement position, settlement batches, and checking a batch against the gateway's sheet. */
export default function Settlements() {
  const [range, setRange] = useState<DateRange>(() => ({ from: ymd(new Date(Date.now() - 13 * 86400000)), to: ymd(new Date()) }));
  const [daily, setDaily] = useState<{ rows: DailyRow[]; totals: { amount: number; batched: number; settled: number; pending: number } } | null>(null);
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [create, setCreate] = useState<{ channel: string; from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(() => {
    const qs = new URLSearchParams({ ...(range.from && { startDate: range.from }), ...(range.to && { endDate: range.to }) });
    fetch(`${BACKEND_URL}/api/accounts/online/settlements/daily?${qs}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setDaily(j.data); });
    fetch(`${BACKEND_URL}/api/accounts/online/settlements`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setBatches(j.data); });
  }, [range]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const createBatch = async () => {
    if (!create) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/online/settlements`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ channel: create.channel, startDate: create.from, endDate: create.to }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Could not create batch."));
      const j = await res.json();
      toast.success(`Batch ${j.data.batch_no}: ${j.data.expected_count} payment(s), ${PKR(j.data.expected_amount)}.`);
      setCreate(null);
      loadAll();
      setOpenId(j.data.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (openId) return <BatchDetail id={openId} onBack={() => { setOpenId(null); loadAll(); }} />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-dark dark:text-white">Day-wise settlement position</h3>
          <DateRangeFilter value={range} onChange={setRange} presets={false} />
          <div className="ml-auto">
            <ExportMenu title="Online settlement by day" columns={[
              { header: "Date", value: (r: DailyRow) => r.date },
              { header: "Channel", value: (r) => r.channel_label },
              { header: "Payments", value: (r) => r.count, numeric: true },
              { header: "Collected", value: (r) => r.amount, numeric: true },
              { header: "In a batch", value: (r) => r.batched, numeric: true },
              { header: "Settled to bank", value: (r) => r.settled, numeric: true },
              { header: "Still to batch", value: (r) => r.pending, numeric: true },
            ]} getRows={() => daily?.rows || []} />
          </div>
        </div>
        {daily && (
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Collected", daily.totals.amount, "text-dark dark:text-white"], ["Settled to bank", daily.totals.settled, "text-emerald-600"], ["In a batch, not settled", daily.totals.batched, "text-amber-600"], ["Not batched yet", daily.totals.pending, "text-rose-600"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p><p className={`text-lg font-black ${c}`}>{PKR(v as number)}</p></div>
            ))}
          </div>
        )}
        {!daily ? <TableSkeleton /> : daily.rows.length ? (
          <div className="max-h-80 overflow-auto rounded-xl border border-slate-100 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-2"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Channel</th><th className="px-3 py-2 text-right">Payments</th><th className="px-3 py-2 text-right">Collected</th><th className="px-3 py-2 text-right">Settled</th><th className="px-3 py-2 text-right">In batch</th><th className="px-3 py-2 text-right">Not batched</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {daily.rows.map((r) => (
                  <tr key={`${r.date}-${r.channel}`} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-3 py-2 font-medium">{r.date}</td>
                    <td className="px-3 py-2">{r.channel_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{PKR(r.amount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{r.settled ? PKR(r.settled) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600">{r.batched ? PKR(r.batched) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-600">{r.pending ? PKR(r.pending) : "—"}</td>
                    <td className="px-3 py-2 text-right">{r.pending > 0 && <button onClick={() => setCreate({ channel: r.channel, from: r.date, to: r.date })} className="text-xs font-bold text-[#ff3d3d] hover:underline">Create batch</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">No online payments in this range.</p>}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-dark dark:text-white">Settlement batches</h3>
          <button onClick={() => setCreate({ channel: "1bill", from: range.from, to: range.to })} className="ml-auto flex items-center gap-1.5 rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white"><Layers className="size-4" /> New batch</button>
        </div>
        <p className="mb-3 text-xs text-gray-500">1) Make a batch for the days the gateway is paying out → 2) import the gateway's settlement sheet (DirectPay / SmartPay portal export) → 3) enter what reached the bank and pick the account → Verify → 4) Settle, which credits that bank account.</p>
        {!batches ? <TableSkeleton /> : batches.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-2"><tr><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Period</th><th className="px-3 py-2 text-right">Expected</th><th className="px-3 py-2 text-right">Gateway sheet</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Difference</th><th className="px-3 py-2">Bank</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-3 py-2"><p className="font-mono text-xs font-semibold">{b.batch_no}</p><p className="text-xs text-gray-400">{b.channel_label}</p></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{day(b.period_start)} – {day(b.period_end)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{PKR(b.expected_amount)}<p className="text-[11px] text-gray-400">{b.expected_count} payments</p></td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.sheet_amount !== null ? PKR(b.sheet_amount) : "—"}{(b.summary.amount_mismatch + b.summary.missing_in_sheet + b.summary.missing_in_system) > 0 && <p className="text-[11px] font-semibold text-rose-600">{b.summary.amount_mismatch + b.summary.missing_in_sheet + b.summary.missing_in_system} issue(s)</p>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.received_amount !== null ? PKR(b.received_amount) : "—"}{b.charges ? <p className="text-[11px] text-gray-400">charges {PKR(b.charges)}</p> : null}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${b.difference ? "font-semibold text-rose-600" : ""}`}>{b.difference !== null ? PKR(b.difference) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{b.bank_account || "—"}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${BATCH_STATUS[b.status]}`}>{b.status}</span></td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setOpenId(b.id)} className="text-xs font-bold text-blue-600 hover:underline">Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={Layers} title="No settlement batches yet" />}
      </div>

      {create && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={() => setCreate(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-dark dark:text-white">New settlement batch</h3><button onClick={() => setCreate(null)} className="text-gray-400"><X className="size-4" /></button></div>
            <p className="mb-3 text-xs text-gray-500">Takes every successful payment of this channel in the dates that isn't already in a batch.</p>
            <div className="space-y-3">
              <select value={create.channel} onChange={(e) => setCreate({ ...create, channel: e.target.value })} className="w-full rounded-xl border border-stroke px-3 py-2.5 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white"><option value="1bill">1Bill</option><option value="smartpay">SmartPay QR</option></select>
              <div className="flex items-center gap-2">
                <input type="date" value={create.from} onChange={(e) => setCreate({ ...create, from: e.target.value })} className="flex-1 rounded-xl border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
                <span className="text-xs text-gray-400">to</span>
                <input type="date" value={create.to} onChange={(e) => setCreate({ ...create, to: e.target.value })} className="flex-1 rounded-xl border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
              </div>
              <button onClick={createBatch} disabled={busy || !create.from || !create.to} className="w-full rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating..." : "Create batch"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [b, setB] = useState<Batch | null>(null);
  const [banks, setBanks] = useState<{ id: number; bank_name: string; account_number: string; is_active: boolean }[]>([]);
  const [grid, setGrid] = useState<(string | number | Date | null)[][]>([]);
  const [fileName, setFileName] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [map, setMap] = useState({ txn: -1, amount: -1, date: -1 });
  const [verify, setVerify] = useState({ received_amount: "", charges: "", bank_account_id: "", notes: "", release_missing: true });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`${BACKEND_URL}/api/accounts/online/settlements/${id}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => {
      if (j.success) {
        setB(j.data);
        setVerify((v) => ({ ...v, received_amount: v.received_amount || String(j.data.received_amount ?? j.data.sheet_amount ?? j.data.expected_amount), charges: v.charges || String(j.data.charges ?? ""), bank_account_id: v.bank_account_id || String(j.data.bank_account_id ?? "") }));
      }
    });
  }, [id]);
  useEffect(() => { load(); fetch(`${BACKEND_URL}/api/accounts/bank-accounts`, { headers: authHeaders() }).then((r) => r.json()).then((j) => { if (j.success) setBanks(j.data.filter((x: any) => x.is_active)); }); }, [load]);

  const headers = useMemo(() => (grid[headerRow] || []).map((h, i) => (h === null || h === "" ? `Column ${i + 1}` : String(h))), [grid, headerRow]);
  const readFile = async (f: File) => {
    setFileName(f.name);
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
    setGrid(rows);
    const hr = Math.max(0, rows.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim()).length >= 2));
    setHeaderRow(hr);
    const h = (rows[hr] || []).map((x) => String(x ?? "").toLowerCase());
    // First pattern that matches any header wins — the ID-looking ones before a bare "reference".
    const find = (...res: RegExp[]) => { for (const re of res) { const i = h.findIndex((x) => re.test(x)); if (i >= 0) return i; } return -1; };
    setMap({
      txn: find(/(txn|transaction|tran|auth).*(id|no|#)/, /transactionid|tranauthid/, /^(stan|rrn)$/, /ref/),
      amount: find(/amount|amt/),
      date: find(/date/, /time/),
    });
  };
  const lines = useMemo(() => (map.txn < 0 ? [] : grid.slice(headerRow + 1).map((r) => ({ txn_id: r[map.txn] === null ? "" : String(r[map.txn]).trim(), amount: map.amount >= 0 ? r[map.amount] : 0, date: map.date >= 0 && r[map.date] ? (r[map.date] instanceof Date ? (r[map.date] as Date).toISOString() : String(r[map.date])) : null })).filter((l) => l.txn_id)), [grid, headerRow, map]);

  const doImport = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/online/settlements/${id}/import`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ lines, file_name: fileName }) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Import failed."));
      const j = await res.json();
      toast.success(`Imported: ${j.data.summary.matched} matched, ${j.data.summary.amount_mismatch + j.data.summary.missing_in_sheet + j.data.summary.missing_in_system} to review.`);
      setGrid([]);
      load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  const doVerify = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/online/settlements/${id}/verify`, { method: "POST", headers: authHeaders(), body: JSON.stringify(verify) });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Verify failed."));
      const j = await res.json();
      toast.success(`Batch verified.${j.data.released_count ? ` ${j.data.released_count} payment(s) not on the gateway sheet (${PKR(j.data.released_amount)}) went back to "not batched".` : ""} Settle it to credit the bank account.`, { duration: 6000 });
      load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  const doSettle = async () => {
    if (!b || !confirm(`Credit ${PKR(b.received_amount || 0)} to ${b.bank_account} and mark ${b.batch_no} settled?${b.difference ? `\n\nDifference on this batch: ${PKR(b.difference)}${b.notes ? ` (${b.notes})` : ""}.` : ""}`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/online/settlements/${id}/settle`, { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Settle failed."));
      toast.success(`Settled — bank entry ${(await res.json()).data.bank_transaction_no}.`);
      load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  const doCancel = async () => {
    if (!confirm("Cancel this batch? Its payments go back to 'not batched'.")) return;
    const res = await fetch(`${BACKEND_URL}/api/accounts/online/settlements/${id}/cancel`, { method: "POST", headers: authHeaders() });
    if (res.ok) { toast.success("Batch cancelled."); onBack(); } else toast.error(await apiErrorMessage(res, "Cancel failed."));
  };

  if (!b) return <TableSkeleton />;
  const locked = ["settled", "cancelled"].includes(b.status);
  const releasable = b.sheet_amount !== null ? (b.items || []).filter((i) => i.status === "missing_in_sheet").reduce((s, i) => s + i.amount, 0) : 0;
  const expected = Math.round((b.expected_amount - (verify.release_missing ? releasable : 0)) * 100) / 100;
  const unresolved = b.summary.amount_mismatch + b.summary.missing_in_system + (verify.release_missing ? 0 : b.summary.missing_in_sheet);
  const received = parseFloat(verify.received_amount) || 0;
  const charges = parseFloat(verify.charges) || 0;
  const items = (b.items || []).filter((i) => !filter || i.status === filter);
  const sel = "w-full rounded-lg border border-stroke bg-white px-2.5 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"><ArrowLeft className="size-4" /> Batches</button>
        <div>
          <p className="font-mono text-sm font-bold text-dark dark:text-white">{b.batch_no} <span className={`ml-1 rounded-full px-2 py-0.5 font-sans text-[11px] font-bold capitalize ${BATCH_STATUS[b.status]}`}>{b.status}</span></p>
          <p className="text-xs text-gray-500">{b.channel_label} · {day(b.period_start)} – {day(b.period_end)} · created by {b.created_by || "—"}{b.verified_by ? ` · verified by ${b.verified_by}` : ""}{b.settled_by ? ` · settled by ${b.settled_by} ${day(b.settled_at)}` : ""}</p>
        </div>
        {!locked && <button onClick={doCancel} className="ml-auto text-xs font-semibold text-rose-500 hover:underline">Cancel batch</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Expected (our records)", PKR(expected), `${b.expected_count} payments`], ["Gateway sheet", b.sheet_amount !== null ? PKR(b.sheet_amount) : "—", b.sheet_file_name || "not imported"], ["Matched", String(b.summary.matched), "lines"], ["Needs review", String(b.summary.amount_mismatch + b.summary.missing_in_sheet + b.summary.missing_in_system), `not on sheet ${PKR(b.summary.not_on_sheet_amount)} · only on sheet ${PKR(b.summary.sheet_only_amount)}`], ["Received in bank", b.received_amount !== null ? PKR(b.received_amount) : "—", b.difference !== null ? `difference ${PKR(b.difference)}` : ""]].map(([l, v, n]) => (
          <div key={l} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-boxdark"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p><p className="text-lg font-black text-dark dark:text-white">{v}</p><p className="text-[11px] text-gray-500">{n}</p></div>
        ))}
      </div>

      {!locked && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h4 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-dark dark:text-white"><Upload className="size-4" /> Import gateway settlement sheet</h4>
            <p className="mb-3 text-xs text-gray-500">Export the settlement / transaction report from the {b.channel_label} portal (Excel or CSV) and map the Transaction ID and Amount columns.</p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} className="w-full rounded-xl border border-stroke px-3 py-2 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            {grid.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">Header row<select value={headerRow} onChange={(e) => setHeaderRow(parseInt(e.target.value))} className={sel}>{grid.slice(0, 20).map((r, i) => <option key={i} value={i}>Row {i + 1}: {r.filter(Boolean).slice(0, 3).map(String).join(" | ").slice(0, 40)}</option>)}</select></label>
                  <label className="text-xs text-gray-500">Transaction ID *<select value={map.txn} onChange={(e) => setMap({ ...map, txn: parseInt(e.target.value) })} className={sel}><option value={-1}>—</option>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>
                  <label className="text-xs text-gray-500">Amount<select value={map.amount} onChange={(e) => setMap({ ...map, amount: parseInt(e.target.value) })} className={sel}><option value={-1}>—</option>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>
                  <label className="text-xs text-gray-500">Date<select value={map.date} onChange={(e) => setMap({ ...map, date: parseInt(e.target.value) })} className={sel}><option value={-1}>—</option>{headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>
                </div>
                <p className="text-xs text-gray-500">{lines.length} line(s) read.</p>
                <button onClick={doImport} disabled={busy || !lines.length} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Importing..." : "Import & match"}</button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-boxdark">
            <h4 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-dark dark:text-white"><Landmark className="size-4" /> Verify & settle</h4>
            <p className="mb-3 text-xs text-gray-500">Enter what actually reached the bank and the account it came into (chosen once for the whole batch).</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">Received in bank (PKR)<input type="number" value={verify.received_amount} onChange={(e) => setVerify({ ...verify, received_amount: e.target.value })} className={sel} /></label>
              <label className="text-xs text-gray-500">Gateway charges<input type="number" value={verify.charges} onChange={(e) => setVerify({ ...verify, charges: e.target.value })} className={sel} /></label>
              <label className="col-span-2 text-xs text-gray-500">Bank account<select value={verify.bank_account_id} onChange={(e) => setVerify({ ...verify, bank_account_id: e.target.value })} className={sel}><option value="">Select...</option>{banks.map((x) => <option key={x.id} value={x.id}>{x.bank_name} — {x.account_number}</option>)}</select></label>
              {releasable > 0 && (
                <label className="col-span-2 flex items-start gap-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-500/10">
                  <input type="checkbox" checked={verify.release_missing} onChange={(e) => setVerify({ ...verify, release_missing: e.target.checked })} className="mt-0.5 accent-rose-600" />
                  <span>{b.summary.missing_in_sheet} payment(s) worth {PKR(releasable)} are <b>not on the gateway sheet</b>, so the gateway hasn&apos;t paid them out yet. Take them out of this batch (they go back to &quot;not batched&quot; for the next one).</span>
                </label>
              )}
              <label className="col-span-2 text-xs text-gray-500">Notes{(Math.abs(expected - received - charges) > 0.5 || unresolved > 0) && <span className="font-semibold text-rose-600"> * required — explain the difference{unresolved ? ` and the ${unresolved} line(s) to review` : ""}</span>}<input value={verify.notes} onChange={(e) => setVerify({ ...verify, notes: e.target.value })} className={sel} /></label>
            </div>
            <p className={`mt-2 text-xs font-semibold ${Math.abs(expected - received - charges) > 0.5 ? "text-rose-600" : "text-emerald-600"}`}>Expected {PKR(expected)} − received {PKR(received)} − charges {PKR(charges)} = difference {PKR(Math.round((expected - received - charges) * 100) / 100)}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={doVerify} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="size-4" /> Verify</button>
              <button onClick={doSettle} disabled={busy || b.status !== "verified"} title={b.status !== "verified" ? "Verify the batch first" : undefined} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Landmark className="size-4" /> Settle to bank</button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-stroke px-3 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-dark dark:text-white">
            <option value="">All lines</option>{Object.entries(ITEM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <div className="ml-auto">
            <ExportMenu title={`Settlement ${b.batch_no}`} columns={[
              { header: "Txn ID", value: (i: NonNullable<Batch["items"]>[number]) => i.gateway_txn_id },
              { header: "Date", value: (i) => day(i.txn_date) },
              { header: "Consumer no", value: (i) => i.consumer_number || "" },
              { header: "Paid by", value: (i) => i.payer || "" },
              { header: "Our amount", value: (i) => i.amount, numeric: true },
              { header: "Sheet amount", value: (i) => i.sheet_amount ?? "", numeric: true },
              { header: "Result", value: (i) => ITEM_LABEL[i.status] || i.status },
            ]} getRows={() => b.items || []} />
          </div>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-2"><tr><th className="px-3 py-2">Txn ID</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Paid by</th><th className="px-3 py-2 text-right">Our amount</th><th className="px-3 py-2 text-right">Sheet amount</th><th className="px-3 py-2">Result</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 dark:border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{i.gateway_txn_id}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{i.txn_date ? new Date(i.txn_date).toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-xs">{i.payer || i.consumer_number || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.amount ? PKR(i.amount) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.sheet_amount !== null ? PKR(i.sheet_amount) : "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ITEM_STATUS[i.status]}`}>{ITEM_LABEL[i.status] || i.status}</span></td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No lines.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
