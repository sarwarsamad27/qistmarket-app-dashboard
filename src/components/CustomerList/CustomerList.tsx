'use client'
import { useEffect, useState } from 'react'
import Loader from '@/components/common/Loader'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import Cookies from 'js-cookie'
import { SearchIcon, PointerUp } from '@/assets/icons'
import ColumnFilter from '../DataTables/ColumnFilter'
import Pagination from '../common/Pagination'
import { Modal } from '../Modal/Modal'
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AdvancePayment {
  amount: number
  paid: boolean
  paidAt: string | null
  paymentMethod: string | null
  status: string
}

interface InstallmentEntry {
  monthNumber: number
  dueDate: string | null
  dueAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
  paidAt: string | null
  paymentMethod: string | null
  arrears?: number
}

interface LedgerSummary {
  totalInstallmentDue: number
  totalInstallmentPaid: number
  totalInstallmentRemaining: number
  grandTotalDue: number
  grandTotalPaid: number
  grandTotalRemaining: number
  paidInstallments: number
  pendingInstallments: number
  installmentsStarted: boolean
  firstInstallmentDate: string | null
}

interface OrderLedger {
  advance_payment: AdvancePayment
  installment_ledger: InstallmentEntry[]
  ledger_token: string | null
  summary: LedgerSummary
}

interface ProductDetails {
  product_name: string | null
  imei_serial: string | null
  color_variant: string | null
}

interface SelectedPlan {
  advance?: number
  totalPrice?: number
  monthlyAmount?: number
  monthly_amount?: number
  months?: number
  isActive?: boolean
  [key: string]: unknown
}

interface OrderPlan {
  selected_plan: SelectedPlan | null
  advance_amount: number
  monthly_amount: number
  months: number
  total_plan_value: number
}

interface CustomerOrder {
  order_id: number
  order_ref: string
  token_number: string
  status: string
  is_delivered: boolean
  delivery_date: string | null
  created_at: string
  verification_status: string | null
  product_details: ProductDetails
  plan: OrderPlan
  ledger: OrderLedger
}

interface CustomerLedgerSummary {
  totalOrders: number
  totalAdvanceReceived: number
  totalPaid: number
  totalRemaining: number
}

interface CustomerInfo {
  name: string
  father_husband_name: string | null
  cnic_number: string | null
  whatsapp_number: string
  telephone_number: string | null
  present_address: string | null
  permanent_address: string | null
  nearest_location: string | null
  city: string | null
  area: string | null
  profile_photo: string | null
  created_at?: string
}

