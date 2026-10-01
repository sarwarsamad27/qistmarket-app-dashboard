"use client";

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import { getErrorMessage } from "@/lib/apiErrors";

interface CustomerItem {
  customer: {
    name: string;
    whatsapp_number: string;
    address: string;
    city: string | null;
    area: string | null;
  };
  ledgerSummary: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    totalAdvanceReceived: number;
    totalPendingAmount: number;
  };
}

export default function CsrCustomerSearchPage() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) {
      toast.error("Enter a name, CNIC, mobile number, or order token.");
      return;
    }

    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/customers?search=${encodeURIComponent(search.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.data.customers || []);
      } else {
        toast.error(json.error?.message || "Search failed.");
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Customer search failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Breadcrumb pageName="Global Customer Search" />

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Global Search</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Search customers and orders by name, mobile number, area, address, order token, IMEI, or product.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile, token, IMEI, address..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#ff3d3d] focus:ring-2 focus:ring-[#ff3d3d]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="rounded-lg bg-[#ff3d3d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {results.map((item, index) => (
          <div key={index} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.customer.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.customer.whatsapp_number}</p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Orders: {item.ledgerSummary.totalOrders} · Paid: {item.ledgerSummary.paidOrders} · Pending: {item.ledgerSummary.pendingOrders}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-xs uppercase text-gray-400">Total Advance</p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">PKR {item.ledgerSummary.totalAdvanceReceived.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-xs uppercase text-gray-400">Pending Amount</p>
                <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">PKR {item.ledgerSummary.totalPendingAmount.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
                <p className="text-xs uppercase text-gray-400">Location</p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{item.customer.city || "N/A"}, {item.customer.area || "N/A"}</p>
              </div>
            </div>
          </div>
        ))}

        {!loading && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900">
            No results found. Try searching with customer name, phone, token number, IMEI or area.
          </div>
        )}
      </div>
    </div>
  );
}
