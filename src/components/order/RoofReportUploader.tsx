import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RoofReportUploaderProps {
  roofReport: File | null;
  onRoofReportChange: (file: File | null) => void;
  roofReportType: string;
  onRoofReportTypeChange: (type: string) => void;
  onRoofAreaExtracted?: (area: number) => void;
}

export function RoofReportUploader({
  roofReport,
  onRoofReportChange,
  roofReportType,
  onRoofReportTypeChange,
  onRoofAreaExtracted,
}: RoofReportUploaderProps) {
  const reportInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [storagePath, setStoragePath] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleRoofReport = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20 MB)");
      return;
    }

    onRoofReportChange(file);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // Get auth token if available
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || anonKey;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-roof-report`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setStoragePath(result.storagePath || null);

      if (result.data?.roofArea && onRoofAreaExtracted) {
        onRoofAreaExtracted(result.data.roofArea);
        toast.success(`Roof area extracted: ${result.data.roofArea} sq ft`);
      } else {
        toast.info("Report uploaded — please enter roof area manually");
      }
    } catch (err: any) {
      console.error("Roof report upload error:", err);
      toast.error(err.message || "Failed to upload report");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onRoofReportChange(null);
    setStoragePath(null);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-primary">Roof Measurement Report</h4>
      <div className="flex gap-2">
        {["Roofr", "EagleView", "Other"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onRoofReportTypeChange(t)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              roofReportType === t
                ? "bg-hvhz-teal text-white border-hvhz-teal"
                : "bg-muted text-muted-foreground border-border hover:border-hvhz-teal/30"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {roofReport ? (
        <div className="flex items-center gap-3 rounded-lg border border-hvhz-teal/30 bg-hvhz-teal/5 p-3">
          {uploading ? (
            <Loader2 className="h-5 w-5 text-hvhz-teal animate-spin" />
          ) : (
            <FileText className="h-5 w-5 text-hvhz-teal" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{roofReport.name}</p>
            <p className="text-xs text-muted-foreground">
              {uploading ? "Uploading & parsing…" : formatSize(roofReport.size)}
            </p>
          </div>
          {!uploading && (
            <Button variant="ghost" size="sm" onClick={handleRemove}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => reportInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted-foreground hover:border-hvhz-teal/30 transition-colors"
        >
          <Upload className="h-5 w-5" />
          <span>Upload PDF (max 20MB)</span>
        </button>
      )}

      <input
        ref={reportInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => handleRoofReport(e.target.files)}
      />
    </div>
  );
}
