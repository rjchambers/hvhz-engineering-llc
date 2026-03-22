import { ORDER_SERVICES, getDiscountPercentage, SPECIAL_INSPECTION_TYPES } from "./orderServices";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Crosshair, Layers, TestTube2, Droplets, CloudRain, ArrowUpFromLine,
  HardHat, Search, ShieldCheck, Wind, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ElementType> = {
  Crosshair, Layers, TestTube2, Droplets, CloudRain, ArrowUpFromLine,
  HardHat, Search, ShieldCheck, Wind,
};

interface ServiceSelectionProps {
  selectedServices: string[];
  onToggleService: (id: string) => void;
  specialInspectionTypes: string[];
  onToggleInspectionType: (type: string) => void;
}

export function ServiceSelection({
  selectedServices,
  onToggleService,
  specialInspectionTypes,
  onToggleInspectionType,
}: ServiceSelectionProps) {
  const count = selectedServices.length;
  const discount = getDiscountPercentage(count);

  return (
    <div className="space-y-4">
      {count >= 2 && (
        <div className="flex items-center gap-2 rounded-lg border border-hvhz-green/30 bg-hvhz-green/5 p-3">
          <Tag className="h-4 w-4 text-hvhz-green" />
          <span className="text-sm font-medium text-hvhz-green">
            {discount}% Multi-Service Discount Applied!
          </span>
          {count === 2 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              Add 1 more for 10% off
            </Badge>
          )}
          {count === 3 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              Add 1 more for 15% off
            </Badge>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {ORDER_SERVICES.map((service) => {
          const Icon = ICON_MAP[service.icon] || Search;
          const checked = selectedServices.includes(service.id);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onToggleService(service.id)}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150 active:scale-[0.98]",
                checked
                  ? "border-hvhz-teal/50 bg-hvhz-teal/5"
                  : "border-border hover:border-hvhz-teal/30"
              )}
            >
              <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-hvhz-teal/10 text-hvhz-teal">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary leading-snug">{service.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Starting at ${service.base}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedServices.includes("special-inspection") && (
        <div className="ml-4 border-l-2 border-hvhz-teal/30 pl-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Inspection Types
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SPECIAL_INSPECTION_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={specialInspectionTypes.includes(type)}
                  onCheckedChange={() => onToggleInspectionType(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
