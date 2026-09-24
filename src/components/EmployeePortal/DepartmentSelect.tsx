"use client";

import { useEffect, useState } from "react";
import { hrFetch } from "@/lib/employee-api";

// Suggested on a fresh install before any employee has a department; every
// department already in use is added to the list automatically.
const DEFAULT_DEPARTMENTS = ["Accounts", "Delivery", "HR", "IT", "Operations", "Recovery", "Sales", "Verification"];
const ADD_NEW = "__add_new__";

interface Props {
  /** Controlled value (Add Employee form). */
  value?: string;
  onChange?: (value: string) => void;
  /** Uncontrolled use inside a <form> read with FormData (Edit Profile). */
  name?: string;
  defaultValue?: string;
  className?: string;
}

/**
 * Department picker: pick an existing department from the list, or choose
 * "+ Add new department" to type one. A typed name that matches an existing
 * department (ignoring case/spaces) snaps to that spelling, so "sales" and
 * "Sales " don't end up as two departments.
 */
export default function DepartmentSelect({ value, onChange, name, defaultValue, className }: Props) {
  const [options, setOptions] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [internal, setInternal] = useState(value ?? defaultValue ?? "");
  const [custom, setCustom] = useState(false);
  const current = value ?? internal;

  useEffect(() => {
    hrFetch("/employees")
      .then((r) => {
        const used = (r.employees || []).map((e: { department?: string | null }) => e.department?.trim()).filter(Boolean) as string[];
        setOptions((prev) => mergeUnique([...prev, ...used]));
      })
      .catch(() => {});
  }, []);

  // Keep an already-saved department selectable even if it isn't in the list.
  const allOptions = current && !custom ? mergeUnique([...options, current]) : options;

  const set = (v: string) => {
    setInternal(v);
    onChange?.(v);
  };

  const finishCustom = () => {
    const typed = current.trim().replace(/\s+/g, " ");
    const match = options.find((o) => o.toLowerCase() === typed.toLowerCase());
    set(match || typed);
    if (typed) {
      setOptions((prev) => mergeUnique([...prev, match || typed]));
      setCustom(false);
    }
  };

  const base = className || "w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-stroke-dark dark:bg-dark-3";

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      {custom ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={current}
            onChange={(e) => set(e.target.value)}
            onBlur={finishCustom}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); finishCustom(); } }}
            placeholder="New department name"
            className={base}
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { set(""); setCustom(false); }}
            className="shrink-0 rounded-lg border border-stroke px-3 text-xs text-gray-500 dark:border-stroke-dark"
          >
            Cancel
          </button>
        </div>
      ) : (
        <select
          value={current}
          onChange={(e) => {
            if (e.target.value === ADD_NEW) { set(""); setCustom(true); } else set(e.target.value);
          }}
          className={base}
        >
          <option value="">— Select department —</option>
          {allOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value={ADD_NEW}>+ Add new department…</option>
        </select>
      )}
    </>
  );
}

function mergeUnique(list: string[]) {
  const seen = new Map<string, string>();
  for (const d of list) {
    const clean = d.trim();
    if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
