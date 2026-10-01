"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { Search, Image as ImageIcon, X, CheckSquare, Clock, Grab, Eye, Link2, ExternalLink } from "lucide-react";
import CnicSearch from "@/components/complaints/CnicSearch";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";

interface LinkedOrder {
  id: number;
  order_ref: string;
  customer_name: string;
  product_name?: string;
  status?: string;
  created_at?: string;
}

interface ComplaintItem {
  id: number;
  complaint_id: string;
  customer_name: string;
  customer_cnic: string | null;
  mobile_number: string;
  description: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
  media_urls: string[] | null;
  created_by?: { full_name: string; role?: { name: string } };
  assigned_to?: { full_name: string };
  order?: LinkedOrder | null;
}

type TabType = "unassigned" | "picked" | "solved" | "new";

export default function CsrComplaintsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("unassigned");
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

  // Resolve State
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>("unassigned");
  const [detailLoading, setDetailLoading] = useState(false);
  const [candidateOrders, setCandidateOrders] = useState<LinkedOrder[]>([]);
  const [linkingOrderId, setLinkingOrderId] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveStatus, setResolveStatus] = useState("Pending");
  const [resolving, setResolving] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);

  const loadComplaints = async (currentPage = page, currentTab = activeTab, searchTerm = search) => {
    if (currentTab === "new") return;
    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const url = new URL(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints`);
      url.searchParams.append("page", String(currentPage));
      if (searchTerm) url.searchParams.append("search", searchTerm);
      
      // Use the new tab-based filtering
      url.searchParams.append("tab", currentTab);

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
    loadComplaints(1, activeTab, search);
  }, [activeTab]);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadComplaints(1, activeTab, search);
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

  const handlePick = async (id: number) => {
    setPickingId(id);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints/${id}/pick`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to pick complaint.", json));

      toast.success("Complaint picked successfully.");
      if (selectedComplaint?.id === id) setSelectedComplaint(null);
      loadComplaints(page, activeTab, search);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setPickingId(null);
    }
  };

  // Opens the detail modal for any tab (including "unassigned", where a CSR
  // couldn't previously see full details/attachments before deciding whether
  // to pick a complaint) and fetches candidate matching orders so it can be
  // linked into that customer's actual profile.
  const viewComplaint = async (item: ComplaintItem, tab: TabType) => {
    setSelectedComplaint(item);
    setSelectedTab(tab);
    setResolveStatus(item.status);
    setResolveNote(item.resolution_note || "");
    setCandidateOrders([]);
    setDetailLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setSelectedComplaint(json.data.complaint);
        setCandidateOrders(json.data.candidateOrders || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setDetailLoading(false);
    }
  };

  const linkOrder = async (orderId: number) => {
    if (!selectedComplaint) return;
    setLinkingOrderId(orderId);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints/${selectedComplaint.id}/link`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to link complaint.", json));
      setSelectedComplaint(json.data.complaint);
      toast.success("Complaint linked to the customer's order.");
      loadComplaints(page, activeTab, search);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to link complaint.");
    } finally {
      setLinkingOrderId(null);
    }
  };

  const submitComplaint = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || !customerCnic.trim() || !mobileNumber.trim() || !description.trim()) {
      toast.error("Please fill Name, CNIC, Mobile, and Description.");
      return;
    }
    setSubmitting(true);
    try {
      const token = Cookies.get("auth_token");
      const formData = new FormData();
      formData.append("customer_name", customerName.trim());
      if (customerCnic) formData.append("customer_cnic", customerCnic.trim());
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
      setActiveTab("unassigned");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Unable to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedComplaint) return;
    setResolving(true);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/complaints/${selectedComplaint.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: resolveStatus,
          resolution_note: resolveNote.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to update complaint.", json));
      toast.success("Complaint updated successfully.");
      setSelectedComplaint(null);
      loadComplaints();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to update complaint.");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Breadcrumb pageName="CSR Complaints Dashboard" />
      
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("unassigned")}
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'unassigned' ? 'border-b-2 border-[#ff3d3d] text-[#ff3d3d]' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Global (Unassigned)
        </button>
        <button
          onClick={() => setActiveTab("picked")}
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'picked' ? 'border-b-2 border-[#ff3d3d] text-[#ff3d3d]' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          My Picked
        </button>
        <button
          onClick={() => setActiveTab("solved")}
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'solved' ? 'border-b-2 border-[#ff3d3d] text-[#ff3d3d]' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          Solved
        </button>
        <button
          onClick={() => setActiveTab("new")}
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'new' ? 'border-b-2 border-[#ff3d3d] text-[#ff3d3d]' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
        >
          + File Complaint
        </button>
      </div>

      {activeTab === "new" ? (
        <section className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Record a New Complaint</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Search for a customer by CNIC or Name to auto-fill details.
          </p>

          <form onSubmit={submitComplaint} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs font-medium text-gray-500 uppercase">Search Purchaser</label>
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
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#ff3d3d] focus:ring-2 focus:ring-[#ff3d3d]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                type="text"
                value={customerCnic}
                onChange={(e) => setCustomerCnic(e.target.value)}
                placeholder="Customer CNIC"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#ff3d3d] focus:ring-2 focus:ring-[#ff3d3d]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <input
              type="text"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="Mobile Number (Format: 03xxxxxxxxx)"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#ff3d3d] focus:ring-2 focus:ring-[#ff3d3d]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Complaint description in detail..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#ff3d3d] focus:ring-2 focus:ring-[#ff3d3d]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Attach Media (Max 5 images)
              </label>
              <div className="flex flex-wrap gap-4 mb-4">
                {mediaPreviews.map((url, i) => (
                  <div key={i} className="relative h-24 w-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm group">
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
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
                    <ImageIcon className="h-5 w-5 text-gray-400 mb-1" />
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
              className="w-full rounded-lg bg-[#ff3d3d] px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700 mt-4"
            >
              {submitting ? "Uploading..." : "Submit Complaint"}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
              {activeTab.replace('_', ' ')} Complaints
            </h2>
            <form onSubmit={handleSearch} className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search by ID, Name or Mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border border-gray-300 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-[#ff3d3d] focus:ring-1 focus:ring-[#ff3d3d] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
              ))
            ) : complaints.length ? (
              complaints.map((item) => (
                <div key={item.id} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-900">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{item.customer_name}</h3>
                        <p className="text-xs text-gray-500">{item.complaint_id} • {item.mobile_number}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === 'Solved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        item.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 line-clamp-3 dark:text-gray-300">{item.description}</p>
                    
                    {item.media_urls && item.media_urls.length > 0 && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-blue-500">
                        <ImageIcon className="h-3 w-3" /> {item.media_urls.length} Attachments
                      </div>
                    )}

                    {item.order && (
                      <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <Link2 className="h-3 w-3" /> Linked to {item.order.order_ref}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                    {activeTab === 'unassigned' ? (
                      <>
                        <button
                          onClick={() => viewComplaint(item, activeTab)}
                          className="flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
                        <button
                          onClick={() => handlePick(item.id)}
                          disabled={pickingId === item.id}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff3d3d] py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                        >
                          <Grab className="h-4 w-4" />
                          {pickingId === item.id ? "Picking..." : "Pick Complaint"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => viewComplaint(item, activeTab)}
                        className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                      >
                        {activeTab === 'solved' ? 'View Details' : 'View & Resolve'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-300 py-12 text-center text-gray-500 dark:border-gray-700">
                No complaints found in this section.
              </div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => loadComplaints(page - 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-700 dark:text-white"
              >
                Prev
              </button>
              <span className="flex items-center px-4 text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => loadComplaints(page + 1)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-gray-700 dark:text-white"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* Resolve Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-800">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Complaint Details</h3>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 scrollbar-hide flex-1">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedComplaint.customer_name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{selectedComplaint.mobile_number} {selectedComplaint.customer_cnic && `• ${selectedComplaint.customer_cnic}`}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Reported By</p>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedComplaint.created_by?.full_name || 'Anonymous'}</p>
                  <p className="text-xs text-gray-400">{new Date(selectedComplaint.created_at).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="mt-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{selectedComplaint.description}</p>
              </div>

              {selectedComplaint.media_urls && selectedComplaint.media_urls.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Attachments</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {selectedComplaint.media_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="flex-shrink-0 relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 block w-24 h-24">
                        <img src={url} alt={`attachment-${i}`} className="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <hr className="my-6 border-gray-200 dark:border-gray-800" />
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Link2 className="h-4 w-4" /> Customer Profile
              </h4>

              {detailLoading ? (
                <p className="text-sm text-gray-400">Looking up matching customer records...</p>
              ) : selectedComplaint.order ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Linked to Order {selectedComplaint.order.order_ref}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{selectedComplaint.order.customer_name}</p>
                  </div>
                  <Link
                    href={`/orders/${selectedComplaint.order.id}`}
                    target="_blank"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    View Ledger & Profile <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : candidateOrders.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Matched by CNIC/mobile number — confirm the right order to link this complaint to that customer's profile.</p>
                  {candidateOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{o.order_ref} — {o.customer_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{o.product_name} {o.status && `• ${o.status}`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/orders/${o.id}`}
                          target="_blank"
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 transition"
                        >
                          Preview
                        </Link>
                        <button
                          onClick={() => linkOrder(o.id)}
                          disabled={linkingOrderId === o.id}
                          className="rounded-lg bg-[#ff3d3d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition disabled:opacity-50"
                        >
                          {linkingOrderId === o.id ? "Linking..." : "Link & View"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No matching customer/order found by CNIC or mobile number.</p>
              )}

              {selectedTab === 'picked' && (
                <>
                  <hr className="my-6 border-gray-200 dark:border-gray-800" />
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <CheckSquare className="h-4 w-4" /> Resolution Action
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Update Status</label>
                      <select
                        value={resolveStatus}
                        onChange={(e) => setResolveStatus(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-[#ff3d3d] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="New">New</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Pending">Pending</option>
                        <option value="Solved">Solved</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Resolution Note</label>
                      <textarea
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        rows={3}
                        placeholder="Describe how the complaint was handled..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-[#ff3d3d] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedTab === 'solved' && selectedComplaint.resolution_note && (
                <div className="mt-6 border-t pt-4">
                   <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider mb-2">Resolution Note</p>
                   <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-green-800 dark:text-green-300 text-sm italic">
                      "{selectedComplaint.resolution_note}"
                   </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-200 p-6 flex justify-end gap-3 dark:bg-gray-800/50 dark:border-gray-700">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 transition"
              >
                Close
              </button>
              {selectedTab === 'unassigned' && (
                <button
                  onClick={() => handlePick(selectedComplaint.id)}
                  disabled={pickingId === selectedComplaint.id}
                  className="flex items-center gap-2 rounded-lg bg-[#ff3d3d] px-6 py-2 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-50"
                >
                  <Grab className="h-4 w-4" />
                  {pickingId === selectedComplaint.id ? "Picking..." : "Pick Complaint"}
                </button>
              )}
              {selectedTab === 'picked' && (
                <button
                  onClick={handleUpdateStatus}
                  disabled={resolving}
                  className="rounded-lg bg-[#ff3d3d] px-6 py-2 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-50"
                >
                  {resolving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

