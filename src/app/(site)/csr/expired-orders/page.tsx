"use client";

import { useEffect, useState } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Cookies from "js-cookie";
import Pagination from "@/components/common/Pagination";
import Loader from "@/components/common/Loader";
import { Calendar, Clock, User, MapPin, Phone, DollarSign, AlertTriangle } from "lucide-react";
import { formatExactDate } from "@/utils/dateUtils";
import { describeExpiry } from "@/lib/orderExpiry";

interface ExpiredOrder {
  id: number;
  order_ref: string;
  token_number: string;
  customer_name: string;
  whatsapp_number: string;
  address: string;
  city: string;
  area: string;
  product_name: string;
  total_amount: number;
  advance_amount: number;
  monthly_amount: number;
  months: number;
  status: string;
  updated_at: string;
  expired_at?: string | null;
  expired_from_status?: string | null;
  expired_status_since?: string | null;
  created_at: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ExpiredOrdersPage() {
  const [orders, setOrders] = useState<ExpiredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchExpiredOrders = async (page: number) => {
    setLoading(true);
    try {
      const token = Cookies.get("auth_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/orders/expired/assigned?page=${page}&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.orders);
        setPagination(json.data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch expired orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiredOrders(pagination.page);
  }, []);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchExpiredOrders(newPage);
  };


  return (
    <div className="mx-auto w-full max-w-7xl">
      <Breadcrumb pageName="Expired Orders" />

      <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        {/* Header */}
        <div className="border-b border-stroke px-4 py-6 dark:border-dark-3 sm:px-6 md:px-7.5">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold text-dark dark:text-white">
                Expired Orders
              </h3>
              <p className="mt-1 text-sm text-dark-5 dark:text-dark-6">
                Orders that have exceeded their processing time limits
              </p>
            </div>
            {orders.length > 0 && (
              <div className="rounded-lg bg-yellow-50 px-3 py-2 dark:bg-yellow-900/20">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  {pagination.total} Expired {pagination.total === 1 ? "Order" : "Orders"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 md:p-7.5">
          {loading ? (
            <Loader text="Loading expired orders..." className="h-60" />
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
                <AlertTriangle size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <h4 className="mb-2 text-lg font-semibold text-dark dark:text-white">
                No Expired Orders
              </h4>
              <p className="text-sm text-dark-6 dark:text-dark-7">
                Great! All your assigned orders are within their processing time limits.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-stroke bg-gray-50 p-4 transition-all dark:border-dark-3 dark:bg-dark-3/50 hover:shadow-md"
                >
                  {/* Top Row - Reference & Status */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-dark dark:text-white">
                        {order.order_ref}
                      </p>
                      <p className="text-xs text-dark-5 dark:text-dark-6">
                        Token: {order.token_number}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        EXPIRED
                      </span>
                      {describeExpiry(order) && (
                        <span className="text-[11px] text-red-600 dark:text-red-400">{describeExpiry(order)}</span>
                      )}
                    </div>
                  </div>

                  {/* Grid - Details */}
                  <div className="mb-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {/* Customer */}
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-dark-5 dark:text-dark-6" />
                      <div className="min-w-0">
                        <p className="text-xs text-dark-5 dark:text-dark-6">Customer</p>
                        <p className="truncate text-sm font-medium text-dark dark:text-white">
                          {order.customer_name}
                        </p>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-dark-5 dark:text-dark-6" />
                      <div className="min-w-0">
                        <p className="text-xs text-dark-5 dark:text-dark-6">Contact</p>
                        <p className="text-sm font-medium text-dark dark:text-white">
                          {order.whatsapp_number}
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-dark-5 dark:text-dark-6" />
                      <div className="min-w-0">
                        <p className="text-xs text-dark-5 dark:text-dark-6">Location</p>
                        <p className="truncate text-sm font-medium text-dark dark:text-white">
                          {order.area}, {order.city}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Product & Pricing */}
                  <div className="mb-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {/* Product */}
                    <div>
                      <p className="text-xs text-dark-5 dark:text-dark-6">Product</p>
                      <p className="truncate text-sm font-medium text-dark dark:text-white">
                        {order.product_name}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-dark-5 dark:text-dark-6" />
                      <div>
                        <p className="text-xs text-dark-5 dark:text-dark-6">Total Amount</p>
                        <p className="text-sm font-semibold text-dark dark:text-white">
                          PKR {order.total_amount.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Tenure */}
                    <div>
                      <p className="text-xs text-dark-5 dark:text-dark-6">Tenure</p>
                      <p className="text-sm font-medium text-dark dark:text-white">
                        {order.months} months @ PKR {order.monthly_amount.toLocaleString()}/mo
                      </p>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex flex-wrap gap-3 border-t border-stroke pt-3 dark:border-dark-3">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar size={14} className="text-dark-5 dark:text-dark-6" />
                      <span className="text-dark-5 dark:text-dark-6">
                        Created: {formatExactDate(order.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Clock size={14} className="text-red-500" />
                      <span className="font-medium text-red-600 dark:text-red-400">
                        Expired: {formatExactDate(order.expired_at || order.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-stroke pt-6 dark:border-dark-3">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
                isLoading={loading}
              />
              <p className="text-sm font-medium text-dark-6 dark:text-dark-7">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
