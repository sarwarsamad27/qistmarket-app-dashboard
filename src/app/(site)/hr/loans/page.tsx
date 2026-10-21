"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import { Search, X, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

interface Employee {
  id: number;
  employee_id: string;
  full_name: string;
  department?: string;
}

interface Loan {
  id: number;
  loan_type: string;
  total_amount: number;
  deducted_amount: number;
  monthly_installment: number;
  start_date: string;
  status: string;
  created_at: string;
}

export default function HrLoansPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    hrFetch("/employees").then((r) => setEmployees(r.employees));
  }, []);

  useEffect(() => {
    if (!selectedEmp) return;
    hrFetch(`/employees/${selectedEmp}/loans`).then((r) => setLoans(r.loans));
  }, [selectedEmp]);

  const createLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    await hrFetch(`/employees/${selectedEmp}/loans`, {
      method: "POST",
      body: JSON.stringify({
        total_amount: parseFloat(data.get("total_amount") as string),
        monthly_installment: parseFloat(data.get("monthly_installment") as string) || 0,
        loan_type: data.get("loan_type") as string || "general",
      }),
    });
    toast.success("Loan created");
    setShowCreate(false);
    const r = await hrFetch(`/employees/${selectedEmp}/loans`);
    setLoans(r.loans);
  };

  const closeLoan = async (loanId: number) => {
    await hrFetch(`/loans/${loanId}/close`, { method: "PATCH" });
    toast.success("Loan closed");
    const r = await hrFetch(`/employees/${selectedEmp}/loans`);
    setLoans(r.loans);
  };

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Loan Management</h1>
        {selectedEmp && (
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">New Loan</button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="w-full rounded-lg border border-stroke py-2 pl-9 pr-3 text-sm dark:border-stroke-dark dark:bg-dark-2" />
        </div>
        <select value={selectedEmp || ""} onChange={(e) => setSelectedEmp(e.target.value ? parseInt(e.target.value) : null)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
          <option value="">Select employee</option>
          {filtered.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id})</option>
          ))}
        </select>
      </div>

      {showCreate && (
        <form onSubmit={createLoan} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Create Loan</h3>
            <button type="button" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></button>
          </div>
            <div className="grid gap-3 sm:grid-cols-2">
            <input name="total_amount" type="number" step="0.01" placeholder="Total amount" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
            <input name="monthly_installment" type="number" step="0.01" placeholder="Monthly installment" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
            <select name="loan_type" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
              <option value="general">General</option><option value="advance">Advance</option><option value="emergency">Emergency</option>
            </select>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white">Create Loan</button>
        </form>
      )}

      {selectedEmp ? (
        <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
                <th className="px-4 py-3">S.No</th><th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Deducted</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No loans for this employee</td></tr>
              )}
              {loans.map((loan, idx) => (
                <tr key={loan.id} className="border-b border-stroke dark:border-stroke-dark"><td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono text-xs">#{loan.id}</td>
                  <td className="px-4 py-3 capitalize">{loan.loan_type}</td>
                  <td className="px-4 py-3 text-right">Rs. {loan.total_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">Rs. {loan.deducted_amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">Rs. {loan.monthly_installment.toLocaleString()}</td>
                  <td className="px-4 py-3">{new Date(loan.start_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${loan.status === "active" ? "bg-green/10 text-green" : "bg-gray-2 text-gray-500"}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {loan.status === "active" && (
                      <button onClick={() => closeLoan(loan.id)} className="text-xs text-primary hover:underline">Close</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">Select an employee to manage loans.</p>
      )}
    </div>
  );
}
