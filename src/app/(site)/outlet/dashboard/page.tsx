"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import { ApexOptions } from "apexcharts";
import {
  Package, Clock, CheckCircle2, XCircle, Truck, CreditCard, AlertTriangle, ShoppingBag, RefreshCw, ArrowRight,
  Wallet, Activity, ChevronRight, BoxIcon, ShieldCheck, FileText,
  Receipt, UserSquare2, Logs, Filter, TrendingUp, TrendingDown, Percent, Award, BadgeDollarSign
} from "lucide-react";
import { useAuth } from "../../../../../contexts/AuthContext";
import { getRoleHome } from "@/lib/roleHome";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

type Stats = {
  orders: {
    todayOrders: number;
    pendingVerification: number;
    approvedOrders: number;
    cancelledOrders: number;
    deliveryPending: number;
    delivered: number;
    rejectedOrders: number;
    expiredOrders: number;
  };
  performance: {
    dailySales: number;
    weeklySales: number;
    monthlySales: number;
    periodSales: number;
  };
  installments: {
    totalInstallmentDue: number;
    totalInstallmentPaid: number;
    totalRemaining: number;
    monthDue?: number;
    monthPaid?: number;
    monthRemaining?: number;
    paidPercentage?: number;
    remainingPercentage?: number;
    cumulativeRemaining?: number;
    totalArrears: number;
    pendingInstallmentCount: number;
    ordersWithPendingInstallments: number;
  };
  financials: {
    down_payments: number;
    installments_received: number;
    cash_from_recovery: number;
    cash_from_delivery: number;
    expenses: number;
    closing_cash: number;
  };
  stock: {
    totalItems: number;
    inStock: number;
    sold: number;
    distinctProducts: number;
  };
  todayIncrement: {
    total: number;
    pending: number;
    approved: number;
    deliveryPending: number;
    delivered: number;
    cancelled: number;
    rejected: number;
    expired: number;
    sales: number;
  };
  graphData: {
    days: number[];
    sales: { current: number[]; previous: number[] };
    customers: { current: number[]; previous: number[] };
  };
};

const PKR = (val: number) =>
  `PKR ${(val || 0).toLocaleString("en-PK")}`;

const StatCard = ({
  icon: Icon,
  label,
  value,
  inc = 0,
  accent,
  bg,
  bar,
  onClick,
}: {
  icon: any;
  label: string;
  value: string | number;
  inc?: number;
  accent: string;
  bg: string;
  bar: string;
  onClick?: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 dark:border-dark-3 dark:bg-boxdark flex flex-col ${onClick ? "cursor-pointer" : ""}`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${bar}`} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Icon + label row */}
        <div className="flex items-center gap-2.5">
          <div className={`flex size-9 items-center justify-center rounded-xl ${bg} ${accent} shrink-0`}>
            {Icon}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight whitespace-normal">{label}</p>
        </div>

        {/* Value */}
        <p className="text-base sm:text-xl lg:text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tight break-all sm:break-normal">{value}</p>
      </div>
    </div>
  );
};

const QuickLink = ({ icon: Icon, label, href, color, filterQuery = "" }: { icon: any; label: string; href: string; color: string; filterQuery?: string }) => {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`${href}${filterQuery}`)}
      className="group flex flex-col items-center gap-1.5 transition-all duration-300 hover:-translate-y-1"
    >
      <div className={`flex size-14 items-center justify-center rounded-2xl ${color} shadow-sm group-hover:scale-105 group-hover:shadow-md transition-all duration-300`}>
        <Icon className="size-6 text-white" />
      </div>
      <span className="text-[10px] font-bold text-center text-slate-600 dark:text-slate-300 leading-tight group-hover:text-primary transition-colors max-w-[80px] truncate">{label}</span>
    </button>
  );
};

