'use client'
import { useEffect, useState, useRef } from 'react'
import { use } from 'react'
import Cookies from 'js-cookie'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/Modal/Modal'


import toast from "react-hot-toast";
import Loader from '@/components/common/Loader';
import { useAuth } from '../../../../../contexts/AuthContext'
import OrderCustomerInfo from '@/components/common/OrderCustomerInfo'
import { MediaCard } from '@/components/common/MediaCard'
import { formatExactDate } from "@/utils/dateUtils";
import LinkedAccountsBadge from '@/components/common/LinkedAccountsBadge';

import EditTimelineDatesModal from '@/components/Orders/EditTimelineDatesModal';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

interface VerificationData {
  id: number
  order_id: number
  verification_officer_id: number
  status: string
  start_time: string
  end_time: string | null
  created_at: string
  updated_at: string
  order: {
    id: number
    order_ref: string
    status: string
    customer_name: string | null,
    whatsapp_number: string | null,
    address: string | null,
    city: string | null,
    area: string | null,
    block: string | null,
    house_no: string | null,
    street: string | null,
    zone: string | null,
    alternate_contact: string | null,
    channel: string,
    created_at: string,
    product_name?: string | null,
    imei_serial?: string | null,
    total_amount?: number | null,
    advance_amount?: number | null,
    monthly_amount?: number | null,
    months?: number | null,
    outlet_id?: number | null,
    outlet?: { id: number; name: string; code?: string } | null,
    delivery_assigned_at: string | null,
    recovery_assigned_at: string | null,
    verification_assigned_at: string | null,
    created_by: { username: string, full_name: string } | null,
    assigned_to: { username: string, full_name: string } | null,
    delivery_officer: { username: string, full_name: string; id: number } | null,
    recovery_officer: { username: string, full_name: string; id: number } | null,
    statusHistories?: {
      id: number;
      old_status: string | null;
      new_status: string;
      created_at: string;
      user?: { username: string, full_name: string } | null;
      role_name?: string | null;
    }[];
  }
  verification_officer: {
    full_name: string
    username: string
  }
  purchaser: {
    id: number
    verification_id: number
    name: string
    father_husband_name: string
    present_address: string
    present_zone: string | null
    present_area: string | null
    present_block: string | null
    present_street: string | null
    present_house_no: string | null
    present_period_of_stay: string | null
    permanent_address: string
    permanent_zone: string | null
    permanent_area: string | null
    permanent_block: string | null
    permanent_street: string | null
    permanent_house_no: string | null
    permanent_period_of_stay: string | null
    utility_bill_url: string | null
    cnic_number: string
    cnic_front_url: string | null
    cnic_back_url: string | null
    telephone_number: string
    employment_type: string
    job_type: string | null
    employer_name: string
    employer_address: string
    designation: string
    official_number: string | null
    business_name: string | null
    established_since: string | null
    business_address: string | null
    net_income: string | null
    service_card_url: string | null
    years_in_company: string | null
    gross_salary: string | null
    signature_url: string | null
    nearest_location: string
    is_verified: boolean
    edit_history?: EditHistory[]
  }
  grantors: Array<{
    id: number
    verification_id: number
    grantor_number: number
    name: string
    father_husband_name: string
    present_address: string
    present_zone: string | null
    present_area: string | null
    present_block: string | null
    present_street: string | null
    present_house_no: string | null
    present_period_of_stay: string | null
    permanent_address: string
    permanent_zone: string | null
    permanent_area: string | null
    permanent_block: string | null
    permanent_street: string | null
    permanent_house_no: string | null
    permanent_period_of_stay: string | null
    utility_bill_url: string | null
    cnic_number: string
    cnic_front_url: string | null
    cnic_back_url: string | null
    telephone_number: string
    employment_type: string
    job_type: string | null
    designation: string
    official_number: string | null
    service_card_url: string | null
    office_address: string
    company_name: string | null
    years_in_company: string | null
    monthly_income: string | null
    business_name: string | null
    established_since: string | null
    business_address: string | null
    net_income: string | null
    full_residential_address: string
    relationship: string
    signature_url: string | null
    nearest_location: string
    is_verified: boolean
    edit_history?: EditHistory[]
  }>
  nextOfKin: null | {
    id: number
    verification_id: number
    name: string
    cnic_number: string
    relation: string
    phone_number: string
  }
  locations: Array<{
    id: number
    verification_id: number
    latitude: number
    longitude: number
    accuracy: number | null
    label: string
    timestamp: string
  }>
  verification_locations: Array<{
    id: number
    verification_id: number
    location_type: string
    latitude: number
    longitude: number
    address: string | null
    label: string
    person_type: string
    person_id: number
    created_at: string
    photos: Array<{
      id: number
      verification_location_id: number
      file_url: string
      uploaded_at: string
    }>
  }>
  documents: Array<{
    id: number
    verification_id: number
    document_type: string
    person_type: string
    person_id: number | null
    file_url: string
    label: string | null
    uploaded_at: string
  }>
  reviews: Array<{
    id: number
    approved: boolean
    remarks: string | null
    created_at: string
    reviewer: {
      full_name: string
      username: string
    }
  }>
  edit_history?: EditHistory[]
  home_location_required: boolean
  home_location_verified: boolean
}

interface EditHistory {
  id: number
  verification_id: number
  entity_type: string
  entity_id: number
  field_name: string
  old_value: string | null
  new_value: string | null
  edited_by_id: number
  edited_by_name: string
  edited_at: string
}


const formatDateTimeUTC = (value?: string): string => {
  if (!value) return "Not set";

  return formatExactDate(value, "MMM D, YYYY h:mm A");
};

const formatDateTimeLocal = (value?: string): string => {
  if (!value) return "Not set";

  return formatExactDate(value, "MMM D, YYYY h:mm A");
};


// Helper function to check if value should be displayed
const shouldDisplay = (value: any): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  if (typeof value === 'object' && Object.keys(value).length === 0) return false
  return true
}

// Shows how many other orders this CNIC is linked to (as purchaser or
// guarantor) and lets the officer expand a list of them — role + status —
// so cross-order connections are visible right where the CNIC is shown,
// instead of requiring a separate manual search.
const LinkedOrdersBadge = LinkedAccountsBadge;

