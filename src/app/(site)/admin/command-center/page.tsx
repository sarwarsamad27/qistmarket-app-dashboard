"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Radio, Bell, Truck, AlertTriangle, ShieldCheck, CreditCard, ClipboardCheck, HandCoins, Users2 } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import PageHeader from "@/components/Accounts/PageHeader";
import { useNotifications } from "../../../../../contexts/NotificationContext";
import { ListSkeleton, TableRowsSkeleton } from "@/components/ui/LoadingStates";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${Cookies.get("auth_token")}` });
const POLL_INTERVAL = 10000;

interface RecentOrder { id: number; order_ref: string; customer_name: string; status: string; updated_at: string }
interface DeliveryItem { id: number; order_ref: string; customer_name: string; status: string; updated_at: string }
interface AlertItem { severity: string; title: string; message: string }
interface ApprovalOrder { id: number; order_ref: string; customer_name: string; created_at: string }
interface VerificationOrder { id: number; order_ref: string; customer_name: string; updated_at: string }
interface OnlinePayment { channel: string; consumer_number: string; amount: number; status: string; created_at: string }
interface RecoveryItem { order_ref: string; customer_name: string; amount: number; paid_at: string }
interface AttendanceRow { outlet_id: number; outlet_name: string; totalStaff: number; present: number; absent: number; notMarked: number; unlinkedOfficers: number }

export default function AdminCommandCenterPage() {
  const { notifications } = useNotifications();
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[] | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [approvals, setApprovals] = useState<ApprovalOrder[] | null>(null);
  const [verificationQueue, setVerificationQueue] = useState<VerificationOrder[] | null>(null);
  const [onlinePayments, setOnlinePayments] = useState<OnlinePayment[] | null>(null);
  const [recoveries, setRecoveries] = useState<RecoveryItem[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[] | null>(null);
  // Panels stay `null` (skeleton) until their first load; a failed load is
  // flagged so the panel says so instead of pretending it's empty.
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const load = (key: string, url: string, apply: (json: any) => void) =>
      fetch(url, { headers: authHeaders() })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) apply(json);
          setFailed((f) => ({ ...f, [key]: !json.success }));
        })
        .catch(() => setFailed((f) => ({ ...f, [key]: true })));

    const poll = () => {
      load("orders", `${BACKEND_URL}/api/orders?page=1&limit=8&sortBy=updated_at&sortDir=desc`, (json) => setOrders(json.data?.orders || []));
      load("deliveries", `${BACKEND_URL}/api/orders/delivery-status`, (json) => setDeliveries((json.data || []).slice(0, 8)));
      load("alerts", `${BACKEND_URL}/api/accounts/alerts`, (json) => setAlerts(json.data?.alerts || []));
      load("approvals", `${BACKEND_URL}/api/orders?page=1&limit=8&status=pending`, (json) => setApprovals(json.data?.orders || []));
      load("verificationQueue", `${BACKEND_URL}/api/orders/verification-pending?page=1&limit=8`, (json) => setVerificationQueue(json.data?.orders || []));
      load("onlinePayments", `${BACKEND_URL}/api/accounts/online-payments?range=Day`, (json) => setOnlinePayments((json.data?.recent || []).slice(0, 8)));
      load("recoveries", `${BACKEND_URL}/api/outlet-reports/installment-recoveries?startDate=${todayStr}`, (json) => setRecoveries((json.data?.recoveries || []).slice(0, 8)));
      load("attendance", `${BACKEND_URL}/api/admin-panel/attendance`, (json) => setAttendance(json.data || []));
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Breadcrumb pageName="Command Center" />
      <PageHeader icon={Radio} title="Command Center" subtitle="Near-real-time operations view — live notifications plus 10-second refreshed data." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Live Notifications</h2>
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-500"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Live</span>
          </div>
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {notifications.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No live events yet.</p>
            ) : notifications.slice(0, 10).map((n) => (
              <div key={n.id} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{n.title}</p>
                <p className="mt-0.5 text-gray-500 dark:text-gray-400">{n.message}</p>
                <p className="mt-1 text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <Truck className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Live Deliveries</h2>
            <span className="ml-auto text-[10px] font-medium text-gray-400">refreshes every 10s</span>
          </div>
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {deliveries === null ? <ListSkeleton failed={failed.deliveries} /> : deliveries.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No active deliveries.</p>
            ) : deliveries.map((d) => (
              <div key={d.id} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{d.order_ref}</p>
                <p className="text-gray-500 dark:text-gray-400">{d.customer_name} · <span className="capitalize">{d.status}</span></p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Active Alerts</h2>
            <Link href="/admin/alerts" className="ml-auto text-[10px] font-bold text-[#ff3d3d] hover:underline">View all</Link>
          </div>
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {alerts === null ? <ListSkeleton failed={failed.alerts} /> : alerts.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No active alerts.</p>
            ) : alerts.slice(0, 10).map((a, idx) => (
              <div key={idx} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{a.title}</p>
                <p className="text-gray-500 dark:text-gray-400">{a.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Pending Approvals</h2>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {approvals === null ? <ListSkeleton failed={failed.approvals} /> : approvals.length === 0 ? <p className="py-6 text-center text-xs text-gray-400">No pending approvals.</p> : approvals.map((o) => (
              <div key={o.id} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{o.order_ref}</p>
                <p className="text-gray-500 dark:text-gray-400">{o.customer_name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Verification Queue</h2>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {verificationQueue === null ? <ListSkeleton failed={failed.verificationQueue} /> : verificationQueue.length === 0 ? <p className="py-6 text-center text-xs text-gray-400">Queue is empty.</p> : verificationQueue.map((o) => (
              <div key={o.id} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{o.order_ref}</p>
                <p className="text-gray-500 dark:text-gray-400">{o.customer_name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Online Payment Activity</h2>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {onlinePayments === null ? <ListSkeleton failed={failed.onlinePayments} /> : onlinePayments.length === 0 ? <p className="py-6 text-center text-xs text-gray-400">No online payment activity today.</p> : onlinePayments.map((p, idx) => (
              <div key={idx} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{p.channel} — PKR {p.amount.toLocaleString()}</p>
                <p className="text-gray-500 dark:text-gray-400 capitalize">{p.consumer_number} · {p.status}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
          <div className="mb-3 flex items-center gap-2">
            <HandCoins className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Live Recoveries (Today)</h2>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {recoveries === null ? <ListSkeleton failed={failed.recoveries} /> : recoveries.length === 0 ? <p className="py-6 text-center text-xs text-gray-400">No recoveries collected yet today.</p> : recoveries.map((r, idx) => (
              <div key={idx} className="rounded-lg border border-stroke bg-gray-50 p-3 text-xs dark:border-dark-3 dark:bg-dark-3">
                <p className="font-semibold text-dark dark:text-white">{r.order_ref} — PKR {r.amount.toLocaleString()}</p>
                <p className="text-gray-500 dark:text-gray-400">{r.customer_name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Users2 className="size-4 text-[#ff3d3d]" />
            <h2 className="text-sm font-bold text-dark dark:text-white">Employee Attendance — Live Status</h2>
          </div>
          <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {attendance === null ? <ListSkeleton failed={failed.attendance} /> : attendance.length === 0 ? <p className="py-6 text-center text-xs text-gray-400">No attendance data.</p> : (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-3 dark:text-gray-400">
                  <tr><th className="px-3 py-2">Outlet</th><th className="px-3 py-2 text-right">Staff</th><th className="px-3 py-2 text-right">Present</th><th className="px-3 py-2 text-right">Absent</th><th className="px-3 py-2 text-right">Not Marked</th></tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.outlet_id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                      <td className="px-3 py-2 font-semibold text-dark dark:text-white">{a.outlet_name}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{a.totalStaff}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">{a.present}</td>
                      <td className="px-3 py-2 text-right text-rose-500">{a.absent}</td>
                      <td className="px-3 py-2 text-right text-amber-500">{a.notMarked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[10px] border border-stroke bg-white p-5 shadow-1 dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="mb-3 text-sm font-bold text-dark dark:text-white">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-dark-3 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders === null ? (
                failed.orders ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">Could not load recent orders. Retrying automatically…</td></tr>
                ) : (
                  <TableRowsSkeleton rows={5} cols={5} />
                )
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">No recent orders.</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} className="border-b border-stroke last:border-0 dark:border-dark-3">
                  <td className="px-3 py-2 font-semibold text-[#ff3d3d]">
                    <Link href={`/verifications/${o.id}`} className="hover:underline">
                      {o.order_ref}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-dark dark:text-white">{o.customer_name}</td>
                  <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-300">{o.status}</td>
                  <td className="px-3 py-2 text-gray-400">{new Date(o.updated_at).toLocaleTimeString()}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Link href={`/verifications/${o.id}`} className="font-semibold text-primary hover:underline">
                      View
                    </Link>
                    <button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to PERMANENTLY delete Order #${o.order_ref}?`)) return;
                        try {
                          const res = await fetch(`${BACKEND_URL}/api/admin-panel/orders/${o.id}/permanent-delete`, {
                            method: "DELETE",
                            headers: authHeaders(),
                          });
                          const json = await res.json();
                          if (json.success) {
                            setOrders((prev) => (prev || []).filter(item => item.id !== o.id));
                          } else {
                            alert(json.message || "Failed to delete order");
                          }
                        } catch (err: any) {
                          alert(err.message || "Error deleting order");
                        }
                      }}
                      className="font-bold text-red-600 hover:underline ml-2"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
