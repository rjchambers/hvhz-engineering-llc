import {
  ORDER_SERVICES, calculateServicePrice, getDiscountPercentage,
  formatCurrency, MOBILIZATION_FEE, SAME_DAY_FEE, REPORT_FEE,
} from "./orderServices";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, AlertTriangle, Tag, Zap } from "lucide-react";

interface PricingSectionProps {
  selectedServices: string[];
  roofArea: number;
  roofHeight: number;
  sameDayDispatch: boolean;
  onSameDayChange: (v: boolean) => void;
  distanceFee: number;
  distanceMiles: number;
  orderReport: boolean;
}

export function PricingSection({
  selectedServices,
  roofArea,
  roofHeight,
  sameDayDispatch,
  onSameDayChange,
  distanceFee,
  distanceMiles,
  orderReport,
}: PricingSectionProps) {
  if (selectedServices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">Select services to see pricing breakdown.</p>
      </div>
    );
  }

  const servicePrices = selectedServices.map((id) => ({
    id,
    service: ORDER_SERVICES.find((s) => s.id === id),
    price: calculateServicePrice(id, roofArea),
  }));

  const subtotal = servicePrices.reduce((sum, s) => sum + s.price, 0);
  const discountPct = getDiscountPercentage(selectedServices.length);
  const discountAmount = subtotal * (discountPct / 100);
  const mobilization = roofHeight > 24 ? MOBILIZATION_FEE : 0;
  const sameDayAmount = sameDayDispatch ? SAME_DAY_FEE : 0;
  const reportFee = orderReport ? REPORT_FEE : 0;
  const total = subtotal - discountAmount + mobilization + sameDayAmount + distanceFee + reportFee;

  return (
    <div className="space-y-3">
      {servicePrices.map(({ id, service, price }) => (
        <div key={id} className="flex items-start gap-3 rounded-lg border border-border p-3">
          <Check className="h-4 w-4 shrink-0 text-hvhz-green mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">{service?.name ?? id}</p>
            {service && service.perSquare > 0 && roofArea > 0 && (
              <p className="text-xs text-muted-foreground">
                Base: {formatCurrency(service.base)} + {formatCurrency(service.perSquare)}/sq × {roofArea} sq
              </p>
            )}
          </div>
          <span className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(price)}</span>
        </div>
      ))}

      {mobilization > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-hvhz-amber/30 bg-hvhz-amber/5 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-hvhz-amber mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-hvhz-amber">Mobilization Fee</p>
            <p className="text-xs text-hvhz-amber/80">Roof height exceeds 24 feet ({roofHeight} ft)</p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-hvhz-amber">{formatCurrency(MOBILIZATION_FEE)}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <span className="text-sm font-medium tabular-nums">{formatCurrency(subtotal)}</span>
      </div>

      {discountPct > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-hvhz-green/30 bg-hvhz-green/5 p-3">
          <Tag className="h-4 w-4 shrink-0 text-hvhz-green mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-hvhz-green">
              {discountPct}% off for {selectedServices.length} services
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-hvhz-green">
            -{formatCurrency(discountAmount)}
          </span>
        </div>
      )}

      <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-hvhz-teal/30 transition-colors">
        <Checkbox checked={sameDayDispatch} onCheckedChange={(v) => onSameDayChange(v === true)} className="mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-hvhz-amber" />
            <p className="text-sm font-medium text-primary">Same-Day Dispatch</p>
          </div>
          <p className="text-xs text-muted-foreground">Priority scheduling for urgent projects</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-primary">+{formatCurrency(SAME_DAY_FEE)}</span>
      </label>

      {distanceFee > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-hvhz-amber/30 bg-hvhz-amber/5 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-hvhz-amber mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-hvhz-amber">Distance Fee</p>
            <p className="text-xs text-hvhz-amber/80">
              Job site is {distanceMiles.toFixed(1)} miles away (25+ mile threshold)
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-hvhz-amber">{formatCurrency(distanceFee)}</span>
        </div>
      )}

      {orderReport && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Report Order Fee</span>
          <span className="font-medium tabular-nums">{formatCurrency(REPORT_FEE)}</span>
        </div>
      )}

      <div className="rounded-xl border-2 border-hvhz-teal bg-hvhz-teal/5 p-4 flex items-center justify-between">
        <span className="text-lg font-bold text-primary">Total</span>
        <span className="text-2xl font-bold tabular-nums text-hvhz-teal">{formatCurrency(total)}</span>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        * Final pricing may vary based on site conditions. Sales tax may apply.
      </p>
    </div>
  );
}
