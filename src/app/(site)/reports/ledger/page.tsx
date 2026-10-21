'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { Search, UserCircle, Calendar, Banknote, MapPin } from 'lucide-react'
import OutletSelector from '@/components/common/OutletSelector'
import { formatExactDate } from '@/utils/dateUtils'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Order {
  id: number
  order_ref: string
  created_at: string
  total_amount: number
  payments: Payment[]
  outlet_id: number
}

interface Payment {
  id: number
  amount: number
  paymentType: string
  paymentMethod: string
  created_at: string
}

export default function GlobalCustomerLedgerPage() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Order[]>([])
  const [outletId, setOutletId] = useState('all')
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchLedger = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !phone) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlet-reports/customer-ledger/${phone}?outletId=${outletId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch ledger:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Breadcrumb pageName="Global Customer Ledger" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white text-cyan-600">Unified Customer Statement</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Look up purchase history across all business outlets.</p>
        </div>
        <OutletSelector selectedId={outletId} onSelect={setOutletId} />
      </div>

      <div className="mb-8 rounded-[20px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <form onSubmit={fetchLedger} className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Enter Customer WhatsApp Number (e.g., 03001234567)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 text-sm font-medium outline-none transition focus:border-[#ff3d3d] dark:border-dark-3"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#ff3d3d] px-8 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:bg-gray-400"
          >
            {loading ? 'Searching...' : <><Search className="h-4 w-4" /> Generate Ledger</>}
          </button>
        </form>
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-6">
          {data.length === 0 ? (
            phone && !loading && (
              <div className="py-20 text-center">
                <UserCircle className="mx-auto h-16 w-16 text-gray-200" />
                <h3 className="mt-4 text-lg font-bold text-gray-400">No records found for this number.</h3>
              </div>
            )
          ) : (
            data.map((order) => (
              <div key={order.id} className="rounded-xl border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark overflow-hidden">
                <div className="flex flex-wrap items-center justify-between border-b border-stroke bg-gray-50/50 px-6 py-4 dark:border-dark-3">
                  <div className="flex items-center gap-4">
                    <UserCircle className="h-12 w-12 text-gray-400" />
                    <div>
                      <p className="font-mono text-base font-black text-dark dark:text-white">{order.order_ref}</p>
                      <p className="text-[11px] text-gray-500 uppercase tracking-widest">{formatExactDate(order.created_at, 'DD MMM YYYY, hh:mm A')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase text-gray-400 font-bold">Total Bill</p>
                    <p className="text-xl font-black text-dark dark:text-white">Rs. {order.total_amount.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-stroke text-[11px] uppercase tracking-wider text-gray-400 dark:border-dark-3">
                          <th className="pb-3 flex items-center gap-1.5">S.No</th><th className="pb-3 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</th>
                          <th className="pb-3">Payment Category</th>
                          <th className="pb-3">Method</th>
                          <th className="pb-3 text-right"><Banknote className="h-3.5 w-3.5 inline mr-1" /> Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.payments.map((p, idx) => (
                          <tr key={p.id} className="border-b border-stroke last:border-0 dark:border-dark-3"><td className="py-4 text-xs text-gray-500 tabular-nums">{idx + 1}</td>
                            <td className="py-4 text-gray-600 dark:text-gray-400 text-xs">{formatExactDate(p.created_at, 'DD MMM YYYY, hh:mm A')}</td>
                            <td className="py-4 font-bold capitalize">{p.paymentType}</td>
                            <td className="py-4">
                              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-dark-3 dark:text-gray-400 italic">
                                {p.paymentMethod}
                              </span>
                            </td>
                            <td className="py-4 text-right font-black text-emerald-600">Rs. {p.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/50 dark:bg-emerald-900/10">
                          <td colSpan={4} className="py-3 px-4 font-bold text-dark dark:text-white">Total Amount Paid</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600">
                            Rs. {order.payments.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
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
