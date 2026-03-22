export const SERVICES = [
  { key: "tas-105", name: "TAS-105 Fastener Withdrawal Test", price: 450 },
  { key: "tas-106", name: "TAS-106 Tile Bonding Verification", price: 450 },
  { key: "tas-126", name: "TAS-126 Moisture Survey", price: 450 },
  { key: "drainage-analysis", name: "Drainage Analysis", price: 550 },
  { key: "special-inspection", name: "Special Inspection", price: 400 },
  { key: "wind-mitigation-permit", name: "Wind Mitigation (Roofing Permit)", price: 500 },
  { key: "fastener-calculation", name: "Fastener Uplift Calculation", price: 350 },
] as const;

export type ServiceKey = (typeof SERVICES)[number]["key"];

export function getServicePrice(key: string): number {
  return SERVICES.find((s) => s.key === key)?.price ?? 0;
}

export function getServiceName(key: string): string {
  return SERVICES.find((s) => s.key === key)?.name ?? key;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
