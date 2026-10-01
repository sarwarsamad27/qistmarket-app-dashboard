"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import Cookies from "js-cookie";
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

    useEffect(() => {
        fetchNotifications();

        const token = Cookies.get("auth_token");
        if (!token) return;

        const newSocket = io(backendUrl, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ["websocket"],
        });

        newSocket.on("connect", () => {
            newSocket.emit("join_admin_notifications", token);
        });

        newSocket.on("new_notification", (notif: Notification) => {
            setNotifications((prev) => [notif, ...prev]);
            setUnreadCount((prev) => prev + 1);
            toast.success(
                <div className="flex flex-col gap-1 text-sm">
                    <strong className="font-bold">{notif.title}</strong>
                    <span>{notif.message}</span>
                </div>,
                { duration: 5000 }
            );
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

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
