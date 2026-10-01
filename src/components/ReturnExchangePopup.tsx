"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal/Modal";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import { PackageX, PackageCheck } from "lucide-react";
import { getErrorMessage, extractBodyMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface ReturnExchangeData {
  record_id: number;
  officer_name: string;
  type: "Return" | "Exchange";
  otp: string;
  order_ref: string;
  product_name: string;
  color?: string;
  variant?: string;
  delivered_advance?: number | string;
  imei: string | null;
  is_cash_refund: boolean;
  refund_amount: number;
}

export function ReturnExchangePopup({ socket }: { socket: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<ReturnExchangeData | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    console.log("Socket listener attached to return_exchange_requested");

    const handleRequest = (payload: ReturnExchangeData & { target_outlet_id?: number }) => {
      console.log("Return/Exchange request received:", payload);
      
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const myOutletId = user?.outlet_id;

      // STRICT FILTER: If targeted at an outlet, ONLY show if it matches my outlet ID exactly.
      if (payload.target_outlet_id) {
        if (!myOutletId || parseInt(myOutletId) !== payload.target_outlet_id) {
          console.log("Ignoring return request: targeted at outlet", payload.target_outlet_id, "but my outlet is", myOutletId);
          return;
        }
      }

      setData(payload);
      setIsOpen(true);
    };

    socket.on("return_exchange_requested", handleRequest);
    return () => {
      socket.off("return_exchange_requested", handleRequest);
    };
  }, [socket]);

  const handleVerify = async () => {
    if (!data || !otpInput) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/outlet/verify-return-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Cookies.get("auth_token")}`,
        },
        body: JSON.stringify({
          record_id: data.record_id,
          otp: otpInput,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(
          `${data.type} verified! Stock has been updated successfully.`
        );
        setIsOpen(false);
        setData(null);
        setOtpInput("");

        // Refresh returns page if currently open
        if (window.location.pathname.includes("/outlet/returns")) {
          window.dispatchEvent(new Event("refreshReturnList"));
        }
      } else {
        toast.error(extractBodyMessage(result) || "Verification failed");
      }
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "An error occurred during verification"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !data) return null;

  const isReturn = data.type === "Return";
  const accentColor = isReturn ? "red" : "amber";

  return (
    <Modal open={isOpen} onClose={() => setIsOpen(false)}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-100 dark:border-gray-700 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isReturn ? (
              <PackageX size={20} className="text-red-500" />
            ) : (
              <PackageCheck size={20} className="text-amber-500" />
            )}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">
              {data.type} Request
            </h2>
          </div>
          <div
            className={`bg-${accentColor}-50 dark:bg-${accentColor}-900/20 text-${accentColor}-600 dark:text-${accentColor}-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse`}
          >
            Live Request
          </div>
        </div>

        <div className="space-y-4 text-left">
          {/* Officer + Type row */}
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest pl-0.5">
                Officer
              </p>
              <p className="font-bold text-gray-800 dark:text-white">
                {data.officer_name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest pr-0.5">
                Type
              </p>
              <p
                className={`font-bold uppercase ${
                  isReturn
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {data.type}
              </p>
            </div>
          </div>

          {/* Product details */}
          <div
            className={`p-4 rounded-2xl border text-left ${
              isReturn
                ? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30"
                : "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30"
            }`}
          >
            <div className="flex justify-between items-start mb-3 border-b border-white/20 dark:border-white/5 pb-3">
              <div>
                <p
                  className={`text-[9px] uppercase font-black tracking-widest mb-1 ${
                    isReturn
                      ? "text-red-500 dark:text-red-400"
                      : "text-amber-500 dark:text-amber-400"
                  }`}
                >
                  Returning Item
                </p>
                <p
                  className={`text-lg font-black leading-tight ${
                    isReturn
                      ? "text-red-700 dark:text-red-300"
                      : "text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {data.product_name || "—"}
                </p>
                <div className="flex gap-1.5 mt-2">
                  <span className="bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded text-[10px] font-bold border border-white/40 dark:border-white/10 uppercase tracking-tighter shadow-sm text-gray-700 dark:text-gray-300">
                    {data.color || 'N/A'}
                  </span>
                  <span className="bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded text-[10px] font-bold border border-white/40 dark:border-white/10 uppercase tracking-tighter shadow-sm text-gray-700 dark:text-gray-300">
                    {data.variant || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest mb-1">
                  Paid Advance
                </p>
                <p className="text-sm font-black text-success tracking-tighter">
                  Rs. {Number(data.delivered_advance)?.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-2">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase font-black tracking-widest opacity-50 mb-0.5">Order Reference</span>
                <span className="font-bold bg-white/40 dark:bg-black/20 px-2 py-0.5 rounded-md border border-white/20 dark:border-white/5 shadow-sm">#{data.order_ref}</span>
              </div>
              <div className="flex flex-col items-end text-right">
                <span className="text-[8px] uppercase font-black tracking-widest opacity-50 mb-0.5">Physical IMEI</span>
                <span className="font-bold bg-white/40 dark:bg-black/20 px-2 py-0.5 rounded-md border border-white/20 dark:border-white/5 shadow-sm font-mono tracking-tighter">{data.imei || "N/A"}</span>
              </div>
            </div>

            {data.is_cash_refund && data.refund_amount > 0 && (
                <div className="mt-3 bg-red-500/10 dark:bg-red-500/20 p-3 rounded-xl border border-red-500/20 flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Cash Refund</p>
                    <p className="text-lg font-black text-red-600 dark:text-red-400">Rs. {data.refund_amount.toLocaleString()}</p>
                </div>
            )}
          </div>

          {/* OTP input */}
          <div className="pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Enter 4-Digit OTP from Officer
            </label>
            <input
              type="text"
              value={otpInput}
              onChange={(e) =>
                setOtpInput(e.target.value.replace(/\D/g, ""))
              }
              placeholder="0 0 0 0"
              className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:border-primary dark:focus:border-primary outline-none text-center text-4xl tracking-widest font-black text-gray-800 dark:text-white transition-all shadow-inner"
              maxLength={4}
            />
          </div>

          {/* Action buttons */}
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
              className={`flex-[2] disabled:opacity-50 text-white px-4 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isReturn
                  ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                  : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                `Confirm ${data.type}`
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
