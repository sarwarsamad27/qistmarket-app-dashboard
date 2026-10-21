'use client'
import { useEffect, useState, useRef } from 'react'
import Pagination from '../common/Pagination'
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
import { ChevronLeft, ChevronRight, SearchIcon, PointerUp } from '@/assets/icons'
import ColumnFilter from '../DataTables/ColumnFilter'
import { Modal } from '../Modal/Modal'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { formatExactDate } from "@/utils/dateUtils";

import { serialColumn } from '@/utils/serialColumn'
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Order {
    id: number
    order_ref: string
    token_number: string
    customer_name: string
    whatsapp_number: string
    address: string
    area: string;
    zone: string | null;
    product_name: string
    delivered_product_name?: string
    delivered_imei?: string
    total_amount: number
    advance_amount: number
    monthly_amount: number
    months: number
    status: string
    created_at: string
    updated_at: string
    assigned_to: { id: number; username: string; full_name: string } | null
    delivery_officer: { id: number; username: string; full_name: string } | null
    recovery_officer: { id: number; username: string; full_name: string } | null
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
const RecoveryOrderList = () => {
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
    const [isAssigning, setIsAssigning] = useState(false)
    const [isUnassigning, setIsUnassigning] = useState(false)

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
    const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(null)
    const [recoveryOfficers, setRecoveryOfficers] = useState<User[]>([])

    // ── Data Fetching ──────────────────────────────────────────────────────────
    const fetchOrders = async () => {
        setLoading(true)
        try {
            const token = Cookies.get('auth_token')
            if (!token) return

            const params = new URLSearchParams({
                page: (pagination?.page || 1).toString(),
                limit: (pagination?.limit || 10).toString(),
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

            const res = await fetch(`${BACKEND_URL}/api/orders/delivered-list?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (json.success) {
                setOrders(json.data.orders)
                setPagination(prev => ({ ...prev, ...json.data.pagination }))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const fetchOfficers = async () => {
        try {
            const token = Cookies.get('auth_token')
            const res = await fetch(`${BACKEND_URL}/api/users/recovery-officers`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (json.success) setRecoveryOfficers(json.data.officers)
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        fetchOrders()
    }, [pagination.page, pagination.limit, globalFilter, columnFilters, sorting, dateRange, startDate, endDate])

    useEffect(() => {
        fetchOfficers()
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
        if (!selectedOrder || !selectedOfficerId) return
        setIsAssigning(true)
        try {
            const token = Cookies.get('auth_token')
            const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/assign-recovery`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ user_id: selectedOfficerId }),
            })
            if (res.ok) {
                await fetchOrders()
                setAssignModalOpen(false)
                setSelectedOfficerId(null)
                setSelectedOrder(null)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsAssigning(false)
        }
    }

    const confirmSingleUnassign = async () => {
        if (!selectedOrder) return
        setIsUnassigning(true)
        try {
            const token = Cookies.get('auth_token')
            const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/assign-recovery`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ action: 'unassign' }),
            })
            if (res.ok) {
                await fetchOrders()
                setSingleUnassignModalOpen(false)
                setSelectedOrder(null)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsUnassigning(false)
        }
    }

    const confirmBulkAssign = async () => {
        if (!selectedOfficerId) return
        const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)
        setIsAssigning(true)
        try {
            const token = Cookies.get('auth_token')
            const res = await fetch(`${BACKEND_URL}/api/orders/assign-bulk-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ order_ids: ids, user_id: selectedOfficerId }),
            })
            if (res.ok) {
                await fetchOrders()
                setBulkAssignModalOpen(false)
                setRowSelection({})
                setSelectedOfficerId(null)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsAssigning(false)
        }
    }

    const confirmBulkUnassign = async () => {
        const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)
        setIsUnassigning(true)
        try {
            const token = Cookies.get('auth_token')
            const res = await fetch(`${BACKEND_URL}/api/orders/assign-bulk-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ order_ids: ids, action: 'unassign' }),
            })
            if (res.ok) {
                await fetchOrders()
                setBulkUnassignModalOpen(false)
                setRowSelection({})
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsUnassigning(false)
        }
    }

    // ── Columns ────────────────────────────────────────────────────────────────
    const columns: ColumnDef<Order>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stroke text-[#ff3d3d] focus:ring-[#ff3d3d]"
                    checked={table.getIsAllPageRowsSelected()}
                    onChange={table.getToggleAllPageRowsSelectedHandler()}
                />
            ),
            cell: ({ row }) => (
                <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stroke text-[#ff3d3d] focus:ring-[#ff3d3d]"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                />
            ),
            enableSorting: false,
            enableColumnFilter: false,
        },
        serialColumn<Order>(),
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
        { accessorKey: 'customer_name', header: 'Customer', enableColumnFilter: true },
        { accessorKey: 'whatsapp_number', header: 'WhatsApp', enableColumnFilter: true },
            { accessorKey: 'city', header: 'City', enableColumnFilter: true },
        { accessorKey: 'area', header: 'Area', enableColumnFilter: true },
                {
                id: 'product',
                header: 'Delivered Product',
                accessorFn: (row: Order) => row.delivered_product_name || row.product_name,
                enableColumnFilter: true,
            },
        {
            accessorKey: 'status',
            header: 'Status',
            enableColumnFilter: true,
            cell: ({ row }) => {
                const status = row.original.status
                return (
                    <span
                        className={cn(
                            'inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
                            status === 'delivered'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        )}
                    >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                )
            },
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
            id: 'recovery_officer',
            accessorFn: (row) => row.recovery_officer?.full_name || 'Unassigned',
            header: 'Recovery Officer',
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
                    const dropdownWidth = 192;
                    const dropdownHeight = 150;
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceRight = window.innerWidth - rect.right;
                    const shouldOpenUp = spaceBelow < dropdownHeight;
                    const shouldAlignLeft = spaceRight < dropdownWidth;
                    setOpenUp(shouldOpenUp);
                    setPosition({
                        top: shouldOpenUp ? rect.top + window.scrollY - 8 : rect.bottom + window.scrollY + 6,
                        left: shouldAlignLeft ? rect.left + window.scrollX : rect.right + window.scrollX - dropdownWidth,
                    });
                    setIsOpen((prev) => !prev);
                };

                useEffect(() => {
                    const handleClickOutside = (e: MouseEvent) => {
                        if (triggerRef.current && !triggerRef.current.contains(e.target as Node) && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                            setIsOpen(false);
                        }
                    };
                    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
                    return () => document.removeEventListener("mousedown", handleClickOutside);
                }, [isOpen]);

                return (
                    <>
                        <button
                            ref={triggerRef}
                            onClick={toggleDropdown}
                            className="group flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-dark shadow-[0_1px_3px_0_rgba(166,175,195,0.4)] hover:text-[#ff3d3d] dark:border dark:border-dark-3 dark:text-white dark:shadow-none"
                        >
                            <span>Actions</span>
                            <svg className={`size-4 transition-transform ${isOpen ? "rotate-0" : "rotate-180"}`} viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.7a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                            </svg>
                        </button>
                        {isOpen && createPortal(
                            <div
                                ref={dropdownRef}
                                style={{ position: "absolute", top: position.top, left: position.left, transform: openUp ? "translateY(-100%)" : "none" }}
                                className="z-[99999] w-48 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900 overflow-hidden"
                            >
                                <ul className="text-sm font-medium">
                                    <li>
                                        <button
                                            className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                                            onClick={() => { order.recovery_officer ? handleUnassignClick(order) : handleAssignClick(order); setIsOpen(false); }}
                                        >
                                            {order.recovery_officer ? 'Unassign Recovery' : 'Assign Recovery'}
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                                            onClick={() => { router.push(`/orders/${order.id}`); setIsOpen(false); }}
                                        >
                                            View Details
                                        </button>
                                    </li>
                                </ul>
                            </div>, document.body
                        )}
                    </>
                )
            }
        }
    ]

    const table = useReactTable({
        data: orders,
        columns,
        state: { globalFilter, columnFilters, sorting, rowSelection, pagination: { pageIndex: pagination.page - 1, pageSize: pagination.limit } },
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
            const newState = typeof updater === 'function' ? updater({ pageIndex: pagination.page - 1, pageSize: pagination.limit }) : updater
            setPagination((prev) => ({ ...prev, page: newState.pageIndex + 1, limit: newState.pageSize }))
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    })

    const selectedCount = Object.keys(rowSelection).length

    return (
        <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
            {/* Top bar */}
            <div className="flex flex-col gap-4 px-7.5 py-4.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative z-20 w-full max-w-[500px]">
                    <input
                        type="text"
                        value={globalFilter || ''}
                        onChange={(e) => {
                            setGlobalFilter(e.target.value)
                            setPagination((p) => ({ ...p, page: 1 }))
                        }}
                        className="w-full rounded-lg border border-stroke bg-transparent px-5 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
                        placeholder="Search recovery orders..."
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
                            onChange={e => { setDateRange(e.target.value); setPagination(p => ({ ...p, page: 1 })) }}
                            className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 font-medium"
                        >
                            {['All', 'Day', 'Week', 'Month', 'Quarter', 'Year', 'Custom Range'].map(r => (
                                <option key={r} value={r} className='dark:bg-dark-2'>{r}</option>
                            ))}
                        </select>
                    </div>
                    {dateRange === 'Custom Range' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="rounded-lg border border-stroke bg-transparent px-2 py-1 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
                            />
                            <span className="text-gray-500">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="rounded-lg border border-stroke bg-transparent px-2 py-1 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
                            />
                        </div>
                    )}
                    <div className="flex items-center text-dark dark:text-current font-medium">
                        <p className="pl-2">Per Page:</p>
                        <select
                            value={pagination.limit}
                            onChange={e => setPagination(p => ({ ...p, limit: Number(e.target.value), page: 1 }))}
                            className="bg-transparent pl-2.5 outline-none"
                        >
                            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Bulk actions */}
            {selectedCount > 0 && (
                <div className="px-7.5 pb-4 flex gap-4">
                    <button
                        onClick={() => setBulkAssignModalOpen(true)}
                        className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-all flex items-center gap-2"
                    >
                        Assign Recovery ({selectedCount})
                    </button>
                    <button
                        onClick={() => setBulkUnassignModalOpen(true)}
                        className="rounded-lg border-2 border-red-600 bg-transparent px-5 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:border-red-700 hover:text-red-700 transition-all flex items-center gap-2"
                    >
                        Unassign Recovery ({selectedCount})
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="grid grid-cols-1 overflow-x-auto">
                <table className="datatable-table datatable-one !border-collapse w-full px-4 md:px-8">
                    <thead>
                        {table.getHeaderGroups().map(hg => (
                            <tr key={hg.id} className="border-t border-stroke dark:border-dark-3">
                                {hg.headers.map(h => (
                                    <th key={h.id} className="whitespace-nowrap px-3 py-4 align-top">
                                        <div className="flex flex-col min-h-[70px]">
                                            <div className="flex cursor-pointer items-center" onClick={h.column.getToggleSortingHandler()}>
                                                <span className="font-[500] text-dark dark:text-white">
                                                    {flexRender(h.column.columnDef.header, h.getContext())}
                                                </span>
                                                {h.column.getCanSort() && (
                                                    <div className="ml-2 inline-flex flex-col">
                                                        <PointerUp className="size-2.5" />
                                                        <PointerUp className="size-2.5 rotate-180" />
                                                    </div>
                                                )}
                                            </div>
                                            {h.column.getCanFilter() && h.column.id !== 'select' && (
                                                <div className="mt-2">
                                                    <ColumnFilter column={{ filterValue: h.column.getFilterValue() as string, setFilter: h.column.setFilterValue }} />
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
                                    <Loader text="Loading recovery orders..." />
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="py-20 text-center text-gray-500">
                                    No recovery orders found
                                </td>
                            </tr>
                        ) : (
                            table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="border-t border-stroke dark:border-dark-3 hover:bg-gray-50/50 dark:hover:bg-dark-2/50">
                                    {row.getVisibleCells().map(cell => (
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
            <div className="flex flex-col sm:flex-row justify-between items-center px-7.5 py-7 gap-4">
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

            {/* Modals */}
            <Modal open={assignModalOpen || bulkAssignModalOpen} onClose={() => { setAssignModalOpen(false); setBulkAssignModalOpen(false); }}>
                <div className="max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                    <h2 className="text-xl font-bold mb-4 text-dark dark:text-white">Assign Recovery Officer</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Choose an officer to handle recovery for <strong>{bulkAssignModalOpen ? 'selected orders' : selectedOrder?.order_ref}</strong>.</p>
                    <select
                        value={selectedOfficerId || ''}
                        onChange={e => setSelectedOfficerId(Number(e.target.value))}
                        className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 mb-6"
                    >
                        <option value="">Select Recovery Officer</option>
                        {recoveryOfficers.map(o => <option key={o.id} value={o.id} className="dark:bg-dark-2">{o.full_name} (@{o.username})</option>)}
                    </select>
                    <div className="flex gap-4">
                        <button
                            disabled={isAssigning}
                            onClick={() => { setAssignModalOpen(false); setBulkAssignModalOpen(false); setSelectedOfficerId(null); }}
                            className="flex-1 py-2.5 border border-stroke rounded-lg font-bold text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={isAssigning || !selectedOfficerId}
                            onClick={assignModalOpen ? confirmAssign : confirmBulkAssign}
                            className="flex-1 py-2.5 bg-[#ff3d3d] text-white rounded-lg font-bold hover:bg-[#ff3d3d]/90 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isAssigning ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    <span>Assigning...</span>
                                </>
                            ) : (
                                'Assign Now'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={singleUnassignModalOpen || bulkUnassignModalOpen} onClose={() => { setSingleUnassignModalOpen(false); setBulkUnassignModalOpen(false); }}>
                <div className="max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
                    <h2 className="text-xl font-bold mb-4 text-red-600">Unassign Recovery</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">
                        Are you sure you want to remove the recovery officer from <strong>{bulkUnassignModalOpen ? 'these orders' : selectedOrder?.order_ref}</strong>?
                    </p>
                    <div className="flex gap-4 pt-2">
                        <button
                            disabled={isUnassigning}
                            onClick={() => { setSingleUnassignModalOpen(false); setBulkUnassignModalOpen(false); }}
                            className="flex-1 py-2.5 border border-stroke rounded-lg font-bold text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
                        >
                            No, keep it
                        </button>
                        <button
                            disabled={isUnassigning}
                            onClick={singleUnassignModalOpen ? confirmSingleUnassign : confirmBulkUnassign}
                            className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isUnassigning ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                    <span>Unassigning...</span>
                                </>
                            ) : (
                                'Yes, Unassign'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </section>
    )
}

export default RecoveryOrderList
