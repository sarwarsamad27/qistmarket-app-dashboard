'use client'
import { useEffect, useState } from 'react'
import Loader from '@/components/common/Loader'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import Cookies from 'js-cookie'
import { SearchIcon, PointerUp, ChevronUpIcon, ChevronLeft, ChevronRight } from '@/assets/icons'
import ColumnFilter from '../DataTables/ColumnFilter'
import { Modal } from '../Modal/Modal'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useRef } from 'react'
import Pagination from '../common/Pagination'
import { formatExactDate } from "@/utils/dateUtils";
import { apiErrorMessage } from "@/lib/apiErrors";


const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

// ─────────────────────────────────────────────────────────────────────────────
// Types (aligned with your prisma select)
// ─────────────────────────────────────────────────────────────────────────────
interface UserSelect {
  id: number
  username: string
  full_name: string
}

interface VerificationNested {
  id: number
  status: 'in_progress' | 'completed'
  start_time: string
  end_time: string | null
  is_approved: boolean | null
  admin_remarks: string | null
  approved_at: string | null
  verification_officer: UserSelect
  approved_by_user: UserSelect | null
  purchaser: any | null          // adjust type if you have schema
  grantors: any[]                // adjust type
  nextOfKin: any | null
  locations: Array<{ timestamp: string /* + other fields */ }>
  documents: Array<{ uploaded_at: string /* + other fields */ }>
  home_location_required: boolean
  home_location_verified: boolean
}

interface OrderWithVerification {
  id: number
  order_ref: string
  token_number: string
  customer_name: string
  whatsapp_number: string
  address: string
  city: string | null
  area: string | null
  product_name: string
  total_amount: number
  advance_amount: number
  monthly_amount: number
  months: number
  channel: string
  status: string
  created_at: string
  updated_at: string
  assigned_to: UserSelect | null
  delivery_officer: UserSelect | null
  created_by: { username: string; full_name: string } | null

  verification: VerificationNested | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const AssignedVerifications = () => {
  const [orders, setOrders] = useState<OrderWithVerification[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  })

  const searchParams = useSearchParams()
  const urlDateRange = searchParams.get('dateRange')
  const urlStartDate = searchParams.get('startDate')
  const urlEndDate = searchParams.get('endDate')

  const parseDateRange = (raw: string | null) => {
    if (!raw) return 'All'
    const lower = raw.toLowerCase()
    if (lower === 'day' || lower === 'today') return 'Day'
    if (lower === 'month') return 'Month'
    if (lower === 'week') return 'Week'
    if (lower === 'quarter') return 'Quarter'
    if (lower === 'year') return 'Year'
    if (lower === 'custom range' || lower === 'custom') return 'Custom Range'
    return raw
  }

