"use client";

import { useRef } from "react";
import { Toaster, ToastBar, toast, type Toast } from "react-hot-toast";

function SwipeableToast({ item }: { item: Toast }) {
  const pointerStart = useRef<{ x: number; y: number; dismissed: boolean } | null>(null);

  return (
    <div
      style={{ touchAction: "none", cursor: "grab", userSelect: "none" }}
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY, dismissed: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointerStart.current;
        if (!start || start.dismissed) return;

        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.abs(deltaX) >= 24 && Math.abs(deltaX) > Math.abs(deltaY)) {
          start.dismissed = true;
          toast.remove(item.id);
        }
      }}
      onPointerUp={() => {
        pointerStart.current = null;
      }}
      onLostPointerCapture={() => {
        pointerStart.current = null;
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <ToastBar toast={item} />
    </div>
  );
}

export function DashboardToaster() {
  return (
    <Toaster position="bottom-right" gutter={10}>
      {(item) => <SwipeableToast item={item} />}
    </Toaster>
  );
}
