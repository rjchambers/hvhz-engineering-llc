import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { daysSince } from "@/lib/work-order-status";
import { getServiceName } from "@/lib/services";
import {
  WO_PAGE_SIZE,
  isBulkEligible,
  type WorkOrderRow,
} from "@/hooks/useWorkOrders";
import { WorkOrderStatusBadge } from "./WorkOrderStatusBadge";

interface Props {
  rows: WorkOrderRow[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

export function PipelineTable({
  rows,
  total,
  page,
  onPageChange,
  selectedIds,
  onToggleSelected,
  onSelectAll,
}: Props) {
  const navigate = useNavigate();
  const eligibleOnPage = rows.filter(isBulkEligible);
  const totalPages = Math.ceil(total / WO_PAGE_SIZE);

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    eligibleOnPage.length > 0 &&
                    eligibleOnPage.every((wo) => selectedIds.has(wo.id))
                  }
                  onCheckedChange={(v) =>
                    onSelectAll(
                      v === true ? eligibleOnPage.map((wo) => wo.id) : []
                    )
                  }
                  aria-label="Select all pending on page"
                />
              </TableHead>
              <TableHead>WO #</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Scheduled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((wo) => (
              <TableRow
                key={wo.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/admin/work-orders/${wo.id}`)}
              >
                <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                  {isBulkEligible(wo) && (
                    <Checkbox
                      checked={selectedIds.has(wo.id)}
                      onCheckedChange={() => onToggleSelected(wo.id)}
                      aria-label={`Select WO ${wo.wo_number ?? wo.id.slice(0, 8)}`}
                    />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {wo.wo_number
                    ? `#${wo.wo_number}`
                    : wo.id.slice(0, 8).toUpperCase()}
                </TableCell>
                <TableCell className="font-medium text-sm">
                  {getServiceName(wo.service_type)}
                </TableCell>
                <TableCell className="text-sm">
                  {wo.client_profiles?.company_name ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {wo.orders?.job_address ?? "—"}
                </TableCell>
                <TableCell>
                  <WorkOrderStatusBadge status={wo.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {daysSince(wo.created_at)}d
                </TableCell>
                <TableCell className="text-sm">
                  {wo.scheduled_date ?? "—"}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                >
                  No work orders found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">{total} total</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm flex items-center px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
