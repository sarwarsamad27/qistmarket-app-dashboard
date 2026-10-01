import React, { useState } from "react";
import { X, CheckCircle2, PackageCheck, Info } from "lucide-react";
import { getErrorMessage, extractBodyMessage } from "@/lib/apiErrors";

interface ReturnVerificationPopupProps {
    isOpen: boolean;
    onClose: () => void;
    recordId: number;
    orderRef: string;
    officerName: string;
    productName?: string;
    color?: string;
    variant?: string;
    advance?: number | string;
    onSuccess: () => void;
}

const ReturnVerificationPopup: React.FC<ReturnVerificationPopupProps> = ({ 
    isOpen, onClose, recordId, orderRef, officerName, 
    productName, color, variant, advance,
    onSuccess 
}) => {
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 3) {
            const nextInput = document.getElementById(`otp-return-${index + 1}`);
            if (nextInput) nextInput.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-return-${index - 1}`);
            if (prevInput) prevInput.focus();
        }
    };

    const handleSubmit = async () => {
        const fullOtp = otp.join("");
        if (fullOtp.length < 4) {
            setError("Please enter complete OTP");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const token = document.cookie.split("; ").find(row => row.startsWith("auth_token="))?.split("=")[1];
            const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

            const res = await fetch(`${API_BASE}/api/outlet/verify-return-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    record_id: recordId,
                    otp: fullOtp
                }),
            });

            const data = await res.json();
            if (data.success) {
                onSuccess();
                onClose();
            } else {
                setError(extractBodyMessage(data) || "Failed to verify OTP.");
            }
        } catch (err: any) {
            setError(getErrorMessage(err, "Something went wrong. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-boxdark rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                <div className="bg-primary/10 px-6 py-5 flex items-center justify-between border-b border-primary/20">
                    <h3 className="font-bold text-primary flex items-center gap-2">
                        <PackageCheck size={20} /> Verify Customer OTP
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6">
                    {/* Delivered Product Snapshot Section */}
                    {productName && (
                        <div className="mb-6 p-4 bg-gray-50 dark:bg-meta-4/20 rounded-xl border border-stroke dark:border-strokedark shadow-inner">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-1.5">
                                <Info size={12} /> Delivered Product Snapshot
                            </h4>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-medium">Product</span>
                                    <span className="font-bold text-gray-800 dark:text-white line-clamp-1">{productName}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-medium">Specifications</span>
                                    <div className="flex gap-1">
                                        <span className="bg-white dark:bg-boxdark px-1.5 py-0.5 rounded border border-stroke dark:border-strokedark text-[10px] font-bold">{color || 'N/A'}</span>
                                        <span className="bg-white dark:bg-boxdark px-1.5 py-0.5 rounded border border-stroke dark:border-strokedark text-[10px] font-bold">{variant || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-medium">Advance Amount</span>
                                    <span className="text-success font-black tracking-tight font-mono">Rs. {Number(advance)?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6 font-medium">
                        {officerName === 'Outlet' ? (
                            <>Enter the 4-digit OTP sent to the customer for <span className="font-bold border-b border-dashed border-gray-400 pb-0.5">{orderRef}</span>.</>
                        ) : (
                            <>Enter the 4-digit OTP from <strong>{officerName}</strong> to receive stock back for <span className="font-bold border-b border-dashed border-gray-400 pb-0.5">{orderRef}</span>.</>
                        )}
                    </p>

                    <div className="flex justify-center gap-3 mb-6">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                id={`otp-return-${index}`}
                                type="text"
                                inputMode="numeric"
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value.replace(/\D/g, ""))}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-12 h-14 text-center text-xl font-bold bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                placeholder="•"
                                maxLength={1}
                            />
                        ))}
                    </div>

                    {error && (
                        <div className="mb-4 text-center text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 py-2 rounded-lg border border-red-100 dark:border-red-500/20">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={loading || otp.join("").length < 4}
                        className="w-full bg-primary hover:bg-opacity-90 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-60 disabled:active:scale-100 flex justify-center items-center gap-2"
                    >
                        {loading ? "Verifying..." : "Confirm & Restock"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReturnVerificationPopup;
