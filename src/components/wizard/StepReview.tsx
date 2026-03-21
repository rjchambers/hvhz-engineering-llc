import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SERVICES, formatCurrency, getServicePrice, getServiceName } from "@/lib/services";
import type { WizardData } from "@/lib/wizard-data";
import { ChevronLeft, FileText, AlertTriangle } from "lucide-react";

interface StepReviewProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
}

export function StepReview({ data, onChange, onSubmit, onBack, submitting }: StepReviewProps) {
  const subtotal = data.selected_services.reduce((sum, key) => sum + getServicePrice(key), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Review & Pay</h2>
        <p className="text-sm text-muted-foreground mt-1">Please review your order before proceeding to payment.</p>
      </div>

      {/* Company info */}
      <div className="rounded-lg border bg-card p-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Company</p>
        <p className="text-sm font-medium text-primary">{data.company_name}</p>
        <p className="text-sm text-muted-foreground">{data.contact_name} · {data.contact_email}</p>
        {data.contact_phone && <p className="text-sm text-muted-foreground">{data.contact_phone}</p>}
      </div>

      {/* Job site */}
      <div className="rounded-lg border bg-card p-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Job Site</p>
        <p className="text-sm font-medium text-primary">{data.job_address}</p>
        <p className="text-sm text-muted-foreground">
          {data.job_city}{data.job_zip ? `, ${data.job_zip}` : ""}{data.job_county ? ` (${data.job_county})` : ""}
        </p>
        {data.gated_community && <p className="text-xs text-muted-foreground">Gated · Code: {data.gate_code || "N/A"}</p>}
      </div>

      {/* Services */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Services</p>
        <div className="divide-y">
          {data.selected_services.map((key) => (
            <div key={key} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <span className="text-sm text-primary">{getServiceName(key)}</span>
              <span className="text-sm font-medium tabular-nums text-primary">{formatCurrency(getServicePrice(key))}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm font-bold text-primary">Subtotal</span>
          <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(subtotal)}</span>
        </div>
      </div>

      {/* Distance surcharge note */}
      <div className="flex items-start gap-2 rounded-lg bg-hvhz-amber/10 border border-hvhz-amber/30 p-3">
        <AlertTriangle className="h-4 w-4 text-hvhz-amber shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80">
          A <strong>$50 distance surcharge</strong> may apply for job sites outside our standard service area. We'll confirm before charging.
        </p>
      </div>

      {/* Roof report */}
      {data.roof_report_name && (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
          <FileText className="h-5 w-5 text-hvhz-teal" />
          <span className="text-sm text-primary">{data.roof_report_name}</span>
        </div>
      )}

      {/* Terms */}
      <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
        <Checkbox
          id="terms"
          checked={data.terms_accepted}
          onCheckedChange={(checked) => onChange({ terms_accepted: checked === true })}
          className="mt-0.5"
        />
        <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
          I agree to the HVHZ Engineering Terms of Service and authorize payment for the selected services. I understand that final pricing may include applicable distance surcharges.
        </Label>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!data.terms_accepted || submitting}
          className="bg-hvhz-teal text-white hover:bg-hvhz-teal/90"
        >
          {submitting ? "Processing…" : "Proceed to Payment"}
        </Button>
      </div>
    </div>
  );
}
