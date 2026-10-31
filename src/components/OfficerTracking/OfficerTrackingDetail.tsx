"use client";

import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { ArrowLeft, ChevronDown, ChevronRight, Circle, Download, Radar, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import EmptyState from "@/components/Accounts/EmptyState";
import { downloadCsv } from "@/components/Accounts/ExportMenu";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { apiErrorMessage } from "@/lib/apiErrors";
import { ROLE_META, RoleKey, fmtRs, fmtDate, fmtDateTime, fmtMinutes, monthStart, today, isCompleteDate } from "./shared";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type Column = { key: string; label: string; render?: (row: any) => ReactNode; csv?: (row: any) => any; nowrap?: boolean };
type TabDef = { key: string; label: string; rows: any[]; columns: Column[]; details?: (row: any) => ReactNode };

const OrderLink = ({ row }: { row: any }) =>
  row.order_id ? (
    <a
      href={`/orders/${row.order_id}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="whitespace-nowrap font-semibold text-blue-600 hover:underline"
    >
      {row.order_ref}
    </a>
  ) : <span>{row.order_ref || "—"}</span>;

const Customer = ({ row }: { row: any }) => (
  <div className="min-w-[150px]">
    <p className="font-semibold text-dark dark:text-white">{row.customer_name || "—"}</p>
    {row.phone && <p className="text-xs text-gray-500">{row.phone}</p>}
    {row.cnic && <p className="text-xs text-gray-500">{row.cnic}</p>}
  </div>
);

// Date on one line, time under it — never wraps into four lines.
const When = ({ value }: { value?: string | null }) => {
  if (!value) return <span className="text-gray-400">—</span>;
  const d = new Date(value);
  return (
    <div className="whitespace-nowrap">
      <p className="font-medium">{d.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}</p>
      <p className="text-xs text-gray-500">{d.toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: true })}</p>
    </div>
  );
};

const humanize = (s?: string | null) =>
  String(s || "—").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const Pill = ({ text, tone = "gray" }: { text: string; tone?: "gray" | "green" | "red" | "amber" | "blue" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-600 dark:bg-dark-3 dark:text-gray-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{text}</span>;
};

const statusTone = (s?: string) => {
  const v = String(s || "").toLowerCase();
  if (["completed", "approved", "delivered", "paid", "submitted"].includes(v)) return "green";
  if (["rejected", "cancelled", "expired"].includes(v)) return "red";
  if (["pending", "in_progress", "in progress", "new"].includes(v)) return "amber";
  return "gray";
};
const StatusPill = ({ value }: { value?: string | null }) =>
  value ? <Pill text={humanize(value)} tone={statusTone(value) as any} /> : <span className="text-gray-400">—</span>;

// Long free text (feedback, remarks, notes): two lines in the table; the full
// text is in the row's expanded panel.
const Clamp = ({ text }: { text?: string | null }) =>
  text ? <p className="line-clamp-2 max-w-[260px] text-sm text-gray-600 dark:text-gray-300">{text}</p> : <span className="text-gray-400">—</span>;

const realGuarantors = (r: any) => (r.guarantors || []).filter((g: any) => String(g.name || "").trim());

// Expanded-row building blocks
const DetailBlock = ({ title, children }: { title: string; children: ReactNode }) => (
  <div>
    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">{title}</p>
    {children}
  </div>
);
const Paragraph = ({ text }: { text?: string | null }) =>
  text ? <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-200">{text}</p> : <p className="text-sm text-gray-400">Not provided</p>;

function buildTabs(role: RoleKey, data: any): TabDef[] {
  if (role === "csr") {
    return [{
      key: "sales",
      label: "Sales / Orders",
      rows: data.sales || [],
      columns: [
        { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => [r.customer_name, r.phone].filter(Boolean).join(" | ") },
        { key: "product_name", label: "Product" },
        { key: "total_amount", label: "Order value", nowrap: true, render: (r) => <b>{fmtRs(r.total_amount)}</b>, csv: (r) => r.total_amount },
        { key: "advance_amount", label: "Advance", nowrap: true, render: (r) => fmtRs(r.advance_amount), csv: (r) => r.advance_amount },
        { key: "monthly_amount", label: "Installment", nowrap: true, render: (r) => <span>{fmtRs(r.monthly_amount)} × {r.months}</span>, csv: (r) => `${r.monthly_amount} x ${r.months}` },
        { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} />, csv: (r) => humanize(r.status) },
        { key: "channel", label: "Channel", render: (r) => humanize(r.channel), csv: (r) => humanize(r.channel) },
        { key: "outlet_name", label: "Outlet", render: (r) => r.outlet_name || "—", csv: (r) => r.outlet_name },
        { key: "area", label: "Area" },
        { key: "created_at", label: "Created", render: (r) => <When value={r.created_at} />, csv: (r) => fmtDateTime(r.created_at) },
      ],
    }];
  }
  if (role === "verification") {
    return [{
      key: "verifications",
      label: "Verifications",
      rows: data.verifications || [],
      columns: [
        { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => [r.customer_name, r.phone, r.cnic].filter(Boolean).join(" | ") },
        {
          key: "product_name", label: "Product",
          render: (r) => <div className="min-w-[140px]"><p>{r.product_name}</p><p className="text-xs text-gray-500">{fmtRs(r.total_amount)}</p></div>,
        },
        { key: "area", label: "Area", render: (r) => <p className="min-w-[110px]">{r.area || "—"}</p> },
        {
          key: "guarantors", label: "Guarantors",
          render: (r) => {
            const gs = realGuarantors(r);
            return gs.length
              ? <div className="min-w-[140px] space-y-0.5 text-sm">{gs.map((g: any) => <p key={g.number}>{g.name}</p>)}</div>
              : <span className="text-gray-400">None</span>;
          },
          csv: (r) => realGuarantors(r).map((g: any) => `G${g.number}: ${g.name} ${g.phone || ""}`.trim()).join("; "),
        },
        { key: "start_time", label: "Started", render: (r) => <When value={r.start_time} />, csv: (r) => fmtDateTime(r.start_time) },
        { key: "end_time", label: "Finished", render: (r) => <When value={r.end_time} />, csv: (r) => fmtDateTime(r.end_time) },
        { key: "duration_minutes", label: "Time taken", nowrap: true, render: (r) => fmtMinutes(r.duration_minutes), csv: (r) => fmtMinutes(r.duration_minutes) },
        { key: "home_location_verified", label: "Home location", render: (r) => r.home_location_verified ? <Pill text="Verified" tone="green" /> : <Pill text="Not verified" />, csv: (r) => (r.home_location_verified ? "Verified" : "Not verified") },
        { key: "status", label: "Verification", render: (r) => <StatusPill value={r.status} />, csv: (r) => humanize(r.status) },
        { key: "order_status", label: "Order status", render: (r) => <StatusPill value={r.order_status} />, csv: (r) => humanize(r.order_status) },
        {
          key: "reviews", label: "Reviews",
          render: (r) => {
            if (!r.reviews.length) return <span className="text-gray-400">—</span>;
            const ok = r.reviews.filter((x: any) => x.approved).length;
            const no = r.reviews.length - ok;
            return (
              <div className="flex flex-wrap gap-1">
                {ok > 0 && <Pill text={`${ok} approved`} tone="green" />}
                {no > 0 && <Pill text={`${no} rejected`} tone="red" />}
              </div>
            );
          },
          csv: (r) => r.reviews.map((rv: any) => `${rv.approved ? "Approved" : "Rejected"} by ${rv.reviewer}${rv.remarks ? `: ${rv.remarks}` : ""}`).join(" | "),
        },
        { key: "feedback", label: "Officer feedback", render: (r) => <Clamp text={r.feedback} /> },
      ],
      details: (r) => (
        <div className="grid gap-5 md:grid-cols-2">
          <DetailBlock title="Officer feedback"><Paragraph text={r.feedback} /></DetailBlock>
          <DetailBlock title="Reviews">
            {r.reviews.length ? (
              <div className="space-y-2">
                {r.reviews.map((rv: any, i: number) => (
                  <div key={i} className="rounded-lg border border-stroke bg-white p-3 dark:border-dark-3 dark:bg-gray-dark">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Pill text={rv.approved ? "Approved" : "Rejected"} tone={rv.approved ? "green" : "red"} />
                      <span className="text-sm font-semibold text-dark dark:text-white">{rv.reviewer}</span>
                      <span className="text-xs text-gray-500">{fmtDateTime(rv.created_at)}</span>
                    </div>
                    <Paragraph text={rv.remarks} />
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No reviews yet</p>}
          </DetailBlock>
          <DetailBlock title="Guarantors">
            {realGuarantors(r).length ? (
              <div className="space-y-1 text-sm">
                {realGuarantors(r).map((g: any) => (
                  <p key={g.number}><b>Guarantor {g.number}:</b> {g.name}{g.phone ? ` · ${g.phone}` : ""}{g.cnic ? ` · ${g.cnic}` : ""}</p>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No guarantors added</p>}
          </DetailBlock>
          <DetailBlock title="Address / area"><Paragraph text={r.area} /></DetailBlock>
        </div>
      ),
    }];
  }
  if (role === "delivery") {
    return [
      {
        key: "deliveries",
        label: "Deliveries",
        rows: data.deliveries || [],
        columns: [
          { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
          { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => [r.customer_name, r.phone].filter(Boolean).join(" | ") },
          { key: "product_name", label: "Product", render: (r) => <div className="min-w-[140px]"><p>{r.product_name}</p>{r.imei && <p className="text-xs text-gray-500">IMEI {r.imei}</p>}</div>, csv: (r) => `${r.product_name} ${r.imei || ""}`.trim() },
          { key: "area", label: "Area", render: (r) => <p className="min-w-[110px]">{r.area || "—"}</p> },
          { key: "advance_amount", label: "Advance", nowrap: true, render: (r) => fmtRs(r.advance_amount) },
          { key: "assigned_at", label: "Assigned", render: (r) => <When value={r.assigned_at} />, csv: (r) => fmtDateTime(r.assigned_at) },
          { key: "end_time", label: "Delivered at", render: (r) => <When value={r.end_time} />, csv: (r) => fmtDateTime(r.end_time) },
          { key: "self_pickup", label: "Type", render: (r) => r.self_pickup ? <Pill text="Self pickup" tone="blue" /> : <Pill text="Home delivery" />, csv: (r) => (r.self_pickup ? "Self pickup" : "Home delivery") },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} />, csv: (r) => humanize(r.status) },
          { key: "feedback", label: "Feedback", render: (r) => <Clamp text={r.feedback} /> },
        ],
        details: (r) => (
          <div className="grid gap-5 md:grid-cols-2">
            <DetailBlock title="Delivery feedback"><Paragraph text={r.feedback} /></DetailBlock>
            <DetailBlock title="Address / area"><Paragraph text={r.area} /></DetailBlock>
          </div>
        ),
      },
      {
        key: "cash",
        label: "Cash Collected",
        rows: data.cash || [],
        columns: [
          { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
          { key: "customer_name", label: "Customer", render: (r) => <p className="min-w-[140px] font-semibold">{r.customer_name || "—"}</p> },
          { key: "product_name", label: "Product", render: (r) => <p className="min-w-[140px]">{r.product_name || "—"}</p> },
          { key: "type", label: "Type", render: (r) => <p className="min-w-[120px]">{r.type || "—"}</p> },
          { key: "amount", label: "Amount", nowrap: true, render: (r) => <b>{fmtRs(r.amount)}</b> },
          { key: "payment_method", label: "Method" },
          { key: "submitted_amount", label: "Submitted", nowrap: true, render: (r) => fmtRs(r.submitted_amount) },
          { key: "pending_amount", label: "Still with officer", nowrap: true, render: (r) => r.pending_amount > 0 ? <span className="font-bold text-red-600">{fmtRs(r.pending_amount)}</span> : fmtRs(0) },
          { key: "status", label: "Status", render: (r) => <StatusPill value={r.status} />, csv: (r) => humanize(r.status) },
          { key: "created_at", label: "Taken at", render: (r) => <When value={r.created_at} />, csv: (r) => fmtDateTime(r.created_at) },
        ],
      },
    ];
  }
  return [
    {
      key: "collections",
      label: "Collections",
      rows: data.collections || [],
      columns: [
        { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => [r.customer_name, r.phone].filter(Boolean).join(" | ") },
        { key: "product_name", label: "Product", render: (r) => <p className="min-w-[140px]">{r.product_name || "—"}</p> },
        { key: "area", label: "Area", render: (r) => <p className="min-w-[110px]">{r.area || "—"}</p> },
        { key: "month", label: "Installment", nowrap: true, render: (r) => r.month ? `Month ${r.month}` : humanize(r.payment_type), csv: (r) => (r.month ? `Month ${r.month}` : r.payment_type) },
        { key: "amount", label: "Amount", nowrap: true, render: (r) => <b>{fmtRs(r.amount)}</b> },
        { key: "method", label: "Method" },
        { key: "paid_at", label: "Collected at", render: (r) => <When value={r.paid_at} />, csv: (r) => fmtDateTime(r.paid_at) },
        { key: "submitted", label: "Submitted to outlet", render: (r) => r.submitted ? <Pill text="Submitted" tone="green" /> : <Pill text="Not submitted" tone="amber" />, csv: (r) => (r.submitted ? "Yes" : "No") },
        { key: "remarks", label: "Remarks", render: (r) => <Clamp text={r.remarks} /> },
      ],
      details: (r) => <DetailBlock title="Remarks"><Paragraph text={r.remarks} /></DetailBlock>,
    },
    {
      key: "visits",
      label: "Visits",
      rows: data.visits || [],
      columns: [
        { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => [r.customer_name, r.phone].filter(Boolean).join(" | ") },
        { key: "area", label: "Area", render: (r) => <p className="min-w-[110px]">{r.area || "—"}</p> },
        { key: "visit_time", label: "Visited at", render: (r) => <When value={r.visit_time} />, csv: (r) => fmtDateTime(r.visit_time) },
        { key: "payment_collected", label: "Payment", render: (r) => r.payment_collected ? <Pill text={fmtRs(r.amount)} tone="green" /> : <Pill text="Not collected" />, csv: (r) => (r.payment_collected ? r.amount : "Not collected") },
        { key: "promised_date", label: "Promised date", nowrap: true, render: (r) => fmtDate(r.promised_date), csv: (r) => fmtDate(r.promised_date) },
        { key: "feedback", label: "Customer feedback", render: (r) => <Clamp text={r.feedback} /> },
        { key: "notes", label: "Notes", render: (r) => <Clamp text={r.notes} /> },
        {
          key: "location", label: "Location",
          render: (r) => r.latitude && r.longitude
            ? <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-blue-600 hover:underline">View map</a>
            : <span className="text-gray-400">—</span>,
          csv: (r) => (r.latitude ? `${r.latitude},${r.longitude}` : ""),
        },
      ],
      details: (r) => (
        <div className="grid gap-5 md:grid-cols-2">
          <DetailBlock title="Customer feedback"><Paragraph text={r.feedback} /></DetailBlock>
          <DetailBlock title="Officer notes"><Paragraph text={r.notes} /></DetailBlock>
        </div>
      ),
    },
  ];
}

function summaryCards(role: RoleKey, s: any): { label: string; value: string | number; tone?: string }[] {
  if (!s) return [];
  if (role === "csr") return [
    { label: "Sales / orders", value: s.sales },
    { label: "Total order value", value: fmtRs(s.sales_amount), tone: "text-blue-600" },
    { label: "Delivered", value: s.delivered, tone: "text-emerald-600" },
    { label: "Pending / in process", value: s.pending },
    { label: "Approved", value: s.approved },
    { label: "Rejected / cancelled", value: `${s.rejected} / ${s.cancelled}`, tone: "text-red-600" },
  ];
  if (role === "verification") return [
    { label: "Total verifications", value: s.total },
    { label: "Completed", value: s.completed },
    { label: "In progress", value: s.in_progress },
    { label: "Approved / delivered", value: s.approved, tone: "text-emerald-600" },
    { label: "Rejected", value: s.rejected, tone: "text-red-600" },
    { label: "Avg time", value: fmtMinutes(s.avg_minutes) },
  ];
  if (role === "delivery") return [
    { label: "Delivered", value: s.delivered, tone: "text-emerald-600" },
    { label: "Pending deliveries", value: s.pending },
    { label: "Cash taken", value: fmtRs(s.cash_collected) },
    { label: "Submitted", value: fmtRs(s.cash_submitted), tone: "text-emerald-600" },
    { label: "Still with officer", value: fmtRs(s.cash_pending), tone: "text-red-600" },
  ];
  return [
    { label: "Collections", value: s.collections },
    { label: "Amount collected", value: fmtRs(s.amount_collected), tone: "text-emerald-600" },
    { label: "Customers", value: s.customers },
    { label: "Visits", value: s.visits },
    { label: "Promises to pay", value: s.promises },
  ];
}

function exportCsv(filename: string, tab: TabDef) {
  const header = tab.columns.map((c) => c.label);
  const lines = tab.rows.map((r) => tab.columns.map((c) => (c.csv ? c.csv(r) : r[c.key])));
  downloadCsv([header, ...lines], filename);
}

export default function OfficerTrackingDetail({ id, basePath }: { id: string; basePath: string }) {
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") || monthStart());
  const [to, setTo] = useState(params.get("to") || today());
  const outletId = params.get("outlet_id") || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabKey, setTabKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (rowId: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
    return next;
  });

  // Each change aborts the previous request, so a slower response for an older
  // (or half-typed) range can never overwrite the one for the dates now shown.
  useEffect(() => {
    if (from > to) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const outletQuery = outletId ? `&outlet_id=${encodeURIComponent(outletId)}` : "";
        const res = await fetch(`${BACKEND_URL}/api/officer-tracking/officers/${id}?from=${from}&to=${to}${outletQuery}`, {
          headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to load officer activity"));
        const json = await res.json();
        setData(json.data);
        setExpanded(new Set());
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setError(e.message || "Failed to load officer activity");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [id, from, to, outletId]);

  const role: RoleKey | null = data?.officer?.role || null;
  const tabs = useMemo(() => (role ? buildTabs(role, data) : []), [role, data]);
  const tab = tabs.find((t) => t.key === tabKey) || tabs[0];

  const rows = useMemo(() => {
    if (!tab) return [];
    const q = search.trim().toLowerCase();
    if (!q) return tab.rows;
    return tab.rows.filter((r) =>
      [r.order_ref, r.customer_name, r.phone, r.cnic, r.product_name, r.imei, r.area].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [tab, search]);

  const officer = data?.officer;
  const meta = role ? ROLE_META[role] : null;
  const Icon = meta?.icon || Radar;

  return (
    <>
      <Breadcrumb pageName="Officer Activity" />
      <Link href={`${basePath}?from=${from}&to=${to}${outletId ? `&outlet_id=${encodeURIComponent(outletId)}` : ""}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#ff3d3d]">
        <ArrowLeft className="size-4" /> All officers
      </Link>

      {officer && meta && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-dark">
          <div className="flex items-center gap-4">
            <div className={`flex size-14 items-center justify-center rounded-2xl ${meta.bg}`}>
              <Icon className={`size-7 ${meta.color}`} />
            </div>
            <div>
              <h1 className="text-xl font-black text-dark dark:text-white">{officer.full_name}</h1>
              <p className="text-sm text-gray-500">@{officer.username}{officer.phone ? ` · ${officer.phone}` : ""}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${meta.bg} ${meta.color}`}>{meta.label}</span>
                {officer.outlet && <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600 dark:bg-dark-3 dark:text-gray-300">{officer.outlet.name}</span>}
                <span className="flex items-center gap-1 text-gray-500">
                  <Circle className={`size-2 ${officer.is_online ? "fill-emerald-500 text-emerald-500" : "fill-gray-300 text-gray-300"}`} />
                  {officer.is_online ? "Online" : `Last online ${fmtDateTime(officer.last_online_at)}`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-semibold text-gray-500">
              From
              <input type="date" defaultValue={from} max={to} onChange={(e) => { if (isCompleteDate(e.target.value)) setFrom(e.target.value); }} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white" />
            </label>
            <label className="flex flex-col text-xs font-semibold text-gray-500">
              To
              <input type="date" defaultValue={to} min={from} onChange={(e) => { if (isCompleteDate(e.target.value)) setTo(e.target.value); }} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white" />
            </label>
            {loading && <span className="pb-2 text-xs font-semibold text-gray-400">Updating…</span>}
            {from > to && <span className="pb-2 text-xs font-semibold text-rose-500">"From" is after "To"</span>}
          </div>
        </div>
      )}

      {loading && !data ? (
        <TableSkeleton rows={8} cols={6} />
      ) : error ? (
        <EmptyState icon={Radar} title="Could not load activity" description={error} />
      ) : role && tab ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {summaryCards(role, data.summary).map((c) => (
              <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-dark">
                <p className={`text-lg font-black ${c.tone || "text-dark dark:text-white"}`}>{c.value}</p>
                <p className="text-xs font-semibold text-gray-500">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-dark">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => { setTabKey(t.key); setExpanded(new Set()); }}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab.key === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
                  >
                    {t.label} ({t.rows.length})
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customer, order, IMEI..."
                    className="w-64 rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-3 text-sm text-dark dark:border-dark-3 dark:text-white"
                  />
                </div>
                <button
                  onClick={() => exportCsv(`${officer.username}-${tab.key}-${from}-to-${to}.csv`, { ...tab, rows })}
                  disabled={!rows.length}
                  className="inline-flex items-center gap-1 rounded-lg border border-stroke px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#ff3d3d] hover:text-[#ff3d3d] disabled:opacity-40 dark:border-dark-3 dark:text-gray-300"
                >
                  <Download className="size-4" /> CSV
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <EmptyState icon={Radar} title="Nothing in this period" description="Change the date range to see more activity." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stroke text-[11px] uppercase tracking-wide text-gray-400 dark:border-dark-3">
                      {tab.details && <th className="w-8 px-2 py-2" />}
                      <th className="whitespace-nowrap px-3 py-2 font-bold">S.No</th>
                      {tab.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 font-bold">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const open = expanded.has(r.id);
                      return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={tab.details ? () => toggle(r.id) : undefined}
                            className={`border-b border-stroke align-top dark:border-dark-3 ${tab.details ? "cursor-pointer" : ""} ${open ? "bg-gray-50 dark:bg-dark-2" : "hover:bg-gray-50 dark:hover:bg-dark-2"}`}
                          >
                            {tab.details && (
                              <td className="px-2 py-3 text-gray-400">
                                {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              </td>
                            )}
                            <td className="px-3 py-3 text-gray-500 tabular-nums">{idx + 1}</td>
                            {tab.columns.map((c) => (
                              <td key={c.key} className={`px-3 py-3 text-dark dark:text-gray-200 ${c.nowrap ? "whitespace-nowrap" : ""}`}>
                                {c.render ? c.render(r) : (r[c.key] ?? "—")}
                              </td>
                            ))}
                          </tr>
                          {open && tab.details && (
                            <tr className="border-b border-stroke bg-gray-50 dark:border-dark-3 dark:bg-dark-2">
                              <td />
                              <td colSpan={tab.columns.length + 1} className="px-3 pb-5 pt-1">
                                {tab.details(r)}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
