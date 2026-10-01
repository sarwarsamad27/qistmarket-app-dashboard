"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Loader from "@/components/common/Loader";
import Cookies from "js-cookie";
import { formatExactDate } from "@/utils/dateUtils";
import { apiErrorMessage, getErrorMessage } from "@/lib/apiErrors";


const formatDateTimeUTC = (value?: string): string => {
  if (!value) return "Not set";
  return formatExactDate(value, "MMM D, YYYY h:mm A");
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function hasData(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && (value.trim() === "" || value === "-")) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "object" && Object.keys(value).length === 0) return false;
  return true;
}

// Format value – uses original field key for special handling
function formatValue(key: string, value: any): string {
  if (key === "createdAt") {
    return formatDateTimeUTC(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  // Special handling for referralDetails: show only referrer URL, not raw JSON
  if (key === "referralDetails" && typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed.referrer) {
        return parsed.referrer; // only the URL
      }
      return JSON.stringify(parsed);
    } catch {
      return value;
    }
  }
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Simple read-only field component (receives already formatted value)
const ReadOnlyField = ({ label, value, className = "" }: { label: string; value: any; className?: string }) => {
  if (!hasData(value)) return null;
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="mt-1 rounded-lg bg-gray-100 px-4 py-2.5 whitespace-pre-wrap dark:bg-dark-3 dark:text-gray-300">
        {value}
      </div>
    </div>
  );
};

// Define fields with original backend key
const fields = [
  { key: "id", label: "Order ID" },
  { key: "tokenNumber", label: "Token Number" },
  { key: "fullName", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "alternativePhone", label: "Alternative Phone" },
  { key: "cnic", label: "CNIC" },
  { key: "city", label: "City" },
  { key: "area", label: "Area" },
  { key: "address", label: "Address" },
  { key: "orderNotes", label: "Order Notes" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "productName", label: "Suggested Product Name" },
  { key: "totalDealValue", label: "Total Deal Value" },
  { key: "advanceAmount", label: "Advance Amount" },
  { key: "monthlyAmount", label: "Monthly Amount" },
  { key: "months", label: "Months" },
  { key: "cancelRequest", label: "Cancel Request" },
  { key: "rejectionReason", label: "Rejection Reason" },
  { key: "isArchived", label: "Archived" },
  { key: "createdAt", label: "Created At" },
  { key: "referralType", label: "Referral Type" },
  { key: "referralDetails", label: "Referral Details" },
];

function StatusBadge({ status }: { status: string }) {
  const getColor = () => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "approved":
      case "delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getColor()}`}>
      {status || "-"}
    </span>
  );
}

export default function WebsiteOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = Cookies.get("auth_token");
        const res = await fetch(
          `${BACKEND_URL}/api/orders/website-feed?search=${params.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to fetch order"));
        const json = await res.json();

        let orderData = null;
        if (Array.isArray(json)) {
          orderData = json.length > 0 ? json[0] : null;
        } else if (json?.data && Array.isArray(json.data)) {
          orderData = json.data.length > 0 ? json.data[0] : null;
        } else if (json?.data && typeof json.data === "object") {
          orderData = json.data;
        } else if (typeof json === "object" && !Array.isArray(json)) {
          orderData = json;
        }
        setOrder(orderData);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load order details"));
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchOrder();
  }, [params.id]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumb pageName="Website Order Details" />
      <button
        onClick={() => router.back()}
        className="mb-6 text-sm text-[#ff3d3d] font-bold hover:underline inline-flex items-center gap-1"
      >
        ← Back
      </button>

      {loading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader text="Loading order details..." />
        </div>
      ) : error ? (
        <div className="text-red-500 font-bold text-center py-12">{error}</div>
      ) : order ? (
        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-dark-3 dark:bg-gray-800 overflow-hidden">
          <div className="border-b border-stroke px-7 py-5 dark:border-dark-3 flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-2xl font-bold text-dark dark:text-white">Website Order Details</h2>
            {order.status && <StatusBadge status={order.status} />}
          </div>
          <div className="p-7">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              {fields.map((field) => {
                const rawValue = order[field.key];
                if (!hasData(rawValue)) return null;
                const formattedValue = formatValue(field.key, rawValue);
                return (
                  <ReadOnlyField
                    key={field.key}
                    label={field.label}
                    value={formattedValue}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 font-bold text-center py-12">No order found.</div>
      )}
    </div>
  );
}