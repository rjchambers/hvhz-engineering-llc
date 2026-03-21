import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
          <Label htmlFor="company_address">Company Address</Label>
          <Input id="company_address" value={data.company_address} onChange={(e) => onChange({ company_address: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_city">City</Label>
          <Input id="company_city" value={data.company_city} onChange={(e) => onChange({ company_city: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company_state">State</Label>
            <Input id="company_state" value={data.company_state} onChange={(e) => onChange({ company_state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_zip">ZIP</Label>
            <Input id="company_zip" value={data.company_zip} onChange={(e) => onChange({ company_zip: e.target.value })} />
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
