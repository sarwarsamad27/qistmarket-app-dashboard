"use client";

export const PKR = (val: number) => `PKR ${(val || 0).toLocaleString("en-PK")}`;

type StatCardProps = {
  icon: any;
  label: string;
  value: string | number;
  accent: string;
  bg: string;
  bar: string;
  glow?: string;
  onClick?: () => void;
  /** Highlights this card as the currently-selected filter (see onClick). */
  active?: boolean;
};

export default function StatCard({ icon: Icon, label, value, accent, bg, bar, glow, onClick, active }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-boxdark ${onClick ? "cursor-pointer" : ""} ${active ? `ring-2 ring-offset-1 ${bar.replace("bg-", "ring-")} border-transparent` : "border-slate-100 dark:border-white/10"}`}
    >
      {/* Decorative glow blob */}
      <div className={`pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.14] ${glow || bar}`} />

      <div className={`h-[3px] w-full ${bar}`} />

      <div className="relative flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${bg} ${accent} ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.06]`}>
            <Icon className="size-4" strokeWidth={2.25} />
          </div>
          <p className="text-[9px] font-black uppercase leading-tight tracking-widest text-slate-400 dark:text-slate-500">
            {label}
          </p>
        </div>
        <p className="break-all sm:break-words text-base sm:text-lg lg:text-[22px] font-black leading-none tracking-tight text-slate-800 dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}