export default function OutletDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [outletName, setOutletName] = useState("Outlet Portal");
  const [refreshing, setRefreshing] = useState(false);

  const [filterType, setFilterType] = useState<"today" | "month" | "custom">("today");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const getFilterQueryParams = () => {
    if (filterType === "today") return "?dateRange=Day";
    if (filterType === "month") return "?dateRange=Month";
    if (filterType === "custom") {
      let q = "?dateRange=Custom Range";
      if (startDate) q += `&startDate=${startDate}`;
      if (endDate) q += `&endDate=${endDate}`;
      return q;
    }
    return "";
  };

  useEffect(() => {
    if (!authLoading && user) {
      const userRole = user.role?.toLowerCase();
      // Roles with a different home (CSR, HR, Accounts) don't belong here.
      const home = getRoleHome(userRole);
      if (home !== "/" && home !== "/outlet/dashboard") {
        router.replace(home);
      }
      setOutletName(user.outlet_name || user.full_name || "Outlet Portal");
    }
  }, [user, authLoading, router]);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const query = new URLSearchParams({ filter: filterType });
      if (filterType === "custom") {
        if (startDate) query.append("startDate", startDate);
        if (endDate) query.append("endDate", endDate);
      }

      const res = await fetch(`${API_BASE}/api/outlet/dashboard-stats?${query.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (e) {
      console.error("Failed to load dashboard metrics", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [filterType]);

  // Donut Chart: Order status breakdown
  const orderDonutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    labels: ["Pending Verification", "Approved", "Picked", "Delivered", "Cancelled", "Rejected", "Expired"],
    colors: ["#F59E0B", "#3F51B5", "#8B5CF6", "#10B981", "#EF4444", "#F43F5E", "#E2E8F0"],
    plotOptions: { pie: { donut: { size: "70%" } } },
    dataLabels: { enabled: false },
    legend: { position: "bottom", fontFamily: "inherit", fontSize: "11px", fontWeight: 700 },
    tooltip: { theme: "dark" },
  };
  
  const orderDonutSeries = stats
    ? [
        stats.orders.pendingVerification,
        stats.orders.approvedOrders,
        stats.orders.deliveryPending,
        stats.orders.delivered,
        stats.orders.cancelledOrders,
        stats.orders.rejectedOrders,
        stats.orders.expiredOrders,
      ]
    : [0, 0, 0, 0, 0, 0, 0];

  // Apex Area Chart options for Revenue & Customers velocity
  const chartOptions: any = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent', animations: { enabled: true, easing: 'easeinout', speed: 1200 } },
    stroke: { curve: 'smooth', width: 3, colors: ['#E31E24', '#94A3B8'] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] } },
    xaxis: { categories: stats?.graphData?.days || [], labels: { style: { colors: '#94A3B8', fontSize: '9px', fontWeight: 800 } }, axisBorder: { show: false } },
    yaxis: { labels: { style: { colors: '#94A3B8', fontSize: '9px', fontWeight: 800 }, formatter: (v: any) => { const n = Number(v) || 0; return n >= 1000 ? `${(n/1000).toFixed(0)}k` : `${n}`; } } },
    grid: { borderColor: '#F1F5F9', strokeDashArray: 5 },
    legend: { show: false },
    colors: ['#E31E24', '#94A3B8'],
    tooltip: {
      theme: 'light',
      x: { show: false },
      marker: { show: true },
      y: { formatter: (v: any) => { const n = Number(v) || 0; return n >= 1000 ? `${(n/1000).toFixed(0)}k` : `${n}`; } }
    }
  };

  const currentSalesTotal = stats?.graphData?.sales?.current?.reduce((a: number, b: number) => a + b, 0) || 0;
  const previousSalesTotal = stats?.graphData?.sales?.previous?.reduce((a: number, b: number) => a + b, 0) || 0;
  const currentCustomersTotal = stats?.graphData?.customers?.current?.reduce((a: number, b: number) => a + b, 0) || 0;
  const previousCustomersTotal = stats?.graphData?.customers?.previous?.reduce((a: number, b: number) => a + b, 0) || 0;

  // Month-wise Collection Rate calculations
  const monthDue = stats?.installments?.monthDue ?? stats?.installments?.totalInstallmentDue ?? 0;
  const monthPaid = stats?.installments?.monthPaid ?? stats?.installments?.totalInstallmentPaid ?? 0;
  const monthRemaining = stats?.installments?.monthRemaining ?? stats?.installments?.totalRemaining ?? 0;

  const paidPct = stats?.installments?.paidPercentage ?? (monthDue > 0 ? Math.round((monthPaid / monthDue) * 1000) / 10 : 0);
  const remainingPct = stats?.installments?.remainingPercentage ?? (monthDue > 0 ? Math.round((monthRemaining / monthDue) * 1000) / 10 : 0);

  const collectionDonutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "inherit" },
    labels: ["Total Month Paid", "Month Remaining"],
    colors: ["#10B981", "#F43F5E"],
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { show: true, fontSize: "10px", color: "#6B7280", offsetY: -4 },
            value: { show: true, fontSize: "18px", fontWeight: "800", color: "#111827", formatter: () => `${paidPct}%` },
            total: {
              show: true,
              label: "Recovered",
              fontSize: "10px",
              fontWeight: "700",
              color: "#6B7280",
              formatter: () => `${paidPct}%`,
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      theme: "dark",
      y: { formatter: (val) => `${PKR(val)}` }
    },
  };

  const quickLinks = [
    { icon: Package, label: "Orders", href: "/orders-list", color: "bg-red-500" },
    { icon: CheckCircle2, label: "Approved Orders", href: "/approved-orders", color: "bg-indigo-500" },
    { icon: BoxIcon, label: "Inventory", href: "/outlet/inventory", color: "bg-violet-500" },
    { icon: CreditCard, label: "Installments", href: "/outlet/installments", color: "bg-emerald-500" },
    { icon: Activity, label: "Recovery", href: "/outlet/recovery", color: "bg-orange-500" },
    { icon: Truck, label: "Delivery", href: "/outlet/delivery", color: "bg-cyan-500" },
    { icon: ShieldCheck, label: "Verification", href: "/outlet/verification", color: "bg-indigo-500" },
    { icon: Wallet, label: "Cash Register", href: "/outlet/cash-register", color: "bg-green-500" },
    { icon: FileText, label: "Reports", href: "/outlet/reports", color: "bg-slate-600" },
    { icon: Receipt, label: "Expenses", href: "/outlet/expenses", color: "bg-yellow-500" },
    { icon: UserSquare2, label: "Vendors", href: "/outlet/vendors", color: "bg-teal-500" },
    { icon: Logs, label: "Security Logs", href: "/outlet/security-logs", color: "bg-gray-500" },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl animate-pulse space-y-6 p-4">
        <div className="h-20 rounded-2xl bg-gray-200 dark:bg-dark-3" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-gray-200 dark:bg-dark-3" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-72 rounded-2xl bg-gray-200 dark:bg-dark-3" />
          <div className="h-72 rounded-2xl bg-gray-200 dark:bg-dark-3" />
          <div className="h-72 rounded-2xl bg-gray-200 dark:bg-dark-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 lg:p-8 min-h-screen animate-in fade-in duration-1000">
      
      {/* Header with Advanced Date Range Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-8 border-b border-slate-200 pb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#E31E24] rounded-2xl shadow-lg shadow-red-200">
              <Activity className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">{outletName}</h1>
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 ml-1">Live Outlet Performance</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/20 max-w-full">
          {["today", "month", "custom"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl text-[10px] font-black uppercase transition-all ${filterType === type ? "bg-[#E31E24] text-white shadow-xl shadow-red-200 scale-105" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
            >
              {type}
            </button>
          ))}
          {filterType === "custom" && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-100 ml-1 sm:ml-2">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black text-slate-500 uppercase cursor-pointer"
              />
              <span className="text-slate-200 font-black">/</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black text-slate-500 uppercase cursor-pointer"
              />
              <button
                onClick={() => fetchStats()}
                className="h-10 w-10 bg-[#E31E24] text-white rounded-xl shadow-lg shadow-red-200 flex items-center justify-center hover:scale-110"
              >
                <Filter size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links / Access Menu */}
      <section className="mb-8">
        <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Quick Access Portal</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-12 gap-3 max-w-full overflow-x-auto pb-2 custom-scrollbar">
          {quickLinks.map((ql) => (
            <QuickLink key={ql.label} {...ql} filterQuery={getFilterQueryParams()} />
          ))}
        </div>
      </section>

      {/* KPI Cards Row */}
      {stats && (
        <section className="mb-8">
          <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">Real-Time Indicators</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 sm:gap-4 w-full">
            <StatCard
              icon={<BadgeDollarSign size={18} />}
              label="Closing Balance"
              value={PKR(stats.financials.closing_cash)}
              accent="text-[#E31E24]"
              bg="bg-red-50"
              bar="bg-[#E31E24]"
              onClick={() => router.push("/outlet/cash-register")}
            />
            <StatCard
              icon={<BoxIcon size={18} />}
              label="Stock In Hand"
              value={`${stats.stock.distinctProducts.toLocaleString()} Items · Qty ${stats.stock.inStock.toLocaleString()}`}
              accent="text-violet-600"
              bg="bg-violet-50"
              bar="bg-violet-400"
              onClick={() => router.push("/outlet/inventory")}
            />
            <StatCard
              icon={<ShoppingBag size={18} />}
              label="Total Orders"
              value={stats.orders.todayOrders}
              inc={stats.todayIncrement.total}
              accent="text-blue-600"
              bg="bg-blue-50"
              bar="bg-blue-400"
              onClick={() => router.push(`/orders-list${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<Clock size={18} />}
              label="Pending Verification"
              value={stats.orders.pendingVerification}
              inc={stats.todayIncrement.pending}
              accent="text-amber-600"
              bg="bg-amber-50"
              bar="bg-amber-400"
              onClick={() => router.push(`/in-progress-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<CheckCircle2 size={18} />}
              label="Approved Orders"
              value={stats.orders.approvedOrders}
              inc={stats.todayIncrement.approved}
              accent="text-indigo-600"
              bg="bg-indigo-50"
              bar="bg-indigo-400"
              onClick={() => router.push(`/approved-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<Truck size={18} />}
              label="Picked Orders"
              value={stats.orders.deliveryPending}
              inc={stats.todayIncrement.deliveryPending}
              accent="text-purple-600"
              bg="bg-purple-50"
              bar="bg-purple-400"
              onClick={() => router.push(`/picked-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<Award size={18} />}
              label="Delivered Orders"
              value={stats.orders.delivered}
              inc={stats.todayIncrement.delivered}
              accent="text-emerald-600"
              bg="bg-emerald-50"
              bar="bg-emerald-400"
              onClick={() => router.push(`/delivered-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<XCircle size={18} />}
              label="Cancelled Orders"
              value={stats.orders.cancelledOrders}
              inc={stats.todayIncrement.cancelled}
              accent="text-rose-600"
              bg="bg-rose-50"
              bar="bg-rose-400"
              onClick={() => router.push(`/cancelled-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<AlertTriangle size={18} />}
              label="Rejected Orders"
              value={stats.orders.rejectedOrders}
              inc={stats.todayIncrement.rejected}
              accent="text-red-600"
              bg="bg-red-50"
              bar="bg-red-400"
              onClick={() => router.push(`/rejected-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<Clock size={18} />}
              label="Expired Orders"
              value={stats.orders.expiredOrders}
              inc={stats.todayIncrement.expired}
              accent="text-orange-600"
              bg="bg-orange-50"
              bar="bg-orange-400"
              onClick={() => router.push(`/expired-orders${getFilterQueryParams()}`)}
            />
            <StatCard
              icon={<Wallet size={18} />}
              label="Period Sales"
              value={PKR(stats.performance.periodSales)}
              inc={stats.todayIncrement.sales}
              accent="text-[#E31E24]"
              bg="bg-red-50"
              bar="bg-[#E31E24]"
            />
          </div>
        </section>
      )}

      {/* Main Charts & Statistics breakdown */}
      {stats && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start mb-8">
          
          {/* Revenue Analytics Curve (This Month vs Last Month) */}
          <div className="col-span-12 xl:col-span-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Revenue Analytics</h4>
                <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">Delivered order value contrast</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]"></div>
                  <span className="text-[8px] font-black text-gray-500 uppercase">Prev: {PKR(previousSalesTotal)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-50 border border-red-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#E31E24]"></div>
                  <span className="text-[8px] font-black text-[#E31E24] uppercase">Cur: {PKR(currentSalesTotal)}</span>
                </div>
              </div>
            </div>
            <Chart
              options={chartOptions}
              series={[
                { name: 'Current Month', data: stats.graphData?.sales?.current || [] },
                { name: 'Previous Month', data: stats.graphData?.sales?.previous || [] }
              ]}
              type="area"
              height={300}
            />
          </div>

          {/* Conversion Velocity (Delivered Count) */}
          <div className="col-span-12 xl:col-span-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Conversion Velocity</h4>
                <p className="text-[9px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">Successful order handovers count</p>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#94A3B8]"></div>
                  <span className="text-[8px] font-black text-gray-500 uppercase">Prev: {previousCustomersTotal}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></div>
                  <span className="text-[8px] font-black text-[#10B981] uppercase">Cur: {currentCustomersTotal}</span>
                </div>
              </div>
            </div>
            <Chart
              options={{
                ...chartOptions,
                stroke: { ...chartOptions.stroke, colors: ['#10B981', '#94A3B8'] },
                colors: ['#10B981', '#94A3B8'],
                yaxis: {
                  labels: {
                    style: { colors: '#94A3B8', fontSize: '9px', fontWeight: 800 },
                    formatter: (v: any) => `${Math.round(Number(v) || 0)}`
                  }
                },
                tooltip: {
                  ...chartOptions.tooltip,
                  y: {
                    formatter: (v: any) => `${Math.round(Number(v) || 0)}`
                  }
                }
              }}
              series={[
                { name: 'Current Month', data: stats.graphData?.customers?.current || [] },
                { name: 'Previous Month', data: stats.graphData?.customers?.previous || [] }
              ]}
              type="area"
              height={300}
            />
          </div>

        </div>
      )}

      {/* Segment Breakdown & Installments recovery rates */}
      {stats && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mb-8">
          
          {/* Order Breakdown Donut */}
          <div className="col-span-12 lg:col-span-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Order Breakdown</h3>
            <p className="text-[9px] font-bold text-gray-400 mt-0.5 mb-6 uppercase tracking-widest">Status ratio split</p>
            {orderDonutSeries.reduce((a, b) => a + b, 0) > 0 ? (
              <Chart options={orderDonutOptions} series={orderDonutSeries} type="donut" height={260} />
            ) : (
              <div className="flex h-52 items-center justify-center text-gray-300 font-bold uppercase tracking-widest text-xs">No orders registered</div>
            )}
          </div>

          {/* Collection Progress Radial / Donut */}
          <div className="col-span-12 lg:col-span-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Collection Rate</h3>
              <p className="text-[9px] font-bold text-gray-400 mt-0.5 mb-3 uppercase tracking-widest">Installment Returns (Month-Wise)</p>
              {monthDue > 0 ? (
                <Chart options={collectionDonutOptions} series={[monthPaid, monthRemaining]} type="donut" height={190} />
              ) : (
                <div className="flex h-44 items-center justify-center text-gray-300 font-bold uppercase tracking-widest text-xs">No Due Data</div>
              )}
            </div>
            <div className="space-y-2.5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between text-[10px] font-black uppercase gap-2">
                <span className="text-gray-400 whitespace-nowrap shrink-0">Total Due</span>
                <span className="text-gray-800 whitespace-nowrap shrink-0">{PKR(monthDue)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase gap-2">
                <span className="text-gray-400 whitespace-nowrap shrink-0">Total Month Paid</span>
                <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span className="text-emerald-600">{PKR(monthPaid)}</span>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-600">{paidPct}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase gap-2">
                <span className="text-gray-400 whitespace-nowrap shrink-0">Month Remaining</span>
                <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <span className="text-rose-600">{PKR(monthRemaining)}</span>
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-black text-rose-600">{remainingPct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Side Performance Timelines */}
          <div className="col-span-12 lg:col-span-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">Timeline Performance</h3>
            <p className="text-[9px] font-bold text-gray-400 mt-0.5 mb-6 uppercase tracking-widest">Aggregate delivered order totals</p>
            <div className="space-y-4">
              {[
                { label: "Today's Handovers", value: stats.performance.dailySales, bg: "bg-emerald-50 text-emerald-600 border border-emerald-100" },
                { label: "Weekly Handovers", value: stats.performance.weeklySales, bg: "bg-blue-50 text-blue-600 border border-blue-100" },
                { label: "Monthly Handovers", value: stats.performance.monthlySales, bg: "bg-red-50 text-[#E31E24] border border-red-100" }
              ].map((time) => (
                <div key={time.label} className={`flex items-center justify-between rounded-2xl px-5 py-4 ${time.bg}`}>
                  <span className="text-[10px] font-black uppercase tracking-wider">{time.label}</span>
                  <span className="text-sm font-black">{PKR(time.value)}</span>
                </div>
              ))}
            </div>
          </div>

        </section>
      )}

      {/* Cumulative Snapshots: Cash Register + Installment Summaries */}
      {stats && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          
          {/* Installment Summary */}
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/40">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Installment Recovery</h3>
              <button
                onClick={() => router.push("/outlet/installments/view")}
                className="flex items-center gap-1 rounded-xl bg-red-50 border border-red-100 px-3.5 py-2 text-[9px] font-black text-[#E31E24] uppercase tracking-wider transition-all hover:bg-[#E31E24] hover:text-white"
              >
                Manage <ChevronRight className="size-3" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { label: "Pending Collections", value: stats.installments.pendingInstallmentCount, bg: "bg-amber-50", text: "text-amber-500", format: "number", href: "/outlet/installments/view?category=all" },
                { label: "Impacted Customers", value: stats.installments.ordersWithPendingInstallments, bg: "bg-orange-50", text: "text-orange-500", format: "number", href: "/outlet/installments/view?category=impacted" },
                { label: "Arrears", value: stats.installments.totalArrears, bg: "bg-rose-50", text: "text-rose-500", format: "currency", href: "/outlet/installments/view?category=impacted" },
                { label: "Cumulative Remaining", value: stats.installments.cumulativeRemaining ?? stats.installments.totalRemaining, bg: "bg-violet-50", text: "text-violet-500", format: "currency", href: "/outlet/installments/view" },
              ].map((item) => (
                <div
                  key={item.label}
                  onClick={() => router.push(item.href)}
                  className={`rounded-2xl p-5 ${item.bg} cursor-pointer transition-all hover:scale-[1.02] hover:shadow-sm`}
                >
                  <p className="text-[8px] font-black uppercase tracking-wider text-gray-400 mb-1">{item.label}</p>
                  <p className={`text-lg font-black ${item.text}`}>
                    {item.format === "currency" ? PKR(item.value as number) : item.value}
                  </p>
                </div>
              ))}
            </div>

            {stats.installments.totalArrears > 0 && (
              <div
                onClick={() => router.push("/outlet/installments/view?category=impacted")}
                className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 p-4 cursor-pointer hover:bg-red-100/50 transition-colors"
              >
                <AlertTriangle className="size-4 shrink-0 text-[#E31E24]" />
                <p className="text-[10px] font-black text-[#E31E24] uppercase tracking-wider leading-relaxed">
                  PKR {stats.installments.totalArrears.toLocaleString()} in arrears require quick follow-up
                </p>
              </div>
            )}
          </div>

          {/* Cash Register Snapshot */}
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/40">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cash Register Snapshot</h3>
              <button
                onClick={() => router.push("/outlet/cash-register")}
                className="flex items-center gap-1 rounded-xl bg-red-50 border border-red-100 px-3.5 py-2 text-[9px] font-black text-[#E31E24] uppercase tracking-wider transition-all hover:bg-[#E31E24] hover:text-white"
              >
                Log Register <ChevronRight className="size-3" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-red-50 border border-red-100 px-5 py-4 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#E31E24]">Closing balance (Cash on Hand)</span>
                <span className="text-lg font-black text-[#E31E24]">{PKR(stats.financials.closing_cash)}</span>
              </div>
              {[
                { label: "Down Payments Collected", value: stats.financials.down_payments, color: "text-emerald-600", bg: "bg-emerald-50/50 border border-emerald-100/30" },
                { label: "Installments Received", value: stats.financials.installments_received, color: "text-blue-600", bg: "bg-blue-50/50 border border-blue-100/30" },
                { label: "Cash from Recovery", value: stats.financials.cash_from_recovery, color: "text-violet-600", bg: "bg-violet-50/50 border border-violet-100/30" },
                { label: "Cash from Delivery", value: stats.financials.cash_from_delivery, color: "text-cyan-600", bg: "bg-cyan-50/50 border border-cyan-100/30" },
                { label: "Total Outlet Expenses", value: stats.financials.expenses, color: "text-rose-600", bg: "bg-rose-50/50 border border-rose-100/30" },
              ].map((row) => (
                <div key={row.label} className={`flex items-center justify-between rounded-xl px-4 py-3.5 ${row.bg}`}>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{row.label}</span>
                  <span className={`text-xs font-black ${row.color}`}>{PKR(row.value)}</span>
                </div>
              ))}
            </div>
          </div>

        </section>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>

    </div>
  );
}
