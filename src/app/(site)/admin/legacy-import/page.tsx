'use client';

import React, { useCallback, useState } from 'react';
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, XCircle, Download, ArrowRight, ChevronDown } from 'lucide-react';
import { useAuth } from "../../../../../contexts/AuthContext";

type PayoffStatus = 'completed' | 'delivered';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Column order the import expects — position-based, not header-name-based,
// since guarantor 1/2 repeat the same field names, which would collide if
// mapped by header text instead. Matches, field for field, every input the
// order detail page's Purchaser/Grantor Details sections show — the goal is
// that after import there's as little left to hand-retype as possible; any
// field the sheet genuinely doesn't have a column for is still editable
// right there on the profile afterward. ACC NO/G.NO/S.NO/ORDER BY/INS DATE
// from the original paper ledger were dropped — the system doesn't use
// paper-ledger serial numbers, and ORDER BY/INS DATE didn't map to anything.
const COLUMNS = [
  // Sale basics
  'order_date', 'bill_id',
  // Purchaser — Customer Information card
  'purchaser_name', 'purchaser_cnic', 'purchaser_phone', 'purchaser_alt_contact',
  'purchaser_city', 'purchaser_area', 'purchaser_zone', 'purchaser_house_street',
  'purchaser_gender', 'purchaser_residential_type',
  // Purchaser — Purchaser Details section (employment/business profile)
  'purchaser_father_husband_name', 'purchaser_job_type',
  'purchaser_employer_name', 'purchaser_employer_address', 'purchaser_designation', 'purchaser_official_number',
  'purchaser_business_name', 'purchaser_established_since', 'purchaser_business_address',
  'purchaser_net_income', 'purchaser_years_in_company', 'purchaser_gross_salary', 'purchaser_nearest_location',
  // Item / installment plan
  'item_price', 'item_model', 'serial', 'tenure_months', 'advance', 'installment',
  // Guarantor 1 — Grantor Details section
  'grantor1_name', 'grantor1_cnic', 'grantor1_phone', 'grantor1_father_husband_name', 'grantor1_relationship',
  'grantor1_job_type', 'grantor1_designation', 'grantor1_official_number',
  'grantor1_office_address', 'grantor1_company_name', 'grantor1_years_in_company', 'grantor1_monthly_income',
  'grantor1_business_name', 'grantor1_established_since', 'grantor1_business_address', 'grantor1_net_income',
  'grantor1_full_residential_address', 'grantor1_nearest_location',
  // Guarantor 2 — same shape as Guarantor 1
  'grantor2_name', 'grantor2_cnic', 'grantor2_phone', 'grantor2_father_husband_name', 'grantor2_relationship',
  'grantor2_job_type', 'grantor2_designation', 'grantor2_official_number',
  'grantor2_office_address', 'grantor2_company_name', 'grantor2_years_in_company', 'grantor2_monthly_income',
  'grantor2_business_name', 'grantor2_established_since', 'grantor2_business_address', 'grantor2_net_income',
  'grantor2_full_residential_address', 'grantor2_nearest_location',
  // Next of Kin — optional, matches the order detail page's Next of Kin
  // Details section (a distinct, single record, not per-guarantor).
  'next_of_kin_name', 'next_of_kin_cnic', 'next_of_kin_relation', 'next_of_kin_phone',
  // Payment history — each PAY column paired with the date it was actually
  // collected, so the installment ledger shows real payment dates and exact
  // (possibly uneven) amounts instead of an assumed on-schedule full payment.
  'pay1', 'pay1_date', 'pay2', 'pay2_date', 'pay3', 'pay3_date', 'pay4', 'pay4_date', 'remain',
] as const;

type LegacyRow = Record<(typeof COLUMNS)[number], any> & { _rowNum: number; _issues: string[] };

