import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TechLayout } from "@/components/TechLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "@/lib/work-order-helpers";
import { PHOTO_SECTION_TAGS, MIN_PHOTO_COUNTS, SPECIAL_INSPECTION_CHECKLISTS, compressImage } from "@/lib/tech-form-helpers";
import { getDrainCapacity, DESIGN_RAINFALL } from "@/lib/drainage-calc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Camera, Trash2, Plus, ArrowLeft, AlertCircle, Lock, FileText, ExternalLink, Info } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface WOData {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  client_id: string;
  order_id: string;
  rejection_notes: string | null;
  orders?: {
    job_address: string | null;
    job_city: string | null;
    job_zip: string | null;
    job_county: string | null;
    roof_data: Json | null;
    site_context: Json | null;
    noa_document_path: string | null;
    noa_document_name: string | null;
    roof_report_path: string | null;
    roof_report_name: string | null;
    roof_report_type: string | null;
  } | null;
}

interface PhotoRow {
  id: string;
  storage_path: string;
  caption: string | null;
  section_tag: string | null;
  url?: string;
}

export default function TechWorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wo, setWo] = useState<WOData | null>(null);
  const [clientProfile, setClientProfile] = useState<{ company_name: string | null; contact_name: string | null; contact_phone: string | null } | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [siblingPrefilled, setSiblingPrefilled] = useState(false);

  // Load work order + existing field_data
  const loadData = useCallback(async () => {
    if (!id) return;
    const { data: woData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, client_id, order_id, rejection_notes, orders(job_address, job_city, job_zip, job_county, roof_data, site_context, noa_document_path, noa_document_name, roof_report_path, roof_report_name, roof_report_type)")
      .eq("id", id)
      .single();
    if (!woData) return;
    setWo(woData as unknown as WOData);

    // Client profile
    const { data: cp } = await supabase
      .from("client_profiles")
      .select("company_name, contact_name, contact_phone")
      .eq("user_id", woData.client_id)
      .maybeSingle();
    setClientProfile(cp);

    const siteContext = (woData.orders as any)?.site_context as Record<string, any> | null;

    // Existing field data
    const { data: fd } = await supabase
      .from("field_data")
      .select("form_data")
      .eq("work_order_id", id)
      .maybeSingle();
    if (fd?.form_data && typeof fd.form_data === "object") {
      setFormData(fd.form_data as Record<string, any>);
    } else {
      // Pre-fill defaults from order context
      const defaults: Record<string, any> = {
        inspector_name: user?.email ?? "",
        county: (woData.orders as any)?.job_county ?? siteContext?.county ?? "",
        exposure_category: "C",
        risk_category: "II",
        enclosure_type: "Enclosed",
        Kzt: 1.0,
        Ke: 1.0,
      };
      const roofData = (woData.orders as any)?.roof_data as Record<string, any> | null;
      if (roofData?.area) defaults.roof_area_sqft = roofData.area;
      if (roofData?.pitch) defaults.roof_pitch = roofData.pitch;
      setFormData(defaults);

      // Check sibling work orders for cross-service data sharing
      const { data: siblingWOs } = await supabase
        .from("work_orders")
        .select("id, service_type")
        .eq("order_id", woData.order_id)
        .neq("id", woData.id);

      if (siblingWOs?.length) {
        for (const sibling of siblingWOs) {
          const { data: sibFd } = await supabase
            .from("field_data")
            .select("form_data")
            .eq("work_order_id", sibling.id)
            .maybeSingle();
          if (sibFd?.form_data) {
            const sibData = sibFd.form_data as Record<string, any>;
            const sharedKeys = [
              "building_width_ft", "building_length_ft", "mean_roof_height_ft",
              "parapet_height_ft", "deck_type", "noa_number", "year_built",
              "stories", "wall_height_ft"
            ];
            const prefills: Record<string, any> = {};
            for (const key of sharedKeys) {
              if (sibData[key] && !defaults[key]) {
                prefills[key] = sibData[key];
              }
            }
            if (Object.keys(prefills).length > 0) {
              setFormData(prev => ({ ...prev, ...prefills }));
              setSiblingPrefilled(true);
            }
            break;
          }
        }
      }
    }

    // Photos
    const { data: photoData } = await supabase
      .from("work_order_photos")
      .select("id, storage_path, caption, section_tag")
      .eq("work_order_id", id)
      .order("sort_order");
    if (photoData) {
      const withUrls = await Promise.all(
        photoData.map(async (p) => {
          const { data: urlData } = await supabase.storage
            .from("field-photos")
            .createSignedUrl(p.storage_path, 43200);
          return { ...p, url: urlData?.signedUrl ?? "" };
        })
      );
      setPhotos(withUrls);
    }
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  const setField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  // Photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionTag: string) => {
    if (!e.target.files?.length || !id || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const compressed = await compressImage(file);
        const photoId = crypto.randomUUID();
        const path = `work_orders/${id}/photos/${photoId}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("field-photos")
          .upload(path, compressed, { contentType: "image/jpeg" });
        if (upErr) { toast.error("Upload failed"); continue; }

        await supabase.from("work_order_photos").insert({
          work_order_id: id,
          uploaded_by: user.id,
          storage_path: path,
          section_tag: sectionTag,
          sort_order: photos.length,
        });
      }
      const { data: photoData } = await supabase
        .from("work_order_photos")
        .select("id, storage_path, caption, section_tag")
        .eq("work_order_id", id)
        .order("sort_order");
      if (photoData) {
        const withUrls = await Promise.all(
          photoData.map(async (p) => {
            const { data: urlData } = await supabase.storage.from("field-photos").createSignedUrl(p.storage_path, 43200);
            return { ...p, url: urlData?.signedUrl ?? "" };
          })
        );
        setPhotos(withUrls);
      }
      toast.success("Photo(s) uploaded");
    } catch {
      toast.error("Upload error");
    }
    setUploading(false);
    e.target.value = "";
  };

  const updateCaption = async (photoId: string, caption: string) => {
    await supabase.from("work_order_photos").update({ caption }).eq("id", photoId);
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption } : p)));
  };

  const deletePhoto = async (photo: PhotoRow) => {
    await supabase.storage.from("field-photos").remove([photo.storage_path]);
    await supabase.from("work_order_photos").delete().eq("id", photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    toast.success("Photo deleted");
  };

  const handleSaveDraft = async () => {
    if (!wo || !user || !id) return;
    setSaving(true);
    const { error } = await supabase.from("field_data").upsert(
      {
        work_order_id: id,
        service_type: wo.service_type,
        form_data: formData as unknown as Json,
        submitted_by: user.id,
      },
      { onConflict: "work_order_id" }
    );
    if (error) toast.error("Draft save failed");
    else toast.success("Draft saved");
    setSaving(false);
  };

  const openSignedUrl = async (storagePath: string) => {
    const { data } = await supabase.storage.from("reports").createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Could not open document");
  };

  // Validate & submit with auto-calculation
  const handleSubmit = async () => {
    if (!wo || !user || !id) return;
    const newErrors: Record<string, string> = {};

    if (!formData.inspection_date) newErrors.inspection_date = "Required";
    if (!formData.inspector_name) newErrors.inspector_name = "Required";

    // Photos are optional — no minimum count enforced

    if (wo.service_type === "special-inspection" && !formData.inspector_certification_accepted) {
      newErrors.inspector_certification_accepted = "Must accept certification";
    }
    if (wo.service_type === "drainage-analysis") {
      if (!formData.total_roof_area_sqft) newErrors.total_roof_area_sqft = "Required";
      if (!formData.primary_drains?.length) newErrors.primary_drains = "At least 1 primary drain required";
      if (!formData.secondary_drains?.length) newErrors.secondary_drains = "Secondary drain required (FBC §1502.3)";
      if (!formData.drainage_zones?.length) newErrors.drainage_zones = "At least 1 drainage zone required";
    }
    if (wo.service_type === "fastener-calculation") {
      if (!formData.building_width_ft) newErrors.building_width_ft = "Required";
      if (!formData.building_length_ft) newErrors.building_length_ft = "Required";
      if (!formData.mean_roof_height_ft) newErrors.mean_roof_height_ft = "Required";
      if (!formData.noa_number) newErrors.noa_number = "NOA/approval number required";
      if (!formData.noa_mdp_psf) newErrors.noa_mdp_psf = "NOA MDP required";
      if (!formData.system_type) newErrors.system_type = "Roof system type required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSubmitting(true);
    const { error: fdErr } = await supabase.from("field_data").upsert(
      {
        work_order_id: id,
        service_type: wo.service_type,
        form_data: formData as unknown as Json,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "work_order_id" }
    );

    if (fdErr) { toast.error("Save failed"); setSubmitting(false); return; }

    // Auto-calculate
    let calculationResults: Record<string, any> = {};

    if (wo.service_type === "fastener-calculation") {
      try {
        const { calculateFastener } = await import("@/lib/fastener-engine");
        const normDeck = (v: string) => ({
          Plywood: "plywood", OSB: "plywood",
          "Structural Concrete": "structural_concrete",
          "Steel Deck": "steel_deck", "Wood Plank": "wood_plank",
          "LW Insulating Concrete": "lw_concrete"
        }[v] ?? v);
        const normCon = (v: string) => ({
          "New Construction": "new", Reroof: "reroof", Recover: "recover"
        }[v] ?? v);
        const normEnc = (v: string) => ({
          Enclosed: "enclosed", "Partially Enclosed": "partially_enclosed", Open: "open"
        }[v] ?? v);

        const fyValue = formData.tas105_mean_lbf ?? formData.fy_lbf ?? 29.48;
        const inputs = {
          V: 185,
          exposureCategory: "C" as const,
          h: parseFloat(formData.mean_roof_height_ft) || 20,
          Kzt: 1.0,
          Kd: 0.85,
          Ke: 1.0,
          enclosure: normEnc(formData.enclosure_type ?? "Enclosed"),
          riskCategory: (formData.risk_category ?? "II"),
          buildingLength: parseFloat(formData.building_length_ft) || 0,
          buildingWidth: parseFloat(formData.building_width_ft) || 0,
          parapetHeight: parseFloat(formData.parapet_height_ft) || 0,
          systemType: formData.system_type ?? "modified_bitumen",
          deckType: normDeck(formData.deck_type ?? "Plywood"),
          constructionType: normCon(formData.construction_type ?? "New Construction"),
          existingLayers: formData.existing_layers === "2+" ? 2 : 1,
          sheetWidth_in: parseFloat(formData.sheet_width_in) || 39.375,
          lapWidth_in: parseFloat(formData.lap_width_in) || 4,
          Fy_lbf: parseFloat(String(fyValue)),
          fySource: formData.tas105_mean_lbf ? "tas105" as const : "noa" as const,
          initialRows: parseInt(formData.initial_rows) || 4,
          noa: {
            approvalType: formData.noa_approval_type === "FL Product Approval" ? "fl_product_approval" as const : "miami_dade_noa" as const,
            approvalNumber: formData.noa_number ?? "",
            manufacturer: formData.noa_manufacturer,
            productName: formData.noa_product,
            systemNumber: formData.noa_system_number,
            mdp_psf: parseFloat(formData.noa_mdp_psf) || 0,
            mdp_basis: formData.noa_mdp_basis === "Ultimate (will be ÷2 per TAS 114)" ? "ultimate" as const : "asd" as const,
            asterisked: formData.noa_asterisked ?? false,
          },
          boardLength_ft: parseFloat(formData.insulation_board_length_ft) || 4,
          boardWidth_ft: parseFloat(formData.insulation_board_width_ft) || 8,
          insulation_Fy_lbf: parseFloat(formData.insulation_fy_lbf) || parseFloat(String(fyValue)),
          county: formData.county === "Miami-Dade" ? "miami_dade" as const : "broward" as const,
          isHVHZ: true,
          ewa_membrane_ft2: 10,
        };
        calculationResults = calculateFastener(inputs as any);
      } catch (e) {
        console.error("Auto-calc fastener failed:", e);
      }
    }

    if (wo.service_type === "drainage-analysis") {
      try {
        const { runDrainageCalc } = await import("@/lib/drainage-calc");
        const county = formData.county || (wo.orders as any)?.job_county || "Broward";
        const calcInputs = {
          county,
          pipe_slope_assumption: "1/8" as const,
          zones: formData.drainage_zones ?? [],
          primary_drains: formData.primary_drains ?? [],
          secondary_drains: formData.secondary_drains ?? [],
        };
        calculationResults = runDrainageCalc(calcInputs);
      } catch (e) {
        console.error("Auto-calc drainage failed:", e);
      }
    }

    if (wo.service_type === "wind-mitigation-permit") {
      try {
        const { computeWindPressures } = await import("@/lib/wind-calc");
        const inputs = {
          V: 185,
          Kzt: 1.0,
          Kd: 0.85,
          Ke: 1.0,
          W: parseFloat(formData.building_width_ft) || 0,
          L: parseFloat(formData.building_length_ft) || 0,
          h: parseFloat(formData.mean_roof_height_ft) || 0,
        };
        if (inputs.W && inputs.L && inputs.h) {
          calculationResults = computeWindPressures(inputs);
        }
      } catch (e) {
        console.error("Auto-calc wind failed:", e);
      }
    }

    // Save calculation results
    if (Object.keys(calculationResults).length > 0) {
      await supabase
        .from("field_data")
        .update({ calculation_results: calculationResults as unknown as Json })
        .eq("work_order_id", id);
    }

    await supabase
      .from("work_orders")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", id);

    toast.success("Submitted. The PE will be notified for review.");
    setSubmitting(false);
    navigate("/tech");
  };

  if (!loaded) {
    return (
      <TechLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          <div className="bg-card border rounded-lg p-5 space-y-3">
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
            </div>
          </div>
        </div>
      </TechLayout>
    );
  }

  if (!wo) {
    return <TechLayout><div className="p-6"><p className="text-sm text-destructive">Work order not found</p></div></TechLayout>;
  }

  const sectionTags = PHOTO_SECTION_TAGS[wo.service_type] ?? ["General"];
  const minPhotos = MIN_PHOTO_COUNTS[wo.service_type] ?? 3;
  const siteContext = (wo.orders?.site_context as Record<string, any>) ?? {};
  const orderCounty = wo.orders?.job_county ?? siteContext.county ?? "";

  return (
    <TechLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate("/tech")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Rejection banner */}
        {wo.status === "rejected" && wo.rejection_notes && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-destructive mb-1">Sent Back for Revision</p>
            <p className="text-xs text-foreground/80">{wo.rejection_notes}</p>
          </div>
        )}

        {/* TOP SECTION */}
        <div className="bg-card border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <Badge className={cn("text-xs", STATUS_BADGE_CLASSES[wo.status])}>
              {STATUS_LABELS[wo.status] ?? wo.status}
            </Badge>
            {wo.scheduled_date && <span className="text-xs text-muted-foreground">Scheduled: {wo.scheduled_date}</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Client</p>
              <p className="font-medium">{clientProfile?.company_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Contact</p>
              <p>{clientProfile?.contact_name ?? "—"} · {clientProfile?.contact_phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Address</p>
              <p>{wo.orders?.job_address ?? "—"}, {wo.orders?.job_city ?? ""} {wo.orders?.job_zip ?? ""}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">County</p>
              <p>{orderCounty || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Service</p>
              <Badge variant="outline">{wo.service_type}</Badge>
            </div>
          </div>
        </div>

        {/* CLIENT-PROVIDED DOCUMENTS */}
        {(wo.orders?.noa_document_path || wo.orders?.roof_report_path) && (
          <section className="bg-card border rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold text-primary mb-3">Client-Provided Documents</h2>
            <div className="space-y-2">
              {wo.orders?.noa_document_path && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-hvhz-teal" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">NOA Document</p>
                    <p className="text-xs text-muted-foreground truncate">{wo.orders.noa_document_name}</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openSignedUrl(wo.orders!.noa_document_path!)}>
                    <ExternalLink className="h-3 w-3" /> View
                  </Button>
                </div>
              )}
              {wo.orders?.roof_report_path && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-hvhz-teal" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">
                      Measurement Report
                      {wo.orders.roof_report_type && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          {wo.orders.roof_report_type.charAt(0).toUpperCase() + wo.orders.roof_report_type.slice(1)}
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{wo.orders.roof_report_name}</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openSignedUrl(wo.orders!.roof_report_path!)}>
                    <ExternalLink className="h-3 w-3" /> View
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Sibling data pre-fill banner */}
        {siblingPrefilled && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3 mb-6">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">Building dimensions pre-filled from a sibling work order on the same job.</p>
          </div>
        )}

        {/* JOB CONDITIONS — shared */}
        <section className="bg-card border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-primary mb-4">Job Conditions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Inspection Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal min-h-[44px] text-base sm:text-sm", !formData.inspection_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.inspection_date ? format(new Date(formData.inspection_date), "PPP") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.inspection_date ? new Date(formData.inspection_date) : undefined}
                    onSelect={(d) => setField("inspection_date", d?.toISOString())}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {errors.inspection_date && <p className="text-xs text-destructive">{errors.inspection_date}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temperature (°F)</Label>
              <Input className="min-h-[44px] text-base sm:text-sm" type="number" value={formData.temperature_f ?? ""} onChange={(e) => setField("temperature_f", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Weather Notes</Label>
              <Input className="min-h-[44px] text-base sm:text-sm" value={formData.weather_notes ?? ""} onChange={(e) => setField("weather_notes", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Inspector Name *</Label>
              <Input className="min-h-[44px] text-base sm:text-sm" value={formData.inspector_name ?? ""} onChange={(e) => setField("inspector_name", e.target.value)} />
              {errors.inspector_name && <p className="text-xs text-destructive">{errors.inspector_name}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea className="text-base sm:text-sm" value={formData.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} rows={3} />
            </div>
          </div>
        </section>

        {/* SERVICE-SPECIFIC FORM */}
        <section className="bg-card border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-primary mb-4">{wo.service_type.replace(/-/g, " ")} Data</h2>
          <ServiceForm
            serviceType={wo.service_type}
            formData={formData}
            setField={setField}
            errors={errors}
            orderCounty={orderCounty}
            noaDocPath={wo.orders?.noa_document_path ?? null}
            openSignedUrl={openSignedUrl}
          />
        </section>

        {/* PHOTOS */}
        <section className="bg-card border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-primary mb-2">Photos</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Photos are optional. Current: {photos.length}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {sectionTags.map((tag) => (
              <label key={tag} className="relative">
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handlePhotoUpload(e, tag)} disabled={uploading} />
                <span className="flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-3 text-sm font-medium border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors active:scale-[0.98]">
                  <Camera className="h-5 w-5" /> {tag}
                </span>
              </label>
            ))}
          </div>
          {uploading && <p className="text-xs text-muted-foreground mb-2 animate-pulse">Uploading…</p>}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="border rounded-md overflow-hidden">
                {p.url && <img src={p.url} alt={p.caption ?? "Photo"} className="w-full h-28 object-cover" />}
                <div className="p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">{p.section_tag}</p>
                  <Input className="h-8 text-xs" placeholder="Caption" defaultValue={p.caption ?? ""} onBlur={(e) => updateCaption(p.id, e.target.value)} />
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive w-full min-h-[44px] sm:min-h-0" onClick={() => deletePhoto(p)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUBMIT */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving || submitting} className="min-h-[44px]">
            {saving ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || saving} className="bg-hvhz-navy hover:bg-hvhz-navy/90 px-8 min-h-[44px] text-base sm:text-sm">
            {submitting ? "Submitting…" : "Submit Work Order"}
          </Button>
        </div>
      </div>
    </TechLayout>
  );
}

// ─── SERVICE-SPECIFIC FORMS ─────────────────────────────────────────────────────

function ServiceForm({ serviceType, formData, setField, errors, orderCounty, noaDocPath, openSignedUrl }: {
  serviceType: string;
  formData: Record<string, any>;
  setField: (k: string, v: any) => void;
  errors: Record<string, string>;
  orderCounty: string;
  noaDocPath: string | null;
  openSignedUrl: (path: string) => void;
}) {
  switch (serviceType) {
    case "roof-inspection": return <RoofInspectionForm formData={formData} setField={setField} />;
    case "roof-certification": return <RoofCertificationForm formData={formData} setField={setField} />;
    case "drainage-analysis": return <DrainageAnalysisForm formData={formData} setField={setField} errors={errors} orderCounty={orderCounty} />;
    case "special-inspection": return <SpecialInspectionForm formData={formData} setField={setField} errors={errors} />;
    case "wind-mitigation-permit": return <WindMitigationForm formData={formData} setField={setField} orderCounty={orderCounty} />;
    case "fastener-calculation": return <FastenerCalcForm formData={formData} setField={setField} errors={errors} noaDocPath={noaDocPath} openSignedUrl={openSignedUrl} orderCounty={orderCounty} />;
    default: return <p className="text-sm text-muted-foreground">No specific form for this service type.</p>;
  }
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────
function FieldSelect({ label, field, options, formData, setField }: {
  label: string; field: string; options: string[]; formData: Record<string, any>; setField: (k: string, v: any) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={formData[field] ?? ""} onValueChange={(v) => setField(field, v)}>
        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldInput({ label, field, type = "text", formData, setField, help }: {
  label: string; field: string; type?: string; formData: Record<string, any>; setField: (k: string, v: any) => void; help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={formData[field] ?? ""}
        onChange={(e) => setField(field, type === "number" ? Number(e.target.value) : e.target.value)}
      />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function LockedField({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center h-10 px-3 bg-muted rounded text-sm">
        <Lock className="h-3 w-3 mr-1.5 text-muted-foreground" />{value}
        {note && <span className="ml-auto text-[10px] text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

// ─── ROOF INSPECTION ────────────────────────────────────────────────────────────
function RoofInspectionForm({ formData, setField }: { formData: Record<string, any>; setField: (k: string, v: any) => void }) {
  const defects: any[] = formData.defects_found ?? [];
  const addDefect = () => setField("defects_found", [...defects, { location: "", description: "", severity: "", recommended_action: "", priority: "" }]);
  const updateDefect = (i: number, key: string, val: string) => {
    const updated = [...defects];
    updated[i] = { ...updated[i], [key]: val };
    setField("defects_found", updated);
  };
  const removeDefect = (i: number) => setField("defects_found", defects.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldSelect label="Roof Type" field="roof_type" options={["Built-Up", "Modified Bitumen", "Single-Ply", "Metal", "Tile", "Shingle", "Other"]} formData={formData} setField={setField} />
        <FieldInput label="Roof Age (years)" field="roof_age_years" type="number" formData={formData} setField={setField} />
        <FieldInput label="Installation Year" field="installation_year" type="number" formData={formData} setField={setField} />
        <FieldSelect label="Overall Condition" field="overall_condition" options={["excellent", "good", "fair", "poor", "critical"]} formData={formData} setField={setField} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Condition Score ({formData.condition_score ?? 50}/100)</Label>
        <Slider value={[formData.condition_score ?? 50]} onValueChange={([v]) => setField("condition_score", v)} min={0} max={100} step={1} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldSelect label="Drainage Condition" field="drainage_condition" options={["good", "fair", "poor"]} formData={formData} setField={setField} />
        <div className="space-y-1.5">
          <Label className="text-xs">Ponding Observed</Label>
          <div className="flex items-center gap-2">
            <Switch checked={!!formData.ponding_observed} onCheckedChange={(c) => setField("ponding_observed", c)} />
            <span className="text-xs">{formData.ponding_observed ? "Yes" : "No"}</span>
          </div>
        </div>
        {["surface_condition", "flashing_condition", "penetrations_condition", "ventilation_condition"].map((f) => (
          <FieldSelect key={f} label={f.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} field={f} options={["good", "fair", "poor", "N/A"]} formData={formData} setField={setField} />
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Defects Found</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addDefect}><Plus className="h-3 w-3" /> Add Defect</Button>
        </div>
        {defects.map((d, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2 p-2 bg-muted/50 rounded">
            <Input className="h-7 text-xs" placeholder="Location" value={d.location} onChange={(e) => updateDefect(i, "location", e.target.value)} />
            <Input className="h-7 text-xs" placeholder="Description" value={d.description} onChange={(e) => updateDefect(i, "description", e.target.value)} />
            <Input className="h-7 text-xs" placeholder="Severity" value={d.severity} onChange={(e) => updateDefect(i, "severity", e.target.value)} />
            <Input className="h-7 text-xs" placeholder="Action" value={d.recommended_action} onChange={(e) => updateDefect(i, "recommended_action", e.target.value)} />
            <div className="flex gap-1">
              <Input className="h-7 text-xs flex-1" placeholder="Priority" value={d.priority} onChange={(e) => updateDefect(i, "priority", e.target.value)} />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeDefect(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Recommendations</Label>
        <Textarea value={formData.recommendations ?? ""} onChange={(e) => setField("recommendations", e.target.value)} rows={3} />
      </div>
      <FieldSelect label="Estimated Remaining Life (years)" field="estimated_remaining_life_years" options={["1", "2", "3", "5", "10", "15", "20+"]} formData={formData} setField={setField} />
    </div>
  );
}

// ─── ROOF CERTIFICATION ─────────────────────────────────────────────────────────
function RoofCertificationForm({ formData, setField }: { formData: Record<string, any>; setField: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <RoofInspectionForm formData={formData} setField={setField} />
      <div className="border-t pt-4 space-y-4">
        <h3 className="text-xs font-semibold text-primary">Certification Fields</h3>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Certification Recommended</Label>
          <Switch checked={!!formData.certification_recommended} onCheckedChange={(c) => setField("certification_recommended", c)} />
          <span className="text-xs">{formData.certification_recommended ? "Yes" : "No"}</span>
        </div>
        <FieldSelect label="Estimated Remaining Life (years)" field="estimated_remaining_life_years" options={Array.from({ length: 20 }, (_, i) => String(i + 1))} formData={formData} setField={setField} />
        <div className="space-y-1.5">
          <Label className="text-xs">Certification Conditions</Label>
          <Textarea value={formData.certification_conditions ?? ""} onChange={(e) => setField("certification_conditions", e.target.value)} rows={3} />
        </div>
      </div>
    </div>
  );
}

// ─── DRAINAGE ANALYSIS (enhanced) ───────────────────────────────────────────────
function DrainageAnalysisForm({ formData, setField, errors, orderCounty }: { formData: Record<string, any>; setField: (k: string, v: any) => void; errors?: Record<string, string>; orderCounty: string }) {
  const zones: any[] = formData.drainage_zones ?? [];
  const primaryDrains: any[] = formData.primary_drains ?? [];
  const secondaryDrains: any[] = formData.secondary_drains ?? [];
  const slopes: any[] = formData.slope_measurements ?? [];
  const pondingAreas: any[] = formData.ponding_areas ?? [];

  const county = formData.county || orderCounty || "Broward";
  const rainfallRate = DESIGN_RAINFALL[county] || 8.39;

  const ZONE_LETTERS = ["A", "B", "C", "D", "E", "F"];
  const PIPE_DIAMETERS = ["2", "3", "4", "5", "6", "8", "10"];
  const CONDITIONS = ["Good", "Fair", "Obstructed", "Damaged"];

  const handleZoneCountChange = (val: string) => {
    const count = parseInt(val) || 1;
    setField("zone_count", val);
    const totalArea = parseFloat(formData.total_roof_area_sqft) || 0;
    const areaPerZone = totalArea > 0 ? Math.round(totalArea / count) : 0;
    const newZones = Array.from({ length: count }, (_, i) => {
      const existing = zones[i];
      return existing ?? { zone_id: ZONE_LETTERS[i], description: "", area_sqft: areaPerZone || "", lowest_point: "" };
    });
    setField("drainage_zones", newZones);
  };

  const updateZone = (i: number, key: string, val: any) => {
    const updated = [...zones]; updated[i] = { ...updated[i], [key]: val }; setField("drainage_zones", updated);
  };

  const addPrimary = () => {
    const id = `D${primaryDrains.length + 1}`;
    setField("primary_drains", [...primaryDrains, {
      drain_id: id, zone_id: zones[0]?.zone_id ?? "A", location_description: "",
      drain_type: "Interior", pipe_diameter_in: 4, leader_type: "Vertical",
      pipe_slope: "1/8", condition: "Good", strainer_present: true, strainer_condition: "Clean", photo_tag: `Primary Drain ${id}`,
    }]);
  };
  const updatePrimary = (i: number, key: string, val: any) => {
    const updated = [...primaryDrains]; updated[i] = { ...updated[i], [key]: val }; setField("primary_drains", updated);
  };
  const removePrimary = (i: number) => setField("primary_drains", primaryDrains.filter((_, idx) => idx !== i));

  const addSecondary = () => {
    const id = `OD${secondaryDrains.length + 1}`;
    setField("secondary_drains", [...secondaryDrains, {
      drain_id: id, zone_id: zones[0]?.zone_id ?? "A", secondary_type: "Overflow Drain",
      location_description: "", pipe_diameter_in: 4, height_above_primary_in: 2,
      condition: "Good", photo_tag: `Secondary ${id}`,
    }]);
  };
  const updateSecondary = (i: number, key: string, val: any) => {
    const updated = [...secondaryDrains]; updated[i] = { ...updated[i], [key]: val }; setField("secondary_drains", updated);
  };
  const removeSecondary = (i: number) => setField("secondary_drains", secondaryDrains.filter((_, idx) => idx !== i));

  const addSlope = () => setField("slope_measurements", [...slopes, { location: "", slope_percent: "", method: "Digital level" }]);
  const updateSlope = (i: number, key: string, val: any) => {
    const updated = [...slopes]; updated[i] = { ...updated[i], [key]: val }; setField("slope_measurements", updated);
  };
  const removeSlope = (i: number) => setField("slope_measurements", slopes.filter((_, idx) => idx !== i));

  const addPonding = () => setField("ponding_areas", [...pondingAreas, { location: "", area_sqft: "", depth_in: "", hours_after_rain: "" }]);
  const updatePonding = (i: number, key: string, val: any) => {
    const updated = [...pondingAreas]; updated[i] = { ...updated[i], [key]: val }; setField("ponding_areas", updated);
  };
  const removePonding = (i: number) => setField("ponding_areas", pondingAreas.filter((_, idx) => idx !== i));

  const zoneOptions = zones.length > 0 ? zones.map((z: any) => z.zone_id) : ["A"];

  // Live capacity calc per zone
  const getZoneCapacity = (zoneId: string) => {
    const zone = zones.find((z: any) => z.zone_id === zoneId);
    if (!zone || !zone.area_sqft) return null;
    const qRequired = (zone.area_sqft * rainfallRate) / 96.23;
    const zoneDrains = primaryDrains.filter((d: any) => d.zone_id === zoneId);
    const qProvided = zoneDrains.reduce((sum: number, d: any) => {
      const { capacity } = getDrainCapacity(d.pipe_diameter_in, d.leader_type || "Vertical", "1/8");
      return sum + capacity;
    }, 0);
    const ratio = qRequired > 0 ? (qProvided / qRequired) * 100 : 0;
    return { qRequired: qRequired.toFixed(1), qProvided: qProvided.toFixed(1), ratio: Math.round(ratio) };
  };

  return (
    <div className="space-y-6">
      {/* Auto-derived info banner */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-xs">
          <span className="font-medium">County:</span> {county} | <span className="font-medium">Design Rainfall:</span> {rainfallRate} in/hr (NOAA Atlas 14, 100-yr 1-hr)
        </p>
        <Badge variant="outline" className="text-[10px] ml-auto">Auto-derived</Badge>
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
        Collect exact pipe sizes, types, and locations. Calculations are auto-generated from your field data for permit submittal.
      </p>

      {/* Section 1 — Roof Information */}
      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Roof Information</summary>
        <div className="px-3 pb-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldSelect label="Roof Type" field="roof_type" options={["Low-Slope", "Flat", "Sloped", "Other"]} formData={formData} setField={setField} />
            <FieldSelect label="Roof Membrane" field="roof_membrane" options={["Modified Bitumen", "TPO", "EPDM", "BUR", "Metal", "Other"]} formData={formData} setField={setField} />
            <FieldInput label="Total Roof Area (sqft) *" field="total_roof_area_sqft" type="number" formData={formData} setField={setField} />
            <div className="space-y-1.5">
              <Label className="text-xs">Number of Drainage Zones</Label>
              <Select value={formData.zone_count ?? "1"} onValueChange={handleZoneCountChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4"].map((n) => <SelectItem key={n} value={n}>{n}{n === "4" ? "+" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {errors?.total_roof_area_sqft && <p className="text-xs text-destructive">{errors.total_roof_area_sqft}</p>}
          {errors?.drainage_zones && <p className="text-xs text-destructive">{errors.drainage_zones}</p>}
          {zones.map((z: any, i: number) => (
            <div key={i} className="border rounded p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold">Zone {z.zone_id}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input className="h-9 text-sm" placeholder="Description" value={z.description} onChange={(e) => updateZone(i, "description", e.target.value)} />
                <Input className="h-9 text-sm" placeholder="Area (sqft)" type="number" value={z.area_sqft} onChange={(e) => updateZone(i, "area_sqft", Number(e.target.value))} />
                <Input className="h-9 text-sm" placeholder="Lowest point" value={z.lowest_point} onChange={(e) => updateZone(i, "lowest_point", e.target.value)} />
              </div>
              {/* Live capacity indicator */}
              {(() => {
                const cap = getZoneCapacity(z.zone_id);
                if (!cap) return null;
                const color = cap.ratio >= 100 ? "bg-green-500" : cap.ratio >= 70 ? "bg-amber-500" : "bg-red-500";
                const textColor = cap.ratio >= 100 ? "text-green-700" : cap.ratio >= 70 ? "text-amber-700" : "text-red-700";
                const icon = cap.ratio >= 100 ? "✓" : cap.ratio >= 70 ? "⚠" : "✗";
                return (
                  <div className="mt-2">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(cap.ratio, 100)}%` }} />
                    </div>
                    <p className={cn("text-[10px] mt-1", textColor)}>
                      {icon} Zone {z.zone_id}: {cap.ratio}% capacity — {cap.qProvided} / {cap.qRequired} GPM {cap.ratio >= 100 ? "adequate" : cap.ratio >= 70 ? "marginal" : "inadequate"}
                    </p>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </details>

      {/* Section 2 — Primary Drains */}
      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Primary Drains ({primaryDrains.length})</summary>
        <div className="px-3 pb-3 space-y-3">
          {errors?.primary_drains && <p className="text-xs text-destructive">{errors.primary_drains}</p>}
          {primaryDrains.map((d: any, i: number) => (
            <div key={i} className="border rounded p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{d.drain_id}</p>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removePrimary(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Zone</Label>
                  <Select value={d.zone_id} onValueChange={(v) => updatePrimary(i, "zone_id", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{zoneOptions.map((z: string) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Type</Label>
                  <Select value={d.drain_type} onValueChange={(v) => updatePrimary(i, "drain_type", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Interior", "Edge", "Parapet"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Pipe Diameter</Label>
                  <Select value={String(d.pipe_diameter_in)} onValueChange={(v) => updatePrimary(i, "pipe_diameter_in", Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PIPE_DIAMETERS.map((s) => <SelectItem key={s} value={s}>{s}"</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Leader</Label>
                  <Select value={d.leader_type} onValueChange={(v) => updatePrimary(i, "leader_type", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Vertical", "Horizontal"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Condition</Label>
                  <Select value={d.condition} onValueChange={(v) => updatePrimary(i, "condition", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Strainer</Label>
                  <div className="flex items-center gap-2 h-8">
                    <Switch checked={!!d.strainer_present} onCheckedChange={(c) => updatePrimary(i, "strainer_present", c)} />
                    <span className="text-[10px]">{d.strainer_present ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
              <Input className="h-8 text-xs" placeholder="Location description" value={d.location_description} onChange={(e) => updatePrimary(i, "location_description", e.target.value)} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={addPrimary}><Plus className="h-3 w-3" /> Add Primary Drain</Button>
        </div>
      </details>

      {/* Section 3 — Secondary Drains */}
      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Secondary Drains ({secondaryDrains.length})</summary>
        <div className="px-3 pb-3 space-y-3">
          <p className="text-[10px] text-muted-foreground">FBC §1502.3 requires independent secondary drainage for all HVHZ roofs.</p>
          {errors?.secondary_drains && <p className="text-xs text-destructive">{errors.secondary_drains}</p>}
          {secondaryDrains.map((d: any, i: number) => (
            <div key={i} className="border rounded p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{d.drain_id}</p>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeSecondary(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Zone</Label>
                  <Select value={d.zone_id} onValueChange={(v) => updateSecondary(i, "zone_id", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{zoneOptions.map((z: string) => <SelectItem key={z} value={z}>{z}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Type</Label>
                  <Select value={d.secondary_type} onValueChange={(v) => updateSecondary(i, "secondary_type", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Overflow Drain", "Scupper", "Emergency Overflow"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {d.secondary_type === "Scupper" ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Width (in)</Label>
                      <Input className="h-8 text-xs" type="number" value={d.scupper_width_in ?? ""} onChange={(e) => updateSecondary(i, "scupper_width_in", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Depth (in)</Label>
                      <Input className="h-8 text-xs" type="number" value={d.scupper_depth_in ?? ""} onChange={(e) => updateSecondary(i, "scupper_depth_in", Number(e.target.value))} />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-[10px]">Pipe Diameter</Label>
                    <Select value={String(d.pipe_diameter_in ?? 4)} onValueChange={(v) => updateSecondary(i, "pipe_diameter_in", Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{["2", "3", "4", "5", "6", "8"].map((s) => <SelectItem key={s} value={s}>{s}"</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[10px]">Height Above Primary (in)</Label>
                  <Input className="h-8 text-xs" type="number" value={d.height_above_primary_in ?? ""} onChange={(e) => updateSecondary(i, "height_above_primary_in", Number(e.target.value))} />
                  {d.height_above_primary_in != null && d.height_above_primary_in < 2 && (
                    <p className="text-[10px] text-destructive">Below 2" minimum (FBC §1101.7)</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Condition</Label>
                  <Select value={d.condition} onValueChange={(v) => updateSecondary(i, "condition", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Input className="h-8 text-xs" placeholder="Location description" value={d.location_description} onChange={(e) => updateSecondary(i, "location_description", e.target.value)} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={addSecondary}><Plus className="h-3 w-3" /> Add Secondary Drain</Button>
        </div>
      </details>

      {/* Section 4 — Slope Observations */}
      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Slope Observations ({slopes.length})</summary>
        <div className="px-3 pb-3 space-y-3">
          {slopes.map((s: any, i: number) => (
            <div key={i} className="flex flex-wrap gap-2 items-end">
              <Input className="h-8 text-xs flex-1 min-w-[100px]" placeholder="Location" value={s.location} onChange={(e) => updateSlope(i, "location", e.target.value)} />
              <Input className="h-8 text-xs w-20" placeholder="Slope %" type="number" step="0.1" value={s.slope_percent} onChange={(e) => updateSlope(i, "slope_percent", e.target.value)} />
              <Select value={s.method ?? "Digital level"} onValueChange={(v) => updateSlope(i, "method", v)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{["Digital level", "4ft level + ruler", "Estimate"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeSlope(i)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={addSlope}><Plus className="h-3 w-3" /> Add Measurement</Button>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Switch checked={!!formData.ponding_observed} onCheckedChange={(c) => setField("ponding_observed", c)} />
            <Label className="text-xs">Ponding Observed</Label>
          </div>
          {formData.ponding_observed && (
            <div className="space-y-2">
              {pondingAreas.map((p: any, i: number) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-muted/30 rounded">
                  <Input className="h-8 text-xs" placeholder="Location" value={p.location} onChange={(e) => updatePonding(i, "location", e.target.value)} />
                  <Input className="h-8 text-xs" placeholder="Area (sqft)" type="number" value={p.area_sqft} onChange={(e) => updatePonding(i, "area_sqft", e.target.value)} />
                  <Input className="h-8 text-xs" placeholder="Depth (in)" type="number" value={p.depth_in} onChange={(e) => updatePonding(i, "depth_in", e.target.value)} />
                  <div className="flex gap-1">
                    <Input className="h-8 text-xs flex-1" placeholder="Hrs after rain" type="number" value={p.hours_after_rain} onChange={(e) => updatePonding(i, "hours_after_rain", e.target.value)} />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removePonding(i)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1" onClick={addPonding}><Plus className="h-3 w-3" /> Add Ponding Area</Button>
            </div>
          )}
        </div>
      </details>

      {/* Section 5 — Conditions and Notes */}
      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Conditions & Notes</summary>
        <div className="px-3 pb-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Drain Conditions Summary</Label>
            <Textarea rows={3} placeholder="Overall drainage system condition..." value={formData.drain_conditions_summary ?? ""} onChange={(e) => setField("drain_conditions_summary", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Deficiencies Observed</Label>
            <Textarea rows={3} placeholder="List any blockages, damage, improper installations..." value={formData.deficiencies_observed ?? ""} onChange={(e) => setField("deficiencies_observed", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recommendations</Label>
            <Textarea rows={3} value={formData.recommendations ?? ""} onChange={(e) => setField("recommendations", e.target.value)} />
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── SPECIAL INSPECTION ─────────────────────────────────────────────────────────
function SpecialInspectionForm({ formData, setField, errors }: { formData: Record<string, any>; setField: (k: string, v: any) => void; errors: Record<string, string> }) {
  const inspType = formData.inspection_type ?? "";
  const checklist: any[] = formData.checklist_items ?? [];

  const handleTypeChange = (val: string) => {
    setField("inspection_type", val);
    const items = (SPECIAL_INSPECTION_CHECKLISTS[val] ?? []).map((desc) => ({
      item_description: desc, result: "", corrective_action: "",
    }));
    setField("checklist_items", items);
  };

  const updateChecklist = (i: number, key: string, val: string) => {
    const updated = [...checklist];
    updated[i] = { ...updated[i], [key]: val };
    setField("checklist_items", updated);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Inspection Type</Label>
          <Select value={inspType} onValueChange={handleTypeChange}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Roof Deck Fastening", "Roof Covering", "Rooftop Equipment", "Other"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FieldInput label="Permit Number" field="permit_number" formData={formData} setField={setField} />
      </div>

      {checklist.length > 0 && (
        <div>
          <Label className="text-xs font-semibold mb-2 block">Checklist</Label>
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <div key={i} className="p-2 bg-muted/50 rounded text-xs space-y-1">
                <p className="font-medium">{item.item_description}</p>
                <div className="flex gap-2">
                  <Select value={item.result} onValueChange={(v) => updateChecklist(i, "result", v)}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Result" /></SelectTrigger>
                    <SelectContent>
                      {["Pass", "Fail", "N/A"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input className="h-7 text-xs flex-1" placeholder="Corrective action" value={item.corrective_action} onChange={(e) => updateChecklist(i, "corrective_action", e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox id="cert-accept" checked={!!formData.inspector_certification_accepted} onCheckedChange={(c) => setField("inspector_certification_accepted", !!c)} />
        <Label htmlFor="cert-accept" className="text-xs">I certify this inspection was performed in accordance with FBC requirements *</Label>
      </div>
      {errors.inspector_certification_accepted && <p className="text-xs text-destructive">{errors.inspector_certification_accepted}</p>}
    </div>
  );
}

// ─── WIND MITIGATION (enhanced) ─────────────────────────────────────────────────
function WindMitigationForm({ formData, setField, orderCounty }: { formData: Record<string, any>; setField: (k: string, v: any) => void; orderCounty: string }) {
  return (
    <div className="space-y-4">
      {/* Locked HVHZ context */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <p className="text-xs">
          <span className="font-medium">V = 185 mph</span> | <span className="font-medium">Exposure C</span> | <span className="font-medium">County:</span> {orderCounty || "—"}
        </p>
        <Badge variant="outline" className="text-[10px] ml-auto">HVHZ Mandated</Badge>
      </div>

      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
        PERMIT-STYLE ENGINEERING REPORT — Not an insurance form. This documents HVHZ compliance for roofing permit submittal.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FieldInput label="Year Built" field="year_built" type="number" formData={formData} setField={setField} />
        <FieldSelect label="Occupancy Type" field="occupancy_type" options={["Residential", "Commercial", "Industrial"]} formData={formData} setField={setField} />
        <FieldInput label="Stories" field="stories" type="number" formData={formData} setField={setField} />
        <FieldInput label="Building Width (ft)" field="building_width_ft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Building Length (ft)" field="building_length_ft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Wall Height (ft)" field="wall_height_ft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Mean Roof Height (ft)" field="mean_roof_height_ft" type="number" formData={formData} setField={setField} />
        <FieldSelect label="Roof Shape" field="roof_shape" options={["Hip", "Gable", "Flat", "Monoslope", "Complex"]} formData={formData} setField={setField} />
        <FieldInput label="Roof Covering Type" field="roof_covering_type" formData={formData} setField={setField} />
        <FieldInput label="NOA Number" field="noa_number" formData={formData} setField={setField} />
        <div className="space-y-1.5">
          <Label className="text-xs">NOA Expiry</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !formData.noa_expiry && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-3 w-3" />
                {formData.noa_expiry ? format(new Date(formData.noa_expiry), "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={formData.noa_expiry ? new Date(formData.noa_expiry) : undefined} onSelect={(d) => setField("noa_expiry", d?.toISOString())} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <FieldSelect label="Deck Type" field="deck_type" options={["OSB", "Plywood", "Concrete", "Steel", "Other"]} formData={formData} setField={setField} />
        <FieldInput label="Deck Thickness" field="deck_thickness" formData={formData} setField={setField} />
        <FieldInput label="Fastener Type" field="fastener_type" formData={formData} setField={setField} />
        <FieldInput label="Fastener Size" field="fastener_size" formData={formData} setField={setField} />
        <FieldSelect label="Roof-to-Wall Connection" field="roof_to_wall_connection" options={["Clips", "Single Wraps", "Double Wraps", "Hurricane Straps", "Embedded", "Other"]} formData={formData} setField={setField} />
        <FieldInput label="Connection Spacing (in)" field="connection_spacing_inches" type="number" formData={formData} setField={setField} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">All Openings Protected</Label>
          <Switch checked={!!formData.all_openings_protected} onCheckedChange={(c) => setField("all_openings_protected", c)} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Garage Door Rated</Label>
          <Switch checked={!!formData.garage_door_rated} onCheckedChange={(c) => setField("garage_door_rated", c)} />
        </div>
      </div>
    </div>
  );
}

// ─── FASTENER CALCULATION (redesigned) ──────────────────────────────────────────
function FastenerCalcForm({ formData, setField, errors, noaDocPath, openSignedUrl, orderCounty }: {
  formData: Record<string, any>; setField: (k: string, v: any) => void; errors?: Record<string, string>;
  noaDocPath: string | null; openSignedUrl: (path: string) => void; orderCounty: string;
}) {
  const SYSTEM_TYPES = [
    { key: "modified_bitumen", label: "Modified Bitumen", sub: "RAS 117" },
    { key: "single_ply", label: "Single-Ply TPO/EPDM", sub: "RAS 137" },
    { key: "adhered", label: "Adhered Membrane", sub: "TAS 124" },
  ];

  const needsTas105 = formData.deck_type === "LW Insulating Concrete" ||
    (formData.construction_type === "Recover" && ["Plywood", "OSB", "Structural Concrete", "Steel Deck", "Wood Plank"].includes(formData.deck_type));

  return (
    <div className="space-y-6">
      {/* Locked Design Parameters */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-primary">Locked Design Parameters</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">HVHZ Mandated</Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <span><span className="font-medium">V</span> = 185 mph (FBC §1620.1)</span>
          <span><span className="font-medium">Exposure</span> C (FBC §1620)</span>
          <span><span className="font-medium">Kd</span> = 0.85</span>
          <span><span className="font-medium">Ke</span> = 1.0</span>
          <span><span className="font-medium">Kzt</span> = 1.0</span>
          <span><span className="font-medium">County</span>: {orderCounty || "—"}</span>
        </div>
      </div>

      {/* Field Observations */}
      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Building Dimensions</summary>
        <div className="px-3 pb-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput label="Building Width (ft) *" field="building_width_ft" type="number" formData={formData} setField={setField} />
            <FieldInput label="Building Length (ft) *" field="building_length_ft" type="number" formData={formData} setField={setField} />
            <FieldInput label="Mean Roof Height (ft) *" field="mean_roof_height_ft" type="number" formData={formData} setField={setField} />
            <FieldInput label="Parapet Height (ft)" field="parapet_height_ft" type="number" formData={formData} setField={setField} help="0 if no parapet" />
            <FieldInput label="Eave Height (ft)" field="eave_height_ft" type="number" formData={formData} setField={setField} />
          </div>
          {errors?.building_width_ft && <p className="text-xs text-destructive">{errors.building_width_ft}</p>}
          {errors?.building_length_ft && <p className="text-xs text-destructive">{errors.building_length_ft}</p>}
          {errors?.mean_roof_height_ft && <p className="text-xs text-destructive">{errors.mean_roof_height_ft}</p>}
        </div>
      </details>

      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Construction Context</summary>
        <div className="px-3 pb-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldSelect label="Construction Type *" field="construction_type" options={["New Construction", "Reroof", "Recover"]} formData={formData} setField={setField} />
            {formData.construction_type === "Recover" && (
              <div className="space-y-1.5">
                <FieldSelect label="Existing Roof Layers" field="existing_layers" options={["1", "2+"]} formData={formData} setField={setField} />
                {formData.existing_layers === "2+" && (
                  <p className="text-[10px] text-destructive">FBC §1521 prohibits recover over more than 1 layer in HVHZ</p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <FieldSelect label="Risk Category" field="risk_category" options={["I", "II", "III", "IV"]} formData={formData} setField={setField} />
              <p className="text-[10px] text-muted-foreground">From building permit — most residential = II</p>
            </div>
            <div className="space-y-1.5">
              <FieldSelect label="Enclosure Classification" field="enclosure_type" options={["Enclosed", "Partially Enclosed", "Open"]} formData={formData} setField={setField} />
              <p className="text-[10px] text-muted-foreground">Enclosed unless building has large unprotected openings</p>
            </div>
          </div>
        </div>
      </details>

      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Roof System</summary>
        <div className="px-3 pb-3 space-y-4">
          <div>
            <Label className="text-xs mb-2 block">System Type *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SYSTEM_TYPES.map((st) => (
                <button
                  key={st.key} type="button"
                  className={cn("rounded-lg border p-3 text-left transition-colors text-xs",
                    formData.system_type === st.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
                  )}
                  onClick={() => setField("system_type", st.key)}
                >
                  <p className="font-semibold">{st.label}</p>
                  <p className={cn("text-[10px]", formData.system_type === st.key ? "text-primary-foreground/70" : "text-muted-foreground")}>{st.sub}</p>
                </button>
              ))}
            </div>
            {errors?.system_type && <p className="text-xs text-destructive mt-1">{errors.system_type}</p>}
          </div>
          <FieldSelect label="Deck Type" field="deck_type" options={["Plywood", "OSB", "Structural Concrete", "Steel Deck", "Wood Plank", "LW Insulating Concrete"]} formData={formData} setField={setField} />
          {(formData.system_type === "modified_bitumen" || formData.system_type === "single_ply") && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldInput label="Sheet Width (in)" field="sheet_width_in" type="number" formData={formData} setField={setField} help="Full roll width from NOA" />
              <FieldInput label="Lap Width (in)" field="lap_width_in" type="number" formData={formData} setField={setField} help="Overlap seam width from NOA" />
              <FieldInput label="Initial Fastener Rows" field="initial_rows" type="number" formData={formData} setField={setField} />
            </div>
          )}
          {formData.system_type === "adhered" && (
            <p className="text-xs text-blue-700 bg-blue-50 p-2 rounded">Adhered system — no row spacing. PE verifies adhesive bond strength vs zone pressures.</p>
          )}
        </div>
      </details>

      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">NOA / Product Approval</summary>
        <div className="px-3 pb-3 space-y-4">
          {noaDocPath && (
            <button type="button" onClick={() => openSignedUrl(noaDocPath)} className="flex items-center gap-2 text-xs text-hvhz-teal hover:underline">
              <FileText className="h-4 w-4" /> Client uploaded NOA — View Document
            </button>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldSelect label="Approval Type" field="noa_approval_type" options={["Miami-Dade NOA", "FL Product Approval"]} formData={formData} setField={setField} />
            <FieldInput label="Approval Number *" field="noa_number" formData={formData} setField={setField} />
            <FieldInput label="Manufacturer" field="noa_manufacturer" formData={formData} setField={setField} />
            <FieldInput label="Product / System Name" field="noa_product" formData={formData} setField={setField} />
            <FieldInput label="System Number" field="noa_system_number" formData={formData} setField={setField} />
            <FieldInput label="NOA MDP (psf) *" field="noa_mdp_psf" type="number" formData={formData} setField={setField} help="Enter as negative. ASD-level from NOA." />
            <FieldSelect label="MDP Basis" field="noa_mdp_basis" options={["ASD Level", "Ultimate (will be ÷2 per TAS 114)"]} formData={formData} setField={setField} />
          </div>
          {errors?.noa_number && <p className="text-xs text-destructive">{errors.noa_number}</p>}
          {errors?.noa_mdp_psf && <p className="text-xs text-destructive">{errors.noa_mdp_psf}</p>}
          <div className="flex items-center gap-2">
            <Switch checked={!!formData.noa_asterisked} onCheckedChange={(c) => setField("noa_asterisked", c)} />
            <Label className="text-xs">(*) marked in NOA — extrapolation prohibited</Label>
          </div>
        </div>
      </details>

      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Fastener Data</summary>
        <div className="px-3 pb-3 space-y-4">
          <FieldInput label="Fy (lbf)" field="fy_lbf" type="number" formData={formData} setField={setField} help="From NOA. Typically 29.48 for #12 fasteners." />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FieldInput label="Insulation Board Length (ft)" field="insulation_board_length_ft" type="number" formData={formData} setField={setField} />
            <FieldInput label="Insulation Board Width (ft)" field="insulation_board_width_ft" type="number" formData={formData} setField={setField} />
            <FieldInput label="Insulation Fastener Fy (lbf)" field="insulation_fy_lbf" type="number" formData={formData} setField={setField} help="Same as membrane Fy unless separate NOA" />
          </div>
          {needsTas105 && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                TAS 105 pull test may be required. If a third-party lab report has been received, enter the mean pullout value (lbf) below.
              </p>
              <FieldInput label="Mean Pullout Value Fy from TAS 105 (lbf)" field="tas105_mean_lbf" type="number" formData={formData} setField={setField} help="Enter mean value from lab report. Overrides NOA Fy." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldInput label="Testing Agency" field="tas105_agency" formData={formData} setField={setField} />
                <div className="space-y-1.5">
                  <Label className="text-xs">Test Date</Label>
                  <Input type="date" value={formData.tas105_date ?? ""} onChange={(e) => setField("tas105_date", e.target.value)} className="h-10 text-sm" />
                </div>
              </div>
            </div>
          )}
        </div>
      </details>

      <details open className="border rounded-lg">
        <summary className="p-3 text-sm font-semibold text-primary cursor-pointer select-none">Field Observations</summary>
        <div className="px-3 pb-3 space-y-3">
          <Textarea rows={3} placeholder="Note deck conditions, existing attachment, visible damage, moisture, ponding..." value={formData.field_observations ?? ""} onChange={(e) => setField("field_observations", e.target.value)} />
        </div>
      </details>
    </div>
  );
}
