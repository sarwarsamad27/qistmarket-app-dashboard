"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { X } from "lucide-react";
import { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import { TableSkeleton } from "@/components/Accounts/Skeleton";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Entry { key: string; date: string; type: string; reference: string; details: string; outlet: string | null; debit: number; credit: number; balance: number; status?: string }
interface LedgerData {
  vendor: { id: number; name: string; phone: string | null; outlet: { name: string } | null };
  summary: { opening_balance: number; purchased: number; paid: number; returned: number; closing_balance: number; open_invoices: number; open_invoice_balance: number };
  entries: Entry[];
}

const TYPE_STYLE: Record<string, string> = {
  Purchase: "bg-orange-50 text-orange-700 dark:bg-orange-500/10",
  Payment: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  Return: "bg-blue-50 text-blue-700 dark:bg-blue-500/10",
  "Cash paid": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10",
  "Cash received": "bg-rose-50 text-rose-700 dark:bg-rose-500/10",
};

/** Complete vendor account: purchases, payments (and where the money came from), returns, running balance. */
export default function VendorLedgerModal({ vendorId, onClose, onPay }: { vendorId: number; onClose: () => void; onPay?: (outstanding: number, name: string) => void }) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [range, setRange] = useState<DateRange>({ from: "", to: "" });

  useEffect(() => {
    const qs = new URLSearchParams({ ...(range.from && { startDate: range.from }), ...(range.to && { endDate: range.to }) });
    fetch(`${BACKEND_URL}/api/accounts/vendors/${vendorId}/ledger?${qs}`, { headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` } })
      .then((r) => r.json()).then((j) => { if (j.success) setData(j.data); });
  }, [vendorId, range]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div>
            <h3 className="text-base font-bold text-dark dark:text-white">{data?.vendor.name || "Vendor"} — Ledger</h3>
            <p className="text-xs text-gray-500">{data?.vendor.outlet?.name || "Head Office vendor"}{data?.vendor.phone ? ` · ${data.vendor.phone}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {data && onPay && data.summary.open_invoice_balance > 0 && (
              <button onClick={() => onPay(data.summary.open_invoice_balance, data.vendor.name)} className="rounded-xl bg-[#ff3d3d] px-4 py-2 text-sm font-semibold text-white hover:bg-opacity-90">Pay vendor</button>
            )}
            {data && (
              <ExportMenu title={`Vendor Ledger ${data.vendor.name}`} columns={[
                { header: "Date", value: (e: Entry) => new Date(e.date).toLocaleDateString() },
                { header: "Type", value: (e) => e.type },
                { header: "Reference", value: (e) => e.reference },
                { header: "Details", value: (e) => e.details },
                { header: "Outlet", value: (e) => e.outlet || "" },
                { header: "Debit (we owe more)", value: (e) => e.debit || "", numeric: true },
                { header: "Credit (paid / returned)", value: (e) => e.credit || "", numeric: true },
                { header: "Balance", value: (e) => e.balance, numeric: true },
              ]} getRows={() => [...data.entries].reverse()} />
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="size-4" /></button>
          </div>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          {!data ? <TableSkeleton /> : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  ["Opening", data.summary.opening_balance],
                  ["Purchased", data.summary.purchased],
                  ["Paid", data.summary.paid],
                  ["Returned", data.summary.returned],
                  ["Balance (we owe)", data.summary.closing_balance],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{l}</p>
                    <p className="text-base font-black text-dark dark:text-white">{PKR(v as number)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">{data.summary.open_invoices} open invoice(s) worth {PKR(data.summary.open_invoice_balance)}.</p>
              <DateRangeFilter value={range} onChange={setRange} />
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                    <tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Type</th><th className="px-3 py-2.5">Reference</th><th className="px-3 py-2.5">Details</th><th className="px-3 py-2.5">Outlet</th><th className="px-3 py-2.5 text-right">Debit</th><th className="px-3 py-2.5 text-right">Credit</th><th className="px-3 py-2.5 text-right">Balance</th></tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e) => (
                      <tr key={e.key} className="border-t border-slate-50 dark:border-white/5">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-500">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TYPE_STYLE[e.type] || "bg-gray-100 text-gray-600"}`}>{e.type}</span></td>
                        <td className="px-3 py-2.5 font-mono text-xs text-dark dark:text-white">{e.reference}</td>
                        <td className="max-w-[300px] px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300">{e.details}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{e.outlet || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">{e.debit ? PKR(e.debit) : ""}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{e.credit ? PKR(e.credit) : ""}</td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-dark dark:text-white">{PKR(e.balance)}</td>
                      </tr>
                    ))}
                    {!data.entries.length && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No entries in this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
