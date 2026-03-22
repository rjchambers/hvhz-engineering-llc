import logoSrc from "@/assets/logo.jpg";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: string;
  variant?: "dark" | "light";
}

export function BrandMark({ size = "md", showText = true, subtitle, variant = "dark" }: BrandMarkProps) {
  const dims = { sm: "h-8", md: "h-10", lg: "h-14" };

  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoSrc}
        alt="HVHZ Engineering"
        className={`${dims[size]} w-auto object-contain flex-shrink-0`}
      />
    </div>
  );
}
