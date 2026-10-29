"use client";

import { useEffect, useState, Suspense, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import {
  Search,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Database,
  Edit3,
  Loader2,
  Filter,
  RefreshCw,
  TrendingUp,
  X,
  FileDown,
  Maximize2,
  Minimize2,
  Receipt,
  Wallet,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import SmartPayQrModal from "@/components/Installments/SmartPayQrModal";
import InstallmentNotesHistory from "@/components/Installments/InstallmentNotesHistory";
import DateRangeFilter, { type DateRange } from "@/components/Accounts/DateRangeFilter";
import OutletSelector from "@/components/common/OutletSelector";
import { formatExactDate } from "@/utils/dateUtils";
import { getErrorMessage } from "@/lib/apiErrors";
import { pktDate } from '@/utils/pkt'
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = Cookies.get("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

const ACCOUNT_CATEGORIES = [
  ['all', 'All Accounts', 'All outstanding accounts + paid installments this month'],
  ['regular', 'Regular Accounts', 'Current installment only; no older arrears'],
  ['fresh', 'Fresh Accounts', 'Due today or upcoming; no overdue installment'],
  ['overdue', 'Overdue Accounts', '2+ unpaid installments due'],
  ['blacklist', 'Blacklist Accounts', '3+ unpaid installments due'],
  ['defaulter', 'Defaulter Accounts', '3+ due; no payment for 3 months'],
  ['ptp', 'PTP Accounts', 'Accounts with a promise to pay'],
] as const;

// How a payment-history entry came in, from its recorded method text
// (same rules as the backend's accountsLedgerData.classifyMethod).
const methodLabel = (method?: string) => {
  const m = String(method || "").toLowerCase();
  if (m.includes("smartpay") || m.includes(" qr") || m.startsWith("qr")) return "Online — QR";
  if (m.includes("1link") || m.includes("tps") || m.includes("1bill")) return "Online — 1Link";
  if (m.includes("manual correction")) return "Admin Entry";
  if (m.includes("recovery")) return "Recovery Officer — Cash";
  if (!m || m === "cash") return "Cash";
  return method as string;
};
const receivedVia = (inst: any): string[] =>
  Array.from(new Set<string>(
    (inst.paymentHistory || [])
      .filter((h: any) => Number(h.amount) > 0 && !h.auto_applied && h.method !== "Overpayment carried forward")
      .map((h: any) => methodLabel(h.method))
  ));
// Row status as shown to users — stored "pending" reads "Unpaid".
const statusLabel = (s?: string) => s === "paid" ? "Paid" : s === "partial" ? "Partial" : "Unpaid";
const agingLabel = (days: number | null | undefined) =>
  days === null || days === undefined ? "Paid" : days === 0 ? "Due today" : `${days > 0 ? "+" : ""}${days} days`;
const METHOD_TONE = (m: string) =>
  /QR/.test(m) ? "bg-purple-50 text-purple-700 border-purple-200"
    : /1Link/.test(m) ? "bg-blue-50 text-blue-700 border-blue-200"
      : /Admin/.test(m) ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

interface InstallmentsViewProps {
  /** Super Admin view: every outlet, an outlet picker, and Outlet / Received Via columns. */
  adminMode?: boolean;
}

function SummaryValue({ loading, ready, value, currency = false }: { loading: boolean; ready: boolean; value: number; currency?: boolean }) {
  if (loading && !ready) {
    return (
      <span role="status" className="inline-flex items-center gap-2 text-sm font-medium text-gray-400">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        Loading...
      </span>
    );
  }
  if (!ready) return <span aria-label="Data unavailable">—</span>;
  return <>{currency ? 'Rs. ' : ''}{value.toLocaleString()}</>;
}

function InstallmentsViewContent({ adminMode = false }: InstallmentsViewProps) {
  const searchParams = useSearchParams();
  const [outletId, setOutletId] = useState("all");
  const [methodFilter, setMethodFilter] = useState("");
  const initialSearch = searchParams.get("search") || "";
  const initialCategory = (searchParams.get("category") as any) || "all";

  // UI States
  const [isFullView, setIsFullView] = useState(false);

  // Query state
  const [search, setSearch] = useState(initialSearch);
  // One due-list request after typing pauses, not one per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const fetchSeq = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const [category, setCategory] = useState<'all' | 'regular' | 'fresh' | 'overdue' | 'blacklist' | 'defaulter' | 'ptp' | 'impacted'>(initialCategory);
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  
  // Advanced Global Filters
  const [advFilters, setAdvFilters] = useState({
    item: "",
    ptp: "",
    lock_status: "",
    ro_id: "",
    min_amount: "",
    max_amount: "",
    min_balance: "",
    max_balance: ""
  });
  // Verification officer + From–To date (on installment due date or date of purchase)
  const [voFilter, setVoFilter] = useState("");
  const [verificationOfficers, setVerificationOfficers] = useState<{ key: string; name: string }[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [dateField, setDateField] = useState<'due' | 'purchase'>('due');
  const [agingSort, setAgingSort] = useState<'' | 'aging_asc' | 'aging_desc'>('');
  const selectedMonth = Number(pktDate(new Date()).slice(5, 7));
  const selectedYear = Number(pktDate(new Date()).slice(0, 4));
  const [categoryCounts, setCategoryCounts] = useState<Record<string, { customers: number }>>({});
  const [agingPreset, setAgingPreset] = useState('all');
  const [agingMin, setAgingMin] = useState('');
  const [agingMax, setAgingMax] = useState('');
  const [customAgingType, setCustomAgingType] = useState<'overdue' | 'upcoming'>('overdue');
  // Custom inputs are positive day counts; the API uses negative days for overdue.
  const customDayFloor = customAgingType === 'overdue' ? 1 : 0;
  const customFrom = String(Math.max(customDayFloor, Number(agingMin) || 0));
  const customTo = agingMax === '' ? '' : String(Math.max(customDayFloor, Number(agingMax) || 0));
  const queryAgingMin = agingPreset !== 'custom' ? agingMin
    : customAgingType === 'overdue' ? (customTo === '' ? '' : String(-Number(customTo))) : customFrom;
  const queryAgingMax = agingPreset !== 'custom' ? agingMax
    : customAgingType === 'overdue' ? String(-Number(customFrom)) : customTo;
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number | "all">(50);

  // Column-level advanced filters
  const [colFilters, setColFilters] = useState({
    order_ref: "",
    customer_name: "",
    whatsapp_number: "",
    alternate_number: "",
    area: "",
    grantor1Name: "",
    grantor2Name: "",
    product_name: "",
    imei_serial: "",
    status: ""
  });
  const updateColumnFilter = (key: keyof typeof colFilters, value: string) => {
    setColFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
    setSelectedRows([]);
  };

  // Data states
  const [installments, setInstallments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDueThisMonth: 0,
    totalPaidThisMonth: 0,
    remainingThisMonth: 0,
    overallSystemRemaining: 0,
    overallSystemPaid: 0,
    monthsDue: 0,
    monthsCollected: 0,
    monthsCollectedAdvance: 0,
    monthsCollectedTotal: 0,
    monthsRemainingAmount: 0,
    customerCount: 0
  });
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [summaryReady, setSummaryReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const resultCache = useRef(new Map<string, { data: any; savedAt: number }>());
  const [displayedPage, setDisplayedPage] = useState(1);
  const [debouncedColFilters, setDebouncedColFilters] = useState(colFilters);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedColFilters(colFilters), 350);
    return () => clearTimeout(timer);
  }, [colFilters]);

  // Selection states
  const [selectedRows, setSelectedRows] = useState<string[]>([]); // Array of orderRef_dueDate keys

  // Notes Modal state
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeOrderForNote, setActiveOrderForNote] = useState<{ id: number; ref: string; customer: string; monthNumber: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteHistoryKey, setNoteHistoryKey] = useState(0);

  // QR Modal state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrOrderId, setQrOrderId] = useState<number | null>(null);
  const [qrMonthNumber, setQrMonthNumber] = useState<number | null>(null);
  const [qrDefaultAmount, setQrDefaultAmount] = useState<number | null>(null);
  const [qrCustomerName, setQrCustomerName] = useState("");

  // Bulk Reminder Modal state
  const [bulkReminderModalOpen, setBulkReminderModalOpen] = useState(false);
  const [sendingBulk, setSendingBulk] = useState(false);

  // PTP (Promise to Pay) Modal state
  const [ptpModalOpen, setPtpModalOpen] = useState(false);
  const [ptpRow, setPtpRow] = useState<any>(null);
  const [ptpDate, setPtpDate] = useState("");
  const [ptpLoading, setPtpLoading] = useState(false);

  // Payment History Modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRow, setHistoryRow] = useState<any>(null);

  const openHistoryModal = (inst: any) => {
    setHistoryRow(inst);
    setHistoryModalOpen(true);
  };

  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return pktDate(d);
  })();

  // PTP can unlock the device for at most 10 days
  const maxPtpStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return pktDate(d);
  })();

  const openPtpModal = (inst: any) => {
    if (!inst.imei_serial) {
      toast.error("No IMEI/device associated with this order");
      return;
    }
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setPtpRow(inst);
    setPtpDate(pktDate(defaultDate));
    setPtpModalOpen(true);
  };

  const handleSubmitPtp = async () => {
    if (!ptpRow || !ptpDate) return;
    if (ptpDate > maxPtpStr) {
      toast.error("Promised payment date cannot be more than 10 days from today");
      return;
    }
    const promisedDate = new Date(ptpDate);
    promisedDate.setHours(23, 59, 59, 999);

    setPtpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/paytrigger/device/${ptpRow.imei_serial}/ptp`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ promised_date: promisedDate.toISOString() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Device temporarily unlocked until ${new Date(ptpDate).toLocaleDateString('en-PK')}. Customer notified via WhatsApp.`);
        setPtpModalOpen(false);
        fetchInstallments();
      } else {
        toast.error(data.message || "Failed to activate PTP");
      }
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e, "Error communicating with PayTrigger"));
    } finally {
      setPtpLoading(false);
    }
  };

  // Sync search & category URL params
  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
    if (initialCategory) setCategory(initialCategory);
  }, [initialSearch, initialCategory]);

  // Handle Escape key to exit full wall view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullView) {
        setIsFullView(false);
        toast.success("Exited Full Screen mode");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullView]);

  // Verification officer, From–To date and aging sort — same params for the grid and exports.
  const serverFilterParams = useMemo<Record<string, string>>(() => ({
    ...(voFilter && { vo: voFilter }),
    ...(dateRange.from && { start_date: dateRange.from }),
    ...(dateRange.to && { end_date: dateRange.to }),
    ...((dateRange.from || dateRange.to) && { date_field: dateField }),
    ...(agingSort && { sort: agingSort }),
  }), [voFilter, dateRange, dateField, agingSort]);

  // Fetch installments data from backend
  const fetchInstallments = useCallback(async (forceRefresh = true) => {
    const seq = ++fetchSeq.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setLoadError(false);
    if (forceRefresh) resultCache.current.clear();
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: String(limit),
        search: debouncedSearch,
        category,
        view_rules: 'current',
        aging_min: queryAgingMin,
        aging_max: queryAgingMax,
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
        ...(adminMode && outletId !== "all" && { outlet_id: outletId }),
        ...(adminMode && methodFilter && { method: methodFilter }),
        ...(advFilters.item && { item: advFilters.item }),
        ...(advFilters.ptp && { ptp: advFilters.ptp }),
        ...(advFilters.lock_status && { lock_status: advFilters.lock_status }),
        ...(advFilters.ro_id && { ro_id: advFilters.ro_id }),
        ...(advFilters.min_amount && { min_amount: advFilters.min_amount }),
        ...(advFilters.max_amount && { max_amount: advFilters.max_amount }),
        ...(advFilters.min_balance && { min_balance: advFilters.min_balance }),
        ...(advFilters.max_balance && { max_balance: advFilters.max_balance }),
        ...(debouncedColFilters.status && { status: debouncedColFilters.status }),
        ...(debouncedColFilters.order_ref && { order_ref: debouncedColFilters.order_ref }),
        ...(debouncedColFilters.customer_name && { customer_name: debouncedColFilters.customer_name }),
        ...(debouncedColFilters.whatsapp_number && { whatsapp_number: debouncedColFilters.whatsapp_number }),
        ...(debouncedColFilters.alternate_number && { alternate_number: debouncedColFilters.alternate_number }),
        ...(debouncedColFilters.area && { area: debouncedColFilters.area }),
        ...(debouncedColFilters.grantor1Name && { grantor1_name: debouncedColFilters.grantor1Name }),
        ...(debouncedColFilters.grantor2Name && { grantor2_name: debouncedColFilters.grantor2Name }),
        ...(debouncedColFilters.product_name && { product_name: debouncedColFilters.product_name }),
        ...(debouncedColFilters.imei_serial && { imei_serial: debouncedColFilters.imei_serial }),
        ...serverFilterParams
      });

      const applyData = (data: any) => {
        setInstallments(data.installments || []);
        setCategoryCounts(data.categories_summary || {});
        setVerificationOfficers(data.verification_officers || []);
        setStats(data.stats || {
          totalDueThisMonth: 0,
          totalPaidThisMonth: 0,
          remainingThisMonth: 0,
          overallSystemRemaining: 0,
          overallSystemPaid: 0,
          monthsDue: 0,
          monthsCollected: 0,
          monthsCollectedAdvance: 0,
          monthsCollectedTotal: 0,
          monthsRemainingAmount: 0,
          customerCount: 0
        });
        setPagination({
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        });
        setSummaryReady(true);
        setDisplayedPage(Number(data.pagination.page) || page);
      };
      const cacheKey = `${Cookies.get("auth_token") || ""}|${adminMode}|${queryParams}`;
      const cached = resultCache.current.get(cacheKey);
      // Show the exact previous query immediately, but always validate against the server.
      if (cached && Date.now() - cached.savedAt < 60_000) applyData(cached.data);

      const res = await fetch(`${API_BASE}/api/outlet/installments/due-list?${queryParams.toString()}`, {
        headers: getAuthHeaders(),
        signal: controller.signal
      });

      const resData = await res.json();
      if (seq !== fetchSeq.current) return; // a newer search already went out
      if (res.ok && resData.success) {
        resultCache.current.set(cacheKey, { data: resData.data, savedAt: Date.now() });
        if (resultCache.current.size > 20) resultCache.current.delete(resultCache.current.keys().next().value!);
        applyData(resData.data);
      } else {
        setLoadError(true);
        toast.error(resData.message || "Failed to load installments");
      }
    } catch (err) {
      if (controller.signal.aborted || seq !== fetchSeq.current) return;
      setLoadError(true);
      console.error(err);
      toast.error(getErrorMessage(err, "Error connecting to backend"));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [page, limit, debouncedSearch, category, selectedMonth, selectedYear, advFilters, debouncedColFilters, queryAgingMin, queryAgingMax, adminMode, outletId, methodFilter, serverFilterParams]);

  useEffect(() => {
    // Do not fetch the old search when typing resets pagination to page one.
    if (search !== debouncedSearch || colFilters !== debouncedColFilters) return;
    fetchInstallments(false);
    return () => {
      activeRequest.current?.abort();
      fetchSeq.current++;
    };
  }, [fetchInstallments, search, debouncedSearch, colFilters, debouncedColFilters]);

  // All filters are applied server-side before pagination and aggregation.
  const filteredInstallments = installments;
  const displayedMonthsDue = stats.monthsDue;
  const displayedMonthsCollected = stats.monthsCollected;
  const displayedMonthsCollectedAdvance = stats.monthsCollectedAdvance;

  const displayedMonthsCollectedTotal = displayedMonthsCollected + displayedMonthsCollectedAdvance;

  // Unpaid balance of the selected month's installments — not due minus
  // collected, since collected also counts arrears/prepaid months and went negative.
  const displayedMonthsRemaining = stats.monthsRemainingAmount || 0;
  const displayedSystemPaid = stats.overallSystemPaid;
  const displayedSystemOutstanding = stats.overallSystemRemaining;
  const displayedCustomerCount = stats.customerCount;

  // Handle Multi-Checkbox Selection
  const getRowKey = (inst: any) => `${inst.order_ref}_${inst.dueDate}`;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(filteredInstallments.map(getRowKey));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (inst: any, checked: boolean) => {
    const key = getRowKey(inst);
    if (checked) {
      setSelectedRows(prev => [...prev, key]);
    } else {
      setSelectedRows(prev => prev.filter(k => k !== key));
    }
  };

  const getExportData = (rowsToExport: any[]) => {
    return rowsToExport.map((row, idx) => {
      const paymentHistoryStr = row.paymentHistory && row.paymentHistory.length > 0
        ? row.paymentHistory.map((h: any) => `${formatExactDate(h.date, 'DD MMM YYYY, hh:mm A')}: Rs. ${h.amount} (${h.method})`).join(" | ")
        : row.paidDate
          ? formatExactDate(row.paidDate, 'DD MMM YYYY, hh:mm A')
          : "-";

      return [
        idx + 1,
        ...(adminMode ? [row.outlet_name || '', receivedVia(row).join(', ')] : []),
        row.area || '',
        row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-PK") : '',
        row.purchaseDate ? formatExactDate(row.purchaseDate, 'DD MMM YYYY, hh:mm A') : '',
        row.customer_name || '',
        row.whatsapp_number || '',
        row.alternate_number || '',
        row.grantor1Name || '',
        row.grantor1Phone || '',
        row.grantor2Name || '',
        row.grantor2Phone || '',
        row.product_name || '',
        row.imei_serial || '',
        row.monthlyAmount || 0,
        row.payableAmount || 0,
        row.partialPayment || "-",
        paymentHistoryStr,
        row.consumer_number || '',
        row.note ? `${row.note}${row.note_by ? ` (by ${row.note_by})` : ''}` : '',
        row.recovery_officer?.name || '',
        row.verification_officer?.name || '',
        row.order_ref || '',
        row.arrearsAmount || 0,
        row.smartpay_consumer_number || '',
        statusLabel(row.status),
        row.agingDays ?? '',
        row.dueInstallmentCount ?? 0
      ];
    });
  };

  const getExportHeaders = () => [
    "S No.", ...(adminMode ? ["Outlet", "Received Via"] : []), "Area", "Installment Due Date", "Date of Purchase", "Customer Name", "Contact No.", "Alternate No.",
    "G1. Name", "G1. No.", "G2. Name", "G2. Number", "Item", "Device Serial No.", "Installment Amount",
    "Due Amount", "Partial Payment", "Paid Date / History", "1Bill ID", "Installment Note", "Recovery Officer",
    "Verification Officer", "Order Ref", "Arrears", "SmartPay Consumer No.", "Status", "Aging (days)", "Due Installments"
  ];

  const exportPDF = async (rowsToExport: any[], filename: string) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const headers = getExportHeaders();
    const data = getExportData(rowsToExport);

    doc.setFontSize(14);
    doc.text(`Installments Report - ${filename}`, 40, 40);
    
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 60,
      styles: { fontSize: 6, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [227, 30, 36], textColor: 255, fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 20 },
        // other columns will auto-size
      },
      margin: { top: 60, left: 20, right: 20, bottom: 20 }
    });

    doc.save(`${filename}.pdf`);
  };

  const exportExcel = async (rowsToExport: any[], filename: string) => {
    const XLSX = await import("xlsx");
    const headers = getExportHeaders();
    const data = getExportData(rowsToExport);
    
    // Unshift headers into data
    const worksheetData = [headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Installments");
    
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const handleExportAll = async (type: 'pdf' | 'excel') => {
    setExporting(true);
    try {
      const rows: any[] = [];
      let exportPage = 1, totalPages = 1;
      do {
        const params = new URLSearchParams({
          page: String(exportPage), limit: '1000', search: debouncedSearch,
          category, view_rules: 'current', month: String(selectedMonth), year: String(selectedYear),
          aging_min: queryAgingMin, aging_max: queryAgingMax, ...advFilters, status: colFilters.status,
          ...(colFilters.order_ref && { order_ref: colFilters.order_ref }),
          ...(colFilters.customer_name && { customer_name: colFilters.customer_name }),
          ...(colFilters.whatsapp_number && { whatsapp_number: colFilters.whatsapp_number }),
          ...(colFilters.alternate_number && { alternate_number: colFilters.alternate_number }),
          ...(colFilters.area && { area: colFilters.area }),
          ...(colFilters.grantor1Name && { grantor1_name: colFilters.grantor1Name }),
          ...(colFilters.grantor2Name && { grantor2_name: colFilters.grantor2Name }),
          ...(colFilters.product_name && { product_name: colFilters.product_name }),
          ...(colFilters.imei_serial && { imei_serial: colFilters.imei_serial }),
          ...(adminMode && outletId !== "all" && { outlet_id: outletId }),
          ...(adminMode && methodFilter && { method: methodFilter }),
          ...serverFilterParams,
        });
        const response = await fetch(`${API_BASE}/api/outlet/installments/due-list?${params}`, { headers: getAuthHeaders() });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Export failed');
        rows.push(...result.data.installments);
        totalPages = result.data.pagination.totalPages;
        exportPage++;
      } while (exportPage <= totalPages);
      const matching = rows;
      if (!matching.length) { toast.error('No matching accounts to export'); return; }
      const filename = `Installments_${selectedYear}_${selectedMonth}_${category}`;
      if (type === 'pdf') await exportPDF(matching, filename);
      else await exportExcel(matching, filename);
      toast.success(`Exported ${matching.length} accounts`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally { setExporting(false); }
  };

  // Open Notes Modal
  const openNoteDialog = (inst: any) => {
    setActiveOrderForNote({
      id: inst.order_id,
      ref: inst.order_ref,
      customer: inst.customer_name,
      monthNumber: inst.monthNumber
    });
    setNoteText("");
    setNoteModalOpen(true);
  };

  // Adds a new note (old notes are kept as history, never overwritten)
  const handleSaveNote = async () => {
    if (!activeOrderForNote) return;
    if (!noteText.trim()) {
      toast.error("Write a note first");
      return;
    }
    setSavingNote(true);

    try {
      const res = await fetch(`${API_BASE}/api/outlet/installments/${activeOrderForNote.id}/note`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          note: noteText,
          month_number: activeOrderForNote.monthNumber
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Note added");
        setNoteText("");
        setNoteHistoryKey(k => k + 1);
        // Newest note shows on the account's row right away
        setInstallments(prev =>
          prev.map(inst => inst.order_id === activeOrderForNote.id
            ? { ...inst, note: data.data.note, note_by: data.data.user_name, note_at: data.data.created_at, note_count: (inst.note_count || 0) + 1 }
            : inst)
        );
      } else {
        toast.error(data.message || "Failed to save note");
      }
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err, "Error saving note"));
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className={`mx-auto ${isFullView ? 'fixed inset-0 z-[999999] bg-[#f8fafc] dark:bg-boxdark w-screen h-screen overflow-y-auto p-4 md:p-8 animate-fade-in' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'} transition-all duration-300`}>

      {/* HEADER SECTION */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            Installments <span className="text-[#E31E24] font-light text-xl">View</span>
            {isFullView && (
              <span className="ml-3 inline-flex items-center rounded-full bg-red-100 dark:bg-meta-4 px-2.5 py-0.5 text-[10px] font-black uppercase text-[#E31E24] tracking-widest animate-pulse">
                Full Wall Mode
              </span>
            )}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            {adminMode
              ? "Every outlet's installments — who has paid, how it was received, and what is still due."
              : "High-fidelity flat matrix view of customer installment ledgers with advanced query actions."}
          </p>
        </div>
        {adminMode && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-sm dark:bg-boxdark">
            <OutletSelector selectedId={outletId} onSelect={(id) => { setOutletId(id); setPage(1); setSelectedRows([]); }} allLabel="All Outlets" />
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              Received via:
              <select
                value={methodFilter}
                onChange={(e) => { setMethodFilter(e.target.value); setPage(1); setSelectedRows([]); }}
                className="rounded-lg border border-stroke bg-white px-3 py-1.5 text-sm font-medium text-dark outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
              >
                <option value="">Any method</option>
                <option value="cash">Cash (branch / officer)</option>
                <option value="qr">Online — QR</option>
                <option value="1link">Online — 1Link</option>
                <option value="admin">Admin Entry</option>
                <option value="none">Nothing received yet</option>
              </select>
            </label>
          </div>
        )}

      </div>

      {/* STATISTICS CARDS SECTION */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Months Due</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedMonthsDue} currency /></h3>
            </div>
            <div className="rounded-xl bg-[#E31E24]/5 p-2.5 text-[#E31E24]">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-[#E31E24]/20" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Months Collected</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedMonthsCollected} currency /></h3>
              <p className="mt-1 text-[9px] text-gray-400">Installments only, no down payment</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500/20" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Collected (This Month)</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedMonthsCollectedTotal} currency /></h3>
              <p className="mt-1 text-[9px] text-gray-400">Down payment + installments</p>
            </div>
            <div className="rounded-xl bg-teal-50 p-2.5 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-teal-500/20" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Months Remaining</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedMonthsRemaining} currency /></h3>
            </div>
            <div className="rounded-xl bg-[#E31E24]/5 p-2.5 text-[#E31E24]">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-[#E31E24]/20" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total System Paid</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedSystemPaid} currency /></h3>
            </div>
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-purple-500/20" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">System Outstanding</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedSystemOutstanding} currency /></h3>
            </div>
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-meta-4 dark:text-slate-300">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-500/20" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-100/50 dark:bg-boxdark dark:border-strokedark">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Customer Count</p>
              <h3 className="mt-2 text-xl font-black text-slate-800 dark:text-white"><SummaryValue loading={loading} ready={summaryReady} value={displayedCustomerCount} /></h3>
            </div>
            <div className="rounded-xl bg-teal-50 p-2.5 text-teal-600 dark:bg-meta-4 dark:text-teal-300">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 h-1 w-full bg-teal-500/20" />
        </div>

      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" aria-label="Account categories">
        {ACCOUNT_CATEGORIES.map(([id, label, detail]) => (
          <button key={id} type="button" aria-pressed={category === id}
            onClick={() => { setCategory(id); setPage(1); setSelectedRows([]); }}
            className={`rounded-2xl border p-4 text-left transition-colors ${category === id ? 'border-[#E31E24] bg-red-50 text-[#E31E24] dark:bg-red-950/20' : 'border-gray-100 bg-white text-slate-700 dark:bg-boxdark dark:text-white dark:border-strokedark'}`}>
            <span className="block text-xs font-bold">{label}</span>
            <span className="my-2 block text-2xl font-black"><SummaryValue loading={loading} ready={summaryReady} value={categoryCounts[id]?.customers ?? 0} /></span>
            <span className="block text-[10px] leading-relaxed">{detail}</span>
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 dark:bg-boxdark">
        <label className="text-xs font-bold">Installment aging
          <select value={agingPreset} onChange={e => {
            const value = e.target.value; setAgingPreset(value); setPage(1); setSelectedRows([]);
            const ranges: Record<string, [string, string]> = { all: ['', ''], due10: ['-10', '-1'], due20: ['-20', '-1'], due30: ['-30', '-1'], upcoming10: ['0', '10'], upcoming20: ['0', '20'], upcoming30: ['0', '30'], custom: ['', ''] };
            const [min, max] = ranges[value]; setAgingMin(min); setAgingMax(max);
          }} className="ml-3 rounded-lg border border-gray-200 bg-transparent p-2 dark:border-strokedark">
            <option value="all">All aging</option>
            <option value="due10">Overdue 1-10 days</option><option value="due20">Overdue 1-20 days</option><option value="due30">Overdue 1-30 days</option>
            <option value="upcoming10">Due in 0-10 days</option><option value="upcoming20">Due in 0-20 days</option><option value="upcoming30">Due in 0-30 days</option>
            <option value="custom">Custom days</option>
          </select>
        </label>
        {agingPreset === 'custom' && <>
          <label className="text-xs">Type
            <select value={customAgingType} onChange={e => { setCustomAgingType(e.target.value as 'overdue' | 'upcoming'); setPage(1); setSelectedRows([]); }} className="ml-2 rounded-lg border bg-transparent p-2">
              <option value="overdue">Overdue</option>
              <option value="upcoming">Due in</option>
            </select>
          </label>
          <label className="text-xs">From days<input type="number" min={customDayFloor} step="1" value={agingMin} onChange={e => { setAgingMin(e.target.value === '' ? '' : String(Math.max(customDayFloor, Math.floor(Number(e.target.value))))); setPage(1); setSelectedRows([]); }} className="ml-2 w-24 rounded-lg border bg-transparent p-2" placeholder={String(customDayFloor)} /></label>
          <label className="text-xs">To days<input type="number" min={customDayFloor} step="1" value={agingMax} onChange={e => { setAgingMax(e.target.value === '' ? '' : String(Math.max(customDayFloor, Math.floor(Number(e.target.value))))); setPage(1); setSelectedRows([]); }} className="ml-2 w-24 rounded-lg border bg-transparent p-2" placeholder="Any" /></label>
          {agingMin !== '' && agingMax !== '' && Number(agingMin) > Number(agingMax) && <span role="alert" className="text-xs text-red-600">From must be less than or equal to To.</span>}
        </>}
        <p className="w-full text-xs text-gray-400">Aging uses the oldest unpaid installment: + days until due, - days overdue, 0 due today. Categories can overlap.</p>
      </div>

      {/* FILTER TABS & CONTROL ACTIONS */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white dark:bg-boxdark px-4 py-2.5 rounded-3xl shadow-sm border border-gray-100 dark:border-strokedark">



        {/* Global Search and CSV Exports */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search everything..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setSelectedRows([]);
              }}
              className="w-full rounded-2xl border-gray-100 bg-gray-50/50 py-2 pl-9 pr-4 text-xs outline-none focus:border-[#E31E24] focus:bg-white dark:border-strokedark dark:bg-meta-4 dark:text-white"
            />
          </div>
          
          <button
            onClick={() => setShowAdvFilters(!showAdvFilters)}
            className={`flex items-center gap-1.5 rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${showAdvFilters ? 'bg-[#E31E24]/10 border-[#E31E24]/30 text-[#E31E24]' : 'border-gray-100 dark:border-strokedark bg-white dark:bg-boxdark hover:bg-gray-50 text-gray-600 dark:text-white'}`}
          >
            <Filter className={`h-4 w-4 ${showAdvFilters ? 'text-[#E31E24]' : 'text-gray-400'}`} /> Filters
          </button>

          {/* TRUE FULL-WALL WINDOW OVERLAY TOGGLE */}
          <button
            onClick={() => {
              setIsFullView(!isFullView);
              if (!isFullView) {
                toast.success("Switched to Full Wall Screen mode! (Press ESC to exit)");
              } else {
                toast.success("Returned to standard dashboard layout");
              }
            }}
            className="flex items-center gap-1.5 rounded-2xl border border-gray-100 dark:border-strokedark bg-[#E31E24]/5 hover:bg-[#E31E24]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#E31E24] transition-all cursor-pointer"
            title={isFullView ? "Exit Fullscreen (Esc)" : "Full Wall Screen mode"}
          >
            {isFullView ? (
              <>
                <Minimize2 className="h-4 w-4" /> Exit Fullscreen (Esc)
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" /> Full Wall Screen
              </>
            )}
          </button>

          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => handleExportAll('pdf')}
              disabled={exporting || loading || loadError}
              className="flex items-center gap-1.5 rounded-l-2xl bg-[#E31E24] hover:bg-[#c7161c] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm hover:shadow-md transition-all cursor-pointer border-r border-[#c7161c]"
            >
              <FileDown className="h-4 w-4" /> All PDF
            </button>
            <button
              onClick={() => handleExportAll('excel')}
              disabled={exporting || loading || loadError}
              className="flex items-center gap-1.5 rounded-r-2xl bg-[#E31E24] hover:bg-[#c7161c] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" /> All Excel
            </button>
          </div>

          <button
            disabled={loading || loadError}
            onClick={() => setBulkReminderModalOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl border border-[#E31E24] bg-white hover:bg-gray-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#E31E24] transition-all cursor-pointer dark:bg-boxdark dark:hover:bg-meta-4"
            title="Bulk Reminders"
          >
            <Calendar className="h-4 w-4" /> Bulk Reminders
          </button>

          <button
            onClick={() => fetchInstallments(true)}
            className="flex items-center justify-center p-2.5 rounded-2xl border border-gray-100 dark:border-strokedark bg-white dark:bg-boxdark text-gray-400 hover:text-[#E31E24] hover:bg-gray-50 transition-all cursor-pointer"
            title="Refresh Ledger Grid"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ADVANCED FILTERS PANEL */}
      {showAdvFilters && (
        <div className="mb-6 bg-white dark:bg-boxdark p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-strokedark animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Item Name</label>
              <input
                type="text"
                placeholder="Search Item..."
                value={advFilters.item}
                onChange={(e) => { setAdvFilters({ ...advFilters, item: e.target.value }); setPage(1); }}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">PTP Status</label>
              <select
                value={advFilters.ptp}
                onChange={(e) => { setAdvFilters({ ...advFilters, ptp: e.target.value }); setPage(1); }}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
              >
                <option value="">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Lock Status</label>
              <select
                value={advFilters.lock_status}
                onChange={(e) => { setAdvFilters({ ...advFilters, lock_status: e.target.value }); setPage(1); }}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
              >
                <option value="">Any</option>
                <option value="unlocked">Unlocked</option>
                <option value="locked">Locked</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Recovery Officer ID</label>
              <input
                type="number"
                placeholder="RO ID..."
                value={advFilters.ro_id}
                onChange={(e) => { setAdvFilters({ ...advFilters, ro_id: e.target.value }); setPage(1); }}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Verification Officer</label>
              <select
                value={voFilter}
                onChange={(e) => { setVoFilter(e.target.value); setPage(1); setSelectedRows([]); }}
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
              >
                <option value="">All officers</option>
                {verificationOfficers.map((o) => (
                  <option key={o.key} value={o.key}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2 md:col-span-4 lg:col-span-6">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Date Range (From – To)</label>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={dateField}
                  onChange={(e) => { setDateField(e.target.value as 'due' | 'purchase'); setPage(1); setSelectedRows([]); }}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
                  aria-label="Date to filter on"
                >
                  <option value="due">Installment due date</option>
                  <option value="purchase">Date of purchase</option>
                </select>
                <DateRangeFilter
                  value={dateRange}
                  onChange={(r) => { setDateRange(r); setPage(1); setSelectedRows([]); }}
                  presets={false}
                />
              </div>
              {(dateRange.from || dateRange.to) && dateField === 'due' && (
                <p className="mt-1.5 text-[10px] text-gray-400">Shows accounts with an installment due in this range (instead of this month&apos;s). The collected cards stay this month&apos;s figures.</p>
              )}
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Min Amount</label>
                <input
                  type="number"
                  placeholder="Min amount"
                  value={advFilters.min_amount}
                  onChange={(e) => { setAdvFilters({ ...advFilters, min_amount: e.target.value }); setPage(1); }}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Max Amount</label>
                <input
                  type="number"
                  placeholder="Max amount"
                  value={advFilters.max_amount}
                  onChange={(e) => { setAdvFilters({ ...advFilters, max_amount: e.target.value }); setPage(1); }}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
                />
              </div>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Min Balance</label>
                <input
                  type="number"
                  placeholder="Min balance"
                  value={advFilters.min_balance}
                  onChange={(e) => { setAdvFilters({ ...advFilters, min_balance: e.target.value }); setPage(1); }}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-gray-400">Max Balance</label>
                <input
                  type="number"
                  placeholder="Max balance"
                  value={advFilters.max_balance}
                  onChange={(e) => { setAdvFilters({ ...advFilters, max_balance: e.target.value }); setPage(1); }}
                  className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-meta-4 dark:text-white"
                />
              </div>
            </div>
            <div className="col-span-4 flex items-end justify-end">
              <button
                onClick={() => { setAdvFilters({ item: "", ptp: "", lock_status: "", ro_id: "", min_amount: "", max_amount: "", min_balance: "", max_balance: "" }); setVoFilter(""); setDateRange({ from: "", to: "" }); setPage(1); }}
                className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#E31E24] transition-all"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {(loading && summaryReady || loadError) && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loadError ? (summaryReady ? "Could not update results. Previous results are shown; use refresh to retry." : "Could not load results. Use refresh to retry.")
            : "Updating results - previous results remain visible until ready."}
        </div>
      )}
      {/* EXCEL SHEET HIGH-FIDELITY GRID CONTAINER */}
      <div className="bg-white dark:bg-boxdark rounded-3xl shadow-xl shadow-gray-100/40 border border-gray-100 dark:border-strokedark overflow-hidden">
        <div className="overflow-x-auto">

          <table className="w-full border-collapse text-left text-xs text-gray-500 dark:text-gray-400">

            {/* Table Header Row matched with CSR RankingBoard style (Enlarged to text-[10px]) */}
            <thead className="bg-white sticky top-0 z-10 border-b border-gray-100 dark:border-strokedark">
              <tr className="bg-gray-50/50">
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredInstallments.length > 0 && selectedRows.length === filteredInstallments.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] dark:border-strokedark cursor-pointer"
                  />
                </th>
                <th className="px-3 py-4 text-[10px] font-black text-gray-400 uppercase text-center w-12">S No.</th>
                {adminMode && <>
                  <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[130px]">Outlet</th>
                </>}
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[140px]">Area</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[120px]">Installment Due Date</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[110px]" aria-sort={agingSort === 'aging_asc' ? 'ascending' : agingSort === 'aging_desc' ? 'descending' : 'none'}>
                  <button
                    type="button"
                    onClick={() => { setAgingSort(s => s === 'aging_asc' ? 'aging_desc' : s === 'aging_desc' ? '' : 'aging_asc'); setPage(1); }}
                    className={`inline-flex items-center gap-1 uppercase hover:text-[#E31E24] ${agingSort ? 'text-[#E31E24]' : ''}`}
                    title="Sort by aging: ascending → descending → off"
                  >
                    Aging
                    {agingSort === 'aging_asc' ? <ArrowUp className="h-3.5 w-3.5" /> : agingSort === 'aging_desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUpDown className="h-3.5 w-3.5" />}
                  </button>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[120px]">Date of Purchase</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[160px]">Customer Name</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[140px]">Contact No.</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[140px]">Alternate No.</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[160px]">G1. Name</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[140px]">G1. No.</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[160px]">G2. Name</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[140px]">G2. Number</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[170px]">Item</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[150px]">Device Serial No.</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[110px] text-right">Installment Amount</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[125px] text-right">Due Amount</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[120px] text-right">Partial Payment</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[160px]">Paid Date / History</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[180px]">1Bill ID & QR</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[190px]">Installment Note</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[170px]">Recovery Officer</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[170px]">Verification Officer</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[110px] text-right">Arrears</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[180px]">SmartPay Consumer No.</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[110px] text-center">Status</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase w-16 text-center">Actions</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[130px]">Order Ref</th>
                {adminMode && <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase min-w-[160px]">Received Via</th>}
              </tr>

              {/* ADVANCED COLUMN FILTERS ROW */}
              <tr className="bg-gray-50/20 border-b border-gray-100 dark:border-strokedark">
                <td className="px-4 py-2"></td>
                <td className="px-3 py-2">
                  <div className="flex justify-center"><Filter className="h-3.5 w-3.5 text-gray-300" /></div>
                </td>
                {adminMode && <td className="px-2 py-2"></td>}
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.area}
                    onChange={(e) => updateColumnFilter("area", e.target.value)}
                    placeholder="Filter Area"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.customer_name}
                    onChange={(e) => updateColumnFilter("customer_name", e.target.value)}
                    placeholder="Filter Customer"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.whatsapp_number}
                    onChange={(e) => updateColumnFilter("whatsapp_number", e.target.value)}
                    placeholder="Filter WhatsApp"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.alternate_number}
                    onChange={(e) => updateColumnFilter("alternate_number", e.target.value)}
                    placeholder="Filter Alternate"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.grantor1Name}
                    onChange={(e) => updateColumnFilter("grantor1Name", e.target.value)}
                    placeholder="Filter G1 Name"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.grantor2Name}
                    onChange={(e) => updateColumnFilter("grantor2Name", e.target.value)}
                    placeholder="Filter G2 Name"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.product_name}
                    onChange={(e) => updateColumnFilter("product_name", e.target.value)}
                    placeholder="Filter Item"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.imei_serial}
                    onChange={(e) => updateColumnFilter("imei_serial", e.target.value)}
                    placeholder="Filter IMEI"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2">
                  <select
                    value={colFilters.status}
                    onChange={(e) => updateColumnFilter("status", e.target.value)}
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  >
                    <option value="">All</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="unpaid_partial">Unpaid + Partial</option>
                  </select>
                </td>
                <td className="px-2 py-2"></td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={colFilters.order_ref}
                    onChange={(e) => updateColumnFilter("order_ref", e.target.value)}
                    placeholder="Filter Ref"
                    className="w-full rounded bg-white dark:bg-boxdark border-gray-150 dark:border-strokedark px-2 py-1 text-xs outline-none focus:border-[#E31E24]"
                  />
                </td>
                {adminMode && <td className="px-2 py-2"></td>}
              </tr>
            </thead>

            {/* Table Body Content (Enlarged from text-xs to text-[13px] for ultimate readability) */}
            <tbody inert={loading || loadError} aria-busy={loading} className="divide-y divide-gray-100 dark:divide-strokedark text-[13px]">
              {loading && !summaryReady ? (
                <tr>
                  <td colSpan={adminMode ? 30 : 28} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 text-[#E31E24] animate-spin" />
                      <span className="text-xs font-black tracking-wider uppercase text-gray-400">Querying installments database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInstallments.length === 0 ? (
                <tr>
                  <td colSpan={adminMode ? 30 : 28} className="py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-8 w-8 text-gray-300" />
                      <span className="text-xs font-black uppercase tracking-wider">No installments found for the selected filters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInstallments.map((inst, index) => {
                  const isChecked = selectedRows.includes(getRowKey(inst));
                  const purchaseDateStr = inst.purchaseDate ? formatExactDate(inst.purchaseDate, 'DD MMM YYYY, hh:mm A') : "N/A";
                  const dueDateStr = inst.dueDate ? new Date(inst.dueDate).toLocaleDateString("en-PK") : "N/A";

                  return (
                    <tr key={index} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 dark:border-strokedark">
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(inst, e.target.checked)}
                          className="h-4.5 w-4.5 rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] dark:border-strokedark cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3.5 text-center font-black text-gray-300">{(limit === "all" ? 0 : (displayedPage - 1) * limit) + index + 1}</td>
                      {adminMode && <>
                        <td className="px-4 py-3.5 font-semibold text-gray-700 dark:text-slate-300">{inst.outlet_name}</td>
                      </>}
                      <td className="px-4 py-3.5 font-medium">{inst.area}</td>
                      <td className="px-4 py-3.5 font-bold text-gray-700 dark:text-slate-300">{dueDateStr}
                        <div className="mt-1 text-[10px] text-gray-400">{inst.dueInstallmentCount} due installments</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`whitespace-nowrap font-black ${inst.agingDays === null ? 'text-gray-400' : inst.agingDays < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {agingLabel(inst.agingDays)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-gray-600">{purchaseDateStr}</td>
                      <td className="px-4 py-3.5 font-black text-slate-800 dark:text-slate-200">{inst.customer_name}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-700">{inst.whatsapp_number}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-700">{inst.alternate_number}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-700">{inst.grantor1Name}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-600">{inst.grantor1Phone}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-700">{inst.grantor2Name}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-600">{inst.grantor2Phone}</td>
                      <td className="px-4 py-3.5 font-bold text-gray-700 dark:text-slate-300">{inst.product_name}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-gray-600">{inst.imei_serial}</td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">Rs. {inst.monthlyAmount.toLocaleString()}</td>
                      <td className="px-4 py-3.5 text-right">
                        {/* Amount owed right now — same figure as the order ledger's
                            "QR amount (payable now)": this month's balance + arrears. */}
                        {(inst.arrearsAmount || 0) > 0 ? (
                          <div>
                            <span className="font-black text-[#E31E24] text-sm">
                              Rs. {(inst.payableAmount ?? 0).toLocaleString()}
                            </span>
                            <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                              (Latest overdue Rs. {(inst.currentDueAmount ?? 0).toLocaleString()} + Rs. {inst.arrearsAmount.toLocaleString()} arr.)
                            </p>
                          </div>
                        ) : (inst.payableAmount ?? 0) > 0 ? (
                          <span className="font-black text-[#E31E24]">Rs. {inst.payableAmount.toLocaleString()}</span>
                        ) : (
                          <span className="font-bold text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {inst.partialPayment ? `Rs. ${inst.partialPayment.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5 font-black">
                          {inst.paidDate ? (
                            <span className="text-slate-800 dark:text-slate-200">
                              {formatExactDate(inst.paidDate, 'DD MMM YYYY, hh:mm A')}
                            </span>
                          ) : (
                            <span className="text-gray-300 font-black">-</span>
                          )}
                          {inst.paymentHistory && inst.paymentHistory.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openHistoryModal(inst)}
                              className="text-[10px] text-[#E31E24] hover:text-red-700 hover:underline italic font-black uppercase tracking-wider text-left transition-colors cursor-pointer"
                              title="Click to view detailed payment logs"
                            >
                              ({inst.paymentHistory.length} {inst.paymentHistory.length === 1 ? 'log' : 'logs'})
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {inst.consumer_number ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono font-bold text-sm tracking-widest text-[#E31E24]">{inst.consumer_number}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Not Generated</span>
                        )}
                                              {inst.status !== "paid" && (
                          <button
                            type="button"
                            onClick={() => {
                              setQrOrderId(inst.order_id);
                              setQrMonthNumber(inst.monthNumber);
                              setQrDefaultAmount(inst.payableAmount ?? 0);
                              setQrCustomerName(inst.customer_name);
                              setQrModalOpen(true);
                            }}
                            className="mt-1 inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-[10px] font-black uppercase text-[#E31E24] hover:bg-red-50"
                            title="Generate SmartPay QR"
                          >
                            QR
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-3.5 max-w-[220px]">
                        {inst.note ? (
                          <button
                            type="button"
                            onClick={() => openNoteDialog(inst)}
                            className="block w-full text-left"
                            title="View note history / add a note"
                          >
                            <span className="block truncate text-slate-800 dark:text-slate-300 hover:text-[#E31E24] hover:underline italic font-black">
                              {inst.note}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-gray-400">
                              {inst.note_by ? `by ${inst.note_by}` : 'Earlier note'}
                              {inst.note_at ? ` · ${formatExactDate(inst.note_at, 'DD MMM, hh:mm A')}` : ''}
                            </span>
                            {(inst.note_count || 0) > 1 && (
                              <span className="text-[10px] font-black uppercase tracking-wider text-[#E31E24]">({inst.note_count} notes)</span>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => openNoteDialog(inst)}
                            className="text-gray-400 hover:text-[#E31E24] transition-all italic font-black text-[12px]"
                          >
                            + Add note
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {inst.recovery_officer ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{inst.recovery_officer.name}</span>
                            <span className="text-xs text-gray-500">{inst.recovery_officer.phone || 'No phone'}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {inst.verification_officer
                          ? <span className="font-bold text-slate-800 dark:text-slate-200">{inst.verification_officer.name}</span>
                          : <span className="text-gray-400 italic text-xs">Not recorded</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-amber-600 dark:text-amber-400">
                        {inst.arrearsAmount ? `Rs. ${inst.arrearsAmount.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        {inst.smartpay_consumer_number ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-mono font-bold text-sm tracking-widest text-emerald-600">{inst.smartpay_consumer_number}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Not Generated</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${inst.status === "paid"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : inst.status === "partial"
                                ? "bg-amber-50 text-amber-600 border border-amber-200"
                                : "bg-red-50 text-[#E31E24] border border-red-200"
                            }`}
                        >
                          {statusLabel(inst.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            onClick={() => openNoteDialog(inst)}
                            className="rounded-lg p-1.5 text-gray-400 hover:text-[#E31E24] hover:bg-gray-100 dark:hover:bg-meta-4 transition-all cursor-pointer"
                            title="Notes (add / history)"
                          >
                            <Edit3 className="h-4.5 w-4.5" />
                          </button>
                          {inst.status !== "paid" && (
                              <button
                                  onClick={() => {
                                      setQrOrderId(inst.order_id);
                                      setQrMonthNumber(inst.monthNumber);
                                      setQrDefaultAmount(inst.payableAmount ?? 0);
                                      setQrCustomerName(inst.customer_name);
                                      setQrModalOpen(true);
                                  }}
                                  className="rounded-lg p-1.5 text-gray-400 hover:text-[#E31E24] hover:bg-gray-100 dark:hover:bg-meta-4 transition-all cursor-pointer"
                                  title="Generate SmartPay QR"
                              >
                                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                  </svg>
                              </button>
                          )}
                          {inst.status !== "paid" && (
                              <button
                                  onClick={() => openPtpModal(inst)}
                                  disabled={!inst.imei_serial}
                                  className="rounded-lg p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-meta-4 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={!inst.imei_serial ? "No IMEI/device registered" : "Promise to Pay — temporarily unlock device"}
                              >
                                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                              </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-white">
                        {adminMode
                          ? <Link href={`/orders/${inst.order_id}`} className="text-[#E31E24] hover:underline">{inst.order_ref}</Link>
                          : inst.order_ref}
                      </td>
                      {adminMode && (
                        <td className="px-4 py-3.5">
                          {receivedVia(inst).length ? (
                            <div className="flex flex-wrap gap-1">
                              {receivedVia(inst).map((m) => (
                                <span key={m} className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-black ${METHOD_TONE(m)}`}>{m}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs italic text-gray-400">Not received yet</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

          </table>

        </div>

        {/* PAGINATION PANEL CONTROLS */}
        {summaryReady && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/20 px-6 py-4 text-xs dark:border-strokedark">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                Showing <span className="text-gray-600">{pagination.total === 0 ? 0 : limit === "all" ? 1 : (displayedPage - 1) * limit + 1}</span> to{" "}
                <span className="text-gray-600">{limit === "all" ? pagination.total : Math.min(displayedPage * limit, pagination.total)}</span> of{" "}
                <span className="text-gray-600">{pagination.total}</span> entries
              </span>
              <label className="flex items-center gap-2 font-semibold text-gray-500 dark:text-gray-400">
                Show
                <select
                  aria-label="Number of installment entries to show"
                  value={limit}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLimit(value === "all" ? "all" : Number(value));
                    setPage(1);
                    setSelectedRows([]);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-[#E31E24] dark:border-strokedark dark:bg-boxdark dark:text-white"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">All</option>
                </select>
                entries
              </label>
            </div>

            {limit !== "all" && pagination.total > 0 && <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={loading || page === 1}
                className="rounded-xl border border-gray-100 dark:border-strokedark bg-white dark:bg-boxdark hover:bg-gray-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 disabled:opacity-40 transition-all cursor-pointer"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                  if (p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1) {
                    return (
                      <button
                        key={p}
                        disabled={loading}
                        onClick={() => setPage(p)}
                        className={`rounded-xl h-8 w-8 text-[10px] font-black uppercase flex items-center justify-center transition-all cursor-pointer ${page === p
                            ? "bg-[#E31E24] text-white"
                            : "border border-gray-100 dark:border-strokedark bg-white dark:bg-boxdark text-gray-500 hover:bg-gray-50"
                          }`}
                      >
                        {p}
                      </button>
                    );
                  } else if (p === 2 || p === pagination.totalPages - 1) {
                    return <span key={p} className="px-1 text-gray-300">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={loading || page === pagination.totalPages}
                className="rounded-xl border border-gray-100 dark:border-strokedark bg-white dark:bg-boxdark hover:bg-gray-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 disabled:opacity-40 transition-all cursor-pointer"
              >
                Next
              </button>
            </div>}
          </div>
        )}

      </div>

      {/* NOTES MODAL — add a note; every earlier note stays in the history below */}
      {noteModalOpen && activeOrderForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white dark:bg-boxdark p-6 shadow-2xl border border-gray-100 dark:border-strokedark transform animate-fade-in transition-all">

            <div className="flex items-center justify-between border-b border-gray-100 dark:border-strokedark pb-4 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Edit3 className="h-4.5 w-4.5 text-[#E31E24]" /> Installment Notes
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {activeOrderForNote.customer} &bull; Order {activeOrderForNote.ref} &bull; Month {activeOrderForNote.monthNumber}
                </p>
              </div>

              <button
                onClick={() => setNoteModalOpen(false)}
                className="rounded-full p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-meta-4 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                Add New Note
              </label>
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Contact details, promised payment, or anything about this account..."
                className="w-full rounded-2xl border-gray-100 bg-gray-50/50 p-4 text-xs outline-none focus:border-[#E31E24] focus:bg-white dark:border-strokedark dark:bg-meta-4 dark:text-white"
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(false)}
                  className="rounded-2xl border border-gray-100 dark:border-strokedark bg-white dark:bg-boxdark hover:bg-gray-50 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-500 transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteText.trim()}
                  className="flex items-center gap-1.5 rounded-2xl bg-[#E31E24] hover:bg-[#c7161c] px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingNote ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Add Note"
                  )}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-100 dark:border-strokedark pt-4">
              <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Note History</p>
              <InstallmentNotesHistory orderId={activeOrderForNote.id} refreshKey={noteHistoryKey} />
            </div>

          </div>
        </div>
      )}

      {/* BULK REMINDER MODAL */}
      {bulkReminderModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-boxdark rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-strokedark flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-strokedark flex justify-between items-center bg-gray-50/50 dark:bg-meta-4/20">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#E31E24]/10 p-2 text-[#E31E24]">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Bulk Reminders</h3>
                  <p className="text-[10px] text-gray-400 font-bold tracking-widest mt-0.5">MANAGE CUSTOMER ALERTS</p>
                </div>
              </div>
              <button 
                onClick={() => setBulkReminderModalOpen(false)}
                className="text-gray-400 hover:text-[#E31E24] hover:bg-[#E31E24]/10 p-2 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              
              {/* Manual Send */}
              <div className="p-5 border border-gray-100 dark:border-strokedark rounded-2xl bg-white dark:bg-boxdark hover:border-[#E31E24]/30 transition-all">
                <div className="flex flex-col gap-2">
                  <h4 className="text-sm font-black text-slate-800 dark:text-white">Manual Bulk Send</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Send a reminder message immediately to all <strong className="text-[#E31E24]">Overdue</strong> customers currently visible in your filtered list.
                  </p>
                  
                  <button
                    onClick={() => {
                      toast.success("Sending bulk manual reminders to overdue accounts...");
                      setBulkReminderModalOpen(false);
                    }}
                    disabled={sendingBulk}
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-all cursor-pointer"
                  >
                    {sendingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Send Now
                  </button>
                </div>
              </div>

              {/* Auto Settings */}
              <div className="p-5 border border-[#E31E24]/20 rounded-2xl bg-[#E31E24]/5">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-black text-[#E31E24]">Auto Bulk Reminders</h4>
                    <span className="bg-[#E31E24] text-white text-[9px] px-2 py-0.5 rounded-full font-black uppercase">Active</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Automatically send WhatsApp/SMS reminders to all overdue customers every morning at <strong className="text-slate-800 dark:text-white">10:00 AM</strong>.
                  </p>
                  
                  <div className="mt-3 flex items-center justify-between bg-white dark:bg-boxdark p-3 rounded-xl border border-[#E31E24]/10">
                    <span className="text-[10px] font-black tracking-widest uppercase text-gray-500">Auto-Scheduler Status</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked onChange={(e) => {
                        toast.success(e.target.checked ? "Auto Bulk Reminders Enabled!" : "Auto Bulk Reminders Disabled");
                      }} />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#E31E24]"></div>
                    </label>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      <SmartPayQrModal
          open={qrModalOpen}
          onClose={() => setQrModalOpen(false)}
          orderId={qrOrderId}
          monthNumber={qrMonthNumber}
          defaultAmount={qrDefaultAmount}
          customerName={qrCustomerName}
      />

      {/* PTP (Promise to Pay) MODAL */}
      {ptpModalOpen && ptpRow && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-boxdark rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-strokedark">

            <div className="px-6 py-5 border-b border-gray-100 dark:border-strokedark bg-amber-50 dark:bg-amber-900/20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/15 p-2">
                    <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Promise to Pay</h3>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold tracking-widest mt-0.5">DEVICE TEMP-UNLOCK</p>
                  </div>
                </div>
                <button onClick={() => setPtpModalOpen(false)} className="text-gray-400 hover:text-red-500 p-2 rounded-xl transition-all cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl flex flex-col gap-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{ptpRow.customer_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{ptpRow.order_ref} &bull; {ptpRow.product_name}</p>
                <p className="text-[10px] text-gray-400 mt-1">IMEI: <span className="font-mono">{ptpRow.imei_serial || 'N/A'}</span></p>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Promised Payment Date</label>
                <input
                  type="date"
                  min={tomorrowStr}
                  max={maxPtpStr}
                  value={ptpDate}
                  onChange={(e) => setPtpDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 font-bold text-amber-700 dark:text-amber-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 mt-1.5 pl-1">The device will be temporarily unlocked until this date (max 10 days). If payment is not received by then, the device will auto-lock again.</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Quick Select</p>
                <div className="flex gap-2 flex-wrap">
                  {[3, 7, 10].map(days => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const dStr = pktDate(d);
                    return (
                      <button
                        key={days}
                        onClick={() => setPtpDate(dStr)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          ptpDate === dStr
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-amber-300'
                        }`}
                      >
                        +{days}d
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <svg className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-[10px] text-blue-600 dark:text-blue-300 font-medium leading-relaxed">
                  A WhatsApp confirmation will be sent to <strong>{ptpRow.whatsapp_number || 'the customer'}</strong> with the promised date and due amount.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setPtpModalOpen(false)}
                  className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPtp}
                  disabled={ptpLoading || !ptpDate}
                  className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-black py-3 px-4 rounded-xl transition-all shadow-lg shadow-amber-200 dark:shadow-none disabled:opacity-50 cursor-pointer text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {ptpLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Activating...</>
                  ) : (
                    <>Activate PTP &amp; Unlock Device</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Logs Modal */}
      {historyModalOpen && historyRow && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white dark:bg-boxdark rounded-3xl shadow-2xl max-w-xl w-full border border-gray-100 dark:border-strokedark overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-strokedark bg-gradient-to-r from-red-50 to-slate-50 dark:from-red-950/20 dark:to-boxdark flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E31E24]/10 text-[#E31E24] flex items-center justify-center font-black">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white text-base">Payment History Logs</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    {historyRow.customer_name} &bull; <span className="font-bold">{historyRow.order_ref}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-gray-400 hover:text-red-500 p-2 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              
              {/* Info Banner */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-strokedark">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400">Product / Item</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{historyRow.product_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400">Total Partial Paid</p>
                  <p className="text-xs font-black text-emerald-600">
                    Rs. {historyRow.partialPayment ? historyRow.partialPayment.toLocaleString() : (historyRow.paymentHistory?.reduce((sum: number, h: any) => sum + Number(h.amount || 0), 0)?.toLocaleString() || '0')}
                  </p>
                </div>
              </div>

              {/* Logs Table / List */}
              <div className="rounded-2xl border border-gray-100 dark:border-strokedark overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-700/60 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Method</th>
                      <th className="px-4 py-2.5 text-right">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-strokedark/50">
                    {historyRow.paymentHistory && historyRow.paymentHistory.length > 0 ? (
                      historyRow.paymentHistory.map((h: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 font-bold text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            Rs. {Number(h.amount || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                              {h.method || 'Cash'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                            {formatExactDate(h.date, 'DD MMM YYYY, hh:mm A')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-400 italic">
                          No payment history logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-strokedark bg-gray-50/50 dark:bg-gray-800/30 flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// Shared by Outlet → Installments View (own outlet only) and Admin → Installment View (all outlets).
export default function InstallmentsView({ adminMode = false }: InstallmentsViewProps) {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-boxdark">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-[#E31E24] animate-spin" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Initializing Installment Matrix...</span>
        </div>
      </div>
    }>
      <InstallmentsViewContent adminMode={adminMode} />
    </Suspense>
  );
}
