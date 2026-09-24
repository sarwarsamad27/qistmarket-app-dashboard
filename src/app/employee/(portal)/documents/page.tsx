"use client";

import { useEffect, useState } from "react";
import { employeeFetch, viewAuthedFile, downloadAuthedFile, printAuthedFile } from "@/lib/employee-api";
import toast from "react-hot-toast";
import { Eye, Download, Share2, FileText } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface Doc {
  id: number;
  doc_type: string;
  title: string;
  file_url?: string;
}

const DOC_LABELS: Record<string, string> = {
  offer_letter: "Offer Letter",
  appointment_letter: "Appointment Letter",
  warning_letter: "Warning Letter",
  experience_letter: "Experience Letter",
  certificate: "Training Certificate",
  salary_slip: "Salary Slip",
  cnic_copy: "CNIC Copy",
  cv: "CV / Resume",
  education: "Educational Certificate",
  previous_experience: "Previous Experience Letter",
  photo: "Photograph",
  other: "Other",
};

export default function EmployeeDocumentsPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);

  useEffect(() => {
    employeeFetch("/employee/documents").then((r) => setDocuments(r.documents));
  }, []);

  const share = (doc: Doc) => {
    const text = `QIST Market Document: ${doc.title}${doc.file_url ? `
${API}${doc.file_url}` : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Files come through the authenticated API (as base64 JSON) rather than a
  // direct /uploads link — download-manager extensions like IDM hijack direct
  // PDF links and break View / Download / Print.
  const filePath = (doc: Doc) => `/employee/documents/${doc.id}/file`;
  const fileName = (doc: Doc) => `${doc.title || "document"}${(doc.file_url || "").match(/\.[a-z0-9]+$/i)?.[0] || ""}`;
  const run = (fn: () => Promise<void>) => fn().catch((e) => toast.error((e as Error).message));

  const viewDoc = (doc: Doc) => { if (doc.file_url) run(() => viewAuthedFile(filePath(doc))); };
  const downloadDoc = (doc: Doc) => { if (doc.file_url) run(() => downloadAuthedFile(filePath(doc), fileName(doc))); };
  const printDoc = (doc: Doc) => { if (doc.file_url) run(() => printAuthedFile(filePath(doc))); };

  const defaultCards = [
    { doc_type: "offer_letter", title: "Offer Letter" },
    { doc_type: "appointment_letter", title: "Appointment Letter" },
    { doc_type: "salary_slip", title: "Salary Slips", link: "/employee/payroll" },
    { doc_type: "warning_letter", title: "Warning Letters" },
    { doc_type: "experience_letter", title: "Experience Letter" },
    { doc_type: "certificate", title: "Training Certificates" },
  ];

  // documents arrive newest first — keep the first (latest) of each type and count them all.
  const docMap = new Map<string, Doc>();
  const docCount = new Map<string, number>();
  for (const d of documents) {
    if (!docMap.has(d.doc_type)) docMap.set(d.doc_type, d);
    docCount.set(d.doc_type, (docCount.get(d.doc_type) || 0) + 1);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">Document Center</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {defaultCards.map((card) => {
          const doc = docMap.get(card.doc_type);
          const inner = (
            <>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-dark dark:text-white">{card.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{doc ? ((docCount.get(card.doc_type) || 0) > 1 ? `${docCount.get(card.doc_type)} issued — latest shown` : "Available") : card.link ? "Download from Payroll" : "Not issued yet"}</p>
              {!card.link && (
                <div className="mt-4 flex gap-2">
                  <button
                    disabled={!doc?.file_url}
                    onClick={() => doc && viewDoc(doc)}
                    className="flex items-center gap-1 rounded-lg bg-gray-2 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-3 dark:bg-dark-3"
                  >
                    <Eye className="h-3 w-3" /> View
                  </button>
                  <button
                    disabled={!doc?.file_url}
                    onClick={() => doc && downloadDoc(doc)}
                    className="flex items-center gap-1 rounded-lg bg-gray-2 px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-gray-3 dark:bg-dark-3"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                  <button disabled={!doc} onClick={() => doc && share(doc)} className="flex items-center gap-1 rounded-lg bg-gray-2 px-3 py-1.5 text-xs disabled:opacity-40 dark:bg-dark-3">
                    <Share2 className="h-3 w-3" /> WhatsApp
                  </button>
                </div>
              )}
              {card.link && <p className="mt-3 text-xs text-primary">View in Payroll →</p>}
            </>
          );
          return card.link ? (
            <Link key={card.doc_type} href={card.link} className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-dark-2 hover:shadow-md transition-shadow block">
              {inner}
            </Link>
          ) : (
            <div key={card.doc_type} className="rounded-xl border border-stroke bg-white p-5 dark:border-stroke-dark dark:bg-dark-2">
              {inner}
            </div>
          );
        })}
      </div>

      {documents.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 font-semibold">All Documents</h2>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-stroke bg-white px-4 py-3 dark:border-stroke-dark dark:bg-dark-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>{doc.title}</span>
                  <span className="text-xs text-gray-500">{DOC_LABELS[doc.doc_type] || doc.doc_type}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => viewDoc(doc)} className="text-xs text-primary hover:underline"><Eye className="mr-1 inline h-3 w-3" />View</button>
                  <button onClick={() => downloadDoc(doc)} className="text-xs text-primary hover:underline"><Download className="mr-1 inline h-3 w-3" />Download</button>
                  <button onClick={() => printDoc(doc)} className="text-xs text-primary hover:underline">Print</button>
                  <button onClick={() => share(doc)} className="text-xs text-primary hover:underline"><Share2 className="mr-1 inline h-3 w-3" />WhatsApp</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
