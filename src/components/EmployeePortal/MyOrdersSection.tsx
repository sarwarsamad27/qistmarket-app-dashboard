"use client";

import { useEffect, useState } from "react";
import { employeeFetch } from "@/lib/employee-api";
import {
  ShoppingBag,
  CreditCard,
  AlertTriangle,
  Users,
  CalendarClock,
} from "lucide-react";

interface OrderRow {
  id: number;
  order_ref: string;
  product_name: string;
  status: string;
  created_at: string;
  outlet: string | null;
  customer_name: string;
  roles: ("purchaser" | "guarantor")[];
  grantor_number: number | null;
  monthly_amount: number;
  months: number;
  total_amount: number;
  ledger: {
    total: number;
    paid: number;
    outstanding: number;
    overdue: number;
    paid_installments: number;
    total_installments: number;
    next_due_date: string | null;
    next_due_amount: number;
    account_status: { label: string; color: string; bg: string };
  } | null;
}

interface Data {
  matched_on: { cnic: string | null; phone: string | null };
  summary: {
    total_orders: number;
    as_purchaser: number;
    as_guarantor: number;
    active_orders: number;
    purchaser_outstanding: number;
    purchaser_overdue: number;
    monthly_installment: number;
    guaranteed_outstanding: number;
  };
  orders: OrderRow[];
}

const rs = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

export default function MyOrdersSection() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    employeeFetch("/employee/orders")
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-10 rounded-2xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-dark dark:text-white">My Orders & Qist</h2>
        </div>
        <p className="text-sm text-gray-500">Loading your orders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red/10">
            <ShoppingBag className="h-5 w-5 text-red" />
          </div>
          <h2 className="text-lg font-bold text-dark dark:text-white">My Orders & Qist</h2>
        </div>
        <p className="text-sm text-red">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary: s, matched_on: m } = data;

  // No CNIC / phone linked yet
  if (!m.cnic && !m.phone) {
    return (
      <div className="mt-10 rounded-2xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-dark dark:text-white">My Orders & Qist</h2>
        </div>
        <p className="text-sm text-gray-500">
          Your CNIC or phone number is not linked yet — contact HR to update your profile so your orders can be shown here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      {/* ── Section Header ── */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-dark dark:text-white">My Orders & Qist</h2>
            <p className="text-xs text-gray-500">
              Matched on{" "}
              {[m.cnic && `CNIC ${m.cnic}`, m.phone && `phone ${m.phone}`]
                .filter(Boolean)
                .join(" and ")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Orders involved */}
        <div className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <div className="mb-2 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-gray-500">Orders Involved</p>
          </div>
          <p className="text-2xl font-bold text-dark dark:text-white">{s.total_orders}</p>
          <p className="mt-1 text-xs text-gray-500">
            {s.as_purchaser} as purchaser · {s.as_guarantor} as guarantor
          </p>
        </div>

        {/* Own pending */}
        <div className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <div className="mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium text-gray-500">Own Pending Amount</p>
          </div>
          <p className={`text-2xl font-bold ${s.purchaser_outstanding > 0 ? "text-primary" : "text-dark dark:text-white"}`}>
            {rs(s.purchaser_outstanding)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {s.active_orders} running order{s.active_orders === 1 ? "" : "s"}
          </p>
        </div>

        {/* Monthly qist */}
        <div className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-green" />
            <p className="text-xs font-medium text-gray-500">Monthly Qist</p>
          </div>
          <p className={`text-2xl font-bold ${s.purchaser_overdue > 0 ? "text-red" : "text-dark dark:text-white"}`}>
            {rs(s.monthly_installment)}
          </p>
          <p className={`mt-1 text-xs ${s.purchaser_overdue > 0 ? "text-red" : "text-gray-500"}`}>
            {s.purchaser_overdue > 0 ? `Overdue: ${rs(s.purchaser_overdue)}` : "Nothing overdue"}
          </p>
        </div>

        {/* Guaranteed */}
        <div className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-dark-5" />
            <p className="text-xs font-medium text-gray-500">Guaranteed (Others)</p>
          </div>
          <p className="text-2xl font-bold text-dark dark:text-white">
            {rs(s.guaranteed_outstanding)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Outstanding on orders you guaranteed</p>
        </div>
      </div>

      {/* ── Orders Table ── */}
      <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 text-left text-xs font-semibold text-gray-500 dark:border-stroke-dark dark:bg-dark-3">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Monthly Qist</th>
              <th className="px-4 py-3 text-center">Installments</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-right">Overdue</th>
              <th className="px-4 py-3">Next Due</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  You are not involved in any order as a purchaser or guarantor.
                </td>
              </tr>
            )}
            {data.orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-stroke last:border-0 dark:border-stroke-dark"
              >
                {/* Order ref + product */}
                <td className="px-4 py-3">
                  <p className="font-medium text-dark dark:text-white">{o.order_ref}</p>
                  <p className="text-xs text-gray-500">
                    {o.product_name}
                    {o.outlet ? ` · ${o.outlet}` : ""}
                  </p>
                  {o.roles.includes("guarantor") && !o.roles.includes("purchaser") && (
                    <p className="text-xs text-gray-500">Customer: {o.customer_name}</p>
                  )}
                </td>

                {/* Role badges */}
                <td className="px-4 py-3">
                  {o.roles.map((r) => (
                    <span
                      key={r}
                      className={`mr-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        r === "purchaser"
                          ? "bg-primary/10 text-primary"
                          : "bg-blue-light-5/40 text-blue-dark"
                      }`}
                    >
                      {r === "purchaser"
                        ? "Purchaser"
                        : `Guarantor${o.grantor_number ? ` ${o.grantor_number}` : ""}`}
                    </span>
                  ))}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {o.ledger ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        color: o.ledger.account_status.color,
                        background: o.ledger.account_status.bg,
                      }}
                    >
                      {o.ledger.account_status.label}
                    </span>
                  ) : (
                    <span className="text-xs capitalize text-gray-500">
                      {o.status.replace(/_/g, " ")}
                    </span>
                  )}
                </td>

                {/* Monthly qist */}
                <td className="px-4 py-3 text-right">
                  {rs(o.monthly_amount)}{" "}
                  <span className="text-xs text-gray-500">× {o.months}</span>
                </td>

                {/* Installments paid */}
                <td className="px-4 py-3 text-center">
                  {o.ledger
                    ? `${o.ledger.paid_installments} / ${o.ledger.total_installments} paid`
                    : "—"}
                </td>

                {/* Pending */}
                <td className="px-4 py-3 text-right font-semibold">
                  {o.ledger ? rs(o.ledger.outstanding) : "—"}
                </td>

                {/* Overdue */}
                <td
                  className={`px-4 py-3 text-right ${
                    o.ledger?.overdue ? "font-semibold text-red" : ""
                  }`}
                >
                  {o.ledger ? (
                    o.ledger.overdue > 0 ? (
                      <span className="flex items-center justify-end gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {rs(o.ledger.overdue)}
                      </span>
                    ) : (
                      rs(0)
                    )
                  ) : (
                    "—"
                  )}
                </td>

                {/* Next due */}
                <td className="px-4 py-3 text-xs">
                  {o.ledger?.next_due_date ? (
                    <>
                      {new Date(o.ledger.next_due_date).toLocaleDateString("en-PK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      <br />
                      <span className="text-gray-500">{rs(o.ledger.next_due_amount)}</span>
                    </>
                  ) : o.ledger ? (
                    <span className="text-green">Cleared ✓</span>
                  ) : (
                    "Not delivered"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
