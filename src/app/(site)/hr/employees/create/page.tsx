"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { hrFetch } from "@/lib/employee-api";
import toast from "react-hot-toast";
import Link from "next/link";
import Cookies from "js-cookie";
import DepartmentSelect from "@/components/EmployeePortal/DepartmentSelect";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Documents HR collects at hiring. Official letters (offer, appointment…)
// are issued later from the Document Center instead.
const HIRING_DOC_TYPES: [string, string][] = [
  ["cnic_copy", "CNIC Copy"],
  ["cv", "CV / Resume"],
  ["education", "Educational Certificate"],
  ["previous_experience", "Previous Experience Letter"],
  ["photo", "Photograph"],
  ["other", "Other"],
];
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"];
const MAX_MB = 10;

interface DocRow { key: number; doc_type: string; title: string; file: File; preview: string | null }

const isImage = (f: File) => /^image\//.test(f.type);
const fileSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function CreateEmployeePage() {
  const router = useRouter();
  const [outlets, setOutlets] = useState<{ id: number; name: string; code: string }[]>([]);
  const [appUsers, setAppUsers] = useState<{ id: number; full_name: string; username: string; role: string | null }[]>([]);
  const [sendingSms, setSendingSms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const docsRef = useRef<DocRow[]>([]);
  docsRef.current = docs;
  // Free the image previews when leaving the page.
  useEffect(() => () => docsRef.current.forEach((d) => d.preview && URL.revokeObjectURL(d.preview)), []);
  const [docResult, setDocResult] = useState<{ uploaded: number; failed: string[] } | null>(null);
  const [credentials, setCredentials] = useState<{ id: number; username: string; password: string; employee_id: string } | null>(null);
  const [form, setForm] = useState({
    full_name: "", cnic: "", phone: "", email: "", address: "",
    emergency_contact: "", emergency_phone: "", qualification: "", experience: "",
    date_of_birth: "", date_of_joining: "", department: "", designation: "",
    outlet_id: "", basic_salary: "", user_id: "",
  });

  useEffect(() => {
    const token = Cookies.get("auth_token");
    fetch(`${API}/api/all-outlets`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((d) => setOutlets((d.data || d.outlets || []).filter((o: { deleted_at?: string | null }) => !o.deleted_at)))
      .catch(console.error);
    hrFetch("/app-users").then((r) => setAppUsers(r.users || [])).catch(() => {});
  }, []);

  const updateDoc = (key: number, patch: Partial<DocRow>) => setDocs((d) => d.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Adds any number of files at once (picker with multiple selection, or drag & drop).
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const rows: DocRow[] = [];
    let hasCnic = docs.some((d) => d.doc_type === "cnic_copy");
    for (const file of Array.from(list)) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) { toast.error(`${file.name}: only PDF, JPG, PNG, WEBP, DOC and DOCX are allowed.`); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { toast.error(`${file.name} is larger than ${MAX_MB} MB.`); continue; }
      // First image defaults to CNIC copy; HR can change the type on the card.
      const doc_type = !hasCnic && isImage(file) ? "cnic_copy" : ext === ".pdf" || ext.startsWith(".doc") ? "cv" : "other";
      if (doc_type === "cnic_copy") hasCnic = true;
      rows.push({ key: Date.now() + Math.random(), doc_type, title: "", file, preview: isImage(file) ? URL.createObjectURL(file) : null });
    }
    setDocs((d) => [...d, ...rows]);
  };

  const removeDoc = (key: number) => setDocs((all) => {
    const row = all.find((r) => r.key === key);
    if (row?.preview) URL.revokeObjectURL(row.preview);
    return all.filter((r) => r.key !== key);
  });

  // Uploads the attached documents once the employee exists. A failed file
  // doesn't undo the employee — it's listed so HR can re-upload it from the
  // employee's profile.
  const uploadDocs = async (employeeId: number) => {
    const token = Cookies.get("auth_token");
    const result = { uploaded: 0, failed: [] as string[] };
    for (const d of docs.filter((r) => r.file)) {
      const fd = new FormData();
      fd.append("file", d.file as File);
      fd.append("doc_type", d.doc_type);
      fd.append("title", d.title.trim() || HIRING_DOC_TYPES.find(([v]) => v === d.doc_type)?.[1] || (d.file as File).name);
      try {
        const res = await fetch(`${API}/api/hr/employees/${employeeId}/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Upload failed");
        result.uploaded += 1;
      } catch (err) {
        result.failed.push(`${(d.file as File).name}: ${(err as Error).message}`);
      }
    }
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await hrFetch("/employees", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          outlet_id: form.outlet_id ? parseInt(form.outlet_id) : null,
          basic_salary: form.basic_salary ? parseFloat(form.basic_salary) : null,
          user_id: form.user_id ? parseInt(form.user_id) : null,
        }),
      });
      setDocResult(docs.some((d) => d.file) ? await uploadDocs(data.employee.id) : null);
      setCredentials({ ...data.credentials, id: data.employee.id });
      toast.success("Employee created with portal credentials");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <label className="mb-1 block text-sm text-gray-500">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3"
        required={key === "full_name"}
      />
    </div>
  );

  if (credentials) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-stroke bg-white p-8 dark:border-stroke-dark dark:bg-dark-2">
        <h1 className="mb-4 text-xl font-bold text-green">Employee Created!</h1>
        <div className="space-y-3 rounded-lg bg-gray-2 p-4 font-mono text-sm dark:bg-dark-3">
          <p><strong>Employee ID:</strong> {credentials.employee_id}</p>
          <p><strong>Username:</strong> {credentials.username}</p>
          <p><strong>Password:</strong> {credentials.password}</p>
        </div>
        <p className="mt-4 text-xs text-gray-500">Save these credentials. Portal is auto-activated.</p>
        {docResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${docResult.failed.length ? "bg-red/10 text-red" : "bg-green/10 text-green"}`}>
            {docResult.uploaded} document(s) uploaded.
            {docResult.failed.length > 0 && (
              <>
                {" "}These could not be uploaded — add them from the employee&apos;s profile → Documents:
                <ul className="mt-1 list-disc pl-4">{docResult.failed.map((f) => <li key={f}>{f}</li>)}</ul>
              </>
            )}
          </div>
        )}
        {form.phone && (
          <button
            disabled={sendingSms}
            onClick={async () => {
              setSendingSms(true);
              try {
                const r = await hrFetch(`/employees/${credentials.id}/send-credentials`, { method: "POST", body: JSON.stringify({ password: credentials.password }) });
                toast.success(r.message);
              } catch (err) { toast.error((err as Error).message); }
              finally { setSendingSms(false); }
            }}
            className="mt-3 w-full rounded-lg border border-primary py-2 text-sm text-primary disabled:opacity-50"
          >
            {sendingSms ? "Sending..." : `Send credentials by SMS to ${form.phone}`}
          </button>
        )}
        <div className="mt-6 flex gap-3">
          <button onClick={() => router.push("/hr/employees")} className="flex-1 rounded-lg bg-primary py-2 text-white">View All Employees</button>
          <button onClick={() => { setCredentials(null); docs.forEach((d) => d.preview && URL.revokeObjectURL(d.preview)); setDocs([]); setDocResult(null); setForm({ full_name: "", cnic: "", phone: "", email: "", address: "", emergency_contact: "", emergency_phone: "", qualification: "", experience: "", date_of_birth: "", date_of_joining: "", department: "", designation: "", outlet_id: "", basic_salary: "", user_id: "" }); }} className="flex-1 rounded-lg border border-stroke py-2 dark:border-stroke-dark">Add Another</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/hr/employees" className="text-sm text-primary hover:underline">← Back to Employees</Link>
        <h1 className="mt-2 text-2xl font-bold text-dark dark:text-white">Add New Employee</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("full_name", "Full Name *")}
          {field("cnic", "CNIC")}
          {field("phone", "Phone")}
          {field("email", "Email", "email")}
          <div>
            <label className="mb-1 block text-sm text-gray-500">Department</label>
            <DepartmentSelect value={form.department} onChange={(department) => setForm((f) => ({ ...f, department }))} />
          </div>
          {field("designation", "Designation")}
          {field("date_of_birth", "Date of Birth", "date")}
          {field("date_of_joining", "Date of Joining", "date")}
          {field("basic_salary", "Basic Salary", "number")}
          <div>
            <label className="mb-1 block text-sm text-gray-500">Outlet</label>
            <select value={form.outlet_id} onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3">
              <option value="">— None —</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-gray-500">Mobile app account (for staff who already have an app ID)</label>
            <select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3">
              <option value="">— Not linked —</option>
              {appUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name} (@{u.username}{u.role ? `, ${u.role}` : ""})</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">{field("address", "Address")}</div>
          {field("emergency_contact", "Emergency Contact Name")}
          {field("emergency_phone", "Emergency Phone")}
          <div className="sm:col-span-2">{field("qualification", "Qualification")}</div>
          <div className="sm:col-span-2">{field("experience", "Experience")}</div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm text-gray-500">
              Documents <span className="text-xs text-gray-400">(CNIC copy, CV, certificates, photo — PDF/JPG/PNG/DOC, max {MAX_MB} MB each)</span>
            </label>
            <div
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-stroke hover:border-primary dark:border-stroke-dark"}`}
            >
              <p className="text-sm font-medium text-dark dark:text-white">Drag &amp; drop files here, or click to choose</p>
              <p className="mt-1 text-xs text-gray-500">You can select several files at once</p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ALLOWED_EXT.join(",")}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                className="hidden"
              />
            </div>

            {docs.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map((d) => (
                  <div key={d.key} className="overflow-hidden rounded-xl border border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2">
                    <div className="relative flex h-36 items-center justify-center bg-gray-2 dark:bg-dark-3">
                      {d.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.preview} alt={d.file.name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold uppercase text-primary">
                            {d.file.name.split(".").pop()}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeDoc(d.key)}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm text-red shadow hover:bg-white"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="truncate text-xs text-gray-500" title={d.file.name}>{d.file.name} · {fileSize(d.file.size)}</p>
                      <select value={d.doc_type} onChange={(e) => updateDoc(d.key, { doc_type: e.target.value })} className="w-full rounded-lg border border-stroke px-2 py-1.5 text-sm dark:border-stroke-dark dark:bg-dark-3">
                        {HIRING_DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <input value={d.title} onChange={(e) => updateDoc(d.key, { title: e.target.value })} placeholder="Title (optional)" className="w-full rounded-lg border border-stroke px-2 py-1.5 text-sm dark:border-stroke-dark dark:bg-dark-3" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="submit" disabled={loading} className="mt-6 rounded-lg bg-primary px-8 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Creating..." : "Create Employee & Activate Portal"}
        </button>
      </form>
    </div>
  );
}
