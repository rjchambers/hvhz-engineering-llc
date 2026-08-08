import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
}

export function BrandMark({ size = "md", showText = true, variant = "dark" }: BrandMarkProps) {
  const isLight = variant === "light";

  const sizes = {
    sm: {
      hvhz: "text-xl",
      eng: "text-[9px] tracking-[0.22em]",
      llc: "text-[8px] tracking-[0.24em]",
      bar: "w-[2px]",
    },
    md: {
      hvhz: "text-[1.7rem]",
      eng: "text-[11px] tracking-[0.26em]",
      llc: "text-[9px] tracking-[0.28em]",
      bar: "w-[2.5px]",
    },
    lg: {
      hvhz: "text-5xl",
      eng: "text-base tracking-[0.28em]",
      llc: "text-[11px] tracking-[0.3em]",
      bar: "w-[3px]",
    },
  };

  const s = sizes[size];
  const textColor = isLight ? "text-white" : "text-primary";
  const mutedColor = isLight ? "text-white/50" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* HVHZ wordmark */}
      <span className={cn(s.hvhz, "font-display font-bold leading-none tracking-tight", textColor)}>
        HVHZ
      </span>

      {showText && (
        <>
          {/* Accent divider */}
          <div className={cn(s.bar, "self-stretch rounded-full bg-hvhz-teal")} />

          <div className="flex flex-col justify-center">
            <span className={cn(s.eng, "font-semibold uppercase leading-tight", textColor)}>
              Engineering
            </span>
            <span className={cn(s.llc, "font-medium uppercase leading-tight mt-px", mutedColor)}>
              LLC
            </span>
          </div>
        </>
      )}
    </div>
  );
}
