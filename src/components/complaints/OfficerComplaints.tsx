"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { Image as ImageIcon, Search, Clock, CheckCircle, AlertCircle, X } from "lucide-react";
import CnicSearch from "./CnicSearch";
import { formatExactDate } from "@/utils/dateUtils";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";

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
}

export default function OfficerComplaints() {
  const [activeTab, setActiveTab] = useState<"my" | "new">("my");
  const [search, setSearch] = useState("");
  
  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerCnic, setCustomerCnic] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // List State
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadComplaints = async (currentPage = page, searchTerm = search) => {
    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const url = new URL(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints`);
      url.searchParams.append("page", String(currentPage));
      url.searchParams.append("my_only", "true");
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
    if (activeTab === "my") {
      loadComplaints(1, search);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadComplaints(1, search);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (media.length + files.length > 5) {
      toast.error("You can only upload up to 5 images.");
      return;
    }

    const newFiles = [...media, ...files];
    const newPreviews = [...mediaPreviews, ...files.map((f) => URL.createObjectURL(f))];
    
    setMedia(newFiles);
    setMediaPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(mediaPreviews[index]);
    setMedia(media.filter((_, i) => i !== index));
    setMediaPreviews(mediaPreviews.filter((_, i) => i !== index));
  };

  const submitComplaint = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || !customerCnic.trim() || !mobileNumber.trim() || !description.trim()) {
      toast.error("Please fill all fields: Name, CNIC, Mobile, and Description.");
      return;
    }
    setSubmitting(true);
    try {
      const token = Cookies.get("auth_token");
      const formData = new FormData();
      formData.append("customer_name", customerName.trim());
      formData.append("customer_cnic", customerCnic.trim());
      formData.append("mobile_number", mobileNumber.trim());
      formData.append("description", description.trim());
      
      media.forEach((file) => {
        formData.append("media", file);
      });

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to submit complaint.", json));
      
      toast.success("Complaint submitted successfully.");
      setCustomerName("");
      setCustomerCnic("");
      setMobileNumber("");
      setDescription("");
      setMedia([]);
      setMediaPreviews([]);
      setActiveTab("my");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Unable to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("my")}
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'my' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          My Complaints
        </button>
        <button
          onClick={() => setActiveTab("new")}
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'new' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          + File Complaint
        </button>
      </div>

      {activeTab === "new" ? (
        <section className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Record a New Complaint</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Search for customer CNIC to auto-fill details.
          </p>

          <form onSubmit={submitComplaint} className="mt-6 space-y-4">
            <div>
               <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Search Customer</label>
               <CnicSearch 
                  onSelect={(p) => {
                    setCustomerName(p.name);
                    setCustomerCnic(p.cnic_number);
                    setMobileNumber(p.telephone_number);
                  }}
               />
            </div>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={customerCnic}
              onChange={(e) => setCustomerCnic(e.target.value)}
              placeholder="Customer CNIC"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="Mobile Number"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Provide complete details..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Attach Pictures (Max 5)
              </label>
              <div className="flex flex-wrap gap-4 mb-4">
                {mediaPreviews.map((url, i) => (
                  <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm group">
                    <img src={url} alt="preview" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                {media.length < 5 && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
                    <ImageIcon className="h-4 w-4 text-gray-400 mb-1" />
                    <span className="text-[10px] text-gray-500">Pick image</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {media.length > 0 && <p className="mt-2 text-xs text-gray-400">Selected {media.length} of 5 images.</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Complaints</h2>
            <form onSubmit={handleSearch} className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-gray-300 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
              ))
            ) : complaints.length ? (
              complaints.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900 transition hover:shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{item.customer_name}</p>
                      <p className="text-xs text-gray-500">{item.complaint_id}</p>
                    </div>
                    <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === 'Solved' ? 'bg-green-100 text-green-800' :
                      item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {item.status === 'Solved' ? <CheckCircle className="h-3 w-3" /> : item.status === 'Pending' ? <Clock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description}</p>

                  {item.media_urls && item.media_urls.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {item.media_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="media" className="h-12 w-12 rounded object-cover border border-gray-200 dark:border-gray-700 shadow-sm transition hover:scale-105" />
                        </a>
                      ))}
                    </div>
                  )}

                  {item.resolution_note && (
                    <div className="mt-4 rounded-lg bg-white p-3 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">Resolution Note</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.resolution_note}</p>
                    </div>
                  )}
                  
                  <p className="mt-4 text-[10px] text-gray-400">Filed on: {formatExactDate(item.created_at)}</p>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 py-12 text-center text-gray-500 dark:border-gray-700">
                You haven't filed any complaints yet.
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button disabled={page === 1} onClick={() => loadComplaints(page - 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50 dark:text-white">Prev</button>
              <button disabled={page === totalPages} onClick={() => loadComplaints(page + 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50 dark:text-white">Next</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
