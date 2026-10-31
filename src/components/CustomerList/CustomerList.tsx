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
import { serialColumn } from '@/utils/serialColumn'

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

// Extended Profile Types
interface RecoveryOfficer {
  id: number
  full_name: string
  username: string
  phone: string | null
  status: string
  is_online: boolean
  last_online_at: string | null
  working_hours: string | null
}

interface VerificationOfficer {
  id: number
  full_name: string
  username: string
  phone: string | null
}

interface VerificationRecord {
  id: number
  status: string
  visit_date: string | null
  officer: VerificationOfficer | null
  purchaser: any
  grantors: any[]
  documents: { id: number; document_type: string; person_type: string; file_url: string; label: string; uploaded_at: string }[]
}

interface RecoveryVisit {
  id: number
  visit_time: string
  feedback: string | null
  notes: string | null
  payment_collected: boolean
  amount_collected: number | null
  fuel_charges: number | null
  latitude: number | null
  longitude: number | null
  officer: { id: number; full_name: string; phone: string | null } | null
  photos: { id: number; file_url: string; uploaded_at: string }[]
}

interface TimelineEntry {
  type: 'visit' | 'ptp' | 'payment'
  date: string
  feedback?: string | null
  notes?: string | null
  payment_collected?: boolean
  amount_collected?: number | null
  officer_name?: string | null
  photos?: string[]
  source?: string
  promised_date?: string
  status?: string
  transaction_id?: string | null
  payment_method?: string | null
}

interface OverdueInstallment {
  month: number
  due_date: string
  due_amount: number
  paid_amount: number
  remaining_amount: number
  arrears: number
  days_overdue: number
  status: string
  severity: 'critical' | 'high' | 'medium'
}

interface UpcomingInstallment {
  month: number
  due_date: string
  due_amount: number
  paid_amount: number
  remaining_amount: number
  days_until_due: number
  status: string
}

interface DuePaymentAlerts {
  overdue: OverdueInstallment[]
  upcoming: UpcomingInstallment[]
  total_overdue_amount: number
  total_upcoming_amount: number
  summary: { grand_total_remaining: number; paid_installments: number; pending_installments: number }
}

