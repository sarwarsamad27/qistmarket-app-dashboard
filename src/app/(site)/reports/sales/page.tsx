'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { ClipboardCheck, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react'
import OutletSelector from '@/components/common/OutletSelector'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface SalesSummary {
  totalOrders: number
  totalGrossAmount: number
  totalReceived: number
  totalInstallmentsReceived: number
  totalCashSalesReceived: number
}

interface InstallmentCollection {
  id: string
  order_ref: string
  customer_name: string
  month_number: number
  month_label: string
  amount_collected: number
  payment_date: string
  payment_method: string
}

export default function GlobalSalesReportPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any | null>(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [outletId, setOutletId] = useState('all')
  const token = useMemo(() => Cookies.get('auth_token'), [])

  // Rendering thousands of rows at once freezes the page after the data arrives,
  // so each table shows a page of rows and grows on demand.
  const PAGE_SIZE = 100
  const [visibleOrders, setVisibleOrders] = useState(PAGE_SIZE)
  const [visibleCollections, setVisibleCollections] = useState(PAGE_SIZE)

  useEffect(() => {
    if (!token) return
    // Abort the previous request when filters change, so a slow older response
    // can't overwrite (or keep the spinner on for) the latest one.
    const controller = new AbortController()

    const fetchSales = async () => {
      setLoading(true)
      try {
        let url = `${BACKEND_URL}/api/outlet-reports/sales?outletId=${outletId}`
        if (dateRange.start) url += `&startDate=${dateRange.start}`
        if (dateRange.end) url += `&endDate=${dateRange.end}`

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        })
        const json = await res.json()
        if (json.success) {
          setData(json.data)
          setVisibleOrders(PAGE_SIZE)
          setVisibleCollections(PAGE_SIZE)
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        console.error('Failed to fetch sales summary:', err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchSales()
    return () => controller.abort()
  }, [dateRange, outletId, token])

  return (
    <>
      <Breadcrumb pageName="Global Sales Report" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">Nationwide Sales Analysis</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track orders and collections across all outlets.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <OutletSelector selectedId={outletId} onSelect={setOutletId} />
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-xs outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
            <span className="text-gray-400">to</span>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-xs outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
        </div>
      </div>

      {loading && data && (
        <div className="mb-3 text-xs font-medium text-gray-400">Refreshing…</div>
      )}

      {loading && !data ? <Loader /> : (
        data && (
          <>
            {/* ─── STAT CARDS ─── */}
            {(() => {
              const summary: any = data.summary || {};
              const installmentReceived: number = summary.totalInstallmentsReceived ?? 0;
              const cashSalesReceived: number = summary.totalCashSalesReceived ?? 0;
              const totalAmountReceive = installmentReceived + cashSalesReceived;

              return (
                <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <StatCard label="Total Orders" value={summary.totalOrders || data.orders.length} icon={ClipboardCheck} color="blue" />
                  <StatCard label="Gross Sales" value={summary.totalGrossAmount || 0} icon={DollarSign} color="emerald" isCurrency />
                  <StatCard label="Total Installment Receiving" value={installmentReceived} icon={TrendingUp} color="purple" isCurrency />
                  <StatCard label="Total Cash Sale" value={cashSalesReceived} icon={ShoppingBag} color="orange" isCurrency />
                  <StatCard label="Total Amount Receive" value={totalAmountReceive} icon={DollarSign} color="emerald" isCurrency />
                </div>
              );
            })()}

            {/* ─── TABLE 1: New Sales (Delivered in Range) ─── */}
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-blue-500" />
                <h3 className="text-sm font-bold text-dark dark:text-white uppercase tracking-wider">
                  New Sales — Delivered in Period
                </h3>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {data.orders.length} orders
                </span>
              </div>
              <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark overflow-hidden">
                {data.orders.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No new sales found for the selected date range.
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-dark-3 z-10">
                        <tr className="text-[11px] uppercase text-gray-500">
                          <th className="px-6 py-4">Order Details</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4 text-right">Sales Value</th>
                          <th className="px-6 py-4 text-right">Down Payment</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {data.orders.slice(0, visibleOrders).map((o: any) => (
                          <tr key={o.id} className="border-b border-stroke last:border-0 dark:border-dark-3 hover:bg-gray-50/50 dark:hover:bg-dark-3/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-dark dark:text-white font-mono">{o.order_ref}</div>
                              <div className="text-xs text-gray-500">{o.customer_name} • {new Date(o.created_at).toLocaleDateString()}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                o.sale_type === 'cash' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'
                              }`}>
                                {o.sale_type === 'cash' ? 'Cash Sale' : 'Installment'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-dark dark:text-white">
                              Rs. {(o.sales_value ?? o.total_amount ?? 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right text-emerald-600 font-bold">
                              Rs. {(o.down_payment_amount ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {data.orders.length > visibleOrders && (
                      <ShowMoreButton
                        shown={visibleOrders}
                        total={data.orders.length}
                        onClick={() => setVisibleOrders(v => v + PAGE_SIZE)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── TABLE 2: Installment Collections (Payments received in Range) ─── */}
            {(() => {
              const collections: InstallmentCollection[] = data.installmentCollections || [];
              if (collections.length === 0) return null;
              const totalCollected = collections.reduce((s: number, c: InstallmentCollection) => s + c.amount_collected, 0);

              return (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-purple-500" />
                    <h3 className="text-sm font-bold text-dark dark:text-white uppercase tracking-wider">
                      Installment Collections — Payments Received in Period
                    </h3>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                      {collections.length} payments • Rs. {totalCollected.toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded-[10px] border border-purple-200 bg-white shadow-1 dark:border-purple-900/30 dark:bg-gray-dark overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-purple-50 dark:bg-purple-900/20 z-10">
                          <tr className="text-[11px] uppercase text-purple-600 dark:text-purple-400">
                            <th className="px-6 py-4">Order Ref</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Installment</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4">Payment Date</th>
                            <th className="px-6 py-4 text-right">Amount Received</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-stroke dark:divide-dark-3">
                          {collections.slice(0, visibleCollections).map((c: InstallmentCollection) => (
                            <tr key={c.id} className="hover:bg-purple-50/40 dark:hover:bg-purple-900/10 transition-colors">
                              <td className="px-6 py-3">
                                <span className="font-mono font-bold text-dark dark:text-white text-xs">{c.order_ref}</span>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{c.customer_name}</td>
                              <td className="px-6 py-3">
                                <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                  {c.month_label}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-xs text-gray-500 capitalize">{c.payment_method}</td>
                              <td className="px-6 py-3 text-xs text-gray-500">
                                {new Date(c.payment_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-emerald-600">
                                Rs. {c.amount_collected.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-purple-50 dark:bg-purple-900/20 border-t-2 border-purple-200 dark:border-purple-700 sticky bottom-0">
                          <tr>
                            <td colSpan={5} className="px-6 py-3 text-xs font-black uppercase text-purple-700 dark:text-purple-300">
                              Total Installment Receiving
                            </td>
                            <td className="px-6 py-3 text-right font-black text-emerald-600 text-sm">
                              Rs. {totalCollected.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                      {collections.length > visibleCollections && (
                        <ShowMoreButton
                          shown={visibleCollections}
                          total={collections.length}
                          onClick={() => setVisibleCollections(v => v + PAGE_SIZE)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )
      )}
    </>
  )
}

function ShowMoreButton({ shown, total, onClick }: { shown: number; total: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-t border-stroke py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#ff3d3d] dark:border-dark-3 dark:hover:bg-dark-3/30"
    >
      Showing {shown.toLocaleString()} of {total.toLocaleString()} — Show more
    </button>
  )
}

function StatCard({ label, value, icon: Icon, color, isCurrency = false }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
  }

  return (
    <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-dark dark:text-white mt-1">
            {isCurrency ? 'Rs. ' : ''}{(value || 0).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
