import { cn } from "@/lib/utils";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
}

export function BrandMark({ size = "md", variant = "dark" }: BrandMarkProps) {
  const isLight = variant === "light";

  const sizes = {
    sm: {
      hvhz: "text-xl",
      eng: "text-[10px] tracking-[0.18em]",
      llc: "text-[8px] tracking-[0.22em]",
      bar: "w-[2px]",
      underline: "h-[2px]",
    },
    md: {
      hvhz: "text-3xl",
      eng: "text-sm tracking-[0.2em]",
      llc: "text-[10px] tracking-[0.24em]",
      bar: "w-[3px]",
      underline: "h-[2px]",
    },
    lg: {
      hvhz: "text-5xl",
      eng: "text-lg tracking-[0.22em]",
      llc: "text-xs tracking-[0.26em]",
      bar: "w-[4px]",
      underline: "h-[3px]",
    },
  };

  const s = sizes[size];
  const textColor = isLight ? "text-white" : "text-primary";
  const mutedColor = isLight ? "text-white/60" : "text-muted-foreground";

  return (
    <div className="flex flex-col select-none">
      <div className="flex items-center gap-2">
        {/* HVHZ */}
        <span
          className={cn(s.hvhz, "font-black leading-none tracking-tight", textColor)}
        >
          HVHZ
        </span>

        {/* Teal divider */}
        <div className={cn(s.bar, "self-stretch rounded-full bg-hvhz-teal")} />

        {/* Engineering LLC */}
        <div className="flex flex-col justify-center">
          <span className={cn(s.eng, "font-bold uppercase leading-tight", textColor)}>
            Engineering
          </span>
          <span className={cn(s.llc, "font-semibold uppercase leading-tight mt-px", mutedColor)}>
            LLC
          </span>
        </div>
      </div>

      {/* Accent underline */}
      <div className={cn("w-full rounded-full mt-1.5", s.underline, "bg-gradient-to-r from-hvhz-teal via-hvhz-teal/50 to-transparent")} />
    </div>
  );
}
