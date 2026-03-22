import logoLightSrc from "@/assets/logo-light.png";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
}

export function BrandMark({ size = "md" }: BrandMarkProps) {
  const dims = { sm: "h-12", md: "h-16", lg: "h-24" };

  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoLightSrc}
        alt="HVHZ Engineering"
        className={`${dims[size]} w-auto object-contain flex-shrink-0`}
      />
    </div>
  );
}
