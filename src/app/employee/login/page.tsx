"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import InputGroup from "@/components/FormElements/InputGroup";
import { UserIcon } from "@/assets/icons";
import { KeyIcon } from "lucide-react";
import { useEmployeeAuth } from "../../../../contexts/EmployeeAuthContext";
import { useEffect } from "react";
import { apiErrorMessage } from "@/lib/apiErrors";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function EmployeeLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading, setUser } = useEmployeeAuth();

  useEffect(() => {
    if (!authLoading && user) router.replace("/employee/dashboard");
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(await apiErrorMessage(res, "Login failed", data));

      Cookies.set("employee_auth_token", data.token, { expires: 7 });
      setUser(data.user);
      toast.success("Welcome back!");
      router.push("/employee/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-2 px-4 dark:bg-[#000000]">
      <div className="w-full max-w-md rounded-2xl border border-stroke bg-white p-8 shadow-lg dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-dark dark:text-white">QIST Market</h1>
          <p className="mt-1 text-sm text-gray-500">Employee Self-Service Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <InputGroup
            type="text"
            label="Employee ID or Username"
            placeholder="QMK-2026-0001"
            value={identifier}
            handleChange={(e) => setIdentifier(e.target.value)}
            icon={<UserIcon />}
          />
          <InputGroup
            type="password"
            label="Password"
            placeholder="Enter password"
            value={password}
            handleChange={(e) => setPassword(e.target.value)}
            icon={<KeyIcon className="h-5 w-5" />}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Forgot password? Please contact your HR department.
        </p>
      </div>
    </div>
  );
}
