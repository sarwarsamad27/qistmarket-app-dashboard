// Display names for roles. The database / API keep the original role names
// ("Admin", "Sub Admin") — every permission check still compares those — only
// what the screen shows is renamed here.
//   Admin      → "Sub Admin"
//   Sub Admin  → "Sub Admin (Selected Pages)"  (the page-limited Super Admin)
const ROLE_LABELS: Record<string, string> = {
  Admin: "Sub Admin",
  "Sub Admin": "Sub Admin (Selected Pages)",
};

export const roleLabel = (role?: string | null): string =>
  role ? ROLE_LABELS[role] || role : "";
