"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../../../contexts/AuthContext";
import Link from "next/link";
import {
  Users, UserCheck, Building2, Clock, CalendarCheck, TrendingUp,
  FileText, DollarSign, Star, Fingerprint, Bell, Activity,
  ArrowRight, UserPlus,
} from "lucide-react";
import { ValueSkeleton } from "@/components/ui/LoadingStates";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface HrStats {
  totalEmployees: number; activeEmployees: number; totalDepartments: number;
  pendingLeaves: number; todayAttendance: number; todayLate?: number;
  biometric?: {
    ip: string; port: number; last_sync_at: string | null; last_status: string | null; last_error: string | null;
    connected: boolean; today_punches: number; today_employees: number; device_users: number; linked_employees: number;
  } | null;
}

const fetchWithAuth = async (url: string) => {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
};

export default function HrDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<HrStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchWithAuth(`${BACKEND_URL}/api/hr/dashboard-stats`),
    ]).then(([statsRes]) => {
      if (statsRes.success) setStats(statsRes.stats);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Total Employees", value: stats ? stats.totalEmployees ?? 0 : null, icon: Users, color: "bg-blue-500", href: "/hr/employees" },
    { label: "Active Employees", value: stats ? stats.activeEmployees ?? 0 : null, icon: UserCheck, color: "bg-green-500", href: "/hr/employees" },
    { label: "Departments", value: stats ? stats.totalDepartments ?? 0 : null, icon: Building2, color: "bg-purple-500", href: "/hr/employees" },
    { label: "Pending Leaves", value: stats ? stats.pendingLeaves ?? 0 : null, icon: Clock, color: "bg-amber-500", href: "/hr/leaves" },
    { label: "Today's Attendance", value: stats ? stats.todayAttendance ?? 0 : null, icon: CalendarCheck, color: "bg-teal-500", href: "/hr/attendance" },
  ];

  const quickLinks = [
    { label: "Add Employee", icon: UserPlus, href: "/hr/employees/create", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" },
    { label: "Attendance", icon: Clock, href: "/hr/attendance", color: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300" },
    { label: "Issue Document", icon: FileText, href: "/hr/documents", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300" },
    { label: "Payroll", icon: DollarSign, href: "/hr/payroll", color: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" },
    { label: "Performance", icon: Star, href: "/hr/performance", color: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300" },
    { label: "Biometric", icon: Fingerprint, href: "/hr/biometric", color: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300" },
    { label: "Announcements", icon: Bell, href: "/hr/announcements", color: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300" },
    { label: "Leaves", icon: CalendarCheck, href: "/hr/leaves", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark dark:text-white">HR Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back, {user?.full_name || "HR Manager"}</p>
      </div>

      {/* Stats */}
      {(
        <div className="grid grid-cols-2 gap-3 sm:gap-5 sm:grid-cols-3 xl:grid-cols-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.href} className="group rounded-xl border border-stroke bg-white p-4 sm:p-5 shadow-sm transition-all hover:shadow-lg dark:border-stroke-dark dark:bg-dark-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="mt-1 text-xl sm:text-3xl font-bold text-dark dark:text-white break-all">
                      {/* Shimmer while loading; "—" (not 0) if stats failed to load. */}
                      {card.value === null ? <ValueSkeleton failed={!loading} className="h-7 w-12" /> : card.value}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl ${card.color} transition-transform group-hover:scale-110`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Biometric device */}
      {!loading && (
        <Link href="/hr/biometric" className="block rounded-xl border border-stroke bg-white p-4 shadow-sm transition-all hover:shadow-lg sm:p-5 dark:border-stroke-dark dark:bg-dark-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500"><Fingerprint className="h-6 w-6 text-white" /></div>
              <div>
                <p className="font-semibold text-dark dark:text-white">Biometric Device</p>
                {stats?.biometric ? (
                  <p className="text-xs text-gray-500">
                    {stats.biometric.ip}:{stats.biometric.port} ·{" "}
                    {stats.biometric.connected ? <span className="text-green">Connected</span> : <span className="text-red">{stats.biometric.last_status === "error" ? "Not reachable" : "Not synced recently"}</span>}
                    {" "}· Last sync {stats.biometric.last_sync_at ? new Date(stats.biometric.last_sync_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "never"}
                  </p>
                ) : <p className="text-xs text-gray-500">No device added — click to set it up</p>}
              </div>
            </div>
            {stats?.biometric && (
              <div className="flex flex-wrap gap-6 text-center">
                <div><p className="text-xl font-bold text-dark dark:text-white">{stats.biometric.today_punches}</p><p className="text-xs text-gray-500">Punches today</p></div>
                <div><p className="text-xl font-bold text-dark dark:text-white">{stats.biometric.today_employees}</p><p className="text-xs text-gray-500">People punched today</p></div>
                <div><p className="text-xl font-bold text-dark dark:text-white">{stats.todayLate ?? 0}</p><p className="text-xs text-gray-500">Late today</p></div>
                <div><p className="text-xl font-bold text-dark dark:text-white">{stats.biometric.linked_employees}/{stats.biometric.device_users}</p><p className="text-xs text-gray-500">Device users linked</p></div>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-xl border border-stroke bg-white p-4 sm:p-6 dark:border-stroke-dark dark:bg-dark-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
            <Activity className="h-5 w-5 text-primary" /> Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.label} href={link.href} className={`flex items-center gap-3 rounded-xl p-4 transition-all hover:scale-[1.02] ${link.color}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/50 dark:bg-black/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{link.label}</p>
                    <ArrowRight className="mt-0.5 h-3 w-3 opacity-50" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* HR Portal Overview */}
        <div className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-dark dark:text-white">
            <TrendingUp className="h-5 w-5 text-primary" /> Portal Overview
          </h2>
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-2 p-4 dark:bg-dark-3">
              <p className="text-sm font-medium text-dark dark:text-white">HR Features Available</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Employee Management</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Attendance & Biometric</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Document Templates</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Payroll Management</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Loan Management</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Performance KPIs</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Leave Management</span>
                <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-green" /> Announcements</span>
              </div>
            </div>
            <div className="rounded-lg bg-primary/5 p-4 text-sm">
              <p className="font-medium text-primary">Pro Tip</p>
              <p className="mt-1 text-gray-500">Use the Document Center to issue Offer Letters, Appointment Letters, and more with dynamic templates and auto-email delivery.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
