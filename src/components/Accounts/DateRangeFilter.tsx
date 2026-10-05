"use client";

import { CalendarDays, X } from "lucide-react";

export interface DateRange { from: string; to: string }

const ymd = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Today", range: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { label: "7 days", range: () => { const d = new Date(); d.setDate(d.getDate() - 6); return { from: ymd(d), to: ymd(new Date()) }; } },
  { label: "30 days", range: () => { const d = new Date(); d.setDate(d.getDate() - 29); return { from: ymd(d), to: ymd(new Date()) }; } },
  { label: "This month", range: () => { const d = new Date(); return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d) }; } },
];

/** True when `date` falls inside the (inclusive, local-day) range; an empty side is open-ended. */
export function inDateRange(date: string | Date | null | undefined, range: DateRange) {
  if (!range.from && !range.to) return true;
  if (!date) return false;
  const day = ymd(new Date(date));
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export default function DateRangeFilter({ value, onChange, presets = true }: { value: DateRange; onChange: (r: DateRange) => void; presets?: boolean }) {
  const input = "rounded-xl border border-stroke bg-white px-3 py-2 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white";
  const active = value.from || value.to;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="size-4 text-gray-400" />
      <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className={input} aria-label="From date" />
      <span className="text-xs text-gray-400">to</span>
      <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className={input} aria-label="To date" />
      {presets && PRESETS.map((p) => (
        <button key={p.label} type="button" onClick={() => onChange(p.range())} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-200 dark:bg-dark-3 dark:text-gray-300">
          {p.label}
        </button>
      ))}
      {active && (
        <button type="button" onClick={() => onChange({ from: "", to: "" })} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
          <X className="size-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
