"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { Search, Image as ImageIcon, X, Clock, CheckCircle } from "lucide-react";
import { getErrorMessage } from "@/lib/apiErrors";

interface ComplaintItem {
  id: number;
  complaint_id: string;
  customer_name: string;
  mobile_number: string;
  description: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  media_urls: string[] | null;
  created_by?: { full_name: string; role?: { name: string } };
}

export default function AdminComplaintsPage() {
  const [search, setSearch] = useState("");
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);

  const loadComplaints = async (currentPage = page, searchTerm = search) => {
    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const url = new URL(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints`);
      url.searchParams.append("page", String(currentPage));
      if (searchTerm) url.searchParams.append("search", searchTerm);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setComplaints(json.data.complaints || []);
        setTotalPages(json.data.pagination.totalPages || 1);
        setPage(json.data.pagination.page);
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Unable to load complaints."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints(1, search);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadComplaints(1, search);
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Breadcrumb pageName="Global Complaints List" />
      
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Company Complaints</h2>
          <form onSubmit={handleSearch} className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by ID, Name or Mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#ff3d3d] focus:ring-1 focus:ring-[#ff3d3d] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          </form>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-44 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))
          ) : complaints.length ? (
            complaints.map((item) => (
              <div key={item.id} className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{item.customer_name}</h3>
                      <p className="text-xs text-gray-500">{item.complaint_id}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'Solved' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                      item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 line-clamp-3 dark:text-gray-300">{item.description}</p>
                </div>
                
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
                  <div className="text-[10px] text-gray-400">
                    <p>By: {item.created_by?.full_name || 'System'}</p>
                    <p>{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => setSelectedComplaint(item)}
                    className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View Full Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-gray-500">
              No complaints match your search.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => loadComplaints(page - 1)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-700 dark:text-white"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => loadComplaints(page + 1)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-700 dark:text-white"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Details Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
              <h3 className="text-xl font-bold dark:text-white">Complaint Details</h3>
              <button onClick={() => setSelectedComplaint(null)} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 dark:text-white" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Complaint ID</p>
                  <p className="font-semibold dark:text-white">{selectedComplaint.complaint_id}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Status</p>
                  <p className="font-semibold dark:text-white">{selectedComplaint.status}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Customer Name</p>
                  <p className="font-semibold dark:text-white">{selectedComplaint.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500 uppercase text-[10px] font-bold">Mobile</p>
                  <p className="font-semibold dark:text-white">{selectedComplaint.mobile_number}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-gray-500 uppercase text-[10px] font-bold mb-2">Issue Description</p>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800 text-sm dark:text-gray-200">
                  {selectedComplaint.description}
                </div>
              </div>

              {selectedComplaint.media_urls && selectedComplaint.media_urls.length > 0 && (
                <div className="mt-6">
                  <p className="text-gray-500 uppercase text-[10px] font-bold mb-2">Evidence / Media</p>
                  <div className="flex gap-2 overflow-x-auto">
                    {selectedComplaint.media_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0">
                        <img src={url} alt="complaint media" className="h-20 w-20 rounded-lg object-cover border border-gray-200" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedComplaint.resolution_note && (
                <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-800">
                  <p className="text-gray-500 uppercase text-[10px] font-bold mb-2">Resolution Note (by CSR)</p>
                  <div className="rounded-xl bg-green-50 p-4 dark:bg-green-900/20 text-sm dark:text-green-200">
                    {selectedComplaint.resolution_note}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 p-6 flex justify-end dark:bg-gray-800/50">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
