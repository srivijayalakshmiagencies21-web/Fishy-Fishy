export function PageLoadingSkeleton() {
  return (
    <div className="panel-skeleton mx-auto max-w-5xl pb-12" aria-busy aria-label="Loading page">
      <div className="skeleton-block h-12 w-full max-w-md" />
      <div className="skeleton-block h-28" />
      <div className="skeleton-block h-28" />
      <div className="skeleton-block skeleton-block--table" />
    </div>
  );
}
