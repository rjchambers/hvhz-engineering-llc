import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressAutocomplete, ParsedAddress } from "@/components/AddressAutocomplete";
import { Link } from "react-router-dom";

export interface ClientInfo {
  companyName: string;
  companyAddress: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  fax: string;
  email: string;
  contactName: string;
  contactTitle: string;
  jobsiteContactName: string;
  jobsiteContactPhone: string;
  poNumber: string;
  gatedCommunity: string;
  gateCode: string;
  emailProposalTo: string;
}

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 10);
  if (numbers.length >= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  if (numbers.length >= 3) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return numbers;
};

interface ClientInfoFormProps {
  data: ClientInfo;
  onChange: (data: ClientInfo) => void;
  errors: Partial<Record<keyof ClientInfo, string>>;
  isLoggedIn: boolean;
}

export function ClientInfoForm({ data, onChange, errors, isLoggedIn }: ClientInfoFormProps) {
  const set = (field: keyof ClientInfo, value: string) =>
    onChange({ ...data, [field]: value });

  const handleAddressSelect = (parsed: ParsedAddress) => {
    onChange({
      ...data,
      companyAddress: parsed.address,
      city: parsed.city,
      state: parsed.state || "FL",
      zipCode: parsed.zip,
    });
  };

  return (
    <div className="space-y-4">
      {!isLoggedIn && (
        <p className="text-xs text-muted-foreground">
          Have an account?{" "}
          <Link to="/auth" className="text-hvhz-teal hover:underline">
            Sign in to pre-fill your info
          </Link>
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label>Company Name *</Label>
          <Input value={data.companyName} onChange={(e) => set("companyName", e.target.value)} />
          {errors.companyName && <p className="text-xs text-destructive mt-1">{errors.companyName}</p>}
        </div>

        <div className="md:col-span-2">
          <Label>Company Address *</Label>
          <AddressAutocomplete
            value={data.companyAddress}
            onChange={(v) => set("companyAddress", v)}
            onSelect={handleAddressSelect}
            placeholder="Start typing an address…"
          />
          {errors.companyAddress && <p className="text-xs text-destructive mt-1">{errors.companyAddress}</p>}
        </div>

        <div>
          <Label>City *</Label>
          <Input value={data.city} onChange={(e) => set("city", e.target.value)} />
          {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>State</Label>
            <Input value={data.state} maxLength={2} onChange={(e) => set("state", e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label>Zip Code *</Label>
            <Input value={data.zipCode} maxLength={5} onChange={(e) => set("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))} />
            {errors.zipCode && <p className="text-xs text-destructive mt-1">{errors.zipCode}</p>}
          </div>
        </div>

        <div>
          <Label>Phone *</Label>
          <Input value={data.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} />
          {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
        </div>
        <div>
          <Label>Fax</Label>
          <Input value={data.fax} onChange={(e) => set("fax", formatPhone(e.target.value))} />
        </div>

        <div>
          <Label>Email *</Label>
          <Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>
        <div>
          <Label>Email Proposal To</Label>
          <Input type="email" value={data.emailProposalTo} onChange={(e) => set("emailProposalTo", e.target.value)} />
        </div>

        <div>
          <Label>Primary Contact Name *</Label>
          <Input value={data.contactName} onChange={(e) => set("contactName", e.target.value)} />
          {errors.contactName && <p className="text-xs text-destructive mt-1">{errors.contactName}</p>}
        </div>
        <div>
          <Label>Contact Title</Label>
          <Input value={data.contactTitle} onChange={(e) => set("contactTitle", e.target.value)} />
        </div>

        <div>
          <Label>Jobsite Contact Name *</Label>
          <Input value={data.jobsiteContactName} onChange={(e) => set("jobsiteContactName", e.target.value)} />
          {errors.jobsiteContactName && <p className="text-xs text-destructive mt-1">{errors.jobsiteContactName}</p>}
        </div>
        <div>
          <Label>Jobsite Contact Phone *</Label>
          <Input value={data.jobsiteContactPhone} onChange={(e) => set("jobsiteContactPhone", formatPhone(e.target.value))} />
          {errors.jobsiteContactPhone && <p className="text-xs text-destructive mt-1">{errors.jobsiteContactPhone}</p>}
        </div>

        <div>
          <Label>P.O. Number</Label>
          <Input value={data.poNumber} onChange={(e) => set("poNumber", e.target.value)} />
        </div>

        <div className="md:col-span-2 space-y-2">
          <Label>Gated Community? *</Label>
          <RadioGroup value={data.gatedCommunity} onValueChange={(v) => set("gatedCommunity", v)} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="yes" id="gated-yes" />
              <Label htmlFor="gated-yes" className="font-normal">Yes</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="no" id="gated-no" />
              <Label htmlFor="gated-no" className="font-normal">No</Label>
            </div>
          </RadioGroup>
        </div>

        {data.gatedCommunity === "yes" && (
          <div className="md:col-span-2">
            <Label>Gate Code *</Label>
            <Input value={data.gateCode} onChange={(e) => set("gateCode", e.target.value)} />
            {errors.gateCode && <p className="text-xs text-destructive mt-1">{errors.gateCode}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
