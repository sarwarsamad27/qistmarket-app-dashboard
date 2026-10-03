"use client";

import { useEffect, useState } from "react";
import { fetchAuthedObjectUrl } from "@/lib/employee-api";

interface Props {
  /** API path of the photo, e.g. "/employee/photo" or "/hr/employees/5/photo". */
  path: string;
  who: "employee" | "hr";
  name?: string | null;
  /** Tailwind size classes, e.g. "h-10 w-10 text-sm". */
  className?: string;
  /** Change it to reload the photo after a new upload. */
  version?: number;
}

const initials = (name?: string | null) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

/**
 * Employee profile photo (the "Photograph" HR uploaded), loaded through the
 * authenticated API; shows the employee's initials when there is none.
 */
export default function EmployeeAvatar({ path, who, name, className = "h-10 w-10 text-sm", version = 0 }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setSrc(null);
    fetchAuthedObjectUrl(path, who)
      .then((u) => { url = u; if (!cancelled) setSrc(u); else URL.revokeObjectURL(u); })
      .catch(() => {}); // no photo → initials
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [path, who, version]);

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name || "Employee"} className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${className}`}>
      {initials(name)}
    </span>
  );
}
