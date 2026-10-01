"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import Pagination from "@/components/common/Pagination";
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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function CsrClearAccountsPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  useEffect(() => {
    const loadClearCustomers = async () => {
      setLoading(true);

      try {
        const token = Cookies.get("auth_token");
        const query = new URLSearchParams({
          status: "completed",
          page: String(pagination.page),
          limit: String(pagination.limit),
        });

        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/customers?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (json.success) {
          setCustomers(json.data.customers || []);
          setPagination((prev) => ({
            ...prev,
            total: json.data.pagination.total,
            totalPages: json.data.pagination.totalPages,
            hasNext: json.data.pagination.hasNext,
            hasPrev: json.data.pagination.hasPrev,
          }));
        }
      } catch (error) {
        console.error(error);
        toast.error(getErrorMessage(error, "Unable to load clear account customers."));
      } finally {
        setLoading(false);
      }
    };

    loadClearCustomers();
  }, [pagination.page, pagination.limit]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Breadcrumb pageName="Clear Account Customers" />

      <section className="data-table-common rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="flex flex-col gap-4 px-7.5 py-4.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Clear Account Customers</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Customers with cleared accounts appear here so CSR can re-engage them for new sales.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">Per page:</label>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination((prev) => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-[#ff3d3d] dark:border-dark-3 dark:bg-dark-2 dark:text-white"
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size} className="dark:bg-dark-2">
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 overflow-x-auto">
          <table className="datatable-table datatable-one !border-collapse px-4 md:px-8 w-full">
            <thead className="border-separate px-4">
              <tr className="border-t border-stroke dark:border-dark-3">
                <th className="whitespace-nowrap px-3 py-4 align-top">
                  <div className="flex flex-col min-h-[70px]"><span className="font-[500]">Customer</span></div>
                </th>
                <th className="whitespace-nowrap px-3 py-4 align-top">
                  <div className="flex flex-col min-h-[70px]"><span className="font-[500]">WhatsApp</span></div>
                </th>
                <th className="whitespace-nowrap px-3 py-4 align-top">
                  <div className="flex flex-col min-h-[70px]"><span className="font-[500]">Location</span></div>
                </th>
                <th className="whitespace-nowrap px-3 py-4 align-top">
                  <div className="flex flex-col min-h-[70px]"><span className="font-[500]">Total Orders</span></div>
                </th>
                <th className="whitespace-nowrap px-3 py-4 align-top">
                  <div className="flex flex-col min-h-[70px]"><span className="font-[500]">Pending Amount</span></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-[#ff3d3d]" />
                      <p className="text-gray-500">Loading customers...</p>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-gray-500 dark:text-gray-400">
                    No clear account customers available.
                  </td>
                </tr>
              ) : (
                customers.map((item, index) => (
                  <tr key={`${item.customer.whatsapp_number}-${index}`} className="border-t border-stroke dark:border-dark-3 hover:bg-gray-50 dark:hover:bg-dark-2/50">
                    <td className="truncate px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{item.customer.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{item.customer.address || "No address"}</div>
                    </td>
                    <td className="truncate px-3 py-3 text-gray-700 dark:text-gray-200">{item.customer.whatsapp_number}</td>
                    <td className="truncate px-3 py-3 text-gray-700 dark:text-gray-200">{item.customer.city || "N/A"}, {item.customer.area || "N/A"}</td>
                    <td className="truncate px-3 py-3 text-gray-700 dark:text-gray-200">{item.ledgerSummary.totalOrders}</td>
                    <td className="truncate px-3 py-3 text-gray-700 dark:text-gray-200">PKR {item.ledgerSummary.totalPendingAmount.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-7.5 py-7 sm:flex-row sm:items-center sm:justify-between">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
            isLoading={loading}
          />
          <p className="font-medium text-dark dark:text-gray-300">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} customers)
          </p>
        </div>
      </section>
    </div>
  );
}
