import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { WaveField } from "@/components/wave-field";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sourceSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ServiceWorkerRegister />
        <WaveField />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
