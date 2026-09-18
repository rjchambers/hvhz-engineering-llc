import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { isOutsourced } from "@/lib/work-order-status";
import { getServiceName } from "@/lib/services";
import {
  useInvalidateWorkOrders,
  usePartners,
  useRoleDirectory,
  useUpdateWorkOrder,
  type WorkOrderRow,
} from "@/hooks/useWorkOrders";
import { DispatchFields, type DispatchValues } from "./DispatchFields";

interface Props {
  workOrder: WorkOrderRow;
}

/**
 * Assignment / dispatch card for a single work order. In-house services get
 * the tech/engineer/date fields; outsourced services get the lab-partner
 * email flow (server-side dispatch-to-lab edge function).
 */
export function DispatchPanel({ workOrder: wo }: Props) {
  const { data: directory } = useRoleDirectory();
  const techs = useMemo(() => directory?.techs ?? [], [directory]);
  const engineers = useMemo(() => directory?.engineers ?? [], [directory]);
  const { data: partners = [] } = usePartners();
  const updateWO = useUpdateWorkOrder();
  const invalidate = useInvalidateWorkOrders();

  const [values, setValues] = useState<DispatchValues>({
    technicianId: wo.assigned_technician_id ?? "",
    engineerId: wo.assigned_engineer_id ?? "",
    date: wo.scheduled_date ? new Date(wo.scheduled_date) : undefined,
  });
  const [partnerId, setPartnerId] = useState("");
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const outsourced = isOutsourced(wo.service_type);
  const availablePartners = partners.filter((p) =>
    p.services.includes(wo.service_type)
  );
  const selectedPartner =
    availablePartners.find((p) => p.id === partnerId) ??
    (availablePartners.length === 1 ? availablePartners[0] : undefined);

  // Suggest a technician from the most recent assignment for this service,
  // and default the engineer to the first available PE.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!wo.assigned_technician_id) {
        const { data: recent } = await supabase
          .from("work_orders")
          .select("assigned_technician_id")
          .eq("service_type", wo.service_type)
          .not("assigned_technician_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && recent?.assigned_technician_id) {
          setValues((prev) =>
            prev.technicianId
              ? prev
              : { ...prev, technicianId: recent.assigned_technician_id! }
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wo.id, wo.service_type, wo.assigned_technician_id]);

  useEffect(() => {
    if (!wo.assigned_engineer_id && engineers.length > 0) {
      setValues((prev) =>
        prev.engineerId ? prev : { ...prev, engineerId: engineers[0].user_id }
      );
    }
  }, [wo.id, wo.assigned_engineer_id, engineers]);

  const resolveTemplate = (template: string): string => {
    if (!selectedPartner) return template;
    return template
      .replace(/\{\{contact_name\}\}/g, selectedPartner.contact_name ?? "")
      .replace(/\{\{service_name\}\}/g, getServiceName(wo.service_type))
      .replace(/\{\{job_address\}\}/g, wo.orders?.job_address ?? "")
      .replace(/\{\{job_city\}\}/g, wo.orders?.job_city ?? "")
      .replace(/\{\{job_zip\}\}/g, wo.orders?.job_zip ?? "")
      .replace(
        /\{\{client_company\}\}/g,
        wo.client_profiles?.company_name ?? ""
      )
      .replace(
        /\{\{work_order_id\}\}/g,
        wo.wo_number ? String(wo.wo_number) : wo.id.slice(0, 8).toUpperCase()
      )
      .replace(
        /\{\{scheduled_date\}\}/g,
        values.date ? format(values.date, "MMMM d, yyyy") : "TBD"
      );
  };

  const dispatchToLab = async () => {
    if (!selectedPartner) {
      toast.error("Select a lab partner");
      return;
    }
    setDispatching(true);
    // The dispatch-to-lab edge function emails the partner (CC admin) with
    // the submitted files attached, then stamps the work order server-side,
    // so outsource_email_sent_at only ever reflects a confirmed send.
    const { data, error } = await supabase.functions.invoke("dispatch-to-lab", {
      body: { workOrderId: wo.id, partnerId: selectedPartner.id },
    });
    setDispatching(false);
    if (error || data?.error) {
      // On a non-2xx the server's JSON body lives on error.context (a
      // Response); pull the real message out so failures aren't opaque.
      let message = data?.error ?? error?.message ?? "unknown error";
      const ctx = (error as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          message = (await ctx.json())?.error ?? message;
        } catch {
          /* keep message */
        }
      }
      if (/failed to send|fetch/i.test(message)) {
        message =
          "the dispatch-to-lab function isn’t deployed on Supabase yet. Deploy it, then retry.";
      }
      toast.error("Dispatch failed: " + message);
    } else {
      const missing: string[] = data?.missing ?? [];
      toast.success(
        `Emailed ${data?.partner ?? "lab"}` +
          (data?.attached?.length
            ? ` with ${data.attached.length} file(s)`
            : "") +
          (missing.length ? ` (couldn't attach: ${missing.join(", ")})` : "")
      );
      invalidate();
    }
  };

  const dispatchInHouse = async () => {
    try {
      await updateWO.mutateAsync({
        id: wo.id,
        patch: {
          status: "dispatched",
          assigned_technician_id: values.technicianId || null,
          assigned_engineer_id: values.engineerId || null,
          scheduled_date: values.date ? format(values.date, "yyyy-MM-dd") : null,
        },
      });
      toast.success(
        wo.status === "dispatched" ? "Assignment updated" : "Work order dispatched"
      );
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
          <Send className="h-4 w-4 text-hvhz-teal" />
          {wo.status === "dispatched" ? "Update Assignment" : "Dispatch"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {outsourced ? (
          <>
            {availablePartners.length === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">
                    No active partners configured for{" "}
                    {getServiceName(wo.service_type)}.
                  </p>
                  <Link
                    to="/admin/settings"
                    className="text-amber-700 underline text-xs mt-1 inline-flex items-center gap-1"
                  >
                    Go to Settings → Outsource Partners{" "}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Select Lab / Partner</Label>
                  <Select
                    value={selectedPartner?.id ?? ""}
                    onValueChange={setPartnerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a partner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePartners.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.contact_email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPartner && (
                  <>
                    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-0.5">
                      <p>
                        <span className="text-muted-foreground">Contact:</span>{" "}
                        {selectedPartner.contact_name ?? "—"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Email:</span>{" "}
                        {selectedPartner.contact_email}
                      </p>
                      <p>
                        <span className="text-muted-foreground">CC:</span>{" "}
                        admin@hvhz.us
                      </p>
                    </div>

                    {(() => {
                      const files = [
                        wo.orders?.noa_document_name && "NOA document",
                        wo.orders?.roof_report_name && "Roof report",
                      ].filter(Boolean);
                      return (
                        <p className="text-xs text-muted-foreground">
                          {files.length
                            ? `Attachments: ${files.join(", ")}`
                            : "No submitted files to attach for this order."}
                        </p>
                      );
                    })()}

                    {selectedPartner.email_template && (
                      <Collapsible
                        open={emailPreviewOpen}
                        onOpenChange={setEmailPreviewOpen}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-between text-xs"
                          >
                            Preview Work Order Email
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                emailPreviewOpen && "rotate-180"
                              )}
                            />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="font-mono text-xs bg-muted rounded p-3 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {resolveTemplate(selectedPartner.email_template)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </>
                )}

                <Button
                  onClick={dispatchToLab}
                  disabled={dispatching || !selectedPartner}
                  className="w-full bg-hvhz-navy hover:bg-hvhz-navy/90"
                >
                  {dispatching ? "Emailing lab…" : "Email Lab & Dispatch"}
                </Button>
              </>
            )}

            <div className="text-center pt-1">
              <Link
                to="/admin/settings"
                className="text-xs text-muted-foreground hover:text-primary underline inline-flex items-center gap-1"
              >
                Manage Labs <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <DispatchFields
              techs={techs}
              engineers={engineers}
              value={values}
              onChange={setValues}
            />
            <Button
              onClick={dispatchInHouse}
              disabled={updateWO.isPending}
              className="w-full bg-hvhz-navy hover:bg-hvhz-navy/90"
            >
              {updateWO.isPending
                ? "Saving…"
                : wo.status === "dispatched"
                  ? "Update Assignment"
                  : "Dispatch"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
