'use client'

import { useEffect, useState, useMemo, Fragment, type ReactNode } from 'react'
import Cookies from 'js-cookie'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb'
import Loader from '@/components/common/Loader'
import { Package, DollarSign, CheckCircle2, ShoppingCart, ChevronDown, ChevronRight, Search, X, Loader2 } from 'lucide-react'
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

interface ImeiDetail {
  id: number
  imei_serial: string
  product_name: string
  model: string
  variant: string | null
  category: string | null
  color_variant: string | null
  is_used: boolean
  status: string
  current_outlet: { name: string; code: string | null; address: string | null } | null
  added_to_stock_at: string
  purchase_price: number
  installment_price: number
  sale_price: number | null
  purchase: {
    vendor_name: string
    vendor_phone: string | null
    invoice_number: string
    purchase_date: string
    unit_price: number
    payment_status: string
    outlet_name: string | null
  } | null
  sale: {
    type: 'Cash Sale' | 'Installment'
    date: string
    price: number
    customer_name: string | null
    customer_phone: string | null
    sold_by: string | null
    order_ref: string | null
    order_status: string | null
  } | null
  transfers: { id: number; from: string; to: string; status: string; date: string }[]
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

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

  const [imeiQuery, setImeiQuery] = useState('')
  const [imeiLoading, setImeiLoading] = useState(false)
  const [imeiError, setImeiError] = useState('')
  const [imeiResults, setImeiResults] = useState<ImeiDetail[] | null>(null)

