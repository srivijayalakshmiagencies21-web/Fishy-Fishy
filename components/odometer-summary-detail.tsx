"use client";

import { useCallback, useEffect, useState } from "react";
import { photoLabelFromStoragePath } from "@/lib/odometer-display";
import { createClient } from "@/lib/supabase/client";

const SIGNED_URL_TTL_SEC = 60 * 60;

function CaptureIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function OdometerSummaryDetail({
  reading,
  label = "Odometer",
  imagePath,
}: {
  reading?: number | string | null;
  imagePath?: string | null;
  label?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const captureLabel = photoLabelFromStoragePath(imagePath);

  const fetchSignedUrl = useCallback(async () => {
    if (!imagePath || imageUrl || imageFailed) return imageUrl;
    setLoadingPreview(true);
    setImageLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("images")
        .createSignedUrl(imagePath, SIGNED_URL_TTL_SEC);
      if (error || !data?.signedUrl) {
        setImageFailed(true);
        return null;
      }
      setImageUrl(data.signedUrl);
      return data.signedUrl;
    } catch {
      setImageFailed(true);
      return null;
    } finally {
      setLoadingPreview(false);
    }
  }, [imageFailed, imagePath, imageUrl]);

  useEffect(() => {
    setImageUrl(null);
    setImageFailed(false);
    setImageLoading(true);
  }, [imagePath]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen]);

  const openPreview = () => {
    setModalOpen(true);
    setImageLoading(true);
    setImageFailed(false);
    void fetchSignedUrl();
  };

  const hasReading = reading !== null && reading !== undefined && reading !== "";
  const hasCapture = Boolean(imagePath);
  const canOpenCapture = hasCapture && !imageFailed;

  if (!hasReading && !hasCapture) return null;

  return (
    <>
      <div className="mb-3 pl-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        {hasReading ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>
              Reading{" "}
              <span className="font-bold tabular-nums text-gray-900">{Number(reading).toLocaleString()} km</span>
            </span>
            {canOpenCapture ? (
              <button
                type="button"
                onClick={openPreview}
                disabled={loadingPreview}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-blue-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 disabled:opacity-60"
                title="View odometer capture"
                aria-label={`View ${label} capture`}
              >
                <CaptureIcon className="h-4 w-4" />
              </button>
            ) : null}
          </p>
        ) : null}
        {!hasReading && hasCapture ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {canOpenCapture ? (
              <button
                type="button"
                onClick={openPreview}
                disabled={loadingPreview}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-blue-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 disabled:opacity-60"
              >
                <CaptureIcon className="h-3.5 w-3.5" />
                {loadingPreview ? "Loading…" : "View capture"}
              </button>
            ) : (
              <p className="text-xs font-medium text-gray-600">
                {captureLabel ?? "Saved capture"}
                {imageFailed ? " (preview unavailable)" : null}
              </p>
            )}
          </div>
        ) : null}
        {hasReading && hasCapture && imageFailed ? (
          <p className="mt-1 text-xs text-gray-500">Capture on file (preview unavailable)</p>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity duration-300"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} capture`}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative flex min-h-[280px] min-w-[280px] sm:min-h-[360px] sm:min-w-[420px] max-h-[90vh] max-w-4xl items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-gray-900/70 text-white shadow-md transition-colors hover:bg-gray-900 focus:outline-none"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {(loadingPreview || (imageUrl && imageLoading)) && !imageFailed ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 px-12 animate-pulse">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                  <span className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 animate-ping" />
                  <svg
                    className="h-8 w-8 animate-spin text-blue-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800">Loading capture…</p>
                  <p className="text-xs font-medium text-gray-400 mt-1">Fetching image securely</p>
                </div>
              </div>
            ) : null}

            {imageUrl && !imageFailed ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={`${label} capture`}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageFailed(true);
                  setImageLoading(false);
                }}
                className={`max-h-[calc(90vh-2rem)] max-w-full rounded-xl object-contain transition-opacity duration-300 ${
                  imageLoading ? "opacity-0 absolute pointer-events-none" : "opacity-100"
                }`}
              />
            ) : null}

            {imageFailed ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 px-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800">Preview unavailable</p>
                <p className="text-xs text-gray-500">The requested odometer capture could not be loaded.</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
