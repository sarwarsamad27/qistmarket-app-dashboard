"use client";

import { useAuth } from "../../contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { canSubAdminOpen, firstAllowedSubAdminPage, isSubAdmin } from "@/lib/subAdminPermissions";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/";

  const subAdminBlocked = !!user && isSubAdmin(user) && !canSubAdminOpen(user, pathname);
  const fallbackPage = user && isSubAdmin(user) ? firstAllowedSubAdminPage(user) : null;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // A Sub Admin landing on the dashboard home without access to it (e.g. straight
  // after login) goes to the first page they do have instead of a blocked screen.
  useEffect(() => {
    if (subAdminBlocked && pathname === "/" && fallbackPage && fallbackPage !== "/") {
      router.replace(fallbackPage);
    }
  }, [subAdminBlocked, pathname, fallbackPage, router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) return null;

  if (subAdminBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-gray-dark">
          <h2 className="mb-2 text-xl font-bold text-dark dark:text-white">No access to this page</h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Your Sub Admin account doesn&apos;t include this section. Ask a Super Admin to grant it.
          </p>
          {fallbackPage ? (
            <Link href={fallbackPage} className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-opacity-90">
              Go to an allowed page
            </Link>
          ) : (
            <p className="text-sm font-semibold text-red-600">No pages have been granted to this account yet.</p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
