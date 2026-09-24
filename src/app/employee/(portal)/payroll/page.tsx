"use client";

import { useEffect, useState } from "react";
import { employeeFetch, downloadAuthedFile, printAuthedFile } from "@/lib/employee-api";
import { Eye, Download, Printer, Share2 } from "lucide-react";
import toast from "react-hot-toast";

interface SlipData {
  per_day_rate?: number;
  deductible_days?: number;
  attendance?: { absent?: number; off?: number; late?: number; late_penalty_offs?: number; weekend_penalty_offs?: number; unpaid_leave?: number };
  attendance_deduction?: number;
  loan_deductions?: { loan_id: number; loan_type: string; amount: number }[];
  other_deductions?: number;
}

interface Slip {
  id: number;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  bonuses: number;
  commissions: number;
  deductions: number;
  net_payable: number;
  status: string;
  paid_date?: string;
  slip_data?: SlipData | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rs = (n: number | undefined) => `Rs. ${Number(n || 0).toLocaleString()}`;

function deductionLines(slip: Slip): [string, number][] {
  const d = slip.slip_data;
  if (!d || d.attendance_deduction == null) return [["Deductions", slip.deductions]];
  const lines: [string, number][] = [];
  if (d.attendance_deduction) lines.push([`Attendance (${d.deductible_days} day(s))`, d.attendance_deduction]);
  for (const l of d.loan_deductions || []) lines.push([`${l.loan_type === "advance" ? "Advance" : "Loan"} installment`, l.amount]);
  if (d.other_deductions) lines.push(["Other deductions", d.other_deductions]);
  return lines;
}

export default function EmployeePayrollPage() {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [viewSlip, setViewSlip] = useState<Slip | null>(null);

  useEffect(() => {
    employeeFetch("/employee/payroll").then((r) => setSlips(r.slips)).catch((e) => toast.error(e.message));
  }, []);

  const pending = slips.filter((s) => s.status !== "paid");
  const period = (s: Slip) => `${MONTHS[s.month - 1]} ${s.year}`;

  const download = async (slip: Slip) => {
    try {
      await downloadAuthedFile(`/employee/payroll/${slip.id}/pdf`, `Salary-Slip-${slip.year}-${String(slip.month).padStart(2, "0")}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const shareWhatsApp = (slip: Slip) => {
    const lines = [
      `QIST Market Salary Slip — ${period(slip)}`,
      `Basic: ${rs(slip.basic_salary)}`,
      slip.allowances ? `Allowances: ${rs(slip.allowances)}` : "",
      slip.bonuses ? `Bonuses: ${rs(slip.bonuses)}` : "",
      slip.commissions ? `Commissions: ${rs(slip.commissions)}` : "",
      ...deductionLines(slip).map(([k, v]) => `${k}: -${rs(v)}`),
      `Net Payable: ${rs(slip.net_payable)}`,
      `Status: ${slip.status === "paid" ? "Paid" : "Pending"}`,
    ].filter(Boolean);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  // Prints the same branded PDF as "Download" (logo letterhead, tables, signatures).
  const printSlip = async (slip: Slip) => {
    try {
      await printAuthedFile(`/employee/payroll/${slip.id}/pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">Payroll / Salary Slips</h1>

      {pending.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-dark/30 bg-yellow-light-4/20 px-4 py-3 text-sm">
          <strong>Pending salaries:</strong>{" "}
          {pending.map((s) => `${period(s)} (${rs(s.net_payable)})`).join(", ")}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-right">Basic</th>
              <th className="px-4 py-3 text-right">Bonus + Comm.</th>
              <th className="px-4 py-3 text-right">Deductions</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slips.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No salary slips yet</td></tr>
            )}
            {slips.map((slip) => (
              <tr key={slip.id} className="border-b border-stroke dark:border-stroke-dark">
                <td className="px-4 py-3">{period(slip)}</td>
                <td className="px-4 py-3 text-right">{slip.basic_salary.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{(slip.bonuses + slip.commissions).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{slip.deductions.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-semibold">{slip.net_payable.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${slip.status === "paid" ? "bg-green/20 text-green" : "bg-yellow-dark/20 text-yellow-dark"}`}>
                    {slip.status === "paid" ? "Paid" : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setViewSlip(slip)} className="rounded p-1 hover:bg-gray-2" title="View"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => download(slip)} className="rounded p-1 hover:bg-gray-2" title="Download PDF"><Download className="h-4 w-4" /></button>
                    <button onClick={() => printSlip(slip)} className="rounded p-1 hover:bg-gray-2" title="Print"><Printer className="h-4 w-4" /></button>
                    <button onClick={() => shareWhatsApp(slip)} className="rounded p-1 hover:bg-gray-2" title="WhatsApp"><Share2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewSlip(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-dark-2" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-bold">Salary Slip — {period(viewSlip)}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Basic Salary</span><span>{rs(viewSlip.basic_salary)}</span></div>
              <div className="flex justify-between"><span>Allowances</span><span>{rs(viewSlip.allowances)}</span></div>
              <div className="flex justify-between"><span>Bonuses</span><span>{rs(viewSlip.bonuses)}</span></div>
              <div className="flex justify-between"><span>Commissions</span><span>{rs(viewSlip.commissions)}</span></div>
              {deductionLines(viewSlip).map(([k, v]) => (
                <div key={k} className="flex justify-between text-red"><span>{k}</span><span>- {rs(v)}</span></div>
              ))}
              {viewSlip.slip_data?.attendance && (viewSlip.slip_data.deductible_days || 0) > 0 && (
                <p className="text-xs text-gray-500">
                  {[
                    viewSlip.slip_data.attendance.absent ? `${viewSlip.slip_data.attendance.absent} absent` : "",
                    viewSlip.slip_data.attendance.off ? `${viewSlip.slip_data.attendance.off} off` : "",
                    viewSlip.slip_data.attendance.late_penalty_offs ? `${viewSlip.slip_data.attendance.late_penalty_offs} for ${viewSlip.slip_data.attendance.late} lates` : "",
                    viewSlip.slip_data.attendance.weekend_penalty_offs ? `${viewSlip.slip_data.attendance.weekend_penalty_offs} Sat/Mon penalty` : "",
                    viewSlip.slip_data.attendance.unpaid_leave ? `${viewSlip.slip_data.attendance.unpaid_leave} unpaid leave` : "",
                  ].filter(Boolean).join(", ")}
                  {viewSlip.slip_data.per_day_rate ? ` × ${rs(viewSlip.slip_data.per_day_rate)}/day` : ""}
                </p>
              )}
              <div className="flex justify-between border-t pt-2 font-bold"><span>Net Payable</span><span>{rs(viewSlip.net_payable)}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => download(viewSlip)} className="flex-1 rounded-lg border border-stroke py-2 text-sm dark:border-stroke-dark">Download PDF</button>
              <button onClick={() => setViewSlip(null)} className="flex-1 rounded-lg bg-primary py-2 text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
