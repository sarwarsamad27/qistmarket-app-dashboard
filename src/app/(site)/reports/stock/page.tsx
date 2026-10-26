'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { Package, DollarSign, CheckCircle2, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react'
import OutletSelector from '@/components/common/OutletSelector'
import DateRangeFilter, { type DateRange } from '@/components/Accounts/DateRangeFilter'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface StockUnit {
  id: number
  imei_serial: string | null
  outlet_name: string
  color_variant: string | null
  quantity: number
  purchase_price: number
  status: string
  created_at: string
  updated_at: string
}

interface StockItem {
  product: string
  total: number
  inStock: number
  sold: number
  valuation: number
  units: StockUnit[]
}

export default function GlobalStockSummaryPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StockItem[]>([])
  const [outletId, setOutletId] = useState('all')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchStock = async (selOutletId: string, r: DateRange) => {
    if (!token) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ outletId: selOutletId })
      if (r.from) qs.set('startDate', r.from)
      if (r.to) qs.set('endDate', r.to)
      const res = await fetch(`${BACKEND_URL}/api/outlet-reports/stock-summary?${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch stock summary:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setExpanded(new Set())
    fetchStock(outletId, range)
  }, [outletId, range.from, range.to, token])

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totals = useMemo(() => {
    return data.reduce((acc, item) => ({
      total: acc.total + item.total,
      inStock: acc.inStock + item.inStock,
      sold: acc.sold + item.sold,
      valuation: acc.valuation + item.valuation
    }), { total: 0, inStock: 0, sold: 0, valuation: 0 })
  }, [data])

  // Sort by total stock descending — biggest stock comes first; ties broken by available
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.total - a.total || b.inStock - a.inStock)
  }, [data])

  return (
    <>
      <Breadcrumb pageName="Global Stock Summary" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">Business Inventory Hub</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Consolidated stock levels and valuation worldwide.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <OutletSelector selectedId={outletId} onSelect={setOutletId} />
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>
      <p className="-mt-4 mb-6 text-xs text-gray-400">Dates filter the units sold in that period. Available stock and valuation are always as of today.</p>

      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Global Stock" value={totals.total} icon={Package} color="blue" />
        <MiniStat label="Total Available" value={totals.inStock} icon={CheckCircle2} color="emerald" />
        <MiniStat label="Total Sold Items" value={totals.sold} icon={ShoppingCart} color="orange" />
        <MiniStat label="Nationwide Valuation" value={totals.valuation} icon={DollarSign} color="red" isCurrency />
      </div>

      {loading ? <Loader /> : (
        <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-dark-3">
                  <th className="px-4 py-4 w-10" />
                  <th className="px-6 py-4 w-16">S.No</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4 text-center">Total</th>
                  <th className="px-6 py-4 text-center">Available</th>
                  <th className="px-6 py-4 text-center text-emerald-600">Sold</th>
                  <th className="px-6 py-4 text-right">Valuation (Purchase)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {sortedData.map((item, idx) => {
                  const isExpanded = expanded.has(item.product)
                  // Available units first, then sold — same order as the outlet Stock List
                  const units = [...(item.units || [])].sort((a, b) =>
                    (a.status === 'In Stock' ? 0 : 1) - (b.status === 'In Stock' ? 0 : 1)
                  )
                  return (
                    <Fragment key={item.product}>
                      <tr
                        onClick={() => toggleExpand(item.product)}
                        className={`border-b border-stroke last:border-0 dark:border-dark-3 cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-gray-50/50'}`}
                      >
                        <td className="px-4 py-4 text-center">
                          {isExpanded
                            ? <ChevronDown size={18} className="text-primary mx-auto" />
                            : <ChevronRight size={18} className="text-gray-400 mx-auto" />}
                        </td>
                        <td className="px-6 py-4 text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-bold text-dark dark:text-white capitalize">
                          {item.product}
                          <span className="ml-2 text-xs font-semibold text-gray-400">
                            {isExpanded ? 'Hide' : `${units.length} unit${units.length === 1 ? '' : 's'}`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-semibold">{item.total}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600 dark:bg-emerald-900/20">{item.inStock}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900/20">{item.sold}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-dark dark:text-white">Rs. {item.valuation.toLocaleString()}</td>
                      </tr>

                      {isExpanded && (
                        units.length === 0 ? (
                          <tr className="border-b border-dashed border-stroke/50 bg-gray-50/50 dark:border-dark-3 dark:bg-dark-2/30">
                            <td colSpan={7} className="px-6 py-3 text-center text-xs text-gray-400">No units recorded for this product.</td>
                          </tr>
                        ) : units.map((u, uIdx) => (
                          <tr key={u.id} className="border-b border-dashed border-stroke/50 bg-gray-50/50 text-xs dark:border-dark-3 dark:bg-dark-2/30">
                            <td className="px-4 py-3 text-center text-[10px] font-mono text-gray-400">#{uIdx + 1}</td>
                            <td />
                            <td className="px-6 py-3">
                              <span className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono dark:border-dark-3 dark:bg-dark-3">
                                {u.imei_serial || '— (no IMEI)'}
                              </span>
                              <span className="ml-2 text-gray-500">{u.outlet_name}</span>
                              {u.color_variant && <span className="ml-2 text-gray-400">· {u.color_variant}</span>}
                            </td>
                            <td className="px-6 py-3 text-center text-gray-500">{u.quantity}</td>
                            <td className="px-6 py-3 text-center" colSpan={2}>
                              {u.status === 'In Stock'
                                ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600 dark:bg-emerald-900/20">Available</span>
                                : <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-600 dark:bg-blue-900/20">Sold · {new Date(u.updated_at).toLocaleDateString()}</span>}
                            </td>
                            <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">Rs. {(u.purchase_price * u.quantity).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function MiniStat({ label, value, icon: Icon, color, isCurrency = false }: any) {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    orange: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  }
  return (
    <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-gray-400">{label}</p>
          <p className="text-lg font-bold text-dark dark:text-white">
            {isCurrency ? 'Rs. ' : ''}{value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
