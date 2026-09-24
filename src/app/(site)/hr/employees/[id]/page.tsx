"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { hrFetch, downloadAuthedFile, viewAuthedFile, printAuthedFile } from "@/lib/employee-api";
import Cookies from "js-cookie";
import DepartmentSelect from "@/components/EmployeePortal/DepartmentSelect";
import toast from "react-hot-toast";
import Image from "next/image";
import { User, FileText, DollarSign, Activity, Star, ClipboardList, Calendar, Upload, Search, Trash2, Download } from "lucide-react";

interface Employee {
  id: number; employee_id: string; full_name: string; username: string; portal_active: boolean;
  qr_code?: string; department?: string; designation?: string; phone?: string; cnic?: string; email?: string;
  address?: string; emergency_contact?: string; emergency_phone?: string; qualification?: string;
  experience?: string; date_of_birth?: string; date_of_joining?: string; basic_salary?: number;
  status?: string; outlet_id?: number | null; user_id?: number | null;
  outlet?: { id: number; name: string; code: string };
  timeline_events?: { id: number; title: string; event_type: string; event_date: string; description?: string; document_url?: string | null }[];
  documents?: HrDocument[]; loans?: HrLoan[]; payroll_slips?: PayrollSlip[]; leave_requests?: LeaveRequest[];
}

interface HrDocument { id: number; doc_type: string; title: string; file_url: string; created_at: string; }
interface HrLoan { id: number; loan_type: string; total_amount: number; deducted_amount: number; monthly_installment: number; start_date: string; status: string; schedule_json?: string; }
interface PayrollSlip { id: number; month: number; year: number; basic_salary: number; allowances: number; bonuses: number; commissions: number; deductions: number; net_payable: number; status: string; paid_date?: string; }
interface LeaveRequest { id: number; leave_type: string; from_date: string; to_date: string; days?: number; status: string; reason?: string; }

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
interface AttendanceRec {
  id: number; date: string; status: string; check_in?: string; check_out?: string;
  overtime_hrs?: number; missed_punch?: boolean; notes?: string;
}

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "timeline", label: "Timeline", icon: Activity },
  { key: "attendance", label: "Attendance", icon: Calendar },
  { key: "loans", label: "Loans", icon: DollarSign },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "payroll", label: "Payroll", icon: ClipboardList },
  { key: "performance", label: "Performance", icon: Star },
  { key: "leaves", label: "Leaves", icon: Calendar },
];

