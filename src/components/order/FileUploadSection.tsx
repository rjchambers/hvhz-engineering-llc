import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoofReportUploader } from "./RoofReportUploader";

interface FileUploadSectionProps {
  uploadedFiles: File[];
  onFilesChange: (files: File[]) => void;
  roofReport: File | null;
  onRoofReportChange: (file: File | null) => void;
  roofReportType: string;
  onRoofReportTypeChange: (type: string) => void;
  orderReport: boolean;
  onOrderReportChange: (v: boolean) => void;
  onRoofAreaExtracted?: (area: number) => void;
}

export function FileUploadSection({
  uploadedFiles,
  onFilesChange,
  roofReport,
  onRoofReportChange,
  roofReportType,
  onRoofReportTypeChange,
  orderReport,
  onOrderReportChange,
  onRoofAreaExtracted,
}: FileUploadSectionProps) {
  const filesInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    const valid = Array.from(newFiles).filter(
      (f) => allowed.includes(f.type) && f.size <= 50 * 1024 * 1024
    );
    const combined = [...uploadedFiles, ...valid].slice(0, 5);
    onFilesChange(combined);
  };

  const removeFile = (index: number) => {
    onFilesChange(uploadedFiles.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Part A: Roof Report */}
      <RoofReportUploader
        roofReport={roofReport}
        onRoofReportChange={onRoofReportChange}
        roofReportType={roofReportType}
        onRoofReportTypeChange={onRoofReportTypeChange}
        onRoofAreaExtracted={onRoofAreaExtracted}
      />

      {/* Part B: Additional Files */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-primary">Additional Documents</h4>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => filesInputRef.current?.click()}
          className={cn(
            "flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground transition-colors",
            dragOver ? "border-hvhz-teal bg-hvhz-teal/5" : "border-border hover:border-hvhz-teal/30"
          )}
        >
          <Upload className="h-5 w-5" />
          <span>Drop files or click (PDF, JPG, PNG · max 5 files)</span>
        </div>
        <input
          ref={filesInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            {uploadedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border p-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatSize(file.size)}</span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Part C: Order Report */}
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-hvhz-teal/30 transition-colors">
        <Checkbox checked={orderReport} onCheckedChange={(v) => onOrderReportChange(v === true)} className="mt-0.5" />
        <div>
          <p className="text-sm font-medium text-primary">Order Roofr or EagleView Report (+$20)</p>
          <p className="text-xs text-muted-foreground">Don't have a roof measurement report? We can order one for you.</p>
        </div>
      </label>
    </div>
  );
}
