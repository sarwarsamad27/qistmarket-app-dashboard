'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import DateRangeFilter, { type DateRange } from '@/components/Accounts/DateRangeFilter'
import { ArrowUp, ArrowDown, Banknote } from 'lucide-react'
import { pktDate } from '@/utils/pkt'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface SummaryData {
  totalIncome: number
  totalExpense: number
  netCash: number
  breakdown: {
    advance: number
    installments: number
  }
}

interface Payment {
  amount: number
  paymentType: string
  paidAt: string
  order_ref: string
  customer_name: string
}

interface Expense {
  id: string
  amount: number
  expense_type: string
  description: string
  created_at: string
}

export default function DaybookPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ summary: SummaryData; payments: Payment[]; expenses: Expense[] } | null>(null)
  const [range, setRange] = useState<DateRange>({ from: pktDate(), to: pktDate() })
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchDaybook = async (r: DateRange) => {
    if (!token) return
    setLoading(true)
    try {
      // Empty dates = today (the server's default for the daybook)
      const res = await fetch(`${BACKEND_URL}/api/outlet-reports/daybook?startDate=${r.from || r.to}&endDate=${r.to || r.from}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch daybook:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDaybook(range)
  }, [range.from, range.to, token])

  if (loading && !data) return <Loader />

  return (
    <>
      <Breadcrumb pageName="Daily Daybook" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">Cash Book Summary</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">View all cash inflows and outflows for your outlet.</p>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {data && (
        <>
          <div className="mb-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <ArrowUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Income</p>
                  <p className="text-xl font-bold text-dark dark:text-white">Rs. {data.summary.totalIncome.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <ArrowDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Total Expenses</p>
                  <p className="text-xl font-bold text-dark dark:text-white">Rs. {data.summary.totalExpense.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Net Cash</p>
                  <p className={`text-xl font-bold ${data.summary.netCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    Rs. {data.summary.netCash.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* Income Table */}
            <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
              <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
                <h3 className="font-semibold text-dark dark:text-white">Incomes (Payments)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-3">
                      <th className="px-6 py-3">S.No</th><th className="px-6 py-3">Order Ref</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.payments.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">No income records found for this date.</td></tr>
                    ) : (
                      data.payments.map((p, idx) => (
                        <tr key={`${p.order_ref}-${idx}`} className="border-b border-stroke last:border-0 dark:border-dark-3"><td className="px-6 py-3 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                          <td className="px-6 py-3 font-medium text-dark dark:text-white">{p.order_ref}</td>
                          <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{p.customer_name}</td>
                          <td className="px-6 py-3 uppercase text-xs">{p.paymentType}</td>
                          <td className="px-6 py-3 text-right font-semibold text-emerald-600">Rs. {p.amount.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expense Table */}
            <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
              <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
                <h3 className="font-semibold text-dark dark:text-white">Expenses</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-3">
                      <th className="px-6 py-3">S.No</th><th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Description</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {data.expenses.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-500">No expense records found for this date.</td></tr>
                    ) : (
                      data.expenses.map((e, idx) => (
                        <tr key={e.id} className="border-b border-stroke last:border-0 dark:border-dark-3"><td className="px-6 py-3 font-medium text-gray-500 tabular-nums">{idx + 1}</td>
                          <td className="px-6 py-3 font-medium text-dark dark:text-white">{e.expense_type}</td>
                          <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{e.description || '-'}</td>
                          <td className="px-6 py-3 text-right font-semibold text-red-600">Rs. {e.amount.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

