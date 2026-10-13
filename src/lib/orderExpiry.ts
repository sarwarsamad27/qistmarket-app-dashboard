// Helpers for describing why/when an order auto-expired. The backend expiry
// job stamps expired_from_status / expired_status_since / expired_at on the order.

export type ExpiryFields = {
  status?: string | null;
  expired_at?: string | null;
  expired_from_status?: string | null;
  expired_status_since?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  transferred: "Transferred",
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  approved: "Approved",
};

export function expiredFromLabel(status?: string | null): string | null {
  if (!status) return null;
  const key = status.toLowerCase();
  return STATUS_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatExpiryDuration(ms: number): string {
  const totalHours = Math.max(0, Math.floor(ms / 3_600_000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days && hours) return `${days} day${days === 1 ? "" : "s"} ${hours} hr`;
  if (days) return `${days} day${days === 1 ? "" : "s"}`;
  return `${hours} hr`;
}

/** e.g. "from Pending · after 4 days 3 hr" — null when the order isn't expired or has no details. */
export function describeExpiry(order: ExpiryFields | null | undefined): string | null {
  if (!order || order.status?.toLowerCase() !== "expired") return null;
  const from = expiredFromLabel(order.expired_from_status);
  const parts: string[] = [];
  if (from) parts.push(`from ${from}`);
  if (order.expired_at && order.expired_status_since) {
    const ms = new Date(order.expired_at).getTime() - new Date(order.expired_status_since).getTime();
    if (!Number.isNaN(ms)) parts.push(`after ${formatExpiryDuration(ms)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
