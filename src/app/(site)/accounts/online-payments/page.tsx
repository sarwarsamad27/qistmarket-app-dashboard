"use client";

import { useState } from "react";
import { Wifi, Radio, Layers, BarChart3 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import LiveTransactions from "./_components/LiveTransactions";
import Settlements from "./_components/Settlements";
import OnlineAnalytics from "./_components/OnlineAnalytics";

const TABS = [
  { key: "live" as const, label: "Live Payments", icon: Radio },
  { key: "settlements" as const, label: "Settlements", icon: Layers },
  { key: "analytics" as const, label: "Channel Analytics", icon: BarChart3 },
];

/**
 * Online Payments (1Bill + SmartPay QR) as its own module: every payment live, settlement of the
 * gateway pay-outs into the company bank, and channel-wise recovery analytics.
 */
export default function OnlinePaymentsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("live");
  return (
    <>
      <Breadcrumb pageName="Online Payments" />
      <PageHeader icon={Wifi} title="Online Payments — 1Bill & SmartPay QR" subtitle="Every online payment as it arrives, settlement of gateway pay-outs into the bank, and channel analytics." />
      <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-dark-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-white text-[#ff3d3d] shadow-sm dark:bg-boxdark" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "live" && <LiveTransactions />}
      {tab === "settlements" && <Settlements />}
      {tab === "analytics" && <OnlineAnalytics />}
    </>
  );
}
