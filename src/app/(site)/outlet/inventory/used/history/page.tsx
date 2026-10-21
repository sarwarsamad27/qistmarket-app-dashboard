"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Cookies from "js-cookie";
import { ArrowLeft, RotateCcw, Search } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { formatExactDate } from "@/utils/dateUtils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const getAuthHeaders = () => ({
  Authorization: `Bearer ${Cookies.get("auth_token")}`,
  "Content-Type": "application/json",
});

type ReversalEntry = {
  id: number;
  inventory_id: number;
  product_name: string;
  imei_serial?: string | null;
  category?: string | null;
  color_variant?: string | null;
  purchase_price?: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function UsedInventoryReversalHistoryPage() {
  const [history, setHistory] = useState<ReversalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/inventory/used/history?page=${page}&limit=10&search=${encodeURIComponent(search)}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, search]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Breadcrumb pageName="Used Stock Reversal History" />
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <RotateCcw size={22} className="text-primary" /> Reversal History
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Every time a used-stock item is reversed back to available stock, it appears here.</p>
        </div>
        <Link href="/outlet/inventory/used" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft size={16} /> Back to Used Stock
        </Link>
      </div>

      <div className="bg-white dark:bg-boxdark rounded-xl border border-stroke dark:border-strokedark shadow-sm p-4 mb-4 flex flex-col md:flex-row gap-3 justify-between">
        <div className="relative w-full md:max-w-md">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by product or IMEI"
            className="w-full border border-stroke dark:border-strokedark rounded-lg pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-form-input dark:text-white"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-boxdark rounded-xl border border-stroke dark:border-strokedark overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-gray-500">No reversal history found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-meta-4 border-b border-stroke dark:border-strokedark text-gray-600 dark:text-gray-300 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">S.No</th><th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">IMEI</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Reversed At</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={item.id} className="border-b border-stroke/50 dark:border-strokedark/50"><td className="px-4 py-3 font-semibold text-gray-500 tabular-nums">{(page - 1) * 10 + idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">{item.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{item.imei_serial || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.category || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatExactDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-500">Showing {history.length} of {totalItems} records</div>
        <div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-semibold disabled:opacity-50">Previous</button>
          <span className="text-sm font-semibold">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-2 rounded-lg border border-stroke dark:border-strokedark text-sm font-semibold disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  );
}
