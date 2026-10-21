'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import DateRangeFilter, { type DateRange } from '@/components/Accounts/DateRangeFilter'
import { Phone, User, Banknote, AlertCircle } from 'lucide-react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface RecoveryItem {
  order_id: number
  order_ref: string
  customer: string
  phone: string
  total_amount: number
  total_paid: number
  balance: number
}

export default function RecoveryReportPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RecoveryItem[]>([])
  const token = useMemo(() => Cookies.get('auth_token'), [])
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })

  useEffect(() => {
    const fetchRecovery = async () => {
      if (!token) return
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        if (range.from) qs.set('startDate', range.from)
        if (range.to) qs.set('endDate', range.to)
        const res = await fetch(`${BACKEND_URL}/api/outlet-reports/recovery?${qs}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (json.success) setData(json.data)
      } catch (err) {
        console.error('Failed to fetch recovery:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchRecovery()
  }, [token, range.from, range.to])

  const totals = useMemo(() => {
    return data.reduce((acc, item) => ({
      count: acc.count + 1,
      totalBalance: acc.totalBalance + item.balance
    }), { count: 0, totalBalance: 0 })
  }, [data])

  if (loading && data.length === 0) return <Loader />

  return (
    <>
      <Breadcrumb pageName="Recovery Report" />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white text-[22px]">Installment Recovery List</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track all customers with pending balances in your outlet.</p>
          <div className="mt-3"><DateRangeFilter value={range} onChange={setRange} /></div>
          <p className="mt-1 text-xs text-gray-400">
            {range.from || range.to ? 'Installments that fell due in the selected period and how much of them is still unpaid.' : 'No dates selected: full outstanding balance of every account.'}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 px-4 py-2 border border-red-100 dark:bg-red-500/10 dark:border-red-500/20">
          <p className="text-[10px] uppercase font-bold text-red-500">Total Outstanding</p>
          <p className="text-lg font-black text-red-600">Rs. {totals.totalBalance.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-3">
                <th className="px-6 py-4">S.No</th><th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4">Order Ref</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-right">Total Paid</th>
                <th className="px-6 py-4 text-right">Balance Due</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.map((item, idx) => (
                <tr key={item.order_id} className="border-b border-stroke last:border-0 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-3 transition-colors"><td className="px-6 py-4 text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-dark dark:text-white flex items-center gap-1.5">
                        <User className="h-3 w-3 text-gray-400" /> {item.customer}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <Phone className="h-3 w-3 text-gray-400" /> {item.phone}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono font-bold dark:bg-dark-2 dark:text-gray-300">
                       {item.order_ref}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">Rs. {item.total_amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-600">Rs. {item.total_paid.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2.5 py-1 text-xs font-black text-red-600 dark:bg-red-500/10">
                      Rs. {item.balance.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500 flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 text-gray-300" />
                  Great job! No pending installments found.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
