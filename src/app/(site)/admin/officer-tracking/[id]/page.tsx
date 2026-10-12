"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import OfficerTrackingDetail from "@/components/OfficerTracking/OfficerTrackingDetail";

export default function OfficerActivityPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense>
      <OfficerTrackingDetail id={id} basePath="/admin/officer-tracking" />
    </Suspense>
  );
}
