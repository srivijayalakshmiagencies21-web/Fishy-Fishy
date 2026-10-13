"use client";

import { useEffect, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/** Renders children on `document.body` so `position: fixed` works on iOS (avoids scroll-container ancestors). */
export function BodyPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function useLockCanvasScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(".canvas-body");
    if (!(el instanceof HTMLElement)) return;
    const prev = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = prev;
    };
  }, [active]);
}

type FixedOverlayProps = ComponentProps<"div"> & {
  lockScroll?: boolean;
};

export function FixedOverlay({ className = "", children, lockScroll = false, ...props }: FixedOverlayProps) {
  useLockCanvasScroll(lockScroll);
  return (
    <BodyPortal>
      <div className={["fixed-overlay", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </div>
    </BodyPortal>
  );
}

export function ModalOverlay({ className = "", children, ...props }: Omit<FixedOverlayProps, "lockScroll">) {
  return (
    <FixedOverlay lockScroll className={["modal-overlay", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </FixedOverlay>
  );
}
