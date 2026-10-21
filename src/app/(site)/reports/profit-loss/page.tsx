'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { TrendingUp, TrendingDown, BarChart3, Receipt, Package, ArrowRight } from 'lucide-react'
import OutletSelector from '@/components/common/OutletSelector'
import DateRangeFilter, { type DateRange } from '@/components/Accounts/DateRangeFilter'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface PLData {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  orderCount: number
}

export default function GlobalProfitLossPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PLData | null>(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [outletId, setOutletId] = useState('all')
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchPL = async () => {
    if (!token) return
    setLoading(true)
    try {
      let url = `${BACKEND_URL}/api/outlet-reports/profit-loss?outletId=${outletId}`
      if (dateRange.start) url += `&startDate=${dateRange.start}`
      if (dateRange.end) url += `&endDate=${dateRange.end}`

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch P&L:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPL()
  }, [dateRange, outletId, token])

  return (
    <>
      <Breadcrumb pageName="Global Profit & Loss" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">Financial Performance Statement</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Analyze nationwide profitability and operational efficiency.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <OutletSelector selectedId={outletId} onSelect={setOutletId} />
          <DateRangeFilter
            value={{ from: dateRange.start, to: dateRange.end }}
            onChange={(r) => setDateRange({ start: r.from, end: r.to })}
          />
        </div>
      </div>

      {loading && !data ? <Loader /> : (
        data && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[20px] border border-stroke bg-white p-8 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
              <h3 className="mb-6 text-xl font-bold text-dark dark:text-white">Income Statement</h3>
              <div className="space-y-6">
                <PLRow label="Revenue (Sales)" value={data.revenue} icon={TrendingUp} color="text-emerald-500" />
                <PLRow label="Cost of Goods Sold (COGS)" value={-data.cogs} icon={Package} color="text-red-500" />
                <hr className="border-stroke dark:border-dark-3" />
                <PLRow label="Gross Profit" value={data.grossProfit} secondaryLabel={`Margin: ${data.revenue ? ((data.grossProfit/data.revenue)*100).toFixed(1) : 0}%`} isTotal />
                <PLRow label="Operating Expenses" value={-data.expenses} icon={Receipt} color="text-orange-500" />
                <hr className="border-stroke dark:border-dark-3" />
                <div className={`rounded-xl p-6 ${data.netProfit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <PLRow
                    label="Net Profit"
                    value={data.netProfit}
                    isTotal
                    color={data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[20px] border border-stroke bg-white p-8 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
                <h3 className="mb-4 text-lg font-bold text-dark dark:text-white">Quick Insights</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-stroke p-4 dark:border-dark-3">
                    <p className="text-xs font-semibold text-gray-400">Order Volume</p>
                    <p className="text-2xl font-bold text-dark dark:text-white mt-1">{data.orderCount}</p>
                  </div>
                  <div className="rounded-xl border border-stroke p-4 dark:border-dark-3">
                    <p className="text-xs font-semibold text-gray-400">Avg. Order Value</p>
                    <p className="text-2xl font-bold text-dark dark:text-white mt-1">
                      Rs. {data.orderCount ? (data.revenue / data.orderCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] bg-[#ff3d3d] p-8 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Nationwide Performance</h3>
                    <p className="mt-1 text-red-100 text-sm">Review detailed outlet records to optimize margins.</p>
                  </div>
                  <BarChart3 className="h-10 w-10 opacity-20" />
                </div>
                <button className="mt-6 flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#ff3d3d] transition-transform hover:scale-105">
                  View By Outlet <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </>
  )
}

function PLRow({ label, value, icon: Icon, color = 'text-dark dark:text-white', isTotal = false, secondaryLabel }: any) {
  return (
    <div className={`flex items-center justify-between ${isTotal ? 'text-lg font-bold' : 'text-sm'}`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`h-4 w-4 ${color}`} />}
        <div>
          <p className={isTotal ? 'text-dark dark:text-white' : 'text-gray-500 dark:text-gray-400'}>{label}</p>
          {secondaryLabel && <p className="text-[10px] text-gray-400 font-normal">{secondaryLabel}</p>}
        </div>
      </div>
      <p className={`font-mono ${color}`}>Rs. {value.toLocaleString()}</p>
    </div>
  )
}
