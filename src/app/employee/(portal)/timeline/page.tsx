"use client";

import { useEffect, useState } from "react";
import { employeeFetch, viewAuthedFile } from "@/lib/employee-api";
import toast from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface Event {
  id: number;
  event_type: string;
  title: string;
  description?: string;
  event_date: string;
  document_url?: string;
}

const TYPE_COLORS: Record<string, string> = {
  joining: "bg-green",
  promotion: "bg-blue-DEFAULT",
  demotion: "bg-red",
  transfer: "bg-yellow-dark",
  increment: "bg-primary",
  warning: "bg-red",
  suspension: "bg-dark-4",
  performance_review: "bg-green-dark",
  department_change: "bg-yellow-dark",
  designation_change: "bg-blue-DEFAULT",
  salary_revision: "bg-primary",
  status_change: "bg-dark-4",
  training: "bg-green",
};

const TYPE_LABELS: Record<string, string> = {
  joining: "Joining",
  department_change: "Department Change",
  transfer: "Outlet Transfer",
  designation_change: "Designation Change",
  promotion: "Promotion",
  demotion: "Demotion",
  increment: "Salary Increment",
  salary_revision: "Salary Revision",
  warning: "Warning",
  suspension: "Suspension",
  status_change: "Status Change",
  performance_review: "Performance Review",
  training: "Training",
  other: "HR Update",
};

export default function EmployeeTimelinePage() {
  const [events, setEvents] = useState<Event[]>([]);

  const [docs, setDocs] = useState<{ id: number; file_url?: string }[]>([]);

  useEffect(() => {
    employeeFetch("/employee/timeline").then((r) => setEvents(r.events));
    employeeFetch("/employee/documents").then((r) => setDocs(r.documents || [])).catch(() => {});
  }, []);

  // Letters open through the authenticated API — direct PDF links get hijacked
  // by download-manager extensions such as IDM.
  const openLetter = (url: string) => {
    const doc = docs.find((d) => d.file_url === url);
    if (doc) viewAuthedFile(`/employee/documents/${doc.id}/file`).catch((e) => toast.error((e as Error).message));
    else window.open(url.startsWith("http") ? url : `${API}${url}`, "_blank");
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">Employment Timeline</h1>

      <div className="relative space-y-0">
        {events.length === 0 && <p className="text-gray-500">No timeline events yet.</p>}
        {events.map((event, i) => (
          <div key={event.id} className="relative flex gap-4 pb-8">
            {i < events.length - 1 && (
              <div className="absolute left-[15px] top-8 h-full w-0.5 bg-stroke dark:bg-stroke-dark" />
            )}
            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TYPE_COLORS[event.event_type] || "bg-gray-5"} text-xs font-bold text-white`}>
              {event.event_type[0].toUpperCase()}
            </div>
            <div className="flex-1 rounded-xl border border-stroke bg-white p-4 dark:border-stroke-dark dark:bg-dark-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-dark dark:text-white">{event.title}</h3>
                <span className="text-xs text-gray-500">
                  {new Date(event.event_date).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-primary">{TYPE_LABELS[event.event_type] || event.event_type.replace(/_/g, " ")}</p>
              {event.description && <p className="mt-2 text-sm text-gray-600 dark:text-gray-6">{event.description}</p>}
              {event.document_url && (
                <button type="button" onClick={() => openLetter(event.document_url as string)} className="mt-2 inline-block text-sm text-primary hover:underline">
                  View Letter PDF
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
