'use client'

import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, Globe, MessageSquare, Building, Users, Search, ChevronDown, Check, X, Phone, User as UserIcon, MapPin, AlertCircle, Calculator } from 'lucide-react';
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { useAuth } from "../../../contexts/AuthContext";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const CreateOrders: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    customer_name: '',
    whatsapp_number: '',
    alternate_contact: '',
    address: '',
    city: 'Karachi', // Default city
    area: '',
    zone: '',
    block: '',
    street: '',
    house_no: '',
    gender: '',
    marital_status: '',
    residential_type: '',
    product_name: '',
    total_amount: '',
    advance_amount: '',
    monthly_amount: '',
    months: '',
    channel: '',
    order_notes: '',
  });

  const [isManualAddress, setIsManualAddress] = useState(false);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [isCustomProductNoPricing, setIsCustomProductNoPricing] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Searchable Select States
  const [areaSearchTerm, setAreaSearchTerm] = useState('');
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Calculator States
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calcCategory, setCalcCategory] = useState('');
  const [calcPrice, setCalcPrice] = useState('');
  const [calcResults, setCalcResults] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);

  // Advance Editing & Ledger States
  const [advanceOverride, setAdvanceOverride] = useState<number | ''>('');
  const [ledger, setLedger] = useState<any[]>([]);
  const [activeCustomPlan, setActiveCustomPlan] = useState<{ cashPrice: number, months: number, profit: number } | null>(null);
  const [phoneMatches, setPhoneMatches] = useState<any[]>([]);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [altPhoneMatches, setAltPhoneMatches] = useState<any[]>([]);
  const [checkingAltPhone, setCheckingAltPhone] = useState(false);

  // Custom Product Calculation States
  const [customCashPrice, setCustomCashPrice] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [customMonths, setCustomMonths] = useState<string>('');

  const nameRef = useRef<HTMLInputElement>(null);
  const whatsappRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLSelectElement>(null);
  const areaRef = useRef<HTMLButtonElement>(null);
  const genderRef = useRef<HTMLSelectElement>(null);
  const maritalRef = useRef<HTMLSelectElement>(null);
  const residentialRef = useRef<HTMLSelectElement>(null);
  const channelRef = useRef<HTMLDivElement>(null);
  
  // Refs for click-outside detection
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  const [addressHierarchy, setAddressHierarchy] = useState<any[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close Area dropdown if clicked outside
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setIsAreaDropdownOpen(false);
      }
      // Close Product dropdown if clicked outside
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const resp = await fetch('https://api.qistmarket.pk/api/categories');
        const data = await resp.json();
        setAllCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const token = Cookies.get("auth_token");
        const resp = await fetch(`${BACKEND_URL}/api/address/hierarchy`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
          setAddressHierarchy(data.data);
          // Set default city to Karachi
          setFormData(prev => ({ ...prev, city: 'Karachi' }));
        }
      } catch (err) {
        console.error("Error fetching address hierarchy:", err);
      }
    };
    fetchHierarchy();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = Cookies.get("auth_token");
        const resp = await fetch(`${BACKEND_URL}/api/products`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await resp.json();
        if (data.success) {
          setProducts(data.data);
          const uniqueCategories = Array.from(new Set(data.data.map((p: any) => p.category_name))) as string[];
          setCategories(uniqueCategories.sort());
        }
      } catch (err) {
        console.error("Error fetching products:", err);
      }
    };
    fetchProducts();
  }, []);

  // WhatsApp Number Cross-Check
  useEffect(() => {
    const checkPhone = async () => {
      const phone = formData.whatsapp_number.replace(/\s+/g, '');
      if (phone.length === 11 && /^0[0-9]{10}$/.test(phone)) {
        setCheckingPhone(true);
        try {
          const token = Cookies.get("auth_token");
          const response = await fetch(`${BACKEND_URL}/api/check-phone`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ phone })
          });
          const result = await response.json();
          if (result.success) {
            setPhoneMatches(result.results);
            if (result.results.length > 0) {
              toast.error(`Found ${result.results.length} existing order(s) for this number!`, {
                duration: 4000,
                icon: '⚠️'
              });
            }
          }
        } catch (error) {
          console.error("Error checking phone:", error);
        } finally {
          setCheckingPhone(false);
        }
      } else {
        setPhoneMatches([]);
      }
    };

    const timer = setTimeout(checkPhone, 500);
    return () => clearTimeout(timer);
  }, [formData.whatsapp_number]);

  // Alternate Contact Number Cross-Check
  useEffect(() => {
    const checkAltPhone = async () => {
      const phone = (formData.alternate_contact || '').replace(/\s+/g, '');
      if (phone.length === 11 && /^0[0-9]{10}$/.test(phone)) {
        setCheckingAltPhone(true);
        try {
          const token = Cookies.get("auth_token");
          const response = await fetch(`${BACKEND_URL}/api/check-phone`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ phone })
          });
          const result = await response.json();
          if (result.success) {
            setAltPhoneMatches(result.results);
            if (result.results.length > 0) {
              toast.error(`Found ${result.results.length} existing record(s) for alternate contact!`, {
                duration: 4000,
                icon: '⚠️'
              });
            }
          }
        } catch (error) {
          console.error("Error checking alternate phone:", error);
        } finally {
          setCheckingAltPhone(false);
        }
      } else {
        setAltPhoneMatches([]);
      }
    };

    const timer = setTimeout(checkAltPhone, 500);
    return () => clearTimeout(timer);
  }, [formData.alternate_contact]);

  // Round up logic
  const roundUp = (val: number) => Math.ceil(val / 50) * 50;

  const calculateInstallments = (category: string, price: number) => {
    const cat = category.toLowerCase().trim();
    let plans = [];

    if (cat === 'mobiles' && price <= 60000) {
      plans = [
        { months: 3, profit: 0.20, advance: 0.35 },
        { months: 6, profit: 0.35, advance: 0.25 },
        { months: 9, profit: 0.45, advance: 0.20 },
        { months: 11, profit: 0.52, advance: 0.18 },
        { months: 12, profit: 0.55, advance: 0.15 },
      ];
    } else if (price > 50000 && price <= 100000) {
      plans = [
        { months: 3, profit: 0.20, advance: 0.40 },
        { months: 6, profit: 0.35, advance: 0.35 },
        { months: 9, profit: 0.45, advance: 0.30 },
        { months: 11, profit: 0.52, advance: 0.28 },
        { months: 12, profit: 0.55, advance: 0.25 },
        { months: 24, profit: 0.85, advance: 0.25 },
      ];
    } else if (price > 100000) {
      plans = [
        { months: 3, profit: 0.20, advance: 0.40 },
        { months: 6, profit: 0.35, advance: 0.35 },
        { months: 9, profit: 0.45, advance: 0.30 },
        { months: 11, profit: 0.52, advance: 0.28 },
        { months: 12, profit: 0.55, advance: 0.25 },
        { months: 18, profit: 0.70, advance: 0.25 },
        { months: 24, profit: 0.85, advance: 0.25 },
      ];
    } else {
      // General fallbacks for other categories
      plans = [
        { months: 3, profit: 0.22, advance: 0.40 },
        { months: 6, profit: 0.38, advance: 0.35 },
        { months: 9, profit: 0.48, advance: 0.30 },
        { months: 11, profit: 0.55, advance: 0.28 },
        { months: 12, profit: 0.60, advance: 0.25 },
        { months: 18, profit: 0.75, advance: 0.25 },
        { months: 24, profit: 0.90, advance: 0.25 },
      ];
    }

    const calculated = plans.map(p => {
      const adv = roundUp(price * p.advance);
      const rem = price - adv;
      const profit = roundUp(rem * p.profit);
      const total = rem + profit;
      const monthly = roundUp(total / p.months);
      const fullTotal = adv + (monthly * p.months);
      return { ...p, advanceAmount: adv, monthlyAmount: monthly, totalPrice: fullTotal };
    });

    setCalcResults(calculated);
  };

  // Filter channels based on role
  // Sales Officer (8): WhatsApp, Referral, Call
  // Outlet User (5): Referral, Branch
  // Admin (4): Own
  // Form Analyzer (9): WhatsApp, Referral
  const getFilteredChannels = () => {
    const defaultChannels = [
      { id: 'website', name: 'Website', icon: Globe, description: 'Website orders' },
      { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, description: 'WhatsApp messages' },
      { id: 'branch', name: 'Branch', icon: Building, description: 'Physical branches' },
      { id: 'referral', name: 'Referral', icon: Users, description: 'Customer referrals' },
      { id: 'call', name: 'Call', icon: Phone, description: 'Phone calls' },
      { id: 'own', name: 'Own', icon: Building, description: 'Admin own orders' },
    ];

    const roleId = Number(user?.role_id);
    if (roleId === 8 || roleId === 3) { // SO or RO
      return defaultChannels.filter(c => ['whatsapp', 'referral', 'call'].includes(c.id));
    }
    if (roleId === 5) { // Outlet User
      return defaultChannels.filter(c => ['referral', 'branch'].includes(c.id));
    }
    if (roleId === 4) { // Admin
      return defaultChannels.filter(c => ['own'].includes(c.id));
    }
    if (roleId === 9) { // Form Analyzer
      return defaultChannels.filter(c => ['whatsapp', 'referral'].includes(c.id));
    }
    return defaultChannels.filter(c => ['website', 'whatsapp', 'branch', 'referral'].includes(c.id)); // Default
  };

  const channels = getFilteredChannels();

  const genderOptions = ['Male', 'Female', 'Unidentified'];
  const maritalOptions = ['Single', 'Married', 'Divorced', 'Widowed'];
  const residentialOptions = ['Own', 'Rented', 'With Family'];

  // Get all areas for Karachi (since city is fixed)
  const karachiData = addressHierarchy.find(c => c.name === 'Karachi');
  const allKarachiAreas = karachiData ? karachiData.zones.flatMap((z: any) => z.areas.map((a: any) => ({ ...a, zoneName: z.name }))) : [];

  const handleAreaSelect = (area: any) => {
    setFormData(prev => ({ 
      ...prev, 
      area: area.name, 
      zone: area.zoneName 
    }));
    setAreaSearchTerm(area.name);
    setIsAreaDropdownOpen(false);
    if (errors.area) setErrors(prev => ({ ...prev, area: '' }));
    if (errors.zone) setErrors(prev => ({ ...prev, zone: '' }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    setSelectedPlan(null);
    setFormData(prev => ({ ...prev, product_name: product.name }));
    setProductSearchTerm(product.name);
    setIsProductDropdownOpen(false);
    if (errors.product) setErrors(prev => ({ ...prev, product: '' }));
  };

  const generateLedger = (monthly: number, months: number) => {
    const schedule = [];
    const today = new Date();
    for (let i = 1; i <= months; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i);
      schedule.push({
        month: i,
        date: dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        amount: monthly
      });
    }
    return schedule;
  };

  useEffect(() => {
    if (selectedPlan && advanceOverride !== '') {
      const newAdvance = Number(advanceOverride);
      // Valid range: [plan.advance, plan.totalPrice)
      if (newAdvance >= selectedPlan.advance && newAdvance < selectedPlan.totalPrice) {
        const remaining = selectedPlan.totalPrice - newAdvance;
        const newMonthly = roundUp(remaining / selectedPlan.months);
        
        setFormData(prev => ({
          ...prev,
          advance_amount: newAdvance.toString(),
          monthly_amount: newMonthly.toString(),
        }));
        
        setLedger(generateLedger(newMonthly, selectedPlan.months));
      } else if (newAdvance >= selectedPlan.totalPrice) {
        // If it exceeds total, we zero out the monthly but form validation will block it
        setFormData(prev => ({
          ...prev,
          advance_amount: newAdvance.toString(),
          monthly_amount: '0',
        }));
        setLedger([]);
      }
    }
  }, [advanceOverride, selectedPlan]);

  // Handle auto-recalculation for Custom Products when linked to Calculator
  useEffect(() => {
    if (isCustomProduct && !isCustomProductNoPricing) {
      const price = parseFloat(customCashPrice);
      const months = parseInt(customMonths);
      const category = customCategory;

      if (!isNaN(price) && months && category) {
        const cat = category.toLowerCase().trim();
        let plan = null;

        // Formula logic for custom product calculation
        if (cat === 'mobiles' && price <= 50000) {
          const plans = [
            { months: 3, profit: 0.20, advance: 0.35 },
            { months: 6, profit: 0.35, advance: 0.25 },
            { months: 9, profit: 0.45, advance: 0.20 },
            { months: 11, profit: 0.52, advance: 0.18 },
            { months: 12, profit: 0.55, advance: 0.15 },
          ];
          plan = plans.find(p => p.months === months);
        } else if (price > 50000 && price <= 100000) {
          const plans = [
            { months: 3, profit: 0.20, advance: 0.40 },
            { months: 6, profit: 0.35, advance: 0.35 },
            { months: 9, profit: 0.45, advance: 0.30 },
            { months: 11, profit: 0.52, advance: 0.28 },
            { months: 12, profit: 0.55, advance: 0.25 },
          ];
          plan = plans.find(p => p.months === months);
        } else if (price > 100000) {
          const plans = [
            { months: 3, profit: 0.20, advance: 0.40 },
            { months: 6, profit: 0.35, advance: 0.35 },
            { months: 9, profit: 0.45, advance: 0.30 },
            { months: 11, profit: 0.52, advance: 0.28 },
            { months: 12, profit: 0.55, advance: 0.25 },
            { months: 18, profit: 0.70, advance: 0.25 },
            { months: 24, profit: 0.85, advance: 0.25 },
          ];
          plan = plans.find(p => p.months === months);
        } else {
          const plans = [
            { months: 3, profit: 0.22, advance: 0.40 },
            { months: 6, profit: 0.38, advance: 0.35 },
            { months: 9, profit: 0.48, advance: 0.30 },
            { months: 11, profit: 0.55, advance: 0.28 },
            { months: 12, profit: 0.60, advance: 0.25 },
            { months: 18, profit: 0.75, advance: 0.25 },
            { months: 24, profit: 0.90, advance: 0.25 },
          ];
          plan = plans.find(p => p.months === months);
        }

        if (plan) {
          const adv = roundUp(price * plan.advance);
          const rem = price - adv;
          const profit = roundUp(rem * plan.profit);
          const total = rem + profit;
          const monthly = roundUp(total / plan.months);
          const fullTotal = adv + (monthly * plan.months);

          setFormData(prev => ({
            ...prev,
            total_amount: fullTotal.toString(),
            advance_amount: adv.toString(),
            monthly_amount: monthly.toString(),
            months: months.toString()
          }));
          setActiveCustomPlan({ cashPrice: price, months, profit: plan.profit });
        }
      }
    }
  }, [customCashPrice, customCategory, customMonths, isCustomProduct, isCustomProductNoPricing]);

  // Handle Advance override recalculation for custom products
  useEffect(() => {
    if (isCustomProduct && activeCustomPlan && !isCustomProductNoPricing && formData.advance_amount !== '') {
      const { cashPrice, months, profit } = activeCustomPlan;
      const newAdv = parseFloat(formData.advance_amount);

      if (!isNaN(newAdv) && newAdv >= 0 && newAdv < cashPrice) {
        const rem = cashPrice - newAdv;
        const profitAmount = roundUp(rem * profit);
        const total = rem + profitAmount;
        const newMonthly = roundUp(total / months);

        setFormData(prev => ({
          ...prev,
          monthly_amount: newMonthly.toString()
        }));
      }
    }
  }, [formData.advance_amount]);

  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan);
    setAdvanceOverride(plan.advance);
    setLedger(generateLedger(plan.monthlyAmount, plan.months));
    setFormData(prev => ({
      ...prev,
      total_amount: plan.totalPrice.toString(),
      advance_amount: plan.advance.toString(),
      monthly_amount: plan.monthlyAmount.toString(),
      months: plan.months.toString(),
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name.trim()) newErrors.customer_name = 'Customer name is required';
    if (!formData.whatsapp_number.trim() || !/^0[0-9]{10}$/.test(formData.whatsapp_number.replace(/\s+/g, ''))) {
      newErrors.whatsapp_number = 'WhatsApp number must be 11 digits and start with 0';
    }

    if (isManualAddress) {
      if (!formData.address.trim()) newErrors.address = 'Address is required';
    } else {
      if (!formData.area) newErrors.area = 'Area is required';
      // Zone auto-filled from Area
    }

    if (!formData.city) newErrors.city = 'City is required';

    if (!formData.gender) newErrors.gender = 'Gender is required';
    // Marital and Residential now optional as per user request

    if (!isCustomProduct) {
      if (!selectedProduct) newErrors.product = 'Product is required';
      if (!selectedPlan) newErrors.plan = 'Installment plan is required';
      if (selectedPlan && advanceOverride !== '' && Number(advanceOverride) < selectedPlan.advance) {
        newErrors.advance_amount = `Advance cannot be less than Rs. ${selectedPlan.advance.toLocaleString()}`;
        toast.error(newErrors.advance_amount);
      } else if (selectedPlan && advanceOverride !== '' && Number(advanceOverride) >= selectedPlan.totalPrice) {
        newErrors.advance_amount = `Advance cannot be equal to or greater than the total price (Rs. ${selectedPlan.totalPrice.toLocaleString()})`;
        toast.error(newErrors.advance_amount);
      }
    } else {
      if (!formData.product_name.trim()) newErrors.product_name = 'Product name is required';
      
      if (!isCustomProductNoPricing) {
        if (!formData.total_amount || isNaN(Number(formData.total_amount))) newErrors.total_amount = 'Total amount is required';
        if (!formData.advance_amount || isNaN(Number(formData.advance_amount))) newErrors.advance_amount = 'Advance amount is required';
        if (!formData.monthly_amount || isNaN(Number(formData.monthly_amount))) newErrors.monthly_amount = 'Monthly amount is required';
        if (!formData.months || isNaN(Number(formData.months))) newErrors.months = 'Months is required';
      }
    }
    if (!formData.channel) newErrors.channel = 'Channel is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if customer or alternate contact is blacklisted
    const isBlacklisted = phoneMatches.some((m: any) => m.is_blacklisted === true) || altPhoneMatches.some((m: any) => m.is_blacklisted === true);
    if (isBlacklisted) {
      toast.error("Order cannot be placed. Customer or alternate contact is blacklisted!", {
        duration: 5000,
        icon: '🚫'
      });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      if (!token) throw new Error("No authentication token found");

      // Construct address if not manual
      let submissionAddress = formData.address.trim();
      if (!isManualAddress) {
        const parts = [
          formData.house_no,
          formData.street,
          formData.block,
          formData.area,
          formData.zone
        ].filter(p => p && p.trim() !== '');
        submissionAddress = parts.join(', ');
      }

      const payload = {
        customer_name: formData.customer_name.trim(),
        whatsapp_number: formData.whatsapp_number.trim(),
        alternate_contact: formData.alternate_contact.trim() || null,
        address: submissionAddress,
        city: formData.city,
        area: formData.area,
        zone: formData.zone,
        block: formData.block,
        street: formData.street,
        house_no: formData.house_no,
        gender: formData.gender,
        marital_status: formData.marital_status || null,
        residential_type: formData.residential_type || null,
        product_name: formData.product_name.trim(),
        // If no pricing, send 0 to maintain schema consistency
        total_amount: isCustomProductNoPricing ? '0' : formData.total_amount,
        advance_amount: isCustomProductNoPricing ? '0' : formData.advance_amount,
        monthly_amount: isCustomProductNoPricing ? '0' : formData.monthly_amount,
        months: isCustomProductNoPricing ? '0' : formData.months,
        channel: formData.channel,
        order_notes: formData.order_notes.trim() || null,
      };

      const response = await fetch(`${BACKEND_URL}/api/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error?.message || 'Failed to create order');

      toast.success(`Order created successfully! Token: ${result.data.order.token_number}`);

      // Reset form
      setFormData({
        customer_name: '', whatsapp_number: '', alternate_contact: '', address: '', city: 'Karachi', area: '',
        zone: '', block: '', street: '', house_no: '',
        gender: '', marital_status: '', residential_type: '',
        product_name: '', total_amount: '', advance_amount: '', monthly_amount: '', months: '', channel: '',
        order_notes: ''
      });
      setIsManualAddress(false);
      setIsCustomProduct(false);
      setIsCustomProductNoPricing(false);
      setSelectedProduct(null);
      setSelectedPlan(null);
      setAdvanceOverride('');
      setLedger([]);
      setAreaSearchTerm('');
      setProductSearchTerm('');
      setCustomCashPrice('');
      setCustomCategory('');
      setCustomMonths('');
      setPhoneMatches([]);
      setErrors({});

    } catch (error: any) {
      toast.error(error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[970px]">

        <div className="bg-white rounded-xl shadow-sm p-8">

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* ────────────────────────────────────────────────
                Customer Information (with new fields)
            ──────────────────────────────────────────────── */}
            {/* ────────────────────────────────────────────────
                Customer Information
            ──────────────────────────────────────────────── */}
            <section className="border-b pb-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-red-50 rounded-lg">
                  <UserIcon className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Customer Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                  <input
                    ref={nameRef}
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-red-100 outline-none transition-all ${errors.customer_name ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-red-500'}`}
                    placeholder="Enter customer's full name"
                  />
                  {errors.customer_name && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.customer_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp Number <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      ref={whatsappRef}
                      type="tel"
                      name="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-red-100 outline-none transition-all ${errors.whatsapp_number ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-red-500'}`}
                      placeholder="03001234567"
                    />
                    {checkingPhone && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>}
                  </div>
                  {errors.whatsapp_number && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.whatsapp_number}</p>}
                  
                  {phoneMatches.length > 0 && (
                    <div className="mt-4 bg-white border-2 border-red-100 rounded-2xl shadow-lg shadow-red-100/50 overflow-hidden animate-in zoom-in-95 duration-300">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4" /> 
                          Existing Records Found ({phoneMatches.length})
                        </div>
                      </div>
                      <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                        <div className="divide-y divide-red-50">
                          {phoneMatches.map((m: any) => (
                            <div key={m.id} className="p-3 hover:bg-red-50/30 transition-colors group">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-gray-900 group-hover:text-red-600 transition-colors">{m.order_ref}</span>
                                    {m.is_blacklisted ? (
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-150 text-red-700 border border-red-200 animate-pulse">
                                        Blacklisted
                                      </span>
                                    ) : (
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        m.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                        m.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                                        'bg-amber-100 text-amber-700'
                                      }`}>
                                        {m.status}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-500 font-medium">
                                    Customer: <span className="text-gray-900">{m.customer_name}</span>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg uppercase border border-red-100 shadow-sm">
                                    {m.role}
                                  </div>
                                  <p className="text-[9px] text-gray-400 mt-1 font-bold">
                                    {new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </p>
                                </div>
                              </div>
                              <a 
                                href={`/orders/${m.id}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="mt-2 block text-[10px] text-blue-600 hover:text-blue-800 font-bold underline decoration-dotted underline-offset-2"
                              >
                                View Order Details
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {phoneMatches.some((m: any) => m.is_blacklisted === true) && (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-bounce" />
                      <div>
                        <h4 className="text-sm font-black text-red-800 uppercase tracking-wide">CRITICAL: Customer Blacklisted</h4>
                        <p className="text-xs text-red-600 font-bold mt-1">This user is marked as blacklisted in the system. Placing any new orders for them is strictly disabled.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Alternate Contact <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="alternate_contact"
                      value={formData.alternate_contact}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none transition-all"
                      placeholder="Secondary contact number"
                    />
                    {checkingAltPhone && <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>}
                  </div>

                  {altPhoneMatches.length > 0 && (
                    <div className="mt-4 bg-white border-2 border-red-100 rounded-2xl shadow-lg shadow-red-100/50 overflow-hidden animate-in zoom-in-95 duration-300">
                      <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4" /> 
                          Existing Records Found for Alternate Number ({altPhoneMatches.length})
                        </div>
                      </div>
                      <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                        <div className="divide-y divide-red-50">
                          {altPhoneMatches.map((m: any) => (
                            <div key={m.id} className="p-3 hover:bg-red-50/30 transition-colors group">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-gray-900 group-hover:text-red-600 transition-colors">{m.order_ref}</span>
                                    {m.is_blacklisted ? (
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-red-150 text-red-700 border border-red-200 animate-pulse">
                                        Blacklisted
                                      </span>
                                    ) : (
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                        m.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                        m.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                                        'bg-amber-100 text-amber-700'
                                      }`}>
                                        {m.status}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-500 font-medium">
                                    Customer: <span className="text-gray-900">{m.customer_name}</span>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-lg uppercase border border-red-100 shadow-sm">
                                    {m.role}
                                  </div>
                                  <p className="text-[9px] text-gray-400 mt-1 font-bold">
                                    {new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {altPhoneMatches.some((m: any) => m.is_blacklisted === true) && (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-bounce" />
                      <div>
                        <h4 className="text-sm font-black text-red-800 uppercase tracking-wide">CRITICAL: Alternate Contact Blacklisted</h4>
                        <p className="text-xs text-red-600 font-bold mt-1">This alternate contact number is marked as blacklisted in the system. Placing any new orders for them is strictly disabled.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gender <span className="text-red-500">*</span></label>
                  <select
                    ref={genderRef}
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-red-100 outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center] ${errors.gender ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-red-500'}`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                  >
                    <option value="">Select Gender</option>
                    {genderOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {errors.gender && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.gender}</p>}
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────
                Address Information
            ──────────────────────────────────────────────── */}
            <section className="border-b pb-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Address & Location</h2>
                </div>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${isManualAddress ? 'bg-red-500' : 'bg-gray-200'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isManualAddress ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    checked={isManualAddress}
                    onChange={(e) => setIsManualAddress(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-red-600 transition-colors">Manual Address Entry</span>
                </label>
              </div>

              {isManualAddress ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      value="Karachi"
                      disabled
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Address <span className="text-red-500">*</span></label>
                    <input
                      ref={addressRef}
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-red-100 outline-none transition-all ${errors.address ? 'border-red-500' : 'border-gray-200 focus:border-red-500'}`}
                      placeholder="Block, Street, House No, Landmark etc."
                    />
                    {errors.address && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.address}</p>}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-medium">
                      Karachi
                    </div>
                  </div>

                  {/* Searchable Area Select */}
                  <div className="relative" ref={areaDropdownRef}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Search Area <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search area (e.g. North Nazimabad)"
                        value={areaSearchTerm}
                        onChange={(e) => {
                          setAreaSearchTerm(e.target.value);
                          setIsAreaDropdownOpen(true);
                        }}
                        onFocus={() => setIsAreaDropdownOpen(true)}
                        className={`w-full pl-11 pr-10 py-3 border rounded-xl focus:ring-4 focus:ring-red-100 outline-none transition-all ${errors.area ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-red-500'}`}
                      />
                      <button 
                        type="button"
                        onClick={() => setIsAreaDropdownOpen(!isAreaDropdownOpen)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isAreaDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isAreaDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
                        {allKarachiAreas.filter((a: any) => a.name.toLowerCase().includes(areaSearchTerm.toLowerCase())).length > 0 ? (
                          allKarachiAreas
                            .filter((a: any) => a.name.toLowerCase().includes(areaSearchTerm.toLowerCase()))
                            .map((area: any) => (
                              <button
                                key={area.id}
                                type="button"
                                onClick={() => handleAreaSelect(area)}
                                className={`w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center justify-between group ${formData.area === area.name ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-700'}`}
                              >
                                <div>
                                  <div className="truncate">{area.name}</div>
                                </div>
                                {formData.area === area.name && <Check className="w-4 h-4" />}
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-8 text-center text-gray-500">
                            <Search className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                            <p className="text-sm">No areas found for "{areaSearchTerm}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Zone (Auto-detected)</label>
                    <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-medium italic">
                      {formData.zone || 'Select area to detect zone'}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ────────────────────────────────────────────────
                Product & Installment Plan
            ──────────────────────────────────────────────── */}
            <section className="border-b pb-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Product & Plan</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-all font-semibold text-sm border border-indigo-100 shadow-sm"
                  >
                    <Calculator className="w-4 h-4" />
                    Installment Calculator
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer group border-l pl-4 border-gray-100">
                  <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${isCustomProduct ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isCustomProduct ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <input
                    type="checkbox"
                    checked={isCustomProduct}
                    onChange={(e) => {
                      setIsCustomProduct(e.target.checked);
                      setActiveCustomPlan(null);
                      if (e.target.checked) {
                        setSelectedProduct(null);
                        setSelectedPlan(null);
                        setProductSearchTerm('');
                        setFormData(prev => ({ ...prev, product_name: '', total_amount: '', advance_amount: '', monthly_amount: '', months: '' }));
                      }
                    }}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">Custom Product Entry</span>
                </label>
              </div>
            </div>

            {isCustomProduct ? (
                <div className="space-y-8 p-6 bg-gray-50/50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Custom Product Specification</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!isCustomProductNoPricing}
                        onChange={(e) => setIsCustomProductNoPricing(!e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-600">Include Custom Pricing</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Product Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="product_name"
                        value={formData.product_name}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none transition-all ${errors.product_name ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'}`}
                        placeholder="e.g. iPhone 15 Pro Max 256GB"
                      />
                      {errors.product_name && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.product_name}</p>}
                    </div>

                    {!isCustomProductNoPricing && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Interactive Calculator Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Cash Price <span className="text-red-500">*</span></label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Rs.</span>
                              <input
                                type="number"
                                value={customCashPrice}
                                onChange={(e) => setCustomCashPrice(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                                placeholder="Enter cash price"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Category <span className="text-red-500">*</span></label>
                            <select
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center]"
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                            >
                              <option value="">Select Category</option>
                              {allCategories.map((cat: any) => <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Months <span className="text-red-500">*</span></label>
                            <select
                              value={customMonths}
                              onChange={(e) => setCustomMonths(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none bg-no-repeat bg-[right_1rem_center]"
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
                            >
                              <option value="">Duration</option>
                              {[3, 6, 9, 11, 12, 18, 24].map((m: any) => <option key={m} value={m}>{m} Months</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Calculated Results (Read-only total, Editable advance) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Total Amount</label>
                            <div className="px-4 py-3 bg-white border border-gray-100 rounded-xl text-blue-900 font-black">
                              Rs. {Number(formData.total_amount || 0).toLocaleString()}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Advance Amount <span className="text-red-500">*</span></label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Rs.</span>
                              <input
                                type="number"
                                name="advance_amount"
                                value={formData.advance_amount}
                                onChange={handleChange}
                                className={`w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none transition-all ${errors.advance_amount ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500 font-bold'}`}
                                placeholder="0"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Monthly Installment</label>
                            <div className="px-4 py-3 bg-white border border-gray-100 rounded-xl text-emerald-600 font-black">
                              Rs. {Number(formData.monthly_amount || 0).toLocaleString()}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5">Selected Months</label>
                            <div className="px-4 py-3 bg-white border border-gray-100 rounded-xl text-gray-700 font-bold">
                              {formData.months || '0'} Months
                            </div>
                          </div>
                        </div>
                        {errors.total_amount && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.total_amount}</p>}
                        {errors.advance_amount && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.advance_amount}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="relative" ref={productDropdownRef}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Search & Select Product <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Type product name (e.g. Samsung S23)"
                        value={productSearchTerm}
                        onChange={(e) => {
                          setProductSearchTerm(e.target.value);
                          setIsProductDropdownOpen(true);
                        }}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        className={`w-full pl-11 pr-10 py-3.5 border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none transition-all ${errors.product ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'}`}
                      />
                      <button 
                        type="button"
                        onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {isProductDropdownOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                        <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b text-[10px] font-bold text-gray-500 uppercase tracking-widest flex justify-between items-center">
                          <span>Search Results</span>
                          <button onClick={() => setIsProductDropdownOpen(false)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                        </div>
                        {products.filter((p: any) => p.name.toLowerCase().includes(productSearchTerm.toLowerCase())).length > 0 ? (
                          products
                            .filter((p: any) => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
                            .map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleProductSelect(p)}
                                className={`w-full px-4 py-3.5 text-left hover:bg-blue-50 transition-colors flex items-center justify-between group border-b border-gray-50 last:border-0 ${formData.product_name === p.name ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}`}
                              >
                                <div>
                                  <div className="truncate">{p.name}</div>
                                  <div className="text-[10px] text-gray-400 font-normal uppercase tracking-wider">{p.category_name} &bull; {p.subcategory_name}</div>
                                </div>
                                {formData.product_name === p.name && <Check className="w-4 h-4" />}
                              </button>
                            ))
                        ) : (
                          <div className="px-4 py-12 text-center text-gray-500">
                            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                            <p className="font-medium text-gray-400">No products found for "{productSearchTerm}"</p>
                          </div>
                        )}
                      </div>
                    )}
                    {errors.product && <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.product}</p>}
                  </div>

                  {selectedProduct && (
                    <div className="animate-in fade-in duration-500">
                      <div className="flex items-center gap-2 mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Available Plans</h3>
                        {selectedProduct.isDeal && (
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                            HOT DEAL
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {selectedProduct.ProductInstallments
                          ?.filter((p: any) => p.isActive)
                          .map((plan: any) => (
                            <label
                              key={plan.id}
                              className={`group relative p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 ${selectedPlan?.id === plan.id
                                ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-50 shadow-lg scale-[1.02]'
                                : plan.dealId
                                  ? 'border-red-200 bg-red-50/30 hover:border-red-400'
                                  : 'border-gray-100 bg-white hover:border-blue-300 hover:shadow-md'
                                }`}
                            >
                              {plan.dealId && (
                                <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[9px] font-bold px-3 py-1 rounded-full shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                                  SPECIAL PRICE
                                </div>
                              )}

                              <input
                                type="radio"
                                name="plan"
                                checked={selectedPlan?.id === plan.id}
                                onChange={() => handlePlanSelect(plan)}
                                className="sr-only"
                              />
                              <div className="text-center space-y-3">
                                <div className={`text-2xl font-black ${selectedPlan?.id === plan.id ? 'text-blue-700' : 'text-gray-800'}`}>
                                  {plan.months} <span className="text-sm font-bold uppercase">Months</span>
                                </div>
                                <hr className={`w-12 mx-auto border-t-2 ${selectedPlan?.id === plan.id ? 'border-blue-200' : 'border-gray-100'}`} />
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Advance</span>
                                    <span className="font-bold text-gray-700">Rs. {plan.advance.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-400">Monthly</span>
                                    <span className="font-bold text-gray-700">Rs. {plan.monthlyAmount.toLocaleString()}</span>
                                  </div>
                                  <div className={`mt-3 py-2 rounded-lg font-bold text-sm ${selectedPlan?.id === plan.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 transition-colors'}`}>
                                    Rs. {plan.totalPrice.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </label>
                          ))}
                      </div>

                      {selectedPlan && (
                        <div className="mt-10 p-8 bg-blue-50/50 rounded-3xl border-2 border-blue-100 animate-in fade-in slide-in-from-top-4 duration-500">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            {/* Advance Customization */}
                            <div className="space-y-4">
                              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest flex items-center gap-2">
                                <Calculator className="w-4 h-4" />
                                Customize Advance
                              </h3>
                              <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-sm">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Edit Advance (Min: Rs. {selectedPlan.advance.toLocaleString()})</label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rs.</span>
                                  <input
                                    type="number"
                                    value={advanceOverride}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? '' : Number(e.target.value);
                                      setAdvanceOverride(val);
                                    }}
                                    onBlur={() => {
                                      // No longer resetting automatically as per user request
                                    }}
                                    className={`w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-xl focus:ring-4 outline-none transition-all text-2xl font-black ${advanceOverride !== '' && Number(advanceOverride) < selectedPlan.advance ? 'border-red-500 text-red-600 focus:ring-red-100' : 'border-gray-100 text-blue-950 focus:ring-blue-100 focus:border-blue-600'}`}
                                  />
                                </div>
                                {advanceOverride !== '' && Number(advanceOverride) < selectedPlan.advance && (
                                  <p className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1 animate-pulse">
                                    <AlertCircle className="w-3 h-3" /> Advance cannot be less than original plan (Rs. {selectedPlan.advance.toLocaleString()})
                                  </p>
                                )}
                                {advanceOverride !== '' && Number(advanceOverride) >= selectedPlan.totalPrice && (
                                  <p className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1 animate-pulse">
                                    <AlertCircle className="w-3 h-3" /> Advance cannot exceed total price (Rs. {selectedPlan.totalPrice.toLocaleString()})
                                  </p>
                                )}
                                <p className="mt-3 text-[11px] text-blue-600 font-medium italic select-none">&bull; Increasing advance will automatically decrease your monthly installment.</p>
                              </div>
                            </div>
                      
                            {/* Summary Chips */}
                            <div className="grid grid-cols-2 gap-4 h-full">
                              <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center min-h-[140px]">
                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1 select-none">New Monthly</div>
                                  <div className="text-2xl font-black text-blue-700">Rs. {Number(formData.monthly_amount).toLocaleString()}</div>
                              </div>
                              <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center min-h-[140px]">
                                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-1 select-none">Total Duration</div>
                                  <div className="text-2xl font-black text-gray-800">{selectedPlan.months} Months</div>
                              </div>
                            </div>
                          </div>
                      
                          {/* Monthly Ledger Table */}
                          <div className="mt-8">
                            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Users className="w-4 h-4 text-blue-600" />
                              Monthly Installment Ledger
                            </h3>
                            <div className="bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
                              <table className="w-full text-left">
                                <thead className="bg-gray-100 text-gray-600 text-[10px] uppercase tracking-widest font-bold">
                                  <tr>
                                    <th className="px-6 py-4">Inst. No</th>
                                    <th className="px-6 py-4">Expected Due Date</th>
                                    <th className="px-6 py-4 text-right">Amount (PKR)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {ledger.map((item) => (
                                    <tr key={item.month} className="hover:bg-blue-50/30 transition-colors">
                                      <td className="px-6 py-4">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600">
                                          #{item.month}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-[13px] font-semibold text-gray-700">{item.date}</td>
                                      <td className="px-6 py-4 text-sm font-black text-gray-900 text-right">Rs. {item.amount.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                      {errors.plan && <p className="text-red-500 text-xs mt-4 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {errors.plan}</p>}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ────────────────────────────────────────────────
                Order Channel & Notes
            ──────────────────────────────────────────────── */}
            <section ref={channelRef} className="pb-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Globe className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Order Channel & Source</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {channels.map((ch: any) => {
                  const Icon = ch.icon;
                  return (
                    <label
                      key={ch.id}
                      className={`relative flex flex-col items-center justify-center p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 group ${formData.channel === ch.id
                        ? 'border-purple-600 bg-purple-50 ring-4 ring-purple-50 scale-[1.02]'
                        : 'border-gray-100 bg-white hover:border-purple-300 hover:shadow-lg'
                        }`}
                    >
                      <input
                        type="radio"
                        name="channel"
                        value={ch.id}
                        checked={formData.channel === ch.id}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <Icon className={`w-8 h-8 mb-3 transition-colors ${formData.channel === ch.id ? 'text-purple-600' : 'text-gray-400 group-hover:text-purple-400'}`} />
                      <div className={`font-bold text-sm text-center ${formData.channel === ch.id ? 'text-purple-700' : 'text-gray-600'}`}>{ch.name}</div>
                      {formData.channel === ch.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="w-4 h-4 text-purple-600" />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
              {errors.channel && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {errors.channel}</p>}


              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Internal Order Notes <span className="text-gray-400 font-normal">(Optional)</span></label>
                <textarea
                  name="order_notes"
                  value={formData.order_notes}
                  onChange={(e: any) => handleTextAreaChange(e)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all resize-none"
                  placeholder="Add any specific instructions, special cases, or context for verification team..."
                />
              </div>
            </section>

            {/* ────────────────────────────────────────────────
                Actions
            ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-4 pt-8">
              <button
                type="submit"
                disabled={loading || phoneMatches.some((m: any) => m.is_blacklisted === true) || altPhoneMatches.some((m: any) => m.is_blacklisted === true)}
                className="flex-[2] bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 hover:shadow-xl hover:shadow-red-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
              >
                {loading ? (
                  <>
                    <span className="animate-spin h-5 w-5 border-3 border-white border-t-transparent rounded-full font-bold"></span>
                    Processing Order...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    Finalize Order Booking
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData({
                    customer_name: '', whatsapp_number: '', alternate_contact: '', address: '', city: 'Karachi', area: '',
                    zone: '', block: '', street: '', house_no: '',
                    gender: '', marital_status: '', residential_type: '',
                    product_name: '', total_amount: '', advance_amount: '', monthly_amount: '', months: '', channel: '',
                    order_notes: ''
                  });
                  setAreaSearchTerm('');
                  setProductSearchTerm('');
                  setSelectedProduct(null);
                  setSelectedPlan(null);
                  setAdvanceOverride('');
                  setLedger([]);
                  setErrors({});
                }}
                className="flex-1 px-6 py-4 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 hover:text-gray-700 transition-all"
              >
                Clear Form
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ────────────────────────────────────────────────
          Installment Calculator Modal (Slide-over style)
      ──────────────────────────────────────────────── */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCalculatorOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 sm:pl-16">
            <div className="w-screen max-w-xl animate-in slide-in-from-right duration-500">
              <div className="h-full flex flex-col bg-white shadow-2xl overflow-y-auto rounded-l-3xl">
                <div className="px-6 py-8 border-b bg-indigo-600 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl">
                        <Calculator className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Installment Calculator</h2>
                        <p className="text-indigo-100 text-xs">Official Marking logic</p>
                      </div>
                    </div>
                    <button onClick={() => setIsCalculatorOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {/* Category Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Product Category</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {['Mobiles', 'Laptops', 'Led Tv', 'Refrigerator', 'Washing Machine', 'Air Conditionar', 'Small Appliances', 'Microwave Oven', 'Water Dispenser', 'Fans', 'Bikes', 'Deep Freezer', 'Batteries', 'Mattress', 'Tyres', 'Smart Watches', 'Tablet', 'Solar'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCalcCategory(cat);
                            if (calcPrice) calculateInstallments(cat, parseFloat(calcPrice));
                          }}
                          className={`px-3 py-3 text-[11px] font-bold rounded-xl border transition-all ${calcCategory === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-indigo-200'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Product Price (Net Cash)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rs.</span>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={calcPrice}
                        onChange={(e) => {
                          setCalcPrice(e.target.value);
                          if (calcCategory) calculateInstallments(calcCategory, parseFloat(e.target.value) || 0);
                        }}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition-all text-xl font-bold text-gray-800"
                      />
                    </div>
                  </div>

                  {/* Results Table */}
                  {calcResults.length > 0 ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Matched Plans</h3>
                      <div className="grid gap-4">
                        {calcResults.map((plan, idx) => (
                          <div 
                            key={idx} 
                            className="bg-white border-2 border-gray-50 rounded-2xl p-5 hover:border-indigo-600 transition-all group relative overflow-hidden"
                          >
                            <div className="flex justify-between items-center relative z-10">
                              <div>
                                <div className="text-xs font-bold text-indigo-600 uppercase mb-1">{plan.months} Months Plan</div>
                                <div className="text-2xl font-black text-gray-900 leading-none">Rs. {plan.monthlyAmount.toLocaleString()} <span className="text-xs font-medium text-gray-400">/ month</span></div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Advance Needed</div>
                                <div className="text-lg font-bold text-gray-800 leading-none">Rs. {plan.advanceAmount.toLocaleString()}</div>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-[11px] font-bold text-gray-400">
                                <div>Markup: {(plan.profit * 100).toFixed(0)}% &bull; Total: Rs. {plan.totalPrice.toLocaleString()}</div>
                                <button 
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      product_name: `Custom ${calcCategory} Product`,
                                      total_amount: plan.totalPrice.toString(), // Store total price including profit
                                      advance_amount: plan.advanceAmount.toString(),
                                      monthly_amount: plan.monthlyAmount.toString(),
                                      months: plan.months.toString()
                                    }));
                                    setActiveCustomPlan({
                                      cashPrice: parseFloat(calcPrice) || 0,
                                      months: plan.months,
                                      profit: plan.profit
                                    });
                                    setIsCustomProduct(true);
                                    setIsCalculatorOpen(false);
                                    toast.success("Plan applied to form!");
                                  }}
                                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                                >
                                  Apply Plan
                                </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : calcPrice && (
                    <div className="p-12 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                       <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                       <p className="text-gray-400 font-medium italic">Please select a category to see plans</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrders;
