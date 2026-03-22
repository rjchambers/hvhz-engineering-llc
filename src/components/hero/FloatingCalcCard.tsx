import { cn } from "@/lib/utils";

export function FloatingCalcCard() {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 max-w-xs w-full",
        "animate-float",
        "hover:[transform:perspective(800px)_rotateY(0deg)_rotateX(0deg)] transition-transform duration-500",
        "shadow-[0_0_40px_rgba(13,148,136,0.1)]"
      )}
      style={{ transform: "perspective(800px) rotateY(-2deg) rotateX(1deg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Live Calculation</p>
          <p className="text-sm font-semibold text-white mt-0.5">Fastener Uplift — Zone 3</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-hvhz-teal/20">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-hvhz-teal" fill="currentColor">
            <path d="M8 1l2 3h5l-4 3 1.5 5L8 9.5 3.5 12 5 7 1 4h5z" />
          </svg>
        </div>
      </div>

      {/* Data rows */}
      <div className="space-y-2.5 mb-4">
        {[
          { label: "Design Wind Speed", value: "185 mph" },
          { label: "Uplift Pressure", value: "-67.4 psf" },
          { label: "Fastener Capacity", value: "94.2 psf" },
          { label: "Safety Factor", value: "1.40" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[11px] text-white/50">{row.label}</span>
            <span className="text-xs font-mono font-medium text-white tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-1.5 h-10 mb-4">
        {[
          { zone: "1", h: "40%", color: "bg-hvhz-teal/40" },
          { zone: "2", h: "65%", color: "bg-hvhz-teal/60" },
          { zone: "3", h: "100%", color: "bg-hvhz-teal" },
        ].map((bar) => (
          <div key={bar.zone} className="flex flex-col items-center gap-1 flex-1">
            <div className={cn("w-full rounded-sm", bar.color)} style={{ height: bar.h }} />
            <span className="text-[9px] text-white/30 font-mono">Z{bar.zone}</span>
          </div>
        ))}
      </div>

      {/* Result badge */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <span className="text-[10px] text-white/40 font-mono">PE STATUS</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-hvhz-green bg-hvhz-green/10 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-hvhz-green animate-pulse" />
          PASS — Approved
        </span>
      </div>
    </div>
  );
}
