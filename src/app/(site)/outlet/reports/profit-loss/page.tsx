'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { pktDate } from '@/utils/pkt'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface PLData {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netProfit: number
  orderCount: number
}

export default function ProfitLossPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PLData | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return pktDate(d);
  })
  const [endDate, setEndDate] = useState(pktDate())
  
  const token = useMemo(() => Cookies.get('auth_token'), [])

  useEffect(() => {
    const fetchPL = async () => {
      if (!token) return
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND_URL}/api/outlet-reports/profit-loss?startDate=${startDate}&endDate=${endDate}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch (err) {
        console.error('Failed to fetch P&L:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPL()
  }, [startDate, endDate, token])

  return (
    <>
      <Breadcrumb pageName="Profit & Loss" />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Earnings Statement</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Match your revenues against costs and expenses.</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-dark"
          />
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm dark:border-dark-3 dark:bg-gray-dark"
          />
        </div>
      </div>

      {loading && !data ? <Loader /> : data && (
        <div className="mx-auto max-w-2xl rounded-xl border border-stroke bg-white p-8 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <h2 className="mb-6 text-center text-xl font-bold uppercase tracking-wider text-dark dark:text-white border-b pb-4">Statement of Account</h2>
          
          <div className="space-y-6">
            <div className="flex justify-between text-lg">
              <span className="font-medium text-gray-600 dark:text-gray-400 text-sm italic">Service Revenue ({data.orderCount} Orders)</span>
              <span className="font-bold text-dark dark:text-white">Rs. {data.revenue.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-lg border-b border-stroke pb-2 dark:border-dark-3">
              <span className="font-medium text-gray-600 dark:text-gray-400 text-sm italic">Cost of Goods Sold (COGS)</span>
              <span className="font-bold text-red-500">- Rs. {data.cogs.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-xl font-bold">
              <span>Gross Profit</span>
              <span className="text-emerald-600">Rs. {data.grossProfit.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-lg border-b border-stroke pb-2 dark:border-dark-3">
              <span className="font-medium text-gray-600 dark:text-gray-400 text-sm italic">Operating Expenses</span>
              <span className="font-bold text-red-500">- Rs. {data.expenses.toLocaleString()}</span>
            </div>

            <div className={`flex justify-between rounded-lg p-5 text-2xl font-black ${data.netProfit >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : 'bg-red-50 text-red-700 dark:bg-red-500/10'}`}>
              <span>NET PROFIT</span>
              <span>Rs. {data.netProfit.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="mt-10 text-center text-[11px] text-gray-400 italic">
            * This statement is generated based on real-time transaction data.
          </div>
        </div>
      )}
    </>
  )
}
