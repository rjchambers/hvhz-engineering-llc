import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, STATUS_BADGE_CLASSES, isOutsourced, daysSince } from "@/lib/work-order-helpers";
import { CalendarIcon, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGE_SIZE = 25;

interface WO {
  id: string;
  service_type: string;
  status: string;
  created_at: string;
  scheduled_date: string | null;
  client_id: string;
  order_id: string;
  assigned_technician_id: string | null;
  assigned_engineer_id: string | null;
  outsource_company: string | null;
  outsource_email_sent_at: string | null;
  result_pdf_url: string | null;
  rejection_notes: string | null;
  pe_notes: string | null;
  orders?: { job_address: string | null; job_city: string | null; notes: string | null; services: string[] } | null;
  client_profiles?: { company_name: string | null } | null;
}

interface RoleUser { id: string; full_name?: string; user_id: string; role: string; }

export default function WorkOrders() {
  const [workOrders, setWorkOrders] = useState<WO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [selected, setSelected] = useState<WO | null>(null);
  const [techs, setTechs] = useState<RoleUser[]>([]);
  const [engineers, setEngineers] = useState<RoleUser[]>([]);

  // Dispatch form state
  const [dispatchTech, setDispatchTech] = useState("");
  const [dispatchEngineer, setDispatchEngineer] = useState("");
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>();
  const [outsourceCompany, setOutsourceCompany] = useState("");
  const [outsourceEmail, setOutsourceEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const fetchWOs = useCallback(async () => {
    let query = supabase
      .from("work_orders")
      .select("*, orders(job_address, job_city, notes, services)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterService !== "all") query = query.eq("service_type", filterService);

    const { data, count } = await query;
    if (!data) return;

    const clientIds = [...new Set(data.map((w) => w.client_id))];
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
    setTotal(count ?? 0);
  }, [page, filterStatus, filterService]);

  const fetchRoles = useCallback(async () => {
    const { data: techRoles } = await supabase.from("user_roles").select("user_id, role").eq("role", "technician");
    const { data: engRoles } = await supabase.from("user_roles").select("user_id, role").eq("role", "engineer");
    setTechs((techRoles ?? []).map((r) => ({ id: r.user_id, user_id: r.user_id, role: r.role })));
    setEngineers((engRoles ?? []).map((r) => ({ id: r.user_id, user_id: r.user_id, role: r.role })));
  }, []);

  useEffect(() => { fetchWOs(); }, [fetchWOs]);
  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const openSheet = (wo: WO) => {
    setSelected(wo);
    setDispatchTech(wo.assigned_technician_id ?? "");
    setDispatchEngineer(wo.assigned_engineer_id ?? "");
    setDispatchDate(wo.scheduled_date ? new Date(wo.scheduled_date) : undefined);
    setOutsourceCompany(wo.outsource_company ?? "");
    setOutsourceEmail("");
  };

  const handleDispatch = async () => {
    if (!selected) return;
    setDispatching(true);

    if (isOutsourced(selected.service_type)) {
      const { error } = await supabase
        .from("work_orders")
        .update({
          status: "dispatched",
          outsource_company: outsourceCompany,
          outsource_email_sent_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) toast.error("Failed to dispatch");
      else { toast.success("Work order dispatched to lab"); setSelected(null); fetchWOs(); }
    } else {
      const { error } = await supabase
        .from("work_orders")
        .update({
          status: "dispatched",
          assigned_technician_id: dispatchTech || null,
          assigned_engineer_id: dispatchEngineer || null,
          scheduled_date: dispatchDate ? format(dispatchDate, "yyyy-MM-dd") : null,
        })
        .eq("id", selected.id);
      if (error) toast.error("Failed to dispatch");
      else { toast.success("Work order dispatched"); setSelected(null); fetchWOs(); }
    }
    setDispatching(false);
  };

  const handleReDispatch = async () => {
    if (!selected) return;
    await supabase.from("work_orders").update({ status: "pending_dispatch", rejection_notes: null }).eq("id", selected.id);
    toast.success("Re-dispatched");
    setSelected(null);
    fetchWOs();
  };

  const handleUploadResult = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const path = `work_orders/${selected.id}/result.pdf`;

    const { error: uploadErr } = await supabase.storage.from("reports").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Upload failed"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("reports").getPublicUrl(path);

    await supabase
      .from("work_orders")
      .update({ result_pdf_url: urlData.publicUrl, status: "submitted" })
      .eq("id", selected.id);

    toast.success("Result uploaded, status set to submitted");
    setUploading(false);
    setSelected(null);
    fetchWOs();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary mb-6">Work Orders</h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterService} onValueChange={(v) => { setFilterService(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {["tas-105","tas-106","tas-124","tas-126","roof-inspection","roof-certification","drainage-analysis","special-inspection","wind-mitigation-permit","fastener-calculation"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Scheduled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workOrders.map((wo) => (
                <TableRow key={wo.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openSheet(wo)}>
                  <TableCell className="font-medium text-sm">{wo.service_type}</TableCell>
                  <TableCell className="text-sm">{wo.client_profiles?.company_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{wo.orders?.job_address ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[11px]", STATUS_BADGE_CLASSES[wo.status] ?? "bg-gray-100 text-gray-700")}>
                      {STATUS_LABELS[wo.status] ?? wo.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{daysSince(wo.created_at)}d</TableCell>
                  <TableCell className="text-sm">{wo.scheduled_date ?? "—"}</TableCell>
                </TableRow>
              ))}
              {workOrders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No work orders found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">{total} total</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm flex items-center px-2">{page + 1} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Side Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-primary">{selected.service_type}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Info */}
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-primary">Info</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Client:</span> {selected.client_profiles?.company_name ?? "—"}</p>
                    <p><span className="text-muted-foreground">Address:</span> {selected.orders?.job_address ?? "—"}, {selected.orders?.job_city ?? ""}</p>
                    <p><span className="text-muted-foreground">Services:</span> {selected.orders?.services?.join(", ") ?? "—"}</p>
                    {selected.orders?.notes && <p><span className="text-muted-foreground">Notes:</span> {selected.orders.notes}</p>}
                    <p>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      <Badge className={cn("text-[11px]", STATUS_BADGE_CLASSES[selected.status])}>
                        {STATUS_LABELS[selected.status] ?? selected.status}
                      </Badge>
                    </p>
                  </div>
                </section>

                {/* Dispatch section for pending_dispatch */}
                {selected.status === "pending_dispatch" && (
                  <section className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-primary">Dispatch</h3>

                    {isOutsourced(selected.service_type) ? (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Outsource Company</Label>
                          <Input value={outsourceCompany} onChange={(e) => setOutsourceCompany(e.target.value)} placeholder="Lab name" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Outsource Email</Label>
                          <Input value={outsourceEmail} onChange={(e) => setOutsourceEmail(e.target.value)} placeholder="lab@example.com" type="email" />
                        </div>
                        <Button onClick={handleDispatch} disabled={dispatching || !outsourceCompany} className="w-full bg-hvhz-navy hover:bg-hvhz-navy/90">
                          {dispatching ? "Sending…" : "Send Work Order Email"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Technician</Label>
                          <Select value={dispatchTech} onValueChange={setDispatchTech}>
                            <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                            <SelectContent>
                              {techs.map((t) => (
                                <SelectItem key={t.user_id} value={t.user_id}>{t.user_id.slice(0, 8)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Engineer / PE</Label>
                          <Select value={dispatchEngineer} onValueChange={setDispatchEngineer}>
                            <SelectTrigger><SelectValue placeholder="Select engineer" /></SelectTrigger>
                            <SelectContent>
                              {engineers.map((e) => (
                                <SelectItem key={e.user_id} value={e.user_id}>{e.user_id.slice(0, 8)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Scheduled Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dispatchDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dispatchDate ? format(dispatchDate, "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={dispatchDate} onSelect={setDispatchDate} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button onClick={handleDispatch} disabled={dispatching} className="w-full bg-hvhz-navy hover:bg-hvhz-navy/90">
                          {dispatching ? "Dispatching…" : "Dispatch"}
                        </Button>
                      </>
                    )}
                  </section>
                )}

                {/* Upload for outsourced TAS after dispatch */}
                {isOutsourced(selected.service_type) && selected.status === "dispatched" && (
                  <section className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-primary">Upload Test Result</h3>
                    <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-hvhz-teal transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{uploading ? "Uploading…" : "Upload result PDF"}</span>
                      <input type="file" accept=".pdf" className="hidden" onChange={handleUploadResult} disabled={uploading} />
                    </label>
                  </section>
                )}

                {/* Rejected */}
                {selected.status === "rejected" && (
                  <section className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-destructive">Rejected</h3>
                    {selected.rejection_notes && (
                      <p className="text-sm bg-red-50 p-3 rounded">{selected.rejection_notes}</p>
                    )}
                    <Button onClick={handleReDispatch} className="w-full" variant="outline">
                      Re-Dispatch
                    </Button>
                  </section>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
