"use client";

// Shared loading placeholders. Rule of thumb across the dashboard: while data
// is loading show one of these — never a default 0 / "No records" — and if
// the load failed show "—" / a retry note instead of a fake empty value.

/** Inline shimmer for a single figure; "—" when the figure failed to load. */
export function ValueSkeleton({ failed = false, className = "h-6 w-24" }: { failed?: boolean; className?: string }) {
  if (failed) {
    return (
      <span title="Could not load this figure" className="text-gray-400">
        —
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-pulse rounded bg-gray-200 align-middle dark:bg-dark-3 ${className}`}
    />
  );
}

/** Shimmer rows for a list/panel; a retry note when the load failed. */
export function ListSkeleton({ rows = 4, failed = false }: { rows?: number; failed?: boolean }) {
  if (failed) {
    return (
      <p className="py-6 text-center text-xs text-gray-400">
        Could not load this section. Retrying automatically…
      </p>
    );
  }
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-stroke bg-gray-50 p-3 dark:border-dark-3 dark:bg-dark-3"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="h-3 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-dark-2" />
          <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-dark-2" />
        </div>
      ))}
    </div>
  );
}

/** Shimmer rows inside a <tbody>. */
export function TableRowsSkeleton({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-stroke last:border-0 dark:border-dark-3" role="status" aria-label="Loading">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-3">
              <div
                className="h-3 w-full max-w-[120px] animate-pulse rounded bg-gray-200 dark:bg-dark-3"
                style={{ animationDelay: `${(r + c) * 40}ms` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
