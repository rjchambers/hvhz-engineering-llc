import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { DispatchFields, type DispatchValues } from "./DispatchFields";
import {
  useBulkDispatch,
  useRoleDirectory,
} from "@/hooks/useWorkOrders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  onDone: () => void;
}

export function BulkDispatchDialog({ open, onOpenChange, ids, onDone }: Props) {
  const { data: directory } = useRoleDirectory();
  const techs = directory?.techs ?? [];
  const engineers = directory?.engineers ?? [];
  const bulkDispatch = useBulkDispatch();

  const [values, setValues] = useState<DispatchValues>({
    technicianId: "",
    engineerId: "",
    date: new Date(),
  });

  // Pre-fill with the first tech/engineer once the directory loads.
  useEffect(() => {
    if (!open) return;
    setValues((prev) => ({
      technicianId: prev.technicianId || techs[0]?.user_id || "",
      engineerId: prev.engineerId || engineers[0]?.user_id || "",
      date: prev.date ?? new Date(),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, techs.length, engineers.length]);

  const handleDispatch = async () => {
    if (!values.technicianId) {
      toast.error("Pick a technician");
      return;
    }
    try {
      await bulkDispatch.mutateAsync({
        ids,
        technicianId: values.technicianId,
        engineerId: values.engineerId || null,
        scheduledDate: values.date ? format(values.date, "yyyy-MM-dd") : null,
      });
      toast.success(
        `Dispatched ${ids.length} work order${ids.length !== 1 ? "s" : ""}`
      );
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(
        "Bulk dispatch failed: " +
          (err instanceof Error ? err.message : "unknown error")
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Bulk dispatch {ids.length} work order{ids.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Assigns the same technician, engineer, and date to every selected
            in-house work order awaiting dispatch.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <DispatchFields
            techs={techs}
            engineers={engineers}
            value={values}
            onChange={setValues}
            techRequired
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDispatch}
            disabled={bulkDispatch.isPending || !values.technicianId}
            className="bg-hvhz-navy hover:bg-hvhz-navy/90"
          >
            {bulkDispatch.isPending ? "Dispatching…" : `Dispatch ${ids.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
