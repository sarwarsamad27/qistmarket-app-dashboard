import "@/css/satoshi.css";
import "@/css/style.css";

import "flatpickr/dist/flatpickr.min.css";
import "jsvectormap/dist/jsvectormap.css";

import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import type { PropsWithChildren } from "react";
import { Providers } from "./providers";
import { DashboardToaster } from "@/components/common/DashboardToaster";

export const metadata: Metadata = {
  title: "Qist Market Management System",
  description:
    "Qist Market Management System is a comprehensive platform designed to streamline and optimize the operations of market management. It offers a range of features and tools to facilitate efficient management of market activities, including inventory tracking, sales analysis, customer relationship management, and more. With its user-friendly interface and robust functionality, Qist Market Management System empowers market managers to make informed decisions, enhance productivity, and drive business growth.",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
          <Providers>
          <NextTopLoader color="#ff3d3d" showSpinner={false} />
          {children}
          <DashboardToaster />
          </Providers>
      </body>
    </html>
  );
}