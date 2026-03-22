export function LoadingSpinner({ label, size = "md" }: { label?: string; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-5 w-5", md: "h-8 w-8", lg: "h-10 w-10" };
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className={`${dims[size]} relative`}>
        <div className="absolute inset-0 rounded-full border-2 border-muted" />
        <div className="absolute inset-0 rounded-full border-2 border-t-hvhz-teal animate-spin" />
      </div>
      {label && <p className="text-sm text-muted-foreground animate-pulse">{label}</p>}
    </div>
  );
}
