"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useEffect, useState } from "react";
import { NAV_DATA } from "./data";
import { ArrowLeftIcon, ChevronUp } from "./icons";
import { MenuItem } from "./menu-item";
import { useSidebarContext } from "./sidebar-context";
import { useAuth } from "../../../../contexts/AuthContext"; // Added AuthContext
import { canSubAdminOpen, isSubAdmin } from "@/lib/subAdminPermissions";
import { getRoleHome, OUTLET_ONLY_ROLES } from "@/lib/roleHome";

export function Sidebar() {
  const pathname = usePathname();
  const { setIsOpen, isOpen, isMobile, toggleSidebar } = useSidebarContext();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { user } = useAuth(); // Get current user
  const userRole = user?.role?.toLowerCase() || "";

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) => (prev.includes(title) ? [] : [title]));
  };

  useEffect(() => {
    // Keep collapsible open when its subpage is active (for standard sections)
    NAV_DATA.some((section: any) => {
      return section.items.some((item: any) => {
        return item.items?.some((subItem: any) => {
          if (subItem.url === pathname) {
            if (!expandedItems.includes(item.title)) {
              toggleExpanded(item.title);
            }
            return true;
          }
        });
      });
    });
  }, [pathname]);

  // Filter navigation data based on user role
  const outletOnlyRoles = OUTLET_ONLY_ROLES;

  const filteredNavData = NAV_DATA.filter((section) => {
    const allowedRoles = ["sales officer"];

    if (allowedRoles.includes(userRole)) {
      return section.label === "CSR PORTAL";
    }

    if (userRole === "hr") {
      return section.label === "HR PORTAL";
    }

    if (section.label === "OUTLET PORTAL" && (userRole === "admin" || userRole === "super admin")) {
      return false;
    }
    if (section.label === "CSR PORTAL" && (userRole === "admin" || userRole === "super admin" || outletOnlyRoles.includes(userRole))) {
      return false;
    }

    if (section.label === "HR PORTAL" && userRole !== "hr" && userRole !== "admin") {
      return false;
    }

    if (section.label === "ACCOUNTS PORTAL" && userRole !== "accountant") {
      return false;
    }

    if (section.label !== "ACCOUNTS PORTAL" && userRole === "accountant") {
      return false;
    }

    if (section.label === "MAIN MENU" && outletOnlyRoles.includes(userRole)) {
      return false;
    }

    return true;
  }).map((section) => {

    const filteredItems = section.items.filter((item) => {
      if (item.title === "Orders for Approval") {
         if (userRole === "formanalyzer" || userRole === "form analyzer" || userRole === "form_analyzer" || userRole === "admin" || userRole === "super admin") {
           return true;
         }
         return false;
      }

      return true;
    })
      .map((item: any) => {
        if (!isSubAdmin(user)) return item;
        if (item.items && item.items.length > 0) {
          const subs = item.items.filter((sub: any) => canSubAdminOpen(user, sub.url));
          return subs.length > 0 ? { ...item, items: subs } : null;
        }
        return canSubAdminOpen(user, item.url) ? item : null;
      })
      .filter(Boolean);

    return { ...section, items: filteredItems };
  })
    .filter((section) => !isSubAdmin(user) || section.items.length > 0);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "max-w-[290px] shrink-0 overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-linear dark:border-gray-800 dark:bg-gray-dark",
          isMobile ? "fixed bottom-0 top-0 z-50" : "sticky top-0 h-screen z-40",
          isOpen ? "w-full" : "w-0",
        )}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="flex h-full flex-col py-10 pl-[25px] pr-[7px]">
          <div className="relative pr-4.5">
            <Link
              href={getRoleHome(userRole)}
              onClick={() => isMobile && toggleSidebar()}
              className="px-0 py-2.5 min-[850px]:py-0"
            >
              <Logo />
            </Link>

            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="absolute left-3/4 right-4.5 top-1/2 -translate-y-1/2 text-right"
              >
                <span className="sr-only">Close Menu</span>
                <ArrowLeftIcon className="ml-auto size-7" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="custom-scrollbar mt-6 flex-1 overflow-y-auto pr-3 min-[850px]:mt-10">
            {filteredNavData.map((section) => (
              <div key={section.label} className="mb-6">
                <h2 className="mb-5 text-sm font-medium text-dark-4 dark:text-dark-6">
                  {section.label}
                </h2>

                <nav role="navigation" aria-label={section.label}>
                  <ul className="space-y-2">
                    {section.items.map((item) => {
                      const isAccountsSection = section.label === "ACCOUNTS PORTAL";
                      const hasSubItems = (item as any).items && (item as any).items.length > 0;

                      if (hasSubItems && isAccountsSection) {
                        // ACCOUNTS PORTAL: Permanently open all items
                        return (
                          <li key={item.title} className="mb-3">
                            <div className="flex items-center gap-3 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-dark-4 dark:text-dark-6">
                              <item.icon
                                className="size-5 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                              <span>{item.title}</span>
                            </div>

                            <ul className="ml-6 space-y-1 pt-1" role="menu">
                              {(item as any).items.map((subItem: any) => (
                                <li key={subItem.title} role="none">
                                  <MenuItem
                                    as="link"
                                    href={subItem.url}
                                    isActive={pathname === subItem.url}
                                  >
                                    <span>{subItem.title}</span>
                                  </MenuItem>
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      }

                      if (hasSubItems) {
                        // OTHER SECTIONS: Standard collapsible dropdown accordion
                        return (
                          <li key={item.title}>
                            <div>
                              <MenuItem
                                isActive={(item as any).items.some(
                                  ({ url }: any) => url === pathname,
                                )}
                                onClick={() => toggleExpanded(item.title)}
                              >
                                <item.icon
                                  className="size-6 shrink-0"
                                  aria-hidden="true"
                                />

                                <span>{item.title}</span>

                                <ChevronUp
                                  className={cn(
                                    "ml-auto rotate-180 transition-transform duration-200",
                                    expandedItems.includes(item.title) &&
                                      "rotate-0",
                                  )}
                                  aria-hidden="true"
                                />
                              </MenuItem>

                              {expandedItems.includes(item.title) && (
                                <ul
                                  className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
                                  role="menu"
                                >
                                  {(item as any).items.map((subItem: any) => (
                                    <li key={subItem.title} role="none">
                                      <MenuItem
                                        as="link"
                                        href={subItem.url}
                                        isActive={pathname === subItem.url}
                                      >
                                        <span>{subItem.title}</span>
                                      </MenuItem>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </li>
                        );
                      }

                      // Single item link
                      const href =
                        "url" in item
                          ? item.url + ""
                          : "/" +
                            item.title.toLowerCase().split(" ").join("-");

                      return (
                        <li key={item.title}>
                          <MenuItem
                            className="flex items-center gap-3 py-3"
                            as="link"
                            href={href}
                            isActive={pathname === href}
                          >
                            <item.icon
                              className="size-6 shrink-0"
                              aria-hidden="true"
                            />

                            <span>{item.title}</span>
                          </MenuItem>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
