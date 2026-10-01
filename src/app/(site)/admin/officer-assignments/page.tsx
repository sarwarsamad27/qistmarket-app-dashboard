'use client'

import React, { useState, useEffect } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Loader from '@/components/common/Loader';
import { getErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Assignment {
    zone: string;
    area: string;
}

interface Officer {
    id: number;
    full_name: string;
    username: string;
    officerAssignments: Assignment[];
}

// Zones and areas are now fetched dynamically
// const zones = [...];
// const karachiAreas = [...];

const OfficerAssignmentsPage = () => {
    const [officers, setOfficers] = useState<Officer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOfficer, setSelectedOfficer] = useState<Officer | null>(null);
    const [tempAssignments, setTempAssignments] = useState<Assignment[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [addressHierarchy, setAddressHierarchy] = useState<any[]>([]);
    const [selectedZone, setSelectedZone] = useState<string>('');

    const zones = addressHierarchy.find(c => c.name === "Karachi")?.zones.map((z: any) => z.name) || [];
    const areasInSelectedZone = addressHierarchy.find(c => c.name === "Karachi")?.zones.find((z: any) => z.name === selectedZone)?.areas.map((a: any) => a.name) || [];

    useEffect(() => {
        if (zones.length > 0 && !selectedZone) {
            setSelectedZone(zones[0]);
        }
    }, [addressHierarchy]);

    const fetchOfficers = async () => {
        try {
            const token = Cookies.get("auth_token");
            const [offResp, addrResp] = await Promise.all([
                fetch(`${BACKEND_URL}/api/assignments/officers`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${BACKEND_URL}/api/address/hierarchy`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const offData = await offResp.json();
            const addrData = await addrResp.json();

            if (offData.success) setOfficers(offData.data);
            if (addrData.success) setAddressHierarchy(addrData.data);

        } catch (err) {
            toast.error(getErrorMessage(err, "Error fetching data"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOfficers();
    }, []);

    const openModal = (officer: Officer) => {
        setSelectedOfficer(officer);
        setTempAssignments([...officer.officerAssignments]);
        setIsModalOpen(true);
    };

    const handleToggleArea = (area: string) => {
        const exists = tempAssignments.find(a => a.zone === selectedZone && a.area === area);
        if (exists) {
            setTempAssignments(tempAssignments.filter(a => !(a.zone === selectedZone && a.area === area)));
        } else {
            setTempAssignments([...tempAssignments, { zone: selectedZone, area }]);
        }
    };

    const handleSave = async () => {
        if (!selectedOfficer) return;
        setSaving(true);
        try {
            const token = Cookies.get("auth_token");
            const resp = await fetch(`${BACKEND_URL}/api/assignments/${selectedOfficer.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ assignments: tempAssignments })
            });
            const data = await resp.json();
            if (data.success) {
                toast.success("Assignments updated");
                setIsModalOpen(false);
                fetchOfficers();
            } else {
                toast.error(data.error?.message || "Update failed");
            }
        } catch (err) {
            toast.error(getErrorMessage(err, "Error updating assignments"));
        } finally {
            setSaving(false);
        }
    };

    const filteredOfficers = officers.filter(o =>
        o.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Officer Area Assignments" />

            <div className="bg-white dark:bg-gray-dark rounded-xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-bold">Verification Officers</h2>
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Search officer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800 text-sm font-semibold">
                                <th className="px-6 py-4">Officer Name</th>
                                <th className="px-6 py-4">Username</th>
                                <th className="px-6 py-4">Assigned Areas</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center">
                                        <Loader text="Loading data..." />
                                    </td>
                                </tr>
                            ) : filteredOfficers.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-10 text-center">No officers found</td></tr>
                            ) : filteredOfficers.map(officer => (
                                <tr key={officer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                                    <td className="px-6 py-4 font-medium">{officer.full_name}</td>
                                    <td className="px-6 py-4 text-gray-500">@{officer.username}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {officer.officerAssignments.length === 0 ? (
                                                <span className="text-xs text-gray-400 italic">None</span>
                                            ) : officer.officerAssignments.slice(0, 3).map((a, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-xs border border-red-100">
                                                    {a.area} ({a.zone})
                                                </span>
                                            ))}
                                            {officer.officerAssignments.length > 3 && (
                                                <span className="text-xs text-gray-400">+{officer.officerAssignments.length - 3} more</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => openModal(officer)}
                                            className="text-red-600 hover:text-red-700 font-semibold text-sm underline px-4 py-2"
                                        >
                                            Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Assignment Modal */}
            {isModalOpen && selectedOfficer && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold">Manage Assignments</h3>
                                <p className="text-sm text-gray-500">Assigning areas to <b>{selectedOfficer.full_name}</b></p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">&times;</button>
                        </div>

                        <div className="flex-1 overflow-hidden flex">
                            {/* Zones List */}
                            <div className="w-1/4 border-r border-gray-100 dark:border-gray-800 p-4 space-y-2 overflow-y-auto">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Zones</p>
                                {zones.map((zone: string) => (
                                    <button
                                        key={zone}
                                        onClick={() => setSelectedZone(zone)}
                                        className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition ${selectedZone === zone
                                            ? 'bg-red-600 text-white'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        {zone}
                                    </button>
                                ))}
                            </div>

                            {/* Areas List */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="font-bold text-gray-800 dark:text-white">Areas in {selectedZone}</h4>
                                    <p className="text-sm text-gray-500">{tempAssignments.filter(a => a.zone === selectedZone).length} selected</p>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {areasInSelectedZone.map((area: string) => {
                                        const isSelected = tempAssignments.some(a => a.zone === selectedZone && a.area === area);
                                        return (
                                            <label
                                                key={area}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isSelected
                                                    ? 'border-red-600 bg-red-50/50 dark:bg-red-900/10'
                                                    : 'border-gray-100 dark:border-gray-800 hover:border-red-200'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleArea(area)}
                                                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                                />
                                                <span className={`text-sm ${isSelected ? 'font-semibold text-red-700' : 'text-gray-600 dark:text-gray-400'}`}>
                                                    {area}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
                            <div className="text-sm text-gray-500">
                                Total Assigned: <b>{tempAssignments.length}</b> areas across <b>{new Set(tempAssignments.map(a => a.zone)).size}</b> zones
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-8 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfficerAssignmentsPage;
