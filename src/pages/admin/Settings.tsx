import { AdminLayout } from "@/components/AdminLayout";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SERVICES } from "@/lib/services";
import { Plus, Pencil } from "lucide-react";

const TAS_SERVICE_OPTIONS = [
  { key: "tas-105", label: "TAS-105 Fastener Withdrawal Test" },
  { key: "tas-106", label: "TAS-106 Tile Bonding Verification" },
  { key: "tas-124", label: "TAS-124 Bonded Pull Test" },
  { key: "tas-126", label: "TAS-126 Moisture Survey" },
];

interface Partner {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string;
  services: string[];
  email_template: string | null;
  active: boolean;
}

interface ServiceConfig {
  service_key: string;
  price_override: number | null;
  active: boolean;
}

// ─── Partner Form Dialog ───
function PartnerDialog({
  open, onOpenChange, partner, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  partner: Partner | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [template, setTemplate] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (partner) {
      setName(partner.name);
      setContactName(partner.contact_name ?? "");
      setContactEmail(partner.contact_email);
      setServices(partner.services);
      setTemplate(partner.email_template ?? "");
      setActive(partner.active);
    } else {
      setName(""); setContactName(""); setContactEmail("");
      setServices([]); setTemplate(""); setActive(true);
    }
  }, [partner, open]);

  const toggleService = (key: string) => {
    setServices((prev) => prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    if (!name.trim() || !contactEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    const row = {
      name: name.trim(),
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim(),
      services,
      email_template: template.trim() || null,
      active,
    };

    const { error } = partner
      ? await supabase.from("outsource_partners").update(row).eq("id", partner.id)
      : await supabase.from("outsource_partners").insert(row);

    if (error) toast.error(error.message);
    else { toast.success(partner ? "Partner updated" : "Partner added"); onSaved(); onOpenChange(false); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{partner ? "Edit Partner" : "Add Partner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Partner Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Name</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact Email *</Label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Services this partner handles</Label>
            <div className="space-y-2 mt-1">
              {TAS_SERVICE_OPTIONS.map((svc) => (
                <label key={svc.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={services.includes(svc.key)} onCheckedChange={() => toggleService(svc.key)} />
                  {svc.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email Template</Label>
            <Textarea rows={10} value={template} onChange={(e) => setTemplate(e.target.value)} className="font-mono text-xs" />
            <p className="text-[11px] text-muted-foreground">
              Available variables: {"{{contact_name}}"}, {"{{service_name}}"}, {"{{job_address}}"}, {"{{job_city}}"}, {"{{job_zip}}"}, {"{{client_company}}"}, {"{{work_order_id}}"}, {"{{scheduled_date}}"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label className="text-xs">Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cleanup Button ───
function CleanupButton() {
  const [cleaning, setCleaning] = useState(false);
  const handleCleanup = async () => {
    setCleaning(true);
    const { data, error } = await supabase.functions.invoke("cleanup-orphaned-photos");
    if (error) toast.error("Cleanup failed: " + error.message);
    else toast.success(`Cleanup complete — ${data.deleted} orphaned files removed`);
    setCleaning(false);
  };
  return (
    <Button variant="outline" onClick={handleCleanup} disabled={cleaning} className="gap-2">
      {cleaning ? "Cleaning…" : "Clean Up Orphaned Photos"}
    </Button>
  );
}

// ─── Main Settings Page ───
export default function Settings() {
  // Partners tab
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);

  const fetchPartners = useCallback(async () => {
    const { data } = await supabase.from("outsource_partners").select("*").order("name");
    setPartners((data as Partner[]) ?? []);
  }, []);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const togglePartnerActive = async (p: Partner) => {
    const { error } = await supabase.from("outsource_partners").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.active ? "Deactivated" : "Activated"); fetchPartners(); }
  };

  // Services tab
  const [configs, setConfigs] = useState<ServiceConfig[]>([]);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});

  const fetchConfigs = useCallback(async () => {
    const { data } = await supabase.from("service_config").select("*");
    setConfigs((data as ServiceConfig[]) ?? []);
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const getConfig = (key: string) => configs.find((c) => c.service_key === key);

  const handlePriceSave = async (key: string, defaultPrice: number) => {
    const val = priceEdits[key];
    const price = val !== undefined ? parseFloat(val) : null;
    if (price !== null && isNaN(price)) { toast.error("Invalid price"); return; }

    const { error } = await supabase.from("service_config").upsert({
      service_key: key,
      price_override: price ?? defaultPrice,
      active: getConfig(key)?.active ?? true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Price saved"); fetchConfigs(); setPriceEdits((p) => { const n = { ...p }; delete n[key]; return n; }); }
  };

  const handleServiceToggle = async (key: string, defaultPrice: number) => {
    const current = getConfig(key);
    const { error } = await supabase.from("service_config").upsert({
      service_key: key,
      price_override: current?.price_override ?? defaultPrice,
      active: !(current?.active ?? true),
    });
    if (error) toast.error(error.message);
    else { toast.success("Updated"); fetchConfigs(); }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-primary mb-6">Settings</h1>

        <Tabs defaultValue="partners">
          <TabsList>
            <TabsTrigger value="partners">Outsource Partners</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          {/* ─── Partners ─── */}
          <TabsContent value="partners" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => { setEditPartner(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Partner
              </Button>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.name}</TableCell>
                      <TableCell className="text-sm">{p.contact_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.contact_email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.services.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                          {p.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditPartner(p); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => togglePartnerActive(p)}>
                            {p.active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {partners.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No partners configured</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <PartnerDialog open={dialogOpen} onOpenChange={setDialogOpen} partner={editPartner} onSaved={fetchPartners} />
          </TabsContent>

          {/* ─── Services ─── */}
          <TabsContent value="services" className="mt-4">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Price ($)</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SERVICES.map((svc) => {
                    const cfg = getConfig(svc.key);
                    const displayPrice = cfg?.price_override ?? svc.price;
                    const isActive = cfg?.active ?? true;
                    const editVal = priceEdits[svc.key];

                    return (
                      <TableRow key={svc.key}>
                        <TableCell className="font-medium text-sm">{svc.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{svc.key}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            className="w-24 h-8 text-sm"
                            value={editVal !== undefined ? editVal : String(displayPrice)}
                            onChange={(e) => setPriceEdits((p) => ({ ...p, [svc.key]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell>
                          <Switch checked={isActive} onCheckedChange={() => handleServiceToggle(svc.key, svc.price)} />
                        </TableCell>
                        <TableCell>
                          {editVal !== undefined && (
                            <Button size="sm" variant="outline" onClick={() => handlePriceSave(svc.key, svc.price)}>
                              Save
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── Notifications (placeholder) ─── */}
          <TabsContent value="notifications" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Email Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Client notification emails</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">PE assignment email</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">TAS lab dispatch email</Label>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="text-xs">From email address</Label>
                  <Input defaultValue="noreply@hvhzengineering.com" className="max-w-sm" />
                </div>
                <div className="pt-2">
                  <Button disabled className="opacity-50">Save</Button>
                  <p className="text-xs text-muted-foreground mt-1">Email provider configuration — connect Resend in a future prompt.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Storage Maintenance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Remove orphaned photo files from storage that are no longer referenced by any work order.</p>
                <CleanupButton />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
