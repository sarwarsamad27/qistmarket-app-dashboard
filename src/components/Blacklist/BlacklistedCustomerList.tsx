'use client'
import React, { useEffect, useMemo, useState } from 'react'
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
import { AlertTriangle, Ban, ShieldCheck, Filter, X, ChevronDown, ChevronRight, Users, Calendar, FileWarning, UserCog } from 'lucide-react'
import toast from 'react-hot-toast'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

// How the backend arrived at the Area value: a stored area column, a name
// parsed out of the free-text address, or only the district it could identify.
type AreaSource = 'field' | 'address' | 'zone' | null

// 'recorded' comes from a real BlacklistAction audit row. 'auto-estimated' is
// the 90-day rule replayed for accounts flagged before that logging existed.
type BlacklistDateSource = 'recorded' | 'auto-estimated' | null

const AREA_SOURCE_HINT: Record<string, string> = {
  address: 'from address',
  zone: 'district only',
}

// One canonical blacklist reason bucket. The backend owns this vocabulary
// (src/utils/blacklistReasonUtils.js) and sends it with the list — the filter
// used to be built from the distinct free-text reasons themselves, so every
// typo an officer ever typed became a permanent dropdown option.
interface ReasonType {
  code: string
  label: string
  description: string
  manual: boolean
}

// Colour per bucket so the Reason column reads at a glance. Anything not
// listed falls back to the neutral grey below.
const REASON_BADGE_STYLES: Record<string, string> = {
  auto_delinquency: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
  non_payment: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  fraud: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  untraceable: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  device_tampering: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
  guarantor_issue: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  legal_action: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  other: 'bg-gray-100 text-gray-600 dark:bg-meta-4 dark:text-gray-300',
  not_recorded: 'bg-gray-50 text-gray-400 dark:bg-meta-4 dark:text-gray-500',
}

const ReasonBadge = ({ code, label }: { code?: string | null; label?: string | null }) => {
  if (!label) return null
  return (
    <span className={`inline-block w-fit rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${REASON_BADGE_STYLES[code || ''] || REASON_BADGE_STYLES.other}`}>
      {label}
    </span>
  )
}

interface Guarantor {
  id: number
  name: string
  cnic_number: string | null
  telephone_number: string | null
  relationship: string | null
  grantor_number: number
  area: string | null
  area_source: AreaSource
  present_address: string | null
  permanent_address: string | null
  is_blacklisted: boolean
  blacklist_reason: string | null
  blacklist_reason_code: string | null
  blacklist_reason_label: string | null
  blacklist_date: string | null
  blacklist_date_source: BlacklistDateSource
  blacklist_status: string | null
  blacklisted_by_name: string | null
}

interface CustomerGroup {
  customer: any
  ledgerSummary: any
  orders: any[]
}

const fmtDate = (val: string | null | undefined) => {
  if (!val) return null
  const date = new Date(val)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
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
  'min-w-0 w-full rounded-xl border border-stroke bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-600 outline-none focus:border-red-500 dark:border-strokedark dark:bg-meta-4 dark:text-gray-300 transition-all'

// Typo-tolerant name search: a plain substring check misses common spelling
// variants (e.g. searching "Zulqrnain" for a customer stored as "Zulqarnan
// Arfi" — same name, different transliteration). Names are searched loosely;
// CNIC/phone stay exact substring matches since those must be precise.
const levenshteinDistance = (a: string, b: string) => {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
      prev = temp
    }
  }
  return dp[n]
}

const fuzzyNameMatch = (name: string | null | undefined, needle: string) => {
  const normalizedName = (name || '').toLowerCase().trim()
  const normalizedNeedle = needle.toLowerCase().trim()
  if (!normalizedName || !normalizedNeedle) return false
  if (normalizedName.includes(normalizedNeedle)) return true
  if (normalizedNeedle.length < 3) return false // too short for fuzzy tolerance to be meaningful

  const nameWords = normalizedName.split(/\s+/).filter(Boolean)
  const needleWords = normalizedNeedle.split(/\s+/).filter(Boolean)
  return needleWords.every((nw) =>
    nameWords.some((w) => {
      const maxDistance = nw.length <= 4 ? 1 : 2
      return levenshteinDistance(w, nw) <= maxDistance
    })
  )
}

