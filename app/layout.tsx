import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { LaunchSplash } from "@/components/launch-splash";
import { WaveField } from "@/components/wave-field";
import iosSplashScreens from "@/lib/ios-splash-screens.json";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Fishy-Fishy",
    template: "%s | Fishy-Fishy",
  },
  description: "Fish seed loading and logistics management app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fishy-Fishy",
    startupImage: iosSplashScreens.map(({ width, height, ratio }) => ({
      url: `/splash/ios-${width}x${height}@${ratio}x.png`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    })),
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Fishy-Fishy",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f4c81",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Layout stays fixed when the keyboard opens (no jumps); only the visual viewport shrinks,
  // which modals/dropdowns track via `window.visualViewport` to stay above the keyboard.
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sourceSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <LaunchSplash />
        <ServiceWorkerRegister />
        <WaveField />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