interface CustomerGroup {
  customer: CustomerInfo
  ledgerSummary: CustomerLedgerSummary
  orders: CustomerOrder[]
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `Rs. ${Number(n).toLocaleString()}`

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '-'

const statusBadge = (status: string, paidAmount: number = 0, remainingAmount: number = 0) => {
  if (paidAmount > 0 && remainingAmount > 0 && status !== 'paid') {
     return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  }
  const map: Record<string, string> = {
    paid:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    pending: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const CustomerList = () => {
  const [customers, setCustomers]         = useState<CustomerGroup[]>([])
  const [pagination, setPagination]       = useState<PaginationInfo>({
    page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false,
  })
  const [totalOrders, setTotalOrders]     = useState(0)
  const [globalFilter, setGlobalFilter]   = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting]             = useState<SortingState>([{ id: 'customer_name', desc: false }])
  const [loading, setLoading]             = useState(false)
  const [detailsOpen, setDetailsOpen]     = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerGroup | null>(null)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchCustomers = async (page = pagination.page, limit = pagination.limit, search = globalFilter) => {
    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      if (!token) return

      const params = new URLSearchParams({
        page:   page.toString(),
        limit:  limit.toString(),
        search: search.trim(),
      })

      const res = await fetch(`${BACKEND_URL}/api/customers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to fetch customers"))
      const json = await res.json()

      if (json.success && json.data) {
        setCustomers(json.data.customers ?? [])
        setPagination(json.data.pagination)
        setTotalOrders(json.data.totalOrders ?? 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => { fetchCustomers(1, pagination.limit, globalFilter) }, [])

  // Search — debounced, reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      fetchCustomers(1, pagination.limit, globalFilter)
    }, 400)
    return () => clearTimeout(t)
  }, [globalFilter])

  const openDetails  = (c: CustomerGroup) => { setSelectedCustomer(c); setDetailsOpen(true) }
  const closeDetails = () => { setDetailsOpen(false); setSelectedCustomer(null) }

  const handlePageChange = (page: number) => {
    setPagination((p) => ({ ...p, page }))
    fetchCustomers(page, pagination.limit, globalFilter)
  }

  const handleLimitChange = (limit: number) => {
    setPagination((p) => ({ ...p, limit, page: 1 }))
    fetchCustomers(1, limit, globalFilter)
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<CustomerGroup>[] = [
    {
      id: 'customer_name',
      accessorFn: (row) => row.customer.name,
      header: 'Customer Name',
      enableColumnFilter: true,
    },
    {
      id: 'whatsapp_number',
      accessorFn: (row) => row.customer.whatsapp_number,
      header: 'WhatsApp',
      enableColumnFilter: true,
    },
    {
      id: 'cnic_number',
      accessorFn: (row) => row.customer.cnic_number || '-',
      header: 'CNIC',
      enableColumnFilter: true,
    },
    {
      id: 'city',
      accessorFn: (row) => row.customer.city || 'N/A',
      header: 'City',
      enableColumnFilter: true,
    },
    {
      id: 'area',
      accessorFn: (row) => row.customer.area || 'N/A',
      header: 'Area',
      enableColumnFilter: true,
    },
    {
      id: 'created_at',
      accessorFn: (row) => row.customer.created_at,
      header: 'Date & Time',
      enableColumnFilter: false,
      cell: ({ getValue }) => {
        const val = getValue() as string
        if (!val) return '-'
        const date = new Date(val)
        return (
          <div className="flex flex-col">
            <span className="font-medium text-dark dark:text-white">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )
      },
    },
    {
      id: 'total_orders',
      accessorFn: (row) => row.ledgerSummary.totalOrders,
      header: 'Orders',
      enableColumnFilter: false,
      cell: ({ getValue }) => (
        <div className="rounded-lg bg-gray-100 px-2 py-1 text-center font-medium dark:bg-gray-700 dark:text-gray-200">
          {Number(getValue())}
        </div>
      ),
    },
    {
      id: 'total_paid',
      accessorFn: (row) => row.ledgerSummary.totalPaid,
      header: 'Total Paid',
      enableColumnFilter: false,
      cell: ({ getValue }) => (
        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
          {fmt(Number(getValue()))}
        </div>
      ),
    },
    {
      id: 'total_remaining',
      accessorFn: (row) => row.ledgerSummary.totalRemaining,
      header: 'Total Due',
      enableColumnFilter: false,
      cell: ({ getValue }) => (
        <div className="font-semibold text-red-500">
          {fmt(Number(getValue()))}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <button
          onClick={() => openDetails(row.original)}
          className="rounded-md bg-[#ff3d3d] px-3 py-1.5 text-sm text-white hover:bg-[#e03131]"
        >
          View Details
        </button>
      ),
    },
  ]

  const table = useReactTable({
    data: customers,
    columns,
    state: {
      globalFilter,
      columnFilters,
      sorting,
      pagination: { pageIndex: pagination.page - 1, pageSize: pagination.limit },
    },
    pageCount:          pagination.totalPages,
    manualPagination:   true,
    manualSorting:      true,
    manualFiltering:    true,
    enableRowSelection: false,
    onGlobalFilterChange:  setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange:       setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.limit })
        : updater
      handlePageChange(next.pageIndex + 1)
    },
    getCoreRowModel:       getCoreRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-7.5 py-4.5">
        <div className="relative z-20 w-full max-w-[414px]">
          <input
            type="text"
            value={globalFilter || ''}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
            }}
            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d]"
            placeholder="Search by name, WhatsApp, CNIC, city..."
          />
          <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white">
            <SearchIcon className="size-4.5" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <p className="pl-2 font-medium text-dark dark:text-current">Per Page:</p>
            <select
              value={pagination.limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="bg-transparent pl-2.5 font-medium"
            >
              {[5, 10, 15, 20, 50].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
            <span>
              Customers: <strong className="text-dark dark:text-white">{pagination.total}</strong>
            </span>
            <span>
              Orders: <strong className="text-dark dark:text-white">{totalOrders}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="grid grid-cols-1 overflow-x-auto">
        <table className="datatable-table datatable-one !border-collapse px-4 md:px-8">
          <thead className="border-separate px-4">
            {table.getHeaderGroups().map((hg) => (
              <tr className="border-t border-stroke dark:border-dark-3" key={hg.id}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-3 py-4 align-top">
                    <div className="flex min-h-[70px] flex-col">
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
                      {header.column.getCanFilter() && header.column.id !== 'select' && (
                        <div className="mt-2">
                          <ColumnFilter
                            column={{
                              filterValue: header.column.getFilterValue() as string,
                              setFilter:   header.column.setFilterValue,
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
                <td colSpan={columns.length} className="py-12 text-center">
                  <Loader text="Loading customers..." />
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  No customers found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr className="border-t border-stroke dark:border-dark-3" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="truncate px-3 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-7.5 py-7">
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          isLoading={loading}
        />
        <p className="font-medium text-dark dark:text-white">
          Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} customers)
        </p>
      </div>

      {/* ── View Details Modal ─────────────────────────────────────────────── */}
      <Modal
        open={detailsOpen}
        onClose={closeDetails}
        className="max-w-4xl rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Customer header */}
            <div className="flex gap-4 border-b border-stroke pb-5 dark:border-dark-3">
              {selectedCustomer.customer.profile_photo ? (
                <img
                  src={selectedCustomer.customer.profile_photo}
                  alt="Profile"
                  className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-2 ring-[#ff3d3d]"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold text-gray-400 dark:bg-dark-3">
                  {selectedCustomer.customer.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 space-y-1">
                <h2 className="text-xl font-semibold text-dark dark:text-white">
                  {selectedCustomer.customer.name}
                </h2>
                {selectedCustomer.customer.father_husband_name && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    S/O, D/O, W/O:{' '}
                    <span className="font-medium text-dark dark:text-white">
                      {selectedCustomer.customer.father_husband_name}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <span>📞 {selectedCustomer.customer.whatsapp_number}</span>
                  {selectedCustomer.customer.telephone_number &&
                    selectedCustomer.customer.telephone_number !== selectedCustomer.customer.whatsapp_number && (
                      <span>☎️ {selectedCustomer.customer.telephone_number}</span>
                    )}
                  {selectedCustomer.customer.cnic_number && (
                    <span>🪪 {selectedCustomer.customer.cnic_number}</span>
                  )}
                </div>
                {selectedCustomer.customer.present_address && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    📍 {selectedCustomer.customer.present_address}
                    {selectedCustomer.customer.area  ? `, ${selectedCustomer.customer.area}`  : ''}
                    {selectedCustomer.customer.city  ? `, ${selectedCustomer.customer.city}`  : ''}
                  </p>
                )}
                {selectedCustomer.customer.nearest_location && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Nearest Location: {selectedCustomer.customer.nearest_location}
                  </p>
                )}
              </div>
            </div>

            {/* Ledger summary pills */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-dark-3 dark:text-gray-200">
                Orders: <strong>{selectedCustomer.ledgerSummary.totalOrders}</strong>
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Advance Received: <strong>{fmt(selectedCustomer.ledgerSummary.totalAdvanceReceived)}</strong>
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                Total Paid: <strong>{fmt(selectedCustomer.ledgerSummary.totalPaid)}</strong>
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                Total Remaining: <strong>{fmt(selectedCustomer.ledgerSummary.totalRemaining)}</strong>
              </span>
            </div>

            {/* Orders list */}
            <div>
              <h3 className="mb-3 text-lg font-semibold text-dark dark:text-white">Orders & Ledger</h3>
              {selectedCustomer.orders.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No orders found.</p>
              ) : (
                <div className="max-h-[480px] space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedCustomer.orders.map((order) => (
                    <div
                      key={order.order_id}
                      className="rounded-xl border border-stroke bg-gray-50 p-4 text-sm dark:border-dark-3 dark:bg-dark-3"
                    >
                      {/* Order header */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-dark dark:text-white">
                            {order.product_details.product_name || 'Product N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Ref: {order.order_ref} • Token: {order.token_number}
                          </p>
                          {order.product_details.imei_serial && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              IMEI / Serial: {order.product_details.imei_serial}
                            </p>
                          )}
                          {order.product_details.color_variant && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Color: {order.product_details.color_variant}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Created: {fmtDate(order.created_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {order.status}
                          </span>
                          {order.is_delivered && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              ✓ Delivered {fmtDate(order.delivery_date)}
                            </span>
                          )}
                          {order.verification_status && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                              Verification: {order.verification_status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Plan info */}
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Advance</p>
                          <p className="font-semibold text-dark dark:text-white">
                            {fmt(order.plan.advance_amount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Monthly / Months</p>
                          <p className="font-semibold text-dark dark:text-white">
                            {fmt(order.plan.monthly_amount)} × {order.plan.months}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total Plan Value</p>
                          <p className="font-semibold text-dark dark:text-white">
                            {fmt(order.plan.total_plan_value)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Grand Remaining</p>
                          <p className="font-semibold text-red-500">
                            {fmt(order.ledger.summary.grandTotalRemaining)}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {order.ledger.summary.paidInstallments} paid /{' '}
                            {order.ledger.summary.pendingInstallments} pending
                          </p>
                        </div>
                      </div>

                      {/* Grand totals strip */}
                      <div className="mt-2 flex flex-wrap gap-4 rounded-lg bg-white px-3 py-2 text-xs dark:bg-gray-900">
                        <span className="text-gray-500 dark:text-gray-400">
                          Grand Due:{' '}
                          <span className="font-semibold text-dark dark:text-white">
                            {fmt(order.ledger.summary.grandTotalDue)}
                          </span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Grand Paid:{' '}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {fmt(order.ledger.summary.grandTotalPaid)}
                          </span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Inst. Due:{' '}
                          <span className="font-semibold text-dark dark:text-white">
                            {fmt(order.ledger.summary.totalInstallmentDue)}
                          </span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Inst. Paid:{' '}
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {fmt(order.ledger.summary.totalInstallmentPaid)}
                          </span>
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          Inst. Remaining:{' '}
                          <span className="font-semibold text-red-500">
                            {fmt(order.ledger.summary.totalInstallmentRemaining)}
                          </span>
                        </span>
                      </div>

                      {/* Advance + installments */}
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Advance Payment
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-200">
                            Amount: <span className="font-semibold">{fmt(order.ledger.advance_payment.amount)}</span>
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-200">
                            Status:{' '}
                            <span className={`font-semibold ${order.ledger.advance_payment.paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                              {order.ledger.advance_payment.status}
                            </span>
                          </p>
                          {order.ledger.advance_payment.paymentMethod && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Via: {order.ledger.advance_payment.paymentMethod}
                            </p>
                          )}
                          {order.ledger.advance_payment.paidAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Paid At: {new Date(order.ledger.advance_payment.paidAt).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg bg-white p-3 dark:bg-gray-900 md:col-span-2">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Installments Timeline
                            </h4>
                            {order.ledger.ledger_token && (
                              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                #{order.ledger.ledger_token}
                              </span>
                            )}
                          </div>
                          {order.ledger.installment_ledger.length === 0 ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">No installments configured.</p>
                          ) : (
                            <div className="max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-stroke text-[10px] uppercase text-gray-500 dark:border-dark-3 dark:text-gray-400">
                                    <th className="pb-1 pr-2 text-left">#</th>
                                    <th className="pb-1 pr-2 text-left">Due Date</th>
                                    <th className="pb-1 pr-2 text-right">Due</th>
                                    <th className="pb-1 pr-2 text-right">Paid</th>
                                    <th className="pb-1 pr-2 text-right">Rem.</th>
                                    <th className="pb-1 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {order.ledger.installment_ledger.map((inst, i) => (
                                    <tr key={i} className="border-b border-stroke last:border-0 dark:border-dark-3">
                                      <td className="py-1 pr-2">#{inst.monthNumber}</td>
                                      <td className="py-1 pr-2">{fmtDate(inst.dueDate)}</td>
                                      <td className="py-1 pr-2 text-right">
                                        <div className="font-semibold">{fmt(inst.dueAmount)}</div>
                                        {inst.arrears ? (
                                          <div className="text-[9px] font-medium text-red-500 whitespace-nowrap">
                                            Inc. Arrears: {fmt(inst.arrears || 0)}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="py-1 pr-2 text-right">
                                        {inst.paidAmount > 0 ? fmt(inst.paidAmount) : '-'}
                                      </td>
                                      <td className="py-1 pr-2 text-right">
                                        {(inst.remainingAmount > 0 || (inst.arrears || 0) > 0) ? (
                                           (inst.arrears || 0) > 0 ? (
                                             <div>
                                               <span className="font-bold text-red-500">{fmt(inst.remainingAmount + (inst.arrears || 0))}</span>
                                               <div className="text-[8px] text-gray-400 font-normal">
                                                 ({fmt(inst.remainingAmount)} + {fmt(inst.arrears || 0)} arr)
                                               </div>
                                             </div>
                                           ) : (
                                             fmt(inst.remainingAmount)
                                           )
                                         ) : '-'}
                                      </td>
                                      <td className="py-1 text-right">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(inst.status, inst.paidAmount, inst.remainingAmount)}`}>
                                          {inst.paidAmount > 0 && inst.remainingAmount > 0 && inst.status !== 'paid' ? 'Partial' : inst.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

export default CustomerList