import { ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { pktDate, pktMonthStart } from "@/utils/pkt";

export type RoleKey = "verification" | "delivery" | "recovery";

export const ROLE_META: Record<RoleKey, { label: string; icon: any; color: string; bg: string }> = {
  verification: { label: "Verification Officer", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
  delivery: { label: "Delivery Officer", icon: Truck, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10" },
  recovery: { label: "Recovery Officer", icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-500/10" },
};

export const fmtRs = (n: any) => `Rs. ${Math.round(Number(n) || 0).toLocaleString()}`;

export const today = () => pktDate();
export const monthStart = () => pktMonthStart();

export const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";

export const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtMinutes = (m?: number | null) => {
  if (m == null) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
};
