import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BOARD_COLUMNS,
  TAS_SERVICES,
  daysSince,
  isLegalTransition,
  statusLabel,
} from "@/lib/work-order-status";
import { getServiceName } from "@/lib/services";
import {
  useUpdateWorkOrder,
  type BoardWorkOrder,
} from "@/hooks/useWorkOrders";

interface Props {
  workOrders: BoardWorkOrder[];
}

interface PendingMove {
  wo: BoardWorkOrder;
  to: string;
}

export function PipelineBoard({ workOrders }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateWO = useUpdateWorkOrder();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const applyMove = async (wo: BoardWorkOrder, to: string) => {
    // Optimistic: move the card immediately, roll back via invalidation on error.
    qc.setQueryData<BoardWorkOrder[]>(["work-orders", "board"], (rows) =>
      rows?.map((r) => (r.id === wo.id ? { ...r, status: to } : r))
    );
    try {
      await updateWO.mutateAsync({ id: wo.id, patch: { status: to } });
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDrop = (to: string) => {
    setDragOver(null);
    const wo = workOrders.find((w) => w.id === dragging);
    setDragging(null);
    if (!wo || wo.status === to) return;
    if (isLegalTransition(wo.status, to)) {
      applyMove(wo, to);
    } else {
      // Skipping pipeline stages needs an explicit override.
      setPendingMove({ wo, to });
    }
  };

  const openDetail = (id: string) => navigate(`/admin/work-orders/${id}`);

  const renderCard = (wo: BoardWorkOrder, draggable: boolean) => {
    const isTas = TAS_SERVICES.includes(wo.service_type);
    return (
      <div
        key={wo.id}
        draggable={draggable}
        onDragStart={draggable ? () => setDragging(wo.id) : undefined}
        onClick={() => openDetail(wo.id)}
        className={cn(
          "rounded-md p-3 shadow-sm border transition-all hover:shadow-md hover:border-hvhz-teal/30",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          dragging === wo.id && "shadow-elevated-hover scale-[1.02] opacity-90",
          isTas
            ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
            : "bg-card border-border/50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-primary truncate">
            {wo.client_profiles?.company_name || "—"}
          </p>
          <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">
            {wo.wo_number ? `#${wo.wo_number}` : wo.id.slice(0, 6).toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {getServiceName(wo.service_type)}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {wo.orders?.job_address || "—"}
          {wo.orders?.job_city ? `, ${wo.orders.job_city}` : ""}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-muted-foreground/70">
            {daysSince(wo.created_at)}d ago
          </p>
          {wo.scheduled_date && (
            <p className="text-[10px] text-muted-foreground/70">
              {wo.scheduled_date}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop board */}
      <div className="hidden md:flex gap-3 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((col) => {
          const items = workOrders.filter((w) => w.status === col);
          return (
            <div
              key={col}
              className={cn(
                "min-w-[230px] flex-1 rounded-lg transition-colors",
                dragOver === col
                  ? "bg-hvhz-teal/10 ring-2 ring-hvhz-teal/30"
                  : "bg-muted/50"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col)}
            >
              <div className="p-3 border-b border-border bg-hvhz-teal/5 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {statusLabel(col)}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {items.length}
                  </Badge>
                </div>
              </div>
              <div className="p-2 space-y-2 min-h-[120px]">
                {items.map((wo) => renderCard(wo, true))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile list */}
      <div className="md:hidden space-y-2">
        {BOARD_COLUMNS.map((col) => {
          const items = workOrders.filter((w) => w.status === col);
          if (items.length === 0) return null;
          return (
            <div key={col}>
              <div className="flex items-center justify-between py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {statusLabel(col)}
                </h3>
                <Badge variant="secondary" className="text-[10px] h-5">
                  {items.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {items.map((wo) => renderCard(wo, false))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Override confirm for drags that skip the workflow */}
      <AlertDialog
        open={!!pendingMove}
        onOpenChange={(o) => !o && setPendingMove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip pipeline stages?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove && (
                <>
                  Moving this work order from{" "}
                  <strong>{statusLabel(pendingMove.wo.status)}</strong> to{" "}
                  <strong>{statusLabel(pendingMove.to)}</strong> bypasses the
                  normal workflow (dispatch, field data, PE review). The status
                  will change but no assignments, submissions, or signatures
                  are created.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMove) applyMove(pendingMove.wo, pendingMove.to);
                setPendingMove(null);
              }}
            >
              Move anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
