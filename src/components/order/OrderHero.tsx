import { BrandMark } from "@/components/BrandMark";
import { Shield, FileCode2, Clock } from "lucide-react";

export function OrderHero() {
  return (
    <section className="relative overflow-hidden hero-gradient px-6 pt-24 pb-12 md:pt-28 md:pb-16">
      <div className="absolute inset-0 grid-pattern opacity-60" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-hvhz-teal/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="flex justify-center mb-4">
          <BrandMark size="lg" variant="light" />
        </div>
        <h1
          className="text-display text-2xl md:text-3xl text-white"
          style={{ textWrap: "balance" }}
        >
          Order Engineering Services
        </h1>
        <p className="mt-3 text-sm md:text-base text-white/50 max-w-lg mx-auto" style={{ textWrap: "balance" }}>
          Permit-ready roof engineering for South Florida's High-Velocity Hurricane Zone
        </p>
        <div className="mt-5 flex items-center justify-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
            <Shield className="h-3.5 w-3.5 text-hvhz-teal/60" />
            FL PE Licensed
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
            <FileCode2 className="h-3.5 w-3.5 text-hvhz-teal/60" />
            FBC 8th Edition
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
            <Clock className="h-3.5 w-3.5 text-hvhz-teal/60" />
            24hr Turnaround
          </div>
        </div>
      </div>
    </section>
  );
}
