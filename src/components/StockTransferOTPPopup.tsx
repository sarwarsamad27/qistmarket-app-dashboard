"use client";

import React, { useState, useEffect } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import Cookies from "js-cookie";
import { Truck, Store, KeyRound, CheckCircle2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { getErrorMessage } from "@/lib/apiErrors";

export const StockTransferOTPPopup = () => {
    const { socket } = useNotifications();
    const { user } = useAuth();
    const [incomingTransfer, setIncomingTransfer] = useState<any>(null);
    const [stockBackData, setStockBackData] = useState<any>(null);
    const [show, setShow] = useState(false);
    const [otpInput, setOtpInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!socket || !user) return;

        // The authenticated notification join adds this user's outlet room on
        // the server. Do not buffer an unauthenticated join_room on refresh.

        socket.on("stock_transfer_initiated", (data) => {
            setIncomingTransfer(data);
            setShow(true);
            
            // Also show a toast
            toast.custom((t) => (
                <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-boxdark shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Store className="h-10 w-10 text-primary" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Stock Incoming!
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {data.from_name} is transferring {data.items_count} items.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-l border-gray-200 dark:border-strokedark">
                        <button
                            onClick={() => {
                                setShow(true);
                                toast.dismiss(t.id);
                            }}
                            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            View
                        </button>
                    </div>
                </div>
            ), { duration: 10000 });
        });

        socket.on("stock_transfer_cancelled", (data) => {
             // If we had a specific ID we'd check it, but for now let's just close if something was cancelled
             setShow(false);
             setIncomingTransfer(null);
             toast.error("A pending transfer was cancelled.");
        });

        socket.on("stock_transfer_completed", (data) => {
            setShow(false);
            setIncomingTransfer(null);
            toast.success("Transfer completed and stock received!");
        });

        socket.on("stock_back_initiated", (data) => {
            setStockBackData(data);
            setShow(true);
            setOtpInput("");
            
            const message = data.role === 'receiver' 
                ? `Stock Back Requested! Give OTP to sender.` 
                : `Stock Back Requested! Please enter the OTP.`;
            
            toast.success(message);
        });

        socket.on("stock_back_completed", (data) => {
            setShow(false);
            setStockBackData(null);
            setIncomingTransfer(null);
            toast.success("Stock back completed successfully!");
        });

        return () => {
            socket.off("stock_transfer_initiated");
            socket.off("stock_transfer_cancelled");
            socket.off("stock_transfer_completed");
            socket.off("stock_back_initiated");
            socket.off("stock_back_completed");
        };
    }, [socket, user]);

    const handleVerifyBack = async () => {
        if (!otpInput || otpInput.length < 5) {
            toast.error("Please enter a valid OTP");
            return;
        }

        setIsSubmitting(true);
        try {
            const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
            const response = await fetch(`${API_BASE}/api/outlet/inventory/transfer/back/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Cookies.get("auth_token")}`,
                },
                body: JSON.stringify({
                    transfer_id: Array.isArray(stockBackData.transfer_id) ? undefined : stockBackData.transfer_id,
                    transfer_ids: stockBackData.transfer_ids || undefined,
                    otp: otpInput
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Stock Back verified successfully!");
                setShow(false);
                setOtpInput("");
                setTimeout(() => window.location.reload(), 1500); // Refresh to show updated status
            } else {
                toast.error(data.message || "Verification failed");
            }
        } catch (error) {
            toast.error(getErrorMessage(error, "An error occurred"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!show || (!incomingTransfer && !stockBackData)) return null;

    const isBackTransfer = !!stockBackData;
    const currentData = stockBackData || incomingTransfer;

    return (
        <div className="fixed inset-0 z-[10000] bg-black bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-boxdark rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-pulse"></div>
                
                <button 
                    onClick={() => setShow(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                    <Truck size={32} />
                </div>
                
                <h3 className="text-2xl font-bold text-center text-black dark:text-white mb-2">
                    {isBackTransfer ? "Stock Back Request" : (currentData.is_resend ? "OTP Resent!" : "Incoming Stock Transfer")}
                </h3>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6 px-4">
                    {isBackTransfer ? (
                        <>Stock Back for <strong>{currentData.product_name}</strong> {currentData.imei_serial && `(${currentData.imei_serial}) `}is being initiated.</>
                    ) : (
                        <><strong>{currentData.from_name}</strong> is {currentData.is_resend ? "updated the OTP for " : "transferring "} <strong>{currentData.items_count}</strong> items to your outlet.</>
                    )}
                </p>

                <div className="bg-gray-50 dark:bg-meta-4/30 rounded-xl p-6 mb-4 border border-stroke dark:border-strokedark text-center relative overflow-hidden">
                    {currentData.is_resend && (
                        <div className="absolute top-0 right-0 bg-primary text-[8px] text-white px-2 py-0.5 rounded-bl-lg font-bold uppercase tracking-tighter">
                            New OTP
                        </div>
                    )}
                    
                    {isBackTransfer && currentData.role === 'giver' ? (
                        <>
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2 block">Enter Stock Back OTP</span>
                            <div className="flex flex-col items-center gap-4">
                                <input
                                    type="text"
                                    value={otpInput}
                                    onChange={(e) => setOtpInput(e.target.value)}
                                    placeholder="00000"
                                    maxLength={5}
                                    className="w-full text-center text-3xl font-black text-primary tracking-[0.2em] bg-white dark:bg-boxdark border-2 border-primary/20 rounded-xl py-2 focus:border-primary outline-none transition-all"
                                />
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">
                                    Get the OTP from the other party.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2 block">Your OTP for this {isBackTransfer ? "Stock Back" : "Transfer"}</span>
                            <div className="flex items-center justify-center gap-2">
                                <KeyRound size={20} className="text-primary" />
                                <span className="text-4xl font-black text-primary tracking-[0.2em]">{currentData.otp}</span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-4 uppercase font-bold tracking-tighter">
                                Share this OTP with the {isBackTransfer ? "recipient" : "sender"} to confirm.
                            </p>
                        </>
                    )}
                </div>

                {/* Items List (only for regular transfers) */}
                {!isBackTransfer && currentData.items && currentData.items.length > 0 && (
                    <div className="mb-6 max-h-[150px] overflow-y-auto border border-stroke dark:border-strokedark rounded-xl p-2 bg-gray-50/50 dark:bg-meta-4/10">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 px-2 sticky top-0 bg-inherit py-1">Items to be Received</p>
                        <div className="space-y-1">
                            {currentData.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white dark:bg-boxdark border border-stroke/50 dark:border-strokedark/50 shadow-sm">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-black dark:text-white line-clamp-1">{item.name}</span>
                                        {item.imei && <span className="text-[10px] text-primary font-medium tracking-tight">IMEI: {item.imei}</span>}
                                    </div>
                                    <CheckCircle2 size={12} className="text-green-500" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isBackTransfer && currentData.role === 'giver' ? (
                    <button
                        onClick={handleVerifyBack}
                        disabled={isSubmitting}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-opacity-90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        {isSubmitting ? "Verifying..." : (
                            <>
                                <CheckCircle2 size={20} />
                                Verify Stock Back
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => setShow(false)}
                        className="w-full bg-primary text-white py-4 rounded-xl font-bold hover:bg-opacity-90 flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
                    >
                        <CheckCircle2 size={20} />
                        {isBackTransfer ? "I Understand" : (currentData.is_resend ? "Got New OTP" : "I Understand")}
                    </button>
                )}
            </div>
        </div>
    );
};
