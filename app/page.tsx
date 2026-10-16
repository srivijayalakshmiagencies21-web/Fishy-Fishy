import { launchRedirectScript } from "@/lib/launch-home";

/**
 * PWA start URL. Static and outside the proxy so it paints straight from the CDN and the OS
 * splash screen closes immediately; the inline script then jumps to the user's landing page.
 */
export default function LaunchPage() {
  return (
    <div className="login-page" aria-busy aria-label="Opening Fishy-Fishy">
      <div className="login-card">
        <div className="login-card-header">
          <span className="brand-mark login-brand-mark" role="img" aria-label="Fishy-Fishy" />
          <div>
            <p className="login-brand-name">Fishy-Fishy</p>
            <p className="login-brand-tagline">Seed logistics</p>
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: launchRedirectScript }} />
    </div>
  );
}