  const searchImei = async (value: string) => {
    const q = value.trim()
    setImeiQuery(q)
    if (q.length < 4) {
      setImeiError('Enter at least 4 digits of the IMEI.')
      setImeiResults(null)
      return
    }
    if (!token) return
    setImeiLoading(true)
    setImeiError('')
    try {
      const qs = new URLSearchParams({ imei: q, outletId })
      const res = await fetch(`${BACKEND_URL}/api/outlet-reports/imei-lookup?${qs}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) setImeiResults(json.data)
      else { setImeiError(json.message || 'Search failed.'); setImeiResults(null) }
    } catch (err) {
      console.error('IMEI lookup failed:', err)
      setImeiError('Search failed. Please try again.')
      setImeiResults(null)
    } finally {
      setImeiLoading(false)
    }
  }

  const clearImei = () => {
    setImeiQuery('')
    setImeiResults(null)
    setImeiError('')
  }

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

  // Sort by available quantity (inStock) descending — highest available comes first; ties broken by total
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.inStock - a.inStock || b.total - a.total)
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

      <form
        onSubmit={e => { e.preventDefault(); searchImei(imeiQuery) }}
        className="mb-6 flex flex-wrap items-center gap-3"
      >
        <div className="relative w-full max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={imeiQuery}
            onChange={e => setImeiQuery(e.target.value)}
            placeholder="Search by IMEI / Serial number…"
            className="w-full rounded-lg border border-stroke bg-white py-2.5 pl-9 pr-9 font-mono text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
          {imeiQuery && (
            <button type="button" onClick={clearImei} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500" title="Clear">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={imeiLoading}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-60"
        >
          {imeiLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search IMEI
        </button>
      </form>

      {imeiError && <p className="-mt-3 mb-6 text-sm text-red-500">{imeiError}</p>}

      {imeiResults && (
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-dark dark:text-white">
              {imeiResults.length === 0
                ? `No unit found for "${imeiQuery}"`
                : `${imeiResults.length} unit${imeiResults.length === 1 ? '' : 's'} found for "${imeiQuery}"`}
            </h3>
            <button onClick={clearImei} className="text-xs font-semibold text-red-500 hover:underline">Close</button>
          </div>
          {imeiResults.map(d => <ImeiDetailCard key={d.id} d={d} />)}
        </div>
      )}

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
                              {u.imei_serial ? (
                                <button
                                  type="button"
                                  onClick={() => { searchImei(u.imei_serial!); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                                  title="View full details"
                                  className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-primary hover:underline dark:border-dark-3 dark:bg-dark-3"
                                >
                                  {u.imei_serial}
                                </button>
                              ) : (
                                <span className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono dark:border-dark-3 dark:bg-dark-3">— (no IMEI)</span>
                              )}
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

function ImeiDetailCard({ d }: { d: ImeiDetail }) {
  const inStock = d.status === 'In Stock'
  const statusClass = inStock
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
    : d.status === 'Sold'
      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
      : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20'

  return (
    <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stroke pb-4 dark:border-dark-3">
        <div>
          <p className="text-base font-bold text-dark dark:text-white">{d.product_name}</p>
          <p className="mt-1 font-mono text-sm text-gray-500">IMEI: {d.imei_serial}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
            {inStock ? 'Available (Not used)' : d.status}
          </span>
          <p className="mt-2 text-xs text-gray-500">
            {inStock ? 'Currently at' : 'Last outlet'}: <span className="font-semibold text-dark dark:text-white">{d.current_outlet?.name || '—'}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <DetailSection title="Product">
          <DetailRow label="Model" value={d.model} />
          <DetailRow label="Variant" value={d.variant} />
          <DetailRow label="Color" value={d.color_variant} />
          <DetailRow label="Category" value={d.category} />
          <DetailRow label="Condition" value={d.is_used ? 'Used' : 'New'} />
          <DetailRow label="Outlet" value={d.current_outlet ? `${d.current_outlet.name}${d.current_outlet.code ? ` (${d.current_outlet.code})` : ''}` : null} />
          <DetailRow label="Added to stock" value={fmtDate(d.added_to_stock_at)} />
        </DetailSection>

        <DetailSection title="Purchase">
          {d.purchase ? (
            <>
              <DetailRow label="Vendor" value={d.purchase.vendor_name} />
              <DetailRow label="Vendor phone" value={d.purchase.vendor_phone} />
              <DetailRow label="Purchase date" value={fmtDate(d.purchase.purchase_date)} />
              <DetailRow label="Invoice #" value={d.purchase.invoice_number} />
              <DetailRow label="Purchase price" value={`Rs. ${d.purchase.unit_price.toLocaleString()}`} />
              <DetailRow label="Payment" value={d.purchase.payment_status} />
              <DetailRow label="Bought by" value={d.purchase.outlet_name} />
            </>
          ) : (
            <>
              <DetailRow label="Purchase price" value={`Rs. ${d.purchase_price.toLocaleString()}`} />
              <DetailRow label="Added on" value={fmtDate(d.added_to_stock_at)} />
              <p className="mt-2 text-xs text-gray-400">No vendor purchase invoice found for this IMEI (added manually or imported).</p>
            </>
          )}
        </DetailSection>

        <DetailSection title="Sale">
          {d.sale ? (
            <>
              <DetailRow label="Sold as" value={d.sale.type} />
              <DetailRow label="Sale date" value={fmtDate(d.sale.date)} />
              <DetailRow label="Customer" value={d.sale.customer_name} />
              <DetailRow label="Phone" value={d.sale.customer_phone} />
              <DetailRow label="Amount" value={`Rs. ${d.sale.price.toLocaleString()}`} />
              {d.sale.order_ref && <DetailRow label="Order" value={`${d.sale.order_ref}${d.sale.order_status ? ` · ${d.sale.order_status}` : ''}`} />}
              {d.sale.sold_by && <DetailRow label="Sold by" value={d.sale.sold_by} />}
            </>
          ) : (
            <p className="text-xs text-gray-400">{inStock ? 'Not sold yet — unit is available in stock.' : 'No sale record found.'}</p>
          )}
        </DetailSection>
      </div>

      {d.transfers.length > 0 && (
        <div className="mt-5 border-t border-stroke pt-4 dark:border-dark-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Movement history</p>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {d.transfers.map(t => (
              <li key={t.id}>
                <span className="text-gray-400">{fmtDate(t.date)}</span> · {t.from} → {t.to}
                <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase dark:bg-dark-3">{t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-semibold text-dark dark:text-white">{value || '—'}</span>
    </div>
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
