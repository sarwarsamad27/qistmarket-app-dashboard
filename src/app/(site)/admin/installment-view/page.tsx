"use client";

import InstallmentsView from "@/components/Installments/InstallmentsView";

// Same screen as Outlet -> Installments View, across every outlet (with an outlet picker).
export default function AdminInstallmentViewPage() {
  return <InstallmentsView adminMode />;
}
