import { useEffect, useState } from "react";
import { Modal } from "../Modal/Modal";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "@/lib/apiErrors";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const getAuthHeaders = () => {
    const token = Cookies.get("auth_token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

type InstallmentRow = {
    monthNumber: number;
    dueDate: string | null;
    dueAmount: number;
    status: string;
    paidAt: string | null;
    paidAmount?: number;
    arrears?: number;
    remainingAmount?: number;
};

type PaymentModalProps = {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    orderId: number;
    orderRef: string;
    customerName: string;
    installment: InstallmentRow | null;
};

export default function InstallmentPaymentModal({ open, onClose, onSuccess, orderId, orderRef, customerName, installment }: PaymentModalProps) {
    const { user } = useAuth();
    const userRole = user?.role?.toLowerCase() || "";
    const isRecoveryOfficer = userRole === "recovery officer" || userRole === "recovery_officer";

    const [isOtpSent, setIsOtpSent] = useState(false);
    const [otp, setOtp] = useState("");
    const [feedback, setFeedback] = useState("");
    const [alternateNumber, setAlternateNumber] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [fuelCharge, setFuelCharge] = useState(0);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [qrData, setQrData] = useState<{qr_string: string, qr_image_base64: string, amount: number} | null>(null);
    const [generatingQr, setGeneratingQr] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            // If Recovery Officer, OTP is still required. If Outlet Manager, we skip OTP state.
            setIsOtpSent(!isRecoveryOfficer);
            setOtp("");
            setFeedback("");
            setAlternateNumber("");
            setPaymentMethod("Cash");
            setFuelCharge(0);
            
            // Default to remaining balance + arrears
            const rem = installment?.remainingAmount ?? Math.max(0, (installment?.dueAmount || 0) - (installment?.paidAmount || 0));
            const totalPayable = rem + (installment?.arrears || 0);
            setPaymentAmount(totalPayable > 0 ? totalPayable : 0);
            
            setQrData(null);
        }
    }, [open, isRecoveryOfficer, installment]);

    // Check for existing QR code silently if method is Online
    useEffect(() => {
        if (open && paymentMethod === "Online" && !isRecoveryOfficer && installment && !qrData) {
            const checkSavedQr = async () => {
                setGeneratingQr(true);
                try {
                    const res = await fetch(`${API_BASE}/api/outlet/installment/check-smartpay-qr?order_id=${orderId}&month_number=${installment.monthNumber}`, {
                        headers: getAuthHeaders()
                    });
                    const data = await res.json();
                    if (data.success && data.data) {
                        setQrData(data.data);
                    }
                } catch (e) {
                    console.error("Failed to check saved QR", e);
                } finally {
                    setGeneratingQr(false);
                }
            };
            checkSavedQr();
        }
    }, [open, paymentMethod, isRecoveryOfficer, installment, orderId, qrData]);

    const handleSendOtp = async () => {
        setLoading(true);
        try {
            const endpoint = isRecoveryOfficer 
                ? `${API_BASE}/api/recovery/generate-otp`
                : `${API_BASE}/api/outlet/installment/generate-otp`;

            const res = await fetch(endpoint, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ order_id: orderId }),
            });
            const data = await res.json();
            if (data.success) {
                setIsOtpSent(true);
                toast.success("OTP sent to customer's WhatsApp");
            } else {
                toast.error(data.message || "Failed to send OTP");
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "Error sending OTP"));
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateQr = async (forceRegenerate = false) => {
        if (!installment) return;
        setGeneratingQr(true);
        try {
            const res = await fetch(`${API_BASE}/api/outlet/installment/generate-smartpay-qr`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    order_id: orderId,
                    month_number: installment.monthNumber,
                    amount: paymentAmount,
                    force_regenerate: forceRegenerate
                }),
            });
            const data = await res.json();
            if (data.success && data.data) {
                setQrData(data.data);
                toast.success(forceRegenerate ? "QR Regenerated" : "SmartPay QR ready for customer scan");
            } else {
                toast.error(data.message || "Failed to generate QR");
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "Error communicating with payment gateway"));
        } finally {
            setGeneratingQr(false);
        }
    };

    const handleVerifyAndPay = async () => {
        if (isRecoveryOfficer && !otp) return toast.error("Please enter OTP");
        if (!feedback) return toast.error("Please enter customer feedback");

        setLoading(true);
        try {
            // Logic for Recovery Officer: Verify first, then Submit
            if (isRecoveryOfficer) {
                // Step 1: Verify OTP
                const verifyRes = await fetch(`${API_BASE}/api/recovery/verify-otp`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ order_id: orderId, otp }),
                });
                const verifyData = await verifyRes.json();
                
                if (!verifyData.success) {
                    toast.error(verifyData.message || verifyData.error || "OTP verification failed");
                    setLoading(false);
                    return;
                }

                // Step 2: Submit Collection (OTP not sent in body)
                const submitRes = await fetch(`${API_BASE}/api/recovery/submit-installment`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        order_id: orderId,
                        month_number: installment?.monthNumber,
                        amount: paymentAmount,
                        feedback,
                        alternate_number: alternateNumber,
                        payment_method: paymentMethod,
                        fuelCharges: fuelCharge
                    }),
                });
                const submitData = await submitRes.json();

                if (submitData.success) {
                    toast.success("Payment successful!");
                    onSuccess();
                    onClose();
                } else {
                    toast.error(submitData.message || "Payment submission failed");
                }
            } else {
                // Logic for Outlet Managers (Combined, NO OTP required)
                const res = await fetch(`${API_BASE}/api/outlet/installment/verify-and-pay`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        order_id: orderId,
                        month_number: installment?.monthNumber,
                        amount: paymentAmount,
                        feedback,
                        alternate_number: alternateNumber,
                        payment_method: paymentMethod, // Cash or Online
                    }),
                });
                const data = await res.json();
                if (data.success) {
                    toast.success("Payment successful!");
                    onSuccess();
                    onClose();
                } else {
                    toast.error(data.message || "Payment failed");
                }
            }
        } catch (e) {
            console.error(e);
            toast.error(getErrorMessage(e, "Error processing payment"));
        } finally {
            setLoading(false);
        }
    };

    if (!installment) return null;

    return (
        <Modal open={open} onClose={onClose} className="bg-white dark:bg-gray-800 p-0 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Collect Installment</h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{orderRef} — {customerName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 border border-blue-100 dark:border-blue-900/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider">Month {installment.monthNumber}</p>
                            <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">Due Date: {installment.dueDate ? new Date(installment.dueDate).toLocaleDateString() : 'N/A'}</p>
                            {(installment.paidAmount || 0) > 0 && (
                                <p className="text-green-600 dark:text-green-400 text-xs font-medium mt-2 italic">
                                    Already Paid: PKR {installment.paidAmount?.toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-gray-500 dark:text-gray-400 text-xs uppercase font-medium">Monthly Amount</p>
                            <p className="text-gray-400 dark:text-gray-500 text-sm line-through">PKR {installment.dueAmount.toLocaleString()}</p>
                            <p className="text-blue-600 dark:text-blue-400 text-2xl font-bold mt-1">
                                PKR {(installment.dueAmount - (installment.paidAmount || 0)).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">Remaining Balance</p>
                        </div>
                    </div>
                </div>

                {!isOtpSent && isRecoveryOfficer ? (
                    <div className="text-center py-4">
                        <p className="text-gray-600 dark:text-gray-400 mb-6 px-4">An OTP will be sent to the customer's registered WhatsApp number for verification.</p>
                        <button
                            onClick={handleSendOtp}
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                        >
                            {loading ? "Sending..." : "Send OTP to Customer"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in max-h-[60vh] overflow-y-auto px-1">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                                <span>Collection Amount</span>
                                <span className="text-blue-500 font-normal normal-case opacity-80 text-[10px]">Editable — extra pays off next month(s)</span>
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={paymentAmount || ''}
                                onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                                className="w-full px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-700 dark:text-blue-400"
                                placeholder="Amount in PKR"
                            />
                        </div>
                        {isRecoveryOfficer && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Enter Verification OTP</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                    placeholder="4-6 digit OTP"
                                    maxLength={6}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="hidden">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Method</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                >
                                    <option value="Cash">Cash</option>
                                </select>
                            </div>
                            {isRecoveryOfficer && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fuel Charges (Optional)</label>
                                    <input
                                        type="number"
                                        value={fuelCharge}
                                        onChange={(e) => setFuelCharge(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        placeholder="0"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                                <span>Customer Feedback</span>
                            </label>
                            <textarea
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white min-h-[80px]"
                                placeholder="How was the customer's experience?"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                                <span>Alternate Number (Optional)</span>
                                <span className="text-gray-400 font-normal normal-case text-[10px]">For receiving SMS</span>
                            </label>
                            <input
                                type="text"
                                value={alternateNumber}
                                onChange={(e) => setAlternateNumber(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                placeholder="e.g. 03001234567"
                            />
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => {
                                    if(isRecoveryOfficer) setIsOtpSent(false);
                                    else onClose();
                                }}
                                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                            >
                                {isRecoveryOfficer ? "Back" : "Cancel"}
                            </button>
                            <button
                                onClick={handleVerifyAndPay}
                                disabled={loading}
                                className={`flex-[2] text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg dark:shadow-none disabled:opacity-50 bg-green-600 hover:bg-green-700 shadow-green-200`}
                            >
                                {loading 
                                    ? "Processing..." 
                                    : `Verify & Collect PKR ${(paymentAmount + (isRecoveryOfficer ? fuelCharge : 0)).toLocaleString()}`
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}