  // Filtration
  const [dateRange, setDateRange] = useState(() => parseDateRange(urlDateRange))
  const [startDate, setStartDate] = useState(() => urlStartDate || '')
  const [endDate, setEndDate] = useState(() => urlEndDate || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (urlDateRange) {
      const parsed = parseDateRange(urlDateRange)
      setDateRange(parsed)
      if (urlStartDate) setStartDate(urlStartDate)
      if (urlEndDate) setEndDate(urlEndDate)
    }
  }, [urlDateRange, urlStartDate, urlEndDate])

  // Modals (remarks only, view modal removed)
  const [remarksModalOpen, setRemarksModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithVerification | null>(null)
  const [adminRemarks, setAdminRemarks] = useState('')

  const router = useRouter()

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchAssignedVerifications = async () => {
    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      if (!token) return

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: globalFilter.trim(),
        sortBy: sorting[0]?.id || 'updated_at',
        sortDir: sorting[0]?.desc ? 'desc' : 'asc',
      })

      if (dateRange !== 'All') {
        params.append('dateRange', dateRange)
        if (dateRange === 'Custom Range' && startDate && endDate) {
          params.append('startDate', startDate)
          params.append('endDate', endDate)
        }
      }

      columnFilters.forEach((f) => {
        if (f.id && f.value) params.append(f.id, String(f.value))
      })

      const res = await fetch(`${BACKEND_URL}/api/orders/verification-pending?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to load verifications"))
      const json = await res.json()

      if (json.success && json.data?.orders) {
        setOrders(json.data.orders)
        setPagination(json.data.pagination)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignedVerifications()
  }, [pagination.page, pagination.limit, globalFilter, columnFilters, sorting, dateRange, startDate, endDate])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleView = (order: OrderWithVerification) => {
    router.push(`/verifications/${order.id}`)
  }

  const saveRemarks = async () => {
    if (!selectedOrder?.verification?.id) return

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(
        `${BACKEND_URL}/api/verifications/${selectedOrder.verification.id}/remarks`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ admin_remarks: adminRemarks.trim() || null }),
        }
      )

      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to save remarks"))
      await fetchAssignedVerifications()
      setRemarksModalOpen(false)
      setSelectedOrder(null)
      setAdminRemarks('')
    } catch (err) {
      console.error('Remarks save failed:', err)
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<OrderWithVerification>[] = [
    {
      accessorKey: 'updated_at',
      header: 'Activity Date',
      cell: ({ row, getValue }) => {
        const isDelivered = (row.original.status || '').toLowerCase() === 'delivered' || (row.original as any).is_delivered
        const rawVal = getValue() as string
        const val = isDelivered ? ((row.original as any).delivered_at || rawVal) : rawVal
        const createdAt = row.original.created_at
        return (
          <div className="flex flex-col">
            <span className="font-bold text-dark dark:text-white">
              {val ? formatExactDate(val, 'MMM DD, YYYY hh:mm A') : 'N/A'}
            </span>
            {createdAt && (
              <span className="text-[10px] text-gray-400">
                Placed: {formatExactDate(createdAt, 'MMM DD, YYYY')}
              </span>
            )}
          </div>
        )
      },
      enableColumnFilter: true,
    },
    {
      accessorKey: 'order_ref',
      header: 'Order Ref',
      enableColumnFilter: true,
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer',
      enableColumnFilter: true,
    },
    {
      accessorKey: 'whatsapp_number',
      header: 'WhatsApp',
      enableColumnFilter: true,
    },
    {
      accessorKey: 'city',
      header: 'City',
      enableColumnFilter: true,
    },
    { accessorKey: 'area', header: 'Area', enableColumnFilter: true },
    {
      accessorKey: 'product_name',
      header: 'Suggested Product',
      enableColumnFilter: true,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableColumnFilter: true,
      cell: ({ row }) => {
        const order = row.original
        const status = order.status
        const homeLocationRequired = order.verification?.home_location_required
        const homeLocationVerified = order.verification?.home_location_verified

        return (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                'inline-flex w-fit px-2.5 py-1 rounded-full text-xs font-medium',
                status === 'completed' || status === 'approved'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              )}
            >
              {status === 'completed' ? 'Completed' : status === 'approved' ? 'Approved' : 'Cancelled'}
            </span>
            {homeLocationRequired && (
              <span className={cn(
                "inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border",
                homeLocationVerified
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-400 animate-pulse"
              )}>
                📍 Home Location {homeLocationVerified ? 'Verified' : 'Required'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'officer',
      header: 'Verification Officer',
      accessorFn: (row) => row.verification?.verification_officer?.username || '—',
      enableColumnFilter: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      enableColumnFilter: false,
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

          const dropdownWidth = 192
          const dropdownHeight = 170

          const spaceBelow = window.innerHeight - rect.bottom
          const spaceRight = window.innerWidth - rect.right

          const shouldOpenUp = spaceBelow < dropdownHeight
          const shouldAlignLeft = spaceRight < dropdownWidth

          setOpenUp(shouldOpenUp)

          setPosition({
            top: shouldOpenUp
              ? rect.top + window.scrollY - 8
              : rect.bottom + window.scrollY + 6,
            left: shouldAlignLeft
              ? rect.left + window.scrollX
              : rect.right + window.scrollX - dropdownWidth,
          })

          setIsOpen((prev) => !prev)
        }

        // Outside click + ESC support
        useEffect(() => {
          const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node

            if (
              triggerRef.current &&
              !triggerRef.current.contains(target) &&
              dropdownRef.current &&
              !dropdownRef.current.contains(target)
            ) {
              setIsOpen(false)
            }
          }

          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              setIsOpen(false)
            }
          }

          if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('keydown', handleEscape)
          }

          return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
          }
        }, [isOpen])

        return (
          <>
            <button
              ref={triggerRef}
              onClick={toggleDropdown}
              className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-dark shadow-[0_1px_3px_0_rgba(166,175,195,0.4)] hover:text-[#ff3d3d] dark:border dark:border-dark-3 dark:text-white dark:shadow-none"
            >
              <span>Actions</span>
              <ChevronUpIcon
                className={`size-4 transition-transform ${isOpen ? 'rotate-0' : 'rotate-180'
                  }`}
              />
            </button>

            {isOpen &&
              createPortal(
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute',
                    top: position.top,
                    left: position.left,
                    transform: openUp ? 'translateY(-100%)' : 'none',
                  }}
                  className="z-[99999] w-48 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900"
                >
                  <ul className="overflow-hidden text-sm font-medium">

                    <li>
                      <button
                        onClick={() => {
                          handleView(order)
                          setIsOpen(false)
                        }}
                        className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                      >
                        View for Verification
                      </button>
                    </li>

                  </ul>
                </div>,
                document.body
              )}
          </>
        )
      },
    }
  ]

  const table = useReactTable({
    data: orders,
    columns,
    state: {
      globalFilter,
      columnFilters,
      sorting,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const newState =
        typeof updater === 'function'
          ? updater({
            pageIndex: pagination.page - 1,
            pageSize: pagination.limit,
          })
          : updater
      setPagination((prev) => ({
        ...prev,
        page: newState.pageIndex + 1,
        limit: newState.pageSize,
      }))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Top bar */}
      <div className="flex flex-col gap-4 px-7.5 py-4.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative z-20 w-full max-w-[500px]">
          <input
            type="text"
            value={globalFilter ?? ''}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              setPagination(p => ({ ...p, page: 1 }))
            }}
            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
            placeholder="Search order ref, customer, officer, remarks..."
          />
          <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white">
            <SearchIcon className="size-4.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center font-medium gap-4">
          <div className="flex items-center">
            <p className="pr-2 text-dark dark:text-current">Date Range:</p>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value)
                setPagination((p) => ({ ...p, page: 1 }))
              }}
              className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 font-medium"
            >
              {['All', 'Day', 'Week', 'Month', 'Quarter', 'Year', 'Custom Range'].map((r) => (
                <option key={r} value={r} className='dark:bg-dark-2'>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {dateRange === 'Custom Range' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-stroke bg-transparent px-2 py-1 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-stroke bg-transparent px-2 py-1 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
              />
            </div>
          )}

          <div className="flex items-center">
            <p className="pl-2 font-medium text-dark dark:text-current">Per Page:</p>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))}
              className="bg-transparent pl-2.5 outline-none"
            >
              {[5, 10, 15, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className=" grid grid-cols-1 overflow-x-auto">
        <table className="datatable-table datatable-one !border-collapse w-full px-4 md:px-8">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                className="border-t border-stroke dark:border-dark-3"
                key={headerGroup.id}
              >
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-3 py-4 align-top">
                    <div className="flex flex-col min-h-[70px]">
                      <div
                        className="flex cursor-pointer items-center"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="font-[500]">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {header.column.getCanSort() && (
                          <div className="ml-2 inline-flex flex-col">
                            <PointerUp className="size-2.5" />
                            <PointerUp className="size-2.5 rotate-180" />
                          </div>
                        )}
                      </div>

                      {header.column.getCanFilter() && (
                        <div className="mt-2">
                          <ColumnFilter
                            column={{
                              filterValue: header.column.getFilterValue() as string,
                              setFilter: header.column.setFilterValue,
                            }}
                          />
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
                  <Loader text="Loading verifications..." />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                  No assigned orders with verification records found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  className="border-t border-stroke dark:border-dark-3 hover:bg-gray-50/50 dark:hover:bg-dark-2/50"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="truncate px-3 py-3.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center px-7.5 py-7">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page: number) => setPagination((p) => ({ ...p, page }))}
          isLoading={loading}
        />
        <p className="font-medium text-dark dark:text-white">
          Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
        </p>
      </div>

      {/* Remarks Modal */}
      <Modal
        open={remarksModalOpen}
        onClose={() => {
          setRemarksModalOpen(false)
          setSelectedOrder(null)
          setAdminRemarks('')
        }}
        className="max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {selectedOrder?.verification?.admin_remarks ? 'Edit' : 'Add'} Admin Remarks
        </h2>
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Order: <strong>{selectedOrder?.order_ref}</strong> — Officer:{' '}
          {selectedOrder?.verification?.verification_officer?.full_name ||
            selectedOrder?.verification?.verification_officer?.username ||
            '—'}
        </p>
        <textarea
          value={adminRemarks}
          onChange={(e) => setAdminRemarks(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
          placeholder="Internal notes, approval reasoning, issues found, etc..."
        />
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setRemarksModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            onClick={saveRemarks}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90"
          >
            Save
          </button>
        </div>
      </Modal>
    </section>
  )
}

export default AssignedVerifications