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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { STATUS_BADGE_CLASSES, STATUS_LABELS, TAS_SERVICES } from "@/lib/work-order-helpers";
import { MIN_PHOTO_COUNTS } from "@/lib/tech-form-helpers";
import { generateReport } from "@/utils/reports/generateReport";
import { embedStampOnPdf } from "@/utils/reports/embedStamp";
import type { PhotoData } from "@/utils/reports/reportLayout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, ArrowLeft, ExternalLink, Loader2, X, Calculator, Eye, ChevronLeft, ChevronRight, ChevronDown, FileText, Settings2 } from "lucide-react";
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
  orders?: {
    job_address: string | null; job_city: string | null; job_zip: string | null; job_county: string | null;
    roof_data: Json | null; services: string[]; notes: string | null;
    noa_document_path: string | null; noa_document_name: string | null;
    roof_report_path: string | null; roof_report_name: string | null; roof_report_type: string | null;
    site_context: Json | null;
  } | null;
}

interface PhotoRow { id: string; storage_path: string; caption: string | null; section_tag: string | null; url?: string; }
interface EngineerProfile { full_name: string; pe_license_number: string | null; pe_license_state: string | null; pe_expiry: string | null; stamp_image_url: string | null; signature_image_url: string | null; }

const REQUIRED_KEYS: Record<string, string[]> = {
  "roof-inspection": ["roof_type", "overall_condition", "condition_score", "inspection_date"],
  "roof-certification": ["roof_type", "overall_condition", "certification_recommended", "inspection_date"],
  "drainage-analysis": ["total_roof_area_sqft", "primary_drains", "secondary_drains", "drainage_zones", "inspection_date"],
  "special-inspection": ["inspection_type", "inspector_certification_accepted", "inspection_date"],
  "wind-mitigation-permit": ["year_built", "roof_shape", "deck_type", "roof_to_wall_connection", "inspection_date"],
  "fastener-calculation": ["building_width_ft", "building_length_ft", "mean_roof_height_ft", "noa_number", "noa_mdp_psf", "system_type", "inspection_date"],
};