// Editable Field Component
const EditableField = ({
  label,
  value,
  fieldName,
  entityType,
  entityId,
  onSave,
  className = "",
  editHistory = []
}: {
  label: string;
  value: any;
  fieldName: string;
  entityType: 'purchaser' | 'grantor';
  entityId: number;
  onSave: (fieldName: string, newValue: string) => Promise<void>;
  className?: string;
  editHistory?: EditHistory[]
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const [isSaving, setIsSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const fieldHistory = editHistory.filter(h => h.field_name === fieldName).sort((a, b) =>
    new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime()
  )

  const handleSave = async () => {
    if (inputValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(fieldName, inputValue)
      setIsEditing(false)
      toast.success(`${label} updated successfully`)
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setInputValue(value || '')
    setIsEditing(false)
  }

  if (!shouldDisplay(value) && !isEditing) return null

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>

      {isEditing ? (
        <div className="mt-1">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            rows={3}
            disabled={isSaving}
            placeholder={`Enter ${label.toLowerCase()}...`}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded bg-gray-500 px-3 py-1 text-xs text-white hover:bg-gray-600 disabled:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-1 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-2 transition-colors group relative"
          onClick={() => setIsEditing(true)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 whitespace-pre-wrap">
              {value}
            </div>
            <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
              Click to edit
            </span>
          </div>

          {fieldHistory.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowHistory(!showHistory)
              }}
              className="mt-1 text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
            >
              <span>📋 {fieldHistory.length} edit{fieldHistory.length > 1 ? 's' : ''}</span>
            </button>
          )}

          {showHistory && fieldHistory.length > 0 && (
            <div className="absolute z-10 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
              <div className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
                Edit History
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fieldHistory.map((history) => (
                  <div key={history.id} className="text-xs border-b border-gray-100 dark:border-gray-700 pb-2">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{history.edited_by_name}</span>
                      <span>{formatDateTimeUTC(history.edited_at)}</span>
                    </div>
                    <div className="mt-1 text-gray-700 dark:text-gray-300">
                      <span className="line-through text-red-500">{history.old_value || '(empty)'}</span>
                      <span className="mx-1">→</span>
                      <span className="text-green-500">{history.new_value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Non-editable Field Component
const Field = ({ label, value, className = "" }: { label: string; value: any; className?: string }) => {
  if (!shouldDisplay(value)) return null

  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="mt-1 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3 dark:text-gray-300">
        {displayValue}
      </div>
    </div>
  )
}


const VerificationDetails = ({ params }: { params: Promise<{ id: string }> }) => {
  const unwrappedParams = use(params)
  const id = unwrappedParams.id

  const [data, setData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: number, name: string, username: string } | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modal state for location handling
  const [modalOpen, setModalOpen] = useState(false)
  const [modalOfficerType, setModalOfficerType] = useState<'vo' | 'do' | null>(null)
  const [officerIdInput, setOfficerIdInput] = useState('')
  // Officer details are in the loaded data, not fetched
  const [officerDetails, setOfficerDetails] = useState<any>(null)
  const [locationRequestPending, setLocationRequestPending] = useState(false)
  
  // Timeline collapse states & edit modal
  const [isAssignmentTimelineCollapsed, setIsAssignmentTimelineCollapsed] = useState(true);
  const [isStatusTimelineCollapsed, setIsStatusTimelineCollapsed] = useState(true);
  const [editTimelineModalOpen, setEditTimelineModalOpen] = useState(false);

  // CNIC -> other orders this same person (purchaser or grantor) is linked to,
  // so the verification officer can see all their connections in one glance.
  const [cnicOrders, setCnicOrders] = useState<Record<string, any[]>>({})

  // Manual location entry — for profiles (legacy imports especially) that
  // never went through the live "assign an officer, they capture GPS from
  // the field" flow. Posts straight to the same /location-verified endpoint
  // that flow uses, so the result is indistinguishable from a normal one
  // (home_location_verified flips true, etc.) other than location_type
  // being 'manual' instead of 'captured'.
  const [addLocationFor, setAddLocationFor] = useState<'purchaser' | 'grantor1' | 'grantor2' | null>(null);
  const [locationForm, setLocationForm] = useState({ latitude: '', longitude: '', address: '', photo: null as File | null });
  const [savingLocation, setSavingLocation] = useState(false);

  const { user } = useAuth();
  // Set officer details from loaded data when officerIdInput changes
  useEffect(() => {
    if (!modalOpen || !officerIdInput || !modalOfficerType) {
      setOfficerDetails(null);
      return;
    }
    // Officer info is in data.verification_officer or data.delivery_officer (if present)
    if (modalOfficerType === 'vo' && data?.verification_officer && String(data.verification_officer_id) === officerIdInput) {
      setOfficerDetails(data.verification_officer);
    } else if (modalOfficerType === 'do' && (data as any).delivery_officer && String((data as any).delivery_officer_id) === officerIdInput) {
      setOfficerDetails((data as any).delivery_officer);
    } else {
      setOfficerDetails(null);
    }
  }, [officerIdInput, modalOfficerType, modalOpen, data]);

  // Fetch data
  const fetchData = async () => {
    try {
      const token = Cookies.get('auth_token')
      if (!token) {
        setError('Authentication required')
        return
      }

      // Get current user info - FIXED ENDPOINT
      try {
        const userRes = await fetch(`${BACKEND_URL}/api/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (userRes.ok) {
          const userJson = await userRes.json()
          if (userJson.success && userJson.user) {
            setCurrentUser({
              id: userJson.user.id,
              name: userJson.user.full_name,
              username: userJson.user.username
            })
            console.log('Current user:', userJson.user)
          }
        }
      } catch (userErr) {
        console.error('Error fetching user:', userErr)
      }

      // Fetch verification data
      console.log('Fetching verification for order:', id)
      const res = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) throw new Error('Failed to fetch verification details')

      const json = await res.json()
      console.log('API Response:', json)

      if (json.success && json.data?.verification) {
        setData(json.data.verification)
        console.log('Verification data loaded:', json.data.verification)
      } else {
        setError('No verification data found')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError((err as Error).message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  // Cross-reference the purchaser's and every grantor's CNIC against all other
  // orders, so the officer can see at a glance who's a purchaser vs a
  // guarantor elsewhere.
  useEffect(() => {
    if (!data) return
    const cnics = [
      data.purchaser?.cnic_number,
      ...(data.grantors || []).map(g => g.cnic_number),
      data.nextOfKin?.cnic_number,
    ].filter((c): c is string => !!c)

    if (cnics.length === 0) return

    const fetchCnicOrders = async () => {
      try {
        const token = Cookies.get('auth_token')
        const res = await fetch(`${BACKEND_URL}/api/check-cnic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cnics }),
        })
        const result = await res.json()
        if (result.success) setCnicOrders(result.results)
      } catch (err) {
        console.error('CNIC cross-reference check error:', err)
      }
    }

    fetchCnicOrders()
  }, [data?.purchaser?.cnic_number, data?.grantors])

  const handleFieldSave = async (
    entityType: 'purchaser' | 'grantor',
    entityId: number,
    fieldName: string,
    newValue: string
  ) => {
    if (!data || !currentUser) {
      console.log('Missing data or currentUser:', { data, currentUser })
      toast.error('User information not available')
      return
    }

    const token = Cookies.get('auth_token')
    if (!token) {
      toast.error('Authentication required')
      return
    }

    try {
      console.log('Saving field:', { entityType, entityId, fieldName, newValue })

      const endpoint = entityType === 'purchaser'
        ? `${BACKEND_URL}/api/verification/${data.id}/purchaser/field`
        : `${BACKEND_URL}/api/verification/${data.id}/grantor/${entityId}/field`

      const payload = {
        field_name: fieldName,
        new_value: newValue
      }

      console.log('Sending request to:', endpoint)
      console.log('Payload:', payload)

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      console.log('Response status:', res.status)

      if (!res.ok) {
        const errorData = await res.json()
        console.error('Error response:', errorData)
        throw new Error(errorData.error?.message || 'Failed to save changes')
      }

      const result = await res.json()
      console.log('Success response:', result)

      // Update local state
      setData(prev => {
        if (!prev) return prev

        if (entityType === 'purchaser' && prev.purchaser) {
          return {
            ...prev,
            purchaser: {
              ...prev.purchaser,
              [fieldName]: newValue,
              editHistory: result.data?.editHistory || prev.purchaser.edit_history || []
            }
          }
        } else if (entityType === 'grantor') {
          return {
            ...prev,
            grantors: prev.grantors.map(g =>
              g.id === entityId
                ? {
                  ...g,
                  [fieldName]: newValue,
                  editHistory: result.data?.editHistory || g.edit_history || []
                }
                : g
            )
          }
        }
        return prev
      })

      toast.success('Field updated successfully')
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save changes')
      throw error
    }
  }

  const handleLocationAction = async (action: 'send-to-vo' | 'send-to-do', officerId: string) => {
    if (!data?.id) return

    const token = Cookies.get('auth_token')
    try {
      const res = await fetch(`${BACKEND_URL}/api/verification/${data.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ officer_id: officerId })
      })

      if (!res.ok) throw new Error('Failed to assign officer for location capture')

      toast.success(action === 'send-to-vo' ? 'Successfully sent to Verification Officer' : 'Successfully sent to Delivery Officer')

      // Refresh data
      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const refreshJson = await refreshRes.json()
      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification)
      }

    } catch (err: any) {
      toast.error(err.message || 'Error assigning officer')
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!decision) {
      toast.error('Please select Approve or Reject')
      return
    }

    if (decision === 'reject' && !remarks.trim()) {
      toast.error('Remarks are required when rejecting')
      return
    }

    if (!data?.id) {
      toast.error('Verification ID not available')
      return
    }

    setSubmitting(true)

    try {
      const token = Cookies.get('auth_token')
      const res = await fetch(`${BACKEND_URL}/api/verification/${data.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approved: decision === 'approve',
          remarks: remarks.trim() || null,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit review')
      }

      // Refresh data
      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const refreshJson = await refreshRes.json()

      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification)
        setDecision(null)
        setRemarks('')
        toast.success('Review submitted successfully')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error submitting review')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMediaSave = async (doc: VerificationData['documents'][number], file: File) => {
    if (!data) return

    const token = Cookies.get('auth_token')
    if (!token) {
      toast.error('Authentication required')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', doc.document_type)
    formData.append('person_type', doc.person_type)
    if (doc.person_id) formData.append('person_id', String(doc.person_id))
    formData.append('label', doc.label || doc.document_type)
    formData.append('document_id', String(doc.id))

    try {
      const res = await fetch(`${BACKEND_URL}/api/verification/${data.id}/media`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update media')
      }

      const result = await res.json()
      
      // Refresh data to show new image and history
      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const refreshJson = await refreshRes.json()
      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification)
        toast.success('Media updated successfully')
      }

    } catch (err: any) {
      toast.error(err.message || 'Error updating media')
      throw err
    }
  }

  const handleLocationMediaReplace = async (file: File, photoId: number) => {
    if (!data) return;

    const token = Cookies.get('auth_token');
    if (!token) {
        toast.error('Authentication required');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${BACKEND_URL}/api/location-photo/${photoId}/replace`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Location media replacement failed');
        }

        // Refresh data
        const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const refreshJson = await refreshRes.json();
        if (refreshJson.success && refreshJson.data?.verification) {
            setData(refreshJson.data.verification);
            toast.success('Location photo replaced successfully');
        }
    } catch (err: any) {
        console.error('Location media replacement error:', err);
        toast.error(err.message || 'Failed to replace location photo');
    }
  };

  const handleNewDocumentUpload = async (file: File, documentType: string, personType: 'purchaser' | 'grantor1' | 'grantor2') => {
    if (!data) return;
    const token = Cookies.get('auth_token');
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);

    let url = `${BACKEND_URL}/api/verification/${data.id}/purchaser/document`;
    if (personType.startsWith('grantor')) {
      const grantorNum = personType.replace('grantor', '');
      url = `${BACKEND_URL}/api/verification/${data.id}/grantor/${grantorNum}/document`;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to upload document');

      // Refresh data to show newly uploaded document
      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshJson = await refreshRes.json();
      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification);
        toast.success('Document uploaded successfully!');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error uploading document');
    }
  };

  const personIdFor = (personType: 'purchaser' | 'grantor1' | 'grantor2'): number | null => {
    if (!data) return null;
    if (personType === 'purchaser') return data.purchaser?.id ?? null;
    const num = personType === 'grantor1' ? 1 : 2;
    return data.grantors.find((g) => g.grantor_number === num)?.id ?? null;
  };

  const personLabelFor = (personType: 'purchaser' | 'grantor1' | 'grantor2') =>
    personType === 'purchaser' ? 'Purchaser' : personType === 'grantor1' ? 'Grantor 1' : 'Grantor 2';

  const openAddLocation = (personType: 'purchaser' | 'grantor1' | 'grantor2') => {
    setAddLocationFor(personType);
    setLocationForm({ latitude: '', longitude: '', address: '', photo: null });
  };

  const handleSaveLocation = async () => {
    if (!data || !addLocationFor) return;
    const personId = personIdFor(addLocationFor);
    if (!personId) {
      toast.error(`${personLabelFor(addLocationFor)} record not found`);
      return;
    }
    const lat = parseFloat(locationForm.latitude);
    const lng = parseFloat(locationForm.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Enter valid latitude and longitude');
      return;
    }
    const token = Cookies.get('auth_token');
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    const formData = new FormData();
    formData.append('location_type', 'manual');
    formData.append('latitude', String(lat));
    formData.append('longitude', String(lng));
    formData.append('address', locationForm.address);
    formData.append('label', personLabelFor(addLocationFor));
    formData.append('person_type', addLocationFor);
    formData.append('person_id', String(personId));
    if (locationForm.photo) formData.append('photos', locationForm.photo);

    setSavingLocation(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/verification/${data.id}/location-verified`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to save location');

      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshJson = await refreshRes.json();
      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification);
      }
      toast.success(`${personLabelFor(addLocationFor)} location saved`);
      setAddLocationFor(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save location');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteVerificationLocation = async (locationId: number) => {
    if (!data) return;
    const token = Cookies.get('auth_token');
    if (!token) {
      toast.error('Authentication required');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/verification/location/${locationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || json.message || 'Failed to delete location');

      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshJson = await refreshRes.json();
      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification);
      }
      toast.success('Location removed');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete location');
    }
  };

  const renderDocumentSlots = (personType: 'purchaser' | 'grantor1' | 'grantor2') => {
    if (!data) return null;

    const personDocs = (data.documents || []).filter((doc) => doc.person_type === personType);

    let standardSlots: { key: string; title: string }[] = [];
    if (personType === 'purchaser') {
      standardSlots = [
        { key: 'cnic_front', title: 'CNIC Front' },
        { key: 'cnic_back', title: 'CNIC Back' },
        { key: 'utility_bill', title: 'Utility Bill' },
        { key: 'service_card', title: 'Salary Slip / Service Card' },
        { key: 'signature', title: 'Signature' },
        { key: 'photo', title: 'Purchaser Live Photo' },
      ];
    } else {
      const gNum = personType === 'grantor1' ? '1' : '2';
      standardSlots = [
        { key: 'cnic_front', title: `Grantor ${gNum} CNIC Front` },
        { key: 'cnic_back', title: `Grantor ${gNum} CNIC Back` },
        { key: 'utility_bill', title: `Grantor ${gNum} Utility Bill / Proof` },
        { key: 'service_card', title: `Grantor ${gNum} Salary Slip / Service Card` },
        { key: 'signature', title: `Grantor ${gNum} Signature` },
        { key: 'photo', title: `Grantor ${gNum} Live Photo` },
      ];
    }

    const matchedKeys = new Set<string>();

    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {standardSlots.map((slot) => {
          const doc = personDocs.find((d) => d.document_type === slot.key);
          if (doc) matchedKeys.add(doc.document_type);

          return (
            <div key={slot.key}>
              {doc ? (
                <MediaCard
                  id={doc.id}
                  title={doc.label || slot.title}
                  fileUrl={doc.file_url}
                  uploadedAt={doc.uploaded_at}
                  isEditable={user?.role === 'Super Admin'}
                  onEdit={(file) => handleMediaSave(doc, file)}
                  editHistory={data.edit_history}
                  historyFilter={(h) => h.field_name === doc.document_type}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-primary/50 transition text-center min-h-[170px]">
                  <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">{slot.title}</p>
                  <p className="text-xs text-gray-400 mb-4">No file uploaded yet</p>
                  <label className="relative cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-xs shadow-sm transition">
                    Upload {slot.title}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleNewDocumentUpload(file, slot.key, personType);
                        e.target.value = '';
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}

        {/* Custom / Additional uploaded documents for this person */}
        {personDocs
          .filter((d) => !matchedKeys.has(d.document_type))
          .map((doc) => (
            <MediaCard
              key={doc.id}
              id={doc.id}
              title={doc.label || doc.document_type}
              fileUrl={doc.file_url}
              uploadedAt={doc.uploaded_at}
              isEditable={user?.role === 'Super Admin'}
              onEdit={(file) => handleMediaSave(doc, file)}
              editHistory={data.edit_history}
              historyFilter={(h) => h.field_name === doc.document_type}
            />
          ))}
      </div>
    );
  };


  const [verificationOfficers, setVerificationOfficers] = useState<{ id: number; full_name: string; username: string }[]>([]);
  const [deliveryOfficers, setDeliveryOfficers] = useState<{ id: number; full_name: string; username: string }[]>([]);
  const [outlets, setOutlets] = useState<{ id: number; name: string; code: string }[]>([]);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);

  const selectedOutletId = (data?.order as any)?.outlet_id || (data?.order as any)?.outlet?.id;

  useEffect(() => {
    const fetchOutlets = async () => {
      const token = Cookies.get('auth_token');
      if (!token) return;
      try {
        const res = await fetch(`${BACKEND_URL}/api/outlet/list/basic`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setOutlets(json.data);
        }
      } catch (err) {
        console.error('Error fetching outlets:', err);
      }
    };
    fetchOutlets();
  }, []);

  useEffect(() => {
    const fetchOfficers = async () => {
      const token = Cookies.get('auth_token');
      if (!token) return;

      if (!selectedOutletId) {
        setVerificationOfficers([]);
        setDeliveryOfficers([]);
        return;
      }

      try {
        const outletParam = `&outlet_id=${selectedOutletId}`;
        const [voRes, doRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/assignments/officers?role=verification${outletParam}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BACKEND_URL}/api/assignments/officers?role=delivery${outletParam}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const voJson = await voRes.json();
        const doJson = await doRes.json();

        if (voJson.success && Array.isArray(voJson.data)) {
          setVerificationOfficers(voJson.data);
        } else {
          setVerificationOfficers([]);
        }

        if (doJson.success && Array.isArray(doJson.data)) {
          setDeliveryOfficers(doJson.data);
        } else {
          setDeliveryOfficers([]);
        }
      } catch (err) {
        console.error('Error fetching officers for outlet:', err);
        setVerificationOfficers([]);
        setDeliveryOfficers([]);
      }
    };

    fetchOfficers();
  }, [selectedOutletId]);

  const handleAssignmentChange = async (newOfficerId?: number | null, newOutletId?: number | null, newDeliveryOfficerId?: number | null) => {
    if (!data) return;
    const token = Cookies.get('auth_token');
    if (!token) {
      toast.error('Authentication required');
      return;
    }

    setUpdatingAssignment(true);
    try {
      const payload: any = {};
      if (newOfficerId !== undefined) payload.verification_officer_id = newOfficerId;
      if (newOutletId !== undefined) payload.outlet_id = newOutletId;
      if (newDeliveryOfficerId !== undefined) payload.delivery_officer_id = newDeliveryOfficerId;

      const res = await fetch(`${BACKEND_URL}/api/verification/${data.id}/assignment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to update assignment');

      // Refresh verification data
      const refreshRes = await fetch(`${BACKEND_URL}/api/verification/order/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const refreshJson = await refreshRes.json();
      if (refreshJson.success && refreshJson.data?.verification) {
        setData(refreshJson.data.verification);
        toast.success(json.message || 'Assignment updated successfully');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update assignment');
    } finally {
      setUpdatingAssignment(false);
    }
  };

  if (loading) return <Loader text="Loading verification details..." />
  if (error) return <div className="py-20 text-center text-red-600">{error}</div>
  if (!data) return <div className="py-20 text-center">No data available</div>

  const approves = data.reviews ? data.reviews.filter(r => r.approved).length : 0
  const percentage = approves * 30
  const hasReviewed = data.reviews.some((r) => r.reviewer.username === user?.username)

  const handleDeleteOrder = async () => {
    if (!data?.order?.id) return;
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE order ${data.order.order_ref} (${data.order.customer_name || 'Customer'})?\n\nThis will completely remove the order, purchaser/grantor verification, installment ledger, and customer records from the database. This action CANNOT be undone.`)) {
      return;
    }

    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/orders/${data.order.id}/permanent-delete`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to delete order');
      toast.success('Order deleted permanently');
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/admin/legacy-import/pending';
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete order');
    }
  };

  return (
    <section className="rounded-[10px] bg-white p-8 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark dark:text-white">
            Verification Details
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === 'Super Admin' && data.order?.id && (
            <button
              onClick={handleDeleteOrder}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition"
            >
              Permanently Delete Order
            </button>
          )}
          {data.order?.order_ref && (
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Order Reference</p>
              <div className="flex flex-col items-end gap-1.5">
                  <p className="text-lg font-semibold text-primary">{data.order.order_ref}</p>
                  {data.order.channel === 'Repeat Customer' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-200">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812z"></path></svg>
                          Repeat Verified
                      </span>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verification Information - NON-EDITABLE */}
      <div className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold text-dark dark:text-white">
          Verification Information
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="ID" value={data.id} />
          <Field label="Order ID" value={data.order_id} />
          {data.order?.status && <Field label="Order Status" value={data.order.status} />}

          {/* 1. Assigned Branch / Outlet Select FIRST */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 font-bold">Assigned Branch / Outlet</label>
            <div className="mt-1">
              <select
                value={selectedOutletId || ''}
                onChange={(e) => handleAssignmentChange(undefined, e.target.value ? Number(e.target.value) : null, undefined)}
                disabled={updatingAssignment}
                className="w-full rounded-lg border border-primary/40 bg-white px-4 py-2.5 text-sm font-bold text-primary dark:border-dark-3 dark:bg-dark-3 dark:text-white transition focus:border-primary shadow-xs"
              >
                <option value="">-- Select Branch / Outlet First --</option>
                {(data.order as any)?.outlet && !outlets.some(o => o.id === (data.order as any).outlet?.id) && (
                  <option value={(data.order as any).outlet.id}>
                    {(data.order as any).outlet.name}
                  </option>
                )}
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} {o.code ? `(${o.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Verification Officer Select */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 font-bold">Verification Officer</label>
            <div className="mt-1">
              <select
                value={data.verification_officer_id || ''}
                onChange={(e) => handleAssignmentChange(e.target.value ? Number(e.target.value) : null, undefined, undefined)}
                disabled={updatingAssignment || !selectedOutletId}
                className="w-full rounded-lg border border-stroke bg-gray-100 px-4 py-2.5 text-sm font-bold text-dark dark:border-dark-3 dark:bg-dark-3 dark:text-white transition focus:border-primary disabled:opacity-60"
              >
                {!selectedOutletId ? (
                  <option value="">Select Branch / Outlet First</option>
                ) : (
                  <>
                    <option value="">Unassigned</option>
                    {data.verification_officer && !verificationOfficers.some(o => o.id === data.verification_officer_id) && (
                      <option value={data.verification_officer_id}>
                        {data.verification_officer.full_name} ({data.verification_officer.username})
                      </option>
                    )}
                    {verificationOfficers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.full_name} ({o.username})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* 3. Delivery Officer Select */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 font-bold">Delivery Officer</label>
            <div className="mt-1">
              <select
                value={(data.order as any)?.delivery_officer_id || (data.order as any)?.delivery_officer?.id || ''}
                onChange={(e) => handleAssignmentChange(undefined, undefined, e.target.value ? Number(e.target.value) : null)}
                disabled={updatingAssignment || !selectedOutletId}
                className="w-full rounded-lg border border-stroke bg-gray-100 px-4 py-2.5 text-sm font-bold text-dark dark:border-dark-3 dark:bg-dark-3 dark:text-white transition focus:border-primary disabled:opacity-60"
              >
                {!selectedOutletId ? (
                  <option value="">Select Branch / Outlet First</option>
                ) : (
                  <>
                    <option value="">Unassigned</option>
                    {(data.order as any)?.delivery_officer && !deliveryOfficers.some(o => o.id === (data.order as any).delivery_officer?.id) && (
                      <option value={(data.order as any).delivery_officer.id}>
                        {(data.order as any).delivery_officer.full_name} ({(data.order as any).delivery_officer.username})
                      </option>
                    )}
                    {deliveryOfficers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.full_name} ({o.username})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>


          {data.status && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Verification Status</label>
              <div className="mt-1 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3">
                <span className={cn(
                  "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                  data.status === 'completed' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                    data.status === 'in_progress' ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                )}>
                  {data.status}
                </span>
              </div>
            </div>
          )}
          <Field label="Start Time" value={data.start_time ? formatDateTimeUTC(data.start_time) : null} />
          <Field label="End Time" value={data.end_time ? formatDateTimeUTC(data.end_time) : null} />
          <Field label="Created At" value={data.created_at ? formatDateTimeLocal(data.created_at) : null} />
          <Field label="Updated At" value={data.updated_at ? formatDateTimeLocal(data.updated_at) : null} />
          <Field label="Verification Feedback" value={(data as any).verification_feedback} />
        </div>
      </div>

      {/* Product & Financial Plan Information */}
      <div className="mb-12 rounded-xl border border-primary/20 bg-primary/5 p-6 dark:bg-gray-800/60 dark:border-primary/30">
        <div className="flex items-center justify-between mb-4 border-b border-primary/10 pb-3">
          <h2 className="text-xl font-bold text-dark dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Product & Financial Plan Details
          </h2>
          {data.order?.status && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary text-white capitalize">
              {data.order.status}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label="Item / Product Name" value={data.order?.product_name} />
          <Field label="IMEI / Serial Number" value={data.order?.imei_serial} />
          <Field label="Total Item Price" value={data.order?.total_amount ? `PKR ${Number(data.order.total_amount).toLocaleString()}` : null} />
          <Field label="Advance Payment" value={data.order?.advance_amount ? `PKR ${Number(data.order.advance_amount).toLocaleString()}` : null} />
          <Field label="Monthly Installment" value={data.order?.monthly_amount ? `PKR ${Number(data.order.monthly_amount).toLocaleString()} / month` : null} />
          <Field label="Tenure Duration" value={data.order?.months ? `${data.order.months} Months` : null} />
          <Field label="Booking Channel" value={data.order?.channel} />
          <Field label="Order Reference" value={data.order?.order_ref} />
        </div>
      </div>


      {/* Assignment Timeline Card (Spans full width) */}
      <div className="mb-12 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold dark:text-white">Assignment Timeline</h3>
            {data.order?.channel === 'legacy_import' && (user?.role === 'Super Admin' || user?.role === 'Admin') && (
              <button
                onClick={() => setEditTimelineModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                title="Edit Assignment Timeline Dates & Events"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Timeline
              </button>
            )}
          </div>
          <button
            onClick={() => setIsAssignmentTimelineCollapsed(!isAssignmentTimelineCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors"
            title={isAssignmentTimelineCollapsed ? "Expand" : "Collapse"}
          >
            <svg
              className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isAssignmentTimelineCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>

        {!isAssignmentTimelineCollapsed && (
        <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
          {/* Order Creation - Always shown first */}
          <div className="mb-8 relative">
            <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-blue-500 dark:border-gray-800 shadow-sm"></div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm transition-all hover:shadow-md">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-[15px] tracking-wide text-blue-800 dark:text-blue-300 uppercase">
                    Order Created
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                      {data.order?.created_by?.full_name?.charAt(0) || 'C'}
                    </div>
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                      {data.order?.created_by?.full_name || 'System'} (@{data.order?.created_by?.username || 'system'})
                    </span>
                  </div>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-400 mt-2 font-medium">
                  Channel: <span className="font-bold">{data.order?.channel}</span>
                </div>
              </div>
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDateTimeUTC(data.order?.created_at)}
              </div>
            </div>
          </div>

          {/* Verification Officer Assignment */}
          {data.order?.verification_assigned_at && data.order?.assigned_to && (
            <div className="mb-8 relative">
              <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-indigo-500 dark:border-gray-800 shadow-sm"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm transition-all hover:shadow-md">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[15px] tracking-wide text-indigo-800 dark:text-indigo-300 uppercase">
                      Verification Officer Assigned
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                        {data.order?.assigned_to?.full_name?.charAt(0) || 'V'}
                      </div>
                      <span className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                        {data.order?.assigned_to?.full_name} (@{data.order?.assigned_to?.username})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDateTimeUTC(data.order?.verification_assigned_at)}
                </div>
              </div>
            </div>
          )}

          {/* Delivery Officer Assignment */}
          {data.order?.delivery_assigned_at && data.order?.delivery_officer && (
            <div className="mb-8 relative">
              <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-green-500 dark:border-gray-800 shadow-sm"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 shadow-sm transition-all hover:shadow-md">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[15px] tracking-wide text-green-800 dark:text-green-300 uppercase">
                      Delivery Officer Assigned
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                        {data.order?.delivery_officer?.full_name?.charAt(0) || 'D'}
                      </div>
                      <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                        {data.order?.delivery_officer?.full_name} (@{data.order?.delivery_officer?.username})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDateTimeUTC(data.order?.delivery_assigned_at)}
                </div>
              </div>
            </div>
          )}

          {/* Recovery Officer Assignment */}
          {data.order?.recovery_assigned_at && data.order?.recovery_officer && (
            <div className="mb-8 relative">
              <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-orange-500 dark:border-gray-800 shadow-sm"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border border-orange-100 dark:border-orange-900/30 shadow-sm transition-all hover:shadow-md">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[15px] tracking-wide text-orange-800 dark:text-orange-300 uppercase">
                      Recovery Officer Assigned
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-orange-300">
                        {data.order?.recovery_officer?.full_name?.charAt(0) || 'R'}
                      </div>
                      <span className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                        {data.order?.recovery_officer?.full_name} (@{data.order?.recovery_officer?.username})
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDateTimeUTC(data.order?.recovery_assigned_at)}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Order Status History Card */}
      {data.order?.statusHistories && data.order.statusHistories.length > 0 && (
        <div className="mb-12 rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold dark:text-white">Order Status Timeline</h3>
              {data.order?.channel === 'legacy_import' && (user?.role === 'Super Admin' || user?.role === 'Admin') && (
                <button
                  onClick={() => setEditTimelineModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  title="Edit Order Status Timeline Dates & Statuses"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Statuses & Dates
                </button>
              )}
            </div>
            <button
              onClick={() => setIsStatusTimelineCollapsed(!isStatusTimelineCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors"
              title={isStatusTimelineCollapsed ? "Expand" : "Collapse"}
            >
              <svg
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isStatusTimelineCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>

          {!isStatusTimelineCollapsed && (
          <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 ml-4">
            {[...(data.order.statusHistories || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((h) => (
              <div key={h.id} className="mb-8 relative">
                <div className="absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-4 border-white bg-primary dark:border-gray-800 shadow-sm"></div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-dark-2 p-4 rounded-xl border border-gray-100 dark:border-dark-3 shadow-sm transition-all hover:shadow-md">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-[15px] tracking-wide text-gray-800 dark:text-white uppercase">
                        {h.new_status.replace(/_/g, ' ')}
                      </span>
                      {h.old_status && (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          <span className="bg-gray-200 dark:bg-gray-700 px-2.5 py-1 rounded-md uppercase tracking-wider">
                            {h.old_status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                          {h.user?.full_name?.charAt(0) || 'S'}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {h.user ? h.user.full_name : 'System'}
                        </span>
                      </div>
                      {h.role_name && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full tracking-wider uppercase">
                          {h.role_name}
                        </span>
                      )}
                    </div>
                    {(h as any).remarks && (
                      <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 inline-block">
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {(h as any).remarks}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-3 sm:mt-0 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDateTimeUTC(h.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Location Management Actions (For Outlet/Admin) */}
    {(data as any).home_location_required && (
          <div className="col-span-full mt-4 mb-4">
            <div className={cn(
              "flex items-center gap-2 rounded-lg p-4 font-bold border-2",
              (data as any).home_location_verified
                ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/10 dark:border-green-800"
                : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/10 dark:border-red-800 animate-pulse"
            )}>
              <span className="text-xl">📍</span>
              <span>HOME LOCATION REQUIRED</span>
              {(data as any).home_location_verified && (
                <span className="ml-auto text-sm font-medium bg-green-100 px-2 py-0.5 rounded text-green-800">Verified</span>
              )}
            </div>
          </div>
        )}
      {(data as any).home_location_required && !(data as any).home_location_verified && (
        <div className="mb-12 rounded-xl border border-warning bg-warning/5 p-6 dark:border-warning/30">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📍</span>
            <h3 className="text-xl font-bold text-yellow-700 dark:text-yellow-300">Home Location Assignment Required</h3>
            {(locationRequestPending || data.status === 'location_capture_pending') && (
              <span className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-200 text-yellow-900 font-semibold text-sm animate-pulse">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                Pending Assignment
              </span>
            )}
          </div>
          <p className="mb-6 text-gray-700 dark:text-gray-300 text-sm">
            This verification requires a customer home location capture. Assign an officer to proceed. Once a request is sent, you cannot assign again until the current request is resolved.
          </p>
          <div className="flex flex-wrap gap-4">
            {data.verification_officer && (
              <button
                onClick={() => {
                  setModalOfficerType('vo');
                  setModalOpen(true);
                }}
                className={cn(
                  "rounded-lg px-6 py-2.5 font-semibold shadow-sm transition-colors",
                  locationRequestPending || data.status === 'location_capture_pending'
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary/90"
                )}
                disabled={locationRequestPending || data.status === 'location_capture_pending'}
              >
                Option 1: Send to Verification Officer
              </button>
            )}
            {data.order.delivery_officer && (
              <button
                onClick={() => {
                  setModalOfficerType('do');
                  setModalOpen(true);
                }}
                className={cn(
                  "rounded-lg px-6 py-2.5 font-semibold shadow-sm transition-colors",
                  locationRequestPending || data.status === 'location_capture_pending'
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-dark text-white hover:bg-dark/90"
                )}
                disabled={locationRequestPending || data.status === 'location_capture_pending'}
              >
                Option 2: Send to Delivery Officer
              </button>
            )}
          </div>
          {(locationRequestPending || data.status === 'location_capture_pending') && (
            <div className="mt-6 flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-base font-medium">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
              Officer assignment is pending. Please wait for completion before assigning again.
            </div>
          )}
        </div>
      )}

      {/* Officer Selection Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
          <h2 className="text-lg font-bold mb-4">
            {modalOfficerType === 'vo' ? 'Send to Verification Officer' : 'Send to Delivery Officer'}
          </h2>
          {modalOfficerType === 'vo' && data.verification_officer && (
            <div className="mb-4 p-3 rounded bg-gray-100 dark:bg-gray-800">
              <div className="font-semibold">Officer Details:</div>
              <div>Name: {data.verification_officer.full_name}</div>
              <div>Username: {data.verification_officer.username}</div>
            </div>
          )}
          {modalOfficerType === 'do' && data.order.delivery_officer && (
            <div className="mb-4 p-3 rounded bg-gray-100 dark:bg-gray-800">
              <div className="font-semibold">Officer Details:</div>
              <div>Name: {data.order.delivery_officer.full_name}</div>
              <div>Username: {data.order.delivery_officer.username}</div>
            </div>
          )}
          <div className="flex gap-4">
            <button
              className="bg-primary text-white px-4 py-2 rounded"
              onClick={async () => {
                setLocationRequestPending(true);
                setModalOpen(false);
                await handleLocationAction(
                  modalOfficerType === 'vo' ? 'send-to-vo' : 'send-to-do',
                  modalOfficerType === 'vo' ? String(data.verification_officer_id) : String(data.order.delivery_officer?.id)
                );
                setLocationRequestPending(false);
              }}
              disabled={locationRequestPending || (modalOfficerType === 'vo' && !data.verification_officer) || (modalOfficerType === 'do' && !data.order.delivery_officer)}
            >
              Confirm & Send
            </button>
            <button
              className="bg-gray-300 px-4 py-2 rounded"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>



      {/* Purchaser Details - EDITABLE */}
      {data.purchaser && Object.values(data.purchaser).some(val => shouldDisplay(val)) && (
        <div className="mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-2xl font-semibold text-dark dark:text-white">
              Purchaser Details
            </h2>
            <LinkedAccountsBadge
              cnic={data.purchaser.cnic_number}
              orders={cnicOrders[data.purchaser.cnic_number] || []}
              currentOrderId={data.order.id}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <EditableField
              label="Name"
              value={data.purchaser.name}
              fieldName="name"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Father/Husband Name"
              value={data.purchaser.father_husband_name}
              fieldName="father_husband_name"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            {shouldDisplay(data.purchaser.present_address) && (
              <EditableField
                label="Present Address"
                value={`${data.purchaser.present_address}${data.purchaser.present_zone ? `\nZone: ${data.purchaser.present_zone}` : ''}${data.purchaser.present_area ? `\nArea: ${data.purchaser.present_area}` : ''}${data.purchaser.present_block ? `\nBlock: ${data.purchaser.present_block}` : ''}${data.purchaser.present_street ? `\nStreet: ${data.purchaser.present_street}` : ''}${data.purchaser.present_house_no ? `\nHouse No: ${data.purchaser.present_house_no}` : ''}`}
                fieldName="present_address"
                entityType="purchaser"
                entityId={data.purchaser.id}
                onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
                editHistory={data.purchaser.edit_history}
              />
            )}
            {shouldDisplay(data.purchaser.permanent_address) && (
              <EditableField
                label="Permanent Address"
                value={`${data.purchaser.permanent_address}${data.purchaser.permanent_zone ? `\nZone: ${data.purchaser.permanent_zone}` : ''}${data.purchaser.permanent_area ? `\nArea: ${data.purchaser.permanent_area}` : ''}${data.purchaser.permanent_block ? `\nBlock: ${data.purchaser.permanent_block}` : ''}${data.purchaser.permanent_street ? `\nStreet: ${data.purchaser.permanent_street}` : ''}${data.purchaser.permanent_house_no ? `\nHouse No: ${data.purchaser.permanent_house_no}` : ''}`}
                fieldName="permanent_address"
                entityType="purchaser"
                entityId={data.purchaser.id}
                onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
                editHistory={data.purchaser.edit_history}
              />
            )}
            <EditableField
              label="CNIC Number"
              value={data.purchaser.cnic_number}
              fieldName="cnic_number"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Telephone Number"
              value={data.purchaser.telephone_number}
              fieldName="telephone_number"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Employment Type"
              value={data.purchaser.employment_type}
              fieldName="employment_type"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Job Type"
              value={data.purchaser.job_type}
              fieldName="job_type"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Employer Name"
              value={data.purchaser.employer_name}
              fieldName="employer_name"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Employer Address"
              value={data.purchaser.employer_address}
              fieldName="employer_address"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Designation"
              value={data.purchaser.designation}
              fieldName="designation"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Official Number"
              value={data.purchaser.official_number}
              fieldName="official_number"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Business Name"
              value={data.purchaser.business_name}
              fieldName="business_name"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Established Since"
              value={data.purchaser.established_since}
              fieldName="established_since"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Business Address"
              value={data.purchaser.business_address}
              fieldName="business_address"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Net Income"
              value={data.purchaser.net_income}
              fieldName="net_income"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Years in Company"
              value={data.purchaser.years_in_company}
              fieldName="years_in_company"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Gross Salary"
              value={data.purchaser.gross_salary}
              fieldName="gross_salary"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <EditableField
              label="Nearest Location"
              value={data.purchaser.nearest_location}
              fieldName="nearest_location"
              entityType="purchaser"
              entityId={data.purchaser.id}
              onSave={(field, value) => handleFieldSave('purchaser', data.purchaser.id, field, value)}
              editHistory={data.purchaser.edit_history}
            />
            <Field label="Verified" value={data.purchaser.is_verified} />
          </div>

          {/* Purchaser Documents & Media Uploads */}
          <div className="mt-8">
            <h3 className="mb-4 text-xl font-semibold text-blue-700 dark:text-blue-400">
              Purchaser Documents & Media Files
            </h3>
            {renderDocumentSlots('purchaser')}
          </div>
        </div>
      )}

      {/* Grantors - EDITABLE & DOCUMENT UPLOADS */}
      {(() => {
        const grantorsList = [
          (data.grantors || []).find((g) => g.grantor_number === 1) || { id: 0, grantor_number: 1, name: 'Grantor 1' },
          (data.grantors || []).find((g) => g.grantor_number === 2) || { id: 0, grantor_number: 2, name: 'Grantor 2' },
        ];

        return grantorsList.map((grantor: any) => {
          const personTypeKey = `grantor${grantor.grantor_number}` as 'grantor1' | 'grantor2';

          return (
            <div key={grantor.grantor_number} className="mb-16">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 className="text-2xl font-semibold text-dark dark:text-white">
                  Grantor {grantor.grantor_number} Details & Documents
                </h2>
                {grantor.cnic_number && (
                  <LinkedAccountsBadge
                    cnic={grantor.cnic_number}
                    orders={cnicOrders[grantor.cnic_number] || []}
                    currentOrderId={data.order.id}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <EditableField
                  label="Name"
                  value={grantor.name}
                  fieldName="name"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Father/Husband Name"
                  value={grantor.father_husband_name}
                  fieldName="father_husband_name"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Present Address"
                  value={grantor.present_address}
                  fieldName="present_address"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Permanent Address"
                  value={grantor.permanent_address}
                  fieldName="permanent_address"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="CNIC Number"
                  value={grantor.cnic_number}
                  fieldName="cnic_number"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Telephone Number"
                  value={grantor.telephone_number}
                  fieldName="telephone_number"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Employment Type"
                  value={grantor.employment_type}
                  fieldName="employment_type"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Designation"
                  value={grantor.designation}
                  fieldName="designation"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Office / Business Address"
                  value={grantor.office_address || grantor.business_address}
                  fieldName="office_address"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Relationship"
                  value={grantor.relationship}
                  fieldName="relationship"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <EditableField
                  label="Nearest Location"
                  value={grantor.nearest_location}
                  fieldName="nearest_location"
                  entityType="grantor"
                  entityId={grantor.id || 0}
                  onSave={(field, value) => handleFieldSave('grantor', grantor.id || 0, field, value)}
                  editHistory={grantor.edit_history}
                />
                <Field label="Verified" value={grantor.is_verified || 'No'} />
              </div>

              {/* Grantor Documents & Uploads */}
              <div className="mt-8">
                <h3 className="mb-4 text-xl font-semibold text-indigo-700 dark:text-indigo-400">
                  Grantor {grantor.grantor_number} Documents & Media Files
                  {grantor.name && ` – ${grantor.name}`}
                </h3>
                {renderDocumentSlots(personTypeKey)}
              </div>
            </div>
          );
        });
      })()}

      {/* Next of Kin */}
      {data.nextOfKin && Object.values(data.nextOfKin).some(val => shouldDisplay(val)) && (
        <div className="mb-12">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-2xl font-semibold text-dark dark:text-white">
              Next of Kin Details
            </h2>
            {data.nextOfKin.cnic_number && (
              <LinkedAccountsBadge
                cnic={data.nextOfKin.cnic_number}
                orders={cnicOrders[data.nextOfKin.cnic_number] || []}
                currentOrderId={data.order.id}
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" value={data.nextOfKin.name} />
            <Field label="CNIC Number" value={data.nextOfKin.cnic_number} />
            <Field label="Relation" value={data.nextOfKin.relation} />
            <Field label="Phone Number" value={data.nextOfKin.phone_number} />
          </div>
        </div>
      )}

      {/* Purchaser & Guarantor Locations — always visible (unlike the read-only
          block below) so a location can be added directly by an admin, not
          just via "assign an officer, they capture GPS live in the field".
          Same result either way: posts to /location-verified, which is what
          flips home_location_verified — a manually-added location makes the
          profile indistinguishable from one verified the normal way. */}
      <div className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold text-dark dark:text-white">Purchaser & Guarantor Locations</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(['purchaser', 'grantor1', 'grantor2'] as const)
            .filter((pt) => personIdFor(pt) !== null)
            .map((pt) => {
              const personId = personIdFor(pt);
              const existing = data.verification_locations.filter((loc) => loc.person_type === pt && loc.person_id === personId);
              return (
                <div key={pt} className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-semibold text-dark dark:text-white">{personLabelFor(pt)}</span>
                    <button
                      onClick={() => openAddLocation(pt)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      + Add Location
                    </button>
                  </div>

                  {existing.length === 0 ? (
                    <p className="text-sm text-gray-400">No location on record yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {existing.map((loc) => (
                        <div key={loc.id} className="rounded-md bg-gray-50 p-3 text-sm dark:bg-dark-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="dark:text-gray-300">{loc.latitude}, {loc.longitude}</span>
                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                              {loc.location_type}
                            </span>
                          </div>
                          {loc.address && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{loc.address}</p>}
                          <div className="mt-2 flex items-center gap-3">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-primary hover:underline"
                            >
                              View on Map
                            </a>
                            {loc.photos?.length > 0 && (
                              <span className="text-xs text-gray-400">{loc.photos.length} photo(s)</span>
                            )}
                            {user?.role === 'Super Admin' && (
                              <button
                                onClick={() => handleDeleteVerificationLocation(loc.id)}
                                className="ml-auto text-xs font-bold text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Add Location Modal */}
      <Modal open={addLocationFor !== null} onClose={() => setAddLocationFor(null)}>
        <div className="rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-bold dark:text-white">
            Add Location — {addLocationFor ? personLabelFor(addLocationFor) : ''}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Latitude</label>
              <input
                type="text"
                inputMode="decimal"
                value={locationForm.latitude}
                onChange={(e) => setLocationForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="e.g. 24.8607"
                className="mt-1 w-full rounded-lg border border-stroke bg-gray-50 px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-3 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Longitude</label>
              <input
                type="text"
                inputMode="decimal"
                value={locationForm.longitude}
                onChange={(e) => setLocationForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="e.g. 67.0011"
                className="mt-1 w-full rounded-lg border border-stroke bg-gray-50 px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-3 dark:text-white"
              />
            </div>
            <p className="text-xs text-gray-400">
              Tip: open the address in Google Maps, right-click the pin, and copy the two numbers it shows — paste the first into Latitude and the second into Longitude.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Address (optional)</label>
              <input
                type="text"
                value={locationForm.address}
                onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-stroke bg-gray-50 px-4 py-2.5 text-sm dark:border-dark-3 dark:bg-dark-3 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Photo (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLocationForm((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
                className="mt-1 w-full text-sm dark:text-gray-300"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-4">
            <button
              className="rounded bg-primary px-4 py-2 text-white disabled:opacity-50"
              onClick={handleSaveLocation}
              disabled={savingLocation}
            >
              {savingLocation ? 'Saving…' : 'Save Location'}
            </button>
            <button className="rounded bg-gray-300 px-4 py-2" onClick={() => setAddLocationFor(null)} disabled={savingLocation}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Locations */}
      {(data.locations.length > 0 || data.verification_locations.length > 0) && (
        <div className="mb-12">
          <h2 className="mb-4 text-2xl font-semibold text-dark dark:text-white">Location Tracking</h2>

          {data.locations.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-xl font-semibold text-dark dark:text-white">GPS Locations</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-stroke dark:border-dark-3">
                      <th className="px-4 py-2 text-left">Label</th>
                      <th className="px-4 py-2 text-left">Latitude</th>
                      <th className="px-4 py-2 text-left">Longitude</th>
                      <th className="px-4 py-2 text-left">Accuracy</th>
                      <th className="px-4 py-2 text-left">Timestamp</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.locations.map((loc) => (
                      <tr key={loc.id} className="border-b border-stroke dark:border-dark-3">
                        <td className="px-4 py-2">{loc.label}</td>
                        <td className="px-4 py-2">{loc.latitude}</td>
                        <td className="px-4 py-2">{loc.longitude}</td>
                        <td className="px-4 py-2">{loc.accuracy ? `${loc.accuracy} meters` : '—'}</td>
                        <td className="px-4 py-2">{formatDateTimeUTC(loc.timestamp)}</td>
                        <td className="px-4 py-2">
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            View on Map
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.verification_locations.length > 0 && (
            <div>
              <h3 className="mb-3 text-xl font-semibold text-dark dark:text-white">Location Photos</h3>
              <div className="space-y-6">
                {data.verification_locations.map((loc) => (
                  <div key={loc.id} className="rounded-lg border border-stroke p-4 dark:border-dark-3">
                    <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Location Type" value={loc.location_type} />
                      <Field label="Label" value={loc.label} />
                      <Field label="Person Type" value={loc.person_type} />
                      <div className="flex flex-col">
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Coordinates</label>
                        <div className="mt-1 flex items-center gap-3 rounded-lg bg-gray-100 px-4 py-2.5 dark:bg-dark-3">
                          <span className="dark:text-gray-300">
                            {loc.latitude && loc.longitude ? `${loc.latitude}, ${loc.longitude}` : '—'}
                          </span>
                          {loc.latitude && loc.longitude && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-bold text-primary hover:underline ml-auto"
                            >
                              VIEW ON GOOGLE MAP
                            </a>
                          )}
                        </div>
                      </div>
                      <Field label="Address" value={loc.address} />
                      <Field label="Captured At" value={loc.created_at ? formatDateTimeUTC(loc.created_at) : null} />
                    </div>

                    {loc.photos && loc.photos.length > 0 && (
                      <div>
                        <h4 className="mb-3 font-medium text-gray-700 dark:text-gray-300">Photos</h4>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {loc.photos.map((photo) => (
                            <MediaCard
                              key={photo.id}
                              id={photo.id}
                              title={`${loc.label} - Photo`}
                              fileUrl={photo.file_url}
                              uploadedAt={photo.uploaded_at}
                              isEditable={user?.role === 'Super Admin'}
                              onEdit={(file) => handleLocationMediaReplace(file, photo.id)}
                              editHistory={data.edit_history}
                              historyFilter={(h) => h.entity_type === 'location_photo' && h.entity_id === photo.id}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <OrderCustomerInfo customerName={data.order.customer_name} whatsappNumber={data.order.whatsapp_number} address={data.order.address} city={data.order.city} area={data.order.area} block={data.order.block} houseNo={data.order.house_no} street={data.order.street} zone={data.order.zone} alternateContact={data.order.alternate_contact} />

      {/* Edit Timeline Dates Modal */}
      {data.order && (
        <EditTimelineDatesModal
          isOpen={editTimelineModalOpen}
          onClose={() => setEditTimelineModalOpen(false)}
          order={data.order}
          onSaved={() => {
            // Refetch verification details to reflect timeline changes
            fetchData();
          }}
        />
      )}
    </section>
  )
}

export default VerificationDetails