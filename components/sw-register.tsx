"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.protocol === "https:" || window.location.hostname === "localhost"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Fishy-Fishy PWA ServiceWorker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("Fishy-Fishy PWA ServiceWorker registration failed:", err);
        });
    }
  }, []);

  return null;
}
