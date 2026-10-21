"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { FileText, BookOpen, TrendingUp, ShoppingBag, Landmark, HandCoins, Users2, Wallet, Handshake, Package } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import EmptyState from "@/components/Accounts/EmptyState";
import { TableSkeleton } from "@/components/Accounts/Skeleton";
import StatCard, { PKR } from "@/components/Accounts/StatCard";
import { formatExactDate } from "@/utils/dateUtils";
import DateRangeFilter, { type DateRange } from "@/components/Accounts/DateRangeFilter";
import { pktDate, pktMonthStart } from "@/utils/pkt";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });

const TABS = [
  { key: "daybook" as const, label: "Daybook", icon: BookOpen },
  { key: "sales" as const, label: "Sales", icon: ShoppingBag },
  { key: "profit-loss" as const, label: "Profit & Loss", icon: TrendingUp },
  { key: "financials" as const, label: "Financials", icon: Landmark },
  { key: "installment-recoveries" as const, label: "Installment Recoveries", icon: HandCoins },
  { key: "officer-recoveries" as const, label: "Officer Recovery", icon: Users2 },
  { key: "payroll" as const, label: "Payroll", icon: Wallet },
  { key: "vendors" as const, label: "Vendor Aging", icon: Handshake },
  { key: "product-sales" as const, label: "Product Sales", icon: Package },
];

const ENDPOINT: Record<(typeof TABS)[number]["key"], string> = {
  daybook: "/api/outlet-reports/daybook",
  sales: "/api/outlet-reports/sales",
  "profit-loss": "/api/outlet-reports/profit-loss",
  financials: "/api/outlet-reports/financials",
  "installment-recoveries": "/api/outlet-reports/installment-recoveries",
  "officer-recoveries": "/api/outlet-reports/officer-recoveries",
  payroll: "/api/admin-panel/reports/payroll",
  vendors: "/api/accounts/vendors/aging",
  "product-sales": "/api/admin-panel/reports/product-sales",
};

