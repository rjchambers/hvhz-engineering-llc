import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PELayout } from "@/components/PELayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { STATUS_BADGE_CLASSES, STATUS_LABELS, TAS_SERVICES } from "@/lib/work-order-helpers";
import { MIN_PHOTO_COUNTS } from "@/lib/tech-form-helpers";
import { generateReport } from "@/utils/reports/generateReport";
import { embedStampOnPdf } from "@/utils/reports/embedStamp";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowLeft, ExternalLink, Loader2, X, Calculator, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Json } from "@/integrations/supabase/types";

interface WOData {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  client_id: string;
  order_id: string;
  result_pdf_url: string | null;
  assigned_engineer_id: string | null;
  orders?: { job_address: string | null; job_city: string | null; job_zip: string | null; job_county: string | null; roof_data: Json | null; services: string[]; notes: string | null } | null;
}

interface PhotoRow { id: string; storage_path: string; caption: string | null; section_tag: string | null; url?: string; }
interface EngineerProfile { full_name: string; pe_license_number: string | null; pe_license_state: string | null; pe_expiry: string | null; stamp_image_url: string | null; signature_image_url: string | null; }

// Required form_data keys per service type for compliance check
const REQUIRED_KEYS: Record<string, string[]> = {
  "roof-inspection": ["roof_type", "overall_condition", "condition_score", "inspection_date"],
  "roof-certification": ["roof_type", "overall_condition", "certification_recommended", "inspection_date"],
  "drainage-analysis": ["total_roof_area_sqft", "primary_drains", "secondary_drains", "drainage_zones", "inspection_date"],
  "special-inspection": ["inspection_type", "inspector_certification_accepted", "inspection_date"],
  "wind-mitigation-permit": ["year_built", "roof_shape", "deck_type", "roof_to_wall_connection", "inspection_date"],
  "fastener-calculation": ["building_width_ft", "building_length_ft", "mean_roof_height_ft", "noa_number", "noa_mdp_psf", "system_type", "inspection_date"],
};

