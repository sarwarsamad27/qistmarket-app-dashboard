"use client";
// Must stay the first import: it patches fetch/axios before any provider
// or page makes its first API call.
import { GlobalErrorHandling } from "@/components/GlobalErrorHandling";
import { AuthProvider } from "../../contexts/AuthContext";
import { NotificationProvider } from "../../contexts/NotificationContext";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GlobalErrorHandling />
      <NotificationProvider>
        <ThemeProvider defaultTheme="light" attribute="class">
          {children}
        </ThemeProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
