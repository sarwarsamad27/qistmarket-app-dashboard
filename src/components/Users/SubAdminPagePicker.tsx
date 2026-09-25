"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { NAV_DATA } from "@/components/Layouts/sidebar/data";
import { ALL_SUB_ADMIN_PAGE_URLS } from "@/lib/subAdminPermissions";

type PickerItem = { title: string; url: string };
type PickerGroup = { title: string; icon?: any; items: PickerItem[] };

/**
 * Built straight from the sidebar's MAIN MENU (the Super Admin menu), in the same
 * order, with the same names and icons — so what a Super Admin ticks here is exactly
 * what they see in their own sidebar. Every page is listed except Create Users.
 */
function buildGroups(): PickerGroup[] {
  const grantable = new Set(ALL_SUB_ADMIN_PAGE_URLS);
  const main = (NAV_DATA as any[]).find((s) => s.label === "MAIN MENU");
  const groups: PickerGroup[] = [];
  for (const item of main?.items || []) {
    const children: PickerItem[] = item.items && item.items.length
      ? item.items.map((sub: any) => ({ title: sub.title, url: sub.url }))
      : [{ title: item.title, url: item.url }];
    const items = children.filter((c) => grantable.has(c.url));
    if (items.length) groups.push({ title: item.title, icon: item.icon, items });
  }
  return groups;
}

/**
 * Ticked = the Sub Admin can open that page (and use the APIs behind it);
 * unticked = hidden from their sidebar and blocked.
 */
export default function SubAdminPagePicker({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (pages: string[]) => void;
  error?: string;
}) {
  const groups = useMemo(buildGroups, []);
  const allUrls = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.url)), [groups]);
  const selected = new Set(value);

  const setMany = (urls: string[], on: boolean) => {
    const next = new Set(selected);
    urls.forEach((u) => (on ? next.add(u) : next.delete(u)));
    onChange(allUrls.filter((u) => next.has(u))); // keep sidebar order
  };

  return (
    <div className={`mt-4 rounded-xl border-2 ${error ? "border-red-400" : "border-gray-200"} bg-white`}>
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b border-gray-100 bg-white px-4 py-3">
        <div>
          <p className="font-semibold text-gray-900">Page Access</p>
          <p className="text-xs text-gray-500">
            Same menu as your sidebar. Tick what this Sub Admin can open — anything left unticked stays hidden and blocked for them.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-gray-700">{value.length} / {allUrls.length} selected</span>
          <button type="button" onClick={() => setMany(allUrls, true)} className="font-semibold text-[#ff3d3d] hover:underline">
            Select all
          </button>
          <button type="button" onClick={() => setMany(allUrls, false)} className="font-semibold text-gray-500 hover:underline">
            Clear
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {groups.map((g) => {
          const urls = g.items.map((i) => i.url);
          const count = urls.filter((u) => selected.has(u)).length;
          const single = g.items.length === 1 && g.items[0].title === g.title;
          const Icon = g.icon;
          return (
            <div key={g.title} className="px-4 py-3">
              <TriCheckbox
                checked={count === urls.length}
                indeterminate={count > 0 && count < urls.length}
                onChange={(on) => setMany(urls, on)}
              >
                {Icon && <Icon className="size-5 shrink-0 text-gray-500" aria-hidden="true" />}
                <span className="font-semibold text-gray-900">{g.title}</span>
                {!single && <span className="ml-auto text-xs text-gray-400">{count}/{urls.length}</span>}
              </TriCheckbox>
              {!single && (
                <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 pl-12 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((p) => (
                    <label key={p.url} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selected.has(p.url)}
                        onChange={(e) => setMany([p.url], e.target.checked)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-[#ff3d3d]"
                      />
                      {p.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
        Not available to Sub Admins: Create Users. With User List / Permissions they can manage staff accounts, but never Super Admin, Admin or Sub Admin accounts (their own included), and they can't give anyone those roles.
      </p>
      {error && <p className="px-4 pb-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function TriCheckbox({
  checked, indeterminate, onChange, children,
}: { checked: boolean; indeterminate: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[#ff3d3d]"
      />
      {children}
    </label>
  );
}