// Human labels + grouping for every column, used by the expandable "Full
// Details" panel in the preview — so every field the sheet can capture is
// actually visible before import, not just the handful of core columns the
// main table has room for.
const FIELD_LABELS: Record<string, string> = {
  order_date: 'Date', bill_id: '1Bill ID',
  purchaser_name: 'Name', purchaser_cnic: 'CNIC', purchaser_phone: 'Contact No.', purchaser_alt_contact: 'Alternate Contact',
  purchaser_city: 'City', purchaser_area: 'Area', purchaser_zone: 'Zone', purchaser_house_street: 'House No / Street',
  purchaser_gender: 'Gender', purchaser_residential_type: 'Residential Type',
  purchaser_father_husband_name: 'Father/Husband Name', purchaser_job_type: 'Job Type',
  purchaser_employer_name: 'Employer Name', purchaser_employer_address: 'Employer Address',
  purchaser_designation: 'Designation', purchaser_official_number: 'Official Number',
  purchaser_business_name: 'Business Name', purchaser_established_since: 'Established Since',
  purchaser_business_address: 'Business Address', purchaser_net_income: 'Net Income',
  purchaser_years_in_company: 'Years in Company', purchaser_gross_salary: 'Gross Salary',
  purchaser_nearest_location: 'Nearest Location',
  item_price: 'Item Price', item_model: 'Item Model', serial: 'Serial', tenure_months: 'Tenure',
  advance: 'Advance', installment: 'Installment',
  next_of_kin_name: 'Name', next_of_kin_cnic: 'CNIC', next_of_kin_relation: 'Relation', next_of_kin_phone: 'Phone Number',
  pay1: 'Pay 1', pay1_date: 'Pay 1 Date', pay2: 'Pay 2', pay2_date: 'Pay 2 Date',
  pay3: 'Pay 3', pay3_date: 'Pay 3 Date', pay4: 'Pay 4', pay4_date: 'Pay 4 Date', remain: 'Remain',
};
for (const n of [1, 2] as const) {
  Object.assign(FIELD_LABELS, {
    [`grantor${n}_name`]: 'Name', [`grantor${n}_cnic`]: 'CNIC', [`grantor${n}_phone`]: 'Contact No.',
    [`grantor${n}_father_husband_name`]: 'Father/Husband Name', [`grantor${n}_relationship`]: 'Relationship',
    [`grantor${n}_job_type`]: 'Job Type', [`grantor${n}_designation`]: 'Designation',
    [`grantor${n}_official_number`]: 'Official Number', [`grantor${n}_office_address`]: 'Office Address',
    [`grantor${n}_company_name`]: 'Company Name', [`grantor${n}_years_in_company`]: 'Years in Company',
    [`grantor${n}_monthly_income`]: 'Monthly Income', [`grantor${n}_business_name`]: 'Business Name',
    [`grantor${n}_established_since`]: 'Established Since', [`grantor${n}_business_address`]: 'Business Address',
    [`grantor${n}_net_income`]: 'Net Income', [`grantor${n}_full_residential_address`]: 'Full Residential Address',
    [`grantor${n}_nearest_location`]: 'Nearest Location',
  });
}

const FIELD_SECTIONS: { title: string; fields: string[] }[] = [
  { title: 'Sale Basics', fields: ['order_date', 'bill_id'] },
  {
    title: 'Purchaser — Contact & Address', fields: [
      'purchaser_name', 'purchaser_cnic', 'purchaser_phone', 'purchaser_alt_contact',
      'purchaser_city', 'purchaser_area', 'purchaser_zone', 'purchaser_house_street',
      'purchaser_gender', 'purchaser_residential_type',
    ],
  },
  {
    title: 'Purchaser — Employment & Business', fields: [
      'purchaser_father_husband_name', 'purchaser_job_type', 'purchaser_employer_name', 'purchaser_employer_address',
      'purchaser_designation', 'purchaser_official_number', 'purchaser_business_name', 'purchaser_established_since',
      'purchaser_business_address', 'purchaser_net_income', 'purchaser_years_in_company', 'purchaser_gross_salary',
      'purchaser_nearest_location',
    ],
  },
  { title: 'Item & Installment Plan', fields: ['item_price', 'item_model', 'serial', 'tenure_months', 'advance', 'installment'] },
  {
    title: 'Guarantor 1', fields: [
      'grantor1_name', 'grantor1_cnic', 'grantor1_phone', 'grantor1_father_husband_name', 'grantor1_relationship',
      'grantor1_job_type', 'grantor1_designation', 'grantor1_official_number', 'grantor1_office_address',
      'grantor1_company_name', 'grantor1_years_in_company', 'grantor1_monthly_income', 'grantor1_business_name',
      'grantor1_established_since', 'grantor1_business_address', 'grantor1_net_income',
      'grantor1_full_residential_address', 'grantor1_nearest_location',
    ],
  },
  {
    title: 'Guarantor 2', fields: [
      'grantor2_name', 'grantor2_cnic', 'grantor2_phone', 'grantor2_father_husband_name', 'grantor2_relationship',
      'grantor2_job_type', 'grantor2_designation', 'grantor2_official_number', 'grantor2_office_address',
      'grantor2_company_name', 'grantor2_years_in_company', 'grantor2_monthly_income', 'grantor2_business_name',
      'grantor2_established_since', 'grantor2_business_address', 'grantor2_net_income',
      'grantor2_full_residential_address', 'grantor2_nearest_location',
    ],
  },
  { title: 'Next of Kin', fields: ['next_of_kin_name', 'next_of_kin_cnic', 'next_of_kin_relation', 'next_of_kin_phone'] },
  { title: 'Payment History', fields: ['pay1', 'pay1_date', 'pay2', 'pay2_date', 'pay3', 'pay3_date', 'pay4', 'pay4_date', 'remain'] },
];

