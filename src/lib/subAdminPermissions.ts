/**
 * Sub Admin page access — frontend side.
 *
 * A Sub Admin is a Super Admin limited to the pages a Super Admin ticks for them.
 * Their token carries role "Super Admin" + is_sub_admin + sub_admin_pages; the backend enforces
 * the same list on every API call (qistmarket-app-backend/src/config/subAdminPermissions.js).
 * This file only decides what the sidebar shows and which pages open.
 *
 * Keep SUB_ADMIN_PAGE_CATALOG identical to PAGE_CATALOG in the backend file above.
 */

export type SubAdminPage = { url: string; title: string };
export type SubAdminGroup = { group: string; pages: SubAdminPage[] };

export const SUB_ADMIN_ROLE = "Sub Admin";

export const SUB_ADMIN_PAGE_CATALOG: SubAdminGroup[] = [
  { group: "Main Dashboard", pages: [{ url: "/", title: "Main Dashboard" }] },
  {
    group: "Orders",
    pages: [
      { url: "/create-orders", title: "Create Orders" },
      { url: "/all-orders", title: "All Orders" },
      { url: "/new-orders", title: "New Orders" },
      { url: "/pending-orders", title: "Pending Orders" },
      { url: "/in-progress-orders", title: "In Progress Orders" },
      { url: "/cancelled-orders", title: "Cancelled Orders" },
      { url: "/completed-orders", title: "Completed Orders" },
      { url: "/delivered-orders", title: "Delivered Orders" },
      { url: "/returned-orders", title: "Returned Orders" },
      { url: "/expired-orders", title: "Expired Orders" },
      { url: "/approved-orders", title: "Approved Orders" },
      { url: "/paytrigger-pending-orders", title: "Waiting For Software Activation" },
      { url: "/picked-orders", title: "Picked Orders" },
      { url: "/rejected-orders", title: "Rejected Orders" },
    ],
  },
  {
    group: "Customers",
    pages: [
      { url: "/admin/customers", title: "Customers Profiles" },
      { url: "/admin/customers/blacklist", title: "Blacklisted Customers" },
      { url: "/admin/customers/cleared", title: "Cleared Accounts" },
    ],
  },
  {
    group: "Approvals & Recovery Orders",
    pages: [
      { url: "/orders-for-approval", title: "Orders for Approval" },
      { url: "/approved-order-list", title: "Approved Order List" },
      { url: "/recovery-orders", title: "Recovery Orders" },
    ],
  },
  {
    group: "Officers",
    pages: [
      { url: "/delivery-officers", title: "Delivery Officers — Officer List" },
      { url: "/admin/delivery-assignments", title: "Delivery Officers — Area Assignments" },
      { url: "/verification-officers", title: "Verification Officers — Officer List" },
      { url: "/admin/officer-assignments", title: "Verification Officers — Area Assignments" },
      { url: "/recovery-officers", title: "Recovery Officers — Officer List" },
      { url: "/admin/recovery-assignments", title: "Recovery Officers — Area Assignments" },
    ],
  },
  {
    group: "Notifications",
    pages: [
      { url: "/notifications", title: "View Notifications" },
      { url: "/admin/notifications-broadcast", title: "Broadcast" },
    ],
  },
  {
    group: "User Management",
    pages: [
      { url: "/user-management/user-list", title: "User List" },
      { url: "/admin/deletion-requests", title: "Deletion Requests" },
      { url: "/admin/cash-limits", title: "Cash Limits" },
    ],
  },
  {
    group: "Address Management",
    pages: [
      { url: "/admin/addresses/cities", title: "Cities" },
      { url: "/admin/addresses/zones", title: "Zones" },
      { url: "/admin/addresses/areas", title: "Areas" },
      { url: "/admin/addresses/bulk-upload", title: "Bulk Upload" },
    ],
  },
  {
    group: "Complaints",
    pages: [
      { url: "/admin/complaints", title: "Create Complaint" },
      { url: "/admin/complaints/all", title: "All Complaints" },
    ],
  },
  {
    group: "Reports",
    pages: [
      { url: "/reports", title: "Reports Summary" },
      { url: "/admin/reports-hub", title: "Reports Hub" },
    ],
  },
  {
    group: "Legacy Data Import",
    pages: [
      { url: "/admin/legacy-import", title: "Import Legacy Data" },
      { url: "/admin/legacy-import/pending", title: "Pending Legacy Profiles" },
    ],
  },
  {
    group: "Administration",
    pages: [
      { url: "/admin/paytrigger", title: "Paytrigger Activation" },
      { url: "/admin/recycle-bin", title: "Recycle Bin" },
      { url: "/admin/outlets", title: "Outlets Management" },
      { url: "/admin/inventory", title: "Inventory & Warehouse" },
      { url: "/admin/alerts", title: "Alerts Center" },
    ],
  },
  {
    group: "Rankings & Leaderboards",
    pages: [
      { url: "/admin/rankings", title: "Officer Rankings" },
      { url: "/outlet/officer-targets", title: "Officer Targets" },
    ],
  },
  {
    group: "Security",
    pages: [
      { url: "/admin/activity-logs", title: "Activity Logs" },
      { url: "/admin/security-settings", title: "Security Settings" },
      { url: "/admin/permissions", title: "Permissions" },
    ],
  },
  {
    group: "Management & Analytics",
    pages: [
      { url: "/admin/recovery-management", title: "Recovery Management" },
      { url: "/admin/delivery-management", title: "Delivery Management" },
      { url: "/admin/installment-aging", title: "Installment Aging" },
      { url: "/admin/emi-calculator", title: "EMI Calculator" },
      { url: "/admin/sales-targets", title: "Sales Targets" },
      { url: "/admin/field-ops", title: "Field Ops" },
      { url: "/admin/command-center", title: "Command Center" },
      { url: "/admin/discount-requests", title: "Discount Requests" },
      { url: "/admin/customer-risk", title: "Customer Risk Score" },
    ],
  },
];

