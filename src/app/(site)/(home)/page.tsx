'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Cookies from 'js-cookie'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Store, Warehouse, Trophy, AlertTriangle, Activity, Users2, Landmark, Filter, CircleDollarSign, UserRound, Bell } from 'lucide-react'
import { PaymentsOverviewChart } from '@/components/Charts/payments-overview/chart'
import { useNotifications } from '../../../../contexts/NotificationContext'
import { useAuth } from '../../../../contexts/AuthContext'
import { getRoleHome } from '@/lib/roleHome'
import { apiErrorMessage } from "@/lib/apiErrors";
import { useLiveRefresh } from '@/lib/liveRefresh'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL;


type OrderStatus =
  | 'new'
  | 'pending'
  | 'in_progress'
  | 'picked'
  | 'approved'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | string

interface OrderSummary {
  id: number
  order_ref: string
  token_number: string
  customer_name: string
  whatsapp_number: string
  city: string | null
  area: string | null
  product_name: string
  total_amount: number
  advance_amount: number
  status: OrderStatus
  channel: string
  created_at: string
}

interface DeliveryStatusItem {
  id: number
  order_ref: string
  customer_name: string
  address: string
  product_name: string
  amount: number
  status: OrderStatus
  delivery_officer: {
    username: string
    full_name: string
  } | null
  updated_at: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface DashboardStats {
  totalOrders: number
  todayOrders: number
  newPendingOrders: number
  inProgressOrders: number
  deliveredOrders: number
  cancelledOrders: number
  totalCustomers: number
  activeDeliveries: number
}

const initialStats: DashboardStats = {
  totalOrders: 0,
  todayOrders: 0,
  newPendingOrders: 0,
  inProgressOrders: 0,
  deliveredOrders: 0,
  cancelledOrders: 0,
  totalCustomers: 0,
  activeDeliveries: 0,
}

interface DailyTrendPoint {
  date: string
  count: number
  totalAmount: number
  advanceAmount: number
}

interface ReportSummary {
  totalReceived: number
  totalPending: number
  totalSalesAmount?: number
  totalSalesCount?: number
  totalOrders?: number
  ordersByStatus?: Record<string, number>
  dailyTrend: DailyTrendPoint[]
}

interface DashboardExtras {
  activeEmployees: number
  todaysExpense: number
  vendorPayables: number
  customerReceivables: number
  cashRecovered: number
  onlineRecovered: number
  recoveryPercentage: number
}

interface DashboardOperations {
  pendingApprovalOrders: number | null
  approvedOrders: number | null
  pendingVerifications: number | null
  pendingDeliveries: number | null
  installmentSummary: { installments: number; unpaid: number; arrears: number; paid_pct: number } | null
  overdueRecovery: { total: number; count: number } | null
  outletPerformance: { outlet_id: number; outlet_name: string; totalOrders: number; pendingCash: number }[]
  verificationOfficers: { id: number; full_name: string; total_verifications?: number; approved_verifications?: number; score?: number }[]
  inventory: { warehouseCount: number; inStock: number; valuation: number; lowStockCount: number | null } | null
  expenses: { thisMonth: number; today: number; topCategories: { category: string; amount: number }[] } | null
  activityLogs: { id: number; action: string; details: string; created_at: string; user?: { full_name: string } | null }[]
  alerts: { severity: string; title: string; message: string; link?: string }[]
}

interface SalesFilters {
  range: 'Day' | 'Week' | 'Month' | 'Custom'
  startDate: string
  endDate: string
  channel: string
  city: string
}

const initialOperations: DashboardOperations = {
  pendingApprovalOrders: null,
  approvedOrders: null,
  pendingVerifications: null,
  pendingDeliveries: null,
  installmentSummary: null,
  overdueRecovery: null,
  outletPerformance: [],
  verificationOfficers: [],
  inventory: null,
  expenses: null,
  activityLogs: [],
  alerts: [],
}

const localDateInput = (date: Date) => {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const initialExtras: DashboardExtras = {
  activeEmployees: 0,
  todaysExpense: 0,
  vendorPayables: 0,
  customerReceivables: 0,
  cashRecovered: 0,
  onlineRecovered: 0,
  recoveryPercentage: 0,
}

const QUICK_LINKS = [
  { title: 'Outlets Management', href: '/admin/outlets', icon: Store },
  { title: 'Inventory & Warehouse', href: '/admin/inventory', icon: Warehouse },
  { title: 'Rankings & Leaderboards', href: '/admin/rankings', icon: Trophy },
  { title: 'Alerts Center', href: '/admin/alerts', icon: AlertTriangle },
  { title: 'Activity Logs', href: '/admin/activity-logs', icon: Activity },
  { title: 'HR Portal', href: '/hr/dashboard', icon: Users2 },
  { title: 'Accounts Portal', href: '/accounts/dashboard', icon: Landmark },
]

export default function Home() {
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null)
  const [extras, setExtras] = useState<DashboardExtras>(initialExtras)
  const [operations, setOperations] = useState<DashboardOperations>(initialOperations)
  const [salesFilters, setSalesFilters] = useState<SalesFilters>({
    range: 'Day',
    startDate: localDateInput(new Date()),
    endDate: localDateInput(new Date()),
    channel: '',
    city: '',
  })
  const [appliedSalesFilters, setAppliedSalesFilters] = useState<SalesFilters>({
    range: 'Day',
    startDate: localDateInput(new Date()),
    endDate: localDateInput(new Date()),
    channel: '',
    city: '',
  })
  const [filteredSales, setFilteredSales] = useState<{ amount: number; count: number } | null>(null)
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([])
  const [recentOrdersPagination, setRecentOrdersPagination] = useState<PaginationInfo | null>(null)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which data sources have loaded at least once. Until then a card shows a
  // loading skeleton (or "—" if its source failed) instead of a misleading 0.
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  // Bumped on every load with failures — drives the automatic retry below.
  const [failTick, setFailTick] = useState(0)

  const { notifications, unreadCount, hasLoaded: notificationsLoaded } = useNotifications()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const roleHome = getRoleHome(user?.role)

  useEffect(() => {
    // Non-admin roles landing on (or navigating back to) "/" must go to their
    // own dashboard instead of the admin-only Operations Dashboard.
    if (!authLoading && user && roleHome !== '/') {
      router.replace(roleHome)
    }
  }, [user, authLoading, router, roleHome])

  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchJson = async (url: string) => {
    if (!token) return null
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(await apiErrorMessage(res))
    return res.json()
  }

  const loadDashboard = async (isBackgroundRefresh = false, salesFilterOverride?: SalesFilters) => {
    if (!token) {
      setLoading(false)
      return
    }

    if (!isBackgroundRefresh) setLoading(true)

    const activeSalesFilters = salesFilterOverride || appliedSalesFilters
    const salesParams = new URLSearchParams({ dateRange: activeSalesFilters.range })
    if (activeSalesFilters.range === 'Custom') {
      if (activeSalesFilters.startDate) salesParams.set('startDate', activeSalesFilters.startDate)
      if (activeSalesFilters.endDate) salesParams.set('endDate', activeSalesFilters.endDate)
    }
    if (activeSalesFilters.channel.trim()) salesParams.set('channel', activeSalesFilters.channel.trim())
    if (activeSalesFilters.city.trim()) salesParams.set('city', activeSalesFilters.city.trim())
    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

    const sources = [
      { key: 'allOrders', url: `${BACKEND_URL}/api/orders?page=1&limit=1` },
      { key: 'todayOrders', url: `${BACKEND_URL}/api/orders?page=1&limit=1&dateRange=Day` },
      { key: 'newPendingOrders', url: `${BACKEND_URL}/api/orders?page=1&limit=1&status=new,pending` },
      { key: 'inProgressOrders', url: `${BACKEND_URL}/api/orders?page=1&limit=1&status=in_progress,picked,approved` },
      { key: 'deliveredOrders', url: `${BACKEND_URL}/api/orders?page=1&limit=1&status=delivered,completed` },
      { key: 'cancelledOrders', url: `${BACKEND_URL}/api/orders?page=1&limit=1&status=cancelled` },
      { key: 'customersRes', url: `${BACKEND_URL}/api/customers?page=1&limit=1` },
      { key: 'recentOrdersRes', url: `${BACKEND_URL}/api/orders?page=1&limit=10&sortBy=updated_at&sortDir=desc` },
      { key: 'deliveryStatusRes', url: `${BACKEND_URL}/api/orders/delivery-status` },
      { key: 'reportSummaryRes', url: `${BACKEND_URL}/api/reports/summary?dateRange=Month` },
      { key: 'accountsSummaryRes', url: `${BACKEND_URL}/api/accounts/dashboard-summary` },
      { key: 'channelRecoveryRes', url: `${BACKEND_URL}/api/accounts/recovery-analytics/channel-wise` },
      { key: 'employeesRes', url: `${BACKEND_URL}/api/hr/employees` },
      { key: 'approvalOrdersRes', url: `${BACKEND_URL}/api/orders?page=1&limit=1&status=pending` },
      { key: 'approvedOrdersRes', url: `${BACKEND_URL}/api/orders?page=1&limit=1&status=approved` },
      { key: 'pendingVerificationsRes', url: `${BACKEND_URL}/api/orders/verification-pending?page=1&limit=1` },
      { key: 'pendingDeliveriesRes', url: `${BACKEND_URL}/api/orders/delivery-pending?page=1&limit=1` },
      { key: 'installmentSummaryRes', url: `${BACKEND_URL}/api/accounts/monthly-installments/month?month=${currentMonth}` },
      { key: 'overdueRecoveryRes', url: `${BACKEND_URL}/api/accounts/aging` },
      { key: 'outletPerformanceRes', url: `${BACKEND_URL}/api/admin-panel/outlets/performance` },
      { key: 'rankingsRes', url: `${BACKEND_URL}/api/admin-panel/rankings` },
      { key: 'warehouseStockRes', url: `${BACKEND_URL}/api/accounts/stock/warehouse` },
      { key: 'stockHealthRes', url: `${BACKEND_URL}/api/accounts/stock/health-alerts` },
      { key: 'expenseSummaryRes', url: `${BACKEND_URL}/api/accounts/expenses/summary` },
      { key: 'activityLogsRes', url: `${BACKEND_URL}/api/security-logs?page=1&limit=8` },
      { key: 'alertsRes', url: `${BACKEND_URL}/api/accounts/alerts` },
      { key: 'filteredSalesRes', url: `${BACKEND_URL}/api/reports/summary?${salesParams.toString()}` },
    ] as const

    // Each card/section is independent — one endpoint hiccuping (a deploy, a
    // transient network blip) must not blank out the whole dashboard.
    const settled = await Promise.allSettled(sources.map((s) => fetchJson(s.url)))
    const results: Record<string, any> = {}
    let failedCount = 0
    const loadedNow: Record<string, boolean> = {}
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        loadedNow[sources[i].key] = true
      }
      if (r.status === 'fulfilled') {
        results[sources[i].key] = r.value
      } else {
        failedCount += 1
        console.error(`Dashboard source failed: ${sources[i].key}`, r.reason)
      }
    })

    if (failedCount > 0) setFailTick((n) => n + 1)
    setError(
      failedCount === 0
        ? null
        : failedCount === sources.length
          ? 'Failed to load dashboard data'
          : `${failedCount} of ${sources.length} dashboard sections failed to refresh — showing last known values for those.`
    )

    const {
      allOrders, todayOrders, newPendingOrders, inProgressOrders,
      deliveredOrders, cancelledOrders, customersRes, recentOrdersRes,
      deliveryStatusRes, reportSummaryRes, accountsSummaryRes,
      channelRecoveryRes, employeesRes,
      approvalOrdersRes, approvedOrdersRes, pendingVerificationsRes, pendingDeliveriesRes,
      installmentSummaryRes, overdueRecoveryRes, outletPerformanceRes, rankingsRes,
      warehouseStockRes, stockHealthRes, expenseSummaryRes, activityLogsRes, alertsRes,
      filteredSalesRes,
    } = results

    setStats((prev) => ({
      totalOrders: allOrders?.data?.pagination?.total ?? prev.totalOrders,
      todayOrders: todayOrders?.data?.pagination?.total ?? prev.todayOrders,
      newPendingOrders: newPendingOrders?.data?.pagination?.total ?? prev.newPendingOrders,
      inProgressOrders: inProgressOrders?.data?.pagination?.total ?? prev.inProgressOrders,
      deliveredOrders: deliveredOrders?.data?.pagination?.total ?? prev.deliveredOrders,
      cancelledOrders: cancelledOrders?.data?.pagination?.total ?? prev.cancelledOrders,
      totalCustomers: customersRes?.data?.pagination?.total ?? prev.totalCustomers,
      activeDeliveries: Array.isArray(deliveryStatusRes?.data)
        ? deliveryStatusRes.data.length
        : prev.activeDeliveries,
    }))

    if (recentOrdersRes) {
      setRecentOrders(recentOrdersRes?.data?.orders ?? [])
      setRecentOrdersPagination(recentOrdersRes?.data?.pagination ?? null)
    }
    if (deliveryStatusRes) {
      setDeliveryStatus(Array.isArray(deliveryStatusRes?.data) ? deliveryStatusRes.data : [])
    }

    const overview = reportSummaryRes?.data?.overview
    const dailyTrend = reportSummaryRes?.data?.breakdown?.dailyTrend
    if (overview) {
      setReportSummary({
        totalReceived: overview.totalReceived ?? 0,
        totalPending: overview.totalPending ?? 0,
        totalSalesAmount: overview.totalSalesAmount ?? 0,
        totalSalesCount: overview.totalSalesCount ?? 0,
        totalOrders: overview.totalOrders ?? 0,
        ordersByStatus: overview.ordersByStatus || {},
        dailyTrend: Array.isArray(dailyTrend) ? dailyTrend : [],
      })
    }

    if (accountsSummaryRes || channelRecoveryRes || employeesRes) {
      const accountsSummary = accountsSummaryRes?.data
      const byChannel = channelRecoveryRes?.data?.byChannel ?? []
      const employees = Array.isArray(employeesRes?.employees) ? employeesRes.employees : null
      setExtras((prev) => ({
        activeEmployees: employees ? employees.filter((e: any) => e.portal_active).length : prev.activeEmployees,
        todaysExpense: accountsSummary?.todaysExpense ?? prev.todaysExpense,
        vendorPayables: accountsSummary?.vendorPayables ?? prev.vendorPayables,
        customerReceivables: accountsSummary?.customerReceivables ?? prev.customerReceivables,
        cashRecovered: byChannel.find((c: any) => c.channel === 'Cash')?.amount ?? prev.cashRecovered,
        onlineRecovered: byChannel.find((c: any) => c.channel === 'Online')?.amount ?? prev.onlineRecovered,
        recoveryPercentage: channelRecoveryRes?.data?.overallRecoveryPercentage ?? prev.recoveryPercentage,
      }))
    }

    if (filteredSalesRes?.success) {
      setFilteredSales({
        amount: filteredSalesRes.data?.overview?.totalSalesAmount ?? 0,
        count: filteredSalesRes.data?.overview?.totalSalesCount ?? 0,
      })
    }

    const stockSummary = warehouseStockRes?.data?.summary || []
    const expenseSummary = expenseSummaryRes?.summary
    const agingItems = overdueRecoveryRes?.data?.items || []
    setOperations((prev) => ({
      pendingApprovalOrders: approvalOrdersRes?.data?.pagination?.total ?? prev.pendingApprovalOrders,
      approvedOrders: approvedOrdersRes?.data?.pagination?.total ?? prev.approvedOrders,
      pendingVerifications: pendingVerificationsRes?.data?.pagination?.total ?? prev.pendingVerifications,
      pendingDeliveries: pendingDeliveriesRes?.data?.pagination?.total ?? prev.pendingDeliveries,
      installmentSummary: installmentSummaryRes?.success
        ? installmentSummaryRes.data?.summary ?? prev.installmentSummary
        : prev.installmentSummary,
      overdueRecovery: overdueRecoveryRes?.success
        ? { total: overdueRecoveryRes.data?.total ?? 0, count: agingItems.length }
        : prev.overdueRecovery,
      outletPerformance: outletPerformanceRes?.success
        ? (outletPerformanceRes.data || []).filter((row: any) => row.type !== 'warehouse').sort((a: any, b: any) => b.totalOrders - a.totalOrders).slice(0, 5)
        : prev.outletPerformance,
      verificationOfficers: rankingsRes?.success
        ? (rankingsRes.data?.verification || []).slice(0, 5)
        : prev.verificationOfficers,
      inventory: warehouseStockRes?.success
        ? {
          warehouseCount: warehouseStockRes.data?.warehouses?.length ?? 0,
          inStock: stockSummary.reduce((sum: number, item: any) => sum + (item.inStock || 0), 0),
          valuation: stockSummary.reduce((sum: number, item: any) => sum + (item.valuation || 0), 0),
          lowStockCount: stockHealthRes?.success ? stockHealthRes.data?.lowStock?.length ?? 0 : null,
        }
        : prev.inventory,
      expenses: expenseSummary
        ? {
          thisMonth: expenseSummary.thisMonth ?? 0,
          today: expenseSummary.today ?? 0,
          topCategories: (expenseSummary.topCategories || []).slice(0, 4),
        }
        : prev.expenses,
      activityLogs: activityLogsRes?.success ? activityLogsRes.logs || [] : prev.activityLogs,
      alerts: alertsRes?.success ? alertsRes.data?.alerts || [] : prev.alerts,
    }))

    setLoaded((prev) => ({ ...prev, ...loadedNow }))
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()

    // Belt-and-suspenders fallback only — the live refresh below is what
    // actually keeps this live; this just guards against a missed/dropped event.
    const fallbackInterval = setInterval(() => {
      if (!document.hidden) loadDashboard(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(fallbackInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Live updates: refresh when something actually changes (new order, status change,
  // delivery/recovery activity — `new_notification` is broadcast admin-wide across that
  // lifecycle), and after the connection / network / tab comes back. A full refresh is 13
  // API calls, so at most one per minute and none while the tab is hidden.
  useLiveRefresh(() => loadDashboard(true), { events: ['new_notification'] })

  // Some or all sections failed (server restarting, laptop waking up, network blip):
  // try again on our own — 10s, 20s, 40s, then every minute — instead of leaving
  // "Failed to load" up until a socket event or a manual refresh.
  const retryAttempt = useRef(0)
  useEffect(() => {
    if (!error) {
      retryAttempt.current = 0
      return
    }
    const delay = Math.min(60 * 1000, 10 * 1000 * 2 ** retryAttempt.current)
    const t = setTimeout(() => {
      retryAttempt.current += 1
      if (!document.hidden) loadDashboard(true)
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, failTick])

  const paymentsChartData = useMemo(() => {
    const trend = reportSummary?.dailyTrend ?? []
    if (trend.length === 0) {
      return { received: [], due: [] }
    }

    return {
      received: trend.map((d) => ({
        x: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        y: d.advanceAmount,
      })),
      due: trend.map((d) => ({
        x: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        y: Math.max(0, d.totalAmount - d.advanceAmount),
      })),
    }
  }, [reportSummary])

  // Don't flash the admin Operations Dashboard while auth resolves or while
  // a non-admin role is being redirected to its own dashboard.
  if (authLoading || (user && roleHome !== '/')) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-dark dark:text-white">
            Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Live overview of orders, customers, deliveries and collections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            Total Orders:{' '}
            <strong>{loaded.allOrders ? stats.totalOrders.toLocaleString() : <InlineLoading failed={!loading} />}</strong>
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            Today:{' '}
            <strong>{loaded.todayOrders ? stats.todayOrders.toLocaleString() : <InlineLoading failed={!loading} />}</strong>
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-dark-3 dark:text-gray-200">
            Unread Notifications:{' '}
            <strong>{notificationsLoaded ? unreadCount.toLocaleString() : <InlineLoading />}</strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard
          title="New / Pending Orders"
          value={loaded.newPendingOrders ? stats.newPendingOrders : null}
          loading={loading}
          subtitle="Awaiting verification or processing"
          tone="primary"
        />
        <DashboardCard
          title="In Progress"
          value={loaded.inProgressOrders ? stats.inProgressOrders : null}
          loading={loading}
          subtitle="Picked / approved / being worked"
          tone="info"
        />
        <DashboardCard
          title="Delivered / Completed"
          value={loaded.deliveredOrders ? stats.deliveredOrders : null}
          loading={loading}
          subtitle="Successfully closed orders"
          tone="success"
        />
        <DashboardCard
          title="Cancelled"
          value={loaded.cancelledOrders ? stats.cancelledOrders : null}
          loading={loading}
          subtitle="Orders cancelled by team"
          tone="danger"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Pending Approval Orders" value={operations.pendingApprovalOrders} loading={loading} subtitle="Waiting for admin approval" tone="danger" />
        <DashboardCard title="Approved Orders" value={operations.approvedOrders} loading={loading} subtitle="Approved and awaiting next steps" tone="info" />
        <DashboardCard title="Pending Verifications" value={operations.pendingVerifications} loading={loading} subtitle="In verification queue" tone="primary" />
        <DashboardCard title="Pending Deliveries" value={operations.pendingDeliveries} loading={loading} subtitle="Approved / picked for delivery" tone="success" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <DashboardCard
          title="Total Collected (This Month)"
          value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalReceived ?? 0 : null}
          loading={loading}
          subtitle="Advance + installments + cash sales received"
          tone="success"
          isCurrency
        />
        <DashboardCard
          title="Total Sales (Delivered This Month)"
          value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalSalesAmount ?? 0 : null}
          loading={loading}
          subtitle="Gross sales of orders delivered this month"
          tone="primary"
          isCurrency
        />
        <DashboardCard
          title="Pending Receivables (This Month)"
          value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalPending ?? 0 : null}
          loading={loading}
          subtitle="Still owed on orders delivered this month"
          tone="danger"
          isCurrency
        />
      </div>

      <div className="grid gap-5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <DashboardCard title="Active Employees" value={loaded.employeesRes ? extras.activeEmployees : null} loading={loading} subtitle="Portal-active staff" tone="info" />
        <DashboardCard title="Cash Recovered (Month)" value={loaded.channelRecoveryRes ? extras.cashRecovered : null} loading={loading} subtitle="Cash-channel installments" tone="success" isCurrency />
        <DashboardCard title="Online Recovered (Month)" value={loaded.channelRecoveryRes ? extras.onlineRecovered : null} loading={loading} subtitle="Online-channel installments" tone="info" isCurrency />
        <DashboardCard title="Today's Expenses" value={loaded.accountsSummaryRes ? extras.todaysExpense : null} loading={loading} subtitle="Head-office + outlet vouchers" tone="danger" isCurrency />
        <DashboardCard title="Vendor Payables" value={loaded.accountsSummaryRes ? extras.vendorPayables : null} loading={loading} subtitle="Outstanding vendor balance" tone="danger" isCurrency />
        <DashboardCard title="Customer Receivables" value={loaded.accountsSummaryRes ? extras.customerReceivables : null} loading={loading} subtitle="Outstanding customer balance" tone="primary" isCurrency />
      </div>

      <section className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white"><CircleDollarSign className="size-4 text-[#ff3d3d]" /> Sales by amount & orders</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Delivered sales for the selected period, with channel and city filters.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {appliedSalesFilters.range === 'Custom'
              ? `${appliedSalesFilters.startDate || 'Any date'} — ${appliedSalesFilters.endDate || 'Any date'}`
              : appliedSalesFilters.range === 'Day' ? 'Today' : `This ${appliedSalesFilters.range.toLowerCase()}`}
          </span>
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Date range
            <select
              value={salesFilters.range}
              onChange={(event) => setSalesFilters((current) => ({ ...current, range: event.target.value as SalesFilters['range'] }))}
              className="mt-1 block w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              <option value="Day">Today</option><option value="Week">Last 7 days</option><option value="Month">This month</option><option value="Custom">Custom dates</option>
            </select>
          </label>
          {salesFilters.range === 'Custom' && (
            <>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                From
                <input type="date" value={salesFilters.startDate} onChange={(event) => setSalesFilters((current) => ({ ...current, startDate: event.target.value }))} className="mt-1 block w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 dark:text-white" />
              </label>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                To
                <input type="date" value={salesFilters.endDate} onChange={(event) => setSalesFilters((current) => ({ ...current, endDate: event.target.value }))} className="mt-1 block w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 dark:text-white" />
              </label>
            </>
          )}
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Channel
            <input value={salesFilters.channel} onChange={(event) => setSalesFilters((current) => ({ ...current, channel: event.target.value }))} placeholder="All channels" className="mt-1 block w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none placeholder:text-gray-400 focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            City
            <input value={salesFilters.city} onChange={(event) => setSalesFilters((current) => ({ ...current, city: event.target.value }))} placeholder="All cities" className="mt-1 block w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-dark outline-none placeholder:text-gray-400 focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 dark:text-white" />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-40 rounded-lg bg-gray-50 px-4 py-3 dark:bg-dark-3">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Delivered sales amount</p>
              <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-300">{filteredSales ? `PKR ${filteredSales.amount.toLocaleString('en-PK')}` : <InlineLoading failed={!loading} className="h-5 w-24" />}</p>
            </div>
            <div className="min-w-40 rounded-lg bg-gray-50 px-4 py-3 dark:bg-dark-3">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Sales orders</p>
              <p className="mt-1 font-bold text-dark dark:text-white">{filteredSales ? filteredSales.count.toLocaleString() : <InlineLoading failed={!loading} className="h-5 w-16" />}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAppliedSalesFilters(salesFilters)
              void loadDashboard(true, salesFilters)
            }}
            disabled={Boolean(salesFilters.range === 'Custom' && salesFilters.startDate && salesFilters.endDate && salesFilters.startDate > salesFilters.endDate)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff3d3d] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e93636] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Filter className="size-3.5" /> Apply filters
          </button>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Installments (This Month)" value={operations.installmentSummary?.installments ?? null} loading={loading} subtitle="Scheduled installment count" tone="info" />
        <DashboardCard title="Pending Recoveries" value={operations.overdueRecovery?.total ?? null} loading={loading} subtitle={`${operations.overdueRecovery?.count ?? 0} overdue installment(s)`} tone="danger" isCurrency />
        <DashboardCard title="Recovery Percentage" value={loaded.channelRecoveryRes ? extras.recoveryPercentage : null} loading={loading} subtitle="Recovered vs due this month" tone="success" valueSuffix="%" />
        <DashboardCard title="Monthly Sales Count" value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalSalesCount ?? 0 : null} loading={loading} subtitle="Delivered orders this month" tone="primary" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white"><Store className="size-4 text-[#ff3d3d]" /> Outlet Performance</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Top outlets by order volume</p></div>
            <Link href="/admin/outlets" className="text-xs font-semibold text-[#ff3d3d] hover:underline">View outlets</Link>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-dark"><tr><th className="py-2">Outlet</th><th className="py-2 text-right">Orders</th><th className="py-2 text-right">Pending cash</th><th className="py-2 text-right">Status</th></tr></thead>
              <tbody>
                {operations.outletPerformance.map((outlet) => <tr key={outlet.outlet_id} className="border-t border-stroke dark:border-dark-3"><td className="py-2.5 font-semibold text-dark dark:text-white">{outlet.outlet_name}</td><td className="py-2.5 text-right tabular-nums">{outlet.totalOrders.toLocaleString()}</td><td className="py-2.5 text-right tabular-nums">PKR {outlet.pendingCash.toLocaleString('en-PK')}</td><td className="py-2.5 text-right text-gray-500">{outlet.totalOrders ? 'Active' : 'No orders'}</td></tr>)}
                {!operations.outletPerformance.length && <tr><td colSpan={4} className="py-6 text-center text-gray-400">{loading ? 'Loading outlet performance…' : 'No outlet data available.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white"><UserRound className="size-4 text-[#ff3d3d]" /> Officer Performance</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Verification team rankings this month</p></div>
            <Link href="/admin/rankings" className="text-xs font-semibold text-[#ff3d3d] hover:underline">View rankings</Link>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-dark"><tr><th className="py-2">Officer</th><th className="py-2 text-right">Verified</th><th className="py-2 text-right">Approved</th><th className="py-2 text-right">Score</th></tr></thead>
              <tbody>
                {operations.verificationOfficers.map((officer) => <tr key={officer.id} className="border-t border-stroke dark:border-dark-3"><td className="py-2.5 font-semibold text-dark dark:text-white">{officer.full_name}</td><td className="py-2.5 text-right tabular-nums">{officer.total_verifications ?? 0}</td><td className="py-2.5 text-right tabular-nums text-emerald-600">{officer.approved_verifications ?? 0}</td><td className="py-2.5 text-right tabular-nums">{Math.round(officer.score ?? 0).toLocaleString()}</td></tr>)}
                {!operations.verificationOfficers.length && <tr><td colSpan={4} className="py-6 text-center text-gray-400">{loading ? 'Loading officer performance…' : 'No officer performance data available.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard title="Inventory In Stock" value={operations.inventory?.inStock ?? null} loading={loading} subtitle={`${operations.inventory?.warehouseCount ?? 0} central warehouse(s)`} tone="info" />
        <DashboardCard title="Low Stock Items" value={operations.inventory?.lowStockCount ?? null} loading={loading} subtitle="Items below configured thresholds" tone="danger" />
        <DashboardCard title="Inventory Valuation" value={operations.inventory?.valuation ?? null} loading={loading} subtitle="Central warehouse purchase value" tone="success" isCurrency />
      </div>

      {operations.expenses && (
        <section className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-base font-semibold text-dark dark:text-white">Expense Summary</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Approved expenses by category</p></div>
            <Link href="/accounts/expenses" className="text-xs font-semibold text-[#ff3d3d] hover:underline">View expenses</Link>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-dark-3"><p className="text-[11px] text-gray-500">Today</p><p className="mt-1 font-bold text-dark dark:text-white">PKR {operations.expenses.today.toLocaleString('en-PK')}</p></div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-dark-3"><p className="text-[11px] text-gray-500">This month</p><p className="mt-1 font-bold text-dark dark:text-white">PKR {operations.expenses.thisMonth.toLocaleString('en-PK')}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">{operations.expenses.topCategories.map((category) => <span key={category.category || 'other'} className="rounded-full bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{category.category || 'Other'} · PKR {category.amount.toLocaleString('en-PK')}</span>)}</div>
        </section>
      )}

      <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="mb-4 text-base font-semibold text-dark dark:text-white">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-2 rounded-xl border border-stroke bg-gray-50 p-3 text-center transition hover:border-[#ff3d3d] hover:bg-[#ff3d3d]/5 dark:border-dark-3 dark:bg-dark-3 dark:hover:border-[#ff3d3d]"
            >
              <link.icon className="size-5 text-[#ff3d3d]" />
              <span className="text-[11px] font-medium leading-tight text-dark dark:text-white">{link.title}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-dark dark:text-white">
                  Orders & Payments Overview
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Daily advance collected vs remaining order value, this month.
                </p>
              </div>
            </div>
            {!loaded.reportSummaryRes ? (
              loading ? (
                <div className="flex h-[310px] items-end gap-3 px-2" role="status" aria-label="Loading chart">
                  {[40, 65, 50, 80, 35, 60, 45, 70, 55].map((h, i) => (
                    <div key={i} className="flex-1 animate-pulse rounded-t bg-gray-100 dark:bg-dark-3" style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              ) : (
                <div className="flex h-[310px] items-center justify-center text-sm text-gray-400">
                  Could not load this chart. It will retry automatically.
                </div>
              )
            ) : paymentsChartData.received.length === 0 ? (
              <div className="flex h-[310px] items-center justify-center text-sm text-gray-400">
                No collections recorded yet this month.
              </div>
            ) : (
              <PaymentsOverviewChart data={paymentsChartData} />
            )}
          </div>

          <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-dark dark:text-white">
                  Latest Orders
                </h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  LIFO: Latest First
                </span>
              </div>
              <Link
                href="/orders-list"
                className="text-xs font-medium text-[#ff3d3d] hover:underline"
              >
                View all orders
              </Link>
            </div>

            <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-3 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2">S.No</th><th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Advance</th>
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                        Loading latest orders...
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order, idx) => (
                      <tr
                        key={order.id}
                        className="border-b border-stroke last:border-0 dark:border-dark-3"
                      ><td className="px-3 py-2 text-gray-500 tabular-nums">{idx + 1}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col">
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-xs font-semibold text-[#ff3d3d] hover:underline"
                            >
                              {order.order_ref}
                            </Link>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              Token: {order.token_number}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {new Date(order.created_at).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-dark dark:text-white">
                              {order.customer_name}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {order.whatsapp_number}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                              {[order.area, order.city].filter(Boolean).join(', ') || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top min-w-[150px]">
                          <span className="text-xs text-gray-700 dark:text-gray-200 break-words">
                            {order.product_name}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <span className="text-xs font-semibold text-dark dark:text-white">
                            Rs. {order.advance_amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {order.channel}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {recentOrdersPagination && (
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>
                  Showing page {recentOrdersPagination.page} of{' '}
                  {recentOrdersPagination.totalPages}
                </span>
                <span>Total: {recentOrdersPagination.total.toLocaleString()} orders</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-dark dark:text-white">
                Live Deliveries
              </h2>
              <Link
                href="/delivered-orders"
                className="text-xs font-medium text-[#ff3d3d] hover:underline"
              >
                View history
              </Link>
            </div>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              Orders currently assigned to delivery officers and their latest status.
            </p>
            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {loading && deliveryStatus.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  Loading live deliveries...
                </p>
              ) : deliveryStatus.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  No active deliveries right now.
                </p>
              ) : (
                deliveryStatus.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-dark dark:text-white">
                          {item.order_ref}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {item.customer_name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">
                          {item.address}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                          Rs. {item.amount.toLocaleString()}
                        </p>
                        <StatusBadge status={item.status} />
                        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                          Updated:{' '}
                          {new Date(item.updated_at).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    {item.delivery_officer && (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        By{' '}
                        <span className="font-medium">
                          {item.delivery_officer.full_name} ({item.delivery_officer.username})
                        </span>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white"><Bell className="size-4 text-rose-500" /> Real-time Alerts</h2>
              <Link href="/admin/alerts" className="text-xs font-medium text-[#ff3d3d] hover:underline">View all</Link>
            </div>
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {operations.alerts.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading alerts…' : 'No active alerts.'}</p>
              ) : operations.alerts.slice(0, 5).map((alert, index) => {
                const content = <div className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3"><p className="font-semibold text-dark dark:text-white">{alert.title}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{alert.message}</p><span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${alert.severity === 'serious' ? 'bg-rose-100 text-rose-700' : alert.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{alert.severity}</span></div>
                return alert.link ? <Link key={`${alert.title}-${index}`} href={alert.link}>{content}</Link> : <div key={`${alert.title}-${index}`}>{content}</div>
              })}
            </div>
          </div>

          <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-dark dark:text-white">
                Latest Notifications
              </h2>
              <Link
                href="/notifications"
                className="text-xs font-medium text-[#ff3d3d] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {notifications.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                  No notifications yet.
                </p>
              ) : (
                notifications.slice(0, 6).map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3"
                  >
                    <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#ff3d3d]" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-dark dark:text-white">
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <span className="rounded-full bg-[#ff3d3d] px-2 py-0.5 text-[10px] font-semibold text-white">
                        New
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="mb-3 flex items-center justify-between">
          <div><h2 className="flex items-center gap-2 text-base font-semibold text-dark dark:text-white"><Activity className="size-4 text-[#ff3d3d]" /> Live Activity Logs</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Latest system activity, refreshed with dashboard updates.</p></div>
          <Link href="/admin/activity-logs" className="text-xs font-medium text-[#ff3d3d] hover:underline">View all</Link>
        </div>
        {operations.activityLogs.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading activity…' : 'No recent activity found.'}</p>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-gray-400 dark:bg-gray-dark"><tr><th className="py-2">User</th><th className="py-2">Action</th><th className="py-2">Details</th><th className="py-2 text-right">Time</th></tr></thead>
              <tbody>
                {operations.activityLogs.map((log) => <tr key={log.id} className="border-t border-stroke dark:border-dark-3"><td className="py-2.5 font-semibold text-dark dark:text-white">{log.user?.full_name || 'System'}</td><td className="py-2.5"><span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700 dark:bg-dark-3 dark:text-gray-200">{log.action}</span></td><td className="max-w-md truncate py-2.5 text-gray-500" title={log.details}>{log.details}</td><td className="whitespace-nowrap py-2.5 text-right text-gray-400">{new Date(log.created_at).toLocaleString()}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const value = (status || '').toLowerCase()

  let label = value
  let className =
    'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold '

  switch (value) {
    case 'new':
      label = 'New'
      className += 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      break
    case 'pending':
      label = 'Pending'
      className += 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
      break
    case 'in_progress':
    case 'in-progress':
      label = 'In Progress'
      className += 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
      break
    case 'picked':
      label = 'Picked'
      className += 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
      break
    case 'approved':
      label = 'Approved'
      className += 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
      break
    case 'completed':
    case 'delivered':
      label = value === 'completed' ? 'Completed' : 'Delivered'
      className += 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
      break
    case 'cancelled':
      label = 'Cancelled'
      className += 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      break
    case 'rejected':
      label = 'Rejected'
      className += 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
      break
    default:
      label = status || 'Unknown'
      className += 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }

  return <span className={className}>{label}</span>
}

interface DashboardCardProps {
  title: string
  /** null = not loaded yet (skeleton while loading, "—" if it failed). */
  value: number | null
  loading?: boolean
  subtitle: string
  tone?: 'primary' | 'success' | 'danger' | 'info'
  isCurrency?: boolean
  valueSuffix?: string
}

// Shimmer while a figure is loading; "—" (not a fake 0) if it failed to load.
function InlineLoading({ failed, className = 'h-4 w-10' }: { failed?: boolean; className?: string }) {
  if (failed) {
    return <span title="Could not load this figure" className="text-gray-400">—</span>
  }
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-pulse rounded bg-gray-200 align-middle dark:bg-dark-3 ${className}`}
    />
  )
}

function DashboardCard({ title, value, loading = false, subtitle, tone = 'primary', isCurrency = false, valueSuffix = '' }: DashboardCardProps) {
  const toneClasses: Record<
    NonNullable<DashboardCardProps['tone']>,
    { badge: string; value: string }
  > = {
    primary: {
      badge: 'bg-[#ff3d3d]/10 text-[#ff3d3d]',
      value: 'text-[#ff3d3d]',
    },
    success: {
      badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      value: 'text-emerald-600 dark:text-emerald-300',
    },
    danger: {
      badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      value: 'text-red-600 dark:text-red-300',
    },
    info: {
      badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      value: 'text-blue-600 dark:text-blue-300',
    },
  }

  const tones = toneClasses[tone]

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div>
        <p className="pr-10 text-xs font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <p className={`mt-2 text-lg sm:text-xl lg:text-[22px] font-bold tracking-tight ${tones.value} break-words`}>
          {value === null ? (
            <InlineLoading failed={!loading} className="h-7 w-28" />
          ) : isCurrency ? `PKR ${value.toLocaleString('en-PK')}` : `${value.toLocaleString()}${valueSuffix}`}
        </p>
      </div>
      <span className={`absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones.badge}`}>
        Live
      </span>
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  )
}
