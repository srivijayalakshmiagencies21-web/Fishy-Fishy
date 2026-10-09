/** Scroll the main app canvas (not the window) to the top after in-app view changes. */
export function scrollCanvasToTop() {
  if (typeof document === "undefined") return;
  requestAnimationFrame(() => {
    document.querySelector(".canvas-body")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}