export const ALL_SUB_ADMIN_PAGE_URLS = SUB_ADMIN_PAGE_CATALOG.flatMap((g) => g.pages.map((p) => p.url));

// Never available to a Sub Admin: creating users.
const NEVER_PATHS = ["/user-management/create-users"];
// Other portals — not part of the Admin menu a Sub Admin is carved out of.
const OTHER_PORTAL_PREFIXES = ["/outlet", "/csr", "/accounts", "/employee", "/hr"];
// Order detail / conversion screens reached from the order pages.
const ORDER_DETAIL_PREFIXES = ["/orders/", "/verifications/", "/convert-sale/"];
const ORDER_PAGE_URLS = [
  "/", ...(SUB_ADMIN_PAGE_CATALOG.find((g) => g.group === "Orders")?.pages.map((p) => p.url) || []),
  "/admin/customers", "/admin/customers/blacklist", "/admin/customers/cleared",
  "/orders-for-approval", "/approved-order-list", "/recovery-orders", "/delivery-officers",
  "/admin/command-center", "/admin/legacy-import/pending", "/admin/installment-aging", "/admin/recovery-management",
];

export function isSubAdmin(user: any): boolean {
  return !!user?.is_sub_admin;
}

export function getSubAdminPages(user: any): Set<string> {
  return new Set<string>(Array.isArray(user?.sub_admin_pages) ? user.sub_admin_pages : []);
}

const startsWithPath = (path: string, prefix: string) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : prefix + "/");

/** Whether a Sub Admin may open `pathname`. Always true for anyone else. */
export function canSubAdminOpen(user: any, pathname: string): boolean {
  if (!isSubAdmin(user)) return true;
  const path = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const pages = getSubAdminPages(user);

  if (NEVER_PATHS.some((p) => startsWithPath(path, p))) return false;

  // Longest catalog URL that this path is (or sits under) decides.
  const match = ALL_SUB_ADMIN_PAGE_URLS
    .filter((u) => (u === "/" ? path === "/" : startsWithPath(path, u)))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return pages.has(match);

  if (ORDER_DETAIL_PREFIXES.some((p) => path.startsWith(p))) return ORDER_PAGE_URLS.some((u) => pages.has(u));
  if (OTHER_PORTAL_PREFIXES.some((p) => startsWithPath(path, p))) return false;

  // Own profile / settings and any other non-module screen.
  return true;
}

/** First page a Sub Admin can open — where to send them instead of a blocked page. */
export function firstAllowedSubAdminPage(user: any): string | null {
  const pages = getSubAdminPages(user);
  return ALL_SUB_ADMIN_PAGE_URLS.find((u) => pages.has(u)) || null;
}
