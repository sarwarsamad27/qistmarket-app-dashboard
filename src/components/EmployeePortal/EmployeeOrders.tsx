"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { hrFetch } from "@/lib/employee-api";

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

/**
 * HR → Employee → Orders & Qist: every order the employee is in as the
 * purchaser or as a guarantor (matched by their CNIC / phone), with what is
 * still outstanding, overdue and the next installment.
 */
export default function EmployeeOrders({ employeeId }: { employeeId: number | string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    hrFetch(`/employees/${employeeId}/orders`).then(setData).catch((e) => setError((e as Error).message));
  }, [employeeId]);

  if (error) return <p className="text-sm text-red">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Checking orders...</p>;

  const { summary: s, matched_on: m } = data;
  if (!m.cnic && !m.phone) {
    return <p className="text-sm text-gray-500">Add the employee&apos;s CNIC or phone number (Edit Profile) to find the orders they are in as a purchaser or guarantor.</p>;
  }

  const card = (label: string, value: string, note?: string, tone = "text-dark dark:text-white") => (
    <div className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
    </div>
  );

  return (
    <div>
      <p className="mb-4 text-xs text-gray-500">
        Matched on {[m.cnic && `CNIC ${m.cnic}`, m.phone && `phone ${m.phone}`].filter(Boolean).join(" and ")} — the employee as purchaser or as guarantor on any order.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {card("Orders involved", String(s.total_orders), `${s.as_purchaser} as purchaser · ${s.as_guarantor} as guarantor`)}
        {card("Own pending amount", rs(s.purchaser_outstanding), `${s.active_orders} running order${s.active_orders === 1 ? "" : "s"}`, s.purchaser_outstanding > 0 ? "text-primary" : undefined)}
        {card("Monthly qist", rs(s.monthly_installment), s.purchaser_overdue > 0 ? `Overdue: ${rs(s.purchaser_overdue)}` : "Nothing overdue", s.purchaser_overdue > 0 ? "text-red" : undefined)}
        {card("Guaranteed (others' pending)", rs(s.guaranteed_outstanding), "Outstanding on orders they guarantee")}
      </div>

      <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 text-left dark:border-stroke-dark dark:bg-dark-3">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Involved as</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Monthly qist</th>
              <th className="px-4 py-3 text-center">Installments</th>
              <th className="px-4 py-3 text-right">Pending</th>
              <th className="px-4 py-3 text-right">Overdue</th>
              <th className="px-4 py-3">Next due</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">This employee is not in any order as a purchaser or guarantor.</td></tr>
            )}
            {data.orders.map((o) => (
              <tr key={o.id} className="border-b border-stroke dark:border-stroke-dark">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.order_ref}</Link>
                  <p className="text-xs text-gray-500">{o.product_name}{o.outlet ? ` · ${o.outlet}` : ""}</p>
                  {o.roles.includes("guarantor") && !o.roles.includes("purchaser") && (
                    <p className="text-xs text-gray-500">Customer: {o.customer_name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {o.roles.map((r) => (
                    <span key={r} className={`mr-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${r === "purchaser" ? "bg-primary/10 text-primary" : "bg-blue-light-5/40 text-blue-dark"}`}>
                      {r === "purchaser" ? "Purchaser" : `Guarantor${o.grantor_number ? ` ${o.grantor_number}` : ""}`}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  {o.ledger ? (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: o.ledger.account_status.color, background: o.ledger.account_status.bg }}>
                      {o.ledger.account_status.label}
                    </span>
                  ) : (
                    <span className="text-xs capitalize text-gray-500">{o.status.replace(/_/g, " ")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{rs(o.monthly_amount)} <span className="text-xs text-gray-500">× {o.months}</span></td>
                <td className="px-4 py-3 text-center">{o.ledger ? `${o.ledger.paid_installments} / ${o.ledger.total_installments} paid` : "—"}</td>
                <td className="px-4 py-3 text-right font-semibold">{o.ledger ? rs(o.ledger.outstanding) : "—"}</td>
                <td className={`px-4 py-3 text-right ${o.ledger?.overdue ? "font-semibold text-red" : ""}`}>{o.ledger ? rs(o.ledger.overdue) : "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {o.ledger?.next_due_date
                    ? <>{new Date(o.ledger.next_due_date).toLocaleDateString()}<br /><span className="text-gray-500">{rs(o.ledger.next_due_amount)}</span></>
                    : o.ledger ? "Cleared" : "Not delivered"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
