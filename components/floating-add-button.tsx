"use client";

type FloatingAddVariant = "blue" | "rose";

const variantStyles: Record<FloatingAddVariant, string> = {
  blue: "border-blue-200 bg-blue-600 shadow-blue-900/30 hover:bg-blue-700",
  rose: "border-rose-200 bg-rose-600 shadow-rose-900/30 hover:bg-rose-700",
};

/** Fixed + control — stays above mobile tab bar and submit footer while scrolling long forms. */
export function FloatingAddButton({
  onClick,
  disabled,
  title,
  ariaLabel,
  variant = "blue",
  mobileBottom = "submit",
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel: string;
  variant?: FloatingAddVariant;
  /** `submit` sits above fixed submit footer; `tab` sits above mobile tab bar only. */
  mobileBottom?: "submit" | "tab";
}) {
  const bottomClass =
    mobileBottom === "tab"
      ? "bottom-[calc(var(--bottom-nav-height)+0.75rem)]"
      : "bottom-[calc(var(--bottom-nav-height)+4.75rem)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`fixed z-[45] flex h-12 w-12 items-center justify-center rounded-full border text-white shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 right-4 md:bottom-8 md:right-8 ${bottomClass} ${variantStyles[variant]}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}
