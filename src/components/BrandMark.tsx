interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
}

export function BrandMark({ size = "md", showText = true, subtitle, variant = "dark" }: BrandMarkProps) {
  const dims = { sm: "h-7 w-7", md: "h-8 w-8", lg: "h-11 w-11" };
  const textSz = { sm: "text-xs", md: "text-sm", lg: "text-lg" };
  const subSz = { sm: "text-[9px]", md: "text-[11px]", lg: "text-xs" };

  const textColor = variant === "light" ? "text-white" : "text-primary";
  const subOpacity = variant === "light" ? "opacity-60" : "opacity-50";

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${dims[size]} flex items-center justify-center rounded-lg bg-hvhz-teal flex-shrink-0`}>
        <svg viewBox="0 0 32 32" className="w-[62%] h-[62%]">
          <path d="M5 24V8h4.5v5.5h7V8H21v16h-4.5v-5.5h-7V24H5z" fill="white" />
        </svg>
      </div>
      {showText && (
        <div className="leading-tight min-w-0">
          <p className={`${textSz[size]} font-extrabold tracking-tight ${textColor}`}>HVHZ</p>
          <p className={`${subSz[size]} ${textColor} ${subOpacity} font-medium`}>{subtitle || "Engineering"}</p>
        </div>
      )}
    </div>
  );
}
