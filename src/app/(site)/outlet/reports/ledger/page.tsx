'use client'

import { useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { Search, UserCircle, Calendar, Banknote } from 'lucide-react'
import { formatExactDate } from '@/utils/dateUtils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Payment {
  id: number
  amount: number
  paymentType: string
  paidAt: string
  paymentMethod: string
}

interface Order {
  id: number
  order_ref: string
  total_amount: number
  status: string
  created_at: string
  payments: Payment[]
}

export default function CustomerLedgerPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Order[]>([])
  const [searched, setSearched] = useState(false)
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !token) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlet-reports/customer-ledger/${phone}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (err) {
      console.error('Failed to fetch ledger:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Breadcrumb pageName="Customer Ledger" />

      <div className="mb-8 flex flex-col items-center justify-center rounded-xl border border-stroke bg-white p-8 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="mb-6 text-xl font-bold text-dark dark:text-white">Lookup Customer Statement</h2>
        <form onSubmit={handleSearch} className="flex w-full max-w-md gap-2">
          <input 
            type="text" 
            placeholder="Enter WhatsApp Number (e.g. 03001234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 rounded-lg border border-stroke bg-gray-50 px-4 py-2 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-3 dark:text-white"
          />
          <button 
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-[#ff3d3d] px-6 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            <Search className="h-4 w-4" /> Search
          </button>
        </form>
      </div>

      {loading ? <Loader /> : searched && (
        <div className="space-y-8">
          {data.length === 0 ? (
            <div className="py-10 text-center text-gray-500">No records found for this number in your outlet.</div>
          ) : (
            data.map((order) => (
              <div key={order.id} className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark overflow-hidden">
                <div className="flex flex-wrap items-center justify-between border-b border-stroke bg-gray-50 px-6 py-4 dark:border-dark-3 dark:bg-dark-3/50">
                  <div className="flex items-center gap-3">
                    <UserCircle className="h-10 w-10 text-gray-400" />
                    <div>
                      <p className="font-mono text-sm font-bold text-dark dark:text-white">{order.order_ref}</p>
                      <p className="text-xs text-gray-500">Order Date: {formatExactDate(order.created_at, 'DD MMM YYYY, hh:mm A')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-xs font-medium text-gray-500 uppercase">Total Amount</p>
                     <p className="text-lg font-black text-[#ff3d3d]">Rs. {order.total_amount.toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Payment History</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-stroke text-gray-500 dark:border-dark-3">
                          <th className="pb-3 pr-4 flex items-center gap-1.5">S.No</th><th className="pb-3 pr-4 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</th>
                          <th className="pb-3 pr-4">Type</th>
                          <th className="pb-3 pr-4">Method</th>
                          <th className="pb-3 text-right flex items-center justify-end gap-1.5"><Banknote className="h-3.5 w-3.5" /> Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.payments.map((p, idx) => (
                          <tr key={p.id} className="border-b border-stroke last:border-0 dark:border-dark-3 transition-colors hover:bg-gray-50 dark:hover:bg-dark-3 italic"><td className="py-3 pr-4 text-gray-500 tabular-nums">{idx + 1}</td>
                            <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{formatExactDate(p.paidAt, 'DD MMM YYYY, hh:mm A')}</td>
                            <td className="py-3 pr-4 uppercase text-[11px] font-bold text-blue-500">{p.paymentType}</td>
                            <td className="py-3 pr-4 text-gray-500 text-xs">{p.paymentMethod || 'CASH'}</td>
                            <td className="py-3 text-right font-black text-emerald-600">Rs. {p.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
