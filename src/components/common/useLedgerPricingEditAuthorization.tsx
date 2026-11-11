"use client";

import { useCallback, useRef, useState } from "react";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { Modal } from "@/components/Modal/Modal";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

type AuthorizedAction = () => void | Promise<void>;

const responseMessage = (body: any, fallback: string) =>
    typeof body?.message === "string" ? body.message : fallback;

export function useLedgerPricingEditAuthorization() {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [otp, setOtp] = useState("");
    const [challengeId, setChallengeId] = useState("");
    const [destination, setDestination] = useState("");
    const pendingAction = useRef<AuthorizedAction | null>(null);

    const close = useCallback(() => {
        if (busy) return;
        pendingAction.current = null;
        setOpen(false);
        setOtp("");
        setChallengeId("");
    }, [busy]);

    const sendOtp = useCallback(async () => {
        const token = Cookies.get("auth_token");
        if (!token) throw new Error("Authentication required");

        setBusy(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/ledger/edit-authorization/send-otp`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });
            const body = await response.json();
            if (!response.ok || !body.success) {
                throw new Error(responseMessage(body, "Could not send the OTP"));
            }
            if (body.authorized) {
                const action = pendingAction.current;
                pendingAction.current = null;
                setOpen(false);
                if (action) await action();
                return;
            }
            setChallengeId(body.data?.challenge_id || "");
            setDestination(body.data?.destination || "");
            toast.success(`OTP sent${body.data?.destination ? ` to ${body.data.destination}` : ""}`);
        } finally {
            setBusy(false);
        }
    }, []);

    const runWithAuthorization = useCallback(async (action: AuthorizedAction) => {
        const token = Cookies.get("auth_token");
        if (!token) {
            toast.error("Authentication required");
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/api/ledger/edit-authorization/status`, {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            });
            const body = await response.json();
            if (!response.ok || !body.success) {
                throw new Error(responseMessage(body, "Could not check edit authorization"));
            }
            if (body.data?.authorized) {
                await action();
                return;
            }

            pendingAction.current = action;
            setOtp("");
            setChallengeId("");
            setOpen(true);
            await sendOtp();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not authorize the edit");
        }
    }, [sendOtp]);

    const verifyOtp = async () => {
        const token = Cookies.get("auth_token");
        if (!token) {
            toast.error("Authentication required");
            return;
        }
        if (!challengeId || !/^\d{5}$/.test(otp)) {
            toast.error("Enter the 5-digit OTP");
            return;
        }

        setBusy(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/ledger/edit-authorization/verify-otp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ challenge_id: challengeId, otp }),
                cache: "no-store",
            });
            const body = await response.json();
            if (!response.ok || !body.success) {
                throw new Error(responseMessage(body, "OTP verification failed"));
            }

            toast.success(body.message || "OTP verified");
            const action = pendingAction.current;
            pendingAction.current = null;
            setOpen(false);
            setOtp("");
            setChallengeId("");
            if (action) await action();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "OTP verification failed");
        } finally {
            setBusy(false);
        }
    };

    const authorizationModal = (
        <Modal open={open} onClose={close}>
            <div className="w-full rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
                <h2 className="text-xl font-bold text-dark dark:text-white">Verify sensitive edit</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Enter the OTP sent to the designated Super Admin number
                    {destination ? <> ({destination})</> : ""}. One verification enables ledger and pricing edits
                    for 2 hours on this account.
                </p>
                <label className="mt-5 block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="ledger-pricing-edit-otp">
                    5-digit OTP
                </label>
                <input
                    id="ledger-pricing-edit-otp"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={5}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 5))}
                    disabled={busy}
                    className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                />
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <button
                        type="button"
                        onClick={close}
                        disabled={busy}
                        className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-dark-3 dark:text-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void sendOtp().catch((error) => toast.error(error instanceof Error ? error.message : "Could not resend OTP"))}
                        disabled={busy}
                        className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                    >
                        Resend OTP
                    </button>
                    <button
                        type="button"
                        onClick={() => void verifyOtp()}
                        disabled={busy || otp.length !== 5}
                        className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {busy ? "Please wait..." : "Verify and continue"}
                    </button>
                </div>
            </div>
        </Modal>
    );

    return { runWithAuthorization, authorizationModal };
}
