"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import Cookies from "js-cookie";
import { usePathname } from "next/navigation";
import { LIVE_RESYNC_EVENT } from "@/lib/liveEvents";
import { toast } from "react-hot-toast";

interface Notification {
    id: number;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    relatedId?: number;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    /** False until notifications have loaded once — show a skeleton, not 0. */
    hasLoaded: boolean;
    pagination: Pagination;
    fetchNotifications: (page?: number, limit?: number, status?: string) => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    socket: Socket | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1
    });
    const [socket, setSocket] = useState<Socket | null>(null);

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

    const fetchNotifications = async (page = 1, limit = 10, status = "all") => {
        const token = Cookies.get("auth_token");
        if (!token) return;

        try {
            setLoading(true);
            const res = await fetch(`${backendUrl}/api/notifications?page=${page}&limit=${limit}&status=${status}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const result = await res.json();
            if (result.success) {
                setNotifications(result.data.notifications);
                setUnreadCount(result.data.unreadCount);
                setPagination(result.data.pagination);
                setHasLoaded(true);
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: number) => {
        const token = Cookies.get("auth_token");
        try {
            const res = await fetch(`${backendUrl}/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            const result = await res.json();
            if (result.success) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                );
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        const token = Cookies.get("auth_token");
        try {
            const res = await fetch(`${backendUrl}/api/notifications/read-all`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            const result = await res.json();
            if (result.success) {
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        }
    };

    // The login cookie can appear / change without a page reload (sign-in navigates with
    // router.push), so re-read it on navigation, focus and tab show — a socket built only on
    // first mount stayed absent until a manual refresh after logging in.
    const pathname = usePathname();
    const [token, setToken] = useState<string | undefined>(() => Cookies.get("auth_token"));
    useEffect(() => {
        const sync = () => setToken(Cookies.get("auth_token"));
        sync();
        window.addEventListener("focus", sync);
        document.addEventListener("visibilitychange", sync);
        return () => {
            window.removeEventListener("focus", sync);
            document.removeEventListener("visibilitychange", sync);
        };
    }, [pathname]);

    useEffect(() => {
        if (!token) {
            setSocket(null);
            return;
        }
        fetchNotifications();

        const newSocket = io(backendUrl, {
            // Never give up: a tab left open across a server restart, a sleeping laptop or a
            // Wi-Fi drop used to stop after 5 quick attempts and stay dead (no live updates,
            // stale "Failed to load" screens) until the page was refreshed.
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            // WebSocket first; if it can't get through (proxy / network blocking it) fall back
            // to long-polling instead of never connecting.
            transports: ["websocket", "polling"],
            tryAllTransports: true,
        });

        let everConnected = false;
        newSocket.on("connect", () => {
            newSocket.emit("join_admin_notifications", token);
            // Back after a drop: anything broadcast meanwhile was missed — reload what's shown.
            if (everConnected) {
                fetchNotifications();
                window.dispatchEvent(new Event(LIVE_RESYNC_EVENT));
            }
            everConnected = true;
        });

        // The server couldn't verify the session just now (e.g. a database hiccup) — retry
        // joining instead of silently staying out of the notification rooms.
        newSocket.on("auth_error", (payload: { retryable?: boolean } | undefined) => {
            if (!payload?.retryable) return;
            setTimeout(() => {
                if (newSocket.connected) newSocket.emit("join_admin_notifications", token);
            }, 3000);
        });

        newSocket.on("force_logout", () => {
            // Ignore a stale connection after the browser has switched accounts.
            if (Cookies.get("auth_token") !== token) return;
            Cookies.remove("auth_token");
            newSocket.disconnect();
            window.location.replace("/login");
        });

        // Broadcast notifications arrive with a placeholder id (the server saves one row per
        // recipient in bulk and can't send each person their own id), so marking one as read
        // used to hit a non-existent id. Show it at once, then re-read the list shortly after
        // to swap in the real rows and the true unread count (one re-read per burst).
        let resyncTimer: ReturnType<typeof setTimeout> | null = null;
        newSocket.on("new_notification", (notif: Notification) => {
            setNotifications((prev) => [notif, ...prev]);
            setUnreadCount((prev) => prev + 1);
            if (resyncTimer) clearTimeout(resyncTimer);
            resyncTimer = setTimeout(() => {
                resyncTimer = null;
                fetchNotifications();
            }, 1500);
            toast.success(
                <div className="flex flex-col gap-1 text-sm">
                    <strong className="font-bold">{notif.title}</strong>
                    <span>{notif.message}</span>
                </div>,
                { duration: 5000 }
            );
        });

        // Network back / tab shown again after a while: reconnect at once rather than waiting
        // out the backoff, and have pages reload — browsers pause background tabs, and a
        // sleeping laptop drops the connection without anyone noticing.
        let hiddenAt: number | null = document.hidden ? Date.now() : null;
        const wake = () => {
            if (!newSocket.connected) newSocket.connect();
        };
        const handleOnline = () => {
            wake();
            fetchNotifications();
            window.dispatchEvent(new Event(LIVE_RESYNC_EVENT));
        };
        const handleVisibility = () => {
            if (document.hidden) {
                hiddenAt = Date.now();
                return;
            }
            const away = hiddenAt ? Date.now() - hiddenAt : 0;
            hiddenAt = null;
            wake();
            if (away > 60 * 1000) {
                fetchNotifications();
                window.dispatchEvent(new Event(LIVE_RESYNC_EVENT));
            }
        };
        window.addEventListener("online", handleOnline);
        document.addEventListener("visibilitychange", handleVisibility);

        setSocket(newSocket);

        return () => {
            if (resyncTimer) clearTimeout(resyncTimer);
            window.removeEventListener("online", handleOnline);
            document.removeEventListener("visibilitychange", handleVisibility);
            newSocket.removeAllListeners();
            newSocket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                loading,
                hasLoaded,
                pagination,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                socket,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
};
