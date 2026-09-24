"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { hrFetch } from "@/lib/employee-api";
import {
  Search, Upload, FileText, Users, CheckCircle, AlertTriangle,
  Download, Trash2, Eye, Mail, SendHorizontal, Plus, X,
} from "lucide-react";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { IssueDocumentModal } from "@/components/Modals/IssueDocumentModal";
import { BulkIssueModal } from "@/components/Modals/BulkIssueModal";
import { ConfirmModal } from "@/components/Modals/ConfirmModal";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface Employee {
  id: number; employee_id: string; full_name: string; department?: string; designation?: string;
}
interface HrDocument {
  id: number; doc_type: string; title: string;
  file_url: string; created_at: string;
  employee_id?: number;
}
interface Template {
  doc_type: string; title: string; description: string;
  default_content_preview: string;
  has_custom_reason?: boolean; has_custom_date?: boolean; has_custom_topic?: boolean;
}

export default function HrDocumentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [allDocs, setAllDocs] = useState<Map<number, HrDocument[]>>(new Map());
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modals
  const [issueModal, setIssueModal] = useState<{ open: boolean; docType: string; docTitle: string; empId: number; empName: string }>({ open: false, docType: "", docTitle: "", empId: 0, empName: "" });
  const [bulkModal, setBulkModal] = useState<{ open: boolean; docType: string; docTitle: string }>({ open: false, docType: "", docTitle: "" });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; docId: number }>({ open: false, docId: 0 });
  const [uploadModal, setUploadModal] = useState(false);

  // Stats
  const [docStats, setDocStats] = useState({ total: 0, issued: 0, templates: 0 });

  const loadData = useCallback(async () => {
    const [emps, tmpls] = await Promise.all([
      hrFetch("/employees"),
      hrFetch("/document-templates"),
    ]);
    setEmployees(emps.employees);
    setTemplates(tmpls.templates);
    setDocStats((s) => ({ ...s, templates: tmpls.templates.length, total: emps.employees.length }));

    // Load all employee documents
    const docMap = new Map<number, HrDocument[]>();
    for (const emp of emps.employees.slice(0, 50)) {
      try {
        const r = await hrFetch(`/employees/${emp.id}`);
        if (r.employee?.documents?.length) {
          docMap.set(emp.id, r.employee.documents);
        }
      } catch {}
    }
    setAllDocs(docMap);
    let issuedCount = 0;
    docMap.forEach((docs) => { issuedCount += docs.length; });
    setDocStats((s) => ({ ...s, issued: issuedCount }));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = employees.filter((e) =>
    e.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (selectAll) { setSelectedIds([]); setSelectAll(false); }
    else { setSelectedIds(filtered.map((e) => e.id)); setSelectAll(true); }
  };

  const handleIssue = (template: Template, emp: Employee) => {
    setIssueModal({ open: true, docType: template.doc_type, docTitle: template.title, empId: emp.id, empName: emp.full_name });
  };

  const handleBulk = (template: Template) => {
    if (selectedIds.length === 0) { toast.error("Select at least one employee"); return; }
    setBulkModal({ open: true, docType: template.doc_type, docTitle: template.title });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) { toast.error("Select an employee"); return; }
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const res = await fetch(`${API}/api/hr/employees/${selectedEmp}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Cookies.get("auth_token")}` },
      body: fd,
    });
    if (!res.ok) { toast.error((await res.json().catch(() => ({}))).message || "Upload failed"); return; }
    toast.success("Uploaded");
    setUploadModal(false);
    loadData();
  };

  const deleteDoc = async () => {
    if (!confirmDelete.docId) return;
    await hrFetch(`/documents/${confirmDelete.docId}`, { method: "DELETE" });
    toast.success("Deleted");
    setConfirmDelete({ open: false, docId: 0 });
    loadData();
  };

  const getEmployeeDocs = (empId: number): HrDocument[] => allDocs.get(empId) || [];
  const getTemplateIcon = (docType: string) => {
    const icons: Record<string, string> = {
      offer_letter: "📋",
      appointment_letter: "📄",
      warning_letter: "⚠️",
      experience_letter: "📜",
      certificate: "🏆",
    };
    return icons[docType] || "📄";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Document Center</h1>
          <p className="text-sm text-gray-500">Create, issue, and manage employee documents</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              {selectedIds.length} selected
            </span>
          )}
          <button onClick={() => setUploadModal(true)} className="flex items-center gap-1.5 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark">
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Templates", value: docStats.templates, icon: FileText, color: "text-primary bg-primary/10" },
          { label: "Employees", value: docStats.total, icon: Users, color: "text-green bg-green/10" },
          { label: "Documents Issued", value: docStats.issued, icon: CheckCircle, color: "text-blue-DEFAULT bg-blue-light-5/20" },
          { label: "Pending Issue", value: Math.max(0, docStats.total - docStats.issued), icon: AlertTriangle, color: "text-yellow-dark bg-yellow-light-4/20" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-dark dark:text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Templates Section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">Document Templates</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {templates.map((tmpl) => (
            <div key={tmpl.doc_type} className="group relative rounded-xl border border-stroke bg-white p-5 transition-all hover:shadow-lg dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-3 text-3xl">{getTemplateIcon(tmpl.doc_type)}</div>
              <h3 className="mb-1 font-semibold text-dark dark:text-white">{tmpl.title}</h3>
              <p className="mb-3 text-xs text-gray-500 line-clamp-2">{tmpl.description}</p>

              {/* Preview of content */}
              <div className="mb-4 rounded-lg bg-gray-2 p-2 dark:bg-dark-3">
                <p className="text-[10px] leading-relaxed text-gray-500 line-clamp-3" dangerouslySetInnerHTML={{
                  __html: tmpl.default_content_preview.replace(/<[^>]+>/g, "").substring(0, 120)
                }} />
              </div>

              {selectedIds.length > 0 ? (
                <button onClick={() => handleBulk(tmpl)} className="w-full rounded-lg bg-primary py-1.5 text-xs text-white">
                  Issue to {selectedIds.length} Selected
                </button>
              ) : (
                <p className="text-center text-[10px] text-gray-400">Select employees below to issue</p>
              )}

              {/* Quick issue button tooltip on hover */}
              {selectedIds.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="text-center">
                    <p className="mb-2 text-sm font-medium text-white">Select employees below</p>
                    <p className="text-xs text-gray-300">Then click to issue this template</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Employee Section */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-dark dark:text-white">Employees</h2>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or department..." className="w-full rounded-lg border border-stroke py-2 pl-9 pr-3 text-sm dark:border-stroke-dark dark:bg-dark-2" />
          </div>
        </div>

        {/* Employee grid */}
        <div className="overflow-x-auto rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stroke bg-gray-2 dark:border-stroke-dark dark:bg-dark-3">
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={selectAll && filtered.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-gray-300 text-primary" />
                </th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-center">Documents</th>
                <th className="px-4 py-3 text-center">Quick Issue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No employees found</td></tr>
              )}
              {filtered.map((emp) => {
                const empDocs = getEmployeeDocs(emp.id);
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <tr key={emp.id} className={`border-b border-stroke transition-colors dark:border-stroke-dark ${isSelected ? "bg-primary/5" : "hover:bg-gray-1 dark:hover:bg-dark-3"}`}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(emp.id)} className="h-4 w-4 rounded border-gray-300 text-primary" />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-dark dark:text-white">{emp.full_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{emp.employee_id}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.department || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{emp.designation || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      {empDocs.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
                          <FileText className="h-3 w-3" /> {empDocs.length}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-[200px] flex-wrap justify-center gap-1">
                        {templates.map((tmpl) => (
                          <button
                            key={tmpl.doc_type}
                            onClick={() => handleIssue(tmpl, emp)}
                            className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-1 text-[10px] text-primary hover:bg-primary/20"
                          >
                            {tmpl.title.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <form onSubmit={handleUpload} className="mx-4 w-full max-w-md rounded-2xl border border-stroke bg-white p-6 shadow-xl dark:border-stroke-dark dark:bg-dark-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Upload Document</h3>
              <button type="button" onClick={() => setUploadModal(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <select value={selectedEmp || ""} onChange={(e) => setSelectedEmp(e.target.value ? parseInt(e.target.value) : null)} required className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
                <option value="">Select employee</option>
                {filtered.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
              <input name="title" placeholder="Document title" required className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
              <select name="doc_type" className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
                <option value="cnic_copy">CNIC Copy</option>
                <option value="cv">CV / Resume</option>
                <option value="education">Educational Certificate</option>
                <option value="previous_experience">Previous Experience Letter</option>
                <option value="photo">Photograph</option>
                <option value="offer_letter">Offer Letter (signed)</option>
                <option value="appointment_letter">Appointment Letter</option>
                <option value="warning_letter">Warning Letter</option>
                <option value="experience_letter">Experience Letter</option>
                <option value="certificate">Training Certificate</option>
                <option value="other">Other</option>
              </select>
              <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2" />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Upload</button>
              <button type="button" onClick={() => setUploadModal(false)} className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-stroke-dark">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Issue Document Modal */}
      <IssueDocumentModal
        open={issueModal.open}
        onClose={() => setIssueModal({ ...issueModal, open: false })}
        docType={issueModal.docType}
        docTitle={issueModal.docTitle}
        employeeId={issueModal.empId}
        employeeName={issueModal.empName}
        onIssued={loadData}
      />

      {/* Bulk Issue Modal */}
      <BulkIssueModal
        open={bulkModal.open}
        onClose={() => setBulkModal({ ...bulkModal, open: false })}
        docType={bulkModal.docType}
        docTitle={bulkModal.docTitle}
        selectedIds={selectedIds}
        onIssued={loadData}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, docId: 0 })}
        onConfirm={deleteDoc}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
