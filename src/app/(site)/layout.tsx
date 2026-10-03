"use client";

import { useEffect, useState, useMemo } from "react";
import { Sidebar } from "@/components/Layouts/sidebar";
import { Header } from "@/components/Layouts/header";
import type { PropsWithChildren } from "react";
import { AuthProvider } from "../../../contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SidebarProvider } from "@/components/Layouts/sidebar/sidebar-context";
import { useNotifications } from "../../../contexts/NotificationContext";
import Cookies from "js-cookie";
import { toast } from "react-hot-toast";
import { CashSubmissionPopup } from "@/components/CashSubmissionPopup";
import { ReturnExchangePopup } from "@/components/ReturnExchangePopup";
import { StockTransferOTPPopup } from "@/components/StockTransferOTPPopup";
import { ProfileModalProvider } from "../../../contexts/ProfileModalContext";
import { DeletedMarker } from "@/components/DeletedMarker";

export default function Layout({ children }: PropsWithChildren) {
  const { socket: socketInstance } = useNotifications();

  return (
    <AuthProvider>
      <ProtectedRoute>
        <SidebarProvider>
          <ProfileModalProvider>
            <div className="flex min-h-screen">
              <Sidebar />

              <div className="w-full bg-gray-2 dark:bg-[#000000]">
                <Header />

                <main className="mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10">
                  {children}
                </main>
              </div>

              {/* Global OTP Popup for Cash Submission */}
              <CashSubmissionPopup socket={socketInstance} />
              {/* Global OTP Popup for Return/Exchange */}
              <ReturnExchangePopup socket={socketInstance} />
              {/* Global OTP Popup for Stock Transfer */}
              <StockTransferOTPPopup />
              {/* Greys out every "(Deleted)" staff / outlet name on every page */}
              <DeletedMarker />
            </div>
          </ProfileModalProvider>
        </SidebarProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}