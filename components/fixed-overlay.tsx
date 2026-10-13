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
    let frame = 0;
    let overlay: HTMLElement | null = null;

    function applyViewport() {
      frame = 0;
      overlay = overlayRef.current;
      if (!vv || !overlay) return;
      overlay.style.top = `${vv.offsetTop}px`;
      overlay.style.left = `${vv.offsetLeft}px`;
      overlay.style.width = `${vv.width}px`;
      overlay.style.height = `${vv.height}px`;
      overlay.style.setProperty("--modal-visible-height", `${vv.height}px`);
    }

    function scheduleApply() {
      if (!frame) frame = requestAnimationFrame(applyViewport);
    }

    function scrollFocusedIntoView(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!overlayRef.current?.contains(target)) return;
      // Dropdown fields scroll themselves to leave room for their menu above the keyboard.
      if (target.closest(".select-field")) return;

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
    vv.addEventListener("resize", scheduleApply);
    vv.addEventListener("scroll", scheduleApply, { passive: true });
    document.addEventListener("focusin", scrollFocusedIntoView);

    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", scheduleApply);
      vv.removeEventListener("scroll", scheduleApply);
      document.removeEventListener("focusin", scrollFocusedIntoView);
      if (!overlay) return;
      overlay.style.top = "";
      overlay.style.left = "";
      overlay.style.width = "";
      overlay.style.height = "";
      overlay.style.removeProperty("--modal-visible-height");
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
