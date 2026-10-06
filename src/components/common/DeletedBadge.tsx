"use client";

import { Trash2 } from "lucide-react";

export interface SoftDeleted { deleted_at?: string | null; deleted_by_name?: string | null; delete_reason?: string | null }

/** Row class for a soft-deleted record: stays visible, greyed and struck through, not clickable-looking. */
export const deletedRowClass = (row: SoftDeleted) => (row.deleted_at ? "opacity-50 grayscale line-through decoration-gray-400" : "");

/** "Deleted" pill with who / when / why in its tooltip. */
export default function DeletedBadge({ row }: { row: SoftDeleted }) {
  if (!row.deleted_at) return null;
  const title = `Deleted ${new Date(row.deleted_at).toLocaleString()}${row.deleted_by_name ? ` by ${row.deleted_by_name}` : ""}${row.delete_reason ? ` — ${row.delete_reason}` : ""}. Not counted anywhere.`;
  return (
    <span title={title} className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-600 no-underline dark:bg-white/10 dark:text-gray-300" style={{ textDecoration: "none" }}>
      <Trash2 className="size-3" /> Deleted
    </span>
  );
}

/** Asks why something is being deleted; null when the user cancels. */
export function askDeleteReason(what: string): string | null {
  const r = window.prompt(`Delete ${what}?\n\nIt will stay visible greyed out as "Deleted" but will no longer be counted anywhere.\n\nReason:`);
  if (r === null) return null;
  return r.trim() || "No reason given";
}
