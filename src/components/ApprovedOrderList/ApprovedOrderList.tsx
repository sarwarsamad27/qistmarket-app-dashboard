'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
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
  RowSelectionState,
} from '@tanstack/react-table'
import Cookies from 'js-cookie'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, SearchIcon, PointerUp, ChevronUpIcon } from '@/assets/icons'
import ColumnFilter from '../DataTables/ColumnFilter'
import { Modal } from '../Modal/Modal'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { useRef } from 'react'
import Pagination from '../common/Pagination'
import { useAuth } from '../../../contexts/AuthContext'
import { formatExactDate } from "@/utils/dateUtils";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";


const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

// ─────────────────────────────────────────────────────────────────────────────
// Types
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


interface Order {
  id: number
  order_ref: string
  token_number: string
  customer_name: string
  whatsapp_number: string
  address: string
  city: string | null
  area: string;
  zone: string | null;
  block: string | null;
  street: string | null;
  house_no: string | null;
  product_name: string
  total_amount: number
  advance_amount: number
  monthly_amount: number
  months: number
  delivery_officer: { username: string } | null
  channel: string
  status: string
  created_at: string
  created_by: { username: string } | null
  assigned_to: { username: string } | null
  verification: VerificationNested | null
}

interface User {
  id: number
  full_name: string
  username: string
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
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const ApprovedOrderList = () => {
  const { user } = useAuth();
  const isSalesOfficer = (user?.role || '').toLowerCase() === 'sales officer';
  const [orders, setOrders] = useState<Order[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  })
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [loading, setLoading] = useState(false)

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

  const [dateRange, setDateRange] = useState(() => parseDateRange(urlDateRange))
  const [startDate, setStartDate] = useState(() => urlStartDate || '')
  const [endDate, setEndDate] = useState(() => urlEndDate || '')

  useEffect(() => {
    if (urlDateRange) {
      const parsed = parseDateRange(urlDateRange)
      setDateRange(parsed)
      if (urlStartDate) setStartDate(urlStartDate)
      if (urlEndDate) setEndDate(urlEndDate)
    }
  }, [urlDateRange, urlStartDate, urlEndDate])

