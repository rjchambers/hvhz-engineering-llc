import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusBadgeClass, statusLabel } from "@/lib/work-order-status";

export function WorkOrderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <Badge className={cn("text-[11px]", statusBadgeClass(status), className)}>
      {statusLabel(status)}
    </Badge>
  );
}
