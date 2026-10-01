"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal/Modal";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface CashSubmissionData {
  officer_name: string;
  amount: number;
  payment_method: string;
  otp: string;
  entries?: {
    customer_name?: string;
    order_ref: string;
    product_name?: string;
    imei?: string;
    color?: string;
    amount: number;
    cash_type?: string;
  }[];
}

export function CashSubmissionPopup({ socket }: { socket: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<CashSubmissionData | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    console.log("Socket listener attached to cash_submission_otp");

    const handleRequest = (payload: CashSubmissionData & { target_outlet_id?: number }) => {
      console.log("Cash submission request received:", payload);
      
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const myOutletId = user?.outlet_id;

      // STRICT FILTER: If targeted at an outlet, ONLY show if it matches my outlet ID exactly.
      // Super admins (no outlet_id) or other branches will be ignored.
      if (payload.target_outlet_id) {
        if (!myOutletId || parseInt(myOutletId) !== payload.target_outlet_id) {
          console.log("Ignoring cash submission: targeted at outlet", payload.target_outlet_id, "but my outlet is", myOutletId);
          return;
        }
      }

      setData(payload);
      setIsOpen(true);
    };

    socket.on("cash_submission_otp", handleRequest);
    return () => {
      socket.off("cash_submission_otp", handleRequest);
    };
  }, [socket]);

  const handleVerify = async () => {
    if (!data || !otpInput) return;

    setLoading(true);
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const outletId = user?.outlet_id;

      if (!outletId) {
        toast.error("Outlet ID not found in session");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/outlet/verify-cash-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Cookies.get("auth_token")}`,
        },
        body: JSON.stringify({
          otp: otpInput,
          outlet_id: outletId,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Cash submission verified successfully!");
        setIsOpen(false);
        setData(null);
        setOtpInput("");

        // Optionally refresh the current page if it's the collections page
        if (window.location.pathname.includes("/outlet/cash-in-hand")) {
          window.dispatchEvent(new Event("refreshCashList"));
        }
      } else {
        toast.error(result.message || "Verification failed");
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "An error occurred during verification"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !data) return null;

  return (
    <Modal open={isOpen} onClose={() => setIsOpen(false)}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">Cash Collection</h2>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
            Live Request
          </div>
        </div>

        <div className="space-y-4 text-left">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm">
            <div>
               <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest pl-0.5">Officer</p>
               <p className="font-bold text-gray-800 dark:text-white">{data.officer_name}</p>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest pr-0.5">Method</p>
               <p className="font-bold text-blue-600 dark:text-blue-400 uppercase">{data.payment_method}</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-center">
            <p className="text-[10px] text-blue-500 dark:text-blue-400 uppercase font-black tracking-widest mb-1">Grand Total to Collect</p>
            <p className="text-3xl font-black text-blue-700 dark:text-blue-300">PKR {data.amount.toLocaleString()}</p>
          </div>

          {/* Removed Submission Breakdown as per user request */}

          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Enter 4-Digit OTP from Officer
            </label>
            <input
              type="text"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
              placeholder="0 0 0 0"
              className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:border-blue-500 dark:focus:border-blue-500 outline-none text-center text-4xl tracking-widest font-black text-gray-800 dark:text-white transition-all shadow-inner"
              maxLength={4}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-4 rounded-2xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
            >
              Later
            </button>
            <button
              onClick={handleVerify}
              disabled={loading || otpInput.length < 4}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-4 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Complete"
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
