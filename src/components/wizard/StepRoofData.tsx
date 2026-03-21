import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, X, ChevronLeft } from "lucide-react";
import type { WizardData } from "@/lib/wizard-data";

interface StepRoofDataProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  userId: string;
}

export function StepRoofData({ data, onChange, onNext, onBack, userId }: StepRoofDataProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const orderId = crypto.randomUUID();

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB");
      return;
    }

    setUploading(true);
    setProgress(0);

    // Simulate progress since Supabase doesn't emit progress events
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 90));
    }, 200);

    const path = `orders/${orderId}/roof_report.pdf`;
    const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true });

    clearInterval(interval);
    setProgress(100);

    if (error) {
      toast.error("Upload failed: " + error.message);
      setProgress(0);
    } else {
      onChange({ roof_report_path: path, roof_report_name: file.name });
      toast.success("Report uploaded");
    }
    setUploading(false);
  }, [onChange, orderId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleClear = () => {
    onChange({ roof_report_path: "", roof_report_name: "" });
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Roof Data Upload</h2>
        <p className="text-sm text-muted-foreground mt-1">Optional — uploading a measurement report speeds up your order.</p>
      </div>

      {!data.roof_report_name ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card p-12 text-center transition-colors hover:border-hvhz-teal/50"
        >
          <Upload className="h-10 w-10 text-muted-foreground/50 mb-4" />
          <p className="text-sm font-medium text-primary mb-1">
            Upload your Roofr or EagleView measurement report PDF
          </p>
          <p className="text-xs text-muted-foreground mb-4">(optional — speeds up your order)</p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Choose File
            </span>
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">PDF only, max 20MB</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <FileText className="h-8 w-8 text-hvhz-teal" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{data.roof_report_name}</p>
            <p className="text-xs text-muted-foreground">Uploaded successfully</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClear} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {uploading && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-hvhz-teal transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground text-right">{progress}%</p>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          {!data.roof_report_name && (
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
