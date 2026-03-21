import { PELayout } from "@/components/PELayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { STATUS_BADGE_CLASSES, STATUS_LABELS, daysSince } from "@/lib/work-order-helpers";
import { cn } from "@/lib/utils";
import { Clock, MapPin, CheckCircle2 } from "lucide-react";

interface WO {
  id: string;
  service_type: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  client_id: string;
  orders?: { job_address: string | null; job_city: string | null } | null;
  client_profiles?: { company_name: string | null } | null;
}

export default function PEReviewQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState<WO[]>([]);
  const [completed, setCompleted] = useState<WO[]>([]);
  const [liveCount, setLiveCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: activeData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, submitted_at, created_at, client_id, orders(job_address, job_city)")
      .eq("assigned_engineer_id", user.id)
      .in("status", ["submitted", "pe_review"])
      .order("submitted_at", { ascending: true });

    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: doneData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, submitted_at, created_at, client_id, orders(job_address, job_city)")
      .eq("assigned_engineer_id", user.id)
      .in("status", ["signed", "complete"])
      .gte("signed_at", thirtyAgo)
      .order("signed_at", { ascending: false });

    const all = [...(activeData ?? []), ...(doneData ?? [])];
    const cids = [...new Set(all.map((w) => w.client_id))];
    const { data: profiles } = await supabase.from("client_profiles")
      .select("user_id, company_name").in("user_id", cids.length ? cids : ["__none__"]);
    const pm = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

    const enrich = (list: typeof activeData) =>
      (list ?? []).map((wo) => ({ ...wo, orders: wo.orders as WO["orders"], client_profiles: pm.get(wo.client_id) as WO["client_profiles"] }));

    const enrichedActive = enrich(activeData);
    setActive(enrichedActive);
    setCompleted(enrich(doneData));
    setLiveCount(enrichedActive.length);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("pe-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const Card = ({ wo }: { wo: WO }) => {
    const waiting = wo.submitted_at ? daysSince(wo.submitted_at) : 0;
    return (
      <div onClick={() => navigate(`/pe/review/${wo.id}`)} className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-primary">{wo.service_type}</p>
          <Badge className={cn("text-[11px]", STATUS_BADGE_CLASSES[wo.status])}>{STATUS_LABELS[wo.status] ?? wo.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{wo.client_profiles?.company_name ?? "—"}</p>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{wo.orders?.job_address ?? "—"}</div>
        {wo.submitted_at && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{waiting}d waiting</div>
        )}
      </div>
    );
  };

  return (
    <PELayout>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-primary">Review Queue</h1>
          {liveCount > 0 && <Badge className="bg-hvhz-amber text-white">{liveCount}</Badge>}
        </div>
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Pending Review ({active.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((wo) => <Card key={wo.id} wo={wo} />)}
              {active.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-hvhz-green/40 mb-3" />
                  <p className="text-sm font-medium text-primary">All caught up</p>
                  <p className="text-xs text-muted-foreground mt-1">No reports awaiting review.</p>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="completed" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {completed.map((wo) => <Card key={wo.id} wo={wo} />)}
              {completed.length === 0 && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No completed reviews in the last 30 days</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PELayout>
  );
}