export default function PEReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wo, setWo] = useState<WOData | null>(null);
  const [clientProfile, setClientProfile] = useState<{ company_name: string | null; contact_name: string | null } | null>(null);
  const [fieldData, setFieldData] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [engineerProfile, setEngineerProfile] = useState<EngineerProfile | null>(null);
  const [peNotes, setPeNotes] = useState("");
  const [certify, setCertify] = useState(false);
  const [signing, setSigning] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || !user) return;

    const { data: woData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, client_id, order_id, result_pdf_url, assigned_engineer_id, orders(job_address, job_city, job_zip, job_county, roof_data, services, notes)")
      .eq("id", id)
      .single();
    if (!woData) return;
    setWo(woData as unknown as WOData);

    // Auto-update to pe_review
    if (woData.status === "submitted") {
      await supabase.from("work_orders").update({ status: "pe_review", pe_reviewed_at: new Date().toISOString() }).eq("id", id);
    }

    // Client profile
    const { data: cp } = await supabase.from("client_profiles").select("company_name, contact_name").eq("user_id", woData.client_id).maybeSingle();
    setClientProfile(cp);

    // Field data
    const { data: fd } = await supabase.from("field_data").select("form_data").eq("work_order_id", id).maybeSingle();
    if (fd?.form_data && typeof fd.form_data === "object") setFieldData(fd.form_data as Record<string, any>);

    // Photos
    const { data: photoData } = await supabase.from("work_order_photos").select("id, storage_path, caption, section_tag").eq("work_order_id", id).order("sort_order");
    if (photoData) {
      const withUrls = await Promise.all(
        photoData.map(async (p) => {
          const { data: urlData } = await supabase.storage.from("field-photos").createSignedUrl(p.storage_path, 3600);
          return { ...p, url: urlData?.signedUrl ?? "" };
        })
      );
      setPhotos(withUrls);
    }

    // Engineer profile
    const { data: ep } = await supabase.from("engineer_profiles").select("full_name, pe_license_number, pe_license_state, pe_expiry, stamp_image_url, signature_image_url").eq("user_id", user.id).maybeSingle();
    setEngineerProfile(ep);

    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compliance checks
  const requiredKeys = REQUIRED_KEYS[wo?.service_type ?? ""] ?? [];
  const fieldsComplete = requiredKeys.every((k) => fieldData[k] != null && fieldData[k] !== "" && fieldData[k] !== false);
  const minPhotos = MIN_PHOTO_COUNTS[wo?.service_type ?? ""] ?? 3;
  const photosOk = photos.length >= minPhotos;
  const stampUploaded = !!engineerProfile?.stamp_image_url;
  const canSign = fieldsComplete && photosOk && stampUploaded && certify;
  const isTas = TAS_SERVICES.includes(wo?.service_type ?? "");

  // Sign & Seal flow
  const handleSign = async () => {
    if (!wo || !user || !engineerProfile || !id) return;
    setSigning(true);

    try {
      // Step A+B: Generate PDF
      const pdfBlob = generateReport(
        wo.service_type,
        { id: wo.id, scheduled_date: wo.scheduled_date, orders: wo.orders as any },
        fieldData,
        engineerProfile,
        peNotes || null
      );

      // Step C: Embed stamp
      let signedBlob = pdfBlob;
      if (engineerProfile.stamp_image_url) {
        signedBlob = await embedStampOnPdf(pdfBlob, engineerProfile.stamp_image_url);
      }

      // Step D: Upload
      const path = `work_orders/${id}/signed_report.pdf`;
      const { error: upErr } = await supabase.storage.from("reports").upload(path, signedBlob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw new Error("Upload failed: " + upErr.message);

      const { data: urlData } = supabase.storage.from("reports").getPublicUrl(path);
      const signedPdfUrl = urlData.publicUrl;

      // Step E: Call edge function
      const { error: fnErr } = await supabase.functions.invoke("sign-pdf", {
        body: { workOrderId: id, signedPdfUrl, peNotes: peNotes || null, signingMethod: "image-stamp" },
      });
      if (fnErr) throw new Error("Sign function failed: " + fnErr.message);

      toast.success("Report signed and sealed. Client notified.");
      navigate("/pe");
    } catch (err: any) {
      toast.error(err.message || "Signing failed");
    }
    setSigning(false);
  };

  // Reject
  const handleReject = async () => {
    if (!wo || !id) return;
    setRejecting(true);
    await supabase.from("work_orders").update({ status: "rejected", rejection_notes: rejectReason }).eq("id", id);
    toast.success("Sent back for revision");
    setRejecting(false);
    setRejectOpen(false);
    navigate("/pe");
  };

  if (!loaded) return <PELayout><div className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></div></PELayout>;
  if (!wo) return <PELayout><div className="p-6"><p className="text-sm text-destructive">Work order not found</p></div></PELayout>;

  // Group photos by section_tag
  const photosByTag: Record<string, PhotoRow[]> = {};
  photos.forEach((p) => {
    const tag = p.section_tag || "General";
    if (!photosByTag[tag]) photosByTag[tag] = [];
    photosByTag[tag].push(p);
  });

  const ReportPreview = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[hsl(var(--hvhz-navy))] text-white p-4 rounded-t-lg">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold">HVHZ ENGINEERING</h2>
            <p className="text-xs opacity-80">750 E Sample Rd, Pompano Beach FL 33064</p>
          </div>
          <div className="text-right text-xs opacity-80">
            <p>{wo.orders?.job_address ?? ""}, {wo.orders?.job_city ?? ""}</p>
            <p>Job #: {wo.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <p className="text-center font-bold mt-2 text-sm uppercase">{wo.service_type.replace(/-/g, " ")} Report</p>
      </div>

      {/* Job Info */}
      <ReportSection title="Job Information">
        <InfoRow label="Address" value={`${wo.orders?.job_address ?? ""}, ${wo.orders?.job_city ?? ""} ${wo.orders?.job_zip ?? ""}`} />
        <InfoRow label="County" value={wo.orders?.job_county ?? "—"} />
        <InfoRow label="Scheduled" value={wo.scheduled_date ?? "—"} />
        <InfoRow label="Client" value={clientProfile?.company_name ?? "—"} />
        <InfoRow label="Engineer" value={engineerProfile?.full_name ?? "—"} />
        <InfoRow label="PE License" value={`FL #${engineerProfile?.pe_license_number ?? "N/A"}`} />
      </ReportSection>

      {/* Job Conditions */}
      {fieldData.inspection_date && (
        <ReportSection title="Job Conditions">
          <InfoRow label="Inspection Date" value={fieldData.inspection_date ? format(new Date(fieldData.inspection_date), "PPP") : "—"} />
          <InfoRow label="Weather" value={fieldData.weather_notes ?? "—"} />
          <InfoRow label="Temperature" value={fieldData.temperature_f ? `${fieldData.temperature_f}°F` : "—"} />
          <InfoRow label="Inspector" value={fieldData.inspector_name ?? "—"} />
          {fieldData.notes && <p className="text-xs text-muted-foreground mt-2">{fieldData.notes}</p>}
        </ReportSection>
      )}

      {/* All field data rendered */}
      <ReportSection title="Field Data">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(fieldData)
            .filter(([k]) => !["inspection_date", "weather_notes", "temperature_f", "inspector_name", "notes"].includes(k))
            .map(([k, v]) => {
              if (Array.isArray(v)) return null; // arrays shown separately
              return <InfoRow key={k} label={k.replace(/_/g, " ")} value={typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—")} />;
            })}
        </div>
        {/* Array fields */}
        {Object.entries(fieldData)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => (
            <div key={k} className="mt-3">
              <p className="text-xs font-semibold text-primary capitalize mb-1">{k.replace(/_/g, " ")}</p>
              {(v as any[]).map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground ml-2 mb-1">
                  {Object.entries(item).map(([ik, iv]) => `${ik}: ${iv}`).join(" | ")}
                </div>
              ))}
            </div>
          ))}
      </ReportSection>

      {isTas && wo.result_pdf_url && (
        <div className="p-3 bg-muted rounded">
          <a href={wo.result_pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-hvhz-teal hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> View Uploaded Lab Report
          </a>
        </div>
      )}
    </div>
  );

  const ReviewPanel = () => (
    <div className="space-y-6">
      {/* Compliance Checklist */}
      <section>
        <h3 className="text-sm font-semibold text-primary mb-3">Compliance Checklist</h3>
        <div className="space-y-2">
          <CheckItem ok={fieldsComplete} label="Required fields complete" />
          <CheckItem ok={photosOk} label={`Minimum photos uploaded (${photos.length}/${minPhotos})`} />
          <CheckItem ok={stampUploaded} label="PE stamp uploaded" />
        </div>
      </section>

      {/* Photos */}
      <section>
        <h3 className="text-sm font-semibold text-primary mb-3">Photos ({photos.length})</h3>
        {Object.entries(photosByTag).map(([tag, tagPhotos]) => (
          <div key={tag} className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{tag}</p>
            <div className="grid grid-cols-3 gap-1">
              {tagPhotos.map((p) => (
                <div key={p.id} className="cursor-pointer" onClick={() => setLightboxUrl(p.url ?? null)}>
                  {p.url && <img src={p.url} alt={p.caption ?? ""} className="w-full h-16 object-cover rounded" />}
                  {p.caption && <p className="text-[9px] text-muted-foreground truncate">{p.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="text-xs text-muted-foreground">No photos uploaded</p>}
      </section>

      {/* PE Notes */}
      <section>
        <h3 className="text-sm font-semibold text-primary mb-2">Engineering Notes</h3>
        <p className="text-[11px] text-muted-foreground mb-1">These notes appear on the signed report</p>
        <Textarea value={peNotes} onChange={(e) => setPeNotes(e.target.value)} rows={4} placeholder="PE review notes…" />
      </section>

      {/* Sign & Seal */}
      <section className="border-t pt-4">
        <h3 className="text-sm font-semibold text-primary mb-3">Sign & Seal</h3>

        {/* Calculation Tool Button */}
        {wo.service_type === "wind-mitigation-permit" && (
          <Button variant="outline" className="w-full mb-3 gap-2" onClick={() => navigate(`/pe/calculations/wind-mitigation/${id}`)}>
            <Calculator className="h-4 w-4" /> Open Wind Mitigation Calculation Tool
          </Button>
        )}
        {wo.service_type === "fastener-calculation" && (
          <Button variant="outline" className="w-full mb-3 gap-2" onClick={() => navigate(`/pe/calculations/fastener/${id}`)}>
            <Eye className="h-4 w-4" /> Review Calculation →
          </Button>
        )}
        {wo.service_type === "drainage-analysis" && (
          <Button variant="outline" className="w-full mb-3 gap-2" onClick={() => navigate(`/pe/calculations/drainage-analysis/${id}`)}>
            <Calculator className="h-4 w-4" /> Open Drainage Analysis Tool
          </Button>
        )}
        {engineerProfile && (
          <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
            <p>{engineerProfile.full_name}</p>
            <p>FL PE #{engineerProfile.pe_license_number ?? "N/A"} · Exp: {engineerProfile.pe_expiry ?? "N/A"}</p>
          </div>
        )}
        {!stampUploaded && (
          <div className="bg-amber-50 text-amber-800 text-xs p-2 rounded mb-3">
            ⚠ Upload PE stamp in Profile before signing.
          </div>
        )}
        <div className="flex items-start gap-2 mb-3">
          <Checkbox id="certify" checked={certify} onCheckedChange={(c) => setCertify(!!c)} />
          <Label htmlFor="certify" className="text-xs leading-tight">
            I certify I have reviewed this report and it is accurate.
          </Label>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSign} disabled={!canSign || signing} className="flex-1 bg-hvhz-teal hover:bg-hvhz-teal/90">
            {signing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Signing…</> : "Sign & Seal Report"}
          </Button>
          <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => setRejectOpen(true)}>
            Send Back
          </Button>
        </div>
      </section>
    </div>
  );

  return (
    <PELayout>
      <div className="p-4 lg:p-6">
        <Button variant="ghost" size="sm" className="mb-4 gap-1" onClick={() => navigate("/pe")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-primary">{wo.service_type.replace(/-/g, " ")}</h1>
          <Badge className={cn("text-[11px]", STATUS_BADGE_CLASSES[wo.status])}>{STATUS_LABELS[wo.status] ?? wo.status}</Badge>
        </div>

        {/* Desktop: split layout */}
        <div className="hidden lg:grid lg:grid-cols-[55%_45%] gap-6">
          <div className="bg-card border rounded-lg p-5 overflow-y-auto max-h-[calc(100vh-160px)]">
            <ReportPreview />
          </div>
          <div className="bg-card border rounded-lg p-5 overflow-y-auto max-h-[calc(100vh-160px)]">
            <ReviewPanel />
          </div>
        </div>

        {/* Mobile: tabs */}
        <div className="lg:hidden">
          <Tabs defaultValue="report">
            <TabsList className="w-full">
              <TabsTrigger value="report" className="flex-1">Report</TabsTrigger>
              <TabsTrigger value="review" className="flex-1">Review</TabsTrigger>
            </TabsList>
            <TabsContent value="report" className="bg-card border rounded-lg p-4 mt-2"><ReportPreview /></TabsContent>
            <TabsContent value="review" className="bg-card border rounded-lg p-4 mt-2"><ReviewPanel /></TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
          <Button variant="ghost" className="absolute top-4 right-4 text-white" onClick={() => setLightboxUrl(null)}><X className="h-6 w-6" /></Button>
          <img src={lightboxUrl} alt="Full size" className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Back for Revision</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason for rejection *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="Describe what needs correction…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || rejecting}>
              {rejecting ? "Sending…" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PELayout>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b pb-3">
      <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 border-b border-primary/20 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-xs py-0.5">
      <span className="text-muted-foreground w-36 flex-shrink-0 capitalize">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
      <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
    </div>
  );
}
