"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";
import toast from "react-hot-toast";

const EMPTY = { title: "", message: "", type: "announcement", role_id: "" };
type RecipientRole = { id: number; name: string; active_users: number };
type AnnouncementResponse = {
  count: number;
  channels?: Record<string, { accepted: number; failed: number; skipped: number }>;
};

export default function HrAnnouncementsPage() {
  const [form, setForm] = useState(EMPTY);
  const [channels, setChannels] = useState({ sms: true, whatsapp: true, push: true });
  const [roles, setRoles] = useState<RecipientRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hrFetch("/announcement-roles")
      .then((r) => setRoles(r.roles || []))
      .catch((error) => toast.error(error.message || "Could not load available user roles."));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: AnnouncementResponse = await hrFetch("/announcements", {
        method: "POST",
        body: JSON.stringify({ ...form, role_id: form.role_id || undefined, channels }),
      });
      const channelSummary = Object.entries(data.channels || {})
        .map(([channel, result]) =>
          `${channel}: ${result.accepted} accepted${result.failed ? `, ${result.failed} failed` : ""}${result.skipped ? `, ${result.skipped} skipped` : ""}`)
        .join(" · ");
      const failures = Object.values(data.channels || {}).reduce((total, result) => total + result.failed, 0);
      const skipped = Object.values(data.channels || {}).reduce((total, result) => total + result.skipped, 0);
      const summary = `Saved in app for ${data.count} user(s). External counts are gateway acceptance, not handset delivery. ${channelSummary || "No external channels selected."}`;
      if (failures) toast.error(summary, { duration: 10000 });
      else if (skipped) toast(summary, { duration: 10000 });
      else toast.success(summary, { duration: 8000 });
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
            <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}
              className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3">
              <option value="">All active employees</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name} ({role.active_users})</option>)}
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
          <p className="mt-1 text-xs text-gray-400">Only active system roles with users appear. SMS needs Jazz credentials; WhatsApp needs the approved HR WATI template; app push needs a registered device token. Results show accepted, failed, and skipped sends.</p>
        </div>
        <button type="submit" disabled={loading} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Sending..." : form.role_id ? `Send to ${roles.find((role) => role.id === Number(form.role_id))?.name || "Selected role"}` : "Send to All Active Users"}
        </button>
      </form>
    </div>
  );
}
