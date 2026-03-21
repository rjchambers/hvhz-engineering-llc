import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, STATUS_BADGE_CLASSES, isOutsourced, daysSince } from "@/lib/work-order-helpers";
import { SERVICES, getServiceName } from "@/lib/services";
import { CalendarIcon, ChevronLeft, ChevronRight, Upload, ChevronDown, AlertTriangle, ExternalLink, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";

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

interface RoleUser { id: string; displayName: string; user_id: string; role: string; }

interface OutsourcePartner {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string;
  services: string[];
  email_template: string | null;
  active: boolean;
}

export default function WorkOrders() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workOrders, setWorkOrders] = useState<WO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [selected, setSelected] = useState<WO | null>(null);
  const [techs, setTechs] = useState<RoleUser[]>([]);
  const [engineers, setEngineers] = useState<RoleUser[]>([]);
  const [partners, setPartners] = useState<OutsourcePartner[]>([]);

  // Dispatch form state
  const [dispatchTech, setDispatchTech] = useState("");
  const [dispatchEngineer, setDispatchEngineer] = useState("");
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>();
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

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

  // Fix 4: Better name resolution for techs and engineers
  const fetchRoles = useCallback(async () => {
    const { data: techRoles } = await supabase.from("user_roles").select("user_id, role").eq("role", "technician");
    const techUids = (techRoles ?? []).map((r) => r.user_id);

    let techNameMap = new Map<string, string>();
    if (techUids.length > 0) {
      const { data: techProfiles } = await supabase
        .from("client_profiles")
        .select("user_id, contact_name, contact_email")
        .in("user_id", techUids);
      techNameMap = new Map(
        (techProfiles ?? []).map((p) => [
          p.user_id,
          p.contact_name?.trim() ||
            (p.contact_email ? p.contact_email.split("@")[0] : null) ||
            p.user_id.slice(0, 8),
        ])
      );
    }

    setTechs(
      (techRoles ?? []).map((r) => ({
        id: r.user_id,
        user_id: r.user_id,
        role: r.role,
        displayName: techNameMap.get(r.user_id) || r.user_id.slice(0, 8),
      }))
    );

    const { data: engRoles } = await supabase.from("user_roles").select("user_id, role").eq("role", "engineer");
    const engUids = (engRoles ?? []).map((r) => r.user_id);

    let engNameMap = new Map<string, string>();
    if (engUids.length > 0) {
      const { data: engProfiles } = await supabase
        .from("engineer_profiles")
        .select("user_id, full_name")
        .in("user_id", engUids);
      const { data: engClientProfiles } = await supabase
        .from("client_profiles")
        .select("user_id, contact_email")
        .in("user_id", engUids);
      const engEmailMap = new Map(
        (engClientProfiles ?? []).map((p) => [p.user_id, p.contact_email])
      );
      engNameMap = new Map(
        (engProfiles ?? []).map((p) => [
          p.user_id,
          p.full_name?.trim() ||
            (engEmailMap.get(p.user_id)
              ? engEmailMap.get(p.user_id)!.split("@")[0]
              : null) ||
            p.user_id.slice(0, 8),
        ])
      );
    }

    setEngineers(
      (engRoles ?? []).map((r) => ({
        id: r.user_id,
        user_id: r.user_id,
        role: r.role,
        displayName: engNameMap.get(r.user_id) || r.user_id.slice(0, 8),
      }))
    );
  }, []);

  const fetchPartners = useCallback(async () => {
    const { data } = await supabase.from("outsource_partners").select("*").eq("active", true);
    setPartners((data as OutsourcePartner[]) ?? []);
  }, []);

  useEffect(() => { fetchWOs(); }, [fetchWOs]);
  useEffect(() => { fetchRoles(); fetchPartners(); }, [fetchRoles, fetchPartners]);

  // Fix 7: Auto-open sheet when ?id= is present
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && workOrders.length > 0) {
      const target = workOrders.find((wo) => wo.id === idParam);
      if (target) {
        openSheet(target);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, workOrders]);

  const handleSeedTestWO = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          client_id: user.id,
          services: ["fastener-calculation"],
          job_address: "750 E Sample Rd",
          job_city: "Pompano Beach",
          job_zip: "33064",
          job_county: "Broward",
          roof_area_sqft: 2400,
          total_amount: 350,
          status: "paid",
          notes: "TEST WORK ORDER — created via admin seed tool",
          roof_data: { area: 2400, pitch: "flat", type: "Modified Bitumen" },
        })
        .select()
        .single();

      if (orderErr || !order) throw new Error(orderErr?.message ?? "Order insert failed");

      const { error: woErr } = await supabase.from("work_orders").insert({
        order_id: order.id,
        client_id: user.id,
        service_type: "fastener-calculation",
        status: "dispatched",
        scheduled_date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
      });

      if (woErr) throw new Error(woErr.message);

      toast.success("Test work order created — assign tech and engineer in the table below.");
      fetchWOs();
    } catch (err: any) {
      toast.error("Seed failed: " + err.message);
    }
    setSeeding(false);
  };

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId);

  const availablePartners = selected
    ? partners.filter((p) => p.services.includes(selected.service_type))
    : [];

  const resolveTemplate = (template: string): string => {
    if (!selected || !selectedPartner) return template;
    return template
      .replace(/\{\{contact_name\}\}/g, selectedPartner.contact_name ?? "")
      .replace(/\{\{service_name\}\}/g, getServiceName(selected.service_type))
      .replace(/\{\{job_address\}\}/g, selected.orders?.job_address ?? "")
      .replace(/\{\{job_city\}\}/g, selected.orders?.job_city ?? "")
      .replace(/\{\{job_zip\}\}/g, "")
      .replace(/\{\{client_company\}\}/g, selected.client_profiles?.company_name ?? "")
      .replace(/\{\{work_order_id\}\}/g, selected.id.slice(0, 8).toUpperCase())
      .replace(/\{\{scheduled_date\}\}/g, dispatchDate ? format(dispatchDate, "MMMM d, yyyy") : "TBD");
  };

  const openSheet = (wo: WO) => {
    setSelected(wo);
    setDispatchTech(wo.assigned_technician_id ?? "");
    setDispatchEngineer(wo.assigned_engineer_id ?? "");
    setDispatchDate(wo.scheduled_date ? new Date(wo.scheduled_date) : undefined);
    setSelectedPartnerId("");
    setEmailPreviewOpen(false);
  };

  // Fix 5: Updated dispatch to support re-dispatch
  const handleDispatch = async () => {
    if (!selected) return;
    setDispatching(true);

    if (isOutsourced(selected.service_type)) {
      if (!selectedPartner) { toast.error("Select a lab partner"); setDispatching(false); return; }
      const { error } = await supabase
        .from("work_orders")
        .update({
          status: "dispatched",
          outsource_company: selectedPartner.name,
          outsource_email_sent_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) toast.error("Failed to dispatch");
      else { toast.success(`Work order dispatched to ${selectedPartner.name}`); setSelected(null); fetchWOs(); }
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
      if (error) toast.error("Failed to update");
      else {
        toast.success(selected.status === "dispatched" ? "Assignment updated" : "Work order dispatched");
        setSelected(null);
        fetchWOs();
      }
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

  // Fix 2: Use signed URL instead of public URL for private bucket
  const handleUploadResult = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const path = `work_orders/${selected.id}/result.pdf`;

    const { error: uploadErr } = await supabase.storage.from("reports").upload(path, file, { upsert: true });
    if (uploadErr) { toast.error("Upload failed: " + uploadErr.message); setUploading(false); return; }

    const { data: signedData, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

    if (signErr || !signedData?.signedUrl) {
      toast.error("Uploaded but could not generate URL");
      setUploading(false);
      return;
    }

    await supabase
      .from("work_orders")
      .update({ result_pdf_url: signedData.signedUrl, status: "submitted" })
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
          {/* Fix 11: Use SERVICES constant */}
          <Select value={filterService} onValueChange={(v) => { setFilterService(v); setPage(0); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {SERVICES.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-dashed text-muted-foreground"
            onClick={handleSeedTestWO}
            disabled={seeding}
          >
            <FlaskConical className="h-4 w-4" />
            {seeding ? "Creating…" : "Create Test WO"}
          </Button>
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
                  <TableCell className="font-medium text-sm">{getServiceName(wo.service_type)}</TableCell>
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
                <SheetTitle className="text-primary">{getServiceName(selected.service_type)}</SheetTitle>
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

                {/* Fix 5: Dispatch section for pending_dispatch AND dispatched */}
                {(selected.status === "pending_dispatch" || selected.status === "dispatched") && (
                  <section className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-primary">
                      {selected.status === "dispatched" ? "Update Assignment" : "Dispatch"}
                    </h3>

                    {isOutsourced(selected.service_type) ? (
                      <>
                        {availablePartners.length === 0 ? (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                            <div className="text-sm">
                              <p className="font-medium text-amber-800">No active lab partners configured for {selected.service_type}.</p>
                              <Link to="/admin/settings" className="text-amber-700 underline text-xs mt-1 inline-flex items-center gap-1">
                                Go to Settings → Outsource Partners <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Select Lab / Partner</Label>
                              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                                <SelectTrigger><SelectValue placeholder="Choose a partner…" /></SelectTrigger>
                                <SelectContent>
                                  {availablePartners.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.contact_email}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {selectedPartner && (
                              <>
                                <div className="rounded-md bg-muted/50 p-3 text-sm space-y-0.5">
                                  <p><span className="text-muted-foreground">Contact:</span> {selectedPartner.contact_name ?? "—"}</p>
                                  <p><span className="text-muted-foreground">Email:</span> {selectedPartner.contact_email}</p>
                                </div>

                                {selectedPartner.email_template && (
                                  <Collapsible open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                                        Preview Work Order Email
                                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", emailPreviewOpen && "rotate-180")} />
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

                            <Button onClick={handleDispatch} disabled={dispatching || !selectedPartnerId} className="w-full bg-hvhz-navy hover:bg-hvhz-navy/90">
                              {dispatching ? "Dispatching…" : "Dispatch to Lab"}
                            </Button>
                          </>
                        )}

                        <div className="text-center pt-1">
                          <Link to="/admin/settings" className="text-xs text-muted-foreground hover:text-primary underline inline-flex items-center gap-1">
                            Manage Labs <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Technician</Label>
                          <Select value={dispatchTech} onValueChange={setDispatchTech}>
                            <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                            <SelectContent>
                              {techs.map((t) => (
                                <SelectItem key={t.user_id} value={t.user_id}>{t.displayName}</SelectItem>
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
                                <SelectItem key={e.user_id} value={e.user_id}>{e.displayName}</SelectItem>
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
                          {dispatching ? "Saving…" : selected.status === "dispatched" ? "Update Assignment" : "Dispatch"}
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
