// Single source of truth for "which dashboard is home for this role".
// Used by the sidebar logo, breadcrumbs, login, the "/" redirect and the
// portal layout guards so they never drift apart (e.g. an Accountant
// clicking the logo landing on the admin-only Operations Dashboard).

// Any field/outlet-affiliated role can log in through the outlet login flow
// (it only checks username+outlet_id, not role), so they all share the
// outlet dashboard.
export const OUTLET_ONLY_ROLES = [
  "branch user",
  "recovery officer",
  "verification officer",
  "delivery agent",
  "stock manager",
];

// Same spellings the CSR layout guard accepts.
export const SALES_ROLES = [
  "csr",
  "sale officer",
  "sales officer",
  "sale_officer",
  "sales_officer",
];

export function getRoleHome(role?: string | null): string {
  const r = (role || "").toLowerCase();
  if (SALES_ROLES.includes(r)) return "/csr/dashboard";
  if (OUTLET_ONLY_ROLES.includes(r) || r === "outlet user") return "/outlet/dashboard";
  if (r === "hr") return "/hr/dashboard";
  if (r === "accountant") return "/accounts/dashboard";
  return "/";
}
