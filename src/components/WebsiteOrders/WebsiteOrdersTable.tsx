'use client'
import { useState, useEffect, useRef } from 'react'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'
import { createPortal } from 'react-dom'

// Standard Dashboard UI Components & Assets
import { SearchIcon, PointerUp, ChevronUpIcon } from '@/assets/icons'
import { Modal } from '../Modal/Modal'
import Pagination from '../common/Pagination'
import Loader from '@/components/common/Loader'
import { cn } from '@/lib/utils'
import { X, Check, AlertCircle } from 'lucide-react'
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface WebsiteOrder {
  id: number
  tokenNumber: string
  fullName: string
  phone: string
  alternativePhone?: string
  cnic?: string
  city: string
  area: string
  address: string
  productName: string
  totalDealValue: number
  advanceAmount: number
  monthlyAmount: number
  months: number
  createdAt: string
  status: string
}

export default function WebsiteOrdersTable() {
  const [orders, setOrders] = useState<WebsiteOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [isPickingUp, setIsPickingUp] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    totalItems: 0
  })

  // Modals
  const [viewDetailsModal, setViewDetailsModal] = useState<WebsiteOrder | null>(null)
  const [pickupConfirmModal, setPickupConfirmModal] = useState<WebsiteOrder[] | null>(null)
  const [cancelModal, setCancelModal] = useState<WebsiteOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const fetchWebsiteOrders = async () => {
    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: globalFilter
      })
      const res = await fetch(`${BACKEND_URL}/api/orders/website-feed?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.statusText}`)
      }

      const json = await res.json()
      if (json && json.data) {
        setOrders(json.data)
        setPagination({
          page: pagination.page,
          limit: pagination.limit,
          totalPages: json.pagination?.totalPages || 1,
          totalItems: json.pagination?.totalItems || 0
        })
      }
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error(getErrorMessage(error, 'Failed to load website orders'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebsiteOrders()
  }, [pagination.page, pagination.limit, globalFilter])

  const handlePickup = async (ordersToPickup: WebsiteOrder[]) => {
    setIsPickingUp(true)
    const token = Cookies.get('auth_token')

    try {
      let successCount = 0
      let failCount = 0

      for (const wo of ordersToPickup) {
        const payload = {
          customer_name: wo.fullName,
          whatsapp_number: wo.phone,
          alternate_contact: wo.alternativePhone || '',
          address: wo.address,
          city: wo.city,
          area: wo.area,
          product_name: wo.productName,
          total_amount: wo.totalDealValue.toString(),
          advance_amount: wo.advanceAmount.toString(),
          monthly_amount: wo.monthlyAmount.toString(),
          months: wo.months.toString(),
          website_token_number: wo.tokenNumber
        }

        const res = await fetch(`${BACKEND_URL}/api/orders/website-pickup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })

        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      }

      if (successCount > 0) toast.success(`${successCount} orders picked up!`)
      if (failCount > 0) toast.error(`${failCount} orders failed.`)

      setPickupConfirmModal(null)
      setRowSelection({})
      fetchWebsiteOrders()
    } catch (error) {
      console.error('Pickup error:', error)
      toast.error(getErrorMessage(error, 'Something went wrong'))
    } finally {
      setIsPickingUp(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancelModal || !cancelReason.trim()) return
    setIsCancelling(true)
    const token = Cookies.get('auth_token')

    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/website-feed/${cancelModal.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: cancelReason,
          orderData: cancelModal
        })
      })

      if (res.ok) {
        toast.success('Order cancelled successfully')
        setCancelModal(null)
        setCancelReason('')
        fetchWebsiteOrders()
      } else {
        const err = await res.json()
        toast.error(err.message || 'Failed to cancel order')
      }
    } catch (error) {
      console.error('Cancel error:', error)
      toast.error(getErrorMessage(error, 'Something went wrong'))
    } finally {
      setIsCancelling(false)
    }
  }

  const columns: ColumnDef<WebsiteOrder>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="rounded border-stroke"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-stroke"
        />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ getValue }) => {
        const val = getValue() as string
        return val ? formatExactDate(val, 'MMM DD, YYYY hh:mm A') : 'N/A'
      }
    },
    { accessorKey: 'tokenNumber', header: 'Web Token' },
    { accessorKey: 'fullName', header: 'Customer' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'area', header: 'Area' },
    { accessorKey: 'productName', header: 'Product' },
    {
      accessorKey: 'totalDealValue',
      header: 'Amount',
      cell: ({ getValue }) => `Rs. ${Number(getValue()).toLocaleString()}`
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const order = row.original
        const [isOpen, setIsOpen] = useState(false)
        const [position, setPosition] = useState({ top: 0, left: 0 })
        const [openUp, setOpenUp] = useState(false)
        const triggerRef = useRef<HTMLButtonElement | null>(null)
        const dropdownRef = useRef<HTMLDivElement | null>(null)

        const toggleDropdown = () => {
          if (!triggerRef.current) return
          const rect = triggerRef.current.getBoundingClientRect()
          const dropdownHeight = 100
          const spaceBelow = window.innerHeight - rect.bottom
          const shouldOpenUp = spaceBelow < dropdownHeight
          setOpenUp(shouldOpenUp)
          setPosition({
            top: shouldOpenUp ? rect.top + window.scrollY - 8 : rect.bottom + window.scrollY + 6,
            left: rect.right + window.scrollX - 180,
          })
          setIsOpen((prev) => !prev)
        }

        useEffect(() => {
          const handleClickOutside = (e: MouseEvent) => {
            if (isOpen && !triggerRef.current?.contains(e.target as Node) && !dropdownRef.current?.contains(e.target as Node)) {
              setIsOpen(false)
            }
          }
          document.addEventListener('mousedown', handleClickOutside)
          return () => document.removeEventListener('mousedown', handleClickOutside)
        }, [isOpen])

        return (
          <>
            <button
              ref={triggerRef}
              onClick={toggleDropdown}
              className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-dark shadow-[0_1px_3px_0_rgba(166,175,195,0.4)] hover:text-[#ff3d3d] dark:border dark:border-dark-3 dark:text-white dark:shadow-none"
            >
              <span>Actions</span>
              <ChevronUpIcon className={`size-4 transition-transform ${isOpen ? 'rotate-0' : 'rotate-180'}`} />
            </button>
            {isOpen && createPortal(
              <div
                ref={dropdownRef}
                style={{ position: 'absolute', top: position.top, left: position.left, transform: openUp ? 'translateY(-100%)' : 'none' }}
                className="z-[9999] w-44 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900"
              >
                <ul className="overflow-hidden text-sm font-medium">
                  <li>
                    <a
                      href={`/csr/website-orders/${order.id}`}
                      className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                    >
                      View Details
                    </a>
                  </li>
                  <li>
                    <button
                      onClick={() => { setPickupConfirmModal([order]); setIsOpen(false) }}
                      className="block w-full px-4 py-2.5 text-left hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30"
                    >
                      Pick Up Order
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => { setCancelModal(order); setIsOpen(false) }}
                      className="block w-full px-4 py-2.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                    >
                      Cancel Order
                    </button>
                  </li>
                </ul>
              </div>,
              document.body
            )}
          </>
        )
      }
    }
  ]

  const table = useReactTable({
    data: orders,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Top Bar */}
      <div className="flex justify-between px-7.5 py-4.5">
        <div className="relative z-20 w-full max-w-[414px]">
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
            placeholder="Search Website Orders..."
          />
          <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white">
            <SearchIcon className="size-4.5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {Object.keys(rowSelection).length > 0 && (
            <button
              onClick={() => setPickupConfirmModal(table.getSelectedRowModel().rows.map(r => r.original))}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:bg-green-700 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Pick Up Selected ({Object.keys(rowSelection).length})
            </button>
          )}
          <div className="flex items-center">
            <p className="pl-2 font-medium text-dark dark:text-current text-sm">Per Page:</p>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(v => ({ ...v, limit: Number(e.target.value), page: 1 }))}
              className="bg-transparent pl-2.5 text-sm outline-none"
            >
              {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="grid grid-cols-1 overflow-x-auto">
        <table className="datatable-table datatable-one !border-collapse px-4 md:px-8">
          <thead className="border-separate px-4">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-t border-stroke dark:border-dark-3">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="whitespace-nowrap px-3 py-4 text-left">
                    <div
                      className="flex cursor-pointer items-center gap-2"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="font-[500] text-sm uppercase text-gray-400 tracking-wider">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                      {header.column.getCanSort() && (
                        <div className="inline-flex flex-col">
                          <PointerUp className="size-2.5" />
                          <PointerUp className="size-2.5 rotate-180" />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                  <Loader text="Fetching Website Orders..." />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center text-gray-500 font-medium">
                  No orders found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-t border-stroke dark:border-dark-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="truncate px-3 py-4 text-sm text-dark-3 dark:text-gray-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Container */}
      <div className="flex justify-between items-center px-7.5 py-7 border-t border-stroke dark:border-dark-3">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(p) => setPagination(v => ({ ...v, page: p }))}
          isLoading={loading}
        />
        <p className="font-medium text-dark dark:text-white text-sm">
          Showing page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} records)
        </p>
      </div>

      {/* Details Modal */}
      <Modal open={!!viewDetailsModal} onClose={() => setViewDetailsModal(null)}>
        {viewDetailsModal && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 max-w-lg w-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Website Order Details</h3>
              <button onClick={() => setViewDetailsModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-stroke dark:border-dark-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Customer</div>
                  <div className="font-bold text-dark dark:text-white">{viewDetailsModal.fullName}</div>
                  <div className="text-xs text-gray-500 font-medium">{viewDetailsModal.phone}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-stroke dark:border-dark-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Website Token</div>
                  <div className="font-bold text-[#ff3d3d] tracking-widest">{viewDetailsModal.tokenNumber}</div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-stroke dark:border-dark-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Product Details</div>
                <div className="font-bold dark:text-white text-dark">{viewDetailsModal.productName}</div>
                <div className="grid grid-cols-3 gap-4 mt-3">
                  <div><div className="text-[9px] text-gray-400 uppercase">Total</div><div className="text-sm font-bold">Rs. {viewDetailsModal.totalDealValue.toLocaleString()}</div></div>
                  <div><div className="text-[9px] text-gray-400 uppercase">Advance</div><div className="text-sm font-bold">Rs. {viewDetailsModal.advanceAmount.toLocaleString()}</div></div>
                  <div><div className="text-[9px] text-gray-400 uppercase">Monthly</div><div className="text-sm font-bold">Rs. {viewDetailsModal.monthlyAmount.toLocaleString()}</div></div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-stroke dark:border-dark-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Address</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">{viewDetailsModal.address}</div>
                <div className="text-xs font-bold mt-1 text-dark dark:text-white">{viewDetailsModal.area}, {viewDetailsModal.city}</div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button onClick={() => setViewDetailsModal(null)} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Close</button>
                <button
                  onClick={() => { setPickupConfirmModal([viewDetailsModal]); setViewDetailsModal(null) }}
                  className="px-6 py-2.5 bg-[#ff3d3d] text-white rounded-xl text-sm font-bold shadow-lg shadow-red-100 hover:opacity-90 transition-all"
                >Pick Up Order</button>
                <button
                  onClick={() => { setCancelModal(viewDetailsModal); setViewDetailsModal(null) }}
                  className="px-6 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
                >Cancel Order</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Pickup Confirmation Modal */}
      <Modal open={!!pickupConfirmModal} onClose={() => setPickupConfirmModal(null)}>
        {pickupConfirmModal && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 max-w-md w-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Confirm Pickup</h3>
              <button onClick={() => setPickupConfirmModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-400 text-sm">Pickup selected order(s)?</h4>
                  <p className="text-amber-700 dark:text-amber-500/80 text-xs mt-1 leading-relaxed">This will create these orders as "Pending" in your local dashboard and assign them to you. This action cannot be undone.</p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                {pickupConfirmModal.map(o => (
                  <div key={o.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-3 rounded-lg text-sm border border-stroke dark:border-dark-3">
                    <div className="font-bold text-dark dark:text-white uppercase text-xs">{o.fullName} <span className="text-gray-400 font-normal">- {o.productName}</span></div>
                    <div className="font-black text-[#ff3d3d]">{o.tokenNumber}</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  disabled={isPickingUp}
                  onClick={() => setPickupConfirmModal(null)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >Cancel</button>
                <button
                  disabled={isPickingUp}
                  onClick={() => handlePickup(pickupConfirmModal)}
                  className="flex items-center justify-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 shadow-lg shadow-green-100 disabled:opacity-50 transition-all min-w-[180px]"
                >
                  {isPickingUp ? (
                    <Loader text="" className="py-0 gap-0 scale-50 h-5 w-5" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isPickingUp ? "Picking up..." : "Yes, Confirm Pickup"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Cancel Order Modal */}
      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)}>
        {cancelModal && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-800 max-w-md w-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">Cancel Website Order</h3>
              <button onClick={() => setCancelModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                  Are you sure you want to cancel order <span className="font-bold">#{cancelModal.tokenNumber}</span>? This will notify the customer and the website backend.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Reason for Cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Out of stock, Customer changed mind, etc."
                  className="w-full rounded-xl border border-stroke bg-transparent px-4 py-3 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 h-32 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  disabled={isCancelling}
                  onClick={() => setCancelModal(null)}
                  className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700"
                >Back</button>
                <button
                  disabled={isCancelling || !cancelReason.trim()}
                  onClick={handleCancelOrder}
                  className="flex items-center justify-center gap-2 px-8 py-2.5 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 shadow-lg shadow-red-100 disabled:opacity-50 transition-all min-w-[150px]"
                >
                  {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
