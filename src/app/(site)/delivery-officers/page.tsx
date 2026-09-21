'use client';

import { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import Loader from '@/components/common/Loader';
import { OfficerProfileHistory } from '@/components/OfficerProfileHistory';
import { OfficerAttendanceHistory } from '@/components/OfficerAttendanceHistory';
import { DeliveryActionsModal } from '@/components/DeliveryManagement/DeliveryActionsModal';
import { DeliveryTable } from '@/components/DeliveryManagement/DeliveryTable';
import { DeliveryStats } from '@/components/DeliveryManagement/DeliveryStats';
import { SearchIcon } from '@/assets/icons';
import io from 'socket.io-client';
import { formatExactDate } from '@/utils/dateUtils';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface Location {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

interface ProfileHistory {
  updatedAt: string;
  previous?: {
    bike_km_range?: number;
    working_hours_start?: string;
    working_hours_end?: string;
  };
  updated?: {
    bike_km_range?: number;
    working_hours_start?: string;
    working_hours_end?: string;
  };
}

interface DeliveryBoy {
  id: number;
  name: string;
  username: string;
  profile_image: string | null;
  pending_count: number;
  whatsapp: string | null;
  account_status: string;
  is_online: boolean;
  delivered_today: number;
  returned_today: number;
  current_location: Location | null;
  last_known_location: Location | null;
  last_online_at: string;
  bike_km_range: number | null;
  working_hours: string | null;
  monthly_online_hours: string;
  profile_history: ProfileHistory[];
  current_assignment: {
    id: number;
    status: string;
    order: { order_ref: string; customer_name: string };
  } | null;
}

interface DailyStat {
  date: string;
  online_hours: string;
  worked_hours: string;
  offline_during_work_hours: string;
}

interface MonthlyStats {
  officer_id: number;
  month: string;
  daily_stats: DailyStat[];
  expected_daily_hours: string;
}

interface ProductGroup {
  product_name: string;
  count: number;
  total_amount: number;
  advance_amount: number;
  monthly_amount: number;
  months: number;
}

interface BoyDetails {
  boy: {
    id: number;
    name: string;
    username: string;
    profile_image: string | null;
    whatsapp: string | null;
    account_status: string;
    is_online: boolean;
    last_online_at: string | null;
    current_location: Location | null;
    last_known_location: Location | null;
    bike_km_range: number | null;
    working_hours: string | null;
    monthly_online_hours: string;
    profile_history: ProfileHistory[];
  };
  pending_products: ProductGroup[];
}

interface DeliveryOrder {
  id: number;
  order_ref: string;
  customer_name: string;
  address: string;
  product_name: string;
  amount: number;
  status: string;
  delivery_officer: { username: string; full_name: string } | null;
  updated_at: string;
}

export default function DeliveryOfficers() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'all_deliveries'>('dashboard');

  // Dashboard State
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [filteredBoys, setFilteredBoys] = useState<DeliveryBoy[]>([]);
  const [boySearch, setBoySearch] = useState('');

  const [selectedBoyId, setSelectedBoyId] = useState<number | null>(null);
  const [boyDetails, setBoyDetails] = useState<BoyDetails | null>(null);
  const [officerStats, setOfficerStats] = useState<MonthlyStats | null>(null);
  const [expandedSections, setExpandedSections] = useState<{
    profileHistory: boolean;
    attendance: boolean;
  }>({ profileHistory: false, attendance: false });
  const [otpInput, setOtpInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  
  // Month navigation state
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // All Deliveries State
  // All Deliveries State
  const [allDeliveries, setAllDeliveries] = useState<DeliveryOrder[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [actionType, setActionType] = useState<'deliver' | 'return' | 'refund' | null>(null);

  const socketRef = useRef<any>(null);
  const selectedBoyIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedBoyIdRef.current = selectedBoyId;
  }, [selectedBoyId]);

  // KPI Stats Top Row
  const totalRiders = deliveryBoys.length;
  const activeDeliveries = allDeliveries.filter(d => d.status === 'in_transit' || d.status === 'picked_up').length;
  const completedToday = deliveryBoys.reduce((sum, b) => sum + (b.delivered_today || 0), 0);
  const returnedToday = deliveryBoys.reduce((sum, b) => sum + (b.returned_today || 0), 0);

  useEffect(() => {
    fetchDeliveryBoys();
    fetchAllDeliveries();

    const token = Cookies.get('auth_token');
    if (!token) return;

    socketRef.current = io(BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity, // never give up: a dead admin socket = stale online/offline
      reconnectionDelayMax: 5000,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_admin_notifications', token);
    });

    // Events fired while this socket was down are lost — re-load the list on every reconnect.
    socketRef.current.io.on('reconnect', () => {
      fetchDeliveryBoys();
    });

    socketRef.current.on('officer_status_update', (data: { officerId: number; is_online: boolean; timestamp?: string }) => {
      console.log('Status update received:', data);
      setDeliveryBoys((prev) =>
        prev.map((o) => (o.id === data.officerId ? { ...o, is_online: data.is_online } : o))
      );
      if (selectedBoyIdRef.current === data.officerId) {
        setBoyDetails((prev) => prev ? {
          ...prev,
          boy: {
            ...prev.boy,
            is_online: data.is_online,
            last_online_at: data.is_online ? prev.boy.last_online_at : (formatExactDate(new Date()))
          }
        } : null);
      }
    });

    socketRef.current.on('officer_location_update', (data: any) => {
      const newLoc = {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
      };
      setDeliveryBoys((prev) =>
        prev.map((o) => (o.id === data.officerId ? { ...o, current_location: newLoc } : o))
      );
      if (selectedBoyIdRef.current === data.officerId) {
        setBoyDetails((prev) => prev ? { ...prev, boy: { ...prev.boy, current_location: newLoc } } : null);
      }
    });

    socketRef.current.on('officer_profile_updated', (data: { officerId: number; profile_history: ProfileHistory[] }) => {
      setDeliveryBoys((prev) =>
        prev.map((o) => (o.id === data.officerId ? { ...o, profile_history: data.profile_history } : o))
      );
      if (selectedBoyIdRef.current === data.officerId) {
        setBoyDetails((prev) => prev ? { ...prev, boy: { ...prev.boy, profile_history: data.profile_history } } : null);
      }
    });

    socketRef.current.on('officer_monthly_update', (data: {
      officerId: number;
      monthly_online_hours: string;
      month: string;
    }) => {
      setDeliveryBoys((prev) =>
        prev.map((o) =>
          o.id === data.officerId ? { ...o, monthly_online_hours: data.monthly_online_hours } : o
        )
      );
      if (selectedBoyIdRef.current === data.officerId) {
        setBoyDetails((prev) =>
          prev ? { ...prev, boy: { ...prev.boy, monthly_online_hours: data.monthly_online_hours } } : null
        );
      }
    });

    socketRef.current.on('officer_daily_update', (data: {
      officerId: number;
      date: string;
      online_hours: string;
    }) => {
      if (selectedBoyIdRef.current !== data.officerId) return;

      setOfficerStats((prev) => {
        if (!prev) return prev;
        const updatedDaily = prev.daily_stats.map((day) => {
          if (day.date === data.date) {
            const newOnline = data.online_hours;
            const expected = Number(prev.expected_daily_hours);
            const newOffline = Math.max(0, expected - Number(newOnline)).toFixed(2);
            return {
              ...day,
              online_hours: newOnline,
              worked_hours: newOnline,
              offline_during_work_hours: newOffline,
            };
          }
          return day;
        });
        return { ...prev, daily_stats: updatedDaily };
      });
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    let result = [...deliveryBoys];
    if (boySearch.trim() !== '') {
      const lower = boySearch.toLowerCase();
      result = result.filter(boy =>
        boy.name.toLowerCase().includes(lower) ||
        boy.username.toLowerCase().includes(lower)
      );
    }

    // Sort: Online first, then by name
    result.sort((a, b) => {
      if (a.is_online === b.is_online) {
        return a.name.localeCompare(b.name);
      }
      return a.is_online ? -1 : 1;
    });

    setFilteredBoys(result);
  }, [boySearch, deliveryBoys]);

  useEffect(() => {
    if (selectedBoyId) {
      fetchStats(selectedBoyId);
    } else {
      setOfficerStats(null);
    }
  }, [selectedBoyId, selectedMonth]);

  const fetchDeliveryBoys = async (): Promise<void> => {
    try {
      const token = Cookies.get('auth_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/delivery-management/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setDeliveryBoys(result.data);
        setFilteredBoys(result.data);
      }
    } catch (error) {
      console.error('Error fetching delivery boys:', error);
    }
  };

  const fetchBoyDetails = async (boyId: number): Promise<void> => {
    setIsLoading(true);
    setSelectedBoyId(boyId);
    try {
      const token = Cookies.get('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/delivery-management/boy/${boyId}/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setBoyDetails(result.data);
      }
    } catch (error) {
      console.error('Error fetching boy details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async (id: number) => {
    try {
      const token = Cookies.get('auth_token');
      const month = (selectedMonth.getMonth() + 1).toString().padStart(2, '0');
      const year = selectedMonth.getFullYear();
      const res = await fetch(`${BACKEND_URL}/api/officers/${id}/stats?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      if (result.success) setOfficerStats(result.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateOtp = async (): Promise<void> => {
    if (!selectedBoyId) return;
    setIsActionLoading(true);
    try {
      const token = Cookies.get('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/delivery-management/generate-pickup-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deliveryBoyId: selectedBoyId }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('OTP has been generated and sent via WhatsApp');
      } else {
        toast.error(result.error || 'Failed to generate OTP');
      }
    } catch (error) {
      toast.error('Failed to send OTP');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVerifyOtp = async (): Promise<void> => {
    if (!selectedBoyId || otpInput.length !== 5) {
      toast.error('Please enter a valid 5-digit OTP');
      return;
    }
    setIsActionLoading(true);
    try {
      const token = Cookies.get('auth_token');
      const response = await fetch(`${BACKEND_URL}/api/delivery-management/verify-pickup-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deliveryBoyId: selectedBoyId, otp: otpInput }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(result.message || 'Orders successfully marked as picked');
        setOtpInput('');
        await fetchBoyDetails(selectedBoyId);
        fetchAllDeliveries(); // Refresh stats
      } else {
        toast.error(result.error || 'Invalid or expired OTP');
      }
    } catch (error) {
      toast.error('Failed to verify OTP');
    } finally {
      setIsActionLoading(false);
    }
  };

const fetchAllDeliveries = async () => {
  setDeliveriesLoading(true);
  try {
    const token = Cookies.get('auth_token');
    const response = await fetch(`${BACKEND_URL}/api/orders/delivery-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setAllDeliveries(result.data);
      } else {
        setAllDeliveries([]);
      }
    } else {
      setAllDeliveries([]);
    }
  } catch (error) {
    console.error('Failed to fetch deliveries', error);
    setAllDeliveries([]);
  } finally {
    setDeliveriesLoading(false);
  }
};

  const selectedBoyFull = deliveryBoys.find(b => b.id === selectedBoyId);

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title-md2 font-bold text-black dark:text-white">
            Delivery Officer Management
          </h2>
          <p className="font-medium text-gray-500">Real-time monitoring of delivery status, location, attendance, and assignments.</p>
        </div>
      </div>

      {/* KPI Stats Top Row */}
      <DeliveryStats
        totalRiders={totalRiders}
        activeDeliveries={activeDeliveries}
        completedToday={completedToday}
        returnedToday={returnedToday}
      />

      {activeTab === 'dashboard' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Rider Selection List - Left Side */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
              <div className="p-4 border-b border-stroke dark:border-strokedark">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <SearchIcon className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search rider..."
                    value={boySearch}
                    onChange={(e) => setBoySearch(e.target.value)}
                    className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-11 pr-5 text-black outline-none focus:border-primary focus-visible:shadow-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col max-h-[600px] overflow-y-auto">
                {isLoading ? <Loader text="Loading..." /> : filteredBoys.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No riders found.</div>
                ) : (
                  filteredBoys.map((boy) => (
                    <div
                      key={boy.id}
                      onClick={() => fetchBoyDetails(boy.id)}
                      className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all border-l-4 ${selectedBoyId === boy.id
                        ? 'bg-gray-50 dark:bg-meta-4/30 border-primary'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-meta-4/20'
                        }`}
                    >
                      <div className="relative h-12 w-12 flex-shrink-0">
                        <div className="h-full w-full rounded-full bg-gray-200 dark:bg-meta-4 flex items-center justify-center text-lg font-bold text-gray-500">
                          {boy.name.charAt(0)}
                        </div>
                        <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-boxdark ${boy.is_online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-black dark:text-white truncate">{boy.name}</h4>
                        <p className="text-xs text-gray-400">@{boy.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Rider Details and Actions - Right Side */}
          <div className="lg:col-span-8 xl:col-span-9">
            {selectedBoyId && boyDetails ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="h-24 w-24 rounded-full bg-gray-100 dark:bg-meta-4 flex items-center justify-center text-4xl font-bold border-4 border-gray-50 dark:border-strokedark shadow-lg">
                      {boyDetails.boy.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-2xl font-bold text-black dark:text-white">{boyDetails.boy.name}</h3>
                        <span className={`rounded-full py-1 px-3 text-xs font-bold uppercase ${boyDetails.boy.is_online ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {boyDetails.boy.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-gray-400">@{boyDetails.boy.username} • {boyDetails.boy.whatsapp}</p>
                      <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-5">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Status</p>
                          <p className="font-semibold text-black dark:text-white">{boyDetails.boy.account_status}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Bike Range</p>
                          <p className="font-semibold text-black dark:text-white">{boyDetails.boy.bike_km_range ?? '—'} km</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Working Hours</p>
                          <p className="font-semibold text-black dark:text-white">{boyDetails.boy.working_hours ?? 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Monthly Online</p>
                          <p className="font-semibold text-green-600">{boyDetails.boy.monthly_online_hours} hrs</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                    <h4 className="font-bold mb-4">Current Position</h4>
                    {(boyDetails.boy.current_location || boyDetails.boy.last_known_location) ? (
                      <div className="bg-gray-50 dark:bg-meta-4/20 p-4 rounded-lg font-mono">
                        <p className="text-xs text-gray-500 uppercase mb-1">{boyDetails.boy.is_online ? 'Live' : 'Last known'}</p>
                        <p className="text-lg font-bold text-primary">
                          {(boyDetails.boy.current_location || boyDetails.boy.last_known_location)?.latitude.toFixed(6)},
                          {(boyDetails.boy.current_location || boyDetails.boy.last_known_location)?.longitude.toFixed(6)}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {boyDetails.boy.is_online ? 'Tracking active' : `Last seen: ${formatExactDate(boyDetails.boy.last_known_location?.timestamp || boyDetails.boy.last_online_at || '')}`}
                        </p>
                      </div>
                    ) : <p className="text-gray-500 text-center py-10">No location data available</p>}
                  </div>

                  <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                    <h4 className="font-bold mb-4">Current Assignment</h4>
                    {selectedBoyFull?.current_assignment ? (
                      <div className="p-4 border border-stroke dark:border-strokedark rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-bold text-primary">#{selectedBoyFull.current_assignment.order.order_ref}</span>
                          <span className="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded uppercase">
                            {selectedBoyFull.current_assignment.status}
                          </span>
                        </div>
                        <h5 className="font-bold text-black dark:text-white">{selectedBoyFull.current_assignment.order.customer_name}</h5>
                        <p className="text-xs text-gray-500 mt-1">Delivery in Progress</p>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-gray-500 italic">No active task</div>
                    )}
                  </div>
                </div>


                {/* Profile Update History - Expandable Section */}
                <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                  <button
                    onClick={() => setExpandedSections(prev => ({ ...prev, profileHistory: !prev.profileHistory }))}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-all"
                  >
                    <h4 className="font-bold text-black dark:text-white">Profile Update History</h4>
                    <svg
                      className={`h-5 w-5 transition-transform ${expandedSections.profileHistory ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </button>
                  {expandedSections.profileHistory && (
                    <div className="border-t border-stroke dark:border-strokedark px-6 py-4">
                      <OfficerProfileHistory
                        history={boyDetails.boy.profile_history || []}
                        title="Profile Changes"
                      />
                    </div>
                  )}
                </div>

                {/* Month Navigation */}
                <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-6">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        const newDate = new Date(selectedMonth);
                        newDate.setMonth(newDate.getMonth() - 1);
                        setSelectedMonth(newDate);
                      }}
                      className="px-4 py-2 rounded-lg border border-stroke hover:bg-gray-50 dark:hover:bg-meta-4/20 transition"
                    >
                      ← Previous
                    </button>
                    <div className="text-center">
                      <p className="text-lg font-bold text-black dark:text-white">
                        {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedMonth.getFullYear() === new Date().getFullYear() && selectedMonth.getMonth() === new Date().getMonth() ? 'Current Month' : 'Historical Data'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const newDate = new Date(selectedMonth);
                        newDate.setMonth(newDate.getMonth() + 1);
                        // Don't allow future months
                        const today = new Date();
                        if (newDate <= new Date(today.getFullYear(), today.getMonth(), 1)) {
                          setSelectedMonth(newDate);
                        }
                      }}
                      disabled={selectedMonth >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)}
                      className="px-4 py-2 rounded-lg border border-stroke hover:bg-gray-50 dark:hover:bg-meta-4/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>

                {/* Monthly Attendance - Expandable Section */}
                {officerStats && (
                  <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                    <button
                      onClick={() => setExpandedSections(prev => ({ ...prev, attendance: !prev.attendance }))}
                      className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-all"
                    >
                      <h4 className="font-bold text-black dark:text-white">Monthly Attendance ({officerStats.month})</h4>
                      <svg
                        className={`h-5 w-5 transition-transform ${expandedSections.attendance ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </button>
                    {expandedSections.attendance && (
                        <div className="border-t border-stroke dark:border-strokedark p-6">
                            <OfficerAttendanceHistory 
                                dailyStats={officerStats.daily_stats.map(day => {
                                    // If already in new format, keep as is
                                    if ('sessions' in day) return day as any;
                                    // Convert legacy format to new format
                                    const { date, online_hours, worked_hours, offline_during_work_hours } = day;
                                    return {
                                        date,
                                        sessions: [],
                                        // Optionally, you could push a synthetic session here if you want to show legacy data
                                    };
                                })}
                                expectedDailyHours={officerStats.expected_daily_hours}
                            />
                        </div>
                    )}
                  </div>
                )}

                {/* Allocated Products Grid */}
                <div className="space-y-4">
                  <h4 className="text-title-sm font-bold text-black dark:text-white pl-1">
                    Allocated Inventory
                    <span className="ml-2 text-sm font-medium text-gray-500">
                      ({boyDetails.pending_products.length} categories)
                    </span>
                  </h4>

                  {boyDetails.pending_products.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-stroke bg-gray-50 p-10 text-center dark:border-strokedark dark:bg-boxdark">
                      <p className="font-medium text-gray-500">No pending products allocated to this rider.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {boyDetails.pending_products.map((product) => (
                        <div key={product.product_name} className="relative overflow-hidden rounded-xl border border-stroke bg-white p-5 shadow-sm hover:shadow-md transition-all dark:border-strokedark dark:bg-boxdark group">
                          <div className="mb-4">
                            <h5 className="text-lg font-bold text-black dark:text-white truncate" title={product.product_name}>
                              {product.product_name}
                            </h5>
                            <span className="text-xs font-bold text-primary uppercase tracking-wider">Product Group</span>
                          </div>

                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-4xl font-black text-black dark:text-white group-hover:text-primary transition-colors">
                                {product.count}
                                <span className="text-sm font-bold text-gray-400 ml-1">UNITS</span>
                              </p>
                              <p className="text-sm font-semibold text-gray-500 mt-1">
                                Value: <span className="text-black dark:text-white">{product.total_amount.toLocaleString()} PKR</span>
                              </p>
                            </div>
                            <div className="text-right text-[10px] font-bold text-gray-400 space-y-0.5">
                              <p>ADVANCE: {product.advance_amount.toLocaleString()}</p>
                              <p>PLAN: {product.monthly_amount.toLocaleString()} × {product.months}</p>
                            </div>
                          </div>
                          <div className="absolute -right-4 -bottom-4 h-20 w-20 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-all"></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center rounded-xl border border-dashed border-stroke bg-gray-50 text-center dark:border-strokedark dark:bg-boxdark">
                <div className="mb-6 rounded-full bg-white dark:bg-meta-4 p-8 shadow-sm">
                  <svg className="h-16 w-16 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-2xl font-bold text-black dark:text-white">Select a Rider</h3>
                <p className="max-w-xs font-medium text-gray-500">
                  Select a delivery personnel from the sidebar to manage their workload and verify pickups.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* All Deliveries Tab - Tracking and Historical Data */
        <div className="animate-in fade-in duration-500">
          <DeliveryTable
            data={allDeliveries}
            loading={deliveriesLoading}
            onMarkDelivered={(order) => {
              setSelectedOrder(order);
              setActionType('deliver');
            }}
            onMarkReturned={(order) => {
              setSelectedOrder(order);
              setActionType('return');
            }}
            onMarkRefunded={(order) => {
              setSelectedOrder(order);
              setActionType('refund');
            }}
          />

          <DeliveryActionsModal
            isOpen={!!selectedOrder}
            onClose={() => {
              setSelectedOrder(null);
              setActionType(null);
            }}
            orderId={selectedOrder?.id || null}
            actionType={actionType as any}
            onSuccess={() => {
              fetchAllDeliveries();
            }}
          />
        </div>
      )}
    </div>
  );
}

