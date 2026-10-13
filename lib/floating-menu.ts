export type MenuBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const GAP = 6;
const VIEWPORT_PAD = 8;

/** Visible area in layout-viewport coordinates — excludes the on-screen keyboard. */
function visibleBounds() {
  const vv = window.visualViewport;
  const top = vv?.offsetTop ?? 0;
  return { top, bottom: top + (vv?.height ?? window.innerHeight) };
}

export function computeMenuBox(anchor: DOMRect, preferredMax: number): MenuBox {
  const { top, bottom } = visibleBounds();
  const spaceBelow = bottom - anchor.bottom - GAP - VIEWPORT_PAD;
  const spaceAbove = anchor.top - top - GAP - VIEWPORT_PAD;
  const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;

  if (openUpward) {
    const maxHeight = Math.min(preferredMax, Math.max(80, spaceAbove));
    return { top: anchor.top - GAP - maxHeight, left: anchor.left, width: anchor.width, maxHeight };
  }

  const maxHeight = Math.min(preferredMax, Math.max(80, spaceBelow));
  return { top: anchor.bottom + GAP, left: anchor.left, width: anchor.width, maxHeight };
}

function scrollParent(el: HTMLElement) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Scrolls the field up (when its container can) so its menu fits above the keyboard. */
export function revealRoomForMenu(anchor: HTMLElement, preferredMax: number) {
  const needed = Math.min(preferredMax, 220) + GAP + VIEWPORT_PAD;
  const { top, bottom } = visibleBounds();
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = bottom - rect.bottom;
  if (spaceBelow >= needed) return;

  const scroller = scrollParent(anchor);
  if (!scroller) return;
  const scrollerTop = Math.max(scroller.getBoundingClientRect().top, top);
  const delta = Math.min(needed - spaceBelow, rect.top - scrollerTop - VIEWPORT_PAD);
  if (delta > 0) scroller.scrollTop += delta;
}

/** Keeps an open menu placed while the keyboard opens/closes or the page scrolls. */
export function trackMenuPlacement(anchor: HTMLElement | null, preferredMax: number, place: () => void) {
  const vv = window.visualViewport;
  let frame = 0;

  function schedulePlace() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      place();
    });
  }

  function onViewportResize() {
    if (anchor) revealRoomForMenu(anchor, preferredMax);
    schedulePlace();
  }

  if (anchor) revealRoomForMenu(anchor, preferredMax);
  place();
  window.addEventListener("resize", onViewportResize);
  window.addEventListener("scroll", schedulePlace, { capture: true, passive: true });
  vv?.addEventListener("resize", onViewportResize);
  vv?.addEventListener("scroll", schedulePlace, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onViewportResize);
    window.removeEventListener("scroll", schedulePlace, true);
    vv?.removeEventListener("resize", onViewportResize);
    vv?.removeEventListener("scroll", schedulePlace);
  };
}
