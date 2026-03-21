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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Camera, Trash2, Plus, ArrowLeft, AlertCircle } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface WOData {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  client_id: string;
  order_id: string;
  orders?: {
    job_address: string | null;
    job_city: string | null;
    job_zip: string | null;
    job_county: string | null;
    roof_data: Json | null;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  // Load work order + existing field_data
  const loadData = useCallback(async () => {
    if (!id) return;
    const { data: woData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, client_id, order_id, orders(job_address, job_city, job_zip, job_county, roof_data)")
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

    // Existing field data
    const { data: fd } = await supabase
      .from("field_data")
      .select("form_data")
      .eq("work_order_id", id)
      .maybeSingle();
    if (fd?.form_data && typeof fd.form_data === "object") {
      setFormData(fd.form_data as Record<string, any>);
    } else {
      // Pre-fill defaults
      const defaults: Record<string, any> = {
        inspector_name: user?.email ?? "",
      };
      const roofData = woData.orders?.roof_data as Record<string, any> | null;
      if (roofData?.area) defaults.roof_area_sqft = roofData.area;
      if (roofData?.pitch) defaults.roof_pitch = roofData.pitch;
      setFormData(defaults);
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
            .createSignedUrl(p.storage_path, 3600);
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
      // Reload photos
      const { data: photoData } = await supabase
        .from("work_order_photos")
        .select("id, storage_path, caption, section_tag")
        .eq("work_order_id", id)
        .order("sort_order");
      if (photoData) {
        const withUrls = await Promise.all(
          photoData.map(async (p) => {
            const { data: urlData } = await supabase.storage.from("field-photos").createSignedUrl(p.storage_path, 3600);
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

  // Validate & submit
  const handleSubmit = async () => {
    if (!wo || !user || !id) return;
    const newErrors: Record<string, string> = {};

    if (!formData.inspection_date) newErrors.inspection_date = "Required";
    if (!formData.inspector_name) newErrors.inspector_name = "Required";

    const minPhotos = MIN_PHOTO_COUNTS[wo.service_type] ?? 3;
    if (photos.length < minPhotos) newErrors.photos = `At least ${minPhotos} photos required`;

    // Service-specific validation
    if (wo.service_type === "special-inspection" && !formData.inspector_certification_accepted) {
      newErrors.inspector_certification_accepted = "Must accept certification";
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
          <div className="bg-card border rounded-lg p-5 space-y-3">
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
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
  const roofData = wo.orders?.roof_data as Record<string, any> | null;

  return (
    <TechLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate("/tech")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

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
              <p>{wo.orders?.job_county ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Service</p>
              <Badge variant="outline">{wo.service_type}</Badge>
            </div>
            {roofData && Object.keys(roofData).length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs">Roof Data</p>
                <p className="text-xs">{Object.entries(roofData).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
              </div>
            )}
          </div>
        </div>

        {/* JOB CONDITIONS — shared */}
        <section className="bg-card border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-primary mb-4">Job Conditions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Inspection Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.inspection_date && "text-muted-foreground")}>
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
              <Input type="number" value={formData.temperature_f ?? ""} onChange={(e) => setField("temperature_f", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Weather Notes</Label>
              <Input value={formData.weather_notes ?? ""} onChange={(e) => setField("weather_notes", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Inspector Name *</Label>
              <Input value={formData.inspector_name ?? ""} onChange={(e) => setField("inspector_name", e.target.value)} />
              {errors.inspector_name && <p className="text-xs text-destructive">{errors.inspector_name}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={formData.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} rows={3} />
            </div>
          </div>
        </section>

        {/* SERVICE-SPECIFIC FORM */}
        <section className="bg-card border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-primary mb-4">{wo.service_type} Data</h2>
          <ServiceForm serviceType={wo.service_type} formData={formData} setField={setField} errors={errors} />
        </section>

        {/* PHOTOS */}
        <section className="bg-card border rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-primary mb-2">Photos</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Minimum {minPhotos} photos required. Current: {photos.length}
            {photos.length < minPhotos && <span className="text-destructive ml-1">({minPhotos - photos.length} more needed)</span>}
          </p>
          {errors.photos && <p className="text-xs text-destructive mb-2 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.photos}</p>}

          {/* Upload per section tag */}
          <div className="flex flex-wrap gap-2 mb-4">
            {sectionTags.map((tag) => (
              <label key={tag} className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e, tag)}
                  disabled={uploading}
                />
                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md cursor-pointer hover:bg-muted transition-colors">
                  <Camera className="h-3 w-3" /> {tag}
                </span>
              </label>
            ))}
          </div>
          {uploading && <p className="text-xs text-muted-foreground mb-2">Uploading…</p>}

          {/* Photo grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div key={p.id} className="border rounded-md overflow-hidden">
                {p.url && <img src={p.url} alt={p.caption ?? "Photo"} className="w-full h-28 object-cover" />}
                <div className="p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">{p.section_tag}</p>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Caption"
                    defaultValue={p.caption ?? ""}
                    onBlur={(e) => updateCaption(p.id, e.target.value)}
                  />
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive w-full" onClick={() => deletePhoto(p)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUBMIT */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-hvhz-navy hover:bg-hvhz-navy/90 px-8"
          >
            {submitting ? "Submitting…" : "Submit Work Order"}
          </Button>
        </div>
      </div>
    </TechLayout>
  );
}

// ─── SERVICE-SPECIFIC FORMS ─────────────────────────────────────────────────────

function ServiceForm({ serviceType, formData, setField, errors }: {
  serviceType: string;
  formData: Record<string, any>;
  setField: (k: string, v: any) => void;
  errors: Record<string, string>;
}) {
  switch (serviceType) {
    case "roof-inspection": return <RoofInspectionForm formData={formData} setField={setField} />;
    case "roof-certification": return <RoofCertificationForm formData={formData} setField={setField} />;
    case "drainage-analysis": return <DrainageAnalysisForm formData={formData} setField={setField} />;
    case "special-inspection": return <SpecialInspectionForm formData={formData} setField={setField} errors={errors} />;
    case "wind-mitigation-permit": return <WindMitigationForm formData={formData} setField={setField} />;
    case "fastener-calculation": return <FastenerCalcForm formData={formData} setField={setField} />;
    default: return <p className="text-sm text-muted-foreground">No specific form for this service type.</p>;
  }
}

// ─── Shared select helper ───────────────────────────────────────────────────────
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

function FieldInput({ label, field, type = "text", formData, setField }: {
  label: string; field: string; type?: string; formData: Record<string, any>; setField: (k: string, v: any) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={formData[field] ?? ""}
        onChange={(e) => setField(field, type === "number" ? Number(e.target.value) : e.target.value)}
      />
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

      {/* Defects */}
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
        {formData.linked_inspection_id && (
          <p className="text-xs text-muted-foreground">Linked inspection: {formData.linked_inspection_id}</p>
        )}
      </div>
    </div>
  );
}

// ─── DRAINAGE ANALYSIS ──────────────────────────────────────────────────────────
function DrainageAnalysisForm({ formData, setField }: { formData: Record<string, any>; setField: (k: string, v: any) => void }) {
  const slopes: any[] = formData.slope_measurements ?? [];
  const addSlope = () => setField("slope_measurements", [...slopes, { location: "", slope_percent: "" }]);
  const updateSlope = (i: number, key: string, val: string) => {
    const updated = [...slopes];
    updated[i] = { ...updated[i], [key]: val };
    setField("slope_measurements", updated);
  };
  const removeSlope = (i: number) => setField("slope_measurements", slopes.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">PE will perform all drainage flow calculations during review.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldInput label="Roof Area (sqft)" field="roof_area_sqft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Number of Drains" field="number_of_drains" type="number" formData={formData} setField={setField} />
        <FieldSelect label="Drain Type" field="drain_type" options={["Interior", "Scupper", "Edge", "Overflow"]} formData={formData} setField={setField} />
        <FieldInput label="Drain Size (inches)" field="drain_size_inches" type="number" formData={formData} setField={setField} />
        <FieldInput label="Number of Overflow Drains" field="number_overflow_drains" type="number" formData={formData} setField={setField} />
        <FieldInput label="Lowest Point Location" field="lowest_point_location" formData={formData} setField={setField} />
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs">Ponding Evidence</Label>
        <Switch checked={!!formData.ponding_evidence} onCheckedChange={(c) => setField("ponding_evidence", c)} />
      </div>
      {formData.ponding_evidence && (
        <div className="space-y-1.5">
          <Label className="text-xs">Ponding Notes</Label>
          <Textarea value={formData.ponding_notes ?? ""} onChange={(e) => setField("ponding_notes", e.target.value)} rows={2} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Slope Measurements</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addSlope}><Plus className="h-3 w-3" /> Add Measurement</Button>
        </div>
        {slopes.map((s, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <Input className="h-7 text-xs flex-1" placeholder="Location" value={s.location} onChange={(e) => updateSlope(i, "location", e.target.value)} />
            <Input className="h-7 text-xs w-24" placeholder="Slope %" value={s.slope_percent} onChange={(e) => updateSlope(i, "slope_percent", e.target.value)} />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeSlope(i)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
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
      item_description: desc,
      result: "",
      corrective_action: "",
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
        <Checkbox
          id="cert-accept"
          checked={!!formData.inspector_certification_accepted}
          onCheckedChange={(c) => setField("inspector_certification_accepted", !!c)}
        />
        <Label htmlFor="cert-accept" className="text-xs">I certify this inspection was performed in accordance with FBC requirements *</Label>
      </div>
      {errors.inspector_certification_accepted && <p className="text-xs text-destructive">{errors.inspector_certification_accepted}</p>}
    </div>
  );
}

// ─── WIND MITIGATION ────────────────────────────────────────────────────────────
function WindMitigationForm({ formData, setField }: { formData: Record<string, any>; setField: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
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

// ─── FASTENER CALCULATION ───────────────────────────────────────────────────────
function FastenerCalcForm({ formData, setField }: { formData: Record<string, any>; setField: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">Field measurements only. PE performs all calculations.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <FieldInput label="Building Width (ft)" field="building_width_ft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Building Length (ft)" field="building_length_ft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Eave Height (ft)" field="eave_height_ft" type="number" formData={formData} setField={setField} />
        <FieldInput label="Mean Roof Height (ft)" field="mean_roof_height_ft" type="number" formData={formData} setField={setField} />
        <FieldSelect label="Roof Type" field="roof_type" options={["Hip", "Gable", "Flat"]} formData={formData} setField={setField} />
        <FieldSelect label="Deck Type" field="deck_type" options={["OSB", "Plywood", "Concrete"]} formData={formData} setField={setField} />
        <FieldInput label="Fastener Type" field="fastener_type" formData={formData} setField={setField} />
        <FieldInput label="Fastener Size" field="fastener_size" formData={formData} setField={setField} />
        <FieldInput label="Field Zone Spacing" field="field_zone_spacing" formData={formData} setField={setField} />
        <FieldInput label="Perimeter Zone Spacing" field="perimeter_zone_spacing" formData={formData} setField={setField} />
        <FieldInput label="Corner Zone Spacing" field="corner_zone_spacing" formData={formData} setField={setField} />
        <FieldInput label="NOA System" field="noa_system" formData={formData} setField={setField} />
      </div>
    </div>
  );
}
