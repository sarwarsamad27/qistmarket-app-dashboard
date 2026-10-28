"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { Loader2, MessageSquareText } from "lucide-react";
import { formatExactDate } from "@/utils/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export interface InstallmentNote {
  id: number | string;
  month_number: number;
  note: string;
  user_name: string | null;
  role_name?: string | null;
  created_at: string | null;
  legacy?: boolean;
}

/**
 * An account's installment note history, newest first, with who wrote each note.
 * Used in the Installment View note dialog and on the order page.
 * `refreshKey` reloads it (bump after adding a note). Renders nothing on the order
 * page when the account has no notes (`hideWhenEmpty`).
 */
export default function InstallmentNotesHistory({
  orderId,
  refreshKey = 0,
  hideWhenEmpty = false,
  title,
  card = false,
}: {
  orderId: number | string;
  refreshKey?: number;
  hideWhenEmpty?: boolean;
  title?: string;
  /** Wrap in the order page's full-width card style. */
  card?: boolean;
}) {
  const [notes, setNotes] = useState<InstallmentNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/outlet/installments/${orderId}/notes`, {
      headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.success) { setNotes(d.data || []); setFailed(false); } else setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId, refreshKey]);

  if (hideWhenEmpty && (failed || (!loading && notes.length === 0))) return null;

  return (
    <div className={card ? "mt-8 rounded-lg border border-stroke bg-white p-6 shadow-default dark:border-dark-3 dark:bg-gray-800" : undefined}>
      {title && (
        <h3 className="mb-4 flex items-center gap-2 text-xl font-bold dark:text-white">
          <MessageSquareText className="h-5 w-5 text-[#E31E24]" /> {title}
          {!loading && <span className="text-sm font-semibold text-gray-400">({notes.length})</span>}
        </h3>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notes...
        </div>
      ) : failed ? (
        <p className="py-4 text-xs text-red-500">Could not load note history.</p>
      ) : notes.length === 0 ? (
        <p className="py-4 text-xs italic text-gray-400">No notes yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {notes.map((n, idx) => (
            <li
              key={n.id}
              className={`rounded-2xl border p-3 ${idx === 0 ? "border-[#E31E24]/30 bg-red-50/40 dark:bg-red-950/10" : "border-gray-100 bg-gray-50/50 dark:border-strokedark dark:bg-meta-4/40"}`}
            >
              <p className="whitespace-pre-wrap text-xs font-semibold text-slate-800 dark:text-slate-200">{n.note}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-gray-500">
                {idx === 0 && <span className="rounded-full bg-[#E31E24] px-1.5 py-0.5 font-black uppercase text-white">Latest</span>}
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {n.legacy ? "Earlier note (author not recorded)" : n.user_name || "Unknown user"}
                </span>
                {n.role_name && <span>· {n.role_name}</span>}
                {n.created_at && <span>· {formatExactDate(n.created_at, "DD MMM YYYY, hh:mm A")}</span>}
                <span>· Month {n.month_number}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
