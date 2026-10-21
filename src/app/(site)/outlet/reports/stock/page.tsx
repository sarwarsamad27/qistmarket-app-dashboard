'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import DateRangeFilter, { type DateRange } from '@/components/Accounts/DateRangeFilter'
import { Package, DollarSign, CheckCircle2, ShoppingCart } from 'lucide-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface StockItem {
  product: string
  total: number
  inStock: number
  sold: number
  valuation: number
}

export default function StockSummaryPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StockItem[]>([])
  const token = useMemo(() => Cookies.get('auth_token'), [])
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })

  useEffect(() => {
    const fetchStock = async () => {
      if (!token) return
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        if (range.from) qs.set('startDate', range.from)
        if (range.to) qs.set('endDate', range.to)
        const res = await fetch(`${BACKEND_URL}/api/outlet-reports/stock-summary?${qs}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (json.success) {
          setData(json.data)
        }
      } catch (err) {
        console.error('Failed to fetch stock:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStock()
  }, [token, range.from, range.to])

  const totals = useMemo(() => {
    return data.reduce((acc, item) => ({
      total: acc.total + item.total,
      inStock: acc.inStock + item.inStock,
      sold: acc.sold + item.sold,
      valuation: acc.valuation + item.valuation
    }), { total: 0, inStock: 0, sold: 0, valuation: 0 })
  }, [data])

  if (loading && data.length === 0) return <Loader />

  return (
    <>
      <Breadcrumb pageName="Stock Summary" />

      <div className="mb-8">
        <h2 className="text-xl font-bold text-dark dark:text-white">Inventory Valuation</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Overview of your current stock levels and their capital value.</p>
        <div className="mt-3"><DateRangeFilter value={range} onChange={setRange} /></div>
        <p className="mt-1 text-xs text-gray-400">Dates filter the units sold in that period. Available stock and valuation are always as of today.</p>
      </div>

      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Total Stock" value={totals.total} icon={Package} color="blue" />
        <MiniStat label="Available" value={totals.inStock} icon={CheckCircle2} color="emerald" />
        <MiniStat label="Sold Items" value={totals.sold} icon={ShoppingCart} color="orange" />
        <MiniStat label="Valuation" value={totals.valuation} icon={DollarSign} color="red" isCurrency />
      </div>

      <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <div className="px-6 py-4 border-b border-stroke dark:border-dark-3">
          <h3 className="font-semibold text-dark dark:text-white">Product Wise Stock</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-3">
                <th className="px-6 py-4">S.No</th><th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4 text-center">Total</th>
                <th className="px-6 py-4 text-center">In Stock</th>
                <th className="px-6 py-4 text-center">Sold</th>
                <th className="px-6 py-4 text-right">Asset Value</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.map((item, idx) => (
                <tr key={idx} className="border-b border-stroke last:border-0 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-3"><td className="px-6 py-4 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-6 py-4 font-medium text-dark dark:text-white">{item.product}</td>
                  <td className="px-6 py-4 text-center font-bold text-gray-500">{item.total}</td>
                  <td className="px-6 py-4 text-center font-bold text-emerald-500">{item.inStock}</td>
                  <td className="px-6 py-4 text-center font-bold text-orange-500">{item.sold}</td>
                  <td className="px-6 py-4 text-right font-semibold text-dark dark:text-gray-200">Rs. {item.valuation.toLocaleString()}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">No inventory found in this outlet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function MiniStat({ label, value, icon: Icon, color, isCurrency = false }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600'
  }
  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase">{label}</p>
        <p className="mt-1 text-lg font-bold text-dark dark:text-white">
          {isCurrency ? `Rs. ${value.toLocaleString()}` : value.toLocaleString()}
        </p>
      </div>
    </div>
  )
}
