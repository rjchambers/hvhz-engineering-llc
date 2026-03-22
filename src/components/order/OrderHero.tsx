import { BrandMark } from "@/components/BrandMark";
import { Shield, FileCode2 } from "lucide-react";

export function OrderHero() {
  return (
    <section className="bg-primary px-6 py-10 md:py-14">
      <div className="mx-auto max-w-3xl text-center">
        <BrandMark size="md" subtitle="Engineering" />
        <p className="mt-3 text-sm text-white/50" style={{ textWrap: "balance" }}>
          Permit-ready roof engineering for South Florida's High-Velocity Hurricane Zone
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
            <Shield className="h-3.5 w-3.5" />
            FL PE Licensed
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-mono">
            <FileCode2 className="h-3.5 w-3.5" />
            FBC 8th Edition
          </div>
        </div>
      </div>
    </section>
  );
}
