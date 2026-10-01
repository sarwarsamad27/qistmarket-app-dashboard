import { useState, useEffect } from 'react';
import { Modal } from '../Modal/Modal';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { InstallmentLedgerEditor } from '../Installments/InstallmentLedgerEditor';
import { apiErrorMessage } from "@/lib/apiErrors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

interface DeliveryActionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number | null;
    actionType: 'deliver' | 'return' | 'refund' | null;
    onSuccess: () => void;
}

export const DeliveryActionsModal = ({
    isOpen,
    onClose,
    orderId,
    actionType,
    onSuccess,
}: DeliveryActionsModalProps) => {
    const [remarks, setRemarks] = useState('');
    const [returnReason, setReturnReason] = useState('');
    const [otp, setOtp] = useState('');
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);
    const [customLedger, setCustomLedger] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && orderId && actionType === 'deliver') {
            fetchOrderDetails();
        }
    }, [isOpen, orderId, actionType]);

    const fetchOrderDetails = async () => {
        try {
            const token = Cookies.get('auth_token');
            const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (json.success) {
                setOrderData(json.data.order);
            }
        } catch (error) {
            console.error('Failed to fetch order details:', error);
        }
    };

    const handleSendOtp = async () => {
        if (!orderId) return;
        setIsSendingOtp(true);
        try {
            const token = Cookies.get('auth_token');
            const endpoint = actionType === 'deliver'
                ? `${BACKEND_URL}/api/delivery/generate-otp`
                : `${BACKEND_URL}/api/delivery/refund/generate-otp`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ order_id: orderId }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(await apiErrorMessage(res, "Failed to send OTP", data));

            setIsOtpSent(true);
            toast.success('OTP sent to customer successfully');
        } catch (error: any) {
            toast.error(error.message || 'Failed to send OTP');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleSubmit = async () => {
        if (!orderId || !actionType) return;

        if (actionType === 'return' && !returnReason) {
            toast.error('Please select a reason for return');
            return;
        }

        if ((actionType === 'deliver' || actionType === 'refund') && !otp) {
            toast.error('Please enter the OTP provided by the customer');
            return;
        }

        setIsSubmitting(true);

        try {
            const token = Cookies.get('auth_token');
            let endpoint = '';
            let body: any = { order_id: orderId };

            if (actionType === 'deliver') {
                endpoint = `${BACKEND_URL}/api/delivery/verify-otp`;
                body.otp = otp;
                if (customLedger && customLedger.length > 0) {
                    body.custom_ledger = customLedger;
                }
            } else if (actionType === 'refund') {
                endpoint = `${BACKEND_URL}/api/delivery/refund/verify-otp`;
                body.otp = otp;
            } else if (actionType === 'return') {
                endpoint = `${BACKEND_URL}/api/delivery/return`;
                body.reason = returnReason;
                body.remarks = remarks;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                if (data.valid === false) {
                    throw new Error(data.message || 'Invalid OTP');
                }
                throw new Error(data.error?.message || data.message || 'Action failed');
            }

            toast.success(
                actionType === 'deliver'
                    ? 'Order delivered successfully'
                    : actionType === 'refund'
                        ? 'Refund processed successfully'
                        : 'Order marked as Returned'
            );
            onSuccess();
            onClose();
            // Reset state
            setOtp('');
            setIsOtpSent(false);
            setReturnReason('');
            setRemarks('');
        } catch (error: any) {
            console.error('Delivery action error:', error);
            toast.error(error.message || 'Failed to process request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleModalClose = () => {
        setOtp('');
        setIsOtpSent(false);
        setReturnReason('');
        setRemarks('');
        onClose();
    };

    return (
        <Modal
            open={isOpen}
            onClose={handleModalClose}
            className="max-w-2xl rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-800"
        >
            <h2 className="mb-4 text-xl font-bold text-dark dark:text-white">
                {actionType === 'deliver' ? 'Confirm Delivery' : actionType === 'refund' ? 'Process Refund' : 'Mark as Returned'}
            </h2>

            <div className="space-y-5">
                {actionType === 'return' && (
                    <div>
                        <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Reason for Return *
                        </label>
                        <select
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                        >
                            <option value="">Select Reason</option>
                            <option value="Customer Not Available">Customer Not Available</option>
                            <option value="Refused to Accept">Refused to Accept</option>
                            <option value="Wrong Address">Wrong Address</option>
                            <option value="Damaged Item">Damaged Item</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                )}

                {(actionType === 'deliver' || actionType === 'refund') && (
                    <div className="rounded-xl bg-gray-50 p-4 dark:bg-meta-4/20 border border-dashed border-stroke dark:border-strokedark">
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                Verify with OTP *
                            </label>
                            <button
                                onClick={handleSendOtp}
                                disabled={isSendingOtp || isSubmitting}
                                className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                            >
                                {isSendingOtp ? 'Sending...' : isOtpSent ? 'Resend OTP' : 'Send OTP'}
                            </button>
                        </div>
                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 6-digit OTP"
                            className="w-full rounded-lg border border-stroke bg-white py-3 px-4 text-center text-2xl font-black tracking-widest outline-none focus:border-primary dark:border-strokedark dark:bg-boxdark"
                        />
                        <p className="mt-2 text-[10px] text-gray-500 text-center font-medium">
                            Ask the customer for the verification code sent to their phone.
                        </p>
                    </div>
                )}

                {actionType === 'deliver' && orderData && (
                    <div className="mt-4 pt-4 border-t border-stroke dark:border-strokedark">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                Review Installment Ledger
                            </label>
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded font-bold uppercase">
                                Editable
                            </span>
                        </div>
                        <InstallmentLedgerEditor
                            totalPrice={orderData.total_amount}
                            advance={orderData.advance_amount}
                            months={orderData.months}
                            monthlyAmount={orderData.monthly_amount}
                            onLedgerChange={(ledger) => setCustomLedger(ledger)}
                        />
                    </div>
                )}

                <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                        Remarks (Optional)
                    </label>
                    <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 outline-none focus:border-primary dark:border-strokedark dark:bg-meta-4"
                        rows={3}
                        placeholder="Add any additional notes..."
                    />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={handleModalClose}
                        disabled={isSubmitting}
                        className="flex-1 rounded-lg border border-stroke py-3 font-bold text-dark hover:bg-gray-100 disabled:opacity-50 dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || ((actionType === 'deliver' || actionType === 'refund') && !otp)}
                        className={`flex-1 rounded-lg py-3 font-bold text-white shadow-md transition disabled:opacity-50 ${actionType === 'deliver'
                            ? 'bg-success hover:bg-opacity-90'
                            : actionType === 'refund'
                                ? 'bg-blue-600 hover:bg-opacity-90'
                                : 'bg-red-600 hover:bg-opacity-90'
                            }`}
                    >
                        {isSubmitting ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
