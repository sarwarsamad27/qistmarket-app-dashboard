
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Loader from "@/components/common/Loader";
import { useNotifications } from "../../../../contexts/NotificationContext";
import { cn } from "@/lib/utils";
import { CheckCheck, Trash2, Bell, BellOff } from "lucide-react";
import Pagination from "@/components/common/Pagination";
import { formatExactDate } from "@/utils/dateUtils";
import { timeAgo } from "@/utils/dateUtils";

// Where a notification's "View details" link goes, by type. relatedId is the record's id.
const detailLink = (type: string, relatedId?: number) => {
    if (!relatedId) return null;
    if (type === "bank_deposit") return `/accounts/cash-deposits?id=${relatedId}`;
    return null;
};


const NotificationsPage = () => {
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        loading,
        pagination,
        fetchNotifications
    } = useNotifications();

    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(1);

    useEffect(() => {
        fetchNotifications(page, 10, status);
    }, [page, status]);

    const handleStatusChange = (newStatus: string) => {
        setStatus(newStatus);
        setPage(1); // Reset to first page on filter change
    };

    return (
        <div className="mx-auto max-w-7xl">
            <Breadcrumb pageName="Notifications" />

            <div className="rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
                <div className="flex flex-col gap-4 border-b border-stroke px-4 py-4 dark:border-dark-3 sm:px-6 md:px-7.5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold text-dark dark:text-white">
                            Notifications
                        </h3>
                        {unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                                {unreadCount} New
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex rounded-lg border border-stroke p-1 dark:border-dark-3 bg-gray-2 dark:bg-dark-2">
                            {["all", "unread", "read"].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleStatusChange(s)}
                                    className={cn(
                                        "rounded-md px-4 py-1.5 text-sm font-medium transition-all capitalize",
                                        status === s
                                            ? "bg-white text-dark shadow-sm dark:bg-gray-dark dark:text-white"
                                            : "text-dark-6 hover:text-dark dark:text-dark-6 dark:hover:text-white"
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {notifications.length > 0 && unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                            >
                                <CheckCheck size={18} />
                                Mark all as read
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4 sm:p-6 md:p-7.5">
                    {loading ? (
                        <Loader text="Fetching notifications..." className="h-60" />
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-gray-2 dark:bg-dark-3">
                                <BellOff size={40} className="text-dark-6" />
                            </div>
                            <h4 className="mb-1 text-xl font-semibold text-dark dark:text-white">
                                No {status !== "all" ? status : ""} notifications
                            </h4>
                            <p className="text-dark-6">
                                {status === "all"
                                    ? "We'll notify you when something important happens."
                                    : `You don't have any ${status} notifications at the moment.`}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {notifications.map((notif, index) => (
                                <div
                                    key={notif.id || `notif-${index}`}
                                    className={cn(
                                        "relative flex gap-4 rounded-xl border border-stroke p-4 transition-all dark:border-dark-3 hover:shadow-md",
                                        notif.isRead
                                            ? "bg-transparent"
                                            : "bg-primary/5 border-primary/20 dark:bg-primary/5 dark:border-primary/20"
                                    )}
                                >
                                    <div className={cn(
                                        "flex size-12 shrink-0 items-center justify-center rounded-full",
                                        notif.isRead ? "bg-gray-2 dark:bg-dark-3 text-dark-6" : "bg-primary text-white"
                                    )}>
                                        <Bell size={24} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <h5 className={cn(
                                                    "text-base font-semibold truncate",
                                                    notif.isRead ? "text-dark dark:text-white" : "text-primary dark:text-white"
                                                )}>
                                                    {notif.title}
                                                </h5>
                                                <p className="mt-1 text-sm text-dark-5 dark:text-dark-6 leading-relaxed">
                                                    {notif.message}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="block text-xs font-medium text-dark-6 dark:text-dark-7">
                                                    {formatExactDate(notif.createdAt, "MMM DD, YYYY")}
                                                </span>
                                                <span className="mt-1 block text-[10px] text-dark-6 dark:text-dark-7">
                                                    {timeAgo(notif.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-end gap-4">
                                            {detailLink(notif.type, notif.relatedId) && (
                                                <Link
                                                    href={detailLink(notif.type, notif.relatedId)!}
                                                    onClick={() => { if (!notif.isRead) markAsRead(notif.id); }}
                                                    className="text-xs font-bold text-blue-600 hover:text-blue-500 transition-colors uppercase tracking-wider"
                                                >
                                                    View details
                                                </Link>
                                            )}
                                            {!notif.isRead && (
                                                <button
                                                    onClick={() => markAsRead(notif.id)}
                                                    className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                                                >
                                                    Mark as read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Pagination Controls */}
                            {pagination.totalPages > 1 && (
                                <div className="mt-8 flex items-center justify-between border-t border-stroke pt-6 dark:border-dark-3">
                                    <Pagination
                                        currentPage={page}
                                        totalPages={pagination.totalPages}
                                        onPageChange={(p: number) => setPage(p)}
                                        isLoading={loading}
                                    />

                                    <p className="text-sm font-medium text-dark-6 dark:text-dark-7">
                                        Showing page {page} of {pagination.totalPages}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;
