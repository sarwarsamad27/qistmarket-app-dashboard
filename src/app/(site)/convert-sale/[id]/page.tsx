'use client'

import React, { useState, useEffect, useRef } from 'react';
import { use } from 'react';
import { 
  ShoppingBag, Search, ChevronDown, Check, X, Phone, User as UserIcon, MapPin,
  AlertCircle, Send, ShieldCheck, ArrowRight,
  ClipboardList, UserCheck, Camera,
  TrendingUp, RotateCcw, Lock
} from 'lucide-react';
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../../contexts/AuthContext";
import Loader from "@/components/common/Loader";
import { useInstallmentFormula, calculateInstallmentPlans, roundAmount } from "@/lib/emiCalculator";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const ConvertSalePage = ({ params }: { params: Promise<{ id: string }> }) => {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  const { user } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Selection States
  const [isChangingPurchase, setIsChangingPurchase] = useState(false);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  
  // Data States
  const [products, setProducts] = useState<any[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  
  // Form States
  const [oldOrder, setOldOrder] = useState<any>(null);
  const [orderData, setOrderData] = useState<any>({ outlet_id: '' });
  const [purchaserData, setPurchaserData] = useState<any>({});
  const [grantorsData, setGrantorsData] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any>({ purchaser: null, grantors: [] });
  
  // Pricing/Ledger States
  const [ledger, setLedger] = useState<any[]>([]);
  const [advanceOverride, setAdvanceOverride] = useState<number | ''>('');
  
  // MULTI-OTP States
  const [verificationSteps, setVerificationSteps] = useState<any[]>([
    { type: 'purchaser', phone: '', name: '', status: 'idle', otp: '' },
    { type: 'grantor', phone: '', name: '', status: 'locked', otp: '' },
    { type: 'grantor', phone: '', name: '', status: 'locked', otp: '' }
  ]);
  const [otpLoading, setOtpLoading] = useState(false);

  const productDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = Cookies.get("auth_token");
        if (!token) return;
        
        const orderResp = await fetch(`${BACKEND_URL}/api/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const orderJson = await orderResp.json();
        
        if (orderJson.success) {
          const o = orderJson.data.order;
          setOldOrder(o);
          
          setOrderData({
            customer_name: o.customer_name || '',
            whatsapp_number: o.whatsapp_number || '',
            alternate_contact: o.alternate_contact || '',
            address: o.address || '',
            city: o.city || '',
            area: o.area || '',
            zone: o.zone || '',
            block: o.block || '',
            street: o.street || '',
            house_no: o.house_no || '',
            gender: o.gender || '',
            marital_status: o.marital_status || '',
            residential_type: o.residential_type || '',
            product_name: o.product_name, 
            total_amount: o.total_amount,
            advance_amount: o.advance_amount,
            monthly_amount: o.monthly_amount,
            months: o.months,
            channel: 'Repeat Customer',
            // Pre-select the branch the customer actually got the product
            // from (the order's own outlet). Older/legacy orders can have no
            // outlet_id recorded at all — fall back to the outlet of whoever
            // is processing this conversion, since that's who it's almost
            // always for, rather than leaving the dropdown on "Select Outlet".
            outlet_id: o.outlet_id || user?.outlet_id || ''
          });

          let steps = [];

          if (o.verification) {
            if (o.verification.purchaser) {
              const p = o.verification.purchaser;
              setPurchaserData({ ...p, net_income: p.net_income || p.gross_salary || '' });
              steps.push({ type: 'purchaser', phone: p.telephone_number, name: p.name, status: 'idle', otp: '' });
              
              let pPhoto = o.verification.documents?.find((doc: any) => 
                (doc.person_type?.toLowerCase() === 'purchaser' || doc.person_type?.toLowerCase() === 'customer') && 
                doc.document_type?.toLowerCase() === 'photo'
              )?.file_url;
              if (!pPhoto) {
                pPhoto = o.verification.verification_locations?.find((loc: any) => loc.person_type?.toLowerCase() === 'purchaser')?.photos?.[0]?.file_url;
              }
              setPhotos((prev: any) => ({ ...prev, purchaser: pPhoto }));
            }

            if (o.verification.grantors && Array.isArray(o.verification.grantors)) {
              const mappedGrantors = o.verification.grantors.map((g: any) => ({
                ...g,
                monthly_income: g.monthly_income || g.net_income || '',
              }));
              setGrantorsData(mappedGrantors);
              
              const gPhotos = o.verification.grantors.map((g: any, idx: number) => {
                steps.push({ 
                    type: 'grantor', 
                    phone: g.telephone_number, 
                    name: g.name, 
                    status: 'locked', 
                    otp: '' 
                });

                let photo = o.verification.documents?.find((d: any) => 
                  (d.person_type?.toLowerCase() === 'grantor' || d.person_type?.toLowerCase() === 'guarantor') && 
                  String(d.person_id) === String(g.id) && d.document_type?.toLowerCase() === 'photo'
                )?.file_url;
                if (!photo) {
                  photo = o.verification.verification_locations?.find((loc: any) => 
                    (loc.person_type?.toLowerCase() === 'grantor' || loc.person_type?.toLowerCase() === 'guarantor') && 
                    String(loc.person_id) === String(g.id)
                  )?.photos?.[0]?.file_url;
                }
                return photo || null;
              });
              setPhotos((prev: any) => ({ ...prev, grantors: gPhotos }));
            }
          }
          setVerificationSteps(steps);
        }

        const productsResp = await fetch(`${BACKEND_URL}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
        const productsJson = await productsResp.json();
        if (productsJson.success) setProducts(productsJson.data);

        const outletsResp = await fetch(`${BACKEND_URL}/api/all-outlets`, { headers: { Authorization: `Bearer ${token}` } });
        const outletsJson = await outletsResp.json();
        if (outletsJson.success) setOutlets(outletsJson.data);

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Admin-editable formula (EMI Calculator page) — tiers, profit/advance % and rounding.
  const installmentFormula = useInstallmentFormula();
  const roundUp = (val: number) => roundAmount(val, installmentFormula?.rounding);

  const calculateInstallments = (category: string, price: number) =>
    calculateInstallmentPlans(installmentFormula, category, price);

  const generateLedger = (monthly: number, months: number) => {
    const schedule = [];
    const today = new Date();
    for (let i = 1; i <= months; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i);
      schedule.push({ month: i, date: dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), amount: monthly });
    }
    return schedule;
  };

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    setSelectedPlan(null);
    setOrderData((prev: any) => ({ ...prev, product_name: product.name }));
    setProductSearchTerm(product.name);
    setIsProductDropdownOpen(false);
    const generatedPlans = calculateInstallments(product.category_name || 'General', product.price || 0);
    setSelectedProduct((prev: any) => ({ ...prev, plans: generatedPlans }));
  };

  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan);
    setAdvanceOverride(plan.advanceAmount);
    setLedger(generateLedger(plan.monthlyAmount, plan.months));
    setOrderData((prev: any) => ({ 
      ...prev, 
      total_amount: plan.totalPrice.toString(), 
      advance_amount: plan.advanceAmount.toString(), 
      monthly_amount: plan.monthlyAmount.toString(), 
      months: plan.months.toString() 
    }));
  };

  const resetSelection = () => {
    if (oldOrder) {
      setOrderData((prev: any) => ({ ...prev, product_name: oldOrder.product_name, total_amount: oldOrder.total_amount, advance_amount: oldOrder.advance_amount, monthly_amount: oldOrder.monthly_amount, months: oldOrder.months, }));
      setSelectedProduct(null); setSelectedPlan(null); setLedger([]); setAdvanceOverride(''); setIsChangingPurchase(false); setIsCustomProduct(false);
      toast.success("Selection reset");
    }
  };

  const recalculatePricing = (newAdvance: number | '', currentPlan: any, currentOrder: any) => {
    if (!currentPlan && (!currentOrder.total_amount || !currentOrder.months)) return;

    const adv = newAdvance === '' ? 0 : newAdvance;
    const months = currentPlan ? currentPlan.months : parseInt(currentOrder.months);
    const total = currentPlan ? currentPlan.totalPrice : parseFloat(currentOrder.total_amount);

    if (months > 0) {
        const remaining = total - adv;
        const newMonthly = roundUp(remaining / months);
        const finalTotal = adv + (newMonthly * months);

        setOrderData((prev: any) => ({ 
            ...prev, 
            advance_amount: adv.toString(), 
            monthly_amount: newMonthly.toString(),
            total_amount: finalTotal.toString()
        }));
        setLedger(generateLedger(newMonthly, months));
    }
  };

  useEffect(() => {
    if (selectedPlan) {
        recalculatePricing(advanceOverride, selectedPlan, orderData);
    }
  }, [advanceOverride, selectedPlan]);

  const handleOrderChange = (e: any) => {
    const { name, value } = e.target;
    const updatedOrder = { ...orderData, [name]: value };
    setOrderData(updatedOrder);

    if (name === 'advance_amount') {
        const val = value === '' ? '' : Number(value);
        setAdvanceOverride(val);
        if (!selectedPlan) {
            recalculatePricing(val, null, updatedOrder);
        }
    } else if (!selectedPlan && (name === 'total_amount' || name === 'months')) {
        recalculatePricing(advanceOverride, null, updatedOrder);
    }
  };

  const handlePurchaserChange = (e: any) => {
    const { name, value } = e.target;
    setPurchaserData((prev: any) => ({ ...prev, [name]: value }));
    
    // Sync with orderData (customer_name, whatsapp_number, address)
    if (name === 'name') {
        setOrderData((prev: any) => ({ ...prev, customer_name: value }));
    } else if (name === 'telephone_number') {
        setOrderData((prev: any) => ({ ...prev, whatsapp_number: value }));
    } else if (name === 'present_address') {
        setOrderData((prev: any) => ({ ...prev, address: value }));
    }

    // Sync with verification steps if name or phone changes
    if (name === 'telephone_number' || name === 'name') {
        const updated = [...verificationSteps];
        if (updated[0]) {
            if (name === 'telephone_number') updated[0].phone = value;
            if (name === 'name') updated[0].name = value;
            setVerificationSteps(updated);
        }
    }
  };

  const handleGrantorChange = (index: number, e: any) => {
    const { name, value } = e.target;
    const updated = [...grantorsData];
    updated[index] = { ...updated[index], [name]: value };
    setGrantorsData(updated);
    
    // Sync with verification steps
    const updatedSteps = [...verificationSteps];
    const stepIdx = index + 1; // 0 is purchaser
    if (updatedSteps[stepIdx]) {
        if (name === 'telephone_number') updatedSteps[stepIdx].phone = value;
        if (name === 'name') updatedSteps[stepIdx].name = value;
        setVerificationSteps(updatedSteps);
    }
  };

  const sendStepOTP = async (stepIdx: number) => {
    const step = verificationSteps[stepIdx];
    if (!step.phone) { toast.error("Phone number is required"); return; }
    setOtpLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const resp = await fetch(`${BACKEND_URL}/api/orders/convert/send-otp`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ phone: step.phone, name: step.name, type: step.type }) 
      });
      const data = await resp.json();
      if (data.success) { 
        const updated = [...verificationSteps];
        updated[stepIdx].status = 'sent';
        setVerificationSteps(updated);
        toast.success(`OTP sent to ${step.name || 'Customer'}`); 
      } else throw new Error(data.message);
    } catch (err: any) { toast.error(err.message || "Failed to send OTP"); } finally { setOtpLoading(false); }
  };

  const verifyStepOTP = async (stepIdx: number) => {
    const step = verificationSteps[stepIdx];
    if (!step.otp) { toast.error("Please enter OTP"); return; }
    setOtpLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const resp = await fetch(`${BACKEND_URL}/api/orders/convert/verify-otp`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ phone: step.phone, otp: step.otp }) 
      });
      const data = await resp.json();
      if (data.success) { 
        const updated = [...verificationSteps];
        updated[stepIdx].status = 'verified';
        // Unlock next step if exists
        if (updated[stepIdx + 1]) {
            updated[stepIdx + 1].status = 'idle';
        }
        setVerificationSteps(updated);
        toast.success("Identity Verified!"); 
      } else throw new Error(data.message);
    } catch (err: any) { toast.error(err.message || "Invalid OTP"); } finally { setOtpLoading(false); }
  };

  const allVerified = verificationSteps.every(s => s.status === 'verified');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allVerified) { toast.error("Please verify all identities first"); return; }
    setSubmitting(true);
    try {
      const token = Cookies.get("auth_token");
      const resp = await fetch(`${BACKEND_URL}/api/orders/convert/create`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
        body: JSON.stringify({ 
            orderData, 
            purchaserData, 
            grantorsData, 
            otpVerified: true,
            oldOrderId: id // Send the original order ID for cloning verification data
        }) 
      });
      const data = await resp.json();
      if (data.success) { toast.success("Sale Created!"); router.push('/csr/dashboard'); } else throw new Error(data.message);
    } catch (err: any) { toast.error(err.message || "Failed to create sale"); } finally { setSubmitting(false); }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-8 max-w-[900px] mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-xl text-red-600"><TrendingUp size={24} /></div>
          <div><h1 className="text-xl font-bold text-gray-900">Convert to New Sale</h1><p className="text-gray-500 text-xs">Multi-step verification for verified repeat accounts.</p></div>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full border border-emerald-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14} /> Account Verified</div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: PRODUCT SELECTION */}
        <section className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ShoppingBag size={20} /></div><h2 className="text-lg font-bold text-gray-900">New Purchase Selection</h2></div>
            <div className="flex items-center gap-4"><button type="button" onClick={resetSelection} className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"><RotateCcw size={14} /> Reset</button><button type="button" onClick={() => setIsChangingPurchase(!isChangingPurchase)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">{isChangingPurchase ? 'Cancel' : 'Change Product'}</button></div>
          </div>
          {!isChangingPurchase ? (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex justify-between items-center"><div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Selection</p><p className="text-lg font-bold text-gray-900">{orderData.product_name || 'No Product'}</p><p className="text-sm text-gray-500 mt-0.5">Rs. {Number(orderData.monthly_amount || 0).toLocaleString()} x {orderData.months || 0} Mo. (Adv: Rs. {Number(orderData.advance_amount || 0).toLocaleString()})</p></div><div className="bg-emerald-50 text-emerald-600 p-2 rounded-full border border-emerald-100 shadow-sm"><Check size={20} /></div></div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
               <label className="flex items-center gap-2 cursor-pointer group"><div className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${isCustomProduct ? 'bg-blue-600' : 'bg-gray-200'}`}><div className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-transform ${isCustomProduct ? 'translate-x-3.5' : 'translate-x-0'}`} /></div><input type="checkbox" checked={isCustomProduct} onChange={(e) => setIsCustomProduct(e.target.checked)} className="sr-only" /><span className="text-xs font-bold text-gray-600">Manual Entry</span></label>
               {isCustomProduct ? (
                 <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-100"><div className="col-span-2"><InputField label="Product Name" name="product_name" value={orderData.product_name} onChange={handleOrderChange} /></div><InputField label="Total Amount" name="total_amount" value={orderData.total_amount} onChange={handleOrderChange} /><InputField label="Advance" name="advance_amount" value={orderData.advance_amount} onChange={handleOrderChange} /><InputField label="Monthly" name="monthly_amount" value={orderData.monthly_amount} onChange={handleOrderChange} /><InputField label="Months" name="months" value={orderData.months} onChange={handleOrderChange} /></div>
               ) : (
                 <div className="space-y-6">
                    <div className="relative" ref={productDropdownRef}><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Search Product Catalog</label><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Start typing name..." value={productSearchTerm} onChange={(e) => { setProductSearchTerm(e.target.value); setIsProductDropdownOpen(true); }} onFocus={() => setIsProductDropdownOpen(true)} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-bold" /></div>{isProductDropdownOpen && products.length > 0 && (<div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">{products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase())).map(p => (<button key={p.id} type="button" onClick={() => handleProductSelect(p)} className="w-full p-4 text-left hover:bg-blue-50 border-b border-gray-50 flex justify-between items-center transition-colors"><div><p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</p><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.category_name}</p></div><p className="font-black text-blue-600">Rs. {p.price?.toLocaleString()}</p></button>))}</div>)}</div>
                    {selectedProduct?.plans && (<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{selectedProduct.plans.map((p: any, i: number) => (<button key={i} type="button" onClick={() => handlePlanSelect(p)} className={`p-4 rounded-xl border-2 text-left transition-all ${selectedPlan?.months === p.months ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-100 bg-white'}`}><p className="text-xl font-black text-gray-900">{p.months} <span className="text-[10px] text-gray-400 font-bold">Mo.</span></p><p className="text-sm font-bold text-blue-600">Rs. {p.monthlyAmount.toLocaleString()}</p></button>))}</div>)}
                 </div>
               )}
            </div>
          )}
          {selectedPlan && (
            <div className="mt-8 space-y-6 animate-in slide-in-from-bottom-2 duration-500"><div className="flex flex-col md:flex-row gap-6"><div className="flex-1"><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Modify Advance</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">Rs.</span><input type="number" value={advanceOverride} onChange={(e) => setAdvanceOverride(e.target.value === '' ? '' : Number(e.target.value))} className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none font-bold" /></div></div><div className="bg-blue-600 text-white rounded-xl p-6 flex flex-col justify-center border border-blue-500 shadow-lg shadow-blue-500/20"><p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-0.5">Final Monthly Payment</p><p className="text-2xl font-black">Rs. {Number(orderData.monthly_amount || 0).toLocaleString()}</p></div></div>{ledger.length > 0 && (<div className="bg-gray-50 rounded-xl p-6 border border-gray-100"><h4 className="font-black text-gray-400 mb-4 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2"><ClipboardList size={14} /> Schedule Preview</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-32 overflow-y-auto pr-2 scrollbar-thin">{ledger.map((row, i) => (<div key={i} className="flex justify-between p-2.5 bg-white border border-gray-100 rounded-lg text-xs font-bold shadow-sm"><span className="text-gray-400">Month {row.month}: {row.date}</span><span className="text-gray-900">Rs. {row.amount.toLocaleString()}</span></div>))}</div></div>)}</div>
          )}
        </section>

        {/* SECTION 2: PURCHASER PROFILE */}
        <section className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
           <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><UserIcon size={20} /></div><h2 className="text-lg font-bold text-gray-900">Purchaser Profile</h2></div>{photos.purchaser && <img src={photos.purchaser} alt="Purchaser" className="w-20 h-20 rounded-xl object-cover border-4 border-emerald-50 shadow-md transition-transform hover:scale-105" />}</div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProfileInputField label="Full Name" name="name" value={purchaserData.name} onChange={handlePurchaserChange} />
              <ProfileInputField label="Father/Husband Name" name="father_husband_name" value={purchaserData.father_husband_name} onChange={handlePurchaserChange} />
              <ProfileInputField label="WhatsApp/Phone" name="telephone_number" value={purchaserData.telephone_number} onChange={handlePurchaserChange} />
              <ProfileInputField label="CNIC Number" name="cnic_number" value={purchaserData.cnic_number} onChange={handlePurchaserChange} />
              <div className="md:col-span-2"><ProfileInputField label="Residence Address" name="present_address" value={purchaserData.present_address} onChange={handlePurchaserChange} /></div>
              <ProfileInputField label="Employer Name" name="employer_name" value={purchaserData.employer_name} onChange={handlePurchaserChange} />
              <ProfileInputField label="Designation" name="designation" value={purchaserData.designation} onChange={handlePurchaserChange} />
              <ProfileInputField label="Monthly Net Income" name="net_income" value={purchaserData.net_income} onChange={handlePurchaserChange} />
              <ProfileInputField label="Years in Company" name="years_in_company" value={purchaserData.years_in_company} onChange={handlePurchaserChange} />
           </div>
        </section>

        {/* SECTION 3: GRANTORS */}
        {grantorsData?.map((grantor, idx) => (
          <section key={idx} className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3"><div className="p-2 bg-purple-50 rounded-lg text-purple-600"><UserCheck size={20} /></div><h2 className="text-lg font-bold text-gray-900">Guarantor {idx + 1} Profile</h2></div>{photos.grantors[idx] && <img src={photos.grantors[idx]} alt={`Grantor ${idx+1}`} className="w-20 h-20 rounded-xl object-cover border-4 border-purple-50 shadow-md transition-transform hover:scale-105" />}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ProfileInputField label="Full Name" name="name" value={grantor.name} onChange={(e: any) => handleGrantorChange(idx, e)} />
              <ProfileInputField label="WhatsApp/Phone" name="telephone_number" value={grantor.telephone_number} onChange={(e: any) => handleGrantorChange(idx, e)} />
              <ProfileInputField label="CNIC Number" name="cnic_number" value={grantor.cnic_number} onChange={(e: any) => handleGrantorChange(idx, e)} />
              <ProfileInputField label="Relationship" name="relationship" value={grantor.relationship} onChange={(e: any) => handleGrantorChange(idx, e)} />
              <div className="md:col-span-2"><ProfileInputField label="Residence Address" name="full_residential_address" value={grantor.full_residential_address} onChange={(e: any) => handleGrantorChange(idx, e)} /></div>
              <ProfileInputField label="Company Name" name="company_name" value={grantor.company_name} onChange={(e: any) => handleGrantorChange(idx, e)} />
              <ProfileInputField label="Monthly Income" name="monthly_income" value={grantor.monthly_income} onChange={(e: any) => handleGrantorChange(idx, e)} />
            </div>
          </section>
        ))}

        {/* SECTION 4: SEQUENTIAL AUTHORIZATION */}
        <section className="bg-gray-900 rounded-2xl p-10 shadow-2xl text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
           <div className="relative space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                   <h2 className="text-3xl font-black tracking-tight">Final Authorization</h2>
                   <p className="text-gray-400 text-sm font-medium leading-relaxed">Teeno ki tasdeeq lazmi hay. (Sequential Verification Required)</p>
                </div>
                <div className="w-full md:w-72">
                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2 block flex items-center gap-1.5">Fulfillment Branch <Lock size={10} className="text-gray-500" /></label>
                   {orderData.outlet_id ? (
                     <>
                       <div className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm flex items-center justify-between cursor-not-allowed opacity-80">
                          <span>{outlets?.find(o => String(o.id) === String(orderData.outlet_id))?.name || 'Outlet'} {outlets?.find(o => String(o.id) === String(orderData.outlet_id))?.code ? `(${outlets.find(o => String(o.id) === String(orderData.outlet_id))?.code})` : ''}</span>
                          <Lock size={14} className="text-gray-500" />
                       </div>
                       <input type="hidden" name="outlet_id" value={orderData.outlet_id} />
                       <p className="text-[10px] text-gray-500 font-medium mt-1.5">Locked to the branch this account's product was originally issued from.</p>
                     </>
                   ) : (
                     <select name="outlet_id" value={orderData.outlet_id} onChange={handleOrderChange} className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-white font-bold appearance-none bg-[right_1rem_center] bg-no-repeat text-sm transition-all" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}>
                        <option value="" className="text-gray-900">Select Outlet</option>
                        {outlets?.map(o => <option key={o.id} value={o.id} className="text-gray-900">{o.name} ({o.code})</option>)}
                     </select>
                   )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {verificationSteps.map((step, i) => (
                  <div key={i} className={`p-6 rounded-2xl border-2 transition-all ${step.status === 'verified' ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10' : step.status === 'locked' ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{step.type === 'purchaser' ? 'Main Account' : `Guarantor ${i}`}</p>
                        <p className="text-sm font-black truncate max-w-[150px]">{step.name || 'Loading...'}</p>
                      </div>
                      {step.status === 'verified' ? <div className="bg-emerald-500 text-white p-1 rounded-full"><Check size={14} /></div> : step.status === 'locked' ? <X size={18} className="text-gray-600" /> : <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full" />}
                    </div>

                    {step.status === 'idle' || step.status === 'sent' ? (
                       <div className="space-y-4">
                          {step.status === 'idle' ? (
                            <button type="button" onClick={() => sendStepOTP(i)} disabled={otpLoading} className="w-full bg-white text-gray-900 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50">Send OTP <Send size={14} /></button>
                          ) : (
                            <div className="space-y-3">
                               <input type="text" placeholder="Enter OTP" value={step.otp} onChange={(e) => { const up = [...verificationSteps]; up[i].otp = e.target.value; setVerificationSteps(up); }} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center font-black tracking-[0.3em] outline-none focus:border-blue-500" />
                               <div className="flex gap-2">
                                  <button type="button" onClick={() => verifyStepOTP(i)} disabled={otpLoading} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all">Verify</button>
                                  <button type="button" onClick={() => sendStepOTP(i)} disabled={otpLoading} className="p-2.5 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 transition-all"><RotateCcw size={16} /></button>
                               </div>
                            </div>
                          )}
                       </div>
                    ) : step.status === 'verified' ? (
                      <div className="py-2 text-center text-xs font-bold text-emerald-400 uppercase tracking-widest">Verification Success</div>
                    ) : (
                      <div className="py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-widest flex items-center justify-center gap-2"><ShieldCheck size={14} /> Step Locked</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-white/5">
                 <button type="submit" disabled={!allVerified || submitting || !orderData.product_name} className={`w-full py-6 rounded-2xl font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 text-xl ${allVerified ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-2xl shadow-emerald-500/40' : 'bg-white/5 text-gray-600 cursor-not-allowed grayscale'}`}>{submitting ? "Processing..." : "Authorize Final Sale"} <ArrowRight size={28} /></button>
              </div>
           </div>
        </section>
      </form>
    </div>
  );
};

const InputField = ({ label, name, value, onChange, placeholder }: any) => (
  <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label><input type="text" name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-gray-900 shadow-sm" /></div>
);

const ProfileInputField = ({ label, name, value, onChange, placeholder }: any) => {
  if (value === null || value === undefined) return null;
  return (<div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">{label}</label><input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-gray-900" /></div>);
};

export default ConvertSalePage;
