import { cn } from "@/lib/utils";

interface CalcSummaryCardProps {
  label: string;
  value: string;
  unit?: string;
  variant?: "default" | "destructive" | "success" | "warning";
}

const variantClasses: Record<string, string> = {
  default: "",
  destructive: "text-destructive",
  success: "text-green-600",
  warning: "text-amber-600",
};

export function CalcSummaryCard({ label, value, unit, variant = "default" }: CalcSummaryCardProps) {
  return (
    <div className="border rounded-lg p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold font-mono", variantClasses[variant])}>
        {value}{unit && <span className="text-xs font-normal ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
