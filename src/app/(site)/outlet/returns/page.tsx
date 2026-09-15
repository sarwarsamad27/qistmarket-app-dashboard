"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import {
  PackageX, Search, RefreshCw, User, DollarSign, Tag, CheckCircle2,
  Clock, AlertCircle, Phone, X, ChevronRight, History
} from "lucide-react";
import Loader from "@/components/common/Loader";
import { formatExactDate } from "@/utils/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

export default function OutletReturnsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Direct return flow
  const [orderQuery, setOrderQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isCash, setIsCash] = useState(false);
  const [refundAmt, setRefundAmt] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Confirmation popup
  const [confirmData, setConfirmData] = useState<any | null>(null);
  const [blacklistCustomer, setBlacklistCustomer] = useState(false);
  const [keepEnrolled, setKeepEnrolled] = useState(true);

  const token = useMemo(() => Cookies.get("auth_token"), []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/return-exchanges`, {
        headers: getHeaders()
      });
      if (!res.ok) { console.error('Records API error:', res.status); return; }
      const d = await res.json();
      if (d.success) setRecords(d.data);
    } catch (e) { console.error('Records fetch error:', e); } finally { setLoading(false); }
  }, []);

  const [isLicenseExceeded, setIsLicenseExceeded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/paytrigger/company/license`, { headers: getHeaders() })
      .then(r => r.json())
      .then(res => {
        if (res?.success && res?.data) {
          const unused = res.data.availableLicenses ?? res.data.remainingAmountOfLicense ?? res.data.unusedNum ?? 0;
          const isExceeded = res.data.isLicenseExceeded ?? (unused <= 0);
          if (isExceeded) {
            setIsLicenseExceeded(true);
            setKeepEnrolled(false);
          } else {
            setIsLicenseExceeded(false);
          }
        }
      })
      .catch(() => {});
  }, [getHeaders]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Search orders
  useEffect(() => {
    if (orderQuery.length < 3) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${API_BASE}/api/outlet/search-delivered-orders?query=${encodeURIComponent(orderQuery)}`, { headers: getHeaders() });
        if (!res.ok) { console.error('Search API error:', res.status, await res.text()); return; }
        const d = await res.json();
        console.log('Search raw response:', d);
        if (d.success) {
          setSearchResults(d.data || []);
        } else {
          console.error('Search API returned not success:', d);
        }
      } catch (e) { console.error('Search fetch error:', e); } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [orderQuery, token]);

  const handleSelectOrder = (o: any) => {
    setSelectedOrder(o);
    setSearchResults([]);
    setOrderQuery(o.order_ref);
    setRefundAmt("");
    setCustomerPhone(o.whatsapp_number || "");
    setBlacklistCustomer(false);
  };

  const handleInitiateReturn = async () => {
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/initiate-direct-return`, {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          is_cash_refund: isCash,
          refund_amount: isCash ? parseFloat(refundAmt) : 0,
          customer_phone: customerPhone || undefined,
          blacklist_customer: blacklistCustomer,
          keep_enrolled: keepEnrolled,
        }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Failed");

      toast.success("Return processed successfully");

      setSelectedOrder(null);
      setOrderQuery("");
      setIsCash(false);
      setRefundAmt("");
      setCustomerPhone("");
      setBlacklistCustomer(false);
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message || "Failed to initiate return");
    } finally { setSubmitting(false); }
  };



  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleCancelReturn = async (record: any) => {
    if (!confirm(`Cancel this return for order #${record.order?.order_ref}? The order will go back to Delivered.`)) return;
    setCancellingId(record.id);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/cancel-direct-return`, {
        method: "POST",
        headers: { ...getHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: record.id }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Failed");

      toast.success(d.message || "Return cancelled");
      (d.warnings || []).forEach((w: string) => toast(w, { icon: "⚠️", duration: 6000 }));
      fetchRecords();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel return");
    } finally {
      setCancellingId(null);
    }
  };

  const handleClearSelection = () => {
    setSelectedOrder(null);
    setOrderQuery("");
    setSearchResults([]);
    setIsCash(false);
    setRefundAmt("");
    setCustomerPhone("");
    setBlacklistCustomer(false);
    setKeepEnrolled(true);
  };

  const filteredRecords = records.filter(r =>
    r.order?.order_ref?.toLowerCase().includes(search.toLowerCase()) ||
    r.order?.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.order?.whatsapp_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.imei_returned?.toLowerCase().includes(search.toLowerCase())
  );


  const completedRecords = filteredRecords.filter(r => r.status === "verified");

  if (loading && records.length === 0) return <Loader text="Loading Returns..." />;

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Sales Returns" />

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <PackageX className="text-red-500" /> Sales Returns
          </h1>
          <p className="text-sm text-gray-400 mt-1">Process customer returns and restock items.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={16} /></span>
            <input type="text" placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-stroke dark:border-strokedark bg-white dark:bg-boxdark rounded-xl text-sm outline-none focus:border-primary transition-all w-64 shadow-sm" />
          </div>
          <button onClick={fetchRecords}
            className="bg-white dark:bg-boxdark border border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 text-gray-600 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm transition-all active:scale-95">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-boxdark p-4 rounded-2xl border border-stroke dark:border-strokedark shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Returns</p>
          <p className="text-2xl font-black text-gray-800 dark:text-white">{records.length}</p>
        </div>
        <div className="bg-white dark:bg-boxdark p-4 rounded-2xl border border-stroke dark:border-strokedark shadow-sm border-l-4 border-l-success">
          <p className="text-[10px] font-black uppercase tracking-widest text-success mb-1">Completed</p>
          <p className="text-2xl font-black text-gray-800 dark:text-white">{completedRecords.length}</p>
        </div>
      </div>

      {/* ── NEW RETURN FORM ── */}
      <div className="bg-white dark:bg-boxdark rounded-3xl border border-stroke dark:border-strokedark p-6 md:p-8 mb-10 shadow-sm">
        <h2 className="text-lg font-black text-gray-800 dark:text-white flex items-center gap-2 mb-6">
          <Search size={18} className="text-primary" /> Initiate New Return
        </h2>

        {/* Search */}
        <div className="mb-5">
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
            Search Delivered Order
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Order ref, token no, customer name, phone, CNIC, or IMEI" value={orderQuery}
              onChange={e => setOrderQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-stroke dark:border-strokedark rounded-2xl focus:border-primary outline-none font-bold text-gray-800 dark:text-white transition-all" />
            {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>}
          </div>

          {searchResults.length > 0 && !selectedOrder && (
            <div className="mt-2 bg-white dark:bg-gray-900 border border-stroke dark:border-strokedark rounded-2xl shadow-xl overflow-hidden">
              {searchResults.map((o: any) => (
                <button key={o.id} onClick={() => handleSelectOrder(o)}
                  className="w-full px-5 py-4 text-left hover:bg-primary/5 border-b border-stroke dark:border-strokedark last:border-none transition-colors flex items-center justify-between group">
                  <div>
                    <p className="font-black text-gray-800 dark:text-white group-hover:text-primary transition-colors flex items-center gap-2">
                      #{o.order_ref}
                      {o.is_customer_blacklisted && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-900/50">
                          Blacklisted
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{o.customer_name} &bull; {o.whatsapp_number} &bull; {o.delivered_product_name} &bull; IMEI: {o.delivered_imei}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Order Summary */}
            <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl border border-stroke dark:border-strokedark flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><PackageX size={22} /></div>
                <div>
                  <p className="text-sm font-black text-gray-800 dark:text-white flex items-center gap-2">
                    #{selectedOrder.order_ref}
                    {selectedOrder.is_customer_blacklisted && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:border-red-900/50">
                        Blacklisted
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{selectedOrder.customer_name} &bull; {selectedOrder.delivered_product_name}</p>
                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">IMEI: {selectedOrder.delivered_imei}</p>
                </div>
              </div>
              <button onClick={handleClearSelection} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest">Change</button>
            </div>

            {selectedOrder.is_enrolled && (
              <div className={`p-4 rounded-xl flex items-center justify-between border ${isLicenseExceeded ? 'bg-red-50 border-red-200' : 'bg-primary/5 border-primary/20'}`}>
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-tight flex items-center gap-2 ${isLicenseExceeded ? 'text-red-700' : 'text-primary'}`}>
                    <CheckCircle2 size={16} /> Enrolled in PayTrigger
                  </h4>
                  <p className={`text-[10px] uppercase font-bold mt-1 ${isLicenseExceeded ? 'text-red-500' : 'text-primary/70'}`}>
                    {isLicenseExceeded ? "Licence Exceed — Toggle disabled (0 Available Licenses)" : "Keep this ON to just remove expiration date without unenrolling."}
                  </p>
                </div>
                <label className={`relative inline-flex items-center ${isLicenseExceeded ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isLicenseExceeded ? false : keepEnrolled}
                    disabled={isLicenseExceeded}
                    onChange={() => !isLicenseExceeded && setKeepEnrolled(!keepEnrolled)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            )}

            {/* Cash Refund? */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Cash Refund?</p>
              <div className="flex gap-2">
                <button onClick={() => { setIsCash(false); setRefundAmt(""); }}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${!isCash ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-400'}`}>No Cash</button>
                <button onClick={() => setIsCash(true)}
                  className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${isCash ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white dark:bg-boxdark border border-stroke dark:border-strokedark text-gray-400'}`}>With Cash</button>
              </div>
            </div>

              {isCash && (
              <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/30 p-5 rounded-3xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-red-600 flex items-center justify-center text-white"><DollarSign size={20} /></div>
                  <div>
                    <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tight">Cash Refund Amount</h3>
                    <p className="text-[10px] text-red-500 font-bold uppercase">Impacts Daily Book</p>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black">Rs.</span>
                  <input type="number" placeholder="Refund Amount" value={refundAmt} onChange={e => setRefundAmt(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-900 border-2 border-red-200 dark:border-red-800 rounded-2xl focus:border-red-500 outline-none font-black text-2xl text-red-600 transition-all shadow-inner" />
                </div>
              </div>
            )}

            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2">
                <Phone size={12} /> Customer Phone (for return confirmation)
              </label>
              <input type="text" placeholder="03XXXXXXXXX" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-stroke dark:border-strokedark rounded-2xl focus:border-primary outline-none font-bold text-gray-800 dark:text-white transition-all" />
            </div>

            {/* Already-blacklisted notice (return still proceeds, account stays blacklisted) */}
            {selectedOrder.is_customer_blacklisted && (
              <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <p className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-tight">
                  This account is already blacklisted. The return will still be processed, but the account stays blacklisted until an admin whitelists it from Blacklisted Customers.
                </p>
              </div>
            )}

            {/* Blacklist Toggle (hidden when customer is already blacklisted) */}
            {!selectedOrder.is_customer_blacklisted && (
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 border border-stroke dark:border-strokedark p-4 rounded-xl">
                <div>
                  <h4 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Blacklist Customer</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">If enabled, the customer & order will be blacklisted.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={blacklistCustomer} onChange={() => setBlacklistCustomer(!blacklistCustomer)} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                </label>
              </div>
            )}

            <button onClick={handleInitiateReturn} disabled={submitting || (isCash && !refundAmt)}
              className="w-full py-5 bg-primary hover:bg-opacity-90 disabled:opacity-50 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3">
              {submitting ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Processing...</span></>
              ) : (
                <><CheckCircle2 size={18} /><span>Process Return</span></>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── CONFIRMATION POPUP (Removed as OTP is bypassed) ── */}



      {/* ── COMPLETED RETURNS TABLE ── */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-black uppercase tracking-widest text-success flex items-center gap-2">
            <History size={16} /> Completed Returns ({completedRecords.length})
          </h2>
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-success"></div> Ready Stock</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary"></div> Used Stock</div>
          </div>
        </div>
        <div className="bg-white dark:bg-boxdark rounded-2xl shadow-sm border border-stroke dark:border-strokedark overflow-hidden mb-20">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark">
                <tr className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">Ref/Order</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Product</th>
                  <th className="px-5 py-4">Financials</th>
                  <th className="px-5 py-4">Initiated By</th>
                  <th className="px-5 py-4">Status & Date</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-strokedark">
                {completedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-gray-400 font-medium">
                      <History size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="uppercase tracking-widest text-xs font-black">No completed returns.</p>
                    </td>
                  </tr>
                ) : completedRecords.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-meta-4/20 transition-all group">
                    <td className="px-5 py-4">
                      <p className="font-black text-gray-800 dark:text-white leading-none mb-1 group-hover:text-primary transition-colors">#{r.order?.order_ref}</p>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${r.is_used ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-success/10 text-success border border-success/20'}`}>
                        {r.is_used ? 'Used Stock' : 'Ready Stock'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-600 dark:text-gray-300">
                      {r.order?.customer_name || "N/A"}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-800 dark:text-white font-black text-xs truncate max-w-[180px]">{r.product_name || r.order?.product_name}</p>
                      <p className="text-[9px] text-primary/60 font-mono tracking-tighter italic">{r.imei_returned || "No IMEI"}</p>
                    </td>
                    <td className="px-5 py-4">
                      {r.is_cash_refund ? (
                        <div>
                          <p className="text-[10px] font-black text-red-500 leading-none mb-1">CASH REFUND</p>
                          <p className="font-black text-gray-800 dark:text-white">Rs. {r.refund_amount?.toLocaleString()}</p>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">No Refund</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {r.initiated_by === "Outlet" ? (
                        <div className="flex items-center gap-2 text-primary">
                          <CheckCircle2 size={14} />
                          <p className="font-black text-[10px] uppercase tracking-widest">Direct Return</p>
                        </div>
                      ) : (
                        <p className="font-bold text-xs">{r.delivery_officer?.full_name}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                        <p className="text-xs font-black text-gray-700 dark:text-gray-200">
                          {r.verified_at ? formatExactDate(r.verified_at) : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {r.can_cancel ? (
                        <button
                          onClick={() => handleCancelReturn(r)}
                          disabled={cancellingId === r.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-all dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-400"
                        >
                          {cancellingId === r.id ? (
                            <div className="w-3 h-3 border-2 border-red-400/40 border-t-red-500 rounded-full animate-spin" />
                          ) : (
                            <X size={12} />
                          )}
                          Cancel
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
