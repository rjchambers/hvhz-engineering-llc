import { cn } from "@/lib/utils";
import { BadgeCheck, FileText, Grid3X3, PenTool, Table2 } from "lucide-react";

const deliverables = [
  { icon: Grid3X3, label: "Zone-by-zone uplift pressures", detail: "ASCE 7-22" },
  { icon: Table2, label: "Fastener schedule & spacing", detail: "RAS 117 / 128" },
  { icon: FileText, label: "Code citations & methodology", detail: "FBC 8th Ed." },
  { icon: PenTool, label: "PE signature & seal", detail: "FL Licensed" },
];

/**
 * Hero visual: what a sealed HVHZ report contains. Sample zone bars are
 * explicitly labeled as an example — nothing here pretends to be live data.
 */
export function FloatingCalcCard() {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md p-6 max-w-sm w-full",
        "animate-float",
        "shadow-[0_0_50px_hsl(224_76%_48%/0.15)]"
      )}
      style={{ transform: "perspective(800px) rotateY(-2deg) rotateX(1deg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Every order includes</p>
          <p className="text-sm font-semibold text-white mt-0.5 font-display">The Sealed Report</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-hvhz-teal/20">
          <BadgeCheck className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Deliverable rows */}
      <div className="space-y-3 mb-5">
        {deliverables.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06] border border-white/10">
              <row.icon className="h-3.5 w-3.5 text-white/70" />
            </div>
            <span className="flex-1 text-xs text-white/80">{row.label}</span>
            <span className="text-[10px] font-mono text-white/35">{row.detail}</span>
          </div>
        ))}
      </div>

      {/* Sample zone pressure bars */}
      <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">Uplift by roof zone</span>
          <span className="text-[9px] font-mono text-white/30 border border-white/15 rounded px-1.5 py-0.5">EXAMPLE</span>
        </div>
        <div className="flex items-end gap-1.5 h-10">
          {[
            { zone: "1", h: "40%", cls: "bg-white/25" },
            { zone: "2", h: "65%", cls: "bg-white/45" },
            { zone: "3", h: "100%", cls: "bg-hvhz-teal" },
          ].map((bar) => (
            <div key={bar.zone} className="flex flex-col items-center gap-1 flex-1">
              <div className={cn("w-full rounded-sm", bar.cls)} style={{ height: bar.h }} />
              <span className="text-[9px] text-white/30 font-mono">Z{bar.zone}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
