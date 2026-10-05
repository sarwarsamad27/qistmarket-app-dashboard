"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { X, Receipt } from "lucide-react";
import { PKR } from "@/components/Accounts/StatCard";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Detail {
  title: string;
  transaction_id: string;
  type: "credit" | "debit";
  amount: number;
  date: string;
  status: string;
  fields: { label: string; value: string | number | null; money?: boolean }[];
  related: { label: string; date?: string; amount?: number }[];
}

/**
 * "View Trx" — loads /accounts/cash/transaction-detail for one cash-in-hand line and shows
 * what it was for (order, customer, installment month, who collected / accepted it...).
 */
export default function TransactionDetailModal({ source, id, onClose }: { source: string; id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/accounts/cash/transaction-detail?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
    })
      .then((r) => r.json())
      .then((j) => (j.success ? setDetail(j.data) : setError(j.message || "Could not load transaction.")))
      .catch(() => setError("Could not load transaction."));
  }, [source, id]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:bg-boxdark" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#ff3d3d]/10 text-[#ff3d3d]"><Receipt className="size-4" /></div>
            <div>
              <h3 className="text-sm font-bold text-dark dark:text-white">{detail?.title || "Transaction"}</h3>
              <p className="font-mono text-[11px] text-gray-400">{detail?.transaction_id || id}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="size-4" /></button>
        </div>

        <div className="p-5">
          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : !detail ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="mb-4 flex items-end justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount</p>
                  <p className={`text-2xl font-black ${detail.type === "debit" ? "text-rose-600" : "text-emerald-600"}`}>{detail.type === "debit" ? "− " : ""}{PKR(detail.amount)}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold capitalize text-gray-600 shadow-sm dark:bg-boxdark dark:text-gray-300">{detail.status}</span>
                  <p className="mt-1.5 text-xs text-gray-500">{new Date(detail.date).toLocaleString()}</p>
                </div>
              </div>

              <dl className="divide-y divide-slate-100 text-sm dark:divide-white/10">
                {detail.fields.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4 py-2">
                    <dt className="shrink-0 text-gray-500">{f.label}</dt>
                    <dd className="text-right font-medium text-dark dark:text-white">{f.money ? PKR(Number(f.value) || 0) : (f.value ?? "—")}</dd>
                  </div>
                ))}
              </dl>

              {detail.related.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Linked records</p>
                  <div className="space-y-1.5">
                    {detail.related.map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                        <div>
                          <p className="font-medium text-dark dark:text-white">{r.label}</p>
                          {r.date && <p className="text-gray-400">{new Date(r.date).toLocaleString()}</p>}
                        </div>
                        {r.amount !== undefined && <span className="font-bold tabular-nums text-dark dark:text-white">{PKR(r.amount)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
