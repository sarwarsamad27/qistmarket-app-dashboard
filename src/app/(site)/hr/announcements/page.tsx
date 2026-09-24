"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import toast from "react-hot-toast";

const EMPTY = { title: "", message: "", type: "announcement", department: "" };

export default function HrAnnouncementsPage() {
  const [form, setForm] = useState(EMPTY);
  const [channels, setChannels] = useState({ sms: true, whatsapp: true, push: true });
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hrFetch("/employees")
      .then((r) => setDepartments([...new Set<string>((r.employees || []).map((e: { department?: string }) => e.department).filter(Boolean))].sort()))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await hrFetch("/announcements", {
        method: "POST",
        body: JSON.stringify({ ...form, department: form.department || undefined, channels }),
      });
      toast.success(`Sent to ${data.count} employee(s)`);
      setForm(EMPTY);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-dark dark:text-white">Send Announcement</h1>
      <p className="mb-6 text-sm text-gray-500">HR announcements, meeting notices and training alerts. Always shown in the employee portal; also sent over the channels you pick.</p>

      <form onSubmit={handleSubmit} className="max-w-xl rounded-xl border border-stroke bg-white p-6 dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-gray-500">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3">
              <option value="announcement">HR Announcement</option>
              <option value="meeting">Meeting Notice</option>
              <option value="training">Training Alert</option>
              <option value="warning">Warning</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">Send to</label>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3">
              <option value="">All active employees</option>
              {departments.map((d) => <option key={d} value={d}>{d} department</option>)}
            </select>
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-500">Title</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3" />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-500">Message</label>
          <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3" />
        </div>
        <div className="mb-5">
          <p className="mb-2 text-sm text-gray-500">Also send by</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {([["sms", "SMS"], ["whatsapp", "WhatsApp"], ["push", "Mobile app"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" checked={channels[key]} onChange={(e) => setChannels({ ...channels, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-400">WhatsApp needs the approved HR template on WATI. Mobile app reaches employees linked to an app account.</p>
        </div>
        <button type="submit" disabled={loading} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Sending..." : form.department ? `Send to ${form.department}` : "Send to All Employees"}
        </button>
      </form>
    </div>
  );
}
