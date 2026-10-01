'use client'

import { useEffect, useMemo, useState } from 'react'
import Cookies from 'js-cookie'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Store, Warehouse, Trophy, AlertTriangle, Activity, Users2, Landmark } from 'lucide-react'
import { PaymentsOverviewChart } from '@/components/Charts/payments-overview/chart'
import { useNotifications } from '../../../../contexts/NotificationContext'
import { useAuth } from '../../../../contexts/AuthContext'
import { getRoleHome } from '@/lib/roleHome'
import { apiErrorMessage } from "@/lib/apiErrors";

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
  dailyTrend: DailyTrendPoint[]
}

interface DashboardExtras {
  activeEmployees: number
  todaysExpense: number
  vendorPayables: number
  customerReceivables: number
  cashRecovered: number
  onlineRecovered: number
}

const initialExtras: DashboardExtras = {
  activeEmployees: 0,
  todaysExpense: 0,
  vendorPayables: 0,
  customerReceivables: 0,
  cashRecovered: 0,
  onlineRecovered: 0,
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
  const [recentOrders, setRecentOrders] = useState<OrderSummary[]>([])
  const [recentOrdersPagination, setRecentOrdersPagination] = useState<PaginationInfo | null>(null)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which data sources have loaded at least once. Until then a card shows a
  // loading skeleton (or "—" if its source failed) instead of a misleading 0.
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})

  const { notifications, unreadCount, socket, hasLoaded: notificationsLoaded } = useNotifications()
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

  const loadDashboard = async (isBackgroundRefresh = false) => {
    if (!token) {
      setLoading(false)
      return
    }

    if (!isBackgroundRefresh) setLoading(true)

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
      }))
    }

    setLoaded((prev) => ({ ...prev, ...loadedNow }))
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()

    // Belt-and-suspenders fallback only — the socket listener below is what
    // actually keeps this live; this just guards against a missed/dropped event.
    const fallbackInterval = setInterval(() => {
      loadDashboard(true)
    }, 5 * 60 * 1000)

    return () => clearInterval(fallbackInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Live updates: refresh dashboard data the moment something actually
  // changes (new order, status change, delivery/recovery activity, etc.)
  // instead of blindly re-polling every few seconds. `new_notification` is
  // already broadcast admin-wide by notifyAdmins() across the order/delivery/
  // recovery lifecycle, so it's a reliable "something changed" signal.
  useEffect(() => {
    if (!socket) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const handleLiveUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => loadDashboard(true), 2000)
    }

    socket.on('new_notification', handleLiveUpdate)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      socket.off('new_notification', handleLiveUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

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

      <div className="grid gap-5 md:grid-cols-3">
        <DashboardCard
          title="Total Collected (This Month)"
          value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalReceived ?? 0 : null}
          loading={loading}
          subtitle="Advance + installment payments received"
          tone="success"
          isCurrency
        />
        <DashboardCard
          title="Total Sales (Delivered This Month)"
          value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalSalesAmount ?? 0 : null}
          loading={loading}
          subtitle="Sum of delivered order amounts"
          tone="primary"
          isCurrency
        />
        <DashboardCard
          title="Pending Receivables (This Month)"
          value={loaded.reportSummaryRes && reportSummary ? reportSummary.totalPending ?? 0 : null}
          loading={loading}
          subtitle="Outstanding amount across this month's orders"
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
                    <th className="px-3 py-2">Order</th>
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
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                        Loading latest orders...
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                        No orders found.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-stroke last:border-0 dark:border-dark-3"
                      >
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

function DashboardCard({ title, value, loading = false, subtitle, tone = 'primary', isCurrency = false }: DashboardCardProps) {
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
          ) : isCurrency ? `PKR ${value.toLocaleString('en-PK')}` : value.toLocaleString()}
        </p>
      </div>
      <span className={`absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones.badge}`}>
        Live
      </span>
      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  )
}