async function fetchPhotoAsBase64(signedUrl: string): Promise<string> {
  const response = await fetch(signedUrl);
  if (!response.ok) throw new Error(`Photo fetch failed: ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function PEReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wo, setWo] = useState<WOData | null>(null);
  const [clientProfile, setClientProfile] = useState<{ company_name: string | null; contact_name: string | null } | null>(null);
  const [fieldData, setFieldData] = useState<Record<string, any>>({});
  const [calcResults, setCalcResults] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [engineerProfile, setEngineerProfile] = useState<EngineerProfile | null>(null);
  const [peNotes, setPeNotes] = useState("");
  const [certify, setCertify] = useState(false);
  const [signing, setSigning] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // PE Overrides
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [peOverrides, setPeOverrides] = useState<Record<string, any>>({});
  const [recalculating, setRecalculating] = useState(false);

  // Client document signed URLs
  const [noaDocUrl, setNoaDocUrl] = useState<string | null>(null);
  const [roofReportUrl, setRoofReportUrl] = useState<string | null>(null);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const lightboxPrev = (e: React.MouseEvent) => { e.stopPropagation(); setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null)); };
  const lightboxNext = (e: React.MouseEvent) => { e.stopPropagation(); setLightboxIndex((i) => (i !== null ? Math.min(photos.length - 1, i + 1) : null)); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i !== null ? Math.min(photos.length - 1, i + 1) : null));
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, photos.length]);

  const loadData = useCallback(async () => {
    if (!id || !user) return;

    const { data: woData } = await supabase
      .from("work_orders")
      .select("id, service_type, status, scheduled_date, client_id, order_id, result_pdf_url, assigned_engineer_id, orders(job_address, job_city, job_zip, job_county, roof_data, services, notes, noa_document_path, noa_document_name, roof_report_path, roof_report_name, roof_report_type, site_context)")
      .eq("id", id)
      .single();
    if (!woData) return;
    setWo(woData as unknown as WOData);

    if (woData.status === "submitted") {
      await supabase.from("work_orders").update({ status: "pe_review", pe_reviewed_at: new Date().toISOString() }).eq("id", id);
    }

    const { data: cp } = await supabase.from("client_profiles").select("company_name, contact_name").eq("user_id", woData.client_id).maybeSingle();
    setClientProfile(cp);

    // Field data + calculation_results
    const { data: fd } = await supabase.from("field_data").select("form_data, calculation_results").eq("work_order_id", id).maybeSingle();
    if (fd?.form_data && typeof fd.form_data === "object") setFieldData(fd.form_data as Record<string, any>);
    if (fd?.calculation_results && typeof fd.calculation_results === "object" && Object.keys(fd.calculation_results as object).length > 0) {
      setCalcResults(fd.calculation_results as Record<string, any>);
    }

    // Client-uploaded documents — generate signed URLs
    const orderObj = woData.orders as any;
    if (orderObj?.noa_document_path) {
      const { data: noaUrl } = await supabase.storage.from("reports").createSignedUrl(orderObj.noa_document_path, 43200);
      if (noaUrl?.signedUrl) setNoaDocUrl(noaUrl.signedUrl);
    }
    if (orderObj?.roof_report_path) {
      const { data: rrUrl } = await supabase.storage.from("reports").createSignedUrl(orderObj.roof_report_path, 43200);
      if (rrUrl?.signedUrl) setRoofReportUrl(rrUrl.signedUrl);
    }

    // Photos
    const { data: photoData } = await supabase.from("work_order_photos").select("id, storage_path, caption, section_tag").eq("work_order_id", id).order("sort_order");
    if (photoData) {
      const withUrls = await Promise.all(
        photoData.map(async (p) => {
          const { data: urlData } = await supabase.storage.from("field-photos").createSignedUrl(p.storage_path, 43200);
          return { ...p, url: urlData?.signedUrl ?? "" };
        })
      );
      setPhotos(withUrls);
    }

    const { data: ep } = await supabase.from("engineer_profiles").select("full_name, pe_license_number, pe_license_state, pe_expiry, stamp_image_url, signature_image_url").eq("user_id", user.id).maybeSingle();
    setEngineerProfile(ep);
    setLoaded(true);
  }, [id, user]);

  useEffect(() => { loadData(); }, [loadData]);

  // PE Override recalculation
  const handleRecalculate = async () => {
    if (!wo || !id) return;
    setRecalculating(true);
    try {
      let newResults: Record<string, any> = {};

      if (wo.service_type === "fastener-calculation") {
        const { calculateFastener } = await import("@/lib/fastener-engine");
        const normDeck = (v: string) => ({ Plywood: "plywood", OSB: "plywood", "Structural Concrete": "structural_concrete", "Steel Deck": "steel_deck", "Wood Plank": "wood_plank", "LW Insulating Concrete": "lw_concrete" }[v] ?? v);
        const normCon = (v: string) => ({ "New Construction": "new", Reroof: "reroof", Recover: "recover" }[v] ?? v);
        const normEnc = (v: string) => ({ Enclosed: "enclosed", "Partially Enclosed": "partially_enclosed", Open: "open" }[v] ?? v);
        const fyValue = fieldData.tas105_mean_lbf ?? fieldData.fy_lbf ?? 29.48;
        const inputs = {
          V: 185, exposureCategory: "C" as const, h: parseFloat(fieldData.mean_roof_height_ft) || 20,
          Kzt: peOverrides.Kzt ?? 1.0, Kd: 0.85, Ke: peOverrides.Ke ?? 1.0,
          enclosure: normEnc(fieldData.enclosure_type ?? "Enclosed") as any,
          riskCategory: (peOverrides.risk_category ?? fieldData.risk_category ?? "II") as any,
          buildingLength: parseFloat(fieldData.building_length_ft) || 0,
          buildingWidth: parseFloat(fieldData.building_width_ft) || 0,
          parapetHeight: parseFloat(fieldData.parapet_height_ft) || 0,
          systemType: (fieldData.system_type ?? "modified_bitumen") as any,
          deckType: normDeck(fieldData.deck_type ?? "Plywood") as any,
          constructionType: normCon(fieldData.construction_type ?? "New Construction") as any,
          existingLayers: fieldData.existing_layers === "2+" ? 2 : 1,
          sheetWidth_in: parseFloat(fieldData.sheet_width_in) || 39.375,
          lapWidth_in: parseFloat(fieldData.lap_width_in) || 4,
          Fy_lbf: parseFloat(String(fyValue)),
          fySource: (fieldData.tas105_mean_lbf ? "tas105" : "noa") as any,
          initialRows: parseInt(fieldData.initial_rows) || 4,
          noa: {
            approvalType: fieldData.noa_approval_type === "FL Product Approval" ? "fl_product_approval" as const : "miami_dade_noa" as const,
            approvalNumber: fieldData.noa_number ?? "",
            mdp_psf: parseFloat(fieldData.noa_mdp_psf) || 0,
            mdp_basis: (fieldData.noa_mdp_basis === "Ultimate (will be ÷2 per TAS 114)" ? "ultimate" : "asd") as any,
            asterisked: fieldData.noa_asterisked ?? false,
          },
          boardLength_ft: parseFloat(fieldData.insulation_board_length_ft) || 4,
          boardWidth_ft: parseFloat(fieldData.insulation_board_width_ft) || 8,
          insulation_Fy_lbf: parseFloat(fieldData.insulation_fy_lbf) || parseFloat(String(fyValue)),
          county: (fieldData.county === "Miami-Dade" ? "miami_dade" : "broward") as any,
          isHVHZ: true,
          ewa_membrane_ft2: peOverrides.ewa_membrane_ft2 ?? 10,
        };
        newResults = calculateFastener(inputs);
      } else if (wo.service_type === "drainage-analysis") {
        const { runDrainageCalc } = await import("@/lib/drainage-calc");
        const county = fieldData.county || wo.orders?.job_county || "Broward";
        newResults = runDrainageCalc({
          county,
          rainfall_override: peOverrides.rainfall_rate ? parseFloat(peOverrides.rainfall_rate) : undefined,
          pipe_slope_assumption: peOverrides.pipe_slope ?? "1/8",
          zones: fieldData.drainage_zones ?? [],
          primary_drains: fieldData.primary_drains ?? [],
          secondary_drains: fieldData.secondary_drains ?? [],
        });
      } else if (wo.service_type === "wind-mitigation-permit") {
        const { computeWindPressures } = await import("@/lib/wind-calc");
        const inputs = {
          V: 185, Kzt: peOverrides.Kzt ?? 1.0, Kd: 0.85, Ke: peOverrides.Ke ?? 1.0,
          W: parseFloat(fieldData.building_width_ft) || 0,
          L: parseFloat(fieldData.building_length_ft) || 0,
          h: parseFloat(fieldData.mean_roof_height_ft) || 0,
        };
        if (inputs.W && inputs.L && inputs.h) newResults = computeWindPressures(inputs);
      }

      if (Object.keys(newResults).length > 0) {
        await supabase.from("field_data").update({ calculation_results: newResults as unknown as Json }).eq("work_order_id", id);
        setCalcResults(newResults);
        toast.success("Recalculated with overrides applied");
      }
    } catch (err: any) {
      toast.error("Recalculation failed: " + (err.message || "Unknown error"));
    }
    setRecalculating(false);
  };

  const requiredKeys = REQUIRED_KEYS[wo?.service_type ?? ""] ?? [];
  const fieldsComplete = requiredKeys.every((k) => fieldData[k] != null && fieldData[k] !== "" && fieldData[k] !== false);
  const stampUploaded = !!engineerProfile?.stamp_image_url;
  const canSign = fieldsComplete && stampUploaded && certify;
  const isTas = TAS_SERVICES.includes(wo?.service_type ?? "");

  const handleSign = async () => {
    if (!wo || !user || !engineerProfile || !id) return;
    setSigning(true);
    try {
      let photoDataForPdf: PhotoData[] = [];
      if (wo.service_type === "wind-mitigation-permit" && photos.length > 0) {
        toast.info(`Loading ${photos.length} photos for PDF…`);
        const results = await Promise.allSettled(
          photos.map(async (p) => {
            if (!p.url) return null;
            const base64DataUrl = await fetchPhotoAsBase64(p.url);
            return { base64DataUrl, section_tag: p.section_tag, caption: p.caption };
          })
        );
        photoDataForPdf = results
          .filter((r): r is PromiseFulfilledResult<PhotoData | null> => r.status === "fulfilled" && r.value !== null)
          .map((r) => r.value!);
      }

      const { blob: pdfBlob, stampBoxMm } = generateReport(
        wo.service_type,
        { id: wo.id, scheduled_date: wo.scheduled_date, orders: wo.orders as any },
        fieldData, engineerProfile, peNotes || null, photoDataForPdf
      );

      let signedBlob = pdfBlob;
      if (engineerProfile.stamp_image_url) {
        let resolvedStampUrl = engineerProfile.stamp_image_url;
        if (!resolvedStampUrl.startsWith("http")) {
          const { data: signedData, error: signErr } = await supabase.storage.from("pe-credentials").createSignedUrl(resolvedStampUrl, 60);
          if (signErr || !signedData?.signedUrl) throw new Error("Could not resolve PE stamp URL. Check your stamp upload in Profile.");
          resolvedStampUrl = signedData.signedUrl;
        }
        signedBlob = await embedStampOnPdf(pdfBlob, resolvedStampUrl, stampBoxMm);
      }

      const path = `work_orders/${id}/signed_report.pdf`;
      const { error: upErr } = await supabase.storage.from("reports").upload(path, signedBlob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw new Error("Upload failed: " + upErr.message);

      const { data: urlData } = supabase.storage.from("reports").getPublicUrl(path);
      const signedPdfUrl = urlData.publicUrl;

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

  const photosByTag: Record<string, PhotoRow[]> = {};
  photos.forEach((p) => {
    const tag = p.section_tag || "General";
    if (!photosByTag[tag]) photosByTag[tag] = [];
    photosByTag[tag].push(p);
  });

  // --- Inline Calculation Result Components ---

  const FastenerCalcSummary = () => {
    if (!calcResults || !calcResults.zonePressures) return null;
    const hasWarnings = calcResults.warnings?.some((w: any) => w.level !== "info");
    const overallStatus = hasWarnings ? "warning" : "ok";
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Auto-Calculated Results</h4>
          <Badge className={cn("text-[10px]", overallStatus === "ok" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
            {overallStatus === "ok" ? "All Zones Pass" : "Review Warnings"}
          </Badge>
        </div>
        {/* Zone pressures */}
        <div className="border rounded p-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">Zone Pressures</p>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {calcResults.noaResults?.map((nr: any) => (
              <div key={nr.zone} className="bg-muted/50 rounded px-2 py-1">
                <span className="font-medium">Zone {nr.zone}:</span> {Math.abs(nr.P_psf).toFixed(1)} psf
              </div>
            ))}
          </div>
        </div>
        {/* Fastener schedule */}
        {calcResults.fastenerResults && (
          <div className="border rounded p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Fastener Schedule</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead><tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 pr-2">Zone</th><th className="text-left py-1 pr-2">Pressure</th>
                  <th className="text-left py-1 pr-2">Rows</th><th className="text-left py-1 pr-2">Row Spacing</th>
                  <th className="text-left py-1 pr-2">Field Spacing</th><th className="text-left py-1">Half-Sheet</th>
                </tr></thead>
                <tbody>
                  {calcResults.fastenerResults.map((fr: any) => (
                    <tr key={fr.zone} className="border-b border-muted/50">
                      <td className="py-1 pr-2 font-medium">{fr.zone}</td>
                      <td className="py-1 pr-2">{fr.P_psf} psf</td>
                      <td className="py-1 pr-2">{fr.n_rows}</td>
                      <td className="py-1 pr-2">{fr.RS_in}"</td>
                      <td className="py-1 pr-2">{fr.FS_used_in}"</td>
                      <td className="py-1">{fr.halfSheetRequired ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Insulation fasteners */}
        {calcResults.insulationResults && (
          <div className="border rounded p-2 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Insulation Fasteners</p>
            <div className="grid grid-cols-3 gap-1 text-xs">
              {calcResults.insulationResults.map((ir: any) => (
                <div key={ir.zone} className="bg-muted/50 rounded px-2 py-1">
                  <span className="font-medium">Zone {ir.zone}:</span> {ir.N_used} ({ir.layout})
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Warnings */}
        {calcResults.warnings?.filter((w: any) => w.level !== "info").length > 0 && (
          <div className="border border-amber-200 rounded p-2 space-y-1">
            <p className="text-[10px] font-semibold text-amber-700 uppercase">Warnings</p>
            {calcResults.warnings.filter((w: any) => w.level !== "info").map((w: any, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <Badge variant="outline" className={cn("text-[9px] shrink-0", w.level === "warning" ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700")}>{w.level}</Badge>
                <span className="text-muted-foreground">{w.message}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground italic">
          Auto-calculated from technician field data. Review all inputs and results before signing.
        </p>
      </div>
    );
  };

  const DrainageCalcSummary = () => {
    if (!calcResults || !calcResults.zone_results) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Auto-Calculated Results</h4>
          <Badge className={cn("text-[10px]", calcResults.overall_primary_adequate && calcResults.overall_secondary_adequate ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
            {calcResults.overall_primary_adequate && calcResults.overall_secondary_adequate ? "Compliant" : "Deficient"}
          </Badge>
        </div>
        <div className="border rounded p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Total Required:</span> <span className="font-medium">{calcResults.total_required_gpm} gpm</span></div>
            <div><span className="text-muted-foreground">Total Provided:</span> <span className="font-medium">{calcResults.total_primary_provided_gpm} gpm</span></div>
          </div>
          {calcResults.zone_results.map((zr: any) => (
            <div key={zr.zone_id} className="bg-muted/50 rounded p-2 text-xs">
              <p className="font-medium mb-1">Zone {zr.zone_id}</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <span>Required: {zr.q_required_gpm} gpm</span>
                <span>Primary: {zr.q_primary_provided_gpm} gpm — {zr.primary_adequate ? <span className="text-green-700">✓ Adequate</span> : <span className="text-red-600">✗ Deficient</span>}</span>
                <span>Secondary: {zr.q_secondary_provided_gpm} gpm — {zr.secondary_adequate ? <span className="text-green-700">✓ Compliant</span> : <span className="text-red-600">✗ Deficient</span>}</span>
              </div>
            </div>
          ))}
        </div>
        {calcResults.deficiencies?.length > 0 && (
          <div className="border border-red-200 rounded p-2 space-y-1">
            <p className="text-[10px] font-semibold text-red-700 uppercase">Deficiencies</p>
            {calcResults.deficiencies.map((d: string, i: number) => (
              <p key={i} className="text-xs text-red-600">• {d}</p>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground italic">Auto-calculated from technician field data. Review all inputs and results before signing.</p>
      </div>
    );
  };

  const WindCalcSummary = () => {
    if (!calcResults || !calcResults.zones) return null;
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Auto-Calculated Wind Pressures</h4>
        <div className="border rounded p-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">qh (ASD):</span> <span className="font-medium">{calcResults.qh_psf?.toFixed(1) ?? "—"} psf</span></div>
            <div><span className="text-muted-foreground">Kh:</span> <span className="font-medium">{calcResults.Kh?.toFixed(4) ?? "—"}</span></div>
          </div>
          <div className="mt-2 space-y-1">
            {calcResults.zones?.map((z: any) => (
              <div key={z.zone} className="flex justify-between text-xs bg-muted/50 rounded px-2 py-1">
                <span className="font-medium">Zone {z.zone}</span>
                <span>{z.pressure_psf?.toFixed(1)} psf</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic">Auto-calculated from technician field data. Review before signing.</p>
      </div>
    );
  };

  const ReportPreview = () => (
    <div className="space-y-4">
      {/* Header — mirrors PDF navy banner + teal accent */}
      <div>
        <div className="bg-[hsl(var(--hvhz-navy))] text-white p-4 rounded-t-lg">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold">HVHZ ENGINEERING</h2>
              <p className="text-xs opacity-80">Roof Engineering for South Florida's HVHZ</p>
              <p className="text-xs opacity-60">750 E Sample Rd, Pompano Beach FL 33064</p>
            </div>
            <div className="text-right text-xs opacity-80">
              <p>{wo.orders?.job_address ?? ""}, {wo.orders?.job_city ?? ""}</p>
              <p>WO-{wo.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
        <div className="bg-hvhz-teal text-white text-center py-1">
          <p className="font-bold text-sm uppercase tracking-wide">{wo.service_type.replace(/-/g, " ")} Report</p>
        </div>
      </div>

      {/* Document Info Table */}
      <div className="border rounded overflow-hidden">
        <div className="grid grid-cols-4 text-xs">
          {[
            ["Report No.", `WO-${wo.id.slice(0, 8).toUpperCase()}`],
            ["Date", format(new Date(), "PPP")],
            ["Client", clientProfile?.company_name ?? "—"],
            ["County", wo.orders?.job_county ?? "—"],
            ["Job Address", `${wo.orders?.job_address ?? ""}, ${wo.orders?.job_city ?? ""}`],
            ["Inspection", fieldData.inspection_date ? format(new Date(fieldData.inspection_date), "PPP") : "—"],
            ["Engineer", engineerProfile?.full_name ?? "—"],
            ["PE License", `FL #${engineerProfile?.pe_license_number ?? "N/A"}`],
          ].map(([label, value], i) => (
            <div key={i} className={cn("px-3 py-1.5", i % 4 < 2 ? "" : "", Math.floor(i / 4) % 2 === 1 ? "bg-muted/40" : "")}>
              {i % 2 === 0 ? (
                <span className="text-muted-foreground">{label}</span>
              ) : (
                <span className="font-medium text-foreground">{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 1.0 Scope */}
      <ReportSection number="1.0" title="Scope of Engineering Services">
        <p className="text-xs text-muted-foreground">Standard scope section per service type.</p>
      </ReportSection>

      {/* 2.0 Codes */}
      <ReportSection number="2.0" title="Applicable Codes & Standards">
        <p className="text-xs text-muted-foreground">Code references rendered in the PDF report.</p>
      </ReportSection>

      {/* Inline Calculation Results */}
      {wo.service_type === "fastener-calculation" && Object.keys(calcResults).length > 0 && (
        <ReportSection number="5.0" title="Wind Pressure Calculation">
          <FastenerCalcSummary />
        </ReportSection>
      )}
      {wo.service_type === "drainage-analysis" && Object.keys(calcResults).length > 0 && (
        <ReportSection number="8.0" title="Drainage Compliance Matrix">
          <DrainageCalcSummary />
        </ReportSection>
      )}
      {wo.service_type === "wind-mitigation-permit" && Object.keys(calcResults).length > 0 && (
        <ReportSection number="7.0" title="Wind Pressure Analysis">
          <WindCalcSummary />
        </ReportSection>
      )}

      {/* Field Data */}
      <ReportSection number="" title="Field Data">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(fieldData)
            .filter(([k]) => !["inspection_date", "weather_notes", "temperature_f", "inspector_name", "notes"].includes(k))
            .map(([k, v]) => {
              if (Array.isArray(v)) return null;
              return <InfoRow key={k} label={k.replace(/_/g, " ")} value={typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—")} />;
            })}
        </div>
        {Object.entries(fieldData)
          .filter(([, v]) => Array.isArray(v))
          .map(([k, v]) => (
            <div key={k} className="mt-3">
              <p className="text-xs font-semibold text-primary capitalize mb-1">{k.replace(/_/g, " ")}</p>
              {(v as any[]).map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground ml-2 mb-1">
                  {typeof item === "object" ? Object.entries(item).map(([ik, iv]) => `${ik}: ${iv}`).join(" | ") : String(item)}
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

      {/* Client-Uploaded Documents */}
      {(noaDocUrl || roofReportUrl) && (
        <section>
          <h3 className="text-sm font-semibold text-primary mb-3">Client Documents</h3>
          <div className="space-y-2">
            {noaDocUrl && (
              <a href={noaDocUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs p-2 border rounded hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 text-hvhz-teal shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">📄 Client NOA Document</p>
                  <p className="text-muted-foreground truncate">{wo.orders?.noa_document_name ?? "NOA Document"}</p>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
              </a>
            )}
            {roofReportUrl && (
              <a href={roofReportUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs p-2 border rounded hover:bg-muted/50 transition-colors">
                <FileText className="h-4 w-4 text-hvhz-teal shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">📄 Measurement Report ({wo.orders?.roof_report_type ?? "Report"})</p>
                  <p className="text-muted-foreground truncate">{wo.orders?.roof_report_name ?? "Roof Report"}</p>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Photos */}
      <section>
        <h3 className="text-sm font-semibold text-primary mb-3">Photos ({photos.length})</h3>
        {Object.entries(photosByTag).map(([tag, tagPhotos]) => (
          <div key={tag} className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-primary">{tag}</p>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tagPhotos.length} photo{tagPhotos.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tagPhotos.map((p) => (
                <div key={p.id} className="border rounded-md overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" onClick={() => openLightbox(photos.indexOf(p))}>
                  {p.url && <img src={p.url} alt={p.caption ?? tag} className="w-full h-32 object-cover" />}
                  {p.caption && <p className="text-[10px] text-muted-foreground px-1.5 py-1 leading-tight truncate">{p.caption}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="text-xs text-muted-foreground">No photos uploaded</p>}
      </section>

      {/* Engineering Overrides */}
      {["fastener-calculation", "drainage-analysis", "wind-mitigation-permit"].includes(wo.service_type) && (
        <Collapsible open={overridesOpen} onOpenChange={setOverridesOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-primary">
              <span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Engineering Overrides</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", overridesOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <p className="text-[10px] text-muted-foreground">Override auto-derived values when site conditions differ from defaults. Changes require recalculation.</p>
            {wo.service_type === "drainage-analysis" && (
              <>
                <div>
                  <Label className="text-xs">Rainfall Rate Override (in/hr)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 8.39" className="h-8 text-xs mt-1"
                    value={peOverrides.rainfall_rate ?? ""} onChange={(e) => setPeOverrides((p) => ({ ...p, rainfall_rate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Pipe Slope Assumption</Label>
                  <Input type="text" placeholder='1/8" per ft' className="h-8 text-xs mt-1"
                    value={peOverrides.pipe_slope ?? ""} onChange={(e) => setPeOverrides((p) => ({ ...p, pipe_slope: e.target.value }))} />
                </div>
              </>
            )}
            {(wo.service_type === "fastener-calculation" || wo.service_type === "wind-mitigation-permit") && (
              <>
                <div>
                  <Label className="text-xs">Kzt Override (Topographic Factor)</Label>
                  <Input type="number" step="0.01" placeholder="1.0" className="h-8 text-xs mt-1"
                    value={peOverrides.Kzt ?? ""} onChange={(e) => setPeOverrides((p) => ({ ...p, Kzt: parseFloat(e.target.value) || undefined }))} />
                </div>
                <div>
                  <Label className="text-xs">Ke Override (Ground Elevation Factor)</Label>
                  <Input type="number" step="0.01" placeholder="1.0" className="h-8 text-xs mt-1"
                    value={peOverrides.Ke ?? ""} onChange={(e) => setPeOverrides((p) => ({ ...p, Ke: parseFloat(e.target.value) || undefined }))} />
                </div>
              </>
            )}
            {wo.service_type === "fastener-calculation" && (
              <>
                <div>
                  <Label className="text-xs">Risk Category Override</Label>
                  <Input type="text" placeholder="II" className="h-8 text-xs mt-1"
                    value={peOverrides.risk_category ?? ""} onChange={(e) => setPeOverrides((p) => ({ ...p, risk_category: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">EWA Membrane (ft²)</Label>
                  <Input type="number" step="1" placeholder="10" className="h-8 text-xs mt-1"
                    value={peOverrides.ewa_membrane_ft2 ?? ""} onChange={(e) => setPeOverrides((p) => ({ ...p, ewa_membrane_ft2: parseFloat(e.target.value) || undefined }))} />
                </div>
              </>
            )}
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={handleRecalculate} disabled={recalculating}>
              {recalculating ? <><Loader2 className="h-3 w-3 animate-spin" /> Recalculating…</> : <><Calculator className="h-3 w-3" /> Recalculate with Overrides</>}
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* PE Notes */}
      <section>
        <h3 className="text-sm font-semibold text-primary mb-2">Engineering Notes</h3>
        <p className="text-[11px] text-muted-foreground mb-1">These notes appear on the signed report</p>
        <Textarea value={peNotes} onChange={(e) => setPeNotes(e.target.value)} rows={4} placeholder="PE review notes…" />
      </section>

      {/* Sign & Seal */}
      <section className="border-t pt-4">
        <h3 className="text-sm font-semibold text-primary mb-3">Sign & Seal</h3>
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
          <div className="bg-amber-50 text-amber-800 text-xs p-2 rounded mb-3">⚠ Upload PE stamp in Profile before signing.</div>
        )}
        <div className="flex items-start gap-2 mb-3">
          <Checkbox id="certify" checked={certify} onCheckedChange={(c) => setCertify(!!c)} />
          <Label htmlFor="certify" className="text-xs leading-tight">I certify I have reviewed this report and it is accurate.</Label>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSign} disabled={!canSign || signing} className="flex-1 bg-hvhz-teal hover:bg-hvhz-teal/90">
            {signing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Signing…</> : "Sign & Seal Report"}
          </Button>
          <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => setRejectOpen(true)}>Send Back</Button>
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
          {fieldData.pe_override_applied && (
            <Badge className="text-[10px] bg-amber-100 text-amber-800">PE Overrides Applied</Badge>
          )}
        </div>
        {/* Desktop: split layout */}
        <div className="hidden lg:grid lg:grid-cols-[55%_45%] gap-6">
          <div className="bg-card border rounded-lg p-5 overflow-y-auto max-h-[calc(100vh-160px)]"><ReportPreview /></div>
          <div className="bg-card border rounded-lg p-5 overflow-y-auto max-h-[calc(100vh-160px)]"><ReviewPanel /></div>
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
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <Button variant="ghost" className="absolute top-4 right-4 text-white hover:text-white/80" onClick={() => setLightboxIndex(null)}><X className="h-6 w-6" /></Button>
          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">{lightboxIndex + 1} / {photos.length}</p>
          <Button variant="ghost" className="absolute left-4 text-white hover:text-white/80 h-12 w-12 p-0" onClick={lightboxPrev} disabled={lightboxIndex === 0}><ChevronLeft className="h-8 w-8" /></Button>
          <div className="flex flex-col items-center gap-3 px-20" onClick={(e) => e.stopPropagation()}>
            <img src={photos[lightboxIndex]?.url ?? ""} alt={photos[lightboxIndex]?.caption ?? "Photo"} className="max-w-[80vw] max-h-[80vh] object-contain rounded" />
            <div className="text-center">
              {photos[lightboxIndex]?.section_tag && <p className="text-white/60 text-xs mb-0.5">{photos[lightboxIndex].section_tag}</p>}
              {photos[lightboxIndex]?.caption && <p className="text-white text-sm">{photos[lightboxIndex].caption}</p>}
            </div>
          </div>
          <Button variant="ghost" className="absolute right-4 text-white hover:text-white/80 h-12 w-12 p-0" onClick={lightboxNext} disabled={lightboxIndex === photos.length - 1}><ChevronRight className="h-8 w-8" /></Button>
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
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || rejecting}>{rejecting ? "Sending…" : "Confirm Rejection"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PELayout>
  );
}

function ReportSection({ number, title, children }: { number?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b pb-3">
      <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 border-b border-primary/20 pb-1">
        {number ? `${number}  ` : ''}{title}
      </h3>
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