type ImportResult = { row: number; success: boolean; order_id?: number; error?: string; reconciliation_warning?: string | null };

function excelValueToIso(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function validateRow(row: LegacyRow): string[] {
  const issues: string[] = [];
  if (!row.purchaser_name) issues.push('Missing name');
  if (!row.purchaser_cnic) issues.push('Missing CNIC');
  if (!row.purchaser_phone) issues.push('Missing contact number');
  if (!row.item_price || isNaN(parseFloat(row.item_price))) issues.push('Missing/invalid item price');
  if (!row.tenure_months || isNaN(parseInt(row.tenure_months, 10))) issues.push('Missing/invalid tenure');
  if (!row.installment || isNaN(parseFloat(row.installment))) issues.push('Missing/invalid installment');
  return issues;
}

export default function LegacyImportPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || "").toLowerCase() === "super admin";

  const [payoffStatus, setPayoffStatus] = useState<PayoffStatus>('delivered');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<LegacyRow[]>([]);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowNum: number; field: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  // Update a single cell value in the parsed rows
  const updateCell = (rowNum: number, field: string, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._rowNum !== rowNum) return r;
        const updated = { ...r, [field]: value };
        updated._issues = validateRow(updated as LegacyRow);
        return updated as LegacyRow;
      })
    );
  };

  // Editable cell component for the preview table
  const EditableCell = ({ rowNum, field, value, className }: { rowNum: number; field: string; value: any; className?: string }) => {
    const isEditing = editingCell?.rowNum === rowNum && editingCell?.field === field;
    return isEditing ? (
      <input
        autoFocus
        defaultValue={value ?? ''}
        onBlur={(e) => { updateCell(rowNum, field, e.target.value); setEditingCell(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { updateCell(rowNum, (e.target as HTMLInputElement).name || field, (e.target as HTMLInputElement).value); setEditingCell(null); } if (e.key === 'Escape') setEditingCell(null); }}
        className={`w-full min-w-[80px] border border-red-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 ${className ?? ''}`}
      />
    ) : (
      <span
        title="Click to edit"
        onClick={() => setEditingCell({ rowNum, field })}
        className={`cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 rounded px-0.5 block min-w-[40px] ${className ?? ''}`}
      >
        {value !== undefined && value !== null && value !== '' ? String(value) : <span className="text-gray-300 dark:text-gray-600 italic text-[10px]">click to edit</span>}
      </span>
    );
  };

  const downloadDemoSheet = () => {
    try {
      const headers = [
        'DATE', '1BILL ID',
        'Name', 'CNIC', 'Contact No.', 'Alternate Contact',
        'City', 'Area', 'Zone', 'House No / Street', 'Gender', 'Residential Type',
        "Father/Husband Name", 'Job Type',
        'Employer Name', 'Employer Address', 'Designation', 'Official Number',
        'Business Name', 'Established Since', 'Business Address',
        'Net Income', 'Years in Company', 'Gross Salary', 'Nearest Location',
        'ITEM PRICE', 'ITEM MODEL', 'SERIAL', 'Tenure', 'ADVANCE', 'INSTALLMENT',
        "Guarantor 1 Name", 'Guarantor 1 CNIC', 'Guarantor 1 Contact', 'Guarantor 1 Father/Husband Name', 'Guarantor 1 Relationship',
        'Guarantor 1 Job Type', 'Guarantor 1 Designation', 'Guarantor 1 Official Number',
        'Guarantor 1 Office Address', 'Guarantor 1 Company Name', 'Guarantor 1 Years in Company', 'Guarantor 1 Monthly Income',
        'Guarantor 1 Business Name', 'Guarantor 1 Established Since', 'Guarantor 1 Business Address', 'Guarantor 1 Net Income',
        'Guarantor 1 Full Residential Address', 'Guarantor 1 Nearest Location',
        "Guarantor 2 Name", 'Guarantor 2 CNIC', 'Guarantor 2 Contact', 'Guarantor 2 Father/Husband Name', 'Guarantor 2 Relationship',
        'Guarantor 2 Job Type', 'Guarantor 2 Designation', 'Guarantor 2 Official Number',
        'Guarantor 2 Office Address', 'Guarantor 2 Company Name', 'Guarantor 2 Years in Company', 'Guarantor 2 Monthly Income',
        'Guarantor 2 Business Name', 'Guarantor 2 Established Since', 'Guarantor 2 Business Address', 'Guarantor 2 Net Income',
        'Guarantor 2 Full Residential Address', 'Guarantor 2 Nearest Location',
        'Next of Kin Name', 'Next of Kin CNIC', 'Next of Kin Relation', 'Next of Kin Phone',
        'PAY 1', 'PAY 1 DATE', 'PAY 2', 'PAY 2 DATE', 'PAY 3', 'PAY 3 DATE', 'PAY 4', 'PAY 4 DATE', 'remain',
      ];

      const sampleRows = [
        // Row 1: Delivered, ongoing installments (2 of 12 paid) — every
        // column filled in to show the full width of what import can capture.
        [
          '04/06/2026', '1017100015525265',
          'ADNAN AHSAN', '42101-9297807-5', '03153188174', '03001234567',
          'Karachi', 'FB Area', 'Central', 'House 12, Street 4', 'Male', 'Owned',
          'Ahsan Ali', 'Salaried',
          'ABC Textiles', 'SITE Area, Karachi', 'Supervisor', '02112345678',
          '', '', '',
          '', '5', '45000', 'Near FB Area Chowrangi',
          61500, 'ZTE V80 8/256', '862484082525265', 12, 6300, 4600,
          'MATHEW EMMANUAL', '42101-9237108-3', '03118959818', 'Emmanual Sr', 'Friend',
          'Salaried', 'Manager', '02198765432',
          'Office Plaza, Karachi', 'XYZ Corp', '8', '60000',
          '', '', '',
          '', 'MATHEW EMMANUAL House, FB Area', 'Near office',
          'NAVEED UL HASSAN', '42201-1866190-5', '03333387388', '', 'Colleague',
          '', '', '',
          '', '', '', '',
          '', '', '', '',
          '', '',
          'MUHAMMAD AHSAN SR', '42101-1111111-1', 'Father', '03001112222',
          4600, '10/07/2026', 4600, '12/08/2026', '', '', '', '', 46000,
        ],
        // Row 2: Fully paid off (completed) — sparser row, showing that most
        // fields are optional and left blank falls back cleanly.
        [
          '10/01/2026', '1017100015789412',
          'SANA YOUSUF', '42301-0633320-4', '03168125822', '',
          'Karachi', 'Ramswami', '', '', '', '',
          '', '',
          '', '', '', '',
          '', '', '',
          '', '', '', '',
          45300, 'OPPO A6X 6/128', '351122098765432', 6, 4800, 6750,
          'M IBAD KHAN', '42101-7547131-1', '03013321417', '', '',
          '', '', '',
          '', '', '', '',
          '', '', '', '',
          '', '',
          'M HASSAN', '42101-72170517', '03174732419', '', '',
          '', '', '',
          '', '', '', '',
          '', '', '', '',
          '', '',
          '', '', '', '',
          6750, '10/02/2026', 6750, '09/03/2026', 6750, '11/04/2026', 6750, '10/05/2026', 0,
        ],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Legacy Ledger');
      XLSX.writeFile(workbook, 'demo_legacy_import.xlsx');
      toast.success('Downloaded demo_legacy_import.xlsx successfully');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to download demo sheet');
    }
  };

  const parseFile = useCallback((selectedFile: File) => {
    setParsing(true);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // header:1 -> array-of-arrays (positional), range:1 -> skip the header row.
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1, defval: '' });

        const parsedRows: LegacyRow[] = raw
          .filter((r) => r.some((cell) => cell !== '' && cell !== null && cell !== undefined))
          .map((r, idx) => {
            const row: any = { _rowNum: idx + 2 }; // +2 = 1-indexed + header row
            COLUMNS.forEach((col, i) => {
              let v = r[i];
              if (col === 'order_date' || col === 'pay1_date' || col === 'pay2_date' || col === 'pay3_date' || col === 'pay4_date') v = excelValueToIso(v);
              row[col] = v;
            });
            row._issues = validateRow(row);
            return row as LegacyRow;
          });

        // Flag duplicate CNICs within the file itself.
        const cnicCounts: Record<string, number> = {};
        parsedRows.forEach((r) => {
          const c = String(r.purchaser_cnic || '').trim();
          if (c) cnicCounts[c] = (cnicCounts[c] || 0) + 1;
        });
        parsedRows.forEach((r) => {
          const c = String(r.purchaser_cnic || '').trim();
          if (c && cnicCounts[c] > 1) r._issues.push('Duplicate CNIC within this file');
        });

        setRows(parsedRows);
        setExcludedRows(new Set(parsedRows.filter((r) => r._issues.length > 0).map((r) => r._rowNum)));
      } catch (err) {
        console.error(err);
        toast.error('Could not read this file — make sure it is a valid .xlsx export of the legacy sheet.');
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      toast.error('Failed to read file');
    };
    reader.readAsBinaryString(selectedFile);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!/\.xlsx?$/i.test(selected.name)) {
      toast.error('Please upload an .xlsx or .xls file');
      return;
    }
    setFile(selected);
    parseFile(selected);
  };

  const toggleExcluded = (rowNum: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum); else next.add(rowNum);
      return next;
    });
  };

  const toggleExpanded = (rowNum: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum); else next.add(rowNum);
      return next;
    });
  };

  const includedRows = rows.filter((r) => !excludedRows.has(r._rowNum));

  const handleSubmit = async () => {
    if (includedRows.length === 0) {
      toast.error('No rows selected to import');
      return;
    }
    setSubmitting(true);
    setResults(null);
    try {
      const token = Cookies.get('auth_token');
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/legacy-import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payoffStatus,
          rows: includedRows.map(({ _rowNum, _issues, ...rest }) => rest),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      setResults(data.results || []);
      toast.success(data.message || 'Import complete');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <Breadcrumb pageName="Legacy Data Import" />
        <p className="text-gray-500 dark:text-gray-400">Only Super Admin (Head Office) can access this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb pageName="Legacy Data Import" />

      <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-xl">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Upload Legacy Excel Sheet</h3>
              <p className="text-xs text-gray-400">Import historical sales records, installment ledgers & customer profiles</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadDemoSheet}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm"
            >
              <Download className="w-4 h-4" /> Download Demo Excel Sheet
            </button>
            <Link
              href="/admin/legacy-import/pending"
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-xl font-bold text-sm transition"
            >
              Pending Legacy Profiles <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ── Payoff Status Dropdown ─────────────────────────────────── */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
            Import Mode
          </label>
          <div className="relative inline-flex">
            <select
              id="payoff-status-select"
              value={payoffStatus}
              onChange={(e) => setPayoffStatus(e.target.value as PayoffStatus)}
              className="appearance-none cursor-pointer pr-10 pl-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-red-400
                bg-white dark:bg-gray-800
                border-gray-200 dark:border-gray-700
                text-gray-800 dark:text-gray-100"
            >
              <option value="delivered">📦 Delivered — Installments still running</option>
              <option value="completed">✅ Completed — All installments fully paid</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <p className="mt-2 text-xs text-gray-400 max-w-xl">
            {payoffStatus === 'completed'
              ? '✅ Completed: Every installment will be marked as paid regardless of PAY/remain columns — use this when the account is fully closed.'
              : '📦 Delivered: Installment status is read from the sheet\'s PAY / remain columns — paid months are marked paid, remaining months stay pending.'}
          </p>
        </div>

        <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium text-sm">
          Each row becomes a full customer profile — order, customer, purchaser + both guarantors&apos; full
          profiles (address, employer/business info, relationship), and installment history — the same shape
          as a profile built the normal way, right down to the fields on its Purchaser/Guarantor Details
          sections. Only name, CNIC, contact, item price, tenure and installment are required; every other
          column is optional — fill in whatever the source records have, leave the rest blank. Only photos
          and GPS location can&apos;t come from a spreadsheet, so every imported profile is queued under{' '}
          <strong>Pending Legacy Profiles</strong> for staff to add those.
        </p>

        <div
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 transition cursor-pointer bg-gray-50 dark:bg-gray-800/50 mb-6 border-gray-200 dark:border-gray-700 hover:border-red-500"
          onClick={() => document.getElementById('legacy-upload')?.click()}
        >
          <input id="legacy-upload" type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <FileText className="w-14 h-14 text-red-600" />
              <p className="text-lg font-bold text-gray-800 dark:text-white">{file.name}</p>
              <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(2)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-300 font-bold">Click to upload the .xlsx sheet</p>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mb-6">
          {payoffStatus === 'completed'
            ? 'Every row will be imported as a fully-completed account — all installments marked paid. PAY/remain columns are ignored.'
            : 'Every row is imported as a delivered sale — the full order gets built and installment status is read straight from the sheet\'s ADVANCE/INSTALLMENT/PAY/remain columns.'}
        </p>

        {parsing && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Parsing file…</p>}
      </div>

      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h4 className="text-xl font-bold text-gray-800 dark:text-white">
                Preview — {rows.length} row(s), {includedRows.length} selected for import
              </h4>
              <span className={`inline-flex items-center gap-1.5 mt-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                payoffStatus === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                {payoffStatus === 'completed' ? '✅ Completed — All installments paid' : '📦 Delivered — Installments ongoing'}
              </span>
            </div>
            {rows.some((r) => r._issues.length > 0) && (
              <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Rows with issues are unchecked by default — review before including them.</p>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">
            The table below shows the core fields. <strong>Click any cell to edit it inline</strong> before importing.
            Click <strong>View all fields</strong> on any row to see every field read from the sheet — employer/business info, full addresses,
            and both guarantors&apos; complete profiles.
          </p>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40 sticky top-0">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold">
                  <th className="py-2 px-3">Include</th>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Details</th>
                  <th className="py-2 px-3">1Bill ID</th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">CNIC</th>
                  <th className="py-2 px-3">Contact</th>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">Serial</th>
                  <th className="py-2 px-3">Tenure</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Advance</th>
                  <th className="py-2 px-3">Installment</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 1 — Name</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 1 — CNIC</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 1 — Contact</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 1 — Relationship</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 2 — Name</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 2 — CNIC</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 2 — Contact</th>
                  <th className="py-2 px-3 bg-red-50 dark:bg-red-900/10">Guarantor 2 — Relationship</th>
                  <th className="py-2 px-3">Pay 1 (date)</th>
                  <th className="py-2 px-3">Pay 2 (date)</th>
                  <th className="py-2 px-3">Pay 3 (date)</th>
                  <th className="py-2 px-3">Pay 4 (date)</th>
                  <th className="py-2 px-3">Remain</th>
                  <th className="py-2 px-3">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r, idx) => {
                  const isExpanded = expandedRows.has(r._rowNum);
                  return (
                    <React.Fragment key={r._rowNum}>
                      <tr className={excludedRows.has(r._rowNum) ? 'opacity-50' : ''}>
                        <td className="py-2 px-3">
                          <input type="checkbox" checked={!excludedRows.has(r._rowNum)} onChange={() => toggleExcluded(r._rowNum)} />
                        </td>
                        <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(r._rowNum)}
                            className="text-red-600 font-semibold hover:underline whitespace-nowrap"
                          >
                            {isExpanded ? 'Hide' : 'View all fields'}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                          <EditableCell rowNum={r._rowNum} field="bill_id" value={r.bill_id} />
                        </td>
                        <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="purchaser_name" value={r.purchaser_name} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="purchaser_cnic" value={r.purchaser_cnic} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="purchaser_phone" value={r.purchaser_phone} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="item_model" value={r.item_model} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="serial" value={r.serial} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="tenure_months" value={r.tenure_months} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="item_price" value={r.item_price} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="advance" value={r.advance} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="installment" value={r.installment} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor1_name" value={r.grantor1_name} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor1_cnic" value={r.grantor1_cnic} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor1_phone" value={r.grantor1_phone} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor1_relationship" value={r.grantor1_relationship} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor2_name" value={r.grantor2_name} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor2_cnic" value={r.grantor2_cnic} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor2_phone" value={r.grantor2_phone} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200 bg-red-50/50 dark:bg-red-900/5">
                          <EditableCell rowNum={r._rowNum} field="grantor2_relationship" value={r.grantor2_relationship} />
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="pay1" value={r.pay1} />
                          {r.pay1 && r.pay1_date && <span className="text-gray-400 text-[10px]"> ({shortDate(r.pay1_date)})</span>}
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="pay2" value={r.pay2} />
                          {r.pay2 && r.pay2_date && <span className="text-gray-400 text-[10px]"> ({shortDate(r.pay2_date)})</span>}
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="pay3" value={r.pay3} />
                          {r.pay3 && r.pay3_date && <span className="text-gray-400 text-[10px]"> ({shortDate(r.pay3_date)})</span>}
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="pay4" value={r.pay4} />
                          {r.pay4 && r.pay4_date && <span className="text-gray-400 text-[10px]"> ({shortDate(r.pay4_date)})</span>}
                        </td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-200">
                          <EditableCell rowNum={r._rowNum} field="remain" value={r.remain} />
                        </td>
                        <td className="py-2 px-3 text-red-600">{r._issues.join(', ')}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          {/* This <td> spans every column of a very wide table, so its
                              natural width can run to several thousand px — sticky-pin
                              the actual content to the left edge of the scroll area
                              and cap its width, otherwise the label/value pairs below
                              end up stretched far apart (values scrolled off-screen). */}
                          <td colSpan={27} className="bg-gray-50 dark:bg-gray-900/40 p-0">
                            <div className="sticky left-0 w-[calc(100vw-320px)] max-w-[1100px] p-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {FIELD_SECTIONS.map((section) => (
                                  <div key={section.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                                    <h5 className="text-xs font-bold uppercase tracking-wide text-red-600 mb-3">{section.title}</h5>
                                    <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                                      {section.fields.map((f) => {
                                        const v = (r as unknown as Record<string, any>)[f];
                                        return (
                                          <React.Fragment key={f}>
                                            <dt className="text-xs text-gray-400 whitespace-nowrap">{FIELD_LABELS[f] || f}</dt>
                                            <dd className="text-xs text-gray-700 dark:text-gray-200 font-medium break-words">
                                              {v !== undefined && v !== null && v !== '' ? String(v) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                            </dd>
                                          </React.Fragment>
                                        );
                                      })}
                                    </dl>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || includedRows.length === 0}
            className="mt-4 w-full flex items-center justify-center gap-3 bg-red-600 text-white py-4 rounded-xl hover:bg-red-700 transition font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> <span>Importing…</span></>
            ) : (
              <><CheckCircle2 className="w-6 h-6" /> <span>Import {includedRows.length} row(s)</span></>
            )}
          </button>
        </div>
      )}

      {results && (
        <div className="bg-white dark:bg-gray-dark rounded-2xl shadow-sm p-8">
          <h4 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
            Results — {results.filter((r) => r.success).length}/{results.length} imported
          </h4>
          <div className="max-h-[360px] overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-400 uppercase tracking-wider font-bold">
                  <th className="py-2 px-3">Row</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Order</th>
                  <th className="py-2 px-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {results.map((r) => (
                  <tr key={r.row}>
                    <td className="py-2 px-3 text-gray-400">{r.row + 1}</td>
                    <td className="py-2 px-3">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" /> Imported</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> Failed</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-700 dark:text-gray-200">{r.order_id ? `#${r.order_id}` : '—'}</td>
                    <td className="py-2 px-3 text-amber-600">{r.error || r.reconciliation_warning || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
