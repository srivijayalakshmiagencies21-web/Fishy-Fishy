import { launchSplashCss, launchSplashInnerHtml, launchSplashStartScript } from "@/lib/launch-splash";

export const dynamic = "force-static";

/**
 * PWA start URL. A static, self-contained document (inline CSS and logo) so the animated splash
 * replaces the OS launch screen as soon as the browser is up, then hands off to the home page.
 */
const html = `<!doctype html><html lang="en" style="background:#0f4c81"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual"><meta name="theme-color" content="#0f4c81"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Fishy-Fishy"><link rel="manifest" href="/manifest.json"><title>Fishy-Fishy</title><style>body{margin:0}${launchSplashCss}</style></head><body><div class="launch-splash" aria-hidden="true">${launchSplashInnerHtml}</div><script>${launchSplashStartScript}</script></body></html>`;

export function GET() {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
