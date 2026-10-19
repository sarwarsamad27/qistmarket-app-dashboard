'use client'

import { useEffect, useState, useMemo } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { pktDate } from '@/utils/pkt'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Order {
  id: number
  order_ref: string
  customer_name: string
  product_name: string
  total_amount: number
  status: string
  created_at: string
  payments: { amount: number }[]
}

export default function SalesReportPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ summary: any; orders: Order[] } | null>(null)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return pktDate(d);
  })
  const [endDate, setEndDate] = useState(pktDate())
  
  const token = useMemo(() => Cookies.get('auth_token'), [])

  const fetchSales = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlet-reports/sales?startDate=${startDate}&endDate=${endDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch sales:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
  }, [startDate, endDate, token])

  return (
    <>
      <Breadcrumb pageName="Sales Report" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-dark dark:text-white">Order & Sales Analysis</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed list of all sales and their collection status.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-gray-400 uppercase">From</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-gray-400 uppercase">To</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
            />
          </div>
        </div>
      </div>

      {loading && !data ? <Loader /> : (
        <>
          <div className="mb-6 grid gap-5 md:grid-cols-3">
             <StatCard label="Total Orders" value={data?.summary.totalOrders || 0} />
             <StatCard label="Gross Sales" value={data?.summary.totalGrossAmount || 0} isCurrency />
             <StatCard label="Total Collected" value={data?.summary.totalReceived || 0} isCurrency color="text-emerald-500" />
          </div>

          <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-[11px] uppercase text-gray-500 dark:bg-dark-3">
                    <th className="px-6 py-4">Ref #</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-right">Received</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data?.orders.map((order) => {
                    const received = order.payments.reduce((acc, p) => acc + p.amount, 0);
                    return (
                      <tr key={order.id} className="border-b border-stroke last:border-0 hover:bg-gray-50 dark:border-dark-3 dark:hover:bg-dark-3">
                        <td className="px-6 py-4 font-medium text-dark dark:text-white">{order.order_ref}</td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{order.customer_name}</td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{order.product_name}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">Rs. {order.total_amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-600">Rs. {received.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function StatCard({ label, value, isCurrency = false, color = "text-dark dark:text-white" }: any) {
  return (
    <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-tight">{label}</p>
      <p className={`mt-2 text-xl font-bold ${color}`}>
        {isCurrency ? `Rs. ${value.toLocaleString()}` : value.toLocaleString()}
      </p>
    </div>
  )
}

function getStatusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes('approve')) return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400';
  if (s.includes('reject') || s.includes('cancel')) return 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400';
  return 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400';
}
