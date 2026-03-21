import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SERVICES, formatCurrency, getServicePrice } from "@/lib/services";
import type { WizardData } from "@/lib/wizard-data";
import {
  Crosshair, Layers, TestTube2, Droplets, Search, ShieldCheck,
  CloudRain, HardHat, Wind, ArrowUpFromLine, ChevronLeft,
} from "lucide-react";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "tas-105": Crosshair, "tas-106": Layers, "tas-124": TestTube2, "tas-126": Droplets,
  "roof-inspection": Search, "roof-certification": ShieldCheck, "drainage-analysis": CloudRain,
  "special-inspection": HardHat, "wind-mitigation": Wind, "fastener-calc": ArrowUpFromLine,
};

interface StepJobSiteProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepJobSite({ data, onChange, onNext, onBack }: StepJobSiteProps) {
  const toggleService = (key: string) => {
    const selected = data.selected_services.includes(key)
      ? data.selected_services.filter((s) => s !== key)
      : [...data.selected_services, key];
    onChange({ selected_services: selected });
  };

  const total = data.selected_services.reduce((sum, key) => sum + getServicePrice(key), 0);
  const valid = data.job_address.trim() && data.job_city.trim() && data.job_zip.trim() && data.selected_services.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Job Site & Services</h2>
        <p className="text-sm text-muted-foreground mt-1">Where's the job and what services do you need?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="job_address">Job Address *</Label>
          <Input id="job_address" value={data.job_address} onChange={(e) => onChange({ job_address: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_city">City *</Label>
          <Input id="job_city" value={data.job_city} onChange={(e) => onChange({ job_city: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="job_zip">ZIP *</Label>
            <Input id="job_zip" value={data.job_zip} onChange={(e) => onChange({ job_zip: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job_county">County</Label>
            <Input id="job_county" value={data.job_county} onChange={(e) => onChange({ job_county: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        <Switch
          id="gated"
          checked={data.gated_community}
          onCheckedChange={(checked) => onChange({ gated_community: checked, gate_code: checked ? data.gate_code : "" })}
        />
        <Label htmlFor="gated" className="cursor-pointer">Gated Community</Label>
        {data.gated_community && (
          <Input placeholder="Gate Code" value={data.gate_code} onChange={(e) => onChange({ gate_code: e.target.value })} className="ml-auto w-40" />
        )}
      </div>

      <div>
        <Label className="mb-3 block">Select Services * <span className="text-muted-foreground font-normal">(at least 1)</span></Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICES.map((service) => {
            const selected = data.selected_services.includes(service.key);
            const Icon = SERVICE_ICONS[service.key] ?? Search;
            return (
              <button
                key={service.key}
                type="button"
                onClick={() => toggleService(service.key)}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all active:scale-[0.98] ${
                  selected
                    ? "border-hvhz-teal bg-hvhz-teal/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${selected ? "bg-hvhz-teal/10 text-hvhz-teal" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium leading-snug ${selected ? "text-hvhz-teal" : "text-primary"}`}>{service.name}</p>
                </div>
                <span className={`shrink-0 text-sm font-bold tabular-nums ${selected ? "text-hvhz-teal" : "text-primary"}`}>
                  {formatCurrency(service.price)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {data.selected_services.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-primary">{data.selected_services.length} service{data.selected_services.length !== 1 ? "s" : ""} selected</span>
          <span className="text-lg font-bold tabular-nums text-primary">{formatCurrency(total)}</span>
        </div>
      )}

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="bg-primary text-primary-foreground">
          Continue
        </Button>
      </div>
    </div>
  );
}
