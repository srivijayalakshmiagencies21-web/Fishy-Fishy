export function PageLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 pb-12" aria-busy aria-label="Loading page">
      <div className="h-7 w-48 rounded-lg bg-gray-200/90" />
      <div className="surface space-y-3 p-5">
        <div className="h-5 w-full max-w-md rounded bg-gray-200/80" />
        <div className="h-5 w-2/3 rounded bg-gray-200/70" />
        <div className="mt-4 h-32 rounded-xl bg-gray-100" />
      </div>
      <div className="surface h-24 rounded-xl bg-gray-100/90" />
    </div>
  );
}
