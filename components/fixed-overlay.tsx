"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
  forwardRef,
} from "react";
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

/** Keeps modal layer within the visible viewport when the on-screen keyboard is open (mobile). */
function useModalViewport(overlayRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function applyViewport() {
      const el = overlayRef.current;
      if (!el || !window.visualViewport) return;
      const v = window.visualViewport;
      el.style.top = `${v.offsetTop}px`;
      el.style.left = `${v.offsetLeft}px`;
      el.style.width = `${v.width}px`;
      el.style.height = `${v.height}px`;
      el.style.setProperty("--modal-visible-height", `${v.height}px`);
    }

    function scrollFocusedIntoView(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const el = overlayRef.current;
      if (!el?.contains(target)) return;

      const scrollable =
        target.closest<HTMLElement>("[data-modal-scroll]") ??
        target.closest<HTMLElement>(".modal-body-scroll");

      const delay = 320;
      window.setTimeout(() => {
        try {
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        } catch {
          // ignore
        }
        if (scrollable) {
          const scrollTop =
            target.offsetTop -
            scrollable.offsetTop -
            scrollable.clientHeight / 2 +
            target.clientHeight / 2;
          scrollable.scrollTop = Math.max(0, scrollTop);
        }
      }, delay);
    }

    applyViewport();
    vv.addEventListener("resize", applyViewport);
    vv.addEventListener("scroll", applyViewport);
    document.addEventListener("focusin", scrollFocusedIntoView);

    return () => {
      vv.removeEventListener("resize", applyViewport);
      vv.removeEventListener("scroll", applyViewport);
      document.removeEventListener("focusin", scrollFocusedIntoView);
      const el = overlayRef.current;
      if (!el) return;
      el.style.top = "";
      el.style.left = "";
      el.style.width = "";
      el.style.height = "";
      el.style.removeProperty("--modal-visible-height");
    };
  }, [active, overlayRef]);
}

type FixedOverlayProps = ComponentProps<"div"> & {
  lockScroll?: boolean;
};

const FixedOverlayInner = forwardRef<HTMLDivElement, FixedOverlayProps>(function FixedOverlayInner(
  { className = "", children, lockScroll = false, ...props },
  ref,
) {
  useLockCanvasScroll(lockScroll);
  return (
    <div ref={ref} className={["fixed-overlay", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
});

function FixedOverlay({ className = "", children, lockScroll = false, ...props }: FixedOverlayProps) {
  return (
    <BodyPortal>
      <FixedOverlayInner className={className} lockScroll={lockScroll} {...props}>
        {children}
      </FixedOverlayInner>
    </BodyPortal>
  );
}

export function ModalOverlay({ className = "", children, ...props }: Omit<FixedOverlayProps, "lockScroll">) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useModalViewport(overlayRef, true);

  return (
    <BodyPortal>
      <FixedOverlayInner
        ref={overlayRef}
        lockScroll
        className={["modal-overlay", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </FixedOverlayInner>
    </BodyPortal>
  );
}

export { FixedOverlay };
