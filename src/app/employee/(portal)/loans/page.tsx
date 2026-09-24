"use client";

import { Fragment, useEffect, useState } from "react";
import { employeeFetch } from "@/lib/employee-api";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Loan {
  id: number;
  loan_type: string;
  total_amount: number;
  deducted_amount: number;
  monthly_installment: number;
  start_date: string;
  status: string;
  schedule_json?: { month: string; amount: number; paid: boolean; paid_amount?: number }[];
}

export default function EmployeeLoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    employeeFetch("/employee/loans").then((r) => setLoans(r.loans));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">Loans & Advances</h1>

      <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Deducted</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-right">Installment</th>
              <th className="px-4 py-3 text-center">Schedule</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No active loans</td></tr>
            )}
            {loans.map((loan) => (
              <Fragment key={loan.id}>
                <tr className="border-b border-stroke dark:border-stroke-dark">
                  <td className="px-4 py-3 capitalize">
                    {loan.loan_type === "advance" ? "Salary Advance" : `${loan.loan_type.replace("_", " ")} loan`}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${loan.status === "active" ? "bg-yellow-dark/20 text-yellow-dark" : "bg-green/20 text-green"}`}>{loan.status === "active" ? "Active" : "Cleared"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">Rs. {loan.total_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">Rs. {loan.deducted_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold">Rs. {(loan.total_amount - loan.deducted_amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">Rs. {loan.monthly_installment.toLocaleString()}/mo</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setExpanded(expanded === loan.id ? null : loan.id)} className="rounded p-1 hover:bg-gray-2">
                      {expanded === loan.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
                {expanded === loan.id && (
                  <tr key={`${loan.id}-schedule`}>
                    <td colSpan={6} className="bg-gray-2 px-4 py-3 dark:bg-dark-3">
                      {loan.schedule_json ? (
                        <div className="flex flex-wrap gap-2">
                          {(loan.schedule_json as { month: string; amount: number; paid: boolean; paid_amount?: number }[]).map((s, i) => (
                            <span key={i} className={`rounded px-2 py-1 text-xs ${s.paid ? "bg-green/20 text-green" : "bg-white dark:bg-dark-2"}`}>
                              {new Date(`${s.month}-01T00:00:00`).toLocaleDateString("en-PK", { month: "short", year: "numeric" })}: Rs.{(s.paid_amount ?? s.amount).toLocaleString()} {s.paid ? "✓ deducted" : "due"}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Started {new Date(loan.start_date).toLocaleDateString()}</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
