"use client";

// Shown instead of a blank/crashed screen when a page throws while rendering.
import { useEffect } from "react";
import Link from "next/link";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page crashed:", error);
  }, [error]);

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-dark">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30">
          <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-dark dark:text-white">
          {offline ? "You are offline" : "This page could not be displayed"}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {offline
            ? "Check your internet connection, then try again."
            : "An unexpected problem occurred while loading this page. Please try again; if it keeps happening, contact support."}
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-gray-400">Ref: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-[#ff3d3d] px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
