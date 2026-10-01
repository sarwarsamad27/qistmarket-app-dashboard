"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getRoleHome } from "@/lib/roleHome";

const ALLOWED_ROLES = [
  "csr",
  "sale officer",
  "sales officer",
  "sale_officer",
  "sales_officer",
];

export default function CsrLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      const role = user?.role?.toLowerCase() || "";
      if (!user || !ALLOWED_ROLES.includes(role)) {
        // Send them to their own dashboard (not "/", which would bounce
        // them a second time and flash the admin dashboard).
        router.replace(user ? getRoleHome(role) : "/login");
      }
    }
  }, [loading, user, router]);

  // Keep showing the loader while an unauthorized user is being redirected
  // to their own dashboard, instead of flashing an "Access Denied" box.
  const role = user?.role?.toLowerCase() || "";
  if (loading || !user || !ALLOWED_ROLES.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-gray-700 dark:bg-slate-900 dark:text-gray-200">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 shadow-md dark:border-gray-800 dark:bg-gray-900">
          <p className="text-lg font-semibold">Loading CSR access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
