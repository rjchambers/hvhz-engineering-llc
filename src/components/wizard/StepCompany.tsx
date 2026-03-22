import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import type { WizardData } from "@/lib/wizard-data";

interface StepCompanyProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  saving: boolean;
}

export function StepCompany({ data, onChange, onNext, saving }: StepCompanyProps) {
  const valid = data.company_name.trim() && data.contact_name.trim() && data.contact_email.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Company & Contact Information</h2>
        <p className="text-sm text-muted-foreground mt-1">Tell us about your company so we can set up your account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company_name">Company Name *</Label>
          <Input id="company_name" value={data.company_name} onChange={(e) => onChange({ company_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_name">Contact Name *</Label>
          <Input id="contact_name" value={data.contact_name} onChange={(e) => onChange({ contact_name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_email">Contact Email</Label>
          <Input id="contact_email" type="email" value={data.contact_email} readOnly className="bg-muted cursor-not-allowed" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Contact Phone</Label>
          <Input id="contact_phone" type="tel" value={data.contact_phone} onChange={(e) => onChange({ contact_phone: e.target.value })} placeholder="(555) 123-4567" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Company Address</Label>
          <AddressAutocomplete
            value={data.company_address}
            onChange={(val) => onChange({ company_address: val })}
            onSelect={(parsed) => {
              onChange({
                company_address: parsed.address,
                company_city: parsed.city,
                company_state: parsed.state,
                company_zip: parsed.zip,
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">City</Label>
          <Input value={data.company_city} onChange={(e) => onChange({ company_city: e.target.value })} className="h-9 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">State</Label>
            <Input value={data.company_state} onChange={(e) => onChange({ company_state: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">ZIP</Label>
            <Input value={data.company_zip} onChange={(e) => onChange({ company_zip: e.target.value })} className="h-9 text-sm" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onNext} disabled={!valid || saving} className="bg-primary text-primary-foreground">
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
