"use client";

import { ReactNode, useEffect } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getRoleHome } from "@/lib/roleHome";

const ALLOWED = ["hr", "admin", "super admin"];

export default function HrLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      const role = user?.role?.toLowerCase() || "";
      if (!user || !ALLOWED.includes(role)) {
        // Send them to their own dashboard (not "/", which would bounce
        // them a second time and flash the admin dashboard).
        router.replace(user ? getRoleHome(role) : "/login");
      }
    }
  }, [loading, user, router]);

  // Keep showing the loader while an unauthorized user is being redirected
  // to their own dashboard, instead of flashing an "Access Denied" box.
  const role = user?.role?.toLowerCase() || "";
  if (loading || !user || !ALLOWED.includes(role)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-lg font-semibold">Loading HR access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
