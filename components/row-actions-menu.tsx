"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BodyPortal, FixedOverlay } from "@/components/fixed-overlay";

export type RowAction = {
  label: string;
  onSelect: () => void;
  tone?: "danger";
  disabled?: boolean;
};

const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Three-dot menu for row actions (edit, remove, …) so destructive buttons aren't one tap away.
 * The menu is portalled and fixed-positioned so table scrollers and modals don't clip it.
 */
export function RowActionsMenu({
  actions,
  label = "Options",
  className = "",
}: {
  actions: RowAction[];
  label?: string;
  className?: string;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const { offsetWidth: width, offsetHeight: height } = menu;
    const below = trigger.bottom + MENU_GAP;
    const top =
      below + height > window.innerHeight - VIEWPORT_MARGIN
        ? Math.max(VIEWPORT_MARGIN, trigger.top - MENU_GAP - height)
        : below;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, trigger.right - width),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = "visible";
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`shrink-0 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${className}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      {open ? (
        <>
          <FixedOverlay className="z-[110]" onClick={() => setOpen(false)} aria-hidden />
          <BodyPortal>
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className="fixed z-[111] w-36 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg"
              style={{ top: 0, left: 0, visibility: "hidden" }}
            >
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    setOpen(false);
                    action.onSelect();
                  }}
                  className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50 ${
                    action.tone === "danger"
                      ? "text-red-600 hover:bg-red-50"
                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </BodyPortal>
        </>
      ) : null}
    </>
  );
}