export default function AdminReportsHubPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("daybook");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Every tab is filtered by the same From–To range (default: this month).
  const [range, setRange] = useState<DateRange>({ from: pktMonthStart(), to: pktDate() });

  useEffect(() => {
    setLoading(true);
    setData(null);
    const qs = new URLSearchParams();
    if (range.from) qs.set("startDate", range.from);
    if (range.to) qs.set("endDate", range.to);
    fetch(`${BACKEND_URL}${ENDPOINT[tab]}${qs.toString() ? `?${qs}` : ""}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => { if (json.success) setData(json.data); })
      .catch((err) => console.error(`Failed to load ${tab} report:`, err))
      .finally(() => setLoading(false));
  }, [tab, range.from, range.to]);

  return (
    <>
      <Breadcrumb pageName="Reports Hub" />
      <PageHeader icon={FileText} title="Reports Hub" subtitle="Daybook, sales, P&L, financials, and recovery reports — company-wide." />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
        <p className="mt-1.5 text-[11px] text-gray-400">
          {tab === "vendors" ? "Invoices purchased in this period (aging is as of today)." : tab === "payroll" ? "Payroll months that fall in this period." : tab === "daybook" ? "Leave both dates empty for today." : "Leave both dates empty for all time."}
        </p>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : !data ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={FileText} title="No data for this report" /></div>
      ) : (
        <>
          {tab === "daybook" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard icon={TrendingUp} label="Total Income" value={PKR(data.summary.totalIncome)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
                <StatCard icon={HandCoins} label="Total Expense" value={PKR(data.summary.totalExpense)} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" />
                <StatCard icon={Landmark} label="Net Cash" value={PKR(data.summary.netCash)} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
              </div>
              <ReportTable
                rows={data.payments}
                empty="No payments recorded for this period."
                columns={[
                  { header: "Order", cell: (p: any) => p.order_ref || "—" },
                  { header: "Purchaser / Customer", cell: (p: any) => p.purchaser_name || p.customer_name || "—" },
                  { header: "Type", cell: (p: any) => <span className="capitalize">{p.paymentType}</span> },
                  { header: "Amount", align: "right", cell: (p: any) => PKR(p.amount) },
                  { header: "Paid At", cell: (p: any) => new Date(p.paidAt).toLocaleString() },
                ]}
              />
            </div>
          )}

          {tab === "sales" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard icon={ShoppingBag} label="Total Orders" value={data.summary.totalOrders} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
                <StatCard icon={Landmark} label="Gross Amount" value={PKR(data.summary.totalGrossAmount)} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
                <StatCard icon={TrendingUp} label="Total Received" value={PKR(data.summary.totalReceived)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
              </div>
              <ReportTable
                rows={data.orders}
                empty="No delivered orders for this period."
                columns={[
                  { header: "Order", cell: (o: any) => o.order_ref },
                  { header: "Purchaser Name", cell: (o: any) => o.purchaser_name || o.customer_name },
                  { header: "Total", align: "right", cell: (o: any) => PKR(o.total_amount) },
                  { header: "Delivered", cell: (o: any) => new Date(o.updated_at).toLocaleDateString() },
                ]}
              />
            </div>
          )}

          {tab === "profit-loss" && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard icon={TrendingUp} label="Revenue" value={PKR(data.revenue)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
              <StatCard icon={HandCoins} label="COGS" value={PKR(data.cogs)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
              <StatCard icon={Landmark} label="Gross Profit" value={PKR(data.grossProfit)} accent="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/10" bar="bg-blue-500" />
              <StatCard icon={HandCoins} label="Expenses" value={PKR(data.expenses)} accent="text-rose-600" bg="bg-rose-50 dark:bg-rose-500/10" bar="bg-rose-500" />
              <StatCard icon={TrendingUp} label="Net Profit" value={PKR(data.netProfit)} accent="text-purple-600" bg="bg-purple-50 dark:bg-purple-500/10" bar="bg-purple-500" />
            </div>
          )}

          {tab === "financials" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">Expense Vouchers</h3>
                <ReportTable
                  rows={data.expenses}
                  empty="No expense vouchers for this period."
                  columns={[
                    { header: "Voucher", cell: (e: any) => e.voucher_number || e.id },
                    { header: "Outlet", cell: (e: any) => e.outlet?.name || "Head Office" },
                    { header: "Category", cell: (e: any) => [...new Set((e.items || []).map((i: any) => i.category || "General"))].join(", ") || "—" },
                    { header: "Amount", align: "right", cell: (e: any) => PKR(e.total_amount) },
                    { header: "Date", cell: (e: any) => new Date(e.date).toLocaleDateString() },
                  ]}
                />
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">Vendor Payments</h3>
                <ReportTable
                  rows={data.vendorPayments}
                  empty="No vendor payments for this period."
                  columns={[
                    { header: "Vendor", cell: (v: any) => v.vendor?.name || "—" },
                    { header: "Amount", align: "right", cell: (v: any) => PKR(v.amount) },
                    { header: "Date", cell: (v: any) => formatExactDate(v.created_at, 'DD MMM YYYY, hh:mm A') },
                  ]}
                />
              </div>
            </div>
          )}

          {tab === "installment-recoveries" && (
            <div className="space-y-6">
              <StatCard icon={HandCoins} label="Total Recovered" value={PKR(data.totalRecovered)} accent="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-500/10" bar="bg-emerald-500" />
              <ReportTable
                rows={data.recoveries}
                empty="No installment recoveries for this period."
                columns={[
                  { header: "Order", cell: (r: any) => r.order_ref },
                  { header: "Purchaser Name", cell: (r: any) => r.purchaser_name || r.customer_name },
                  { header: "Installment", cell: (r: any) => r.label },
                  { header: "Amount", align: "right", cell: (r: any) => PKR(r.amount) },
                  { header: "Paid At", cell: (r: any) => new Date(r.paid_at).toLocaleString() },
                ]}
              />
            </div>
          )}

          {tab === "officer-recoveries" && (
            <ReportTable
              rows={data}
              empty="No officer recovery data available."
              columns={[
                { header: "Officer", cell: (o: any) => o.officer_name },
                { header: "Phone", cell: (o: any) => o.officer_phone },
                { header: "Assigned Orders", align: "right", cell: (o: any) => o.assigned_orders },
                { header: "Total Recovered", align: "right", cell: (o: any) => PKR(o.total_recovered) },
              ]}
            />
          )}

          {tab === "payroll" && (
            <div className="space-y-6">
              <ReportTable
                rows={data.monthly}
                empty="No payroll data available."
                columns={[
                  { header: "Month", cell: (m: any) => m.month },
                  { header: "Employees", align: "right", cell: (m: any) => m.employeeCount },
                  { header: "Paid", align: "right", cell: (m: any) => m.paidCount },
                  { header: "Total Net Payable", align: "right", cell: (m: any) => PKR(m.totalNetPayable) },
                ]}
              />
              <ReportTable
                rows={data.slips}
                empty="No payroll slips available."
                columns={[
                  { header: "Employee", cell: (s: any) => s.employee_name },
                  { header: "Department", cell: (s: any) => s.department },
                  { header: "Period", cell: (s: any) => `${s.month}/${s.year}` },
                  { header: "Status", cell: (s: any) => <span className="capitalize">{s.status}</span> },
                  { header: "Net Payable", align: "right", cell: (s: any) => PKR(s.net_payable) },
                ]}
              />
            </div>
          )}

          {tab === "vendors" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Object.entries(data.buckets || {}).map(([bucket, amount]: [string, any]) => (
                  <StatCard key={bucket} icon={Handshake} label={`${bucket} Days`} value={PKR(amount)} accent="text-orange-600" bg="bg-orange-50 dark:bg-orange-500/10" bar="bg-orange-500" />
                ))}
              </div>
              <ReportTable
                rows={data.items}
                empty="No outstanding vendor balances."
                columns={[
                  { header: "Invoice", cell: (v: any) => v.invoice_number },
                  { header: "Vendor", cell: (v: any) => v.vendor_name },
                  { header: "Days Overdue", align: "right", cell: (v: any) => v.daysOverdue },
                  { header: "Balance", align: "right", cell: (v: any) => PKR(v.balance) },
                ]}
              />
            </div>
          )}

          {tab === "product-sales" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">Top Selling Products</h3>
                <ReportTable
                  rows={data.topSelling}
                  empty="No sales data available."
                  columns={[
                    { header: "Product", cell: (p: any) => p.product_name },
                    { header: "Units Sold", align: "right", cell: (p: any) => p.unitsSold },
                    { header: "Total Revenue", align: "right", cell: (p: any) => PKR(p.totalRevenue) },
                  ]}
                />
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-dark dark:text-white">All Products</h3>
                <ReportTable
                  rows={data.products}
                  empty="No product sales data."
                  columns={[
                    { header: "Product", cell: (p: any) => p.product_name },
                    { header: "Units Sold", align: "right", cell: (p: any) => p.unitsSold },
                    { header: "Total Revenue", align: "right", cell: (p: any) => PKR(p.totalRevenue) },
                  ]}
                />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ReportTable({ rows, columns, empty }: { rows: any[]; columns: { header: string; align?: "right"; cell: (row: any) => React.ReactNode }[]; empty: string }) {
  if (!rows || rows.length === 0) {
    return <div className="rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark"><EmptyState icon={FileText} title={empty} /></div>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-white/10 dark:bg-boxdark">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-2 dark:text-gray-400">
          <tr>
            <th className="w-14 px-4 py-3 font-bold">S.No</th>
            {columns.map((c) => <th key={c.header} className={`px-4 py-3 font-bold ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 150).map((row, idx) => (
            <tr key={idx} className="border-t border-slate-50 dark:border-white/5">
              <td className="px-4 py-3.5 text-gray-400 tabular-nums">{idx + 1}</td>
              {columns.map((c) => <td key={c.header} className={`px-4 py-3.5 text-gray-600 dark:text-gray-300 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{c.cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
