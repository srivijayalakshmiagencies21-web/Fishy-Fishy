import { launchSplashLogo } from "@/lib/launch-splash-logo";

/**
 * Animated launch splash, rendered first in the root layout so it streams before the page data.
 * CSS and logo are inline so it paints without waiting on any other request.
 */
const SPLASH_SEEN_KEY = "fishy-fishy:splash";

const mouthBubbles = [
  { size: "0.45rem", delay: "0.1s" },
  { size: "0.3rem", delay: "0.35s" },
  { size: "0.38rem", delay: "0.6s" },
  { size: "0.28rem", delay: "0.85s" },
  { size: "0.42rem", delay: "1.1s" },
];

const risingBubbles = [
  { left: "12%", size: "0.6rem", duration: "4.5s", delay: "-1.5s" },
  { left: "28%", size: "0.4rem", duration: "3.8s", delay: "-3s" },
  { left: "47%", size: "0.5rem", duration: "5s", delay: "-0.5s" },
  { left: "68%", size: "0.7rem", duration: "4.2s", delay: "-2.4s" },
  { left: "86%", size: "0.45rem", duration: "3.6s", delay: "-1s" },
];

const swimmers = [
  { top: "20%", size: "2.6rem", duration: "9s", delay: "-3.5s", reverse: false },
  { top: "64%", size: "2rem", duration: "11s", delay: "-6s", reverse: true },
  { top: "78%", size: "3rem", duration: "10s", delay: "-1.5s", reverse: false },
];

const fishSvg =
  '<svg viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
  '<path class="launch-splash-tail" d="M15 16 L3 7 Q7.5 16 3 25 Z"/>' +
  '<path d="M15 16 C25 3 47 4 61 16 C47 28 25 29 15 16 Z"/>' +
  '<path d="M45 9 Q40 16 45 23"/>' +
  '<circle cx="52" cy="13.5" r="1.4" fill="currentColor" stroke="none"/>' +
  "</svg>";

export const launchSplashInnerHtml = [
  '<div class="launch-splash-scene">',
  ...risingBubbles.map(
    (b) =>
      `<span class="launch-splash-rising-bubble" style="--left:${b.left};--size:${b.size};--duration:${b.duration};--delay:${b.delay}"></span>`,
  ),
  ...swimmers.map(
    (f) =>
      `<span class="launch-splash-swimmer${f.reverse ? " launch-splash-swimmer--reverse" : ""}" style="--top:${f.top};--size:${f.size};--duration:${f.duration};--delay:${f.delay}">${fishSvg}</span>`,
  ),
  '<div class="launch-splash-logo-wrap"><span class="launch-splash-logo"></span>',
  ...mouthBubbles.map(
    (b) => `<span class="launch-splash-bubble" style="--size:${b.size};--delay:${b.delay}"></span>`,
  ),
  "</div>",
  '<p class="launch-splash-name">Fishy-Fishy</p>',
  "</div>",
].join("");

