import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
}

export function BrandMark({ size = "md", variant = "dark" }: BrandMarkProps) {
  const scales = {
    sm: { heading: "text-lg", sub: "text-[7px]", tracking: "tracking-[0.12em]", gap: "gap-0", bar: "h-[2px]" },
    md: { heading: "text-2xl", sub: "text-[9px]", tracking: "tracking-[0.14em]", gap: "gap-0.5", bar: "h-[2px]" },
    lg: { heading: "text-4xl", sub: "text-[11px]", tracking: "tracking-[0.16em]", gap: "gap-1", bar: "h-[3px]" },
  };
  const s = scales[size];
  const isLight = variant === "light";

  return (
    <div className={cn("flex flex-col select-none", s.gap)}>
      <div className="flex items-baseline gap-[0.15em]">
        <span
          className={cn(
            s.heading,
            "font-black leading-none",
            isLight ? "text-white" : "text-primary"
          )}
          style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
        >
          HVHZ
        </span>
        <div
          className={cn(
            "w-[3px] self-stretch rounded-full mx-[0.1em]",
            isLight ? "bg-hvhz-teal" : "bg-hvhz-teal"
          )}
        />
        <div className="flex flex-col justify-center">
          <span
            className={cn(
              s.sub,
              "font-semibold uppercase leading-tight",
              s.tracking,
              isLight ? "text-white/90" : "text-primary/80"
            )}
          >
            Engineering
          </span>
          <span
            className={cn(
              "font-medium uppercase leading-tight",
              isLight ? "text-white/50" : "text-muted-foreground",
              size === "sm" ? "text-[5px] tracking-[0.2em]" :
              size === "md" ? "text-[6px] tracking-[0.22em]" :
              "text-[8px] tracking-[0.24em]"
            )}
          >
            LLC
          </span>
        </div>
      </div>
      <div className={cn("w-full rounded-full", s.bar, "bg-gradient-to-r from-hvhz-teal via-hvhz-teal/60 to-transparent")} />
    </div>
  );
}
