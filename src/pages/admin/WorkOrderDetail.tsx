import { Link, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  FileUp,
  Layers,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { daysSince, isOutsourced } from "@/lib/work-order-status";
import { getServiceName, formatCurrency } from "@/lib/services";
import { OrderInfoPanel } from "@/components/order/OrderInfoPanel";
import { WorkOrderStatusBadge } from "@/components/admin/WorkOrderStatusBadge";
import { WorkOrderStages } from "@/components/admin/WorkOrderStages";
import { DispatchPanel } from "@/components/admin/DispatchPanel";
import { AdminActionsCard } from "@/components/admin/AdminActionsCard";
import {
  useSiblingWorkOrders,
  useUpdateWorkOrder,
  useWorkOrder,
  type WorkOrderRow,
} from "@/hooks/useWorkOrders";

function ResultUploadCard({ workOrder: wo }: { workOrder: WorkOrderRow }) {
  const [uploading, setUploading] = useState(false);
  const updateWO = useUpdateWorkOrder();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const path = `work_orders/${wo.id}/result.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(path, file, { upsert: true });
    if (uploadErr) {
      toast.error("Upload failed: " + uploadErr.message);
      setUploading(false);
      return;
    }

    // Private bucket → long-lived signed URL rather than a public one.
    const { data: signedData, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signErr || !signedData?.signedUrl) {
      toast.error("Uploaded but could not generate URL");
      setUploading(false);
      return;
    }

    try {
      await updateWO.mutateAsync({
        id: wo.id,
        patch: { result_pdf_url: signedData.signedUrl, status: "submitted" },
      });
      toast.success("Result uploaded, status set to submitted");
    } catch {
      toast.error("Uploaded but failed to update the work order");
    }
    setUploading(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
          <FileUp className="h-4 w-4 text-hvhz-teal" />
          Upload Test Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-hvhz-teal transition-colors">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {uploading ? "Uploading…" : "Upload result PDF"}
          </span>
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </CardContent>
    </Card>
  );
}

function RejectedCard({ workOrder: wo }: { workOrder: WorkOrderRow }) {
  const updateWO = useUpdateWorkOrder();
  const handleReDispatch = async () => {
    try {
      await updateWO.mutateAsync({
        id: wo.id,
        patch: { status: "pending_dispatch", rejection_notes: null },
      });
      toast.success("Re-dispatched");
    } catch {
      toast.error("Failed to re-dispatch");
    }
  };

  return (
    <Card className="border-hvhz-red/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Rejected
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {wo.rejection_notes && (
          <p className="text-sm bg-red-50 p-3 rounded">{wo.rejection_notes}</p>
        )}
        <Button
          onClick={handleReDispatch}
          disabled={updateWO.isPending}
          className="w-full"
          variant="outline"
        >
          Re-Dispatch
        </Button>
      </CardContent>
    </Card>
  );
}

function SiblingsCard({ workOrder: wo }: { workOrder: WorkOrderRow }) {
  const { data: siblings = [] } = useSiblingWorkOrders(wo.order_id, wo.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
          <Layers className="h-4 w-4 text-hvhz-teal" />
          Parent Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {wo.orders?.created_at && (
            <p>
              <span className="text-muted-foreground">Ordered:</span>{" "}
              {new Date(wo.orders.created_at).toLocaleDateString()}
            </p>
          )}
          {wo.orders?.total_amount != null && (
            <p>
              <span className="text-muted-foreground">Order Total:</span>{" "}
              {formatCurrency(wo.orders.total_amount)}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">Services on Order:</span>{" "}
            {siblings.length + 1}
          </p>
        </div>
        {siblings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Other work orders on this order
            </p>
            {siblings.map((s) => (
              <Link
                key={s.id}
                to={`/admin/work-orders/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-md border p-2.5 hover:border-hvhz-teal/40 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getServiceName(s.service_type)}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {s.wo_number ? `#${s.wo_number}` : s.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <WorkOrderStatusBadge status={s.status} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: wo, isLoading } = useWorkOrder(id);

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <Link
          to="/admin/work-orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Work Orders
        </Link>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && !wo && (
          <div className="rounded-lg border bg-card p-16 text-center">
            <p className="text-sm font-medium text-primary">
              Work order not found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              It may have been deleted.
            </p>
          </div>
        )}

        {wo && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-primary">
                  {getServiceName(wo.service_type)}
                  <span className="ml-3 font-mono text-base text-muted-foreground font-normal">
                    {wo.wo_number
                      ? `#${wo.wo_number}`
                      : `#${wo.id.slice(0, 8).toUpperCase()}`}
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {wo.client_profiles?.company_name ?? "Unknown client"} ·
                  created {daysSince(wo.created_at)}d ago
                  {wo.scheduled_date && ` · scheduled ${wo.scheduled_date}`}
                </p>
              </div>
              <WorkOrderStatusBadge status={wo.status} className="text-xs" />
            </div>

            {/* Stage timeline */}
            <Card>
              <CardContent className="pt-5">
                <WorkOrderStages status={wo.status} />
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Left: order + client info, siblings */}
              <div className="lg:col-span-2 space-y-6">
                <OrderInfoPanel
                  order={wo.orders}
                  client={wo.client_profiles}
                  workOrderServiceType={wo.service_type}
                  workOrderRejectionNotes={
                    wo.status === "rejected" ? wo.rejection_notes : null
                  }
                />
                <SiblingsCard workOrder={wo} />
              </div>

              {/* Right: actions, top-down in workflow order */}
              <div className="space-y-6">
                {(wo.status === "pending_dispatch" ||
                  wo.status === "dispatched") && (
                  <DispatchPanel workOrder={wo} />
                )}
                {isOutsourced(wo.service_type) &&
                  wo.status === "dispatched" && (
                    <ResultUploadCard workOrder={wo} />
                  )}
                {wo.status === "rejected" && <RejectedCard workOrder={wo} />}
                <AdminActionsCard workOrder={wo} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
