'use client';

import { useState, useEffect, useRef } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import Loader from '@/components/common/Loader';
import { SearchIcon } from '@/assets/icons';
import { OfficerProfileHistory } from '@/components/OfficerProfileHistory';
import { OfficerAttendanceHistory } from '@/components/OfficerAttendanceHistory';
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

interface Officer {
    id: number;
    full_name: string;
    username: string;
    phone: string;
    account_status: string;
    is_online: boolean;
    current_location: Location | null;
    last_known_location: Location | null;
    last_online_at: string;
    bike_km_range: number | null;
    working_hours: string | null;
    current_verification: {
        id: number;
        status: string;
        order: { order_ref: string; customer_name: string };
    } | null;
    monthly_online_hours: string;
    profile_history: ProfileHistory[];
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

export default function VerificationOfficersPage() {
    const [officers, setOfficers] = useState<Officer[]>([]);
    const [filteredOfficers, setFilteredOfficers] = useState<Officer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
    const [officerStats, setOfficerStats] = useState<MonthlyStats | null>(null);
    const [expandedSections, setExpandedSections] = useState<{
        profileHistory: boolean;
        attendance: boolean;
    }>({ profileHistory: false, attendance: false });
    const [isLoading, setIsLoading] = useState(true);
    
    // Month navigation state
    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    const socketRef = useRef<any>(null);
    const selectedOfficerIdRef = useRef<number | null>(null);

    useEffect(() => {
        selectedOfficerIdRef.current = selectedOfficer?.id || null;
    }, [selectedOfficer]);

    useEffect(() => {
        fetchOfficers();

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
            console.log('Socket connected – joined admins room');
        });

        // Real-time officer status (online/offline)
        // Events fired while this socket was down are lost — re-load the list on every reconnect.
    socketRef.current.io.on('reconnect', () => {
      fetchOfficers();
    });

    socketRef.current.on('officer_status_update', (data: { officerId: number; is_online: boolean; last_online_at?: string }) => {
            setOfficers((prev) =>
                prev.map((o) => (o.id === data.officerId 
                    ? { ...o, is_online: data.is_online, last_online_at: data.last_online_at || o.last_online_at } 
                    : o))
            );
            if (selectedOfficerIdRef.current === data.officerId) {
                setSelectedOfficer((prev) => prev && { 
                    ...prev, 
                    is_online: data.is_online,
                    last_online_at: data.last_online_at || prev.last_online_at 
                });
            }
        });

        // Real-time location updates
        socketRef.current.on('officer_location_update', (data: any) => {
            const newLoc = {
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: data.timestamp,
            };
            setOfficers((prev) =>
                prev.map((o) => (o.id === data.officerId ? { ...o, current_location: newLoc, last_online_at: data.timestamp } : o))
            );
            if (selectedOfficerIdRef.current === data.officerId) {
                setSelectedOfficer((prev) => prev && { ...prev, current_location: newLoc, last_online_at: data.timestamp });
            }
        });

        // Real-time profile updates
        socketRef.current.on('officer_profile_updated', (data: { officerId: number; profile_history: ProfileHistory[] }) => {
            setOfficers((prev) =>
                prev.map((o) => (o.id === data.officerId ? { ...o, profile_history: data.profile_history } : o))
            );
            if (selectedOfficerIdRef.current === data.officerId) {
                setSelectedOfficer((prev) => prev && { ...prev, profile_history: data.profile_history });
            }
        });

        // Real-time monthly online hours update (badge & profile card)
        socketRef.current.on('officer_monthly_update', (data: {
            officerId: number;
            monthly_online_hours: string;
            month: string;
        }) => {
            setOfficers((prev) =>
                prev.map((o) =>
                    o.id === data.officerId ? { ...o, monthly_online_hours: data.monthly_online_hours } : o
                )
            );

            if (selectedOfficerIdRef.current === data.officerId) {
                setSelectedOfficer((prev) =>
                    prev ? { ...prev, monthly_online_hours: data.monthly_online_hours } : null
                );
            }
        });


        // Real-time officer current verification assignment update
        socketRef.current.on('officer_current_verification_update', (data: {
            officerId: number;
            current_verification: Officer['current_verification'];
        }) => {
            setOfficers((prev) =>
                prev.map((o) =>
                    o.id === data.officerId
                        ? { ...o, current_verification: data.current_verification }
                        : o
                )
            );
            if (selectedOfficerIdRef.current === data.officerId) {
                setSelectedOfficer((prev) =>
                    prev ? { ...prev, current_verification: data.current_verification } : null
                );
            }
        });

        // Real-time daily attendance row update
        socketRef.current.on('officer_daily_update', (data: {
            officerId: number;
            date: string;
            online_hours: string;
        }) => {
            if (selectedOfficerIdRef.current !== data.officerId) return;

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

        socketRef.current.on('connect_error', (err: any) => {
            console.error('Socket connection error:', err.message);
        });

        return () => {
            socketRef.current?.off('officer_status_update');
            socketRef.current?.off('officer_location_update');
            socketRef.current?.off('officer_profile_updated');
            socketRef.current?.off('officer_monthly_update');
            socketRef.current?.off('officer_daily_update');
            socketRef.current?.off('connect_error');
            socketRef.current?.disconnect();
        };
    }, []);

    useEffect(() => {
        let result = [...officers];

        if (searchQuery.trim() !== '') {
            const lower = searchQuery.toLowerCase();
            result = result.filter(
                (o) =>
                    o.full_name.toLowerCase().includes(lower) ||
                    o.username.toLowerCase().includes(lower)
            );
        }

        // Sort by online status (online first), then by name
        result.sort((a, b) => {
            if (a.is_online === b.is_online) {
                return a.full_name.localeCompare(b.full_name);
            }
            return a.is_online ? -1 : 1;
        });

        setFilteredOfficers(result);
    }, [searchQuery, officers]);

    useEffect(() => {
        if (selectedOfficer) {
            fetchOfficerDailyStats(selectedOfficer.id);
        } else {
            setOfficerStats(null);
        }
    }, [selectedOfficer, selectedMonth]);

    // Live presence without refreshing: the socket gives instant updates, and this quiet
    // poll (every 8s while the tab is visible + on focus) guarantees the online/offline
    // state is never stale even if a socket event was missed. It only merges presence
    // fields, so search text, sorting and the selected officer are left untouched.
    useEffect(() => {
        const syncPresence = async () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            try {
                const token = Cookies.get('auth_token');
                if (!token) return;
                const res = await fetch(`${BACKEND_URL}/api/officers/verification`, { headers: { Authorization: `Bearer ${token}` } });
                const result = await res.json();
                if (!result.success) return;
                const fresh: any[] = result.data.officers || [];
                const byId = new Map(fresh.map((o: any) => [o.id, o]));
                const merge = (o: any) => {
                    const f: any = byId.get(o.id);
                    return f ? { ...o, is_online: f.is_online, last_online_at: f.last_online_at } : o;
                };
                setOfficers((prev: any[]) => prev.map(merge));
                setFilteredOfficers((prev: any[]) => prev.map(merge));
                setSelectedOfficer((prev: any) => (prev ? merge(prev) : prev));
            } catch (e) {
                /* keep showing the last known state */
            }
        };
        const timer = setInterval(syncPresence, 8000);
        window.addEventListener('focus', syncPresence);
        document.addEventListener('visibilitychange', syncPresence);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', syncPresence);
            document.removeEventListener('visibilitychange', syncPresence);
        };
    }, []);

    const fetchOfficers = async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('auth_token');
            if (!token) throw new Error('No auth token');

            const response = await fetch(`${BACKEND_URL}/api/officers/verification`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const result = await response.json();
            if (result.success) {
                setOfficers(result.data.officers);
                setFilteredOfficers(result.data.officers);
            } else {
                toast.error(result.error?.message || 'Failed to load officers');
            }
        } catch (error) {
            console.error('Fetch officers error:', error);
            toast.error('Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchOfficerDailyStats = async (officerId: number) => {
        try {
            const token = Cookies.get('auth_token');
            if (!token) return;

            const month = (selectedMonth.getMonth() + 1).toString().padStart(2, '0');
            const year = selectedMonth.getFullYear();
            const res = await fetch(`${BACKEND_URL}/api/officers/${officerId}/stats?month=${month}&year=${year}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            const result = await res.json();
            if (result.success) {
                setOfficerStats(result.data);
            } else {
                console.warn('Failed to load daily stats:', result.error);
            }
        } catch (err) {
            console.error('Daily stats fetch error:', err);
        }
    };

    const stats = {
        total: officers.length,
        online: officers.filter((o) => o.is_online).length,
        offline: officers.filter((o) => !o.is_online).length,
        activeVerifications: officers.filter((o) => o.current_verification).length,
    };

    console.log(officerStats)

    return (
        <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
            <div className="mb-8">
                <h2 className="text-title-md2 font-bold text-black dark:text-white">
                    Verification Officer Management
                </h2>
                <p className="font-medium">
                    Real-time monitoring of officer status, location, attendance, and assignments.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:gap-6 xl:gap-7.5 mb-8">
                <StatCard title="Total Officers" value={stats.total} color="blue" />
                <StatCard title="Online Now" value={stats.online} color="green" isPulse />
                <StatCard title="Offline" value={stats.offline} color="gray" />
                <StatCard title="Active Jobs" value={stats.activeVerifications} color="yellow" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Officer List */}
                <div className="lg:col-span-4 xl:col-span-3">
                    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                        <div className="p-4 border-b border-stroke dark:border-strokedark">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <SearchIcon className="h-5 w-5" />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search officer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-11 pr-5 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4 dark:text-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col max-h-[600px] overflow-y-auto">
                            {isLoading ? (
                                <Loader text="Loading officers..." />
                            ) : filteredOfficers.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">No officers found</div>
                            ) : (
                                filteredOfficers.map((officer) => (
                                    <div
                                        key={officer.id}
                                        onClick={() => setSelectedOfficer(officer)}
                                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-all border-l-4 ${selectedOfficer?.id === officer.id
                                            ? 'bg-gray-50 dark:bg-meta-4/30 border-primary'
                                            : 'border-transparent hover:bg-gray-50 dark:hover:bg-meta-4/20'
                                            }`}
                                    >
                                        <div className="relative h-12 w-12 flex-shrink-0">
                                            <div className="h-full w-full rounded-full bg-gray-200 dark:bg-meta-4 flex items-center justify-center text-lg font-bold text-gray-500">
                                                {officer.full_name.charAt(0)}
                                            </div>
                                            <span
                                                className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-boxdark ${officer.is_online ? 'bg-green-500' : 'bg-gray-400'
                                                    }`}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-black dark:text-white truncate">
                                                {officer.full_name}
                                            </h4>
                                            <p className="text-xs text-gray-400">@{officer.username}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Details View */}
                <div className="lg:col-span-8 xl:col-span-9">
                    {selectedOfficer ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Profile Header */}
                            <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                                <div className="flex flex-col md:flex-row md:items-center gap-6">
                                    <div className="h-24 w-24 rounded-full bg-gray-100 dark:bg-meta-4 flex items-center justify-center text-4xl font-bold border-4 border-gray-50 flex-shrink-0">
                                        {selectedOfficer.full_name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-bold text-black dark:text-white">
                                                {selectedOfficer.full_name}
                                            </h3>
                                            <span
                                                className={`inline-flex rounded-full py-1 px-3 text-xs font-bold uppercase ${selectedOfficer.is_online ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-500'
                                                    }`}
                                            >
                                                {selectedOfficer.is_online ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        <p className="text-gray-400 mt-1">
                                            @{selectedOfficer.username} • {selectedOfficer.phone}
                                        </p>
                                        {!selectedOfficer.is_online && selectedOfficer.last_online_at && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Last seen: {new Date(selectedOfficer.last_online_at).toLocaleString()}
                                            </p>
                                        )}

                                        <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-5">
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</p>
                                                <p className="font-semibold mt-1">{selectedOfficer.account_status}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Bike Range</p>
                                                <p className="font-semibold mt-1">
                                                    {selectedOfficer.bike_km_range ?? '—'} km
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Working Hours</p>
                                                <p className="font-semibold mt-1">
                                                    {selectedOfficer.working_hours ?? 'Not set'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Monthly Online</p>
                                                <p className="font-semibold mt-1 text-green-600">
                                                    {selectedOfficer.monthly_online_hours} hrs
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Location + Active Task */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Location Card */}
                                <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                                    <h4 className="font-bold mb-4">Current Position</h4>
                                    {selectedOfficer.current_location || selectedOfficer.last_known_location ? (
                                        <div className="space-y-4">
                                            <div className="bg-gray-50 dark:bg-meta-4/20 p-4 rounded-lg font-mono">
                                                <p className="text-xs text-gray-500 uppercase mb-1">
                                                    {selectedOfficer.is_online ? 'Live' : 'Last known'}
                                                </p>
                                                <p className="text-lg font-bold text-primary">
                                                    {(selectedOfficer.current_location || selectedOfficer.last_known_location)?.latitude.toFixed(6)},
                                                    {(selectedOfficer.current_location || selectedOfficer.last_known_location)?.longitude.toFixed(6)}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-2">
                                                    {selectedOfficer.is_online
                                                        ? 'Tracking active'
                                                        : `Last seen: ${formatExactDate(selectedOfficer.last_known_location?.timestamp || '')}`}
                                                </p>
                                            </div>
                                            <button className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition">
                                                View on Map
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-gray-500">No location data</div>
                                    )}
                                </div>

                                {/* Active Task Card */}
                                <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
                                    <h4 className="font-bold mb-4">Current Assignment</h4>
                                    {selectedOfficer.current_verification ? (
                                        <div className="p-4 border border-stroke dark:border-strokedark rounded-lg">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-sm font-bold text-primary">
                                                    #{selectedOfficer.current_verification.order.order_ref}
                                                </span>
                                                <span className="bg-yellow-500/10 text-yellow-600 text-xs font-bold px-2.5 py-1 rounded uppercase">
                                                    In Progress
                                                </span>
                                            </div>
                                            <h5 className="font-bold">
                                                {selectedOfficer.current_verification.order.customer_name}
                                            </h5>
                                            <p className="text-xs text-gray-500 mt-1">Identity & Residence Verification</p>
                                            <button className="mt-4 w-full py-2 border border-stroke dark:border-strokedark rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-meta-4 transition">
                                                View Details
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-gray-500 italic">No active task</div>
                                    )}
                                </div>
                            </div>

                            {/* Profile History Section */}
                            <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                                <button
                                    onClick={() => setExpandedSections({ ...expandedSections, profileHistory: !expandedSections.profileHistory })}
                                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-meta-4/20 transition"
                                >
                                    <h4 className="font-bold">Profile Update History</h4>
                                    <span className={`text-xl transform transition-transform ${expandedSections.profileHistory ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </button>
                                {expandedSections.profileHistory && (
                                    <div className="border-t border-stroke dark:border-strokedark p-6">
                                        {selectedOfficer.profile_history && selectedOfficer.profile_history.length > 0 ? (
                                            <OfficerProfileHistory history={selectedOfficer.profile_history} />
                                        ) : (
                                            <p className="text-center py-6 text-gray-500">No profile updates yet</p>
                                        )}
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

                            {/* Attendance Table – fully real-time */}
                            {officerStats && (
                                <>
                                    <div className="rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                                        <button
                                            onClick={() => setExpandedSections({ ...expandedSections, attendance: !expandedSections.attendance })}
                                            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-meta-4/20 transition"
                                        >
                                            <h4 className="font-bold">Monthly Attendance ({officerStats.month})</h4>
                                            <span className={`text-xl transform transition-transform ${expandedSections.attendance ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
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
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[500px] rounded-xl border border-dashed border-stroke bg-gray-50 dark:border-strokedark dark:bg-boxdark text-center">
                            <div className="mb-6 rounded-full bg-white dark:bg-meta-4 p-8 shadow-sm">
                                <svg className="h-16 w-16 text-primary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-6-6h-1m1-7.758a3.3 3.3 0 100 6.516" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-black dark:text-white mb-2">
                                Select an Officer
                            </h3>
                            <p className="max-w-md text-gray-500">
                                Choose a verification officer to view live status, location, current task, profile history, and real-time attendance records.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    color,
    isPulse = false,
}: {
    title: string;
    value: number;
    color: string;
    isPulse?: boolean;
}) {
    const colorClasses = {
        blue: 'bg-blue-600/10 text-blue-600',
        green: 'bg-green-600/10 text-green-600',
        gray: 'bg-gray-100 text-gray-500',
        yellow: 'bg-yellow-600/10 text-yellow-600',
    };

    return (
        <div className="rounded-xl border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark group hover:border-primary transition-colors">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-title-md font-bold text-black dark:text-white">{value}</h4>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                        {isPulse && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                        {title}
                    </span>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
                    <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}