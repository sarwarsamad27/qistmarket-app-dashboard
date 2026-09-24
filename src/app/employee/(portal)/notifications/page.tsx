"use client";

import { useEffect, useState } from "react";
import { employeeFetch } from "@/lib/employee-api";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  salary: "💰",
  warning: "⚠️",
  announcement: "📢",
  approval: "✅",
  promotion: "🏆",
  meeting: "📅",
  training: "🎓",
  document: "📄",
  general: "📌",
};

export default function EmployeeNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState("");

  const load = (type?: string) => {
    const q = type ? `?type=${type}` : "";
    employeeFetch(`/employee/notifications${q}`).then((r) => setNotifications(r.notifications));
  };

  useEffect(() => { load(filter); }, [filter]);

  const markAllRead = async () => {
    await employeeFetch("/employee/notifications/read", { method: "PATCH", body: JSON.stringify({}) });
    load(filter);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Notifications</h1>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-2">
            <option value="">All Types</option>
            <option value="salary">Salary</option>
            <option value="warning">Warning</option>
            <option value="announcement">Announcement</option>
            <option value="approval">Approval</option>
            <option value="promotion">Promotion</option>
            <option value="meeting">Meeting</option>
            <option value="training">Training</option>
            <option value="document">Document</option>
            <option value="general">General</option>
          </select>
          <button onClick={markAllRead} className="rounded-lg bg-primary px-4 py-2 text-sm text-white">Mark all read</button>
        </div>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 && <p className="text-gray-500">No notifications</p>}
        {notifications.map((n) => (
          <div key={n.id} className={`rounded-xl border p-4 ${n.is_read ? "border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2" : "border-primary/30 bg-primary/5"}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{TYPE_ICON[n.type] || "📌"}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-dark dark:text-white">{n.title}</h3>
                  <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-6">{n.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
