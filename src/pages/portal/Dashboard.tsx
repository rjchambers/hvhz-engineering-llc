import { useState, useEffect, useCallback, Fragment } from "react";
import { PortalLayout } from "@/components/PortalLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getServiceName, formatCurrency } from "@/lib/services";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/work-order-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, CalendarDays, PackageOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { saveWizardData, defaultWizardData } from "@/lib/wizard-data";
import type { Tables } from "@/integrations/supabase/types";

type Order = Tables<"orders">;
type WorkOrder = Tables<"work_orders">;

const TIMELINE_STEPS = [
  { key: "received", label: "Received" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_progress", label: "In Progress" },
  { key: "submitted", label: "Submitted" },
  { key: "pe_review", label: "PE Review" },
  { key: "complete", label: "Complete" },
];

function statusToTimelineIndex(status: string): number {
  const map: Record<string, number> = {
    pending_dispatch: 0, dispatched: 1, in_progress: 2,
    submitted: 3, pe_review: 4, signed: 5, complete: 5, rejected: 4,
  };
  return map[status] ?? 0;
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const className = STATUS_BADGE_CLASSES[status] ?? "bg-muted text-muted-foreground";
  return <Badge variant="secondary" className={cn("text-[11px] font-semibold px-2 py-0.5", className)}>{label}</Badge>;
}

function WorkOrderTimeline({ status }: { status: string }) {
  const activeIdx = statusToTimelineIndex(status);
  const isRejected = status === "rejected";

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-2">
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= activeIdx && !isRejected;
        const current = i === activeIdx;
        const rejected = isRejected && i === activeIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[64px]">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                rejected ? "bg-hvhz-red text-white" :
                done ? "bg-hvhz-teal text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {done && !rejected ? "✓" : i + 1}
              </div>
              <span className={`mt-1 text-[10px] leading-tight text-center ${
                current || rejected ? "font-semibold text-primary" : "text-muted-foreground"
              }`}>{step.label}</span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`h-0.5 w-4 sm:w-6 ${i < activeIdx && !isRejected ? "bg-hvhz-teal" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const [signedDoc, setSignedDoc] = useState<string | null>(null);

  useEffect(() => {
    if (wo.status === "complete" || wo.status === "signed") {
      supabase
        .from("signed_documents")
        .select("signed_pdf_url")
        .eq("work_order_id", wo.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.signed_pdf_url) setSignedDoc(data.signed_pdf_url);
        });
    }
  }, [wo.id, wo.status]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 shadow-elevated hover:shadow-elevated-hover transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">{getServiceName(wo.service_type)}</p>
          {wo.scheduled_date && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <CalendarDays className="h-3 w-3" />
              Scheduled: {new Date(wo.scheduled_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <StatusBadge status={wo.status} />
      </div>

      <WorkOrderTimeline status={wo.status} />

      {(wo.status === "complete" || wo.status === "signed") && signedDoc && (
        <Button
          size="sm"
          variant="outline"
          className="gap-2 text-hvhz-teal border-hvhz-teal/30 hover:bg-hvhz-teal/5"
          onClick={() => window.open(signedDoc, "_blank")}
        >
          <Download className="h-4 w-4" /> Download Report
        </Button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, WorkOrder[]>>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setOrders(data ?? []);
    }
    setLoading(false);
    setLastRefreshed(new Date());
  }, [user]);

  const fetchWorkOrders = useCallback(async (orderId: string) => {
    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setWorkOrders((prev) => ({ ...prev, [orderId]: data }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Realtime subscription for work_orders
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("client-work-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_orders",
          filter: `client_id=eq.${user.id}`,
        },
        (payload) => {
          const wo = payload.new as WorkOrder;
          if (wo?.order_id) {
            // Re-fetch work orders for the affected order
            fetchWorkOrders(wo.order_id);
            // Also refresh orders in case status rolled up
            fetchOrders();
            toast.info(`Work order updated: ${getServiceName(wo.service_type)}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchWorkOrders, fetchOrders]);

  const toggleExpand = (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
    } else {
      setExpandedOrder(orderId);
      if (!workOrders[orderId]) {
        fetchWorkOrders(orderId);
      }
    }
  };

  return (
    <PortalLayout>
      <div className="px-6 py-8 max-w-5xl mx-auto bg-gradient-to-b from-background to-muted/30 min-h-[calc(100vh-3.5rem)]">
        <h1 className="text-xl font-bold text-primary">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>

        {loading ? (
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-lg border bg-card p-12 text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-primary">Ready to get started?</p>
            <p className="text-xs text-muted-foreground mt-1">Place your first order to see it here.</p>
            <Button asChild className="mt-4 bg-hvhz-teal text-white hover:bg-hvhz-teal/90">
              <a href="/portal/new-order">Place Your First Order</a>
            </Button>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10" />
                  <TableHead className="text-xs">Order Date</TableHead>
                  <TableHead className="text-xs">Services</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                  <TableHead className="text-xs text-right">Status</TableHead>
                  <TableHead className="text-xs text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const isExpanded = expandedOrder === order.id;
                  const wos = workOrders[order.id] ?? [];

                  return (
                    <Fragment key={order.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleExpand(order.id)}
                      >
                        <TableCell className="w-10">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px]">
                          <span className="line-clamp-1">
                            {order.services.map((s) => getServiceName(s)).join(", ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium tabular-nums">
                          {order.total_amount != null ? formatCurrency(order.total_amount) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-hvhz-teal hover:text-hvhz-teal"
                            onClick={(e) => {
                              e.stopPropagation();
                              saveWizardData({
                                ...defaultWizardData,
                                job_address: order.job_address ?? "",
                                job_city: order.job_city ?? "",
                                job_zip: order.job_zip ?? "",
                                job_county: order.job_county ?? "",
                                selected_services: order.services ?? [],
                              });
                              navigate("/portal/new-order");
                            }}
                          >
                            <RefreshCw className="h-3 w-3" /> Reorder
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            {wos.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">
                                No work orders created yet for this order.
                              </p>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2">
                                {wos.map((wo) => (
                                  <WorkOrderCard key={wo.id} wo={wo} />
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}


