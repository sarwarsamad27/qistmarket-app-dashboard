'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { ArrowUp, ArrowDown, Banknote } from 'lucide-react'
import OutletSelector from '@/components/common/OutletSelector'
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
  id: number
  amount: number
  paymentType: string
  paidAt: string
  order: {
    order_ref: string
    customer_name: string
  }
}

interface Expense {
  id: number
  amount: number
  expense_type: string
  description: string
  created_at: string
}

export default function GlobalDaybookPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ summary: SummaryData; payments: Payment[]; expenses: Expense[] } | null>(null)
  const [date, setDate] = useState(pktDate())
  const [outletId, setOutletId] = useState('all')
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchDaybook = async (selectedDate: string, selOutletId: string) => {
    if (!token) return
    setLoading(true)
    try {
      const url = `${BACKEND_URL}/api/outlet-reports/daybook?startDate=${selectedDate}&outletId=${selOutletId}`
      const res = await fetch(url, {
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
    fetchDaybook(date, outletId)
  }, [date, outletId, token])

  return (
    <>
      <Breadcrumb pageName="Global Daybook" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white text-emerald-600">Nationwide Cash Flow</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Consolidated daybook across all business channels.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <OutletSelector selectedId={outletId} onSelect={setOutletId} />
          <div className="flex items-center gap-2 text-sm">
            <label className="font-medium text-gray-700 dark:text-gray-300">Date:</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
        </div>
      </div>

      {loading && !data ? <Loader /> : (
        data && (
          <>
            <div className="mb-6 grid gap-5 md:grid-cols-3">
              <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <ArrowUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Global Income</p>
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
                    <p className="text-xs font-medium text-gray-500">Global Expenses</p>
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
                    <p className="text-xs font-medium text-gray-500">Net Business Cash</p>
                    <p className={`text-xl font-bold ${data.summary.netCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Rs. {data.summary.netCash.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <IncomeTable payments={data.payments} />
              <ExpenseTable expenses={data.expenses} />
            </div>
          </>
        )
      )}
    </>
  )
}

function IncomeTable({ payments }: { payments: Payment[] }) {
  return (
    <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
        <h3 className="font-semibold text-dark dark:text-white">Recent Incomes</h3>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-gray-50 dark:bg-dark-3">
            <tr className="text-[11px] uppercase text-gray-500">
              <th className="px-6 py-3">Order Ref</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {payments.length === 0 ? (
              <tr><td colSpan={2} className="px-6 py-10 text-center text-gray-500">No income records.</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                  <td className="px-6 py-3">
                    <div className="font-medium text-dark dark:text-white">{p.order.order_ref}</div>
                    <div className="text-xs text-gray-400 capitalize">{p.order.customer_name} ({p.paymentType})</div>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-emerald-600">Rs. {p.amount.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExpenseTable({ expenses }: { expenses: Expense[] }) {
  return (
    <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="border-b border-stroke px-6 py-4 dark:border-dark-3">
        <h3 className="font-semibold text-dark dark:text-white">Recent Expenses</h3>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-gray-50 dark:bg-dark-3">
            <tr className="text-[11px] uppercase text-gray-500">
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {expenses.length === 0 ? (
              <tr><td colSpan={2} className="px-6 py-10 text-center text-gray-500">No expense records.</td></tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                  <td className="px-6 py-3">
                    <div className="font-medium text-dark dark:text-white">{e.expense_type}</div>
                    <div className="text-xs text-gray-400">{e.description || 'No description'}</div>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-red-600">Rs. {e.amount.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
