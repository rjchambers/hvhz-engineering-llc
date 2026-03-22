import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, X, ChevronLeft, Info, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardData } from "@/lib/wizard-data";

interface StepSiteDataProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  userId: string;
}

export function StepSiteData({ data, onChange, onNext, onBack, userId }: StepSiteDataProps) {
  const [uploadingNoa, setUploadingNoa] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [noaProgress, setNoaProgress] = useState(0);
  const [reportProgress, setReportProgress] = useState(0);

  const orderId = useState(() => crypto.randomUUID())[0];

  const handleNoaFile = useCallback(async (file: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, JPG, or PNG files are accepted");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB");
      return;
    }

    setUploadingNoa(true);
    setNoaProgress(0);
    const interval = setInterval(() => setNoaProgress((p) => Math.min(p + 10, 90)), 200);

    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `orders/${orderId}/noa_document.${ext}`;
    const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true });

    clearInterval(interval);
    setNoaProgress(100);

    if (error) {
      toast.error("Upload failed: " + error.message);
      setNoaProgress(0);
    } else {
      onChange({ noa_document_path: path, noa_document_name: file.name });
      toast.success("NOA document uploaded");
    }
    setUploadingNoa(false);
  }, [onChange, orderId]);

  const handleReportFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB");
      return;
    }

    setUploadingReport(true);
    setReportProgress(0);
    const interval = setInterval(() => setReportProgress((p) => Math.min(p + 10, 90)), 200);

    const path = `orders/${orderId}/roof_report.pdf`;
    const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true });

    clearInterval(interval);
    setReportProgress(100);

    if (error) {
      toast.error("Upload failed: " + error.message);
      setReportProgress(0);
    } else {
      onChange({ roof_report_path: path, roof_report_name: file.name });
      toast.success("Report uploaded");
    }
    setUploadingReport(false);
  }, [onChange, orderId]);

  const REPORT_TYPES = [
    { key: "roofr", label: "Roofr" },
    { key: "eagleview", label: "EagleView" },
    { key: "other", label: "Other" },
  ];

  const uploading = uploadingNoa || uploadingReport;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-primary">Site Data Collection</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload project documents to speed up your order. Both sections are optional.</p>
      </div>

      {/* Section 1: NOA Document Upload */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-primary">Product Approval (NOA) Document</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Upload the Miami-Dade NOA or FL Product Approval document for the roofing system being installed.
            Annotate or highlight which system number applies to this project.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-hvhz-teal/10 border border-hvhz-teal/20 p-3">
          <Info className="h-4 w-4 text-hvhz-teal shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/80">
            The NOA document tells our engineers exactly which roofing system is approved for your project.
            If you have a specific system number, write it on the document or note it below.
          </p>
        </div>

        {!data.noa_document_name ? (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleNoaFile(f); }}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card p-10 text-center transition-colors hover:border-hvhz-teal/50"
            >
              <Upload className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-primary mb-1">Upload NOA / Product Approval</p>
              <p className="text-xs text-muted-foreground mb-3">PDF, JPG, or PNG — max 20MB</p>
              <label className="cursor-pointer">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNoaFile(f); }} />
                <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  Choose File
                </span>
              </label>
            </div>
            {uploadingNoa && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-hvhz-teal transition-all duration-300 rounded-full" style={{ width: `${noaProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-right">{noaProgress}%</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Check className="h-5 w-5 text-green-600" />
            <FileText className="h-6 w-6 text-hvhz-teal" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{data.noa_document_name}</p>
              <p className="text-xs text-green-600">Uploaded successfully</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onChange({ noa_document_path: "", noa_document_name: "" })} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">NOA System Number (if known)</Label>
          <Input
            value={data.noa_system_number ?? ""}
            onChange={(e) => onChange({ noa_system_number: e.target.value })}
            placeholder="e.g., System #1234"
            className="max-w-xs"
          />
        </div>
      </section>

      {/* Section 2: Measurement Report Upload */}
      <section className="space-y-4 border-t pt-6">
        <div>
          <h3 className="text-sm font-semibold text-primary">Roof Measurement Report</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Optional — Upload a Roofr, EagleView, or similar measurement report.
            This speeds up your order by providing building dimensions and roof area.
          </p>
        </div>

        <div className="flex gap-2">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.key}
              type="button"
              onClick={() => onChange({ roof_report_type: rt.key })}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-colors border",
                data.roof_report_type === rt.key
                  ? "bg-hvhz-teal text-white border-hvhz-teal"
                  : "bg-card text-muted-foreground border-border hover:border-muted-foreground/50"
              )}
            >
              {rt.label}
            </button>
          ))}
        </div>

        {!data.roof_report_name ? (
          <>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleReportFile(f); }}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card p-10 text-center transition-colors hover:border-hvhz-teal/50"
            >
              <Upload className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-primary mb-1">Upload Measurement Report</p>
              <p className="text-xs text-muted-foreground mb-3">PDF only — max 20MB</p>
              <label className="cursor-pointer">
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReportFile(f); }} />
                <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                  Choose File
                </span>
              </label>
            </div>
            {uploadingReport && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-hvhz-teal transition-all duration-300 rounded-full" style={{ width: `${reportProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-right">{reportProgress}%</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <Check className="h-5 w-5 text-green-600" />
            <FileText className="h-6 w-6 text-hvhz-teal" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{data.roof_report_name}</p>
              <p className="text-xs text-green-600">
                {data.roof_report_type ? `${data.roof_report_type.charAt(0).toUpperCase() + data.roof_report_type.slice(1)} report — ` : ""}Uploaded successfully
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onChange({ roof_report_path: "", roof_report_name: "" })} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          {!data.noa_document_name && !data.roof_report_name && (
            <Button variant="ghost" onClick={onNext}>Skip this step</Button>
          )}
          <Button onClick={onNext} disabled={uploading} className="bg-primary text-primary-foreground">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
