"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { employeeFetch } from "@/lib/employee-api";
import { StatCard } from "@/components/EmployeePortal/StatCard";
import {
  Clock, Calendar, Wallet, Banknote, Bell, TrendingUp,
  User, FileText, History, ArrowRight, ShoppingBag,
} from "lucide-react";
import { useEmployeeAuth } from "../../../../../contexts/EmployeeAuthContext";

const QUICK_LINKS = [
  { title: "Profile", url: "/employee/profile", desc: "View personal info", icon: User, color: "from-sky-500 to-sky-600" },
  { title: "Timeline", url: "/employee/timeline", desc: "Activity log", icon: History, color: "from-violet-500 to-violet-600" },
  { title: "Attendance", url: "/employee/attendance", desc: "Mark & view attendance", icon: Clock, color: "from-green-500 to-green-600" },
  { title: "Payroll", url: "/employee/payroll", desc: "Salary slips & history", icon: Wallet, color: "from-blue-500 to-blue-600" },
  { title: "Loans", url: "/employee/loans", desc: "Apply & track loans", icon: Banknote, color: "from-amber-500 to-amber-600" },
  { title: "Leaves", url: "/employee/leaves", desc: "Apply for leave", icon: Calendar, color: "from-teal-500 to-teal-600" },
  { title: "Notifications", url: "/employee/notifications", desc: "View alerts", icon: Bell, color: "from-rose-500 to-rose-600" },
  { title: "Documents", url: "/employee/documents", desc: "Uploads & records", icon: FileText, color: "from-indigo-500 to-indigo-600" },
  { title: "Performance", url: "/employee/performance", desc: "KPI & reviews", icon: TrendingUp, color: "from-orange-500 to-orange-600" },
  { title: "Orders & Qist", url: "/employee/orders", desc: "My installments", icon: ShoppingBag, color: "from-red-500 to-rose-600" },
];

export default function EmployeeDashboardPage() {
  const { user } = useEmployeeAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeeFetch("/employee/dashboard")
      .then((r) => setData(r.dashboard))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading dashboard...</p>;

  const d = data as {
    attendance_today?: string;
    leave_balance?: number;
    last_salary?: { amount: number; month: number; year: number };
    loan_balance?: { remaining: number; type: string };
    unread_notifications?: number;
    performance_score?: number;
  };

  const statusLabel: Record<string, string> = {
    present: "Present ✓",
    absent: "Absent ✗",
    late: "Late ⚠",
    off: "Off",
    holiday: "Holiday",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome, {user?.full_name}</p>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-dark dark:text-white">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.url}
                href={item.url}
                className="group flex items-center gap-4 rounded-xl border border-stroke bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-stroke-dark dark:bg-dark-2"
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.color} text-white shadow-sm`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-dark dark:text-white">{item.title}</p>
                  <p className="truncate text-xs text-gray-500">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-dark dark:text-white">At a Glance</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Today's Attendance"
          value={statusLabel[d?.attendance_today || "absent"] || d?.attendance_today || "—"}
          icon={<Clock className="h-6 w-6" />}
          color="bg-green"
        />
        <StatCard
          title="Leave Balance"
          value={`${d?.leave_balance ?? 0} days`}
          subtitle="Annual + Sick remaining"
          icon={<Calendar className="h-6 w-6" />}
          color="bg-blue-DEFAULT"
        />
        <StatCard
          title="Last Salary"
          value={d?.last_salary ? `Rs. ${d.last_salary.amount.toLocaleString()}` : "—"}
          subtitle={d?.last_salary ? `${d.last_salary.month}/${d.last_salary.year}` : "No record"}
          icon={<Wallet className="h-6 w-6" />}
          color="bg-primary"
        />
        <StatCard
          title="Loan Balance"
          value={d?.loan_balance ? `Rs. ${d.loan_balance.remaining.toLocaleString()}` : "None"}
          subtitle={d?.loan_balance?.type?.replace("_", " ") || ""}
          icon={<Banknote className="h-6 w-6" />}
          color="bg-yellow-dark"
        />
        <StatCard
          title="Notifications"
          value={d?.unread_notifications ?? 0}
          subtitle="Unread"
          icon={<Bell className="h-6 w-6" />}
          color="bg-dark-4"
        />
        <StatCard
          title="Performance Score"
          value={`${d?.performance_score ?? 0}%`}
          subtitle="Current month KPI"
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-green-dark"
        />
      </div>
    </div>
  );
}
