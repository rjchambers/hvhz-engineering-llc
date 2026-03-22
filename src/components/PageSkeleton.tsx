export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-in">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-muted shimmer" />
        <div className="h-4 w-72 rounded-md bg-muted shimmer" style={{ animationDelay: "0.1s" }} />
      </div>

      {/* Card skeleton */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="h-10 w-10 rounded-lg bg-muted shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded-md bg-muted shimmer" style={{ width: `${70 - i * 8}%` }} />
              <div className="h-3 rounded-md bg-muted shimmer" style={{ width: `${50 - i * 5}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
