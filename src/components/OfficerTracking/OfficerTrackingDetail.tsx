"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";
import { ArrowLeft, Circle, Download, Radar, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import { apiErrorMessage } from "@/lib/apiErrors";
import { ROLE_META, RoleKey, fmtRs, fmtDate, fmtDateTime, fmtMinutes, monthStart, today } from "./shared";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

type Column = { key: string; label: string; render?: (row: any) => ReactNode; csv?: (row: any) => any };
type TabDef = { key: string; label: string; rows: any[]; columns: Column[] };

const OrderLink = ({ row }: { row: any }) =>
  row.order_id ? (
    <a href={`/orders/${row.order_id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline">
      {row.order_ref}
    </a>
  ) : <span>{row.order_ref || "—"}</span>;

const Customer = ({ row }: { row: any }) => (
  <div>
    <p className="font-semibold text-dark dark:text-white">{row.customer_name || "—"}</p>
    <p className="text-xs text-gray-500">{[row.phone, row.cnic].filter(Boolean).join(" · ")}</p>
  </div>
);

const Pill = ({ text, tone = "gray" }: { text: string; tone?: "gray" | "green" | "red" | "amber" | "blue" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-600 dark:bg-dark-3 dark:text-gray-300",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${tones[tone]}`}>{text}</span>;
};

const statusTone = (s?: string) => {
  const v = String(s || "").toLowerCase();
  if (["completed", "approved", "delivered", "paid", "submitted"].includes(v)) return "green";
  if (["rejected", "cancelled", "expired"].includes(v)) return "red";
  if (["pending", "in_progress", "in progress", "new"].includes(v)) return "amber";
  return "gray";
};

function buildTabs(role: RoleKey, data: any): TabDef[] {
  if (role === "verification") {
    return [{
      key: "verifications",
      label: "Verifications",
      rows: data.verifications || [],
      columns: [
        { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => `${r.customer_name || ""} ${r.phone || ""} ${r.cnic || ""}` },
        { key: "product_name", label: "Product", render: (r) => <div><p>{r.product_name}</p><p className="text-xs text-gray-500">{fmtRs(r.total_amount)}</p></div> },
        { key: "area", label: "Area" },
        {
          key: "guarantors", label: "Guarantors",
          render: (r) => r.guarantors.length
            ? <div className="space-y-0.5 text-xs">{r.guarantors.map((g: any) => <p key={g.number}><b>G{g.number}:</b> {g.name} {g.phone ? `· ${g.phone}` : ""}</p>)}</div>
            : "—",
          csv: (r) => r.guarantors.map((g: any) => `G${g.number}: ${g.name}`).join("; "),
        },
        { key: "start_time", label: "Started", render: (r) => fmtDateTime(r.start_time), csv: (r) => fmtDateTime(r.start_time) },
        { key: "end_time", label: "Finished", render: (r) => fmtDateTime(r.end_time), csv: (r) => fmtDateTime(r.end_time) },
        { key: "duration_minutes", label: "Time taken", render: (r) => fmtMinutes(r.duration_minutes), csv: (r) => fmtMinutes(r.duration_minutes) },
        { key: "home_location_verified", label: "Home location", render: (r) => r.home_location_verified ? <Pill text="Verified" tone="green" /> : <Pill text="No" />, csv: (r) => (r.home_location_verified ? "Verified" : "No") },
        { key: "status", label: "Verification", render: (r) => <Pill text={r.status} tone={statusTone(r.status) as any} /> },
        { key: "order_status", label: "Order status", render: (r) => <Pill text={r.order_status} tone={statusTone(r.order_status) as any} /> },
        {
          key: "reviews", label: "Reviews",
          render: (r) => r.reviews.length
            ? <div className="space-y-0.5 text-xs">{r.reviews.map((rv: any, i: number) => <p key={i}><span className={rv.approved ? "text-emerald-600" : "text-red-600"}>{rv.approved ? "✓" : "✗"}</span> {rv.reviewer}{rv.remarks ? ` — ${rv.remarks}` : ""}</p>)}</div>
            : "—",
          csv: (r) => r.reviews.map((rv: any) => `${rv.approved ? "Approved" : "Rejected"} by ${rv.reviewer}`).join("; "),
        },
        { key: "feedback", label: "Feedback", render: (r) => <p className="max-w-[240px] text-xs">{r.feedback || "—"}</p> },
      ],
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
          { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => `${r.customer_name || ""} ${r.phone || ""}` },
          { key: "product_name", label: "Product", render: (r) => <div><p>{r.product_name}</p><p className="text-xs text-gray-500">{r.imei ? `IMEI ${r.imei}` : ""}</p></div>, csv: (r) => `${r.product_name} ${r.imei || ""}` },
          { key: "area", label: "Area" },
          { key: "advance_amount", label: "Advance", render: (r) => fmtRs(r.advance_amount) },
          { key: "assigned_at", label: "Assigned", render: (r) => fmtDateTime(r.assigned_at), csv: (r) => fmtDateTime(r.assigned_at) },
          { key: "end_time", label: "Delivered at", render: (r) => fmtDateTime(r.end_time), csv: (r) => fmtDateTime(r.end_time) },
          { key: "self_pickup", label: "Type", render: (r) => r.self_pickup ? <Pill text="Self pickup" tone="blue" /> : <Pill text="Home delivery" />, csv: (r) => (r.self_pickup ? "Self pickup" : "Home delivery") },
          { key: "status", label: "Status", render: (r) => <Pill text={r.status} tone={statusTone(r.status) as any} /> },
          { key: "feedback", label: "Feedback", render: (r) => <p className="max-w-[240px] text-xs">{r.feedback || "—"}</p> },
        ],
      },
      {
        key: "cash",
        label: "Cash Collected",
        rows: data.cash || [],
        columns: [
          { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
          { key: "customer_name", label: "Customer" },
          { key: "product_name", label: "Product" },
          { key: "type", label: "Type" },
          { key: "amount", label: "Amount", render: (r) => <b>{fmtRs(r.amount)}</b> },
          { key: "payment_method", label: "Method" },
          { key: "submitted_amount", label: "Submitted", render: (r) => fmtRs(r.submitted_amount) },
          { key: "pending_amount", label: "Still with officer", render: (r) => r.pending_amount > 0 ? <span className="font-bold text-red-600">{fmtRs(r.pending_amount)}</span> : fmtRs(0) },
          { key: "status", label: "Status", render: (r) => <Pill text={r.status} tone={statusTone(r.status) as any} /> },
          { key: "created_at", label: "Taken at", render: (r) => fmtDateTime(r.created_at), csv: (r) => fmtDateTime(r.created_at) },
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
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => `${r.customer_name || ""} ${r.phone || ""}` },
        { key: "product_name", label: "Product" },
        { key: "area", label: "Area" },
        { key: "month", label: "Installment", render: (r) => r.month ? `Month ${r.month}` : (r.payment_type || "—"), csv: (r) => (r.month ? `Month ${r.month}` : r.payment_type) },
        { key: "amount", label: "Amount", render: (r) => <b>{fmtRs(r.amount)}</b> },
        { key: "method", label: "Method" },
        { key: "paid_at", label: "Collected at", render: (r) => fmtDateTime(r.paid_at), csv: (r) => fmtDateTime(r.paid_at) },
        { key: "submitted", label: "Submitted to outlet", render: (r) => r.submitted ? <Pill text="Yes" tone="green" /> : <Pill text="No" tone="amber" />, csv: (r) => (r.submitted ? "Yes" : "No") },
        { key: "remarks", label: "Remarks", render: (r) => <p className="max-w-[240px] text-xs">{r.remarks || "—"}</p> },
      ],
    },
    {
      key: "visits",
      label: "Visits",
      rows: data.visits || [],
      columns: [
        { key: "order_ref", label: "Order", render: (r) => <OrderLink row={r} /> },
        { key: "customer_name", label: "Customer", render: (r) => <Customer row={r} />, csv: (r) => `${r.customer_name || ""} ${r.phone || ""}` },
        { key: "area", label: "Area" },
        { key: "visit_time", label: "Visited at", render: (r) => fmtDateTime(r.visit_time), csv: (r) => fmtDateTime(r.visit_time) },
        { key: "payment_collected", label: "Payment", render: (r) => r.payment_collected ? <Pill text={fmtRs(r.amount)} tone="green" /> : <Pill text="Not collected" />, csv: (r) => (r.payment_collected ? r.amount : "Not collected") },
        { key: "promised_date", label: "Promised date", render: (r) => fmtDate(r.promised_date), csv: (r) => fmtDate(r.promised_date) },
        { key: "feedback", label: "Customer feedback", render: (r) => <p className="max-w-[240px] text-xs">{r.feedback || "—"}</p> },
        { key: "notes", label: "Notes", render: (r) => <p className="max-w-[240px] text-xs">{r.notes || "—"}</p> },
        {
          key: "location", label: "Location",
          render: (r) => r.latitude && r.longitude
            ? <a href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Map</a>
            : "—",
          csv: (r) => (r.latitude ? `${r.latitude},${r.longitude}` : ""),
        },
      ],
    },
  ];
}

function summaryCards(role: RoleKey, s: any): { label: string; value: string | number; tone?: string }[] {
  if (!s) return [];
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
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = tab.columns.map((c) => esc(c.label)).join(",");
  const lines = tab.rows.map((r) => tab.columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(","));
  const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function OfficerTrackingDetail({ id, basePath }: { id: string; basePath: string }) {
  const params = useSearchParams();
  const [from, setFrom] = useState(params.get("from") || monthStart());
  const [to, setTo] = useState(params.get("to") || today());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabKey, setTabKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/officer-tracking/officers/${id}?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to load officer activity"));
      const json = await res.json();
      setData(json.data);
    } catch (e: any) {
      setError(e.message || "Failed to load officer activity");
    } finally {
      setLoading(false);
    }
  }, [id, from, to]);

  useEffect(() => { load(); }, [load]);

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
      <Link href={`${basePath}?from=${from}&to=${to}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#ff3d3d]">
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
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white" />
            </label>
            <label className="flex flex-col text-xs font-semibold text-gray-500">
              To
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark dark:border-dark-3 dark:text-white" />
            </label>
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
                    onClick={() => setTabKey(t.key)}
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
                      {tab.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 font-bold">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke dark:divide-dark-3">
                    {rows.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-gray-50 dark:hover:bg-dark-2">
                        {tab.columns.map((c) => (
                          <td key={c.key} className="px-3 py-2.5 text-dark dark:text-gray-200">
                            {c.render ? c.render(r) : (r[c.key] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
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
