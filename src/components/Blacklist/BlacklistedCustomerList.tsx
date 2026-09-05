'use client'
import { useEffect, useMemo, useState } from 'react'
import Loader from '@/components/common/Loader'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import Cookies from 'js-cookie'
import { SearchIcon, PointerUp } from '@/assets/icons'
import { useProfileModal } from '../../../contexts/ProfileModalContext'
import { useAuth } from '../../../contexts/AuthContext'
import { AlertTriangle, Ban, ShieldCheck, Filter, X } from 'lucide-react'
import toast from 'react-hot-toast'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface CustomerGroup {
  customer: any
  ledgerSummary: any
  orders: any[]
}

const fmt = (n: number) => `Rs. ${Number(n).toLocaleString()}`

const ALL = '__all__'

const OVERDUE_BUCKETS = [
  { value: ALL, label: 'All' },
  { value: '0-30', label: '0 - 30 days' },
  { value: '31-60', label: '31 - 60 days' },
  { value: '61-90', label: '61 - 90 days' },
  { value: '90+', label: '90+ days' },
]

const matchesOverdueBucket = (days: number, bucket: string) => {
  if (bucket === ALL) return true
  if (bucket === '0-30') return days <= 30
  if (bucket === '31-60') return days >= 31 && days <= 60
  if (bucket === '61-90') return days >= 61 && days <= 90
  if (bucket === '90+') return days > 90
  return true
}

const selectClass =
  'rounded-xl border border-stroke bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-600 outline-none focus:border-red-500 dark:border-strokedark dark:bg-meta-4 dark:text-gray-300 transition-all'

