import { useState, useEffect, useCallback } from "react";
import { PortalLayout } from "@/components/PortalLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, KeyRound, MapPin, RefreshCw, Download } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAutosave } from "@/hooks/useAutosave";
import { AutosaveIndicator } from "@/components/AutosaveIndicator";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { getServiceName, formatCurrency } from "@/lib/services";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/work-order-helpers";
import { saveWizardData, defaultWizardData } from "@/lib/wizard-data";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Order = Tables<"orders">;

export default function MyProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    contact_phone: "",
    company_address: "",
    company_city: "",
    company_state: "FL",
    company_zip: "",
    contractor_license: "",
    preferred_contact: "email",
    tech_instructions: "",
  });

  // Order history
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Saved job sites (derived from orders)
  interface JobSite {
    address: string;
    city: string;
    zip: string;
    county: string;
    lastDate: string;
    services: string[];
    orderId: string;
  }
  const [savedSites, setSavedSites] = useState<JobSite[]>([]);

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("client_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            company_name: data.company_name ?? "",
            contact_name: data.contact_name ?? "",
            contact_phone: data.contact_phone ?? "",
            company_address: data.company_address ?? "",
            company_city: data.company_city ?? "",
            company_state: data.company_state ?? "FL",
            company_zip: data.company_zip ?? "",
            contractor_license: (data as any).contractor_license ?? "",
            preferred_contact: (data as any).preferred_contact ?? "email",
            tech_instructions: (data as any).tech_instructions ?? "",
          });
        }
        setLoading(false);
      });
  }, [user]);

  // Load orders + derive saved sites
  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setOrders(data);

      // Derive unique job sites
      const siteMap = new Map<string, JobSite>();
      for (const order of data) {
        const key = `${order.job_address}-${order.job_city}-${order.job_zip}`;
        if (order.job_address && !siteMap.has(key)) {
          siteMap.set(key, {
            address: order.job_address ?? "",
            city: order.job_city ?? "",
            zip: order.job_zip ?? "",
            county: order.job_county ?? "",
            lastDate: order.created_at,
            services: order.services ?? [],
            orderId: order.id,
          });
        }
      }
      setSavedSites(Array.from(siteMap.values()));
    }
    setOrdersLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const { status: profileAutosave, clearDraft: clearProfileDraft } = useAutosave({
    storageKey: `client-profile-${user?.id}`,
    data: form,
    onRestore: (restored) => {
      setForm((prev) => ({ ...prev, ...restored }));
      toast.info("Restored your unsaved changes", { duration: 3000 });
    },
    disabled: loading || !user,
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_profiles").upsert(
        {
          user_id: user.id,
          contact_email: user.email,
          company_name: form.company_name,
          contact_name: form.contact_name,
          contact_phone: form.contact_phone,
          company_address: form.company_address,
          company_city: form.company_city,
          company_state: form.company_state,
          company_zip: form.company_zip,
          contractor_license: form.contractor_license,
          preferred_contact: form.preferred_contact,
          tech_instructions: form.tech_instructions,
        } as any,
        { onConflict: "user_id" }
      );
      if (error) throw error;
      toast.success("Profile updated");
      clearProfileDraft();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleReorder = (order: Order) => {
    saveWizardData({
      ...defaultWizardData,
      company_name: form.company_name,
      contact_name: form.contact_name,
      contact_email: user?.email ?? "",
      contact_phone: form.contact_phone,
      company_address: form.company_address,
      company_city: form.company_city,
      company_state: form.company_state,
      company_zip: form.company_zip,
      job_address: order.job_address ?? "",
      job_city: order.job_city ?? "",
      job_zip: order.job_zip ?? "",
      job_county: order.job_county ?? "",
      selected_services: order.services ?? [],
    });
    navigate("/portal/new-order");
  };

  const handleReorderFromSite = (site: JobSite) => {
    saveWizardData({
      ...defaultWizardData,
      company_name: form.company_name,
      contact_name: form.contact_name,
      contact_email: user?.email ?? "",
      contact_phone: form.contact_phone,
      company_address: form.company_address,
      company_city: form.company_city,
      company_state: form.company_state,
      company_zip: form.company_zip,
      job_address: site.address,
      job_city: site.city,
      job_zip: site.zip,
      job_county: site.county,
      selected_services: site.services,
    });
    navigate("/portal/new-order");
  };

  return (
    <PortalLayout>
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-primary">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your company, view past job sites, and access order history.
        </p>

        <Tabs defaultValue="company" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company">Company Info</TabsTrigger>
            <TabsTrigger value="sites">Saved Sites</TabsTrigger>
            <TabsTrigger value="history">Order History</TabsTrigger>
          </TabsList>

          {/* ─── TAB 1: COMPANY INFO ─── */}
          <TabsContent value="company" className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ""} readOnly className="bg-muted cursor-not-allowed" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input id="company_name" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">Contact Name</Label>
                    <Input id="contact_name" value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input id="contact_phone" type="tel" value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractor_license">FL Contractor License #</Label>
                    <Input
                      id="contractor_license"
                      value={form.contractor_license}
                      onChange={(e) => update("contractor_license", e.target.value)}
                      placeholder="CBC / CCC / CGC…"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Company Address</Label>
                    <AddressAutocomplete
                      value={form.company_address}
                      onChange={(val) => update("company_address", val)}
                      onSelect={(parsed) => {
                        setForm((prev) => ({
                          ...prev,
                          company_address: parsed.address,
                          company_city: parsed.city,
                          company_state: parsed.state,
                          company_zip: parsed.zip,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <Input value={form.company_city} onChange={(e) => update("company_city", e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">State</Label>
                      <Input value={form.company_state} onChange={(e) => update("company_state", e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">ZIP</Label>
                      <Input value={form.company_zip} onChange={(e) => update("company_zip", e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Preferred Contact */}
                <div className="space-y-3">
                  <Label>Preferred Contact Method</Label>
                  <RadioGroup
                    value={form.preferred_contact}
                    onValueChange={(val) => update("preferred_contact", val)}
                    className="flex gap-4"
                  >
                    {["email", "phone", "text"].map((method) => (
                      <div key={method} className="flex items-center gap-2">
                        <RadioGroupItem value={method} id={`contact-${method}`} />
                        <Label htmlFor={`contact-${method}`} className="text-sm capitalize cursor-pointer">
                          {method}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {/* Tech Instructions */}
                <div className="space-y-2">
                  <Label htmlFor="tech_instructions">Standing Instructions for Technicians</Label>
                  <Textarea
                    id="tech_instructions"
                    value={form.tech_instructions}
                    onChange={(e) => update("tech_instructions", e.target.value)}
                    placeholder="e.g. Call 30 min before arrival, park in rear lot…"
                    rows={3}
                  />
                  <p className="text-[10px] text-muted-foreground">Shown to technicians on every work order</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-3">
                    <Link
                      to="/forgot-password"
                      className="flex items-center gap-1.5 text-sm text-hvhz-teal hover:underline"
                    >
                      <KeyRound className="h-4 w-4" />
                      Change Password
                    </Link>
                    <AutosaveIndicator status={profileAutosave} />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="gap-2 bg-primary text-primary-foreground">
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── TAB 2: SAVED JOB SITES ─── */}
          <TabsContent value="sites" className="mt-6">
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : savedSites.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-primary">No saved job sites yet</p>
                <p className="text-xs text-muted-foreground mt-1">Job sites from your orders will appear here automatically.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {savedSites.map((site) => (
                  <div key={`${site.address}-${site.zip}`} className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary">{site.address}</p>
                      <p className="text-xs text-muted-foreground">
                        {site.city}{site.county ? `, ${site.county} County` : ""} {site.zip}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Last order: {new Date(site.lastDate).toLocaleDateString()} · {site.services.map(getServiceName).join(", ")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1 text-hvhz-teal border-hvhz-teal/30 hover:bg-hvhz-teal/5"
                      onClick={() => handleReorderFromSite(site)}
                    >
                      <RefreshCw className="h-3 w-3" /> Reorder
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB 3: ORDER HISTORY ─── */}
          <TabsContent value="history" className="mt-6">
            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-sm font-medium text-primary">No orders yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your order history will appear here.</p>
              </div>
            ) : (
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Address</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Services</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground" />
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 max-w-[180px]">
                            <span className="line-clamp-1 text-xs">
                              {order.job_address ? `${order.job_address}, ${order.job_city ?? ""}` : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <span className="line-clamp-1 text-xs">
                              {order.services?.map(getServiceName).join(", ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                            {order.total_amount != null ? formatCurrency(order.total_amount) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5",
                                STATUS_BADGE_CLASSES[order.status] ?? "bg-muted text-muted-foreground"
                              )}
                            >
                              {STATUS_LABELS[order.status] ?? order.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs text-hvhz-teal hover:text-hvhz-teal"
                              onClick={() => handleReorder(order)}
                            >
                              <RefreshCw className="h-3 w-3" /> Reorder
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