const BlacklistedCustomerList = () => {
  const [customers, setCustomers] = useState<CustomerGroup[]>([])
  const [reasonTypes, setReasonTypes] = useState<ReasonType[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [whitelistingCnic, setWhitelistingCnic] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const { openProfile } = useProfileModal()
  const { user } = useAuth()
  const canWhitelist = ['admin', 'super admin', 'accountant'].includes(user?.role?.toLowerCase() || '')

  const [sorting, setSorting] = useState<SortingState>([{ id: 'delivered_at', desc: true }])

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
        setReasonTypes(json.data.reasonTypes ?? [])
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

  const getRowKey = (c: CustomerGroup) =>
    `${c.customer.cnic_number || c.customer.name}-${c.orders?.[0]?.order_id ?? ''}`

  const toggleExpand = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
  // Reason is the exception: it is driven by the backend's fixed vocabulary,
  // not by the free-text reasons, so a new typo can never add an option. Only
  // buckets that actually have records are offered (with their count), so the
  // dropdown stays short without ever hiding a reason someone can filter on.
  const reasonOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of customers) {
      const code = c.customer.blacklist_reason_code || 'not_recorded'
      counts.set(code, (counts.get(code) || 0) + 1)
    }
    return reasonTypes
      .filter((t) => counts.has(t.code))
      .map((t) => ({ ...t, count: counts.get(t.code) as number }))
  }, [customers, reasonTypes])

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
      cell: ({ row }) => {
        const guarantors: Guarantor[] = row.original.customer.guarantors || []
        const key = getRowKey(row.original)
        const isExpanded = expandedRows.has(key)
        return (
          <div className="flex items-center gap-2">
            {guarantors.length > 0 ? (
              <button
                onClick={() => toggleExpand(key)}
                title={`${guarantors.length} guarantor(s) — click to ${isExpanded ? 'collapse' : 'expand'}`}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-meta-4 transition-colors shrink-0"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span className="w-6 shrink-0" />
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 shrink-0">
              <Ban size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-dark dark:text-white">{row.original.customer.name}</span>
              {guarantors.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                  <Users size={10} /> {guarantors.length} guarantor{guarantors.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )
      }
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
      cell: ({ row, getValue }) => {
        const area = getValue() as string
        if (area === '-') return <span className="text-gray-400">-</span>
        const hint = AREA_SOURCE_HINT[row.original.customer.area_source as string]
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-700 dark:text-gray-200">{area}</span>
            {hint && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{hint}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'recovery_officer',
      accessorFn: (row) => row.customer.recovery_officer_name || 'Not assigned',
      header: 'Recovery Officer',
    },
    {
      id: 'delivered_at',
      accessorFn: (row) => row.customer.delivered_at,
      header: 'Registration',
      cell: ({ getValue }) => {
        const val = getValue() as string
        if (!val) return '-'
        const date = new Date(val)
        if (isNaN(date.getTime())) return '-'
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
      cell: ({ row, getValue }) => {
        const val = getValue() as string | null
        const date = val ? new Date(val) : null
        if (!date || isNaN(date.getTime())) return <span className="text-gray-400">Not recorded</span>
        // Estimated dates carry no meaningful clock time — showing one would
        // imply a precision the replayed 90-day rule doesn't have.
        const estimated = (row.original.customer.blacklist_date_source as BlacklistDateSource) === 'auto-estimated'
        return (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {estimated ? (
              <span
                title="No audit record exists for this account. Date reconstructed from the 90-day auto-blacklist rule."
                className="w-fit rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-600 dark:bg-amber-500/10"
              >
                Auto · Est.
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase text-gray-400">
                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            )}
          </div>
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
      // Sorts/filters on the canonical bucket, but still shows the officer's
      // own words underneath — the bucket is for grouping, the free text is
      // the detail nobody wants to lose.
      accessorFn: (row) => row.customer.blacklist_reason_label || 'History not recorded',
      header: 'Reason',
      cell: ({ row }) => {
        const { blacklist_reason_code: code, blacklist_reason_label: label, blacklist_reason: text } = row.original.customer
        const detail = text || 'Blacklist history not recorded'
        return (
          <div className="w-60 text-xs text-gray-600 dark:text-gray-300">
            <ReasonBadge code={code} label={label} />
            <details className="group mt-1">
              <summary className="cursor-pointer rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500" title="Click to read the full reason">
                <span className="inline-block max-w-[200px] truncate align-bottom group-open:hidden">{detail}</span>
                <span className="hidden group-open:inline">Hide full reason</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 dark:bg-meta-4">{detail}</p>
            </details>
          </div>
        )
      },
    },
    {
      id: 'blacklisted_by',
      accessorFn: (row) => row.customer.blacklisted_by_name || 'Not recorded',
      header: 'Blacklisted By',
      cell: ({ getValue }) => (
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{getValue() as string}</span>
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
  ], [canWhitelist, whitelistingCnic, expandedRows])

  const filteredData = useMemo(() => {
    const needle = globalFilter.toLowerCase()
    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo) : null
    if (to) to.setHours(23, 59, 59, 999)

    return customers.filter(c => {
      if (globalFilter) {
        const matchesCustomer =
          fuzzyNameMatch(c.customer.name, globalFilter) ||
          (c.customer.whatsapp_number || '').includes(globalFilter) ||
          (c.customer.cnic_number && c.customer.cnic_number.toLowerCase().includes(needle))
        const matchesGuarantor = (c.customer.guarantors || []).some((g: Guarantor) =>
          fuzzyNameMatch(g.name, globalFilter) ||
          (g.cnic_number || '').toLowerCase().includes(needle) ||
          (g.telephone_number || '').includes(globalFilter)
        )
        // Also match by order ref / IMEI — someone investigating a specific
        // order (e.g. from the Returns screen's "already blacklisted"
        // warning) searches by order number, not by the customer's name.
        const matchesOrder = (c.orders || []).some((o: any) =>
          (o.order_ref || '').toLowerCase().includes(needle) ||
          (o.product_details?.imei_serial || '').toLowerCase().includes(needle)
        )
        if (!matchesCustomer && !matchesGuarantor && !matchesOrder) return false
      }
      if (reasonFilter !== ALL && (c.customer.blacklist_reason_code || 'not_recorded') !== reasonFilter) return false
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
    <section className="w-full min-w-0 max-w-full rounded-2xl bg-white p-3 sm:p-5 lg:p-8">
      <div className="mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
            <Ban className="text-red-500" size={32} />
            Blacklisted Customers
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-medium">Customer and guarantor blacklist records, including manual and automatic actions.</p>
        </div>

        <div className="relative w-full max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-2xl border border-stroke bg-gray-50 px-6 py-4 outline-none focus:border-red-500 dark:border-strokedark dark:bg-meta-4 transition-all"
            placeholder="Search by customer or guarantor name, CNIC, phone..."
          />
          <SearchIcon className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-8 rounded-2xl border border-stroke bg-gray-50/60 p-4 dark:border-strokedark dark:bg-meta-4/30">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
            <option value={ALL}>All Reasons ({customers.length})</option>
            {reasonOptions.map((r) => (
              <option key={r.code} value={r.code} title={r.description}>
                {r.label} ({r.count})
              </option>
            ))}
          </select>

          <select value={overdueBucket} onChange={(e) => setOverdueBucket(e.target.value)} className={selectClass}>
            {OVERDUE_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.value === ALL ? 'Days Overdue' : b.label}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value={ALL}>All Statuses</option>
            <option value="Blacklisted">Blacklisted</option>
            <option value="Pending Whitelist">Pending Whitelist</option>
          </select>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:col-span-2">
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

      <div className="max-h-[75vh] w-full min-w-0 overflow-auto rounded-xl border border-stroke" tabIndex={0} role="region" aria-label="Blacklisted customers; scroll to view all columns">
        <table className="w-full min-w-[1800px] text-left">
          <thead className="sticky top-0 z-10 bg-white dark:bg-meta-4">
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
              table.getRowModel().rows.map((row) => {
                const guarantors: Guarantor[] = row.original.customer.guarantors || []
                const rowKey = getRowKey(row.original)
                const isExpanded = guarantors.length > 0 && expandedRows.has(rowKey)
                return (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-red-50/30 dark:hover:bg-red-900/5 transition-colors group">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-4 px-3 align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-amber-50/40 dark:bg-amber-500/5">
                        <td colSpan={columns.length} className="px-4 pb-6 pt-0">
                          <div className="max-w-[1200px] rounded-2xl border border-amber-200/60 dark:border-amber-500/20 bg-white dark:bg-meta-4 p-5">
                            <div className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-600">
                              <Users size={14} /> Guarantor Details ({guarantors.length})
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {guarantors.map((g) => (
                                <div key={g.id} className="rounded-xl border border-stroke dark:border-strokedark p-4">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/10 text-xs font-black">
                                        G{g.grantor_number || ''}
                                      </div>
                                      <span className="font-bold text-dark dark:text-white text-sm">{g.name}</span>
                                    </div>
                                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase text-white ${g.is_blacklisted ? g.blacklist_status === 'Pending Whitelist' ? 'bg-amber-500' : 'bg-red-500' : 'bg-emerald-500'}`}>
                                      {g.is_blacklisted ? <AlertTriangle size={10} /> : <ShieldCheck size={10} />}
                                      {g.is_blacklisted ? g.blacklist_status || 'Blacklisted' : 'Whitelisted'}
                                    </span>
                                  </div>

                                  {/* Contact section */}
                                  <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                    <div>
                                      <span className="block text-[10px] font-bold uppercase text-gray-400">CNIC</span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{g.cnic_number || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] font-bold uppercase text-gray-400">Phone</span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{g.telephone_number || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] font-bold uppercase text-gray-400">Relationship</span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{g.relationship || '-'}</span>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] font-bold uppercase text-gray-400">Area</span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{g.area || '-'}</span>
                                      {g.area && AREA_SOURCE_HINT[g.area_source as string] && (
                                        <span className="ml-1 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                                          ({AREA_SOURCE_HINT[g.area_source as string]})
                                        </span>
                                      )}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="block text-[10px] font-bold uppercase text-gray-400">Address</span>
                                      <span className="font-semibold text-gray-700 dark:text-gray-200">{g.present_address || g.permanent_address || '-'}</span>
                                    </div>
                                  </div>

                                  {/* Blacklist section — only when this specific guarantor is blacklisted */}
                                  {g.is_blacklisted && (
                                    <div className="border-t border-dashed border-stroke dark:border-strokedark pt-2.5 mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                      <div>
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Calendar size={10} /> Blacklist Date</span>
                                        <span className="font-semibold text-gray-700 dark:text-gray-200">{fmtDate(g.blacklist_date) || 'Not recorded'}</span>
                                        {g.blacklist_date && g.blacklist_date_source === 'auto-estimated' && (
                                          <span
                                            title="No audit record exists. Date reconstructed from the 90-day auto-blacklist rule."
                                            className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-600 dark:bg-amber-500/10"
                                          >
                                            Auto · Est.
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><UserCog size={10} /> Blacklisted By</span>
                                        <span className="font-semibold text-gray-700 dark:text-gray-200">{g.blacklisted_by_name || '-'}</span>
                                      </div>
                                      <div className="col-span-2">
                                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><FileWarning size={10} /> Reason</span>
                                        <ReasonBadge code={g.blacklist_reason_code} label={g.blacklist_reason_label} />
                                        <span className="block font-semibold text-gray-700 dark:text-gray-200">{g.blacklist_reason || '-'}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
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
