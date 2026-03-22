import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CalcStatusBadgeProps {
  status: "pass" | "fail" | "warning";
  label: string;
}

const statusClasses: Record<string, string> = {
  pass: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
};

export function CalcStatusBadge({ status, label }: CalcStatusBadgeProps) {
  return (
    <Badge className={cn("text-[10px]", statusClasses[status])}>
      {status === "pass" ? "✅" : status === "fail" ? "🔴" : "⚠️"} {label}
    </Badge>
  );
}
