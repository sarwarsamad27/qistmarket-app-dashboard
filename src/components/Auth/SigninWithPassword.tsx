"use client";

import {
  UserIcon,
} from "@/assets/icons";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import InputGroup from "../FormElements/InputGroup";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { KeyIcon } from "lucide-react";
import { getRoleHome } from "@/lib/roleHome";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

const TabButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 py-3 text-sm font-medium transition-all ${active
      ? "border-b-2 border-[#ff3d3d] text-[#ff3d3d]"
      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
  >
    {label}
  </button>
);

export default function SigninWithOTP() {
  const router = useRouter();

  const [data, setData] = useState({
    identifier: "",
    otp: "",
    remember: false,
    outlet_code: "",
    username: "",
    password: "",
    totp_code: "",
  });

  const [loginType, setLoginType] = useState<"web" | "outlet" | "hr" | "accountant">("web");

  const [step, setStep] = useState<"identifier" | "otp">("identifier");
  const [deviceId, setDeviceId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [web2FAPrompt, setWeb2FAPrompt] = useState(false);
  const [accountant2FAPrompt, setAccountant2FAPrompt] = useState(false);

  useEffect(() => {
    const generateDeviceId = () => {
      let id = localStorage.getItem("device_id");

      if (!id) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.textBaseline = "top";
          ctx.font = "14px Arial";
          ctx.fillStyle = "#f60";
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = "#069";
          ctx.fillText("Device Fingerprint 😊", 2, 15);
        }

        const fingerprintData = [
          navigator.userAgent,
          navigator.language || navigator.languages?.[0],
          screen.width + "x" + screen.height,
          screen.colorDepth,
          new Date().getTimezoneOffset(),
          !!navigator.hardwareConcurrency ? navigator.hardwareConcurrency : "",
          canvas.toDataURL ? canvas.toDataURL() : "",
        ].join("|||");

        let hash = 0;
        for (let i = 0; i < fingerprintData.length; i++) {
          const char = fingerprintData.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }

        id = "web-" + Math.abs(hash).toString(36).substring(0, 14).padEnd(14, "0");
        localStorage.setItem("device_id", id);
      }

      setDeviceId(id);
    };

    generateDeviceId();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    });
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.identifier) {
      toast.error("Please enter your email, username, CNIC or phone.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/login/web/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: data.identifier }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Failed to send OTP.");

      toast.success(result.message || "OTP sent successfully.");
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.otp) {
      toast.error("Please enter the 5-digit OTP.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/login/web/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: data.identifier,
          otp: data.otp,
          "device-id": deviceId,
          totp_code: data.totp_code || undefined,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || "Login failed.");

      if (result.requires2FA) {
        setWeb2FAPrompt(true);
        toast(result.message || "Enter your 2FA code to continue.");
        return;
      }

      toast.success(result.message);
      Cookies.set("auth_token", result.token, {
        expires: 30, // Default to 30 days
        path: "/",
      });
      localStorage.setItem("user", JSON.stringify(result.user));
      localStorage.setItem("token", result.token);
      router.push(getRoleHome(result.user?.role));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOutletLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { outlet_code, username, password } = data;
    if (!outlet_code || !username || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/outlet/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlet_code, username, password }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Login failed.");

      toast.success("Outlet login successful.");
      Cookies.set("auth_token", result.token, {
        expires: 30,
        path: "/",
      });
      localStorage.setItem("user", JSON.stringify(result.user));
      localStorage.setItem("token", result.token);
      router.push("/outlet/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = data;
    if (!username || !password) {
      toast.error("Please enter username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/hr/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Login failed.");

      toast.success("HR login successful.");
      Cookies.set("auth_token", result.token, {
        expires: 30,
        path: "/",
      });
      localStorage.setItem("user", JSON.stringify(result.user));
      localStorage.setItem("token", result.token);
      router.push("/hr/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { username, password } = data;
    if (!username || !password) {
      toast.error("Please enter username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/accounts/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, totp_code: data.totp_code || undefined }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Login failed.");

      if (result.requires2FA) {
        setAccountant2FAPrompt(true);
        toast(result.message || "Enter your 2FA code to continue.");
        return;
      }

      toast.success("Accountant login successful.");
      Cookies.set("auth_token", result.token, {
        expires: 30,
        path: "/",
      });
      localStorage.setItem("user", JSON.stringify(result.user));
      localStorage.setItem("token", result.token);
      router.push("/accounts/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex border-b border-gray-100 dark:border-gray-800">
        <TabButton
          active={loginType === "web"}
          label="Web OTP Login"
          onClick={() => setLoginType("web")}
        />
        <TabButton
          active={loginType === "outlet"}
          label="Outlet Login"
          onClick={() => setLoginType("outlet")}
        />
        <TabButton
          active={loginType === "hr"}
          label="HR Login"
          onClick={() => setLoginType("hr")}
        />
        <TabButton
          active={loginType === "accountant"}
          label="Accountant Login"
          onClick={() => setLoginType("accountant")}
        />
      </div>

      {loginType === "web" ? (
        step === "identifier" ? (
          <form onSubmit={handleSendOTP}>
            <InputGroup
              type="text"
              label="Phone Number or Email"
              className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
              placeholder="Phone Number or Email"
              name="identifier"
              handleChange={handleChange}
              value={data.identifier}
              icon={<UserIcon />}
            />

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff3d3d] p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Continue"}
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <p className="mb-6 text-sm text-gray-600">
              OTP has been sent to <strong>{data.identifier}</strong>. Please enter the 5-digit code below.
            </p>

            <InputGroup
              type="text"
              label="Verification Code"
              className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
              placeholder="Enter 5-digit OTP"
              name="otp"
              handleChange={handleChange}
              value={data.otp}
              icon={<KeyIcon className="h-5 w-5" />}
            />

            {web2FAPrompt && (
              <InputGroup
                type="text"
                label="2FA Code"
                className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
                placeholder="6-digit authenticator code"
                name="totp_code"
                handleChange={handleChange}
                value={data.totp_code}
                icon={<KeyIcon className="h-5 w-5" />}
              />
            )}

            <div className="mb-4.5 flex gap-4">
              <button
                type="button"
                onClick={() => setStep("identifier")}
                className="flex flex-1 items-center justify-center rounded-lg border border-stroke bg-white p-4 font-medium text-dark transition hover:bg-gray-50 focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 rounded-lg bg-[#ff3d3d] p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Login"}
                {loading && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>
            </div>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="text-[#ff3d3d] hover:underline font-medium disabled:opacity-50"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )
      ) : loginType === "hr" ? (
        <form onSubmit={handleHrLogin}>
          <InputGroup
            type="text"
            label="Username"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="Username"
            name="username"
            handleChange={handleChange}
            value={data.username}
            icon={<UserIcon />}
          />

          <InputGroup
            type="password"
            label="Password"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="Password"
            name="password"
            handleChange={handleChange}
            value={data.password}
            icon={<KeyIcon className="h-5 w-5" />}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff3d3d] p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login to HR Dashboard"}
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
            )}
          </button>
        </form>
      ) : loginType === "accountant" ? (
        <form onSubmit={handleAccountantLogin}>
          <InputGroup
            type="text"
            label="Username"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="Username"
            name="username"
            handleChange={handleChange}
            value={data.username}
            icon={<UserIcon />}
          />

          <InputGroup
            type="password"
            label="Password"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="Password"
            name="password"
            handleChange={handleChange}
            value={data.password}
            icon={<KeyIcon className="h-5 w-5" />}
          />

          {accountant2FAPrompt && (
            <InputGroup
              type="text"
              label="2FA Code"
              className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
              placeholder="6-digit authenticator code"
              name="totp_code"
              handleChange={handleChange}
              value={data.totp_code}
              icon={<KeyIcon className="h-5 w-5" />}
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff3d3d] p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login to Accounts Dashboard"}
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOutletLogin}>
          <InputGroup
            type="text"
            label="Outlet Code"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="e.g. OUT-001"
            name="outlet_code"
            handleChange={handleChange}
            value={data.outlet_code}
            icon={<UserIcon />}
          />

          <InputGroup
            type="text"
            label="Username"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="Username"
            name="username"
            handleChange={handleChange}
            value={data.username}
            icon={<UserIcon />}
          />

          <InputGroup
            type="password"
            label="Password"
            className="mb-6 [&_input]:py-[15px] [&_input]:pr-12"
            placeholder="Password"
            name="password"
            handleChange={handleChange}
            value={data.password}
            icon={<KeyIcon className="h-5 w-5" />}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff3d3d] p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login to Outlet"}
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}
