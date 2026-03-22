import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileText, CreditCard, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "./orderServices";

const TERMS_TEXT = `DISCLAIMER AND TERMS OF SERVICE – 2048 MANAGEMENT LLC

2048 MANAGEMENT LLC ("Company," "we," "us," or "our") provides roof testing, inspection, and related services in Broward and Palm Beach Counties, Florida.

1. Scope of Services — Services are performed by qualified technicians under PE supervision. All reports are signed and sealed by a licensed Florida Professional Engineer.

2. Client Responsibilities — Client shall provide safe access to the roof and work area, obtain all necessary permits prior to testing, and install fasteners for TAS-105 testing prior to our arrival.

3. Testing Procedures — Certain services involve destructive testing procedures. Client authorizes all testing outlined in the service order. Damaged areas resulting from testing are not the responsibility of the Company.

4. Payment Terms — Payment is due in full prior to dispatch of technician. Orders are not scheduled until payment is confirmed.

5. Reports — Engineering reports will be provided within 5 business days of field inspection completion. Rush delivery is available for an additional fee.

6. Cancellation — Cancellations less than 24 hours before scheduled inspection may incur a cancellation fee of up to 50% of the service cost.

7. Confidentiality — All test results and reports are kept confidential and shared only with the client and relevant permitting authorities as directed by the client.

8. Limitation of Liability — Total liability shall not exceed the amount paid for the specific service. Company is not liable for consequential, incidental, or indirect damages.

9. General Provisions — These terms are governed by the laws of the State of Florida. Any disputes shall be resolved in courts located in Broward County, Florida.`;

interface TermsAndPaymentProps {
  termsAccepted: boolean;
  onTermsChange: (v: boolean) => void;
  previouslyAccepted: boolean;
  total: number;
  onSubmit: () => void;
  submitting: boolean;
  errors: { terms?: string };
}

export function TermsAndPayment({
  termsAccepted,
  onTermsChange,
  previouslyAccepted,
  total,
  onSubmit,
  submitting,
  errors,
}: TermsAndPaymentProps) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-primary flex-1 text-left">Terms and Conditions</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", termsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="h-64 rounded-md border border-border mt-2 p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {TERMS_TEXT}
            </pre>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {previouslyAccepted ? (
        <div className="flex items-center gap-2 rounded-lg border border-hvhz-green/30 bg-hvhz-green/5 p-3">
          <Check className="h-4 w-4 text-hvhz-green" />
          <p className="text-sm font-medium text-hvhz-green">
            Terms & Conditions Accepted — You previously agreed to our terms of service.
          </p>
        </div>
      ) : (
        <label className={cn(
          "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
          errors.terms ? "border-destructive/50" : "border-border hover:border-hvhz-teal/30"
        )}>
          <Checkbox checked={termsAccepted} onCheckedChange={(v) => onTermsChange(v === true)} className="mt-0.5" />
          <div>
            <p className="text-sm font-medium text-primary">I agree to the Terms and Conditions *</p>
            <p className="text-xs text-muted-foreground">
              By checking this box, you acknowledge that you have read and agree to abide by the terms and conditions outlined above.
            </p>
          </div>
        </label>
      )}
      {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}

      <Button
        size="lg"
        className="w-full bg-hvhz-teal text-white hover:bg-hvhz-teal/90 active:scale-[0.97] transition-all text-base"
        onClick={onSubmit}
        disabled={submitting}
      >
        <CreditCard className="mr-2 h-5 w-5" />
        {submitting ? "Processing…" : `Submit Order & Pay ${formatCurrency(total)}`}
      </Button>
    </div>
  );
}
