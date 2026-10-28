"use client";

import { useRef } from "react";
import { Toaster, ToastBar, toast, type Toast } from "react-hot-toast";

function SwipeableToast({ item }: { item: Toast }) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const dismissIfSwiped = (x: number, y: number) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;

    const deltaX = x - start.x;
    const deltaY = y - start.y;
    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY)) {
      toast.dismiss(item.id);
    }
  };

  return (
    <div
      style={{ touchAction: "pan-y" }}
      onPointerDown={(event) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        dismissIfSwiped(event.clientX, event.clientY);
      }}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      onTouchStart={(event) => {
        const touch = event.changedTouches[0];
        pointerStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        dismissIfSwiped(touch.clientX, touch.clientY);
      }}
      onTouchCancel={() => {
        pointerStart.current = null;
      }}
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