  const router = useRouter()

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false)
  const [bulkUnassignModalOpen, setBulkUnassignModalOpen] = useState(false)
  const [singleUnassignModalOpen, setSingleUnassignModalOpen] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedDeliveryOfficerId, setSelectedDeliveryOfficerId] = useState<number | null>(null)
  const [deliveryOfficers, setDeliveryOfficers] = useState<User[]>([])

  const [isAssigning, setIsAssigning] = useState(false)
  const [isUnassigning, setIsUnassigning] = useState(false)
  const [isBulkAssigning, setIsBulkAssigning] = useState(false)
  const [isBulkUnassigning, setIsBulkUnassigning] = useState(false)
  
  // Cancel Order States
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchApprovedOrders = async () => {
    setLoading(true)
    try {
      const token = Cookies.get('auth_token')
      if (!token) return

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: globalFilter.trim(),
        sortBy: sorting[0]?.id || 'created_at',
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

      const res = await fetch(`${BACKEND_URL}/api/orders/delivery-pending?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to fetch approved orders"))

      const json = await res.json()

      if (json.success && json.data?.orders) {
        setOrders(json.data.orders)
        if (json.data.pagination) {
          setPagination(prev => ({ ...prev, ...json.data.pagination }))
        }
      }
    } catch (err) {
      console.error('Failed to load approved orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDeliveryOfficers = async () => {
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/users/delivery-officers`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          setDeliveryOfficers(json.data.officers || [])
        }
      }
    } catch (err) {
      console.error('Failed to load delivery officers:', err)
    }
  }

  useEffect(() => {
    fetchApprovedOrders()
  }, [pagination.page, pagination.limit, globalFilter, columnFilters, sorting, dateRange, startDate, endDate])

  useEffect(() => {
    fetchDeliveryOfficers()
  }, [])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAssignClick = (order: Order) => {
    setSelectedOrder(order)
    setAssignModalOpen(true)
  }

  const handleUnassignClick = (order: Order) => {
    setSelectedOrder(order)
    setSingleUnassignModalOpen(true)
  }

  const confirmAssign = async () => {
    if (!selectedOrder || !selectedDeliveryOfficerId) return
    setIsAssigning(true)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/assign-delivery`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: selectedDeliveryOfficerId, action: 'assign' }),
      })

      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to assign delivery officer"))

      await fetchApprovedOrders()
      toast.success('Assigned delivery officer successfully')
      setAssignModalOpen(false)
      setSelectedDeliveryOfficerId(null)
      setSelectedOrder(null)
    } catch (err) {
      console.error('Assign delivery error:', err)
      toast.error(getErrorMessage(err, 'Failed to assign delivery officer'))
    } finally {
      setIsAssigning(false)
    }
  }

  const confirmSingleUnassign = async () => {
    if (!selectedOrder) return
    setIsUnassigning(true)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/assign-delivery`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'unassign' }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to unassign delivery officer", data))

      await fetchApprovedOrders()
      toast.success('Unassigned delivery officer successfully')
      setSingleUnassignModalOpen(false)
      setSelectedOrder(null)
    } catch (err: any) {
      console.error('Unassign delivery error:', err)
      toast.error(err?.message || 'Failed to unassign delivery officer')
    } finally {
      setIsUnassigning(false)
    }
  }

  const handleBulkAssign = () => setBulkAssignModalOpen(true)
  const handleBulkUnassign = () => setBulkUnassignModalOpen(true)

  const confirmBulkAssign = async () => {
    if (!selectedDeliveryOfficerId) return
    setIsBulkAssigning(true)

    const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/assign-bulk-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_ids: ids, user_id: selectedDeliveryOfficerId, action: 'assign' }),
      })

      if (!res.ok) throw new Error(await apiErrorMessage(res, "Bulk assign failed"))

      await fetchApprovedOrders()
      toast.success(`Bulk assigned delivery officer to ${ids.length} orders`)
      setBulkAssignModalOpen(false)
      setRowSelection({})
      setSelectedDeliveryOfficerId(null)
    } catch (err) {
      console.error('Bulk assign delivery error:', err)
      toast.error(getErrorMessage(err, 'Failed to perform bulk assignment'))
    } finally {
      setIsBulkAssigning(false)
    }
  }

  const confirmBulkUnassign = async () => {
    const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)
    setIsBulkUnassigning(true)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/assign-bulk-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_ids: ids, action: 'unassign' }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Bulk unassign failed", data))

      await fetchApprovedOrders()
      toast.success(data?.message || `Bulk unassigned delivery officer from ${ids.length} orders`)
      setBulkUnassignModalOpen(false)
      setRowSelection({})
    } catch (err: any) {
      console.error('Bulk unassign delivery error:', err)
      toast.error(err?.message || 'Failed to perform bulk unassign')
    } finally {
      setIsBulkUnassigning(false)
    }
  }

  const handleCancelClick = (order: Order) => {
    setSelectedOrder(order)
    setCancelReason('')
    setCancelModalOpen(true)
  }

  const confirmCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation')
      return
    }

    setIsSubmittingCancel(true)
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Order cancelled successfully')
        setCancelModalOpen(false)
        fetchApprovedOrders() // Refresh list
      } else {
        toast.error(data.message || 'Failed to cancel order')
      }
    } catch (err) {
      console.error('Cancel order error:', err)
      toast.error(getErrorMessage(err, 'Internal server error'))
    } finally {
      setIsSubmittingCancel(false)
    }
  }

  console.log('Orders:', deliveryOfficers)

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Order>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          disabled={!row.getCanSelect()}
        />
      ),
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: 'updated_at',
      header: 'Activity Date',
      cell: ({ row, getValue }) => {
        const orig = row.original as any
        const isDelivered = (orig.status || '').toLowerCase() === 'delivered' || Boolean(orig.is_delivered)
        const rawVal = getValue() as string
        const val = isDelivered ? (orig.delivered_at || rawVal) : rawVal
        const createdAt = orig.created_at
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
    { accessorKey: 'order_ref', header: 'Order Ref', enableColumnFilter: true },
    { accessorKey: 'customer_name', header: 'Customer Name', enableColumnFilter: true },
    { accessorKey: 'whatsapp_number', header: 'WhatsApp', enableColumnFilter: true },
    { accessorKey: 'city', header: 'City', enableColumnFilter: true },
    { accessorKey: 'area', header: 'Area', enableColumnFilter: true },
    { accessorKey: 'product_name', header: 'Suggested Product', enableColumnFilter: true },
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
                status === 'approved'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
              )}
            >
              {status === 'approved' ? 'Approved' : 'Picked'}
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
      id: 'created_by',
      accessorFn: (row) => row.created_by?.username || '',
      header: 'Created By',
      enableColumnFilter: true,
    },
    {
      id: 'assigned_to',
      accessorFn: (row) => row.assigned_to?.username || 'Unassigned',
      header: 'Verification Officer',
      enableColumnFilter: true,
    },
    {
      id: 'delivery_officer',
      accessorFn: (row) => row.delivery_officer?.username || 'Unassigned',
      header: 'Delivery Officer',
      enableColumnFilter: true,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => {
        const order = row.original;

        const [isOpen, setIsOpen] = useState(false);
        const [position, setPosition] = useState({ top: 0, left: 0 });
        const [openUp, setOpenUp] = useState(false);

        const triggerRef = useRef<HTMLButtonElement | null>(null);
        const dropdownRef = useRef<HTMLDivElement | null>(null);

        const toggleDropdown = () => {
          if (!triggerRef.current) return;

          const rect = triggerRef.current.getBoundingClientRect();

          const dropdownWidth = 176; // w-44
          const dropdownHeight = 150;

          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceRight = window.innerWidth - rect.right;

          const shouldOpenUp = spaceBelow < dropdownHeight;
          const shouldAlignLeft = spaceRight < dropdownWidth;

          setOpenUp(shouldOpenUp);

          setPosition({
            top: shouldOpenUp
              ? rect.top + window.scrollY - 8
              : rect.bottom + window.scrollY + 6,
            left: shouldAlignLeft
              ? rect.left + window.scrollX
              : rect.right + window.scrollX - dropdownWidth,
          });

          setIsOpen((prev) => !prev);
        };

        // Outside click + ESC support
        useEffect(() => {
          const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;

            if (
              triggerRef.current &&
              !triggerRef.current.contains(target) &&
              dropdownRef.current &&
              !dropdownRef.current.contains(target)
            ) {
              setIsOpen(false);
            }
          };

          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
              setIsOpen(false);
            }
          };

          if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
          }

          return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
          };
        }, [isOpen]);

        return (
          <>
            <button
              ref={triggerRef}
              onClick={toggleDropdown}
              className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-dark shadow-[0_1px_3px_0_rgba(166,175,195,0.4)] hover:text-[#ff3d3d] dark:border dark:border-dark-3 dark:text-white dark:shadow-none"
            >
              <span>Actions</span>
              <svg
                className={`size-4 transition-transform ${isOpen ? "rotate-0" : "rotate-180"
                  }`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.7a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
              </svg>
            </button>

            {isOpen &&
              createPortal(
                <div
                  ref={dropdownRef}
                  style={{
                    position: "absolute",
                    top: position.top,
                    left: position.left,
                    transform: openUp ? "translateY(-100%)" : "none",
                  }}
                  className="z-[99999] w-44 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900"
                >
                  <ul className="overflow-hidden text-sm font-medium text-current">

                    {/* Only show Assign/Unassign Delivery for non-Sales Officers */}
                    {!isSalesOfficer && (
                      order.delivery_officer ? (
                        <li>
                          <button
                            onClick={() => {
                              handleUnassignClick(order);
                              setIsOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
                            Unassign Delivery
                          </button>
                        </li>
                      ) : (
                        <li>
                          <button
                            onClick={() => {
                              handleAssignClick(order);
                              setIsOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3 dark:hover:text-neutral-50"
                          >
                            Assign Delivery
                          </button>
                        </li>
                      )
                    )}

                    <li>
                      <button
                        onClick={() => {
                          router.push(`/orders/${order.id}`);
                          setIsOpen(false);
                        }}
                        className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                      >
                        View Details
                      </button>
                    </li>

                    {user?.role_id === 5 && !order.delivery_officer && !order.verification?.home_location_required && (
                      ((order as any).is_customer_blacklisted || (order as any).customer?.is_blacklisted || (order as any).verification?.purchaser?.is_blacklisted || (order as any).verification?.grantors?.some((g: any) => g.is_blacklisted)) ? (
                        <li>
                          <span className="block w-full px-4 py-2.5 text-left border-t border-gray-50 text-red-500 font-semibold text-xs cursor-not-allowed dark:border-dark-3">
                            This account is blacklisted
                          </span>
                        </li>
                      ) : (
                        <li>
                          <button
                            onClick={() => {
                              router.push(`/orders/${order.id}/self-pickup`);
                              setIsOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left border-t border-gray-50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                          >
                            Self Pickup
                          </button>
                        </li>
                      )
                    )}

                    <li>
                      <button
                        onClick={() => {
                          handleCancelClick(order);
                          setIsOpen(false);
                        }}
                        className="block w-full px-4 py-2.5 text-left border-t border-gray-50 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:border-dark-3"
                      >
                        Cancel Order
                      </button>
                    </li>
                  </ul>
                </div>,
                document.body
              )}
          </>
        );
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
      rowSelection,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.limit,
      },
    },
    pageCount: pagination.totalPages,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const newState = typeof updater === 'function'
        ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.limit })
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
    getPaginationRowModel: getPaginationRowModel(),
  })

  const selectedCount = Object.keys(rowSelection).length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      {/* Top bar */}
      <div className="flex justify-between px-7.5 py-4.5">
        <div className="relative z-20 w-full max-w-[414px]">
          <input
            type="text"
            value={globalFilter || ''}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              setPagination((p) => ({ ...p, page: 1 }))
            }}
            className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d]"
            placeholder="Search approved orders..."
          />
          <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white font-medium">
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

      {/* Bulk actions */}
      {selectedCount > 0 && !isSalesOfficer && (
        <div className="px-7.5 pb-4 flex flex-wrap gap-4">
          <button
            onClick={handleBulkAssign}
            className="rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
          >
            Assign Delivery ({selectedCount})
          </button>

          <button
            onClick={handleBulkUnassign}
            className="rounded bg-red-600 px-5 py-2 text-white hover:bg-red-700"
          >
            Unassign Delivery ({selectedCount})
          </button>
        </div>
      )}

      {/* Table */}
      <div className="grid grid-cols-1 overflow-x-auto">
        <table className="datatable-table datatable-one !border-collapse px-4 md:px-8">
          <thead className="border-separate px-4">
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

                      {header.column.getCanFilter() && header.column.id !== 'select' && (
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
                <td colSpan={columns.length} className="py-12 text-center">
                  <Loader text="Loading approved orders..." />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  No approved orders found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  className="border-t border-stroke dark:border-dark-3"
                  key={row.id}
                >
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

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}

      {/* Single Assign Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false)
          setSelectedDeliveryOfficerId(null)
        }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Assign Delivery Officer</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">Select a delivery officer:</p>
        <select
          value={selectedDeliveryOfficerId ?? ''}
          onChange={(e) => setSelectedDeliveryOfficerId(Number(e.target.value))}
          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
        >
          <option value="">Select Officer</option>
          {deliveryOfficers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.username})
            </option>
          ))}
        </select>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => {
              setAssignModalOpen(false)
              setSelectedDeliveryOfficerId(null)
            }}
            disabled={isAssigning}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            onClick={confirmAssign}
            disabled={!selectedDeliveryOfficerId || isAssigning}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isAssigning && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
            {isAssigning ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </Modal>

      {/* Single Unassign Modal */}
      <Modal
        open={singleUnassignModalOpen}
        onClose={() => setSingleUnassignModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Unassign Delivery Officer</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to unassign delivery officer from order{' '}
          <strong>{selectedOrder?.order_ref}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setSingleUnassignModalOpen(false)}
            disabled={isUnassigning}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            onClick={confirmSingleUnassign}
            disabled={isUnassigning}
            className="rounded bg-red-600 px-6 py-2.5 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isUnassigning && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
            {isUnassigning ? 'Unassigning...' : 'Unassign'}
          </button>
        </div>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal
        open={bulkAssignModalOpen}
        onClose={() => {
          setBulkAssignModalOpen(false)
          setSelectedDeliveryOfficerId(null)
        }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Bulk Assign Delivery Officers</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Select a delivery officer for {selectedCount} selected orders:
        </p>
        <select
          value={selectedDeliveryOfficerId ?? ''}
          onChange={(e) => setSelectedDeliveryOfficerId(Number(e.target.value))}
          className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
        >
          <option value="">Select Officer</option>
          {deliveryOfficers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.username})
            </option>
          ))}
        </select>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => {
              setBulkAssignModalOpen(false)
              setSelectedDeliveryOfficerId(null)
            }}
            disabled={isBulkAssigning}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkAssign}
            disabled={!selectedDeliveryOfficerId || isBulkAssigning}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isBulkAssigning && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
            {isBulkAssigning ? 'Assigning All...' : 'Assign All'}
          </button>
        </div>
      </Modal>

      {/* Bulk Unassign Modal */}
      <Modal
        open={bulkUnassignModalOpen}
        onClose={() => setBulkUnassignModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Bulk Unassign Delivery Officers</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to unassign delivery officer from{' '}
          <strong>{selectedCount}</strong> selected orders?
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setBulkUnassignModalOpen(false)}
            disabled={isBulkUnassigning}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3"
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkUnassign}
            disabled={isBulkUnassigning}
            className="rounded bg-red-600 px-6 py-2.5 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isBulkUnassigning && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>}
            {isBulkUnassigning ? 'Unassigning...' : 'Unassign All'}
          </button>
        </div>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Cancel Order</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-300">
          Are you sure you want to cancel order <strong>{selectedOrder?.order_ref}</strong>?
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Reason for Cancellation (Mandatory):</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
              rows={3}
              placeholder="e.g., Customer not responding, Incorrect information..."
            ></textarea>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setCancelModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmittingCancel}
          >
            Back
          </button>
          <button
            onClick={confirmCancel}
            disabled={!cancelReason.trim() || isSubmittingCancel}
            className="rounded bg-red-600 px-6 py-2.5 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmittingCancel ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </Modal>
    </section>
  )
}

export default ApprovedOrderList