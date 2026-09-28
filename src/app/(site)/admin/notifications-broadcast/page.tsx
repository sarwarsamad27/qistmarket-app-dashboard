"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Megaphone, Send } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { roleLabel } from "@/lib/roleLabels";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}`, "Content-Type": "application/json" });

interface RoleOption { id: number; name: string }
interface OutletOption { id: number; name: string; city?: string }

export default function AdminNotificationsBroadcastPage() {
  const [target, setTarget] = useState<"all" | "role" | "outlet" | "user">("all");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [outlets, setOutlets] = useState<OutletOption[]>([]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/admin-panel/roles`, { headers: authHeaders() }).then((r) => r.json()).then((json) => { if (json.success) setRoles(json.data); });
    fetch(`${BACKEND_URL}/api/outlet-reports/all-outlets`, { headers: authHeaders() }).then((r) => r.json()).then((json) => { if (json.success) setOutlets(json.data || []); });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    if (target !== "all" && !targetId) {
      toast.error("Please select a target.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin-panel/notifications/broadcast`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ target, targetId: target === "all" ? undefined : targetId, title, message }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to send.");
      toast.success("Broadcast sent.");
      setTitle("");
      setMessage("");
      setTargetId("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Breadcrumb pageName="Notifications Broadcast" />
      <PageHeader icon={Megaphone} title="Notifications Broadcast" subtitle="Compose and send a push notification to everyone, a role, an outlet, or one user." />

      <div className="max-w-xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-boxdark">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Send To</label>
            <div className="grid grid-cols-4 gap-2">
              {(["all", "role", "outlet", "user"] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setTarget(t); setTargetId(""); }} className={`rounded-xl py-2 text-sm font-semibold capitalize transition ${target === t ? "bg-[#ff3d3d] text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{t}</button>
              ))}
            </div>
          </div>

          {target === "role" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Role</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                <option value="">Select a role...</option>
                {roles.map((r) => <option key={r.id} value={r.name}>{roleLabel(r.name)}</option>)}
              </select>
            </div>
          )}

          {target === "outlet" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Outlet</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                <option value="">Select an outlet...</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          {target === "user" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">User ID</label>
              <input type="number" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Enter user ID" className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Notification message..." className="w-full rounded-xl border border-stroke bg-white px-4 py-2.5 text-sm outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-gray-dark dark:text-white" />
          </div>
          <button type="submit" disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff3d3d] py-2.5 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-50">
            <Send className="size-4" /> {sending ? "Sending..." : "Send Broadcast"}
          </button>
        </form>
      </div>
    </>
  );
}
