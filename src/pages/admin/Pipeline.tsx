import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { PackageOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  KANBAN_COLUMNS,
  STATUS_LABELS,
  TAS_SERVICES,
  daysSince,
} from "@/lib/work-order-helpers";
import { toast } from "sonner";

interface WO {
  id: string;
  service_type: string;
  status: string;
  created_at: string;
  client_id: string;
  order_id: string;
  orders?: {
    job_address: string | null;
    job_city: string | null;
  } | null;
  client_profiles?: {
    company_name: string | null;
  } | null;
}

export default function Pipeline() {
  const [workOrders, setWorkOrders] = useState<WO[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchWOs = useCallback(async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("id, service_type, status, created_at, client_id, order_id, orders(job_address, job_city)")
      .order("created_at", { ascending: false });

    if (!data) return;

    const clientIds = [...new Set(data.map((wo) => wo.client_id))];
    const { data: profiles } = await supabase
      .from("client_profiles")
      .select("user_id, company_name")
      .in("user_id", clientIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

    setWorkOrders(
      data.map((wo) => ({
        ...wo,
        orders: wo.orders as WO["orders"],
        client_profiles: profileMap.get(wo.client_id) as WO["client_profiles"],
      }))
    );
  }, []);

  useEffect(() => {
    fetchWOs();

    const channel = supabase
      .channel("admin-pipeline")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_orders" },
        () => fetchWOs()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchWOs]);

  const handleDragStart = (id: string) => setDragging(id);

  const handleDrop = async (newStatus: string) => {
    if (!dragging) return;
    const wo = workOrders.find((w) => w.id === dragging);
    if (!wo || wo.status === newStatus) { setDragging(null); setDragOver(null); return; }

    setWorkOrders((prev) =>
      prev.map((w) => (w.id === dragging ? { ...w, status: newStatus } : w))
    );
    setDragging(null);
    setDragOver(null);

    const { error } = await supabase
      .from("work_orders")
      .update({ status: newStatus })
      .eq("id", wo.id);

    if (error) {
      toast.error("Failed to update status");
      fetchWOs();
    }
  };

  const allEmpty = workOrders.length === 0;

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Order Pipeline</h1>

        {allEmpty ? (
          <div className="rounded-lg border bg-card p-16 text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-primary">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">Share hvhzengineering.com to get started.</p>
          </div>
        ) : (
          <>
            {/* Desktop kanban — Fix 7: clickable cards, Fix 8: drag visual feedback */}
            <div className="hidden md:flex gap-3 overflow-x-auto pb-4">
              {KANBAN_COLUMNS.map((col) => {
                const items = workOrders.filter((w) => w.status === col);
                return (
                  <div
                    key={col}
                    className={`min-w-[220px] w-[220px] flex-shrink-0 rounded-lg transition-colors ${
                      dragOver === col
                        ? "bg-hvhz-teal/10 ring-2 ring-hvhz-teal/30"
                        : "bg-muted/50"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={() => { handleDrop(col); setDragOver(null); }}
                  >
                    <div className="p-3 border-b border-border bg-hvhz-teal/5 rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {STATUS_LABELS[col]}
                        </h3>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {items.length}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {items.map((wo) => {
                        const isTas = TAS_SERVICES.includes(wo.service_type);
                        return (
                          <div
                            key={wo.id}
                            draggable
                            onDragStart={() => handleDragStart(wo.id)}
                            onClick={() => navigate(`/admin/work-orders?id=${wo.id}`)}
                            className={`rounded-md p-3 cursor-grab active:cursor-grabbing shadow-sm border transition-shadow hover:shadow-md hover:border-primary/30 ${
                              isTas
                                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
                                : "bg-card border-border/50"
                            }`}
                          >
                            <p className="text-xs font-semibold text-primary truncate">
                              {wo.client_profiles?.company_name || "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {wo.service_type}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {wo.orders?.job_address || "—"}{wo.orders?.job_city ? `, ${wo.orders.job_city}` : ""}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {daysSince(wo.created_at)}d ago
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile list view — Fix 7: clickable cards */}
            <div className="md:hidden space-y-2">
              {KANBAN_COLUMNS.map((col) => {
                const items = workOrders.filter((w) => w.status === col);
                if (items.length === 0) return null;
                return (
                  <div key={col}>
                    <div className="flex items-center justify-between py-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABELS[col]}</h3>
                      <Badge variant="secondary" className="text-[10px] h-5">{items.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {items.map((wo) => {
                        const isTas = TAS_SERVICES.includes(wo.service_type);
                        return (
                          <div
                            key={wo.id}
                            className={`rounded-md p-3 border shadow-sm cursor-pointer hover:border-primary/30 transition-colors ${
                              isTas
                                ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200"
                                : "bg-card border-border/50"
                            }`}
                            onClick={() => navigate(`/admin/work-orders?id=${wo.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-primary truncate">{wo.client_profiles?.company_name || "—"}</p>
                              <p className="text-[10px] text-muted-foreground/70">{daysSince(wo.created_at)}d</p>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{wo.service_type}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{wo.orders?.job_address || "—"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
