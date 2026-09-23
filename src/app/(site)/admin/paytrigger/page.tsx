"use client";

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Loader2, Search, Lock, Unlock, Clock, AlertTriangle, CheckCircle, XCircle, Smartphone, Key, Settings, MessageSquare, MapPin, RefreshCw, FileText, Database, Shield } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

type DeviceInfo = {
  imei: string;
  order_ref?: string;
  product_model?: string;
  enrollment_status?: string;
  server_state?: number;
  mobile_state?: number;
  lock_status?: string;
  expiration?: string;
  last_sync_at?: string;
  raw_state?: any;
};

// Pre-defined push message templates
const PUSH_TEMPLATES = [
  { label: "Custom Message", title: "", content: "", type: "2" },
  { label: "Payment Reminder (Friendly)", title: "Payment Reminder", content: "Dear customer, your upcoming installment is due soon. Please ensure timely payment to avoid service interruption.", type: "2" },
  { label: "Overdue Warning", title: "URGENT: Payment Overdue", content: "Your payment is past due. Please pay immediately. Your device will be locked if payment is not received within 24 hours.", type: "1" },
  { label: "Device Lock Notification", title: "Device Locked", content: "This device has been locked due to non-payment. Please contact support or pay your outstanding balance to restore access.", type: "1" },
];

