import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileText, CreditCard, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "./orderServices";

const TERMS_SECTIONS = [
  {
    title: "1. Scope of Services",
    text: "HVHZ Engineering LLC provides professional roof testing, engineering calculations, inspection, and related consulting services in Palm Beach, Broward, and Miami-Dade Counties, Florida. All services are performed by qualified field technicians under the direct supervision of a Florida-licensed Professional Engineer (P.E.) in accordance with the Florida Building Code, 8th Edition (2023), including HVHZ protocols, applicable Testing Application Standards (TAS-105, TAS-106, TAS-124, TAS-126), ASCE 7-22, NOAA Atlas 14, and all other governing standards.",
  },
  {
    title: "2. Client Responsibilities",
    text: "The Client shall: provide safe, unobstructed access to all roof areas and testing zones, including gate codes for gated communities; obtain all required building permits prior to testing; for TAS-105 tests, install all screw fasteners prior to the scheduled inspection; provide accurate and complete information including NOAs, roof plans, and measurement reports; and designate a contact person for interior access when required.",
  },
  {
    title: "3. Testing Procedures & Destructive Testing",
    text: "Certain services involve destructive, invasive, or semi-destructive testing procedures including mechanical fastener pull-out testing, roof membrane uplift bonding tests, core cutting, and tile lifting. By authorizing the work order, the Client expressly consents to all such testing. The Company will exercise reasonable care to minimize damage. The Client assumes all risk of cosmetic damage, water intrusion, or aesthetic changes arising from authorized testing.",
  },
  {
    title: "4. AI-Assisted Engineering Calculations",
    text: "The Company utilizes proprietary AI and automated calculation tools to assist in engineering report preparation. All AI-generated calculations are reviewed, verified, and approved by a licensed Florida P.E. before issuance. The licensed P.E. bears full professional responsibility for accuracy and code compliance of all signed and sealed reports.",
  },
  {
    title: "5. Payment Terms & Fees",
    text: "Payment is due in full at the time of order submission via Stripe. Variable pricing applies to certain services based on roof area (per-square-foot rate plus base fee). Multi-service discounts may apply for 2+ services. A $50 distance surcharge applies for sites beyond 25 miles. A $85 mobilization fee applies for roof heights exceeding 24 feet. Same-day dispatch is available for $75, subject to availability.",
  },
  {
    title: "6. Refund & Cancellation",
    text: "Cancellations 24+ hours before testing: full refund less $25 processing fee. Cancellations under 24 hours: up to 50% cancellation fee. No-shows: full fee may be forfeited. Refund requests must be submitted in writing within 30 days.",
  },
  {
    title: "7. Reports & Deliverables",
    text: "Signed and sealed engineering reports are delivered electronically (PDF) within 5 business days. All reports bear the digital signature and professional seal of a licensed Florida P.E. Reports are based on conditions observed at the time of inspection. Reports are retained for a minimum of 5 years.",
  },
  {
    title: "8. Intellectual Property",
    text: "All reports, calculations, AI models, and methodologies remain the exclusive property of HVHZ Engineering LLC. The Client is granted a non-exclusive, non-transferable license to use delivered reports solely for permit applications, recertification, insurance documentation, and related lawful purposes.",
  },
  {
    title: "9. Confidentiality & Data Privacy",
    text: "All test results and project details are treated as confidential. Personal information is collected solely for fulfilling service orders. Payment information is processed securely by Stripe and never stored on Company servers. The Company does not sell or share Client information for marketing purposes.",
  },
  {
    title: "10. Limitation of Liability",
    text: "THE COMPANY'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNT PAID FOR THE SPECIFIC SERVICE. THE COMPANY IS NOT LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, BUSINESS INTERRUPTION, PERMIT DENIALS, OR INSURANCE CLAIM DENIALS.",
  },
  {
    title: "11. Dispute Resolution",
    text: "These Terms are governed by Florida law. Legal actions shall be brought exclusively in Broward or Palm Beach County courts. Pre-litigation written notice and 30-day good-faith negotiation are required. Claims must be brought within 1 year of discovery.",
  },
];

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
          <span className="text-sm font-medium text-primary flex-1 text-left">Terms and Conditions of Service</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", termsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="h-72 rounded-md border border-border mt-2 p-4">
            <div className="space-y-4 pr-4">
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-wider">HVHZ Engineering LLC</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Effective Date: March 22, 2026 · 750 E Sample Rd, Pompano Beach, FL 33064
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                By submitting an order, making payment, or permitting services to proceed, you ("Client") acknowledge that you have read, understand, and agree to be bound by these Terms and Conditions.
              </p>
              {TERMS_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-primary mb-1">{section.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{section.text}</p>
                </div>
              ))}
            </div>
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
            <p className="text-sm font-medium text-primary">I agree to the HVHZ Engineering Terms and Conditions of Service *</p>
            <p className="text-xs text-muted-foreground">
              By checking this box, you acknowledge that you have read and agree to be bound by the terms outlined above, including provisions regarding destructive testing, payment, liability limitations, and dispute resolution.
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
