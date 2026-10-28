"use client";

import { useRef } from "react";
import { Toaster, ToastBar, toast, type Toast } from "react-hot-toast";

function SwipeableToast({ item }: { item: Toast }) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        pointerStart.current = null;
        if (!start) return;

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
          toast.dismiss(item.id);
        }
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      <ToastBar toast={item} />
    </div>
  );
}

export function DashboardToaster() {
  return (
    <Toaster position="top-right" gutter={10}>
      {(item) => <SwipeableToast item={item} />}
    </Toaster>
  );
}