export default function PayTriggerAdminPage() {
  const [activeTab, setActiveTab] = useState<"device" | "global">("device");
  const [imei, setImei] = useState("");
  const [searching, setSearching] = useState(false);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form states for Device
  const [tempUnlockHours, setTempUnlockHours] = useState("24");
  const [offlineCaptcha, setOfflineCaptcha] = useState("");
  const [lockRuleNum, setLockRuleNum] = useState("0");
  const [pushTitle, setPushTitle] = useState("");
  const [pushContent, setPushContent] = useState("");
  const [pushType, setPushType] = useState("2");
  const [findPhoneContact, setFindPhoneContact] = useState("");

  // Global Config states
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [companyConfig, setCompanyConfig] = useState<any>(null);
  
  // Rule Config Form (No JSON, easy UX)
  const [ruleConfig, setRuleConfig] = useState({
    ruleNum: 1,
    appBlockEnabled: false,
    appBlockType: 1, // 1=Blacklist, 2=Whitelist
    appBlockPackages: "",
    
    autoPopupEnabled: false,
    autoPopupTitle: "Device Locked",
    autoPopupContent: "Please pay your installment to unlock.",
    
    callsInEnabled: false,
    callsInType: 1,
    callsInNumbers: "",
    
    callsOutEnabled: false,
    callsOutType: 1,
    callsOutNumbers: "",
    
    screenBlockedEnabled: false,
    screenBlockedTitle: "Phone Locked",
    screenBlockedContent: "Please contact support to unlock your device.",
    screenBlockedPhone: "",
    
    simBlockedEnabled: false,
    simBlockType: 1,
    simIccids: "",
    
    smsBlockedEnabled: false,
    smsBlockType: 1,
    smsBlockNumbers: "",
    
    watermarkEnabled: false,
    watermarkText: "Qist Market - Locked",
    watermarkColor: "#FF0000",
    watermarkSize: 20
  });

  const handleSearch = async () => {
    const q = imei.trim();
    if (!q) { toast.error("Enter an IMEI number"); return; }
    setSearching(true);
    setDevice(null);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/paytrigger/device/${encodeURIComponent(q)}/status`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const local = data.data.local || {};
        const remote = data.data.remote?.data || {};
        setDevice({
          imei: local.imei || q,
          order_ref: local.order_ref || "",
          product_model: local.product_model || "",
          enrollment_status: local.enrollment_status || "",
          server_state: local.server_state ?? remote.serverState,
          mobile_state: local.mobile_status ?? remote.mobileStatus,
          lock_status: local.lock_status || "",
          expiration: local.expiration || (remote.expiration ? new Date(remote.expiration * 1000).toISOString() : ""),
          last_sync_at: local.last_sync_at || "",
          raw_state: data.data.remote || data.data.local?.raw_state,
        });
      } else {
        setError(data.message || "Device not found or API error");
      }
    } catch (e) {
      setError("Connection failed. Is the backend running?");
    } finally {
      setSearching(false);
    }
  };

  const handleAction = async (action: string) => {
    const q = imei.trim();
    if (!q) return;
    setActionLoading(action);

    try {
      let endpoint = "";
      let method = "POST";
      let body: any = {};

      switch(action) {
        case "sync-device-status": endpoint = `device/${encodeURIComponent(q)}/sync`; break;
        case "get-device-tag": endpoint = `device/${encodeURIComponent(q)}/tag`; method = "GET"; body = undefined; break;
        case "unenroll": endpoint = `device/${encodeURIComponent(q)}/unenroll`; break;
        case "manual-lock": endpoint = `device/${encodeURIComponent(q)}/lock`; break;
        case "manual-unlock": endpoint = `device/${encodeURIComponent(q)}/unlock`; break;
        case "temp-unlock": endpoint = `device/${encodeURIComponent(q)}/temp-unlock`; body = { tempLockTime: parseInt(tempUnlockHours), timeUnit: "HOURS" }; break;
        case "offline-pin": endpoint = `device/${encodeURIComponent(q)}/offline-pin`; body = { captcha: offlineCaptcha }; break;
        case "simlock-reset": endpoint = `device/${encodeURIComponent(q)}/simlock-reset`; break;
        case "set-rule": endpoint = `device/${encodeURIComponent(q)}/set-rule`; body = { ruleNum: parseInt(lockRuleNum) }; break;
        case "send-push": endpoint = `device/${encodeURIComponent(q)}/push`; body = { title: pushTitle, content: pushContent, pushType: parseInt(pushType) }; break;
        case "find-submit": endpoint = `device/${encodeURIComponent(q)}/find/submit`; body = { contactInformation: findPhoneContact }; break;
        case "find-close": endpoint = `device/${encodeURIComponent(q)}/find/close`; break;
        case "find-status": endpoint = `device/${encodeURIComponent(q)}/find/status`; break;
        default: return;
      }

      const res = await fetch(`${API_BASE}/api/paytrigger/${endpoint}`, {
        method, headers: getAuthHeaders(), body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      const ptResult = data.data;
      
      if (data.success && (!ptResult || ptResult.code === 200 || !ptResult.code)) {
        toast.success(`${action} command sent successfully`);
        if (action === "sync-device-status" && data.completion?.completed) toast.success("Device is active — order marked as delivered.", { duration: 6000 });
        if (action === "sync-device-status" && data.completion?.error) toast.error(`Device active but delivery completion failed: ${data.completion.error}`, { duration: 8000 });
        if (action === "get-device-tag" && ptResult?.data?.deviceTag) toast.success(`Tag retrieved: ${ptResult.data.deviceTag}`, { duration: 5000 });
        if (action === "offline-pin" && ptResult?.data?.verifyCode) toast.success(`Unlock PIN: ${ptResult.data.verifyCode}`, { duration: 10000 });
        if (action === "find-status" && ptResult?.data?.operationStatus) toast.success(`Find Phone Status: ${ptResult.data.operationStatus}`, { duration: 5000 });
        
        if (!["get-device-tag", "offline-pin", "find-status"].includes(action)) handleSearch();
      } else {
        let errorMsg = data.message || `${action} failed`;
        if (ptResult && ptResult.code && ptResult.code !== 200) {
          errorMsg = `Error ${ptResult.code}: ${ptResult.message}`;
          if (Array.isArray(ptResult.data) && ptResult.data.length > 0 && ptResult.data[0].message) {
            errorMsg += ` (${ptResult.data[0].message})`;
          }
        }
        toast.error(errorMsg);
      }
    } catch (e) { toast.error("Connection failed"); }
    finally { setActionLoading(null); }
  };

  const handleGlobalAction = async (action: string) => {
    setActionLoading(action);
    try {
      if (action === "license") {
        const res = await fetch(`${API_BASE}/api/paytrigger/company/license`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success) setLicenseInfo(data.data?.data || data.data);
        else toast.error("Failed to fetch license");
      } else if (action === "config") {
        const res = await fetch(`${API_BASE}/api/paytrigger/company/config`, { headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success) setCompanyConfig(data.data?.data || data.data);
        else toast.error("Failed to fetch config");
      } else if (action === "update-rule") {
        // Convert friendly UI state to raw JSON strings PayTrigger expects
        const payload = {
          ruleNum: ruleConfig.ruleNum,
          appBlockedSwitch: ruleConfig.appBlockEnabled,
          appBlockedContent: ruleConfig.appBlockEnabled ? JSON.stringify({ type: ruleConfig.appBlockType, list: ruleConfig.appBlockPackages.split(',').map(s=>s.trim()).filter(Boolean) }) : "",
          autoPopupSwitch: ruleConfig.autoPopupEnabled,
          autoPopupContent: ruleConfig.autoPopupEnabled ? JSON.stringify({ title: ruleConfig.autoPopupTitle, content: ruleConfig.autoPopupContent }) : "",
          callsInSwitch: ruleConfig.callsInEnabled,
          callsInContent: ruleConfig.callsInEnabled ? JSON.stringify({ type: ruleConfig.callsInType, list: ruleConfig.callsInNumbers.split(',').map(s=>s.trim()).filter(Boolean) }) : "",
          callsOutSwitch: ruleConfig.callsOutEnabled,
          callsOutContent: ruleConfig.callsOutEnabled ? JSON.stringify({ type: ruleConfig.callsOutType, list: ruleConfig.callsOutNumbers.split(',').map(s=>s.trim()).filter(Boolean) }) : "",
          screenBlockedSwitch: ruleConfig.screenBlockedEnabled,
          screenBlockedContent: ruleConfig.screenBlockedEnabled ? JSON.stringify({ title: ruleConfig.screenBlockedTitle, content: ruleConfig.screenBlockedContent, phone: ruleConfig.screenBlockedPhone }) : "",
          simBlockedSwitch: ruleConfig.simBlockedEnabled,
          simBlockedContent: ruleConfig.simBlockedEnabled ? JSON.stringify({ type: ruleConfig.simBlockType, list: ruleConfig.simIccids.split(',').map(s=>s.trim()).filter(Boolean) }) : "",
          smsBlockedSwitch: ruleConfig.smsBlockedEnabled,
          smsBlockedContent: ruleConfig.smsBlockedEnabled ? JSON.stringify({ type: ruleConfig.smsBlockType, list: ruleConfig.smsBlockNumbers.split(',').map(s=>s.trim()).filter(Boolean) }) : "",
          watermarkSwitch: ruleConfig.watermarkEnabled,
          watermarkContent: ruleConfig.watermarkEnabled ? JSON.stringify({ text: ruleConfig.watermarkText, color: ruleConfig.watermarkColor, size: ruleConfig.watermarkSize }) : "",
        };

        const res = await fetch(`${API_BASE}/api/paytrigger/company/lock-rule`, {
          method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload)
        });
        const data = await res.json();
        const ptResult = data.data;

        if (data.success && (!ptResult || ptResult.code === 200)) {
          toast.success(`Rule ${ruleConfig.ruleNum} configured successfully!`);
        } else {
          let errorMsg = data.message || "Failed to update rule";
          if (ptResult && ptResult.code && ptResult.code !== 200) {
            errorMsg = `Error ${ptResult.code}: ${ptResult.message}`;
          }
          toast.error(errorMsg);
        }
      }
    } catch (e) { toast.error("Connection failed"); }
    finally { setActionLoading(null); }
  };

  const getLockBadge = () => {
    // lock_status only means something once the phone has actually activated —
    // before that, mobileStatus 2000 ("not locked") would read as "UNLOCKED" and
    // hide that enrollment is still pending.
    const e = device?.enrollment_status;
    if (e === "registered" || e === "ready_to_activate") {
      return <div className="flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-bold border border-amber-300"><Clock className="w-5 h-5" /> NOT ACTIVATED YET ({e.replace(/_/g, " ").toUpperCase()})</div>;
    }
    if (e === "removable") {
      return <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold border border-gray-300"><Smartphone className="w-5 h-5" /> REMOVABLE</div>;
    }
    const s = e === "pre_enrolled" ? e : (device?.lock_status || e);
    if (s === "locked" || s === "active_lock") {
      return <div className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold border border-red-300"><Lock className="w-5 h-5" /> DEVICE IS LOCKED</div>;
    }
    if (s === "unlocked") {
      return <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold border border-emerald-300"><Unlock className="w-5 h-5" /> DEVICE IS UNLOCKED</div>;
    }
    if (s === "pre_enrolled") {
      return <div className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl font-bold border border-blue-300"><Clock className="w-5 h-5" /> PRE-ENROLLED (Pending Connection)</div>;
    }
    return <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold border border-gray-300"><Smartphone className="w-5 h-5" /> STATUS UNKNOWN ({s})</div>;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Software Activation Device Management" />

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === "device" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
          onClick={() => setActiveTab("device")}
        >
          <Smartphone className="w-4 h-4" /> Device Controls
        </button>
        <button
          className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === "global" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
          onClick={() => setActiveTab("global")}
        >
          <Settings className="w-4 h-4" /> Global Configuration
        </button>
      </div>

      {activeTab === "device" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter 15-digit IMEI number..."
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={handleSearch} disabled={searching || !imei.trim()} className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} Search Device
              </button>
            </div>
          </div>

          {searching && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-16 text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-500 font-medium">Communicating with Software Activation Servers...</p>
            </div>
          )}

          {error && !searching && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
              <p className="text-red-700 dark:text-red-400 font-bold text-lg">{error}</p>
            </div>
          )}

          {device && !searching && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Left Column: Information & Big Status */}
              <div className="xl:col-span-4 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center">
                  <h2 className="text-sm uppercase tracking-widest text-gray-500 font-bold mb-4">Current Device Status</h2>
                  {getLockBadge()}
                  <p className="text-xs text-gray-400 mt-4">Last synced: {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : "Never"}</p>
                  
                  <div className="w-full mt-6 space-y-3">
                    <ActionBtn label="Refresh Status" icon={<RefreshCw className="w-4 h-4"/>} onClick={() => handleAction("sync-device-status")} loading={actionLoading === "sync-device-status"} color="bg-blue-50 hover:bg-blue-100 text-blue-700 w-full" />
                    <div className="flex gap-3">
                      <ActionBtn label="Fetch Tag" icon={<Search className="w-4 h-4"/>} onClick={() => handleAction("get-device-tag")} loading={actionLoading === "get-device-tag"} color="bg-gray-100 hover:bg-gray-200 text-gray-700 w-full" />
                      <ActionBtn label="Unenroll" icon={<XCircle className="w-4 h-4"/>} onClick={() => handleAction("unenroll")} loading={actionLoading === "unenroll"} color="bg-red-50 hover:bg-red-100 text-red-700 w-full" />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 uppercase tracking-wider">Device Details</h2>
                  <div className="space-y-3">
                    <InfoRow label="IMEI Number" value={device.imei} />
                    <InfoRow label="Device Tag" value={device.raw_state?.data?.deviceTag || device.raw_state?.deviceTag || "Not generated yet"} />
                    <InfoRow label="Order Reference" value={device.order_ref || "None"} />
                    <InfoRow label="Phone Model" value={device.product_model || "Unknown"} />
                    <InfoRow label="Expiration Date" value={device.expiration ? new Date(device.expiration).toLocaleDateString() : "Lifetime"} />
                  </div>
                </div>
              </div>

              {/* Right Column: Actions Grid */}
              <div className="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Immediate Lock Controls */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                  <h3 className="text-md font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-500"/> Core Lock Controls</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <ActionBtn label="Force Lock" onClick={() => handleAction("manual-lock")} loading={actionLoading === "manual-lock"} color="bg-red-600 hover:bg-red-700 text-white shadow-sm" />
                      <ActionBtn label="Force Unlock" onClick={() => handleAction("manual-unlock")} loading={actionLoading === "manual-unlock"} color="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" />
                    </div>
                    <hr className="border-gray-100 dark:border-gray-700" />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Unlock for (Hours)</label>
                        <input type="number" value={tempUnlockHours} onChange={e => setTempUnlockHours(e.target.value)} className="w-full mt-1 p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="flex items-end">
                        <ActionBtn label="Temp Unlock" onClick={() => handleAction("temp-unlock")} loading={actionLoading === "temp-unlock"} color="bg-amber-500 hover:bg-amber-600 text-white shadow-sm h-[42px]" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Phone Captcha Code</label>
                        <input type="text" placeholder="e.g. 1234" value={offlineCaptcha} onChange={e => setOfflineCaptcha(e.target.value)} className="w-full mt-1 p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none" />
                      </div>
                      <div className="flex items-end">
                        <ActionBtn label="Get Unlock PIN" onClick={() => handleAction("offline-pin")} loading={actionLoading === "offline-pin"} color="bg-purple-600 hover:bg-purple-700 text-white shadow-sm h-[42px]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rules & Anti-Theft */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-md font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-500"/> Policy & Anti-Theft</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Apply Lock Rule to Device</label>
                        <div className="flex gap-3">
                          <select value={lockRuleNum} onChange={e => setLockRuleNum(e.target.value)} className="flex-1 p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none">
                            <option value="0">Rule 0 (Default Strict)</option>
                            <option value="1">Rule 1 (Custom Policy)</option>
                            <option value="2">Rule 2 (Custom Policy)</option>
                            <option value="3">Rule 3 (Custom Policy)</option>
                            <option value="4">Rule 4 (Custom Policy)</option>
                            <option value="5">Rule 5 (Custom Policy)</option>
                          </select>
                          <ActionBtn label="Apply Rule" onClick={() => handleAction("set-rule")} loading={actionLoading === "set-rule"} color="bg-blue-600 hover:bg-blue-700 text-white" />
                        </div>
                      </div>
                      <hr className="border-gray-100 dark:border-gray-700" />
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ring Phone (Anti-Theft)</label>
                        <div className="flex gap-2">
                          <input type="text" placeholder="Contact number to display..." value={findPhoneContact} onChange={e => setFindPhoneContact(e.target.value)} className="flex-1 p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none" />
                          <ActionBtn label="Ring" onClick={() => handleAction("find-submit")} loading={actionLoading === "find-submit"} color="bg-indigo-600 hover:bg-indigo-700 text-white" />
                          <ActionBtn label="Stop" onClick={() => handleAction("find-close")} loading={actionLoading === "find-close"} color="bg-red-100 text-red-700 hover:bg-red-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                     <ActionBtn label="Factory Reset SIM Lock" icon={<RefreshCw className="w-4 h-4"/>} onClick={() => handleAction("simlock-reset")} loading={actionLoading === "simlock-reset"} color="bg-gray-800 text-white w-full hover:bg-gray-900 dark:bg-gray-700" />
                  </div>
                </div>

                {/* Send Push Message */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:col-span-2">
                  <h3 className="text-md font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-500"/> Send Notification to Device</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Message Template</label>
                      <select 
                        onChange={(e) => {
                          const tmpl = PUSH_TEMPLATES[parseInt(e.target.value)];
                          setPushTitle(tmpl.title);
                          setPushContent(tmpl.content);
                          setPushType(tmpl.type);
                        }} 
                        className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-800 dark:text-gray-200"
                      >
                        {PUSH_TEMPLATES.map((t, idx) => <option key={idx} value={idx}>{t.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Message Title</label>
                      <input type="text" placeholder="Short title..." value={pushTitle} onChange={e => setPushTitle(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Notification Type</label>
                      <select value={pushType} onChange={e => setPushType(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none">
                        <option value="1">Full Screen Pop-up Warning</option>
                        <option value="2">Standard Push Notification</option>
                        <option value="3">Audio Spoken Message</option>
                        <option value="4">Promise-to-Pay Screen</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Full Message Content</label>
                      <textarea placeholder="Write the message that will appear on the user's screen..." value={pushContent} onChange={e => setPushContent(e.target.value)} className="w-full p-3 border rounded-lg text-sm bg-gray-50 dark:bg-gray-900 h-24 outline-none resize-none" />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <ActionBtn label="Send Message to Phone" onClick={() => handleAction("send-push")} loading={actionLoading === "send-push"} color="bg-blue-600 hover:bg-blue-700 text-white px-8" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "global" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Informational Cards */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-blue-500"/> Account Licenses</h3>
              <button onClick={() => handleGlobalAction("license")} disabled={actionLoading === "license"} className="w-full mb-6 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                {actionLoading === "license" ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>} Refresh License Data
              </button>
              
              {licenseInfo ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Licenses</p>
                    <p className="text-2xl font-black text-gray-800 dark:text-white">{(licenseInfo.totalAmountOfLicense ?? licenseInfo.totalNum ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Available</p>
                      <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{(licenseInfo.remainingAmountOfLicense ?? licenseInfo.availableLicenses ?? licenseInfo.unusedNum ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Used</p>
                      <p className="text-xl font-black text-blue-700 dark:text-blue-300">{(licenseInfo.amountUsedOfLicense ?? licenseInfo.usedNum ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Click refresh to load license data</p>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500"/> Merchant Profile</h3>
              <button onClick={() => handleGlobalAction("config")} disabled={actionLoading === "config"} className="w-full mb-6 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
                {actionLoading === "config" ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>} Fetch Company Info
              </button>
              
              {companyConfig ? (
                <div className="space-y-3">
                  <InfoRow label="Customer Service #" value={companyConfig.customerServiceNum || "—"} />
                  <InfoRow label="Screen Blocked Msg" value={companyConfig.screenBlockedContent ? "Configured" : "None"} />
                  <InfoRow label="App Blocked Msg" value={companyConfig.appBlockedContent ? "Configured" : "None"} />
                  <InfoRow label="Auto Popup Msg" value={companyConfig.autoPopupContent ? "Configured" : "None"} />
                  <InfoRow label="SIM Removed Watermark" value={companyConfig.watermarkOfSimRemovedContent ? "Configured" : "None"} />
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Click fetch to load company data</p>
              )}
            </div>
          </div>

          {/* Rule Builder Form */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2"><Shield className="w-6 h-6 text-blue-600"/> Rule Policy Builder</h3>
                  <p className="text-sm text-gray-500 mt-1">Configure exactly what happens when a device is locked.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-gray-600">Editing Rule:</label>
                  <select value={ruleConfig.ruleNum} onChange={e => setRuleConfig({...ruleConfig, ruleNum: parseInt(e.target.value)})} className="p-2 border-2 border-blue-200 rounded-xl font-bold bg-blue-50 text-blue-700 outline-none focus:border-blue-500">
                    <option value={0}>Rule 0 (Default Strict)</option>
                    <option value={1}>Rule 1 (Custom)</option>
                    <option value={2}>Rule 2 (Custom)</option>
                    <option value={3}>Rule 3 (Custom)</option>
                    <option value={4}>Rule 4 (Custom)</option>
                    <option value={5}>Rule 5 (Custom)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Screen Block */}
                <div className={`p-5 rounded-2xl border-2 transition-colors ${ruleConfig.screenBlockedEnabled ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <label className="flex items-center justify-between cursor-pointer mb-4">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Device Screen Lock</span>
                    <input type="checkbox" checked={ruleConfig.screenBlockedEnabled} onChange={e => setRuleConfig({...ruleConfig, screenBlockedEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  </label>
                  {ruleConfig.screenBlockedEnabled && (
                    <div className="space-y-3 mt-2">
                      <input type="text" placeholder="Main Title (e.g. Phone Locked)" value={ruleConfig.screenBlockedTitle} onChange={e => setRuleConfig({...ruleConfig, screenBlockedTitle: e.target.value})} className="w-full p-2 text-sm border rounded-lg" />
                      <textarea placeholder="Message body..." value={ruleConfig.screenBlockedContent} onChange={e => setRuleConfig({...ruleConfig, screenBlockedContent: e.target.value})} className="w-full p-2 text-sm border rounded-lg h-16 resize-none" />
                      <input type="text" placeholder="Contact Phone Number" value={ruleConfig.screenBlockedPhone} onChange={e => setRuleConfig({...ruleConfig, screenBlockedPhone: e.target.value})} className="w-full p-2 text-sm border rounded-lg" />
                    </div>
                  )}
                </div>

                {/* App Block */}
                <div className={`p-5 rounded-2xl border-2 transition-colors ${ruleConfig.appBlockEnabled ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <label className="flex items-center justify-between cursor-pointer mb-4">
                    <span className="font-bold text-gray-800 dark:text-gray-200">App Restrictions</span>
                    <input type="checkbox" checked={ruleConfig.appBlockEnabled} onChange={e => setRuleConfig({...ruleConfig, appBlockEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  </label>
                  {ruleConfig.appBlockEnabled && (
                    <div className="space-y-3 mt-2">
                      <select value={ruleConfig.appBlockType} onChange={e => setRuleConfig({...ruleConfig, appBlockType: parseInt(e.target.value)})} className="w-full p-2 text-sm border rounded-lg">
                        <option value={1}>Blacklist (Block these apps)</option>
                        <option value={2}>Whitelist (Allow ONLY these apps)</option>
                      </select>
                      <textarea placeholder="e.g. com.whatsapp, com.facebook.katana" value={ruleConfig.appBlockPackages} onChange={e => setRuleConfig({...ruleConfig, appBlockPackages: e.target.value})} className="w-full p-2 text-sm border rounded-lg h-20 resize-none font-mono" />
                      <p className="text-[10px] text-gray-500">Separate package names with commas.</p>
                    </div>
                  )}
                </div>

                {/* Incoming Calls */}
                <div className={`p-5 rounded-2xl border-2 transition-colors ${ruleConfig.callsInEnabled ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <label className="flex items-center justify-between cursor-pointer mb-4">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Incoming Calls</span>
                    <input type="checkbox" checked={ruleConfig.callsInEnabled} onChange={e => setRuleConfig({...ruleConfig, callsInEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  </label>
                  {ruleConfig.callsInEnabled && (
                    <div className="space-y-3 mt-2">
                      <select value={ruleConfig.callsInType} onChange={e => setRuleConfig({...ruleConfig, callsInType: parseInt(e.target.value)})} className="w-full p-2 text-sm border rounded-lg">
                        <option value={1}>Blacklist (Block these numbers)</option>
                        <option value={2}>Whitelist (Allow ONLY these numbers)</option>
                      </select>
                      <textarea placeholder="e.g. 03001234567, 03211234567" value={ruleConfig.callsInNumbers} onChange={e => setRuleConfig({...ruleConfig, callsInNumbers: e.target.value})} className="w-full p-2 text-sm border rounded-lg h-16 resize-none" />
                    </div>
                  )}
                </div>

                {/* Outgoing Calls */}
                <div className={`p-5 rounded-2xl border-2 transition-colors ${ruleConfig.callsOutEnabled ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <label className="flex items-center justify-between cursor-pointer mb-4">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Outgoing Calls</span>
                    <input type="checkbox" checked={ruleConfig.callsOutEnabled} onChange={e => setRuleConfig({...ruleConfig, callsOutEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  </label>
                  {ruleConfig.callsOutEnabled && (
                    <div className="space-y-3 mt-2">
                      <select value={ruleConfig.callsOutType} onChange={e => setRuleConfig({...ruleConfig, callsOutType: parseInt(e.target.value)})} className="w-full p-2 text-sm border rounded-lg">
                        <option value={1}>Blacklist (Block these numbers)</option>
                        <option value={2}>Whitelist (Allow ONLY these numbers)</option>
                      </select>
                      <textarea placeholder="e.g. 03001234567, 03211234567" value={ruleConfig.callsOutNumbers} onChange={e => setRuleConfig({...ruleConfig, callsOutNumbers: e.target.value})} className="w-full p-2 text-sm border rounded-lg h-16 resize-none" />
                    </div>
                  )}
                </div>

                {/* Watermark */}
                <div className={`p-5 rounded-2xl border-2 transition-colors ${ruleConfig.watermarkEnabled ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <label className="flex items-center justify-between cursor-pointer mb-4">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Screen Watermark</span>
                    <input type="checkbox" checked={ruleConfig.watermarkEnabled} onChange={e => setRuleConfig({...ruleConfig, watermarkEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  </label>
                  {ruleConfig.watermarkEnabled && (
                    <div className="space-y-3 mt-2">
                      <input type="text" placeholder="Watermark Text" value={ruleConfig.watermarkText} onChange={e => setRuleConfig({...ruleConfig, watermarkText: e.target.value})} className="w-full p-2 text-sm border rounded-lg" />
                      <div className="flex gap-2">
                        <input type="color" value={ruleConfig.watermarkColor} onChange={e => setRuleConfig({...ruleConfig, watermarkColor: e.target.value})} className="h-10 w-16 p-1 border rounded-lg cursor-pointer" title="Watermark Color" />
                        <input type="number" placeholder="Size (e.g. 20)" value={ruleConfig.watermarkSize} onChange={e => setRuleConfig({...ruleConfig, watermarkSize: parseInt(e.target.value)})} className="flex-1 p-2 text-sm border rounded-lg" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto Popup */}
                <div className={`p-5 rounded-2xl border-2 transition-colors ${ruleConfig.autoPopupEnabled ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                  <label className="flex items-center justify-between cursor-pointer mb-4">
                    <span className="font-bold text-gray-800 dark:text-gray-200">Auto Warning Popup</span>
                    <input type="checkbox" checked={ruleConfig.autoPopupEnabled} onChange={e => setRuleConfig({...ruleConfig, autoPopupEnabled: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                  </label>
                  {ruleConfig.autoPopupEnabled && (
                    <div className="space-y-3 mt-2">
                      <input type="text" placeholder="Popup Title" value={ruleConfig.autoPopupTitle} onChange={e => setRuleConfig({...ruleConfig, autoPopupTitle: e.target.value})} className="w-full p-2 text-sm border rounded-lg" />
                      <textarea placeholder="Popup message..." value={ruleConfig.autoPopupContent} onChange={e => setRuleConfig({...ruleConfig, autoPopupContent: e.target.value})} className="w-full p-2 text-sm border rounded-lg h-16 resize-none" />
                    </div>
                  )}
                </div>

              </div>

              <div className="mt-8 border-t border-gray-100 dark:border-gray-700 pt-8">
                <button onClick={() => handleGlobalAction("update-rule")} disabled={actionLoading === "update-rule"} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none">
                  {actionLoading === "update-rule" ? <Loader2 className="w-6 h-6 animate-spin"/> : <Shield className="w-6 h-6"/>} SAVE RULE POLICY
                </button>
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider truncate mr-4">{label}</span>
      <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate max-w-[200px] text-right" title={value}>{value}</span>
    </div>
  );
}

function ActionBtn({ label, icon, onClick, loading, color, className = "" }: any) {
  return (
    <button onClick={onClick} disabled={loading} className={`px-4 py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${color} ${className}`}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
