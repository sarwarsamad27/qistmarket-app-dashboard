'use client'
import { useEffect, useState, Suspense } from 'react'
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
import { ChevronLeft, ChevronRight, SearchIcon, PointerUp, ChevronUpIcon } from '@/assets/icons'
import ColumnFilter from '../DataTables/ColumnFilter'
import { Modal } from '../Modal/Modal'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Pagination from '../common/Pagination'
import { useAuth } from '../../../contexts/AuthContext'
import { ArrowRightLeft, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatExactDate } from "@/utils/dateUtils";

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
  locations: Array<{ timestamp: string }>
  documents: Array<{ uploaded_at: string }>
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
  delivered_product_name?: string
  delivered_imei?: string
  advance_amount: number
  monthly_amount: number
  months: number
  channel: string
  status: string
  created_at: string
  updated_at?: string
  created_by: { username: string } | null
  assigned_to: { username: string } | null
  delivery_officer: { username: string; full_name: string } | null
  recovery_officer: { username: string; full_name: string } | null
  outlet_id?: number | null
  cancelled_reason?: string | null
  cancelled_at?: string | null
  is_customer_blacklisted?: boolean
  can_exchange?: boolean
  verification: VerificationNested | null
  // Present only while status is 'awaiting_paytrigger_enrollment'. A non-empty
  // paytrigger_devices means this is a real PayTrigger-gated device (Tecno/
  // Infinix/Itel, enrollment toggle on) — completed only by the PayTrigger
  // webhook, never by a manual lock-screen photo. Empty/absent means this is
  // a manual "Waiting For Software Activation" pending delivery (unsupported
  // brand, or the toggle was off) — the manual lock-screen photo is the only
  // way to complete it.
  delivery?: { status?: string; paytrigger_devices?: { id: number }[] } | null
  productHistories?: {
    id: number
    previous_product: string
    current_product: string
    changed_at: string
    changed_by: { username: string, full_name: string }
  }[]
}

