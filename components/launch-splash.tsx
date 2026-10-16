import { launchSplashCss, launchSplashInnerHtml, launchSplashScript } from "@/lib/launch-splash";

export function LaunchSplash() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: launchSplashCss }} />
      <div className="launch-splash" aria-hidden="true" dangerouslySetInnerHTML={{ __html: launchSplashInnerHtml }} />
      <script dangerouslySetInnerHTML={{ __html: launchSplashScript }} />
    </>
  );
}
