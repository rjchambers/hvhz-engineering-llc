import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocomplete, ParsedAddress } from "@/components/AddressAutocomplete";

export interface JobInfo {
  projectName: string;
  jobAddress: string;
  jobCity: string;
  jobState: string;
  jobZipCode: string;
  permitNumber: string;
  buildingArea: string;
  roofLevels: string;
  stories: string;
  roofArea: string;
  parapetHeight: string;
  roofHeight: string;
  roofLength: string;
  roofWidth: string;
  roofSlope: string;
  newOrExisting: string;
  newLWIC: string;
  insideAccessName: string;
  insideAccessPhone: string;
  deckType: string;
  deckTypeOther: string;
  componentSecured: string;
  fastenerManufacturer: string;
}

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 10);
  if (numbers.length >= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  if (numbers.length >= 3) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return numbers;
};

const DECK_TYPES = ["Wood", "Concrete", "Steel", "Gypsum", "Lightweight Insulating Concrete", "Other"];

interface JobInfoFormProps {
  data: JobInfo;
  onChange: (data: JobInfo) => void;
  errors: Partial<Record<keyof JobInfo, string>>;
  requireRoofDetails: boolean;
}

export function JobInfoForm({ data, onChange, errors, requireRoofDetails }: JobInfoFormProps) {
  const set = (field: keyof JobInfo, value: string) =>
    onChange({ ...data, [field]: value });

  const handleAddressSelect = (parsed: ParsedAddress) => {
    onChange({
      ...data,
      jobAddress: parsed.address,
      jobCity: parsed.city,
      jobState: parsed.state || "FL",
      jobZipCode: parsed.zip,
    });
  };

  const req = requireRoofDetails ? " *" : "";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label>Project Name</Label>
        <Input value={data.projectName} onChange={(e) => set("projectName", e.target.value)} />
      </div>

      <div className="md:col-span-2">
        <Label>Job Address *</Label>
        <AddressAutocomplete
          value={data.jobAddress}
          onChange={(v) => set("jobAddress", v)}
          onSelect={handleAddressSelect}
          placeholder="Job site address…"
        />
        {errors.jobAddress && <p className="text-xs text-destructive mt-1">{errors.jobAddress}</p>}
      </div>

      <div>
        <Label>City *</Label>
        <Input value={data.jobCity} onChange={(e) => set("jobCity", e.target.value)} />
        {errors.jobCity && <p className="text-xs text-destructive mt-1">{errors.jobCity}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>State</Label>
          <Input value={data.jobState} maxLength={2} onChange={(e) => set("jobState", e.target.value.toUpperCase())} />
        </div>
        <div>
          <Label>Zip Code *</Label>
          <Input value={data.jobZipCode} maxLength={5} onChange={(e) => set("jobZipCode", e.target.value.replace(/\D/g, "").slice(0, 5))} />
          {errors.jobZipCode && <p className="text-xs text-destructive mt-1">{errors.jobZipCode}</p>}
        </div>
      </div>

      <div>
        <Label>Building Permit #</Label>
        <Input value={data.permitNumber} onChange={(e) => set("permitNumber", e.target.value)} />
      </div>
      <div>
        <Label>Building Area Description</Label>
        <Input value={data.buildingArea} onChange={(e) => set("buildingArea", e.target.value)} placeholder="Main Roof" />
      </div>

      <div>
        <Label>Roof Levels{req}</Label>
        <Input type="number" min={1} value={data.roofLevels} onChange={(e) => set("roofLevels", e.target.value)} />
        {errors.roofLevels && <p className="text-xs text-destructive mt-1">{errors.roofLevels}</p>}
      </div>
      <div>
        <Label>Stories{req}</Label>
        <Input type="number" min={1} value={data.stories} onChange={(e) => set("stories", e.target.value)} />
        {errors.stories && <p className="text-xs text-destructive mt-1">{errors.stories}</p>}
      </div>

      <div>
        <Label>Roof Area (squares){req}</Label>
        <Input type="number" value={data.roofArea} onChange={(e) => set("roofArea", e.target.value)} />
        {errors.roofArea && <p className="text-xs text-destructive mt-1">{errors.roofArea}</p>}
      </div>
      <div>
        <Label>Parapet Height (inches)</Label>
        <Input type="number" value={data.parapetHeight} onChange={(e) => set("parapetHeight", e.target.value)} />
      </div>

      <div>
        <Label>Roof Height (feet){req}</Label>
        <Input type="number" value={data.roofHeight} onChange={(e) => set("roofHeight", e.target.value)} />
        {errors.roofHeight && <p className="text-xs text-destructive mt-1">{errors.roofHeight}</p>}
      </div>
      <div>
        <Label>Roof Length (feet)</Label>
        <Input type="number" value={data.roofLength} onChange={(e) => set("roofLength", e.target.value)} />
      </div>

      <div>
        <Label>Roof Width (feet)</Label>
        <Input type="number" value={data.roofWidth} onChange={(e) => set("roofWidth", e.target.value)} />
      </div>
      <div>
        <Label>Roof Slope</Label>
        <Input value={data.roofSlope} onChange={(e) => set("roofSlope", e.target.value)} placeholder="1/4:12" />
      </div>

      <div className="space-y-2">
        <Label>New or Existing Installation?</Label>
        <RadioGroup value={data.newOrExisting} onValueChange={(v) => set("newOrExisting", v)} className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="new" id="inst-new" />
            <Label htmlFor="inst-new" className="font-normal">New</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="existing" id="inst-existing" />
            <Label htmlFor="inst-existing" className="font-normal">Existing</Label>
          </div>
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label>New LWIC?</Label>
        <RadioGroup value={data.newLWIC} onValueChange={(v) => set("newLWIC", v)} className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="lwic-yes" />
            <Label htmlFor="lwic-yes" className="font-normal">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="lwic-no" />
            <Label htmlFor="lwic-no" className="font-normal">No</Label>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label>Inside Access Provided By</Label>
        <Input value={data.insideAccessName} onChange={(e) => set("insideAccessName", e.target.value)} />
      </div>
      <div>
        <Label>Inside Access Phone</Label>
        <Input value={data.insideAccessPhone} onChange={(e) => set("insideAccessPhone", formatPhone(e.target.value))} />
      </div>

      <div>
        <Label>Type of Roof Deck{req}</Label>
        <Select value={data.deckType} onValueChange={(v) => set("deckType", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select deck type" />
          </SelectTrigger>
          <SelectContent>
            {DECK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.deckType && <p className="text-xs text-destructive mt-1">{errors.deckType}</p>}
      </div>

      {data.deckType === "Other" && (
        <div>
          <Label>Specify Deck Type *</Label>
          <Input value={data.deckTypeOther} onChange={(e) => set("deckTypeOther", e.target.value)} />
          {errors.deckTypeOther && <p className="text-xs text-destructive mt-1">{errors.deckTypeOther}</p>}
        </div>
      )}

      <div>
        <Label>Component to be Secured</Label>
        <Input value={data.componentSecured} onChange={(e) => set("componentSecured", e.target.value)} />
      </div>
      <div>
        <Label>Fastener Manufacturer</Label>
        <Input value={data.fastenerManufacturer} onChange={(e) => set("fastenerManufacturer", e.target.value)} />
      </div>
    </div>
  );
}