const BlacklistedCustomerList = () => {
  const [customers, setCustomers] = useState<CustomerGroup[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [whitelistingCnic, setWhitelistingCnic] = useState<string | null>(null)
  const { openProfile } = useProfileModal()
  const { user } = useAuth()
  const canWhitelist = ['admin', 'super admin', 'accountant'].includes(user?.role?.toLowerCase() || '')

  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])

  // Filters — see spec item 5 (Sorting & Filters): Reason, Area, Customer/Guarantor/G2,
  // Recovery Officer, Days Overdue, Blacklist Date, Status.
  const [reasonFilter, setReasonFilter] = useState(ALL)
  const [areaFilter, setAreaFilter] = useState(ALL)
  const [roleFilter, setRoleFilter] = useState(ALL)
  const [officerFilter, setOfficerFilter] = useState(ALL)
  const [overdueBucket, setOverdueBucket] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchBlacklist = async () => {
    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      if (!token) return

      const res = await fetch(`${BACKEND_URL}/api/customers/blacklist`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch blacklist')
      const json = await res.json()

      if (json.success && json.data) {
        const sorted = (json.data.customers ?? []).slice().sort((a: CustomerGroup, b: CustomerGroup) => {
          const dateA = new Date(a.customer.blacklist_date || a.customer.created_at || 0).getTime()
          const dateB = new Date(b.customer.blacklist_date || b.customer.created_at || 0).getTime()
          return dateB - dateA
        })
        setCustomers(sorted)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBlacklist()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setGlobalFilter(searchInput), 200)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleViewProfile = (customerGroup: CustomerGroup) => {
    if (customerGroup.orders && customerGroup.orders.length > 0) {
      openProfile(customerGroup.orders[0]);
    }
  }

  // Admin/Super Admin acts as final authority here — setBlacklistStatus
  // applies the whitelist immediately for that role instead of leaving it
  // pending for a separate accountant approval (see blacklistController.js).
  const handleWhitelist = async (customerGroup: CustomerGroup) => {
    const cnic = customerGroup.customer.cnic_number
    if (!cnic) {
      toast.error('This customer has no CNIC on file — cannot whitelist.')
      return
    }
    const reason = window.prompt(`Reason for whitelisting ${customerGroup.customer.name} and all linked guarantors:`, '')
    if (reason === null) return // cancelled
    if (!reason.trim()) {
      toast.error('A reason is required to whitelist a customer.')
      return
    }

    setWhitelistingCnic(cnic)
    try {
      const token = Cookies.get('auth_token')
      const verificationId = customerGroup.orders?.[0]?.verification?.id
      const res = await fetch(`${BACKEND_URL}/api/accounts/blacklist/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cnic,
          action: 'whitelist',
          targetType: 'all',
          verificationId,
          reason: reason.trim()
        }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.message || 'Failed to whitelist customer')

      toast.success(json.message || 'Customer and guarantors whitelisted.')
      setCustomers(prev => prev.filter(c => c.customer.cnic_number !== cnic))
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Failed to whitelist customer')
    } finally {
      setWhitelistingCnic(null)
    }
  }

  // ── Distinct option lists for the filter dropdowns, derived from live data ──
  const reasonOptions = useMemo(
    () => Array.from(new Set(customers.map(c => c.customer.blacklist_reason).filter(Boolean))).sort(),
    [customers]
  )
  const areaOptions = useMemo(
    () => Array.from(new Set(customers.map(c => c.customer.area).filter(Boolean))).sort(),
    [customers]
  )
  const officerOptions = useMemo(
    () => Array.from(new Set(customers.map(c => c.customer.recovery_officer_name).filter(Boolean))).sort(),
    [customers]
  )

  const hasActiveFilters =
    reasonFilter !== ALL || areaFilter !== ALL || roleFilter !== ALL || officerFilter !== ALL ||
    overdueBucket !== ALL || statusFilter !== ALL || dateFrom !== '' || dateTo !== ''

  const clearFilters = () => {
    setReasonFilter(ALL)
    setAreaFilter(ALL)
    setRoleFilter(ALL)
    setOfficerFilter(ALL)
    setOverdueBucket(ALL)
    setStatusFilter(ALL)
    setDateFrom('')
    setDateTo('')
  }

  const columns: ColumnDef<CustomerGroup>[] = useMemo(() => [
    {
      id: 'sr_no',
      header: 'Sr. #',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-black text-gray-400 text-xs">{row.index + 1}</span>
      ),
    },
    {
      id: 'customer_name',
      accessorFn: (row) => row.customer.name,
      header: 'Customer Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Ban size={18} />
          </div>
          <span className="font-bold text-dark dark:text-white">{row.original.customer.name}</span>
        </div>
      )
    },
    {
      id: 'whatsapp_number',
      accessorFn: (row) => row.customer.whatsapp_number,
      header: 'WhatsApp',
    },
    {
      id: 'cnic_number',
      accessorFn: (row) => row.customer.cnic_number || '-',
      header: 'CNIC',
    },
    {
      id: 'role',
      accessorFn: (row) => row.customer.blacklisted_role || 'Customer',
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue() as string
        const styles: Record<string, string> = {
          Customer: 'bg-red-50 text-red-600 dark:bg-red-500/10',
          Guarantor: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10',
          G2: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10',
        }
        return (
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${styles[role] || styles.Customer}`}>
            {role}
          </span>
        )
      },
    },
    {
      id: 'area',
      accessorFn: (row) => row.customer.area || '-',
      header: 'Area',
    },
    {
      id: 'recovery_officer',
      accessorFn: (row) => row.customer.recovery_officer_name || '-',
      header: 'Recovery Officer',
    },
    {
      id: 'created_at',
      accessorFn: (row) => row.customer.created_at,
      header: 'Registration',
      cell: ({ getValue }) => {
        const val = getValue() as string
        if (!val) return '-'
        const date = new Date(val)
        return (
          <div className="flex flex-col">
            <span className="font-bold text-dark dark:text-white">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase">
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )
      },
    },
    {
      id: 'blacklist_date',
      accessorFn: (row) => row.customer.blacklist_date,
      header: 'Blacklist Date',
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        if (!val) return <span className="text-gray-400">-</span>
        const date = new Date(val)
        return (
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )
      },
    },
    {
      id: 'days_overdue',
      accessorFn: (row) => row.ledgerSummary.daysOverdue || 0,
      header: 'Days Overdue',
      cell: ({ getValue }) => {
        const days = Number(getValue())
        return <span className="font-black text-red-500">{days}</span>
      },
    },
    {
      id: 'total_remaining',
      accessorFn: (row) => row.ledgerSummary.totalRemaining,
      header: 'Total Overdue',
      cell: ({ getValue }) => (
        <div className="font-black text-red-500">
          {fmt(Number(getValue()))}
        </div>
      ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.customer.blacklist_status || 'Blacklisted',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue() as string
        const isPending = status === 'Pending Whitelist'
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase ${isPending ? 'bg-amber-500 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
            <AlertTriangle size={12} /> {status}
          </span>
        )
      },
    },
    {
      id: 'reason',
      accessorFn: (row) => row.customer.blacklist_reason || 'Auto-flagged (90+ days delinquency)',
      header: 'Reason',
      cell: ({ getValue }) => (
        <div className="text-xs text-gray-500 max-w-[200px] truncate" title={getValue() as string}>
          {getValue() as string}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const cnic = row.original.customer.cnic_number
        const isWhitelisting = whitelistingCnic === cnic
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleViewProfile(row.original)}
              className="rounded-xl bg-red-500 px-6 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
            >
              Open Profile
            </button>
            {canWhitelist && (
              <button
                onClick={() => handleWhitelist(row.original)}
                disabled={isWhitelisting}
                title={cnic ? undefined : 'No CNIC on file'}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <ShieldCheck size={14} /> {isWhitelisting ? 'Whitelisting...' : 'Whitelist'}
              </button>
            )}
          </div>
        )
      },
    },
  ], [canWhitelist, whitelistingCnic])

  const filteredData = useMemo(() => {
    const needle = globalFilter.toLowerCase()
    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo) : null
    if (to) to.setHours(23, 59, 59, 999)

    return customers.filter(c => {
      if (globalFilter) {
        const matchesSearch =
          (c.customer.name || '').toLowerCase().includes(needle) ||
          (c.customer.whatsapp_number || '').includes(globalFilter) ||
          (c.customer.cnic_number && c.customer.cnic_number.toLowerCase().includes(needle))
        if (!matchesSearch) return false
      }
      if (reasonFilter !== ALL && (c.customer.blacklist_reason || 'Auto-flagged (90+ days delinquency)') !== reasonFilter) return false
      if (areaFilter !== ALL && (c.customer.area || '-') !== areaFilter) return false
      if (roleFilter !== ALL && (c.customer.blacklisted_role || 'Customer') !== roleFilter) return false
      if (officerFilter !== ALL && (c.customer.recovery_officer_name || '-') !== officerFilter) return false
      if (statusFilter !== ALL && (c.customer.blacklist_status || 'Blacklisted') !== statusFilter) return false
      if (!matchesOverdueBucket(c.ledgerSummary.daysOverdue || 0, overdueBucket)) return false

      if (from || to) {
        const d = c.customer.blacklist_date ? new Date(c.customer.blacklist_date) : null
        if (!d) return false
        if (from && d < from) return false
        if (to && d > to) return false
      }

      return true
    })
  }, [customers, globalFilter, reasonFilter, areaFilter, roleFilter, officerFilter, statusFilter, overdueBucket, dateFrom, dateTo])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <section className="rounded-[2.5rem] bg-white p-8">
      <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
            <Ban className="text-red-500" size={32} />
            Blacklisted Customers
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Automatic monitoring of accounts with 90+ days delinquency.</p>
        </div>

        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-2xl border border-stroke bg-gray-50 px-6 py-4 outline-none focus:border-red-500 dark:border-strokedark dark:bg-meta-4 transition-all"
            placeholder="Search blacklisted customers..."
          />
          <SearchIcon className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-8 rounded-2xl border border-stroke bg-gray-50/60 p-4 dark:border-strokedark dark:bg-meta-4/30">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-gray-400">
            <Filter size={13} /> Filters
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-bold text-red-500 hover:underline"
            >
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>Customer / Guarantor / G2</option>
            <option value="Customer">Customer</option>
            <option value="Guarantor">Guarantor</option>
            <option value="G2">G2</option>
          </select>

          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Areas</option>
            {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>

          <select value={officerFilter} onChange={(e) => setOfficerFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Recovery Officers</option>
            {officerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>

          <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Reasons</option>
            {reasonOptions.map((r) => <option key={r} value={r} title={r}>{r.length > 28 ? `${r.slice(0, 28)}…` : r}</option>)}
          </select>

          <select value={overdueBucket} onChange={(e) => setOverdueBucket(e.target.value)} className={selectClass}>
            {OVERDUE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.value === ALL ? 'Days Overdue' : b.label}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Statuses</option>
            <option value="Blacklisted">Blacklisted</option>
            <option value="Pending Whitelist">Pending Whitelist</option>
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Blacklist date from"
              className={`${selectClass} w-full`}
            />
            <span className="text-gray-400 text-xs">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Blacklist date to"
              className={`${selectClass} w-full`}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-stroke dark:border-strokedark">
                {hg.headers.map((header) => (
                  <th key={header.id} className="pb-6 px-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <div
                      className={`flex items-center gap-1.5 ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="inline-flex flex-col">
                          <PointerUp className={`size-2.5 ${header.column.getIsSorted() === 'asc' ? 'text-red-500' : 'text-gray-300'}`} />
                          <PointerUp className={`size-2.5 rotate-180 ${header.column.getIsSorted() === 'desc' ? 'text-red-500' : 'text-gray-300'}`} />
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-meta-4/20">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center text-red-500 font-black">
                  <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  SCANNING FOR DEFAULTERS...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-20 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-10 rounded-[2.5rem] inline-block border border-emerald-100 dark:border-emerald-900/20">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      {customers.length === 0 ? 'No Blacklisted Customers Found' : 'No Matches For These Filters'}
                    </p>
                    <p className="text-xs text-emerald-500 mt-2">
                      {customers.length === 0 ? 'All delivered orders are currently active or up-to-date.' : 'Try clearing a filter or the search box.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-colors group">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-6 px-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CheckCircle2({ size, className }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export default BlacklistedCustomerList
