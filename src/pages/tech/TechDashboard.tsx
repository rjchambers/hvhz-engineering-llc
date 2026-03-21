import { TechLayout } from "@/components/TechLayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/work-order-helpers";
import { cn } from "@/lib/utils";
import { MapPin, Calendar } from "lucide-react";

interface WO {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  orders?: { job_address: string | null; job_city: string | null } | null;
  client_profiles?: { company_name: string | null } | null;
}

export default function TechDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<WO[]>([]);
  const [completed, setCompleted] = useState<WO[]>([]);

  const fetch = useCallback(async () => {
    if (!user) return;

    const { data: activeData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, created_at, client_id, orders(job_address, job_city)")
      .eq("assigned_technician_id", user.id)
      .in("status", ["dispatched", "in_progress"])
      .order("scheduled_date", { ascending: true });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: completedData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, created_at, client_id, orders(job_address, job_city)")
      .eq("assigned_technician_id", user.id)
      .eq("status", "submitted")
      .gte("submitted_at", thirtyDaysAgo)
      .order("submitted_at", { ascending: false });

    const allData = [...(activeData ?? []), ...(completedData ?? [])];
    const clientIds = [...new Set(allData.map((w) => w.client_id))];
    const { data: profiles } = await supabase
      .from("client_profiles")
      .select("user_id, company_name")
      .in("user_id", clientIds.length ? clientIds : ["__none__"]);
    const pMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

    const enrich = (list: typeof activeData) =>
      (list ?? []).map((wo) => ({
        ...wo,
        orders: wo.orders as WO["orders"],
        client_profiles: pMap.get(wo.client_id) as WO["client_profiles"],
      }));

    setActive(enrich(activeData));
    setCompleted(enrich(completedData));
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const Card = ({ wo }: { wo: WO }) => (
    <div
      onClick={() => navigate(`/tech/work-order/${wo.id}`)}
      className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-primary">{wo.service_type}</p>
        <Badge className={cn("text-[11px]", STATUS_BADGE_CLASSES[wo.status])}>
          {STATUS_LABELS[wo.status] ?? wo.status}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{wo.client_profiles?.company_name ?? "—"}</p>
      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        <span>{wo.orders?.job_address ?? "—"}{wo.orders?.job_city ? `, ${wo.orders.job_city}` : ""}</span>
      </div>
      {wo.scheduled_date && (
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{wo.scheduled_date}</span>
        </div>
      )}
    </div>
  );

  return (
    <TechLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">My Work Orders</h1>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((wo) => <Card key={wo.id} wo={wo} />)}
              {active.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No active work orders</p>}
            </div>
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((wo) => <Card key={wo.id} wo={wo} />)}
              {completed.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No completed work orders in the last 30 days</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TechLayout>
  );
}