export const launchSplashCss = `
.launch-splash {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  background: #0f4c81;
  /* Paints blue past the box too, so no safe-area or overscroll gap shows the page behind. */
  box-shadow: 0 0 0 100vmax #0f4c81;
  color: #fff;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  animation: launch-splash-out 0.4s ease-in 10s forwards;
}
/* Installed iOS app: fixed/inset resolves to the screen minus the status bar; vh is the full screen. */
@media (display-mode: standalone) {
  .launch-splash { bottom: auto; height: 100vh; }
}
/*
 * While the splash is up, keep the page hidden and the canvas blue: on iOS launch the viewport
 * settles a few frames late, and anything the splash doesn't cover yet must still read as blue.
 */
html:not([data-splash]) { background: #0f4c81; }
html:not([data-splash]) body > :not(.launch-splash) {
  visibility: hidden;
  animation: launch-splash-reveal 0s linear 10s forwards;
}
html[data-splash="done"] .launch-splash { animation: launch-splash-done 0.4s ease-in forwards; }
html[data-splash="off"] .launch-splash { display: none; }
/*
 * Starts as plain blue (matching the OS launch screen). The script sets data-in once iOS's
 * app-open zoom is over and the viewport has settled; the delayed animation is the no-JS fallback.
 */
.launch-splash-scene {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  opacity: 0;
  transform: scale(0.96);
  animation: launch-splash-scene-fallback 0.7s ease-out 1.2s forwards;
}
.launch-splash[data-in] .launch-splash-scene {
  animation: launch-splash-scene-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.launch-splash-logo-wrap {
  position: relative;
  width: min(9.5rem, 42vw);
  aspect-ratio: 422 / 260;
  animation: launch-splash-swim 2.4s ease-in-out 0s infinite;
}
.launch-splash-logo {
  display: block;
  width: 100%;
  height: 100%;
  background: url("${launchSplashLogo}") center / contain no-repeat;
}
.launch-splash-bubble {
  position: absolute;
  left: 83%;
  top: 37%;
  width: var(--size);
  height: var(--size);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  opacity: 0;
  animation: launch-splash-bubble 1.4s ease-out var(--delay) infinite;
}
.launch-splash-rising-bubble {
  position: absolute;
  bottom: -1rem;
  left: var(--left);
  width: var(--size);
  height: var(--size);
  border: 1px solid #fff;
  border-radius: 999px;
  opacity: 0.18;
  animation: launch-splash-rise var(--duration) linear var(--delay) infinite;
}
.launch-splash-swimmer {
  position: absolute;
  top: var(--top);
  left: 0;
  width: var(--size);
  opacity: 0.16;
  animation: launch-splash-drift-right var(--duration) linear var(--delay) infinite;
}
.launch-splash-swimmer--reverse { animation-name: launch-splash-drift-left; }
.launch-splash-swimmer svg { display: block; width: 100%; overflow: visible; }
.launch-splash-swimmer--reverse svg { scale: -1 1; }
.launch-splash-tail {
  transform-origin: 15px 16px;
  animation: launch-splash-tail 0.6s ease-in-out 0s infinite alternate;
}
.launch-splash-name {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.7;
}
.launch-splash[data-in] .launch-splash-name {
  animation: launch-splash-name-in 0.6s ease-out 0.3s both;
}
@keyframes launch-splash-scene-in { to { opacity: 1; transform: none; } }
@keyframes launch-splash-scene-fallback { to { opacity: 1; transform: none; } }
@keyframes launch-splash-out { to { opacity: 0; visibility: hidden; } }
@keyframes launch-splash-done { to { opacity: 0; visibility: hidden; } }
@keyframes launch-splash-reveal { to { visibility: visible; } }
@keyframes launch-splash-swim {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-0.3rem) rotate(-1.5deg); }
}
@keyframes launch-splash-bubble {
  0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: translate(0.3rem, -2.2rem) scale(1); }
}
@keyframes launch-splash-rise {
  from { transform: translateY(0); }
  to { transform: translateY(calc(-100vh - 2rem)); }
}
@keyframes launch-splash-drift-right {
  from { transform: translateX(calc(-1 * var(--size) - 1rem)); }
  to { transform: translateX(calc(100vw + 1rem)); }
}
@keyframes launch-splash-drift-left {
  from { transform: translateX(calc(100vw + 1rem)); }
  to { transform: translateX(calc(-1 * var(--size) - 1rem)); }
}
@keyframes launch-splash-tail {
  from { transform: rotate(-10deg); }
  to { transform: rotate(10deg); }
}
@keyframes launch-splash-name-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .launch-splash-logo-wrap, .launch-splash-bubble { animation: none; }
  .launch-splash-scene { transform: none; }
  .launch-splash-bubble, .launch-splash-rising-bubble, .launch-splash-swimmer { display: none; }
}
`;

/**
 * Runs while the HTML is parsed: skips the splash on later loads in the session. Otherwise fades the
 * scene in once the viewport has held still for a few frames (iOS is still zooming the app open and
 * resizing it when the first frames paint), then fades the splash out once it has played a minimum
 * time and the page has streamed in (`app/loading.tsx` removes its `data-launch-pending` marker).
 */
export const launchSplashScript = `(function(){var d=document.documentElement,k=${JSON.stringify(
  SPLASH_SEEN_KEY,
)};try{if(sessionStorage.getItem(k)){d.setAttribute("data-splash","off");return}sessionStorage.setItem(k,"1")}catch(e){}var s=document.querySelector(".launch-splash"),w=innerWidth,h=innerHeight,still=0,t0=Date.now();function settle(){if(innerWidth!==w||innerHeight!==h){w=innerWidth;h=innerHeight;still=0}else still++;var t=Date.now()-t0;if(t>=250&&still>=6||t>=900){s&&s.setAttribute("data-in","")}else requestAnimationFrame(settle)}requestAnimationFrame(settle);var min=matchMedia("(prefers-reduced-motion: reduce)").matches?1200:1700,timer=setInterval(function(){if(Date.now()-t0<min||document.querySelector("[data-launch-pending]"))return;clearInterval(timer);d.setAttribute("data-splash","done")},50)})();`;
