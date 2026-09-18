import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteWorkOrder,
  useUpdateWorkOrder,
  type WorkOrderRow,
} from "@/hooks/useWorkOrders";

type Action = "complete" | "archive" | "reopen" | "delete";

const ACTION_COPY: Record<
  Action,
  { title: string; description: string; confirm: string; destructive?: boolean }
> = {
  complete: {
    title: "Mark this work order complete?",
    description:
      "This closes the work order outside the normal workflow — no field data, PE review, or signed report is required or created.",
    confirm: "Mark Complete",
  },
  archive: {
    title: "Archive this work order?",
    description:
      "Archived work orders leave the active pipeline but keep all their data. You can reopen them later.",
    confirm: "Archive",
  },
  reopen: {
    title: "Reopen this work order?",
    description:
      "The work order returns to Pending Dispatch and re-enters the active pipeline.",
    confirm: "Reopen",
  },
  delete: {
    title: "Permanently delete this work order?",
    description:
      "This deletes the work order along with its field data, photos, and signed documents. This cannot be undone.",
    confirm: "Delete Permanently",
    destructive: true,
  },
};

export function AdminActionsCard({ workOrder: wo }: { workOrder: WorkOrderRow }) {
  const navigate = useNavigate();
  const updateWO = useUpdateWorkOrder();
  const deleteWO = useDeleteWorkOrder();
  const [pending, setPending] = useState<Action | null>(null);

  const run = async (action: Action) => {
    try {
      if (action === "delete") {
        await deleteWO.mutateAsync(wo.id);
        toast.success("Work order deleted");
        navigate("/admin/work-orders");
        return;
      }
      const status =
        action === "complete"
          ? "complete"
          : action === "archive"
            ? "archived"
            : "pending_dispatch";
      await updateWO.mutateAsync({ id: wo.id, patch: { status } });
      toast.success(
        action === "complete"
          ? "Marked complete"
          : action === "archive"
            ? "Archived"
            : "Reopened"
      );
    } catch (err) {
      toast.error(
        "Failed: " + (err instanceof Error ? err.message : "unknown error")
      );
    }
  };

  const copy = pending ? ACTION_COPY[pending] : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-hvhz-teal" />
          Admin Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Force-close or archive this work order regardless of pipeline stage.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {wo.status !== "complete" && wo.status !== "signed" && (
            <Button
              size="sm"
              variant="outline"
              className="text-hvhz-green border-hvhz-green/30 hover:bg-hvhz-green/5"
              onClick={() => setPending("complete")}
            >
              Mark Complete
            </Button>
          )}
          {wo.status !== "archived" && (
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => setPending("archive")}
            >
              Archive
            </Button>
          )}
          {(wo.status === "archived" || wo.status === "complete") && (
            <Button
              size="sm"
              variant="outline"
              className="col-span-2"
              onClick={() => setPending("reopen")}
            >
              Reopen → Pending Dispatch
            </Button>
          )}
        </div>
        <div className="pt-3 mt-2 border-t border-dashed">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-hvhz-red border-hvhz-red/30 hover:bg-hvhz-red/5"
            onClick={() => setPending("delete")}
          >
            Delete Work Order Permanently
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                copy?.destructive
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={() => {
                if (pending) run(pending);
                setPending(null);
              }}
            >
              {copy?.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
