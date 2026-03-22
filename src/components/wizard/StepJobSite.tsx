import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SERVICES, formatCurrency, getServicePrice } from "@/lib/services";
import { SERVICE_BUNDLES, getRecommendedServices } from "@/lib/service-bundles";
import type { WizardData } from "@/lib/wizard-data";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  Crosshair, Layers, Droplets, Search, MessageSquarePlus,
  CloudRain, HardHat, Wind, ArrowUpFromLine, ChevronLeft, Plus,
} from "lucide-react";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "tas-105": Crosshair, "tas-106": Layers, "tas-126": Droplets,
  "drainage-analysis": CloudRain,
  "special-inspection": HardHat, "wind-mitigation-permit": Wind, "wind-mitigation": Wind,
  "fastener-calc": ArrowUpFromLine, "fastener-calculation": ArrowUpFromLine,
  "other": MessageSquarePlus,
};

interface StepJobSiteProps {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
  showEditCompanyLink?: boolean;
}

export function StepJobSite({ data, onChange, onNext, onBack, showEditCompanyLink }: StepJobSiteProps) {
  const toggleService = (key: string) => {
    const selected = data.selected_services.includes(key)
      ? data.selected_services.filter((s) => s !== key)
      : [...data.selected_services, key];
    onChange({ selected_services: selected });
  };

  const total = data.selected_services.reduce((sum, key) => sum + getServicePrice(key), 0);
  const valid = data.job_address.trim() && data.job_city.trim() && data.job_zip.trim() && data.selected_services.length > 0;
  const recommendations = getRecommendedServices(data.selected_services);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">Job Site & Services</h2>
          <p className="text-sm text-muted-foreground mt-1">Where's the job and what services do you need?</p>
        </div>
        {showEditCompanyLink && (
          <button onClick={onBack} className="text-xs text-hvhz-teal hover:underline">
            Edit company info →
          </button>
        )}
      </div>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label>Job Site Address *</Label>
          <AddressAutocomplete
            value={data.job_address}
            onChange={(val) => onChange({ job_address: val })}
            onSelect={(parsed) => {
              onChange({
                job_address: parsed.address,
                job_city: parsed.city,
                job_zip: parsed.zip,
                job_county: parsed.county,
              });
            }}
            placeholder="Start typing the job site address…"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">City *</Label>
          <Input value={data.job_city} onChange={(e) => onChange({ job_city: e.target.value })} className="h-9 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">ZIP *</Label>
            <Input value={data.job_zip} onChange={(e) => onChange({ job_zip: e.target.value })} className="h-9 text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">County</Label>
            <Input value={data.job_county} onChange={(e) => onChange({ job_county: e.target.value })} className="h-9 text-sm" />
          </div>
        </div>
      </div>

      {/* Gated community */}
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

      {/* Popular Packages */}
      <div className="space-y-3">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Popular Packages</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICE_BUNDLES.map((bundle) => {
            const allSelected = bundle.services.every((s) => data.selected_services.includes(s));
            return (
              <button
                key={bundle.id}
                type="button"
                onClick={() => {
                  const newServices = allSelected
                    ? data.selected_services.filter((s) => !bundle.services.includes(s))
                    : [...new Set([...data.selected_services, ...bundle.services])];
                  onChange({ selected_services: newServices });
                }}
                className={`rounded-xl border-2 p-4 text-left transition-all active:scale-[0.98] ${
                  allSelected
                    ? "border-hvhz-teal bg-hvhz-teal/5"
                    : "border-border hover:border-hvhz-teal/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-primary">{bundle.name}</span>
                  {bundle.popular && (
                    <Badge className="bg-hvhz-teal text-white text-[9px] shrink-0">Popular</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{bundle.description}</p>
                <p className="text-xs font-mono text-primary mt-2">
                  {bundle.services.length} services · {formatCurrency(bundle.services.reduce((s, k) => s + getServicePrice(k), 0))}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Individual Services */}
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

      {/* Smart Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-lg border border-hvhz-teal/20 bg-hvhz-teal/5 p-4">
          <p className="text-xs font-semibold text-hvhz-teal mb-2">Recommended Additions</p>
          {recommendations.map((key) => {
            const svc = SERVICES.find((s) => s.key === key);
            if (!svc) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ selected_services: [...data.selected_services, key] })}
                className="flex items-center justify-between w-full rounded-md border border-hvhz-teal/20 px-3 py-2 text-left hover:bg-hvhz-teal/10 transition-colors mb-2 last:mb-0"
              >
                <span className="text-sm text-primary">{svc.name}</span>
                <span className="flex items-center gap-1 text-xs font-mono text-hvhz-teal">
                  <Plus className="h-3 w-3" /> {formatCurrency(svc.price)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Total */}
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