interface OrderListProps {
  forcedStatus?: string
  forcedChannel?: string
  apiEndpoint?: string
  hideActions?: boolean
  hideSelection?: boolean
  showAllStatuses?: boolean
  onRowSelectionChange?: (selectedOrders: Order[]) => void
  customTopBarActions?: React.ReactNode
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
const OrderListContent = ({ forcedStatus, forcedChannel, apiEndpoint, hideActions, hideSelection, showAllStatuses, onRowSelectionChange, customTopBarActions }: OrderListProps) => {
  const router = useRouter()
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false)
  const [bulkUnassignModalOpen, setBulkUnassignModalOpen] = useState(false)
  const [singleUnassignModalOpen, setSingleUnassignModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [untransferModalOpen, setUntransferModalOpen] = useState(false)
  const [bulkTransferModalOpen, setBulkTransferModalOpen] = useState(false)
  const [bulkUntransferModalOpen, setBulkUntransferModalOpen] = useState(false)
  const [outlets, setOutlets] = useState<any[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<number | null>(null)
  const { user } = useAuth()
  const userRole = user?.role?.toLowerCase() || ''
  const isSalesOfficer = userRole === 'sales officer'
  const isSuperAdmin = userRole === 'super admin'
  const isOutletBranchUser = user?.role_id === 5

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [selectedVerifierId, setSelectedVerifierId] = useState<number | null>(null)
  const [verifiers, setVerifiers] = useState<User[]>([])
  
  const [selectedDeliveryOfficerId, setSelectedDeliveryOfficerId] = useState<number | null>(null)
  const [deliveryOfficers, setDeliveryOfficers] = useState<User[]>([])

  const searchParams = useSearchParams()
  const urlStatus = searchParams.get('status')
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
  const [statusFilter, setStatusFilter] = useState(urlStatus ? urlStatus : 'All')

  // Sync statusFilter & dateRange if URL params change
  useEffect(() => {
    if (urlStatus && urlStatus !== statusFilter) {
      setStatusFilter(urlStatus)
    }
    if (urlDateRange) {
      const parsed = parseDateRange(urlDateRange)
      setDateRange(parsed)
      if (urlStartDate) setStartDate(urlStartDate)
      if (urlEndDate) setEndDate(urlEndDate)
    }
  }, [urlStatus, urlDateRange, urlStartDate, urlEndDate])

  // Action Modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [subcategories, setSubcategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubcategory, setSelectedSubcategory] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)

  // Manual Lock Photo Modal State
  const [manualLockModalOpen, setManualLockModalOpen] = useState(false)
  const [selectedOrderForManualLock, setSelectedOrderForManualLock] = useState<Order | null>(null)
  const [manualLockPhotoFile, setManualLockPhotoFile] = useState<File | null>(null)
  const [isUploadingManualLock, setIsUploadingManualLock] = useState(false)

  const handleOpenManualLockModal = (order: Order) => {
    setSelectedOrderForManualLock(order)
    setManualLockPhotoFile(null)
    setManualLockModalOpen(true)
  }

  const handleManualLockPhotoSubmit = async () => {
    if (!selectedOrderForManualLock || !manualLockPhotoFile) {
      toast.error('Please select a lock screen photo to upload.')
      return
    }

    try {
      setIsUploadingManualLock(true)
      const token = Cookies.get('auth_token')
      const formData = new FormData()
      formData.append('manual_lock_photo', manualLockPhotoFile)

      const res = await fetch(`${BACKEND_URL}/api/paytrigger/order/${selectedOrderForManualLock.id}/manual-lock-photo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to submit lock photo')
      }

      toast.success(data.message || 'Lock screen photo submitted successfully. Order is now delivered!')
      setManualLockModalOpen(false)
      setSelectedOrderForManualLock(null)
      setManualLockPhotoFile(null)
      await fetchOrders()
    } catch (err: any) {
      console.error('Submit manual lock photo error:', err)
      toast.error(err.message || 'Failed to submit lock photo')
    } finally {
      setIsUploadingManualLock(false)
    }
  }

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchOrders = async () => {
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

      if (forcedStatus) {
        params.append('status', forcedStatus)
      } else if (showAllStatuses) {
        if (statusFilter !== 'All') {
          params.append('status', statusFilter)
        }
      } else {
        // Default for New Orders page: srif new wale
        const colStatusFilter = columnFilters.find(f => f.id === 'status')
        if (!colStatusFilter) {
          params.append('status', 'new')
        }
      }

      if (forcedChannel) {
        params.append('channel', forcedChannel)
      }

      columnFilters.forEach((f) => {
        if (f.id && f.value) params.append(f.id, String(f.value))
      })

      if (dateRange && dateRange !== 'All') {
        params.append('dateRange', dateRange)
        if (dateRange === 'Custom Range' && startDate && endDate) {
          params.append('startDate', startDate)
          params.append('endDate', endDate)
        }
      }

      const apiPath = apiEndpoint || '/api/orders'
      const res = await fetch(`${BACKEND_URL}${apiPath}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error('Failed to fetch orders')
      const json = await res.json()

      if (json.success && json.data?.orders) {
        let fetchedOrders = json.data.orders;

        setOrders(fetchedOrders)
        setPagination(prev => ({
          ...prev,
          ...json.data.pagination,
        }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchVerifiers = async () => {
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/users/verification-officers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success) setVerifiers(json.data.users || [])
      }
    } catch (err) {
      console.error('Failed to load verifiers', err)
    }
  }

  const fetchOutlets = async () => {
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/all-outlets`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        if (json.success) setOutlets(json.data || [])
      }
    } catch (err) {
      console.error('Failed to load outlets', err)
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
        if (json.success) setDeliveryOfficers(json.data.officers || [])
      }
    } catch (err) {
      console.error('Failed to load delivery officers', err)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, pagination.limit, globalFilter, columnFilters, sorting, dateRange, startDate, endDate, statusFilter])

  useEffect(() => {
    fetchVerifiers()
    fetchOutlets()
    fetchDeliveryOfficers()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = Cookies.get('auth_token')
        const res = await fetch(`${BACKEND_URL}/api/products`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.success) {
            setProducts(json.data)
            const uniqueCategories = Array.from(new Set(json.data.map((p: any) => p.category_name))) as string[]
            setCategories(uniqueCategories.sort())
          }
        }
      } catch (err) {
        console.error('Failed to load products', err)
      }
    }
    fetchProducts()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      const filteredSubcats = Array.from(new Set(
        products
          .filter(p => p.category_name === selectedCategory)
          .map(p => p.subcategory_name)
      )) as string[]
      setSubcategories(filteredSubcats.sort())
      setSelectedSubcategory('')
      setSelectedProduct(null)
      setSelectedPlan(null)
    } else {
      setSubcategories([])
    }
  }, [selectedCategory, products])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAssignClick = (order: Order) => {
    setSelectedOrder(order)
    setAssignModalOpen(true)
  }

  const handleTransferClick = (order: Order) => {
    setSelectedOrder(order)
    setTransferModalOpen(true)
  }

  const handleUnassignClick = (order: Order) => {
    setSelectedOrder(order)
    setSingleUnassignModalOpen(true)
  }

  const confirmAssign = async () => {
      const isVerification = selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress';
      const targetUserId = isVerification ? selectedVerifierId : selectedDeliveryOfficerId;
      
      if (!selectedOrder || !targetUserId) return
      setIsSubmitting(true)
      try {
        const token = Cookies.get('auth_token')
        const endpoint = isVerification
            ? `${BACKEND_URL}/api/orders/${selectedOrder.id}/assign`
            : `${BACKEND_URL}/api/orders/${selectedOrder.id}/assign-delivery`

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: targetUserId, action: 'assign' }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Assign failed')

      toast.success(data.message || 'Assigned successfully')
      await fetchOrders()
      setAssignModalOpen(false)
      setSelectedVerifierId(null)
      setSelectedDeliveryOfficerId(null)
      setSelectedOrder(null)
    } catch (err: any) {
      console.error('Assign error:', err)
      toast.error(err.message || 'Assign failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmSingleUnassign = async () => {
    if (!selectedOrder) return
    setIsSubmitting(true)
    try {
      const isVerification = selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress';
      const token = Cookies.get('auth_token')
      const endpoint = isVerification
        ? `${BACKEND_URL}/api/orders/${selectedOrder.id}/assign`
        : `${BACKEND_URL}/api/orders/${selectedOrder.id}/assign-delivery`

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'unassign' }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Unassign failed')

      toast.success(data.message || 'Unassigned successfully')
      await fetchOrders()
      setSingleUnassignModalOpen(false)
      setSelectedOrder(null)
    } catch (err: any) {
      console.error('Unassign error:', err)
      toast.error(err.message || 'Unassign failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkAssign = () => {
    setBulkAssignModalOpen(true)
  }

  const handleBulkTransfer = () => {
    setBulkTransferModalOpen(true)
  }

  const handleBulkUnassign = () => {
    setBulkUnassignModalOpen(true)
  }

  const confirmBulkAssign = async () => {
      const isVerification = forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress';
      const targetUserId = isVerification ? selectedVerifierId : selectedDeliveryOfficerId;
      
      if (!targetUserId) return
      const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)
      setIsSubmitting(true)

      try {
        const token = Cookies.get('auth_token')
        const endpoint = isVerification
          ? `${BACKEND_URL}/api/orders/assign-bulk`
          : `${BACKEND_URL}/api/orders/assign-bulk-delivery`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_ids: ids, user_id: targetUserId, action: 'assign' }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Bulk assign failed')

      toast.success(data.message || 'Bulk assign successful')
      await fetchOrders()
      setBulkAssignModalOpen(false)
      setRowSelection({})
      setSelectedVerifierId(null)
      setSelectedDeliveryOfficerId(null)
    } catch (err: any) {
      console.error('Bulk assign error:', err)
      toast.error(err.message || 'Bulk assign failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmTransfer = async () => {
    if (!selectedOrder || !selectedOutletId) return
    setIsSubmitting(true)
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/transfer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ outlet_id: selectedOutletId }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Transfer failed')

      toast.success(data.message || 'Transferred successfully')
      await fetchOrders()
      setTransferModalOpen(false)
      setSelectedOutletId(null)
      setSelectedOrder(null)
    } catch (err: any) {
      console.error('Transfer error:', err)
      toast.error(err.message || 'Transfer failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUntransferClick = (order: Order) => {
    setSelectedOrder(order)
    setUntransferModalOpen(true)
  }

  const confirmUntransfer = async () => {
    if (!selectedOrder) return
    setIsSubmitting(true)
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/transfer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'untransfer' }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Untransfer failed')

      toast.success(data.message || 'Take back successfully')
      await fetchOrders()
      setUntransferModalOpen(false)
      setSelectedOrder(null)
    } catch (err: any) {
      console.error('Untransfer error:', err)
      toast.error(err.message || 'Untransfer failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmBulkTransfer = async () => {
    if (!selectedOutletId) return
    const ids = table.getSelectedRowModel().rows
      .filter((r) => r.original.outlet_id === null)
      .map((r) => r.original.id)
    
    if (ids.length === 0) {
      toast.error('Selected orders are already transferred.')
      setBulkTransferModalOpen(false)
      setRowSelection({})
      return
    }

    setIsSubmitting(true)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/transfer-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_ids: ids, outlet_id: selectedOutletId }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Bulk transfer failed')

      toast.success(data.message || 'Bulk transfer successful')
      await fetchOrders()
      setBulkTransferModalOpen(false)
      setRowSelection({})
      setSelectedOutletId(null)
    } catch (err: any) {
      console.error('Bulk transfer error:', err)
      toast.error(err.message || 'Bulk transfer failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkUntransfer = () => {
    setBulkUntransferModalOpen(true)
  }

  const confirmBulkUntransfer = async () => {
    const ids = table.getSelectedRowModel().rows
      .filter((r) => r.original.outlet_id !== null)
      .map((r) => r.original.id)
    
    if (ids.length === 0) {
      toast.error('Selected orders are not transferred.')
      setBulkUntransferModalOpen(false)
      setRowSelection({})
      return
    }

    setIsSubmitting(true)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/transfer-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_ids: ids, action: 'untransfer' }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Bulk untransfer failed')

      toast.success(data.message || 'Bulk take back successful')
      await fetchOrders()
      setBulkUntransferModalOpen(false)
      setRowSelection({})
    } catch (err: any) {
      console.error('Bulk untransfer error:', err)
      toast.error(err.message || 'Bulk take back failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelClick = (order: Order) => {
    setSelectedOrder(order)
    setCancelReason('')
    setCancelModalOpen(true)
  }

  const confirmCancel = async () => {
    if (!selectedOrder || !cancelReason.trim()) return
    setIsSubmitting(true)
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
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Cancellation failed')

      toast.success(data.message || 'Order cancelled successfully')
      await fetchOrders()
      setCancelModalOpen(false)
      setSelectedOrder(null)
    } catch (err: any) {
      console.error('Cancel error:', err)
      toast.error(err.message || 'Cancellation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelEnrollment = async (order: Order) => {
    if (!confirm('Cancel Software Activation enrollment for this order? It will move back to Approved Orders so delivery can be re-processed.')) return
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/paytrigger/order/${order.id}/cancel-enrollment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Failed to cancel enrollment')

      toast.success(data.message || 'Enrollment cancelled, order moved back to Approved')
      await fetchOrders()
    } catch (err: any) {
      console.error('Cancel enrollment error:', err)
      toast.error(err.message || 'Failed to cancel enrollment')
    }
  }

  const handleEditClick = (order: Order) => {
    setSelectedOrder(order)
    setNewProductName(order.product_name)
    setSelectedCategory('')
    setSelectedSubcategory('')
    setSelectedProduct(null)
    setSelectedPlan(null)
    setEditModalOpen(true)
  }

  const confirmEdit = async () => {
    if (!selectedOrder || !selectedProduct || !selectedPlan) return
    setIsSubmitting(true)
    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/orders/${selectedOrder.id}/update-item`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_name: selectedProduct.name,
          advance_amount: selectedPlan.advance,
          monthly_amount: selectedPlan.monthlyAmount,
          months: selectedPlan.months,
          total_amount: selectedPlan.totalPrice
        }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Update failed')

      toast.success(data.message || 'Order updated successfully')
      await fetchOrders()
      setEditModalOpen(false)
      setSelectedOrder(null)
      setSelectedProduct(null)
      setSelectedPlan(null)
    } catch (err: any) {
      console.error('Update error:', err)
      toast.error(err.message || 'Update failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewClick = (order: Order) => {
    router.push(`/orders/${order.id}`)
  }


  const confirmBulkUnassign = async () => {
      const isVerification = forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress';
      const ids = table.getSelectedRowModel().rows.map((r) => r.original.id)
      setIsSubmitting(true)

      try {
        const token = Cookies.get('auth_token')
        const endpoint = isVerification
          ? `${BACKEND_URL}/api/orders/assign-bulk`
          : `${BACKEND_URL}/api/orders/assign-bulk-delivery`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_ids: ids, action: 'unassign' }),
      })

      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.message || data.error?.message || 'Bulk unassign failed')

      toast.success(data.message || 'Bulk unassign successful')
      await fetchOrders()
      setBulkUnassignModalOpen(false)
      setRowSelection({})
    } catch (err: any) {
      console.error('Bulk unassign error:', err)
      toast.error(err.message || 'Bulk unassign failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Column visibility flags based on page status
  const hideAssignedTo = ['rejected', 'expired', 'cancelled', 'returned'].includes(forcedStatus || '')
  const showDeliveryOfficer = ['completed', 'delivered', 'picked', 'approved', 'returned'].includes(forcedStatus || '')
  const showRecoveryOfficer = ['delivered'].includes(forcedStatus || '')

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Order>[] = [
    ...(hideSelection ? [] : [{
      id: 'select',
      header: ({ table }: { table: any }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }: { row: any }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          disabled={!row.getCanSelect()}
        />
      ),
      enableSorting: false,
      enableColumnFilter: false,
    }]),
    {
      accessorKey: 'updated_at',
      header: 'Activity Date',
      cell: ({ row, getValue }) => {
        const orig = row.original as any
        const isDelivered = (orig.status || '').toLowerCase() === 'delivered' || Boolean(orig.is_delivered)
        const isReturned = (orig.status || '').toLowerCase() === 'returned' || forcedStatus === 'returned'
        const rawVal = getValue() as string
        const val = isDelivered ? (orig.delivered_at || rawVal) : rawVal
        const createdAt = orig.created_at

        let clearedMoveText = null
        if (isReturned && val) {
          const returnTime = new Date(val).getTime()
          if (!isNaN(returnTime)) {
            const clearTime = returnTime + 3 * 24 * 60 * 60 * 1000
            const clearsAtDateStr = formatExactDate(new Date(clearTime), 'MMM DD, YYYY')
            const now = Date.now()
            const diffMs = clearTime - now
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

            if (diffMs <= 0) {
              clearedMoveText = `Moves to Cleared: ${clearsAtDateStr} (Today)`
            } else if (diffDays === 1) {
              clearedMoveText = `Moves to Cleared: ${clearsAtDateStr} (Tomorrow)`
            } else {
              clearedMoveText = `Moves to Cleared: ${clearsAtDateStr} (${diffDays} days left)`
            }
          }
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-dark dark:text-white">
              {val ? formatExactDate(val, 'MMM DD, YYYY hh:mm A') : 'N/A'}
            </span>
            {createdAt && (
              <span className="text-[10px] text-gray-400">
                Placed: {formatExactDate(createdAt, 'MMM DD, YYYY')}
              </span>
            )}
            {clearedMoveText && (
              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 w-fit mt-1">
                {clearedMoveText}
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
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.order_ref}</span>
          {row.original.channel === 'legacy_import' && (
            <span
              title="Imported from the old paper-ledger records"
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              Legacy
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer Name',
      enableColumnFilter: true,
      // Prefer the verified purchaser's name (captured during verification)
      // over order.customer_name, which is just whatever was typed at order
      // creation and is often a placeholder/test value. Falls back to
      // customer_name when there's no verification/purchaser yet.
      cell: ({ row }) => row.original.verification?.purchaser?.name || row.original.customer_name,
    },
    { accessorKey: 'whatsapp_number', header: 'WhatsApp', enableColumnFilter: true },
    { accessorKey: 'city', header: 'City', enableColumnFilter: true },
    { accessorKey: 'area', header: 'Area', enableColumnFilter: true },
    {
      id: 'product',
      header: (['delivered', 'returned', 'recovery'].includes(forcedStatus || '') ? 'Delivered Product' : 'Suggested Product'),
      accessorFn: (row: Order) => {
        if (['delivered', 'returned', 'recovery'].includes(forcedStatus || '')) return row.delivered_product_name || row.product_name
        return row.product_name
      },
      enableColumnFilter: true,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableColumnFilter: true,
      cell: ({ row }) => {
        const order = row.original
        const isActuallyTransferred = isSalesOfficer && order.outlet_id !== null
        const status = order.status?.toLowerCase() || '';

        let label = '';
        let className = 'inline-flex px-2.5 py-1 rounded-full text-xs font-medium';

        switch (status) {
          case 'new':
            if (isActuallyTransferred) {
              label = 'Transferred'
              className += ' bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            } else {
              label = 'New'
              className += ' bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
            }
            break;

            case 'pending':
            if (isActuallyTransferred) {
              label = 'Transferred'
              className += ' bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            } else {
              label = 'Pending'
              className += ' bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
            }
            break;

          case 'transferred':
            // Sent to an outlet but not yet actioned there — the outlet's
            // own inbox should still read as "New" (it's new work for them),
            // while everyone else (CSR/admin pipeline view) sees "Transferred".
            if (isOutletBranchUser) {
              label = 'New'
              className += ' bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
            } else {
              label = 'Transferred'
              className += ' bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
            }
            break;

          case 'in_progress':
            label = 'In Progress';
            className += ' bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
            break;

          case 'ready_for_pickup':
            label = 'Ready for Pickup';
            className += ' bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
            break;

          case 'awaiting_paytrigger_enrollment':
            label = 'Waiting For Software Activation';
            className += ' bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
            break;

          case 'picked':
            label = 'Picked';
            className += ' bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
            break;

          case 'cancelled':
            label = 'Cancelled';
            className += ' bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
            break;

          case 'rejected':
            label = 'Rejected';
            className += ' bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
            break;

          case 'expired':
            label = 'Expired';
            className += ' bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
            break;

          case 'completed':
            label = 'Completed';
            className += ' bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300';
            break;

          case 'delivered':
            label = 'Delivered';
            className += ' bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
            break;

          case 'approved':
            label = 'Approved';
            className += ' bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
            break;

          case 'returned':
            label = 'Returned';
            className += ' bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
            break;

          case 'picked':
            label = 'Picked';
            className += ' bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
            break;

          default:
            label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
            className += ' bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
            break;
        }

        return <span className={className}>{label}</span>;
      },
    },
    {
      id: 'created_by',
      accessorFn: (row) => row.created_by?.username || '',
      header: 'Created By',
      enableColumnFilter: true,
    },
    // Show 'Assigned To' for all statuses except rejected, expired, cancelled
    ...(hideAssignedTo ? [] : [{
      id: 'assigned_to',
      accessorFn: (row: Order) => row.assigned_to?.username || 'Unassigned',
      header: 'Verification Officer',
      enableColumnFilter: true,
    }]),
    ...(showDeliveryOfficer ? [{
      id: 'delivery_officer',
      accessorFn: (row: Order) => row.delivery_officer?.username || 'Unassigned',
      header: 'Delivery Officer',
      enableColumnFilter: true,
    }] : []),
    ...(showRecoveryOfficer ? [{
      id: 'recovery_officer',
      accessorFn: (row: Order) => row.recovery_officer?.username || 'Unassigned',
      header: 'Recovery Officer',
      enableColumnFilter: true,
    }] : []),
    {
  id: 'actions',
  header: 'Actions',
  enableSorting: false,
  enableColumnFilter: false,
  cell: ({ row }) => {
    const order = row.original
    const orderStatus = order.status?.toLowerCase() || '';
    
    // Check if order is cancelled, delivered, rejected or expired
    const isRestrictedStatus = orderStatus === 'cancelled' || orderStatus === 'delivered' || orderStatus === 'rejected' || orderStatus === 'expired';

    const [isOpen, setIsOpen] = useState(false)
    const [position, setPosition] = useState({ top: 0, left: 0 })
    const [openUp, setOpenUp] = useState(false)

    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const dropdownRef = useRef<HTMLDivElement | null>(null)

    const toggleDropdown = () => {
      if (!triggerRef.current) return

      const rect = triggerRef.current.getBoundingClientRect()

      const dropdownWidth = 180
      const dropdownHeight = 120

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

    // Outside click + ESC close
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
        if (e.key === 'Escape') setIsOpen(false)
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
              className="z-[99999] w-44 rounded-md border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-900"
            >
              <ul className="overflow-hidden text-sm font-medium">

                <li>
                  <button
                    onClick={() => {
                      handleViewClick(order)
                      setIsOpen(false)
                    }}
                    className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                  >
                    View Details
                  </button>
                </li>

                {/* Show Edit Item logic */}
                {(() => {
                  // Rule 1: Never on "All Orders" page
                  if (showAllStatuses) return null;
                  
                  // Rule 2: On "Picked Orders" page — show for everyone
                  if (forcedStatus === 'picked') {
                    return (
                      <li>
                        <button
                          onClick={() => {
                            handleEditClick(order)
                            setIsOpen(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                        >
                          Edit Item
                        </button>
                      </li>
                    );
                  }

                  // Default status-based rule (restricted for other pages)
                  if (!isRestrictedStatus) {
                    return (
                      <li>
                        <button
                          onClick={() => {
                            handleEditClick(order)
                            setIsOpen(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                        >
                          Edit Item
                        </button>
                      </li>
                    );
                  }
                  return null;
                })()}

                {/* Show Cancel Order logic */}
                {(() => {
                  // Rule 1: Never on "All Orders" page
                  if (showAllStatuses) return null;

                  // Rule 2: On "Picked Orders" page — show for everyone
                  if (forcedStatus === 'picked') {
                    return (
                      <li>
                        <button
                          onClick={() => {
                            handleCancelClick(order)
                            setIsOpen(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          Cancel Order
                        </button>
                      </li>
                    );
                  }

                  // Default status-based rule
                  if (!isRestrictedStatus) {
                    return (
                      <li>
                        <button
                          onClick={() => {
                            handleCancelClick(order)
                            setIsOpen(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          Cancel Order
                        </button>
                      </li>
                    );
                  }
                  return null;
                })()}

                {/* Software Activation / Manual Lock Screen Photo actions for awaiting_paytrigger_enrollment */}
                {!hideActions && orderStatus === 'awaiting_paytrigger_enrollment' && (
                  <>
                    {/* A real PayTrigger-gated device (Tecno/Infinix/Itel, toggle on) can
                        only be completed by the PayTrigger webhook — no manual upload option.
                        Only a manual "Waiting For Software Activation" pending delivery
                        (unsupported brand, or toggle off) gets the lock-screen photo option. */}
                    {!(order.delivery?.paytrigger_devices && order.delivery.paytrigger_devices.length > 0) && (
                      <li>
                        <button
                          onClick={() => {
                            handleOpenManualLockModal(order)
                            setIsOpen(false)
                          }}
                          className="block w-full px-4 py-2.5 text-left font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                        >
                          📷 Submit Lock Screen Photo
                        </button>
                      </li>
                    )}
                    <li>
                      <button
                        onClick={() => {
                          handleCancelEnrollment(order)
                          setIsOpen(false)
                        }}
                        className="block w-full px-4 py-2.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        Cancel Enrollment
                      </button>
                    </li>
                  </>
                )}

                {/* Assignment/Transfer Actions */}
                {!hideActions && !showAllStatuses && !isRestrictedStatus && orderStatus !== 'awaiting_paytrigger_enrollment' && (
                  <>
                    {isSalesOfficer ? (
                      order.status !== 'picked' && (
                        <>
                          {order.outlet_id === null && (
                            <li>
                              <button
                                onClick={() => {
                                  handleTransferClick(order)
                                  setIsOpen(false)
                                }}
                                className="block w-full px-4 py-2.5 text-left hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 font-bold"
                              >
                                Transfer to Outlet
                              </button>
                            </li>
                          )}
                          {order.outlet_id !== null && (
                            <li>
                              <button
                                onClick={() => {
                                  handleUntransferClick(order)
                                  setIsOpen(false)
                                }}
                                className="block w-full px-4 py-2.5 text-left hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 font-bold"
                              >
                                Take Back from Outlet
                              </button>
                            </li>
                          )}
                        </>
                      )
                    ) : (
                      <>
                        {(order.status === 'new' || order.status === 'pending' || order.status === 'transferred' || order.status === 'in_progress') ? (
                          order.assigned_to ? (
                            <li>
                              <button
                                onClick={() => {
                                  handleUnassignClick(order)
                                  setIsOpen(false)
                                }}
                                className="block w-full px-4 py-2.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                              >
                                Unassign Verification
                              </button>
                            </li>
                          ) : (
                            <li>
                              <button
                                onClick={() => {
                                  handleAssignClick(order)
                                  setIsOpen(false)
                                }}
                                className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                              >
                                Assign Verification
                              </button>
                            </li>
                          )
                        ) : (
                          order.delivery_officer ? (
                            <li>
                              <button
                                onClick={() => {
                                  handleUnassignClick(order)
                                  setIsOpen(false)
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
                                  handleAssignClick(order)
                                  setIsOpen(false)
                                }}
                                className="block w-full px-4 py-2.5 text-left hover:bg-[#F5F7FD] hover:text-[#ff3d3d] dark:hover:bg-dark-3"
                              >
                                Assign Delivery
                              </button>
                            </li>
                          )
                        )}
                      </>
                    )}
                  </>
                )}

                {/* Self Pickup (for outlet users, approved orders only) */}
                {isOutletBranchUser && !isSuperAdmin && order.status === 'approved' && !order.delivery_officer && !order.verification?.home_location_required && (
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

                {/* Self Pickup (returned orders — same wizard, since the
                    Delivery row was already deleted at return time, so the page's
                    "no delivery yet" path treats it exactly like a fresh order).
                    Not restricted to outlet branch users like the approved-order
                    case above — the backend enforces outlet ownership either way. */}
                {(order.status?.toLowerCase() === 'returned' || forcedStatus === 'returned') && !order.verification?.home_location_required && (
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
    getRowId: (row) => String(row.id),
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
    enableRowSelection: !hideSelection,
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

  useEffect(() => {
    if (!onRowSelectionChange) return
    const selectedIds = Object.keys(rowSelection).map((key) => Number(key))
    const selectedOrders = orders.filter((order) => selectedIds.includes(order.id))
    onRowSelectionChange(selectedOrders)
  }, [rowSelection, orders, onRowSelectionChange])

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
            placeholder="Search here..."
          />
          <button className="absolute right-0 top-0 flex h-11.5 w-11.5 items-center justify-center rounded-r-md bg-[#ff3d3d] text-white">
            <SearchIcon className="size-4.5" />
          </button>
        </div>

        <div className="flex items-center font-medium gap-4">
          <div className="flex items-center">
            <p className="pr-2 text-dark dark:text-current">Date Range:</p>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value)
                setPagination((p) => ({ ...p, page: 1 }))
              }}
              className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
            >
              {['All', 'Day', 'Week', 'Month', 'Quarter', 'Year', 'Custom Range'].map((r) => (
                <option key={r} value={r} className='dark:bg-dark-2'>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {showAllStatuses && (
            <div className="flex items-center">
              <p className="pr-2 text-dark dark:text-current">Status:</p>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setPagination((p) => ({ ...p, page: 1 }))
                }}
                className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3"
              >
                {["All", "new", "pending", "in_progress", "cancelled", "rejected", "returned", "delivered", "completed", "expired", "approved", "picked"].map((s) => (
                  <option key={s} value={s} className="dark:bg-dark-2">
                    {s === "All" ? "All Statuses" : s.replace(/_/g, " ").charAt(0).toUpperCase() + s.replace(/_/g, " ").slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className="bg-transparent pl-2.5"
            >
              {[5, 10, 15, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {customTopBarActions && (
            <div className="flex items-center">
              {customTopBarActions}
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && !hideSelection && (
        <div className="px-7.5 pb-4 flex flex-wrap gap-4">
          {!isSalesOfficer && (
            <>
              <button
                onClick={handleBulkAssign}
                className="rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
              >
                {(forcedStatus === 'approved' || forcedStatus === 'picked') ? 'Assign Delivery' : 'Assign Selected'} ({selectedCount})
              </button>

              <button
                onClick={handleBulkUnassign}
                className="rounded bg-red-600 px-5 py-2 text-white hover:bg-red-700"
              >
                {(forcedStatus === 'approved' || forcedStatus === 'picked') ? 'Unassign Delivery' : 'Unassign Selected'} ({selectedCount})
              </button>
            </>
          )}

          {isSalesOfficer && (
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleBulkTransfer}
                className="rounded bg-green-600 px-5 py-2 text-white hover:bg-green-700 font-bold flex items-center gap-2"
              >
                <ArrowRightLeft className='w-4 h-4' /> Transfer Selected ({selectedCount})
              </button>
              <button
                onClick={handleBulkUntransfer}
                className="rounded bg-orange-600 px-5 py-2 text-white hover:bg-orange-700 font-bold flex items-center gap-2"
              >
                <ArrowRightLeft className='w-4 h-4' /> Take Back Selected ({selectedCount})
              </button>
            </div>
          )}
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
                  <th key={header.id} className="px-3 py-4 align-top min-w-[120px]">
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
                  <Loader text="Loading orders..." />
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  No orders found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  className="border-t border-stroke dark:border-dark-3"
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-3 min-w-[120px]">
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
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          isLoading={loading}
        />

        <p className="font-medium text-dark dark:text-white">
          Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
        </p>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}

      {/* Edit Product Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Edit Product Name</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Changing product name for order <strong>{selectedOrder?.order_ref}</strong>. This action will be logged in history.
        </p>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Current Product:</label>
            <div className="p-3 bg-gray-50 dark:bg-dark-3 rounded-lg border border-stroke dark:border-dark-3 text-sm">
              {selectedOrder?.product_name}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Category:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 text-sm"
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
          </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-300">Subcategory:</label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                disabled={!selectedCategory}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 text-sm disabled:bg-gray-100"
              >
                <option value="">Select Subcategory</option>
                {subcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
          </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Select New Product:</label>
            <select
              disabled={!selectedSubcategory}
              onChange={(e) => {
                const prod = products.find(p => p.name === e.target.value)
                if (prod) setSelectedProduct(prod)
              }}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 text-sm disabled:bg-gray-100"
            >
              <option value="">Select Product</option>
              {products
                .filter(p => p.category_name === selectedCategory && p.subcategory_name === selectedSubcategory)
                .map((p: any) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-medium dark:text-gray-300">Installment Plan:</label>
              <div className="grid grid-cols-1 gap-3">
                {selectedProduct.ProductInstallments?.filter((p: any) => p.isActive).map((plan: any) => (
                  <label
                    key={plan.id}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedPlan?.id === plan.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-stroke hover:border-primary/50 dark:border-dark-3'
                      }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={selectedPlan?.id === plan.id}
                      onChange={() => setSelectedPlan(plan)}
                    />
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-dark dark:text-white">{plan.months} Months</span>
                      <div className="text-right text-xs space-y-0.5">
                        <div className="text-gray-500">Advance: <span className="text-dark dark:text-white font-medium">Rs. {plan.advance.toLocaleString()}</span></div>
                        <div className="text-gray-500">Monthly: <span className="text-dark dark:text-white font-medium">Rs. {plan.monthlyAmount.toLocaleString()}</span></div>
                        <div className="text-gray-500">Total: <span className="text-dark dark:text-white font-medium">Rs. {plan.totalPrice.toLocaleString()}</span></div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setEditModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmEdit}
            disabled={!selectedProduct || !selectedPlan || isSubmitting}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Update Product'}
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
            disabled={isSubmitting}
          >
            Go Back
          </button>
          <button
            onClick={confirmCancel}
            disabled={!cancelReason.trim() || isSubmitting}
            className="rounded bg-red-600 px-6 py-2.5 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </Modal>

      {/* Single Assign Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false)
          setSelectedVerifierId(null)
          setSelectedDeliveryOfficerId(null)
        }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress' ? 'Assign Verification Officer' : 'Assign Delivery Officer'}
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Select {selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress' ? 'a verification officer' : 'a delivery officer'}:
        </p>
        {selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress' ? (
          <select
            value={selectedVerifierId ?? ''}
            onChange={(e) => setSelectedVerifierId(Number(e.target.value))}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
          >
            <option value="">Select Officer</option>
            {verifiers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.username})
              </option>
            ))}
          </select>
        ) : (
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
        )}
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => {
              setAssignModalOpen(false)
              setSelectedVerifierId(null)
              setSelectedDeliveryOfficerId(null)
            }}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmAssign}
            disabled={!(selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress' ? selectedVerifierId : selectedDeliveryOfficerId) || isSubmitting}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </Modal>

      {/* Single Unassign Modal */}
      <Modal
        open={singleUnassignModalOpen}
        onClose={() => setSingleUnassignModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress' ? 'Unassign Verification Officer' : 'Unassign Delivery Officer'}
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to unassign {selectedOrder?.status === 'new' || selectedOrder?.status === 'pending' || selectedOrder?.status === 'transferred' || selectedOrder?.status === 'in_progress' ? 'Verification Officer' : 'Delivery Officer'} from order <strong>{selectedOrder?.order_ref}</strong>?
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setSingleUnassignModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmSingleUnassign}
            disabled={isSubmitting}
            className="rounded bg-red-600 px-6 py-2.5 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Unassigning...' : 'Unassign'}
          </button>
        </div>
      </Modal>

      {/* Bulk Assign Modal */}
      <Modal
        open={bulkAssignModalOpen}
        onClose={() => {
          setBulkAssignModalOpen(false)
          setSelectedVerifierId(null)
          setSelectedDeliveryOfficerId(null)
        }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress' ? 'Bulk Assign Verification Officers' : 'Bulk Assign Delivery Officers'}
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Select {forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress' ? 'a verification officer' : 'a delivery officer'} for {selectedCount} selected orders:
        </p>
        {forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress' ? (
          <select
            value={selectedVerifierId ?? ''}
            onChange={(e) => setSelectedVerifierId(Number(e.target.value))}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2"
          >
            <option value="">Select Officer</option>
            {verifiers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.username})
              </option>
            ))}
          </select>
        ) : (
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
        )}
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => {
              setBulkAssignModalOpen(false)
              setSelectedVerifierId(null)
              setSelectedDeliveryOfficerId(null)
            }}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkAssign}
            disabled={!(forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress' ? selectedVerifierId : selectedDeliveryOfficerId) || isSubmitting}
            className="rounded bg-[#ff3d3d] px-6 py-2.5 text-white hover:bg-[#ff3d3d]/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Assigning All...' : 'Assign All'}
          </button>
        </div>
      </Modal>

      {/* Bulk Unassign Modal */}
      <Modal
        open={bulkUnassignModalOpen}
        onClose={() => setBulkUnassignModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">
          {forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress' ? 'Bulk Unassign Verification Officers' : 'Bulk Unassign Delivery Officers'}
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to unassign {forcedStatus === 'new' || forcedStatus === 'pending' || forcedStatus === 'in_progress' ? 'Verification Officers' : 'Delivery Officers'} from <strong>{selectedCount}</strong> selected orders?
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setBulkUnassignModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkUnassign}
            disabled={isSubmitting}
            className="rounded bg-red-600 px-6 py-2.5 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Unassigning All...' : 'Unassign All'}
          </button>
        </div>
      </Modal>

      {/* Single Transfer Modal */}
      <Modal
        open={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false)
          setSelectedOutletId(null)
        }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-blue-600" /> Transfer to Outlet
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Transfer order <strong>{selectedOrder?.order_ref}</strong> to a specific branch:
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">Select Target Outlet:</label>
            <select
              value={selectedOutletId ?? ''}
              onChange={(e) => setSelectedOutletId(Number(e.target.value))}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
            >
              <option value="">Select Branch</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => {
              setTransferModalOpen(false)
              setSelectedOutletId(null)
            }}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmTransfer}
            disabled={!selectedOutletId || isSubmitting}
            className="rounded bg-blue-600 px-6 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50 font-bold"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer Now'}
          </button>
        </div>
      </Modal>

      {/* Bulk Transfer Modal */}
      <Modal
        open={bulkTransferModalOpen}
        onClose={() => {
          setBulkTransferModalOpen(false)
          setSelectedOutletId(null)
        }}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-green-600" /> Bulk Transfer to Outlet
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Transfer <strong>{selectedCount}</strong> selected orders to a branch:
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-300">Select Target Outlet:</label>
            <select
              value={selectedOutletId ?? ''}
              onChange={(e) => setSelectedOutletId(Number(e.target.value))}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
            >
              <option value="">Select Branch</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={() => {
              setBulkTransferModalOpen(false)
              setSelectedOutletId(null)
            }}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkTransfer}
            disabled={!selectedOutletId || isSubmitting}
            className="rounded bg-green-600 px-6 py-2.5 text-white hover:bg-green-700 disabled:opacity-50 font-bold"
          >
            {isSubmitting ? 'Transferring All...' : 'Transfer Selected'}
          </button>
        </div>
      </Modal>

      {/* Single Untransfer Modal */}
      <Modal
        open={untransferModalOpen}
        onClose={() => setUntransferModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Take Back Order</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to take back order <strong>{selectedOrder?.order_ref}</strong> from the outlet?
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setUntransferModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmUntransfer}
            disabled={isSubmitting}
            className="rounded bg-orange-600 px-6 py-2.5 text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Take Back'}
          </button>
        </div>
      </Modal>

      {/* Bulk Untransfer Modal */}
      <Modal
        open={bulkUntransferModalOpen}
        onClose={() => setBulkUntransferModalOpen(false)}
        className="max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-4 text-xl font-semibold text-dark dark:text-white">Bulk Take Back Orders</h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Are you sure you want to take back <strong>{table.getSelectedRowModel().rows.filter(r => r.original.outlet_id !== null).length}</strong> selected orders from their outlets?
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button
            onClick={() => setBulkUntransferModalOpen(false)}
            className="rounded border border-stroke px-6 py-2.5 text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={confirmBulkUntransfer}
            disabled={isSubmitting}
            className="rounded bg-orange-600 px-6 py-2.5 text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Processing...' : 'Take Back Selected'}
          </button>
        </div>
      </Modal>

      {/* Submit Manual Lock Screen Photo Modal */}
      <Modal
        open={manualLockModalOpen}
        onClose={() => setManualLockModalOpen(false)}
        className="max-w-lg rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
      >
        <h2 className="mb-2 text-xl font-bold text-dark dark:text-white">Submit Manual Lock Screen Photo</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Upload a photo of the manually locked screen for Order <strong>#{selectedOrderForManualLock?.order_ref}</strong> to complete delivery and set order status to Delivered.
        </p>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Lock Screen Photo <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setManualLockPhotoFile(e.target.files?.[0] || null)}
            className="w-full rounded-lg border border-stroke p-3 text-sm focus:border-primary dark:border-dark-3 dark:bg-gray-700 dark:text-white"
          />
          {manualLockPhotoFile && (
            <p className="mt-2 text-xs font-semibold text-emerald-600">
              Selected: {manualLockPhotoFile.name} ({(manualLockPhotoFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setManualLockModalOpen(false)}
            className="rounded-lg border border-stroke px-5 py-2.5 text-sm font-medium text-dark hover:bg-gray-100 dark:border-dark-3 dark:text-white dark:hover:bg-dark-3 disabled:opacity-50"
            disabled={isUploadingManualLock}
          >
            Cancel
          </button>
          <button
            onClick={handleManualLockPhotoSubmit}
            disabled={isUploadingManualLock || !manualLockPhotoFile}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isUploadingManualLock ? 'Submitting...' : 'Submit & Complete Delivery'}
          </button>
        </div>
      </Modal>
    </section>
  )
}

const OrderList = (props: OrderListProps) => {
  return (
    <Suspense fallback={<Loader />}>
      <OrderListContent {...props} />
    </Suspense>
  )
}

export default OrderList
