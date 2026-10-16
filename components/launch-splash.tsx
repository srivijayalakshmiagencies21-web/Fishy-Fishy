import type { CSSProperties } from "react";

const SPLASH_SEEN_KEY = "fishy-fishy:splash";

/** Runs while the HTML is parsed, so a repeat load in the same session never paints the splash. */
const splashOnceScript = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(
  SPLASH_SEEN_KEY,
)})){document.documentElement.setAttribute("data-splash","off")}else{sessionStorage.setItem(${JSON.stringify(
  SPLASH_SEEN_KEY,
)},"1")}}catch(e){}})();`;

const bubbles = [
  { size: "0.45rem", delay: "0.1s" },
  { size: "0.3rem", delay: "0.35s" },
  { size: "0.38rem", delay: "0.6s" },
  { size: "0.28rem", delay: "0.85s" },
  { size: "0.42rem", delay: "1.1s" },
];

const backgroundBubbles = [
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

export function LaunchSplash() {
  return (
    <>
      <div className="launch-splash" aria-hidden="true">
        {backgroundBubbles.map((bubble, index) => (
          <span
            key={`rise-${index}`}
            className="launch-splash-rising-bubble"
            style={
              {
                "--left": bubble.left,
                "--size": bubble.size,
                "--duration": bubble.duration,
                "--delay": bubble.delay,
              } as CSSProperties
            }
          />
        ))}
        {swimmers.map((fish, index) => (
          <span
            key={`fish-${index}`}
            className={`launch-splash-swimmer${fish.reverse ? " launch-splash-swimmer--reverse" : ""}`}
            style={
              {
                "--top": fish.top,
                "--size": fish.size,
                "--duration": fish.duration,
                "--delay": fish.delay,
              } as CSSProperties
            }
          >
            <SplashFish />
          </span>
        ))}
        <div className="launch-splash-logo-wrap">
          <span className="brand-mark launch-splash-logo" />
          {bubbles.map((bubble, index) => (
            <span
              key={index}
              className="launch-splash-bubble"
              style={{ "--size": bubble.size, "--delay": bubble.delay } as CSSProperties}
            />
          ))}
        </div>
        <p className="launch-splash-name">Fishy-Fishy</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: splashOnceScript }} />
    </>
  );
}

function SplashFish() {
  return (
    <svg
      viewBox="0 0 64 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path className="launch-splash-tail" d="M15 16 L3 7 Q7.5 16 3 25 Z" />
      <path d="M15 16 C25 3 47 4 61 16 C47 28 25 29 15 16 Z" />
      <path d="M45 9 Q40 16 45 23" />
      <circle cx="52" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