export default function HrEmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tab, setTab] = useState("profile");
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [attendRecords, setAttendRecords] = useState<AttendanceRec[]>([]);
  const [attendMonth, setAttendMonth] = useState(new Date().getMonth() + 1);
  const [attendYear, setAttendYear] = useState(new Date().getFullYear());
  const [attendSummary, setAttendSummary] = useState<Record<string, number> | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventType, setEventType] = useState("promotion");
  const [outlets, setOutlets] = useState<{ id: number; name: string; code: string }[]>([]);
  const [appUsers, setAppUsers] = useState<{ id: number; full_name: string; username: string; role: string | null }[]>([]);

  const load = () => hrFetch(`/employees/${id}`).then((r) => setEmployee(r.employee));
  useEffect(() => { load(); }, [id]);

  const loadAttendance = () => {
    hrFetch(`/employees/${id}/attendance?month=${attendMonth}&year=${attendYear}`)
      .then((r) => { setAttendRecords(r.records); setAttendSummary(r.summary || null); })
      .catch(() => {});
  };
  useEffect(() => { if (id) loadAttendance(); }, [id, attendMonth, attendYear]);

  const togglePortal = async () => {
    if (!employee) return;
    await hrFetch(`/employees/${id}/portal`, { method: "PATCH", body: JSON.stringify({ portal_active: !employee.portal_active }) });
    toast.success("Portal status updated"); load();
  };
  const resetPassword = async () => {
    const data = await hrFetch(`/employees/${id}/reset-password`, { method: "POST" });
    setNewPassword(data.password); toast.success("Password reset");
  };
  const sendCredentials = async () => {
    const data = await hrFetch(`/employees/${id}/send-credentials`, { method: "POST", body: JSON.stringify({ password: newPassword }) });
    toast.success(data.message); if (data.preview) toast(data.preview, { duration: 8000 });
  };

  const openEdit = async () => {
    setEditOpen(true);
    const token = Cookies.get("auth_token");
    fetch(`${API}/api/all-outlets`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setOutlets((d.data || d.outlets || []).filter((o: { deleted_at?: string | null }) => !o.deleted_at))).catch(() => {});
    hrFetch(`/app-users?employee_id=${id}`).then((r) => setAppUsers(r.users || [])).catch(() => {});
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body: Record<string, FormDataEntryValue> = {};
    fd.forEach((v, k) => { body[k] = v; });
    try {
      const r = await hrFetch(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(r.timeline_added ? `Saved — ${r.timeline_added} timeline entr${r.timeline_added === 1 ? "y" : "ies"} added` : "Profile saved");
      setEditOpen(false); load();
    } catch (err) { toast.error((err as Error).message); }
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body: Record<string, FormDataEntryValue> = {};
    fd.forEach((v, k) => { if (v !== "") body[k] = v; });
    try {
      await hrFetch(`/employees/${id}/events`, { method: "POST", body: JSON.stringify(body) });
      toast.success("Timeline event added — employee notified");
      setEventOpen(false); load();
    } catch (err) { toast.error((err as Error).message); }
  };

  const markPaid = async (slipId: number) => {
    if (!confirm("Mark this salary as paid? Loan installments on the slip will be deducted and the employee notified.")) return;
    try {
      await hrFetch(`/payroll/${slipId}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
      toast.success("Salary marked paid"); load();
    } catch (err) { toast.error((err as Error).message); }
  };

  // Documents open through the authenticated API (base64 JSON) — direct
  // /uploads links get hijacked by download-manager extensions such as IDM.
  const docAction = (doc: { id: number; title: string; file_url: string }, action: "view" | "download" | "print") => {
    const path = `/hr/documents/${doc.id}/file`;
    const name = `${doc.title || "document"}${(doc.file_url || "").match(/\.[a-z0-9]+$/i)?.[0] || ""}`;
    const p = action === "view" ? viewAuthedFile(path, "hr") : action === "print" ? printAuthedFile(path, "hr") : downloadAuthedFile(path, name, "hr");
    p.catch((e) => toast.error((e as Error).message));
  };
  const openTimelineDoc = (url: string) => {
    const doc = employee?.documents?.find((d) => d.file_url === url);
    if (doc) docAction(doc, "view");
    else window.open(`${API}${url}`, "_blank");
  };

  const downloadSlip = async (slip: PayrollSlip) => {
    try {
      await downloadAuthedFile(`/hr/payroll/${slip.id}/pdf`, `Salary-Slip-${employee?.employee_id}-${slip.year}-${String(slip.month).padStart(2, "0")}.pdf`, "hr");
    } catch (err) { toast.error((err as Error).message); }
  };

  const updateAttendance = async (date: string, status: string) => {
    await hrFetch(`/employees/${id}/attendance`, { method: "POST", body: JSON.stringify({ date, status, method: "manual" }) });
    toast.success("Attendance updated"); load();
  };

  const createLoan = async (e: React.FormEvent) => {
    e.preventDefault(); const fd = new FormData(e.target as HTMLFormElement);
    const total_amount = parseFloat(fd.get("total_amount") as string);
    const monthly_installment = parseFloat(fd.get("monthly_installment") as string) || 0;
    await hrFetch(`/employees/${id}/loans`, { method: "POST", body: JSON.stringify({ total_amount, monthly_installment, loan_type: fd.get("loan_type") || "general", start_date: fd.get("start_month") ? `${fd.get("start_month")}-01` : undefined }) });
    toast.success("Loan created — employee notified"); load();
  };

  const closeLoan = async (loanId: number) => {
    await hrFetch(`/loans/${loanId}/close`, { method: "PATCH" }); toast.success("Loan closed"); load();
  };

  const createPayroll = async (e: React.FormEvent) => {
    e.preventDefault(); const fd = new FormData(e.target as HTMLFormElement);
    await hrFetch(`/employees/${id}/payroll`, { method: "POST", body: JSON.stringify({ month: fd.get("month"), year: fd.get("year"), basic_salary: fd.get("basic_salary"), allowances: fd.get("allowances") || 0, bonuses: fd.get("bonuses") || 0, commissions: fd.get("commissions") || 0, deductions: fd.get("deductions") || 0 }) });
    toast.success("Payroll slip created"); load();
  };

  const submitPerformance = async (e: React.FormEvent) => {
    e.preventDefault(); const fd = new FormData(e.target as HTMLFormElement);
    await hrFetch(`/employees/${id}/performance`, { method: "POST", body: JSON.stringify({ month: fd.get("month"), year: fd.get("year"), kpi_score: fd.get("kpi_score"), attendance_score: fd.get("attendance_score"), targets: { sales: parseFloat(fd.get("target_sales") as string) || 0, recovery: parseFloat(fd.get("target_recovery") as string) || 0 }, achieved: { sales: parseFloat(fd.get("achieved_sales") as string) || 0, recovery: parseFloat(fd.get("achieved_recovery") as string) || 0 }, team_rank: fd.get("team_rank") || null, recovery_pct: fd.get("recovery_pct") || null, remarks: fd.get("remarks") }) });
    toast.success("Performance saved"); load();
  };

  const uploadDoc = async (e: React.FormEvent) => {
    e.preventDefault(); const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const res = await fetch(`${API}/api/hr/employees/${id}/documents`, { method: "POST", headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` }, body: fd });
    if (!res.ok) { toast.error((await res.json().catch(() => ({}))).message || "Upload failed"); return; }
    form.reset();
    toast.success("Document uploaded"); load();
  };

  const deleteDoc = async (docId: number) => {
    if (!confirm("Delete?")) return; await hrFetch(`/documents/${docId}`, { method: "DELETE" }); toast.success("Deleted"); load();
  };

  if (!employee) return <p className="text-gray-500">Loading...</p>;

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div>
      <Link href="/hr/employees" className="text-sm text-primary hover:underline">← Back to Employees</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">{employee.full_name}</h1>
          <p className="text-sm text-gray-500">{employee.employee_id} · {employee.department} · {employee.designation}{employee.status && employee.status !== "active" ? <span className="ml-2 rounded-full bg-red/10 px-2 py-0.5 text-xs capitalize text-red">{employee.status}</span> : null}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openEdit} className="rounded-lg border border-primary px-3 py-1.5 text-xs text-primary">Edit Profile</button>
          <button onClick={() => setEventOpen(true)} className="rounded-lg border border-primary px-3 py-1.5 text-xs text-primary">Add Timeline Event</button>
          <button onClick={togglePortal} className="rounded-lg border border-stroke px-3 py-1.5 text-xs dark:border-stroke-dark">{employee.portal_active ? "Deactivate" : "Activate"} Portal</button>
          <button onClick={resetPassword} className="rounded-lg bg-dark-4 px-3 py-1.5 text-xs text-white">Reset Password</button>
          <button onClick={sendCredentials} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white">Send Credentials</button>
        </div>
      </div>

      {newPassword && (
        <div className="mt-3 rounded-lg bg-yellow-light-4/30 p-3 text-sm">
          New Password: <strong className="font-mono">{newPassword}</strong>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1 border-b border-stroke dark:border-stroke-dark">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-dark dark:hover:text-white"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {/* PROFILE */}
        {tab === "profile" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
              <h2 className="mb-4 font-semibold">Personal Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span>{employee.phone || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{employee.email || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">CNIC</span><span>{employee.cnic || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">DOB</span><span>{employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString() : "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="text-right max-w-[200px]">{employee.address || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Qualification</span><span>{employee.qualification || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Experience</span><span>{employee.experience || "-"}</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
              <h2 className="mb-4 font-semibold">Employment & Emergency</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Department</span><span>{employee.department || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Designation</span><span>{employee.designation || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date Joined</span><span>{employee.date_of_joining ? new Date(employee.date_of_joining).toLocaleDateString() : "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Outlet</span><span>{employee.outlet?.name || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Basic Salary</span><span>Rs. {(employee.basic_salary || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Mobile App Account</span><span>{employee.user_id ? `Linked (user #${employee.user_id})` : "Not linked"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Username</span><span className="font-mono">{employee.username}</span></div>
                <hr className="border-stroke dark:border-stroke-dark" />
                <div className="flex justify-between"><span className="text-gray-500">Emergency Contact</span><span>{employee.emergency_contact || "-"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Emergency Phone</span><span>{employee.emergency_phone || "-"}</span></div>
              </div>
            </div>
            {employee.qr_code && (
              <div className="rounded-xl border border-stroke bg-white p-6 text-center dark:border-stroke-dark dark:bg-dark-2">
                <h2 className="mb-4 font-semibold">QR Code</h2>
                <Image src={employee.qr_code} alt="QR" width={160} height={160} className="mx-auto" unoptimized />
              </div>
            )}
          </div>
        )}

        {/* TIMELINE */}
        {tab === "timeline" && (
          <div className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Employment Timeline</h2>
              <button onClick={() => setEventOpen(true)} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white">+ Add Event</button>
            </div>
            {(!employee.timeline_events || employee.timeline_events.length === 0) && <p className="text-gray-500">No events recorded.</p>}
            <div className="space-y-2">
              {employee.timeline_events?.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-gray-2 px-4 py-3 text-sm dark:bg-dark-3">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.description || e.event_type.replace(/_/g, " ")}</p>
                    {e.document_url && <button type="button" onClick={() => openTimelineDoc(e.document_url as string)} className="text-xs text-primary hover:underline">View letter PDF</button>}
                  </div>
                  <span className="text-xs text-gray-500">{new Date(e.event_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATTENDANCE */}
        {tab === "attendance" && (
          <div className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
            <h2 className="mb-4 font-semibold">Quick Attendance Mark</h2>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.target as HTMLFormElement); updateAttendance(fd.get("date") as string, fd.get("status") as string); }} className="mb-6 flex flex-wrap gap-3">
              <input name="date" type="date" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
              <select name="status" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
                <option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="off">Off</option><option value="holiday">Holiday</option><option value="leave">Leave (paid)</option><option value="unpaid_leave">Unpaid Leave</option>
              </select>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Mark (Manual)</button>
            </form>
            <div className="mb-4 flex items-center gap-4">
              <h2 className="font-semibold">Records</h2>
              <select value={attendMonth} onChange={(e) => setAttendMonth(+e.target.value)} className="rounded-lg border border-stroke px-2 py-1 text-xs dark:border-stroke-dark dark:bg-dark-3">
                {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2000,i).toLocaleString("default",{month:"short"})}</option>)}
              </select>
              <select value={attendYear} onChange={(e) => setAttendYear(+e.target.value)} className="rounded-lg border border-stroke px-2 py-1 text-xs dark:border-stroke-dark dark:bg-dark-3">
                {[attendYear-1, attendYear, attendYear+1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {attendSummary && (
              <div className="mb-4 rounded-lg bg-gray-2 px-4 py-3 text-xs dark:bg-dark-3">
                <strong>Deductible days: {attendSummary.deductible_days}</strong> — absent {attendSummary.absent}, off {attendSummary.off},
                late penalty {attendSummary.late_penalty_offs} ({attendSummary.late} lates), Sat/Mon penalty {attendSummary.weekend_penalty_offs}, unpaid leave {attendSummary.unpaid_leave}
                {attendSummary.unmarked > 0 && <span className="text-yellow-dark"> · {attendSummary.unmarked} working day(s) not marked (not deducted)</span>}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stroke dark:border-stroke-dark">
                  <th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">In</th>
                  <th className="px-3 py-2 text-left">Out</th><th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-left">OT</th>
                </tr></thead>
                <tbody>
                  {attendRecords.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No records</td></tr>}
                  {attendRecords.map((r) => {
                    const method = r.notes?.match(/\[method:(\w+)\]/)?.[1] || "";
                    return (
                      <tr key={r.id} className="border-b border-stroke dark:border-stroke-dark">
                        <td className="px-3 py-2">{new Date(r.date.slice(0, 10) + "T00:00:00Z").toLocaleDateString()}</td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${r.status === "present" ? "bg-green/10 text-green" : r.status === "late" ? "bg-yellow-light-4/20 text-yellow-dark" : r.status === "absent" ? "bg-red/10 text-red" : "bg-gray-2 text-gray-500"}`}>{r.status}</span></td>
                        <td className="px-3 py-2">{r.check_in || "-"}</td>
                        <td className="px-3 py-2">{r.check_out || "-"}</td>
                        <td className="px-3 py-2">{method ? <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{method}</span> : "-"}</td>
                        <td className="px-3 py-2">{r.overtime_hrs ? `${r.overtime_hrs}h` : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOANS */}
        {tab === "loans" && (
          <div>
            <form onSubmit={createLoan} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="mb-3 font-semibold">Add Loan</h3>
              <div className="flex flex-wrap gap-3">
                <input name="total_amount" type="number" step="0.01" placeholder="Total Amount" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="monthly_installment" type="number" step="0.01" placeholder="Monthly Installment" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <select name="loan_type" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
                  <option value="general">Company Loan</option><option value="advance">Salary Advance</option><option value="emergency">Emergency Loan</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-gray-500">First deduction
                  <input name="start_month" type="month" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                </label>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Create</button>
              </div>
            </form>
            <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
                  <th className="px-4 py-3 text-left">ID</th><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Deducted</th>
                  <th className="px-4 py-3 text-right">Monthly</th><th className="px-4 py-3 text-left">Start</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Action</th>
                </tr></thead>
                <tbody>
                  {(!employee.loans || employee.loans.length === 0) && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No loans</td></tr>}
                  {employee.loans?.map((loan) => (
                    <tr key={loan.id} className="border-b border-stroke dark:border-stroke-dark">
                      <td className="px-4 py-3 font-mono text-xs">#{loan.id}</td>
                      <td className="px-4 py-3 capitalize">{loan.loan_type}</td>
                      <td className="px-4 py-3 text-right">Rs.{loan.total_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">Rs.{loan.deducted_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">Rs.{loan.monthly_installment.toLocaleString()}</td>
                      <td className="px-4 py-3">{new Date(loan.start_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${loan.status === "active" ? "bg-green/10 text-green" : "bg-gray-2 text-gray-500"}`}>{loan.status}</span></td>
                      <td className="px-4 py-3 text-center">{loan.status === "active" && <button onClick={() => closeLoan(loan.id)} className="text-xs text-primary hover:underline">Close</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DOCUMENTS */}
        {tab === "documents" && (
          <div>
            <form onSubmit={uploadDoc} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="mb-3 font-semibold">Upload Document</h3>
              <div className="flex flex-wrap gap-3">
                <input name="title" placeholder="Document title" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <select name="doc_type" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
                  <option value="cnic_copy">CNIC Copy</option><option value="cv">CV / Resume</option><option value="education">Educational Certificate</option><option value="previous_experience">Previous Experience Letter</option><option value="photo">Photograph</option><option value="offer_letter">Offer Letter (signed)</option><option value="appointment_letter">Appointment Letter</option><option value="warning_letter">Warning Letter</option><option value="experience_letter">Experience Letter</option><option value="certificate">Training Certificate</option><option value="other">Other</option>
                </select>
                <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white"><Upload className="mr-1 inline h-4 w-4" />Upload</button>
              </div>
            </form>
            {(!employee.documents || employee.documents.length === 0) ? (
              <p className="text-gray-500">No documents uploaded.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {employee.documents.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
                    {/\.(jpe?g|png|webp)$/i.test(doc.file_url || "") && (
                      <button type="button" onClick={() => docAction(doc, "view")} className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-2 dark:bg-dark-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`${API}${doc.file_url}`} alt={doc.title} className="h-full w-full object-contain" />
                      </button>
                    )}
                    <div className="mb-2 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><div><p className="font-medium text-sm">{doc.title}</p><p className="text-xs text-gray-500 capitalize">{doc.doc_type.replace("_", " ")}</p></div></div>
                    <div className="flex gap-2">
                      <button onClick={() => docAction(doc, "view")} className="rounded-lg bg-gray-2 px-3 py-1.5 text-xs dark:bg-dark-3">View</button>
                      <button onClick={() => docAction(doc, "download")} className="flex items-center gap-1 rounded-lg bg-gray-2 px-3 py-1.5 text-xs dark:bg-dark-3"><Download className="h-3 w-3" /> Download</button>
                      <button onClick={() => docAction(doc, "print")} className="rounded-lg bg-gray-2 px-3 py-1.5 text-xs dark:bg-dark-3">Print</button>
                      <button onClick={() => deleteDoc(doc.id)} className="flex items-center gap-1 rounded-lg bg-red/10 px-3 py-1.5 text-xs text-red"><Trash2 className="h-3 w-3" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PAYROLL */}
        {tab === "payroll" && (
          <div>
            <form onSubmit={createPayroll} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="mb-1 font-semibold">Create Payroll Slip (manual)</h3>
              <p className="mb-3 text-xs text-gray-500">Normally slips come from Payroll → Generate Monthly Payroll, which applies attendance and loan deductions automatically.</p>
              <div className="flex flex-wrap gap-3">
                <input name="month" type="number" min="1" max="12" placeholder="Month" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2 w-20" />
                <input name="year" type="number" placeholder="Year" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2 w-20" />
                <input name="basic_salary" type="number" step="0.01" placeholder="Basic" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="allowances" type="number" step="0.01" placeholder="Allowances" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="bonuses" type="number" step="0.01" placeholder="Bonuses" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="commissions" type="number" step="0.01" placeholder="Commissions" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="deductions" type="number" step="0.01" placeholder="Deductions" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Create</button>
              </div>
            </form>
            <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
                  <th className="px-4 py-3 text-left">Period</th><th className="px-4 py-3 text-right">Basic</th><th className="px-4 py-3 text-right">Allowances</th><th className="px-4 py-3 text-right">Bonuses</th>
                  <th className="px-4 py-3 text-right">Commissions</th><th className="px-4 py-3 text-right">Deductions</th><th className="px-4 py-3 text-right">Net</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Actions</th>
                </tr></thead>
                <tbody>
                  {(!employee.payroll_slips || employee.payroll_slips.length === 0) && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No payroll slips</td></tr>}
                  {employee.payroll_slips?.map((slip) => (
                    <tr key={slip.id} className="border-b border-stroke dark:border-stroke-dark">
                      <td className="px-4 py-3">{months[slip.month - 1]} {slip.year}</td>
                      <td className="px-4 py-3 text-right">Rs.{slip.basic_salary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">Rs.{slip.allowances.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">Rs.{slip.bonuses.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">Rs.{slip.commissions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">Rs.{slip.deductions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">Rs.{slip.net_payable.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${slip.status === "paid" ? "bg-green/10 text-green" : slip.status === "pending" ? "bg-yellow-light-4/20 text-yellow-dark" : "bg-red/10 text-red"}`}>{slip.status}</span></td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {slip.status !== "paid" && <button onClick={() => markPaid(slip.id)} className="mr-2 text-xs text-green hover:underline">Mark Paid</button>}
                        <button onClick={() => downloadSlip(slip)} className="text-xs text-primary hover:underline">PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PERFORMANCE */}
        {tab === "performance" && (
          <div>
            <form onSubmit={submitPerformance} className="mb-6 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="mb-3 font-semibold">Record Performance</h3>
              <div className="flex flex-wrap gap-3">
                <input name="month" type="number" min="1" max="12" placeholder="Month" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2 w-20" />
                <input name="year" type="number" placeholder="Year" required className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2 w-20" />
                <input name="kpi_score" type="number" step="0.1" min={0} max={100} placeholder="KPI % (0-100)" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="attendance_score" type="number" step="0.1" min={0} max={100} placeholder="Attendance % (auto if blank)" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="target_sales" type="number" step="0.01" placeholder="Target Sales" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="target_recovery" type="number" step="0.01" placeholder="Target Recovery" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="achieved_sales" type="number" step="0.01" placeholder="Achieved Sales" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="achieved_recovery" type="number" step="0.01" placeholder="Achieved Recovery" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="recovery_pct" type="number" step="0.1" min={0} max={100} placeholder="Recovery %" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="team_rank" type="number" min={1} placeholder="Team Rank (auto if blank)" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <input name="remarks" placeholder="Remarks" className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Save</button>
              </div>
            </form>
          </div>
        )}

        {/* LEAVES */}
        {tab === "leaves" && (
          <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
                <th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">From</th><th className="px-4 py-3 text-left">To</th><th className="px-4 py-3 text-left">Reason</th><th className="px-4 py-3 text-center">Status</th>
              </tr></thead>
              <tbody>
                {(!employee.leave_requests || employee.leave_requests.length === 0) && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No leave requests</td></tr>}
                {employee.leave_requests?.map((lr) => (
                  <tr key={lr.id} className="border-b border-stroke dark:border-stroke-dark">
                    <td className="px-4 py-3 capitalize">{lr.leave_type.replace("_", " ")}</td>
                    <td className="px-4 py-3">{new Date(lr.from_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{new Date(lr.to_date).toLocaleDateString()}{lr.days ? ` (${lr.days}d)` : ""}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{lr.reason || "-"}</td>
                    <td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${lr.status === "approved" ? "bg-green/10 text-green" : lr.status === "pending" ? "bg-yellow-light-4/20 text-yellow-dark" : "bg-red/10 text-red"}`}>{lr.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditOpen(false)}>
          <form onSubmit={saveProfile} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-dark-2">
            <h2 className="mb-1 text-lg font-bold">Edit Profile</h2>
            <p className="mb-4 text-xs text-gray-500">Department, outlet, designation, salary and status changes are added to the timeline automatically and the employee is notified.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["full_name", "Full Name", "text", employee.full_name],
                ["cnic", "CNIC", "text", employee.cnic],
                ["phone", "Phone", "text", employee.phone],
                ["email", "Email", "email", employee.email],
                ["emergency_contact", "Emergency Contact", "text", employee.emergency_contact],
                ["emergency_phone", "Emergency Phone", "text", employee.emergency_phone],
                ["date_of_birth", "Date of Birth", "date", employee.date_of_birth?.slice(0, 10)],
                ["date_of_joining", "Date of Joining", "date", employee.date_of_joining?.slice(0, 10)],
                ["designation", "Designation", "text", employee.designation],
                ["basic_salary", "Basic Salary (Rs.)", "number", employee.basic_salary],
              ] as [string, string, string, string | number | undefined | null][]).map(([name, label, type, value]) => (
                <label key={name} className="text-xs text-gray-500">{label}
                  <input name={name} type={type} defaultValue={value ?? ""} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
                </label>
              ))}
              <div className="text-xs text-gray-500">Department
                <div className="mt-1">
                  <DepartmentSelect name="department" defaultValue={employee.department || ""} className="w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
                </div>
              </div>
              <label className="text-xs text-gray-500">Outlet
                <select name="outlet_id" defaultValue={employee.outlet_id ?? employee.outlet?.id ?? ""} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white">
                  <option value="">— None —</option>
                  {employee.outlet && !outlets.some((o) => o.id === employee.outlet?.id) && <option value={employee.outlet.id}>{employee.outlet.name}</option>}
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Status
                <select name="status" defaultValue={employee.status || "active"} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white">
                  <option value="active">Active</option><option value="suspended">Suspended</option><option value="resigned">Resigned</option><option value="terminated">Terminated</option>
                </select>
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">Mobile app account (gives app push notifications)
                <select name="user_id" defaultValue={employee.user_id ?? ""} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white">
                  <option value="">— Not linked —</option>
                  {employee.user_id && !appUsers.some((u) => u.id === employee.user_id) && <option value={employee.user_id}>User #{employee.user_id}</option>}
                  {appUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} (@{u.username}{u.role ? `, ${u.role}` : ""})</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">Address
                <textarea name="address" defaultValue={employee.address || ""} rows={2} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
              </label>
              <label className="text-xs text-gray-500">Qualification
                <textarea name="qualification" defaultValue={employee.qualification || ""} rows={2} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
              </label>
              <label className="text-xs text-gray-500">Experience
                <textarea name="experience" defaultValue={employee.experience || ""} rows={2} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setEditOpen(false)} className="flex-1 rounded-lg border border-stroke py-2 text-sm dark:border-stroke-dark">Cancel</button>
              <button type="submit" className="flex-1 rounded-lg bg-primary py-2 text-sm text-white">Save</button>
            </div>
          </form>
        </div>
      )}

      {eventOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEventOpen(false)}>
          <form onSubmit={saveEvent} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-dark-2">
            <h2 className="mb-1 text-lg font-bold">Add Timeline Event</h2>
            <p className="mb-4 text-xs text-gray-500">The employee is notified. Promotions, demotions and increments also update the profile.</p>
            <div className="space-y-3">
              <label className="block text-xs text-gray-500">Type
                <select name="event_type" value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white">
                  <option value="promotion">Promotion</option><option value="demotion">Demotion</option><option value="increment">Salary Increment</option>
                  <option value="warning">Warning</option><option value="suspension">Suspension</option><option value="performance_review">Performance Review</option>
                  <option value="training">Training Completed</option><option value="transfer">Outlet Transfer (note)</option><option value="department_change">Department Change (note)</option><option value="other">Other</option>
                </select>
              </label>
              {["promotion", "demotion"].includes(eventType) && (
                <label className="block text-xs text-gray-500">New designation
                  <input name="new_designation" defaultValue={employee.designation || ""} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
                </label>
              )}
              {["promotion", "demotion", "increment"].includes(eventType) && (
                <label className="block text-xs text-gray-500">New basic salary (Rs.) — current Rs. {(employee.basic_salary || 0).toLocaleString()}
                  <input name="new_salary" type="number" step="1" className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
                </label>
              )}
              {eventType === "suspension" && <p className="rounded bg-red/10 px-3 py-2 text-xs text-red">This sets the employee to Suspended and blocks their portal login.</p>}
              <label className="block text-xs text-gray-500">Title (optional)
                <input name="title" className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
              </label>
              <label className="block text-xs text-gray-500">Details (sent to the employee)
                <textarea name="description" rows={3} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
              </label>
              <label className="block text-xs text-gray-500">Date
                <input name="event_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-white" />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setEventOpen(false)} className="flex-1 rounded-lg border border-stroke py-2 text-sm dark:border-stroke-dark">Cancel</button>
              <button type="submit" className="flex-1 rounded-lg bg-primary py-2 text-sm text-white">Add Event</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
