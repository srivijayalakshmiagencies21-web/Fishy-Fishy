import { launchRedirectScript } from "@/lib/launch-home";

export const dynamic = "force-static";

/**
 * PWA start URL. A static document with nothing to paint, so the OS splash stays up until the
 * landing page renders; the inline script jumps straight there without a server redirect.
 */
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0f4c81"><link rel="manifest" href="/manifest.json"><title>Fishy-Fishy</title></head><body><script>${launchRedirectScript}</script></body></html>`;

export function GET() {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
