import { LAUNCH_HOME_COOKIE } from "@/lib/launch-home";
import { launchSplashLogo } from "@/lib/launch-splash-logo";

/**
 * The launch splash is painted twice: first by the static `/` document (served from the CDN, so it
 * replaces the OS launch screen almost immediately), then by the root layout of the page it hands
 * off to. Both share this markup and CSS, and every animation is offset by the time since launch
 * (`--splash-elapsed`), so the second copy continues the first instead of restarting.
 */
const SPLASH_START_KEY = "fishy-fishy:splash-start";
const HANDOFF_WINDOW_MS = 15000;

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
].join("");

export const launchSplashCss = `
.launch-splash {
  --since: var(--splash-elapsed, 0ms);
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  background: #0f4c81;
  color: #fff;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  animation: launch-splash-out 0.4s ease-in calc(10s - var(--since)) forwards;
}
html[data-splash="done"] .launch-splash { animation: launch-splash-done 0.4s ease-in forwards; }
html[data-splash="off"] .launch-splash { display: none; }
.launch-splash-logo-wrap {
  position: relative;
  width: min(9.5rem, 42vw);
  aspect-ratio: 422 / 260;
  animation: launch-splash-swim 2.4s ease-in-out calc(0s - var(--since)) infinite;
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
  animation: launch-splash-bubble 1.4s ease-out calc(var(--delay) - var(--since)) infinite;
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
  animation: launch-splash-rise var(--duration) linear calc(var(--delay) - var(--since)) infinite;
}
.launch-splash-swimmer {
  position: absolute;
  top: var(--top);
  left: 0;
  width: var(--size);
  opacity: 0.16;
  animation: launch-splash-drift-right var(--duration) linear calc(var(--delay) - var(--since)) infinite;
}
.launch-splash-swimmer--reverse { animation-name: launch-splash-drift-left; }
.launch-splash-swimmer svg { display: block; width: 100%; overflow: visible; }
.launch-splash-swimmer--reverse svg { scale: -1 1; }
.launch-splash-tail {
  transform-origin: 15px 16px;
  animation: launch-splash-tail 0.6s ease-in-out calc(0s - var(--since)) infinite alternate;
}
.launch-splash-name {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0;
  animation: launch-splash-name-in 0.6s ease-out calc(0.25s - var(--since)) forwards;
}
@keyframes launch-splash-out { to { opacity: 0; visibility: hidden; } }
@keyframes launch-splash-done { to { opacity: 0; visibility: hidden; } }
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
@keyframes launch-splash-name-in { to { opacity: 0.7; } }
@media (prefers-reduced-motion: reduce) {
  .launch-splash-logo-wrap, .launch-splash-bubble, .launch-splash-name { animation: none; }
  .launch-splash-name { opacity: 0.7; }
  .launch-splash-bubble, .launch-splash-rising-bubble, .launch-splash-swimmer { display: none; }
}
`;

/**
 * Root layout copy. Continues a splash started by `/` (or starts one on a direct cold load), skips
 * it on later loads in the session, and fades it once it has played a minimum time and the page
 * has streamed in (`app/loading.tsx` removes its `data-launch-pending` marker).
 */
export const launchSplashLayoutScript = `(function(){var d=document.documentElement,k=${JSON.stringify(
  SPLASH_START_KEY,
)},now=Date.now(),s=0;try{s=+sessionStorage.getItem(k)||0}catch(e){}if(s&&now-s>${HANDOFF_WINDOW_MS}){d.setAttribute("data-splash","off");return}if(!s){s=now;try{sessionStorage.setItem(k,String(s))}catch(e){}}d.style.setProperty("--splash-elapsed",(now-s)+"ms");var min=matchMedia("(prefers-reduced-motion: reduce)").matches?600:1400,timer=setInterval(function(){if(Date.now()-s<min||document.querySelector("[data-launch-pending]"))return;clearInterval(timer);d.setAttribute("data-splash","done")},50)})();`;

/**
 * Static `/` copy. Starts the splash clock, then (after the first frame is painted) replaces itself
 * with the remembered home page; `/enter` resolves the role server-side when there is none.
 */
export const launchSplashStartScript = `(function(){try{sessionStorage.setItem(${JSON.stringify(
  SPLASH_START_KEY,
)},String(Date.now()))}catch(e){}var m=document.cookie.match(/(?:^|; )${LAUNCH_HOME_COOKIE}=([^;]*)/),h="/enter";if(m){try{h=decodeURIComponent(m[1])}catch(e){}}if(h.charAt(0)!=="/"||h.charAt(1)==="/"||h.charAt(1)==="\\\\")h="/enter";requestAnimationFrame(function(){setTimeout(function(){location.replace(h)},0)})})();`;