interface ExtendedProfile {
  recovery_officer: RecoveryOfficer | null
  verification: VerificationRecord | null
  recovery_history: RecoveryVisit[]
  timeline: TimelineEntry[]
  due_payment_alerts: DuePaymentAlerts
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

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString('en-PK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
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

type ProfileTab = 'overview' | 'recovery' | 'timeline' | 'verification' | 'alerts'

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
  const [activeTab, setActiveTab]         = useState<ProfileTab>('overview')
  const [extProfile, setExtProfile]       = useState<ExtendedProfile | null>(null)
  const [extLoading, setExtLoading]       = useState(false)

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

  const fetchExtendedProfile = async (orderId: number) => {
    setExtLoading(true)
    setExtProfile(null)
    try {
      const token = Cookies.get('auth_token')
      if (!token) return
      const res = await fetch(`${BACKEND_URL}/api/customers/order/${orderId}/extended-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load extended profile')
      const json = await res.json()
      if (json.success && json.data) setExtProfile(json.data)
    } catch (err) {
      console.error(err)
    } finally {
      setExtLoading(false)
    }
  }

  useEffect(() => { fetchCustomers(1, pagination.limit, globalFilter) }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCustomers(1, pagination.limit, globalFilter)
    }, 400)
    return () => clearTimeout(t)
  }, [globalFilter])

  const openDetails = (c: CustomerGroup) => {
    setSelectedCustomer(c)
    setDetailsOpen(true)
    setActiveTab('overview')
    setExtProfile(null)
    const firstOrderId = c.orders[0]?.order_id
    if (firstOrderId) fetchExtendedProfile(firstOrderId)
  }
  const closeDetails = () => { setDetailsOpen(false); setSelectedCustomer(null); setExtProfile(null) }

  const handlePageChange = (page: number) => {
    setPagination((p) => ({ ...p, page }))
    fetchCustomers(page, pagination.limit, globalFilter)
  }

  const handleLimitChange = (limit: number) => {
    setPagination((p) => ({ ...p, limit, page: 1 }))
    fetchCustomers(1, limit, globalFilter)
  }

  const columns: ColumnDef<CustomerGroup>[] = [
    serialColumn<CustomerGroup>(),
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

  const severityStyle = (sev: string) => {
    if (sev === 'critical') return 'border-l-4 border-red-600 bg-red-50 dark:bg-red-900/20'
    if (sev === 'high')     return 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20'
    return                         'border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
  }
  const severityBadge = (sev: string) => {
    if (sev === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    if (sev === 'high')     return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
    return                         'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
  }

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'overview',     label: 'Overview'         },
    { id: 'recovery',     label: 'Recovery History' },
    { id: 'timeline',     label: 'Timeline'         },
    { id: 'verification', label: 'Verification'     },
    { id: 'alerts',       label: 'Payment Alerts'   },
  ]

  return (
    <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-7.5 py-4.5">
        <div className="relative z-20 w-full max-w-[414px]">
          <input
            type="text"
            value={globalFilter || ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
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
            <span>Customers: <strong className="text-dark dark:text-white">{pagination.total}</strong></span>
            <span>Orders: <strong className="text-dark dark:text-white">{totalOrders}</strong></span>
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
                <td colSpan={columns.length} className="py-12 text-center">No customers found</td>
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

      {/* Pagination */}
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

      {/* View Details Modal */}
      <Modal
        open={detailsOpen}
        onClose={closeDetails}
        className="max-w-5xl rounded-2xl bg-white p-0 shadow-xl dark:bg-gray-800 overflow-hidden"
      >
        {selectedCustomer && (
          <div className="flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="shrink-0 bg-gradient-to-r from-[#ff3d3d] to-[#c0392b] px-6 py-5">
              <div className="flex items-center gap-4">
                {selectedCustomer.customer.profile_photo ? (
                  <img
                    src={selectedCustomer.customer.profile_photo}
                    alt="Profile"
                    className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-4 ring-white/40"
                  />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-black text-white ring-4 ring-white/30">
                    {selectedCustomer.customer.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-black text-white truncate">{selectedCustomer.customer.name}</h2>
                  {selectedCustomer.customer.father_husband_name && (
                    <p className="text-sm text-red-100">S/O, D/O, W/O: {selectedCustomer.customer.father_husband_name}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-red-100">
                    <span>{selectedCustomer.customer.whatsapp_number}</span>
                    {selectedCustomer.customer.cnic_number && <span>CNIC: {selectedCustomer.customer.cnic_number}</span>}
                    {selectedCustomer.customer.city && <span>{selectedCustomer.customer.city}</span>}
                  </div>
                </div>
                {extProfile && extProfile.due_payment_alerts.overdue.length > 0 && (
                  <div className="shrink-0 flex flex-col items-center bg-white/20 rounded-xl px-4 py-2 text-white">
                    <span className="text-2xl font-black">{extProfile.due_payment_alerts.overdue.length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 flex border-b border-stroke dark:border-dark-3 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'text-[#ff3d3d]'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'alerts' && extProfile && extProfile.due_payment_alerts.overdue.length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                      {extProfile.due_payment_alerts.overdue.length}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff3d3d] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-800 p-6">

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 text-center border border-stroke dark:border-dark-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Orders</p>
                      <p className="text-xl font-black text-dark dark:text-white">{selectedCustomer.ledgerSummary.totalOrders}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 text-center border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Advance Received</p>
                      <p className="text-sm font-black text-blue-700 dark:text-blue-300">{fmt(selectedCustomer.ledgerSummary.totalAdvanceReceived)}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 text-center border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Total Paid</p>
                      <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">{fmt(selectedCustomer.ledgerSummary.totalPaid)}</p>
                    </div>
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-center border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 mb-1">Total Remaining</p>
                      <p className="text-sm font-black text-red-600 dark:text-red-400">{fmt(selectedCustomer.ledgerSummary.totalRemaining)}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Orders & Ledger</h3>
                    {selectedCustomer.orders.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No orders found.</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedCustomer.orders.map((order) => (
                          <div key={order.order_id} className="rounded-xl border border-stroke bg-gray-50 p-4 text-sm dark:border-dark-3 dark:bg-dark-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-dark dark:text-white">{order.product_details.product_name || 'Product N/A'}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Ref: {order.order_ref} &bull; Token: {order.token_number}</p>
                                {order.product_details.imei_serial && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">IMEI: {order.product_details.imei_serial}</p>
                                )}
                                {order.product_details.color_variant && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Color: {order.product_details.color_variant}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Created: {fmtDate(order.created_at)}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">{order.status}</span>
                                {order.is_delivered && (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    Delivered {fmtDate(order.delivery_date)}
                                  </span>
                                )}
                                {order.verification_status && (
                                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                    Verification: {order.verification_status}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Advance</p>
                                <p className="font-semibold text-dark dark:text-white">{fmt(order.plan.advance_amount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Monthly / Months</p>
                                <p className="font-semibold text-dark dark:text-white">{fmt(order.plan.monthly_amount)} x {order.plan.months}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Plan Value</p>
                                <p className="font-semibold text-dark dark:text-white">{fmt(order.plan.total_plan_value)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Grand Remaining</p>
                                <p className="font-semibold text-red-500">{fmt(order.ledger.summary.grandTotalRemaining)}</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">{order.ledger.summary.paidInstallments} paid / {order.ledger.summary.pendingInstallments} pending</p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-lg bg-white p-3 dark:bg-gray-900">
                              <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Installments Timeline</h4>
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
                                          <td className="py-1 pr-2 text-right">{inst.paidAmount > 0 ? fmt(inst.paidAmount) : '-'}</td>
                                          <td className="py-1 pr-2 text-right">
                                            {(inst.remainingAmount > 0 || (inst.arrears || 0) > 0) ? (
                                              (inst.arrears || 0) > 0 ? (
                                                <div>
                                                  <span className="font-bold text-red-500">{fmt(inst.remainingAmount + (inst.arrears || 0))}</span>
                                                  <div className="text-[8px] text-gray-400 font-normal">
                                                    ({fmt(inst.remainingAmount)} + {fmt(inst.arrears || 0)} arr)
                                                  </div>
                                                </div>
                                              ) : fmt(inst.remainingAmount)
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
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* RECOVERY HISTORY TAB */}
              {activeTab === 'recovery' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Recovery Visit History</h3>
                  {extLoading ? (
                    <div className="py-12 text-center"><Loader text="Loading recovery history..." /></div>
                  ) : !extProfile || extProfile.recovery_history.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-4xl mb-4">--</p>
                      <p className="text-sm font-semibold text-gray-400">No recovery visits recorded yet.</p>
                    </div>
                  ) : (
                    extProfile.recovery_history.map((visit, idx) => (
                      <div key={visit.id || idx} className="rounded-xl border border-stroke bg-gray-50 dark:bg-gray-900 dark:border-dark-3 p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${visit.payment_collected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                {visit.payment_collected ? 'Payment Collected' : 'Visit Only'}
                              </span>
                              {visit.payment_collected && visit.amount_collected != null && (
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmt(visit.amount_collected)}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fmtDateTime(visit.visit_time)}</p>
                            {visit.officer && (
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                                Officer: {visit.officer.full_name}{visit.officer.phone ? ` - ${visit.officer.phone}` : ''}
                              </p>
                            )}
                          </div>
                          {visit.fuel_charges != null && visit.fuel_charges > 0 && (
                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full px-2.5 py-0.5 font-semibold">
                              Fuel: {fmt(visit.fuel_charges)}
                            </span>
                          )}
                        </div>
                        {visit.feedback && (
                          <div className="mt-3 rounded-lg bg-white dark:bg-gray-800 border border-stroke dark:border-dark-3 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">Feedback</p>
                            <p className="text-sm text-gray-700 dark:text-gray-200">{visit.feedback}</p>
                          </div>
                        )}
                        {visit.notes && (
                          <div className="mt-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-blue-500 mb-1">Notes</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">{visit.notes}</p>
                          </div>
                        )}
                        {visit.photos.length > 0 && (
                          <div className="mt-3 flex gap-2 flex-wrap">
                            {visit.photos.map((photo, pi) => (
                              <a key={pi} href={photo.file_url} target="_blank" rel="noreferrer">
                                <img
                                  src={photo.file_url}
                                  alt={`Visit photo ${pi + 1}`}
                                  className="h-16 w-16 rounded-lg object-cover border border-stroke dark:border-dark-3 hover:opacity-80 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Activity Timeline</h3>
                  {extLoading ? (
                    <div className="py-12 text-center"><Loader text="Loading timeline..." /></div>
                  ) : !extProfile || extProfile.timeline.length === 0 ? (
                    <div className="py-16 text-center">
                      <p className="text-sm font-semibold text-gray-400">No timeline events recorded.</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                      <div className="space-y-4">
                        {extProfile.timeline.map((entry, idx) => {
                          const isVisit   = entry.type === 'visit'
                          const isPtp     = entry.type === 'ptp'
                          const isPayment = entry.type === 'payment'
                          const typeLabel = isVisit ? 'Field Visit' : isPtp ? 'Promise to Pay' : `Payment (${entry.source || 'external'})`
                          const cardBg = isPayment
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800'
                            : isPtp
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
                            : 'bg-gray-50 border-stroke dark:bg-gray-900 dark:border-dark-3'
                          return (
                            <div key={idx} className="relative pl-12">
                              <div className="absolute left-3.5 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-xs font-bold shadow-sm">
                                {isVisit ? 'V' : isPtp ? 'P' : '$'}
                              </div>
                              <div className={`rounded-xl border p-4 ${cardBg}`}>
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{typeLabel}</p>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtDateTime(entry.date)}</p>
                                    {entry.officer_name && (
                                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">Officer: {entry.officer_name}</p>
                                    )}
                                  </div>
                                  {isPayment && entry.amount_collected != null && (
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{fmt(entry.amount_collected)}</span>
                                  )}
                                  {isVisit && entry.payment_collected && entry.amount_collected != null && (
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+{fmt(entry.amount_collected)}</span>
                                  )}
                                  {isPtp && (
                                    <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${entry.status === 'kept' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                                      {entry.status}
                                    </span>
                                  )}
                                </div>
                                {entry.feedback && (
                                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{entry.feedback}</p>
                                )}
                                {isPtp && entry.promised_date && (
                                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">Promised by: {fmtDate(entry.promised_date)}</p>
                                )}
                                {isPayment && entry.payment_method && (
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Via: {entry.payment_method}</p>
                                )}
                                {isPayment && entry.transaction_id && (
                                  <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 mt-0.5">TxID: {entry.transaction_id}</p>
                                )}
                                {isVisit && entry.photos && entry.photos.length > 0 && (
                                  <div className="mt-2 flex gap-2 flex-wrap">
                                    {entry.photos.map((url, pi) => (
                                      <a key={pi} href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover border border-stroke dark:border-dark-3 hover:opacity-80 transition-opacity" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* VERIFICATION TAB */}
              {activeTab === 'verification' && (
                <div className="space-y-5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Verification Records</h3>
                  {extLoading ? (
                    <div className="py-12 text-center"><Loader text="Loading verification..." /></div>
                  ) : !extProfile?.verification ? (
                    <div className="py-16 text-center">
                      <p className="text-sm font-semibold text-gray-400">No verification records found.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-stroke dark:border-dark-3 bg-gray-50 dark:bg-gray-900 p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Verification Status</p>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                            extProfile.verification.status === 'approved' || extProfile.verification.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>
                            {extProfile.verification.status}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Visit Date: {fmtDate(extProfile.verification.visit_date)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-stroke dark:border-dark-3 bg-gray-50 dark:bg-gray-900 p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Verification Officer</p>
                          {extProfile.verification.officer ? (
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-dark dark:text-white">{extProfile.verification.officer.full_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">@{extProfile.verification.officer.username}</p>
                              {extProfile.verification.officer.phone && (
                                <p className="text-xs text-gray-600 dark:text-gray-300">{extProfile.verification.officer.phone}</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">Not assigned</p>
                          )}
                        </div>
                      </div>

                      {extProfile.recovery_officer && (
                        <div className="rounded-xl border border-stroke dark:border-dark-3 bg-gray-50 dark:bg-gray-900 p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Recovery Officer</p>
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-black text-sm ${extProfile.recovery_officer.is_online ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                              {extProfile.recovery_officer.full_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-dark dark:text-white">{extProfile.recovery_officer.full_name}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${extProfile.recovery_officer.is_online ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {extProfile.recovery_officer.is_online ? 'Online' : 'Offline'}
                                </span>
                                {extProfile.recovery_officer.phone && <span>{extProfile.recovery_officer.phone}</span>}
                              </div>
                              {extProfile.recovery_officer.working_hours && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Hours: {extProfile.recovery_officer.working_hours}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {extProfile.verification.grantors.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Guarantors</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {extProfile.verification.grantors.map((g: any, i: number) => (
                              <div key={i} className="rounded-xl border border-stroke dark:border-dark-3 bg-gray-50 dark:bg-gray-900 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-black uppercase">G{g.grantor_number}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{g.relationship}</span>
                                  {g.is_blacklisted && <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-[9px] font-black uppercase">Blacklisted</span>}
                                </div>
                                <p className="font-bold text-dark dark:text-white text-sm">{g.name}</p>
                                {g.cnic_number && <p className="text-xs text-gray-500 dark:text-gray-400">CNIC: {g.cnic_number}</p>}
                                {g.telephone_number && <p className="text-xs text-gray-500 dark:text-gray-400">Ph: {g.telephone_number}</p>}
                                {g.present_address && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{g.present_address}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {extProfile.verification.documents.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Verification Documents</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {extProfile.verification.documents.map((doc, i) => (
                              <a key={i} href={doc.file_url} target="_blank" rel="noreferrer" className="group rounded-xl overflow-hidden border border-stroke dark:border-dark-3 hover:border-[#ff3d3d] transition-colors">
                                <div className="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-900">
                                  <img src={doc.file_url} alt={doc.label || doc.document_type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                </div>
                                <div className="p-2">
                                  <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">{doc.label || doc.document_type.replace(/_/g, ' ')}</p>
                                  <p className="text-[9px] text-gray-400 uppercase">{doc.person_type}</p>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* PAYMENT ALERTS TAB */}
              {activeTab === 'alerts' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Due Payment Alerts</h3>
                  {extLoading ? (
                    <div className="py-12 text-center"><Loader text="Loading payment alerts..." /></div>
                  ) : !extProfile ? null : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                          <p className="text-xs text-red-600 dark:text-red-400 font-black uppercase mb-1">Overdue</p>
                          <p className="text-xl font-black text-red-600 dark:text-red-400">{extProfile.due_payment_alerts.overdue.length} installments</p>
                          <p className="text-xs text-red-500 dark:text-red-400 font-bold mt-1">{fmt(extProfile.due_payment_alerts.total_overdue_amount)}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-600 dark:text-amber-400 font-black uppercase mb-1">Upcoming (30 days)</p>
                          <p className="text-xl font-black text-amber-600 dark:text-amber-400">{extProfile.due_payment_alerts.upcoming.length} installments</p>
                          <p className="text-xs text-amber-500 dark:text-amber-400 font-bold mt-1">{fmt(extProfile.due_payment_alerts.total_upcoming_amount)}</p>
                        </div>
                        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-stroke dark:border-dark-3">
                          <p className="text-xs text-gray-500 font-black uppercase mb-1">Grand Remaining</p>
                          <p className="text-xl font-black text-dark dark:text-white">{fmt(extProfile.due_payment_alerts.summary.grand_total_remaining)}</p>
                          <p className="text-xs text-gray-400 mt-1">{extProfile.due_payment_alerts.summary.paid_installments} paid / {extProfile.due_payment_alerts.summary.pending_installments} pending</p>
                        </div>
                      </div>

                      {extProfile.due_payment_alerts.overdue.length > 0 && (
                        <div>
                          <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">Overdue Installments</p>
                          <div className="space-y-2">
                            {extProfile.due_payment_alerts.overdue.map((inst, i) => (
                              <div key={i} className={`rounded-xl p-4 ${severityStyle(inst.severity)}`}>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-sm text-dark dark:text-white">Month #{inst.month}</span>
                                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${severityBadge(inst.severity)}`}>
                                        {inst.severity} &bull; {inst.days_overdue}d overdue
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Due: {fmtDate(inst.due_date)}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black text-red-600 dark:text-red-400">{fmt(inst.remaining_amount)}</p>
                                    {inst.paid_amount > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400">Partial: {fmt(inst.paid_amount)}</p>}
                                    {inst.arrears > 0 && <p className="text-xs text-red-500 dark:text-red-400">+{fmt(inst.arrears)} arrears</p>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {extProfile.due_payment_alerts.upcoming.length > 0 && (
                        <div>
                          <p className="text-sm font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3">Upcoming Installments</p>
                          <div className="space-y-2">
                            {extProfile.due_payment_alerts.upcoming.map((inst, i) => (
                              <div key={i} className="rounded-xl p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div>
                                    <span className="font-black text-sm text-dark dark:text-white">Month #{inst.month}</span>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Due: {fmtDate(inst.due_date)} &bull; {inst.days_until_due === 0 ? 'Due today' : `In ${inst.days_until_due} day${inst.days_until_due > 1 ? 's' : ''}`}
                                    </p>
                                  </div>
                                  <p className="text-sm font-black text-amber-600 dark:text-amber-400">{fmt(inst.remaining_amount)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {extProfile.due_payment_alerts.overdue.length === 0 && extProfile.due_payment_alerts.upcoming.length === 0 && (
                        <div className="py-16 text-center">
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">No overdue or upcoming payments in the next 30 days.</p>
                        </div>
                      )}
                    </>
                  )}
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
