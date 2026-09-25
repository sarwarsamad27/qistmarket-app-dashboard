'use client'

import React, { useState, useRef, useEffect } from 'react';
import { Smartphone, Monitor, Package, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import SubAdminPagePicker from '@/components/Users/SubAdminPagePicker';
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Sub Admin has no fixed role id (its row is created on first use, so the id differs
// per database) — the form uses this local sentinel and sends role_name instead.
const SUB_ADMIN_ROLE_ID = 0;

const CreateUsers: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    role_id: '',
    cnic: '',
    outlet_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [outlets, setOutlets] = useState<{ id: number; name: string; code: string; address?: string | null }[]>([]);
  const [missingAddress, setMissingAddress] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [showOutletModal, setShowOutletModal] = useState(false);
  const [newOutlet, setNewOutlet] = useState({ name: '', code: '', address: '' });
  const [creatingOutlet, setCreatingOutlet] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [subAdminPages, setSubAdminPages] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fullNameRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const cnicRef = useRef<HTMLInputElement>(null);
  const roleSectionRef = useRef<HTMLDivElement>(null);

  const roles = [
    {
      id: 1,
      name: 'Verification Officer (VO)',
      platform: 'mobile',
      icon: Smartphone,
      description: 'View assigned cases, perform visits, upload photos/docs, voice notes, start/end day tracking, drafts and also Create and manage new orders'
    },
    {
      id: 2,
      name: 'Delivery Agent (DA)',
      platform: 'mobile',
      icon: Smartphone,
      description: 'View assigned deliveries, collect payment (cash/online), OTP confirmation, upload delivery photos with tags, pickup/returns handling and also Create and manage new orders'
    },
    {
      id: 3,
      name: 'Recovery Officer (RO)',
      platform: 'mobile',
      icon: Smartphone,
      description: 'Outdoor recovery visits, payment collection, blacklist tagging, location & proof capture and also Create and manage new orders'
    },
    {
      id: 4,
      name: 'Admin',
      platform: 'web',
      icon: Monitor,
      description: 'Assign cases, manage officers, approve/reject verifications, live map, reports, export and also Create and manage new orders'
    },
    {
      id: SUB_ADMIN_ROLE_ID,
      name: 'Sub Admin',
      platform: 'web',
      icon: ShieldCheck,
      description: 'Your own (Super Admin) menu, limited to the pages you tick below — everything unticked stays hidden and blocked. Cannot create users or change admin accounts. Logs in with OTP.'
    },
    {
      id: 8,
      name: 'Sales Officer (SO)',
      platform: 'web',
      icon: Monitor,
      description: 'Create and manage new orders from various channels (website, WhatsApp, branch, referral)'
    },
    {
      id: 5,
      name: 'Outlet User',
      platform: 'web',
      icon: Monitor,
      description: 'Manage outlet balances, confirm OTP transfers, view stock & expenses, reconcile receipts'
    },
    // {
    //   id: 6,
    //   name: 'Stock Manager',
    //   platform: 'web',
    //   icon: Package,
    //   description: 'Manage inventory, track stock levels, handle warehouse operations'
    // },
    {
      id: 9,
      name: 'Form Analyzer',
      platform: 'web',
      icon: Package,
      description: 'Analyze and manage form data and submissions'
    },
    {
      id: 10,
      name: 'HR',
      platform: 'web',
      icon: Monitor,
      description: 'Manage employee records, attendance, leaves, payroll and announcements'
    },
    {
      id: 11,
      name: 'Accountant',
      platform: 'web',
      icon: Monitor,
      description: 'Centralized financial control — cash in hand, expenses, vendor payables, customer receivables, recovery analytics, stock summary, and consolidated reporting across all outlets'
    }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const fetchOutlets = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlets`, {
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
      });
      const result = await res.json();
      if (result.success) setOutlets(result.outlets);
    } catch (error) {
      console.error("Failed to fetch outlets:", error);
    }
  };

  const selectedOutletRecord = outlets.find((o) => String(o.id) === String(formData.outlet_id));
  const selectedOutletNeedsAddress = !!selectedOutletRecord && !(selectedOutletRecord.address || '').trim();

  // The branch address is what customers see on their ledger — an outlet created
  // without one can have it filled in right here while assigning a user to it.
  const handleSaveOutletAddress = async () => {
    if (!selectedOutletRecord || !missingAddress.trim()) {
      toast.error('Please enter the outlet address');
      return;
    }
    setSavingAddress(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlets/${selectedOutletRecord.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Cookies.get("auth_token")}` },
        body: JSON.stringify({ address: missingAddress.trim() }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || 'Failed to save address');
      setOutlets((prev) => prev.map((o) => (o.id === selectedOutletRecord.id ? { ...o, address: missingAddress.trim() } : o)));
      setMissingAddress('');
      toast.success('Outlet address saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleCreateOutlet = async () => {
    if (!newOutlet.name || !newOutlet.code || !newOutlet.address.trim()) {
      toast.error("Name, Code and Address are required for an outlet");
      return;
    }
    setCreatingOutlet(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Cookies.get("auth_token")}`
        },
        body: JSON.stringify(newOutlet)
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Outlet created successfully");
        setShowOutletModal(false);
        setNewOutlet({ name: '', code: '', address: '' });
        fetchOutlets();
      } else {
        toast.error(result.message || "Failed to create outlet");
      }
    } catch (error) {
      toast.error("Error creating outlet");
    } finally {
      setCreatingOutlet(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.username.trim()) newErrors.username = 'Username is required';

    // Password required for App/Outlet roles
    if ([1, 2, 3, 5, 8].includes(parseInt(formData.role_id)) && !formData.password.trim()) {
      newErrors.password = 'Password is required for this role';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(\+92|0)?[0-9]{10}$/.test(formData.phone.replace(/\s+/g, ''))) {
      newErrors.phone = 'Phone number must be a valid Pakistani number (e.g., 03001234567)';
    }
    if (!formData.cnic.trim()) {
      newErrors.cnic = 'CNIC is required';
    } else if (!/^\d{5}-\d{7}-\d{1}$|^\d{13}$/.test(formData.cnic.replace(/[-\s]/g, ''))) {
      newErrors.cnic = 'CNIC must be in format 42101XXXXXXXXX or 42101-XXXXXXX-X';
    }
    if (!formData.role_id) newErrors.role_id = 'Please select a role';
    if (formData.role_id !== '' && Number(formData.role_id) === SUB_ADMIN_ROLE_ID && subAdminPages.length === 0) {
      newErrors.sub_admin_pages = 'Tick at least one page this Sub Admin can access';
    }

    if (formData.email.trim()) {
      if (!/\S+@\S+\.\S+/.test(formData.email.trim())) {
        newErrors.email = 'Email format is invalid';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const firstErrorKey = Object.keys(errors)[0];
      let elementToScroll: HTMLElement | null = null;

      switch (firstErrorKey) {
        case 'fullName':
          elementToScroll = fullNameRef.current;
          break;
        case 'username':
          elementToScroll = usernameRef.current;
          break;
        case 'phone':
          elementToScroll = phoneRef.current;
          break;
        case 'cnic':
          elementToScroll = cnicRef.current;
          break;
        case 'role_id':
        case 'sub_admin_pages':
          elementToScroll = roleSectionRef.current;
          break;
        default:
          break;
      }

      if (elementToScroll) {
        elementToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (elementToScroll as HTMLInputElement)?.focus?.();
      }
    }
  }, [errors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      if (!token) {
        toast.error("Unauthorized: No token found");
        return;
      }
      const payload: any = {
        full_name: formData.fullName.trim(),
        username: formData.username.trim(),
        phone: formData.phone.trim(),
        role_id: Number(formData.role_id),
        cnic: formData.cnic.trim().replace(/[-\s]/g, ''),
        outlet_id: formData.outlet_id ? Number(formData.outlet_id) : null,
      };

      if (Number(formData.role_id) === SUB_ADMIN_ROLE_ID) {
        delete payload.role_id;
        payload.role_name = 'Sub Admin';
        payload.sub_admin_pages = subAdminPages;
        payload.outlet_id = null;
      }

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      if (formData.email.trim()) {
        payload.email = formData.email.trim();
      }

      const response = await fetch(`${BACKEND_URL}/api/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to create user");
      }

      const result = await response.json();
      toast.success(result.message);

      setFormData({
        fullName: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        role_id: '',
        cnic: '',
        outlet_id: '',
      });
      setSubAdminPages([]);
      setErrors({});

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSubAdminPages([]);
    setFormData({
      fullName: '',
      email: '',
      username: '',
      password: '',
      phone: '',
      role_id: '',
      cnic: '',
      outlet_id: '',
    });
    setErrors({});
  };

  const selectedRole = formData.role_id === '' ? undefined : roles.find(r => r.id === Number(formData.role_id));
  const isSubAdminSelected = selectedRole?.id === SUB_ADMIN_ROLE_ID;

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[970px]">
        <Breadcrumb pageName="Create New User" />
        <div className="bg-white rounded-lg shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Personal Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fullNameRef}
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-lg border-[1.5px] bg-transparent outline-none transition focus:border-[#ff3d3d] ${errors.fullName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Enter full name"
                  />
                  {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-lg border-[1.5px] bg-transparent outline-none transition focus:border-[#ff3d3d] ${errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="user@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={usernameRef}
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-lg border-[1.5px] bg-transparent outline-none transition focus:border-[#ff3d3d] ${errors.username ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Enter username"
                  />
                  {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    WhatsApp Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={phoneRef}
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-lg border-[1.5px] bg-transparent outline-none transition focus:border-[#ff3d3d] ${errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="03001234567"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CNIC <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={cnicRef}
                    type="text"
                    name="cnic"
                    value={formData.cnic}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 rounded-lg border-[1.5px] bg-transparent outline-none transition focus:border-[#ff3d3d] ${errors.cnic ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="42101XXXXXXXXX"
                  />
                  {errors.cnic && <p className="text-red-500 text-sm mt-1">{errors.cnic}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Login Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 rounded-lg border-[1.5px] bg-transparent outline-none transition focus:border-[#ff3d3d] ${errors.password ? 'border-red-500' : 'border-gray-300'
                        }`}
                      placeholder="Enter login password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div ref={roleSectionRef} className="border-b pb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Role & Access</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.map((role) => {
                    const Icon = role.icon;
                    return (
                      <label
                        key={role.id}
                        className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.role_id !== '' && Number(formData.role_id) === role.id
                          ? 'border-[#ff3d3d] bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <input
                          type="radio"
                          name="role_id"
                          value={role.id}
                          checked={formData.role_id !== '' && Number(formData.role_id) === role.id}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-5 h-5 ${formData.role_id !== '' && Number(formData.role_id) === role.id ? 'text-[#ff3d3d]' : 'text-gray-500'}`} />
                            <span className="font-semibold text-gray-900">{role.name}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{role.description}</p>
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${role.platform === 'mobile'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700'
                            }`}>
                            {role.platform === 'mobile' ? 'Mobile App' : 'Web Dashboard'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {errors.role_id && <p className="text-red-500 text-sm mt-2">{errors.role_id}</p>}

                {/* Sub Admin: pick exactly which Admin pages they get */}
                {isSubAdminSelected && (
                  <SubAdminPagePicker
                    value={subAdminPages}
                    onChange={(pages) => {
                      setSubAdminPages(pages);
                      if (errors.sub_admin_pages) setErrors((prev) => ({ ...prev, sub_admin_pages: '' }));
                    }}
                    error={errors.sub_admin_pages}
                  />
                )}
              </div>
            </div>

            {/* Outlet Detection */}
            {[1, 2, 3, 5].includes(Number(formData.role_id)) && (
              <div className="border-b pb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Outlet Assignment</h2>
                <div>
                  <div className="flex items-center gap-2">
                    <select
                      name="outlet_id"
                      value={formData.outlet_id}
                      onChange={handleChange}
                      className="flex-1 px-4 py-2 rounded-lg border-[1.5px] border-gray-300 bg-transparent outline-none transition focus:border-[#ff3d3d]"
                    >
                      <option value="">Select an Outlet</option>
                      {outlets.map(outlet => (
                        <option key={outlet.id} value={outlet.id}>
                          {outlet.name} ({outlet.code}){!(outlet.address || '').trim() ? ' — ⚠ address missing' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowOutletModal(true)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg border border-gray-300 font-medium transition-colors"
                    >
                      + Add New
                    </button>
                  </div>
                  {selectedOutletNeedsAddress && (
                    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800 mb-2">
                        {selectedOutletRecord?.name} has no address yet — it shows as N/A on customers' ledgers. Add it here:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={missingAddress}
                          onChange={(e) => setMissingAddress(e.target.value)}
                          placeholder="Full location address"
                          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 bg-white outline-none focus:border-[#ff3d3d]"
                        />
                        <button
                          type="button"
                          onClick={handleSaveOutletAddress}
                          disabled={savingAddress}
                          className="px-4 py-2 rounded-lg bg-[#ff3d3d] text-white font-medium disabled:opacity-50"
                        >
                          {savingAddress ? 'Saving...' : 'Save Address'}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Assigning a user to an outlet scopes their data and permissions to that branch.
                  </p>
                </div>
              </div>
            )}

            {/* OTP Warning/Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Dashboard users will log in via OTP sent to their WhatsApp or Email. No password setup is required.
              </p>
            </div>

            {/* Selected Role Summary */}
            {selectedRole && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2">Selected Role Summary</h3>
                <div className="flex items-start gap-3">
                  {React.createElement(selectedRole.icon, { className: 'w-5 h-5 text-red-600 mt-0.5' })}
                  <div>
                    <p className="font-medium text-red-900">{selectedRole.name}</p>
                    <p className="text-sm text-red-700 mt-1">{selectedRole.description}</p>
                    {isSubAdminSelected && (
                      <p className="text-sm font-semibold text-red-800 mt-2">
                        {subAdminPages.length} page(s) granted
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-[#ff3d3d] text-white py-3 px-6 rounded-lg font-semibold hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Creating User' : 'Create User'}
                {loading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Outlet Creation Modal */}
      {showOutletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Add New Outlet</h3>
              <p className="text-sm text-gray-500">Create a new branch or location</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outlet Name *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#ff3d3d] outline-none"
                  placeholder="e.g. Saddar Branch"
                  value={newOutlet.name}
                  onChange={(e) => setNewOutlet({ ...newOutlet, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outlet Code *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#ff3d3d] outline-none"
                  placeholder="e.g. SDO-01"
                  value={newOutlet.code}
                  onChange={(e) => setNewOutlet({ ...newOutlet, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#ff3d3d] outline-none"
                  placeholder="Full location address"
                  value={newOutlet.address}
                  onChange={(e) => setNewOutlet({ ...newOutlet, address: e.target.value })}
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button
                type="button"
                onClick={() => setShowOutletModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOutlet}
                disabled={creatingOutlet}
                className="flex-1 px-4 py-2 bg-[#ff3d3d] text-white rounded-lg hover:bg-opacity-90 font-medium disabled:opacity-50"
              >
                {creatingOutlet ? 'Creating...' : 'Create Outlet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateUsers;