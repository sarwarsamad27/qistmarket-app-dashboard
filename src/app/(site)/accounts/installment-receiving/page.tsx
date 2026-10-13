"use client";

import { Fragment, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { HandCoins, Wallet, Wifi, CheckCircle2, AlertCircle, PieChart, Search, ReceiptText, LayoutDashboard, ListChecks, FastForward, Landmark } from "lucide-react";
import DateRangeFilter, { DateRange } from "@/components/Accounts/DateRangeFilter";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import OutletSelector from "@/components/common/OutletSelector";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { StatCardSkeleton, TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import ExportMenu from "@/components/Accounts/ExportMenu";
import ReceivePanel from "./_components/ReceivePanel";
import CollectionsPanel from "./_components/CollectionsPanel";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface HistoryEntry { date: string; month: number; amount: number; channel: "cash" | "online" | "other"; method?: string | null }
interface OrderTotals { order_total?: number; order_paid?: number; order_remaining?: number }
interface DueRow extends OrderTotals { order_id: number; order_ref: string; customer_name: string; outlet_name: string; month: number; dueDate: string; amount: number; installment_amount?: number; paid_amount?: number; history?: HistoryEntry[] }
interface OrderRow extends OrderTotals { order_id: number; order_ref: string; customer_name: string; outlet_name: string | null; month?: number | null; amount: number; installment_amount?: number | null; paid_amount?: number | null; history?: HistoryEntry[] }
interface EventRow { order_id: number; order_ref: string; customer_name: string; outlet_name: string | null; month: number; date: string; amount: number; method?: string }
interface Overview {
  startDate: string; endDate: string;
  dueCount: number;
  dueAmount: number;
  due: DueRow[];
  advancePending: number;
  advancePendingOrders: OrderRow[];
  advancePaid: number;
  advancePaidOrders: (OrderRow & { months_covered: number })[];
  mix: { fullyPaidCount: number; partialCount: number; otherCount: number };
  fullyPaidOrders: OrderRow[];
  partialOrders: OrderRow[];
  collections: { cash: number; online: number; bank: number };
  cashEvents: EventRow[];
  onlineEvents: EventRow[];
  bankEvents: EventRow[];
}

// A single shape every card's underlying list gets normalized into, so one table can render
// whichever "history" is currently selected instead of needing a bespoke table per card.
type DisplayRow = OrderTotals & { key: string; order_id: number; order_ref: string; customer_name: string; outlet_name: string | null; month: number | null; date: string | null; amount: number; installment_amount?: number | null; paid_amount?: number | null; history?: HistoryEntry[] };

type CardKey = "due" | "advance" | "advancePaid" | "partial" | "full" | "cash" | "online" | "bank";
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function InstallmentReceivingPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [outletId, setOutletId] = useState("all");
  const [search, setSearch] = useState("");
  // Which card's "history" the table below is currently showing — defaults to Due
  // Installments (the page's original/primary view). Clicking the already-active card
  // deselects it back to this default, same as the ask: "double tap unselects".
  const [activeCard, setActiveCard] = useState<CardKey>("due");
  const selectCard = (key: CardKey) => { setActiveCard((prev) => (prev === key ? "due" : key)); setExpandedRowKey(null); };
  // Which row's own real-payment timeline is expanded open below it — "click a row, see
  // when/how much was actually paid against it, in order". Cash/Online cards are already
  // single transactions, so they have no further history to expand into.
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  // "receive" = take a payment for any customer; "overview" = the analysis cards below; "collections" = every payment received.
  const [section, setSection] = useState<"receive" | "overview" | "collections">("receive");
  const [receiveOrderId, setReceiveOrderId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Dates for the Cash / Online / Bank collection cards (default: this month).
  const [range, setRange] = useState<DateRange>(() => { const n = new Date(); return { from: ymd(new Date(n.getFullYear(), n.getMonth(), 1)), to: ymd(n) }; });

  // Each card's own list (from the API) normalized into one shared shape, so the table
  // below can render whichever card is selected without a bespoke table per card.
  const getCardRows = (): { title: string; dateLabel: string | null; rows: DisplayRow[]; emptyTitle: string } => {
    if (!data) return { title: "", dateLabel: null, rows: [], emptyTitle: "" };
    switch (activeCard) {
      case "advancePaid":
        return {
          title: "Paid in Advance (future months already paid)",
          dateLabel: null,
          rows: data.advancePaidOrders.map((r) => ({ key: `${r.order_id}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: r.month ?? null, date: null, amount: r.amount, order_total: r.order_total, order_paid: r.order_paid, order_remaining: r.order_remaining, history: r.history })),
          emptyTitle: "No customer has paid ahead",
        };
      case "bank":
        return {
          title: "Bank Transfer & Other Collections",
          dateLabel: "Payment Date",
          rows: data.bankEvents.map((r, i) => ({ key: `${r.order_id}-${i}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: r.month, date: r.date, amount: r.amount })),
          emptyTitle: "No bank / other collections in these dates",
        };
      case "advance":
        return {
          title: "Down Payment Pending",
          dateLabel: null,
          rows: data.advancePendingOrders.map((r) => ({ key: `${r.order_id}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: null, date: null, amount: r.amount, history: r.history })),
          emptyTitle: "No orders with a pending advance",
        };
      case "partial":
        return {
          title: "Partially Paid Orders",
          dateLabel: null,
          rows: data.partialOrders.map((r) => ({ key: `${r.order_id}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: r.month ?? null, date: null, amount: r.amount, installment_amount: r.installment_amount, paid_amount: r.paid_amount, order_total: r.order_total, order_paid: r.order_paid, order_remaining: r.order_remaining, history: r.history })),
          emptyTitle: "No partially paid orders",
        };
      case "full":
        return {
          title: "Fully Paid Orders",
          dateLabel: null,
          rows: data.fullyPaidOrders.map((r) => ({ key: `${r.order_id}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: null, date: null, amount: r.amount, order_total: r.order_total, order_paid: r.order_paid, order_remaining: r.order_remaining, history: r.history })),
          emptyTitle: "No fully paid orders yet",
        };
      case "cash":
        return {
          title: "Cash Collections",
          dateLabel: "Payment Date",
          rows: data.cashEvents.map((r, i) => ({ key: `${r.order_id}-${i}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: r.month, date: r.date, amount: r.amount })),
          emptyTitle: "No cash collections recorded",
        };
      case "online":
        return {
          title: "Online Collections",
          dateLabel: "Payment Date",
          rows: data.onlineEvents.map((r, i) => ({ key: `${r.order_id}-${i}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: r.month, date: r.date, amount: r.amount })),
          emptyTitle: "No online collections recorded",
        };
      case "due":
      default:
        return {
          title: "Due Installments",
          dateLabel: "Due Date",
          rows: data.due.map((r) => ({ key: `${r.order_id}-${r.month}`, order_id: r.order_id, order_ref: r.order_ref, customer_name: r.customer_name, outlet_name: r.outlet_name, month: r.month, date: r.dueDate, amount: r.amount, installment_amount: r.installment_amount, paid_amount: r.paid_amount, order_total: r.order_total, order_paid: r.order_paid, order_remaining: r.order_remaining, history: r.history })),
          emptyTitle: "No due installments",
        };
    }
  };

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) return;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/accounts/installment-receiving?outletId=${outletId}${range.from ? `&startDate=${range.from}` : ""}${range.to ? `&endDate=${range.to}` : ""}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error("Failed to load installment receiving overview:", err))
      .finally(() => setLoading(false));
  }, [outletId, refreshKey, range]);

  // Deep link from Receivables: /accounts/installment-receiving?order=<id> opens that account.
  useEffect(() => {
    const id = parseInt(new URLSearchParams(window.location.search).get("order") || "");
    if (id) { setReceiveOrderId(id); setSection("receive"); }
  }, []);

  const openReceive = (orderId: number) => { setReceiveOrderId(orderId); setSection("receive"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <>
      <Breadcrumb pageName="Installment Receiving" />
      <PageHeader
        icon={HandCoins}
        title="Installment Receiving"
        subtitle="Receive any customer's installment at Head Office, track due / partial / advance payments, and every collection."
        actions={section === "overview" ? <OutletSelector selectedId={outletId} onSelect={setOutletId} /> : undefined}
      />

      <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {([["receive", "Receive Installment", ReceiptText], ["overview", "Due & Payment Status", LayoutDashboard], ["collections", "Collections", ListChecks]] as const).map(([k, l, Icon]) => (
          <button key={k} onClick={() => setSection(k)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${section === k ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <Icon className="size-3.5" /> {l}
          </button>
        ))}
      </div>

      {section === "receive" && <ReceivePanel initialOrderId={receiveOrderId} onReceived={() => setRefreshKey((k) => k + 1)} />}
      {section === "collections" && <CollectionsPanel refreshKey={refreshKey} />}

      {section === "overview" && (<>

      <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-gray-400">Installments status (today)</p>
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={AlertCircle} label={`Due / overdue · ${PKR(data?.dueAmount || 0)}`} value={data?.dueCount ?? 0} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" onClick={() => selectCard("due")} active={activeCard === "due"} />
            <StatCard icon={PieChart} label="Partially Paid Orders" value={data?.mix.partialCount ?? 0} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" onClick={() => selectCard("partial")} active={activeCard === "partial"} />
            <StatCard icon={FastForward} label={`Paid in Advance · ${data?.advancePaidOrders.length ?? 0} customers`} value={PKR(data?.advancePaid || 0)} accent="text-teal-600" bg="bg-teal-50 dark:bg-teal-500/10" bar="bg-teal-500" onClick={() => selectCard("advancePaid")} active={activeCard === "advancePaid"} />
            <StatCard icon={Wallet} label="Down Payment Pending" value={PKR(data?.advancePending || 0)} accent="text-amber-600" bg="bg-amber-50 dark:bg-amber-500/10" bar="bg-amber-500" onClick={() => selectCard("advance")} active={activeCard === "advance"} />
            <StatCard icon={CheckCircle2} label="Fully Paid Orders" value={data?.mix.fullyPaidCount ?? 0} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" onClick={() => selectCard("full")} active={activeCard === "full"} />
          </>
        )}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Collected in these dates</p>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={HandCoins} label="Cash (outlet, officer, Head Office)" value={PKR(data?.collections.cash || 0)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" onClick={() => selectCard("cash")} active={activeCard === "cash"} />
            <StatCard icon={Wifi} label="Online (1Bill / SmartPay QR)" value={PKR(data?.collections.online || 0)} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" onClick={() => selectCard("online")} active={activeCard === "online"} />
            <StatCard icon={Landmark} label="Bank transfer & other" value={PKR(data?.collections.bank || 0)} accent="text-violet-600" bg="bg-violet-50 dark:bg-violet-500/10" bar="bg-violet-500" onClick={() => selectCard("bank")} active={activeCard === "bank"} />
          </>
        )}
      </div>

      {!loading && data && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, order ref, outlet..."
            className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white"
          />
        </div>
        <div className="ml-auto">
          <ExportMenu title={getCardRows().title} columns={[
            { header: "#", value: (_: DisplayRow, i) => i + 1 },
            { header: "Order Ref", value: (r) => r.order_ref },
            { header: "Customer", value: (r) => r.customer_name },
            { header: "Outlet", value: (r) => r.outlet_name || "" },
            { header: "Month", value: (r) => r.month ?? "" },
            { header: getCardRows().dateLabel || "Date", value: (r) => (r.date ? new Date(r.date).toLocaleDateString() : "") },
            { header: "Installment", value: (r) => r.installment_amount ?? "", numeric: true },
            { header: "Paid (this month)", value: (r) => r.paid_amount ?? "", numeric: true },
            { header: "Amount", value: (r) => r.amount, numeric: true },
            { header: "Order total", value: (r) => r.order_total ?? "", numeric: true },
            { header: "Order paid", value: (r) => r.order_paid ?? "", numeric: true },
            { header: "Order remaining", value: (r) => r.order_remaining ?? "", numeric: true },
          ]} getRows={() => getCardRows().rows} />
        </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : data ? (
        (() => {
          const { title, dateLabel, rows, emptyTitle } = getCardRows();
          // Due / Partial rows: the month's installment, what's paid of it and what's left; plus the whole order.
          const showSplit = activeCard === "due" || activeCard === "partial";
          const showOrder = ["due", "partial", "advancePaid", "full"].includes(activeCard);
          const q = search.trim().toLowerCase();
          const filtered = q
            ? rows.filter((row) =>
                row.order_ref.toLowerCase().includes(q) ||
                row.customer_name.toLowerCase().includes(q) ||
                (row.outlet_name || "").toLowerCase().includes(q)
              )
            : rows;
          return (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
              <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3 dark:border-white/5">
                <h2 className="text-sm font-bold text-dark dark:text-white">{title} <span className="font-normal text-gray-400">({filtered.length})</span></h2>
                {activeCard !== "due" && (
                  <button onClick={() => setActiveCard("due")} className="text-xs font-semibold text-[#ff3d3d] hover:underline">
                    Back to Due Installments
                  </button>
                )}
              </div>
              {filtered.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3 font-bold">#</th>
                        <th className="px-4 py-3 font-bold">Order Ref</th>
                        <th className="px-4 py-3 font-bold">Customer</th>
                        <th className="px-4 py-3 font-bold">Outlet</th>
                        {rows.some((r) => r.month !== null) && <th className="px-4 py-3 font-bold">Month</th>}
                        {dateLabel && <th className="px-4 py-3 font-bold">{dateLabel}</th>}
                        {showSplit && <th className="px-4 py-3 text-right font-bold">Installment</th>}
                        {showSplit && <th className="px-4 py-3 text-right font-bold">Paid</th>}
                        <th className="px-4 py-3 text-right font-bold">{showSplit ? "Remaining" : "Amount"}</th>
                        {showOrder && <th className="px-4 py-3 text-right font-bold">Order: paid / remaining</th>}
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, i) => {
                        const hasHistory = !!row.history && row.history.length > 0;
                        const isExpanded = expandedRowKey === row.key;
                        const colCount = 4 + (rows.some((r) => r.month !== null) ? 1 : 0) + (dateLabel ? 1 : 0) + 2 + (showSplit ? 2 : 0) + (showOrder ? 1 : 0);
                        return (
                          <Fragment key={row.key}>
                            <tr
                              onClick={() => hasHistory && setExpandedRowKey((prev) => (prev === row.key ? null : row.key))}
                              className={`border-t border-slate-50 transition hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5 ${hasHistory ? "cursor-pointer" : ""} ${isExpanded ? "bg-slate-50 dark:bg-white/5" : ""}`}
                            >
                              <td className="px-4 py-3.5 text-gray-400">{i + 1}</td>
                              <td className="px-4 py-3.5 font-semibold text-dark dark:text-white">
                                {row.order_ref}
                                {hasHistory && <span className="ml-1.5 text-[10px] text-[#ff3d3d]">{isExpanded ? "▲" : "▼"}</span>}
                              </td>
                              <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{row.customer_name}</td>
                              <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{row.outlet_name || "—"}</td>
                              {rows.some((r) => r.month !== null) && <td className="px-4 py-3.5 text-gray-500">{row.month ?? "—"}</td>}
                              {dateLabel && <td className="px-4 py-3.5 text-gray-500">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td>}
                              {showSplit && <td className="px-4 py-3.5 text-right tabular-nums text-gray-500">{row.installment_amount != null ? PKR(row.installment_amount) : "—"}</td>}
                              {showSplit && <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600">{row.paid_amount ? PKR(row.paid_amount) : "—"}</td>}
                              <td className={`px-4 py-3.5 text-right tabular-nums font-bold ${showSplit ? "text-rose-600" : "text-dark dark:text-white"}`}>{PKR(row.amount)}</td>
                              {showOrder && <td className="px-4 py-3.5 text-right text-xs tabular-nums"><span className="text-emerald-600">{PKR(row.order_paid || 0)}</span><span className="text-gray-400"> / </span><span className="font-semibold text-rose-600">{PKR(row.order_remaining || 0)}</span><span className="block text-[10px] text-gray-400">of {PKR(row.order_total || 0)}</span></td>}
                              <td className="px-4 py-3.5 text-right">
                                {["due", "partial", "advance", "advancePaid"].includes(activeCard) && (
                                  <button onClick={(e) => { e.stopPropagation(); openReceive(row.order_id); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Receive</button>
                                )}
                              </td>
                            </tr>
                            {isExpanded && hasHistory && (
                              <tr className="bg-slate-50 dark:bg-white/5">
                                <td colSpan={colCount} className="px-4 py-3">
                                  {row.order_total != null && (
                                    <div className="mb-3 grid grid-cols-3 gap-2 text-xs sm:max-w-lg">
                                      <div className="rounded-lg bg-white p-2 dark:bg-boxdark"><p className="text-gray-400">Order total (installments)</p><p className="font-bold tabular-nums">{PKR(row.order_total)}</p></div>
                                      <div className="rounded-lg bg-white p-2 dark:bg-boxdark"><p className="text-gray-400">Paid so far</p><p className="font-bold tabular-nums text-emerald-600">{PKR(row.order_paid || 0)}</p></div>
                                      <div className="rounded-lg bg-white p-2 dark:bg-boxdark"><p className="text-gray-400">Still to pay</p><p className="font-bold tabular-nums text-rose-600">{PKR(row.order_remaining || 0)}</p></div>
                                    </div>
                                  )}
                                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">Payment History — every real payment against this order, oldest first</p>
                                  <div className="overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-white/10 dark:bg-boxdark">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-gray-50 uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
                                        <tr>
                                          <th className="px-3 py-2 font-bold">Date</th>
                                          <th className="px-3 py-2 font-bold">Month</th>
                                          <th className="px-3 py-2 font-bold">Method</th>
                                          <th className="px-3 py-2 text-right font-bold">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.history!.map((h, hi) => (
                                          <tr key={hi} className="border-t border-slate-50 dark:border-white/5">
                                            <td className="px-3 py-2 text-gray-500">{new Date(h.date).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-gray-500">{h.month}</td>
                                            <td className="px-3 py-2 text-gray-500">{h.method || <span className="capitalize">{h.channel}</span>}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-600">{PKR(h.amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-2">
                  <EmptyState icon={q ? Search : HandCoins} title={q ? "No matching results" : emptyTitle} description={q ? "Nothing matches that search." : undefined} />
                </div>
              )}
            </div>
          );
        })()
      ) : null}
      </>)}
    </>
  );
}
