export const ORDER_SERVICES = [
  { id: "tas-105", name: "TAS-105 Fastener Withdrawal Test", icon: "Crosshair", base: 450, perSquare: 2.5 },
  { id: "tas-106", name: "TAS-106 Tile Bonding Verification", icon: "Layers", base: 200, perSquare: 0 },
  { id: "tas-126", name: "TAS-126 Moisture Survey", icon: "Droplets", base: 450, perSquare: 2.5 },
  { id: "drainage", name: "Roof Drainage Calculations", icon: "CloudRain", base: 400, perSquare: 0 },
  { id: "enhanced-fastener", name: "Enhanced Fastener Pattern", icon: "ArrowUpFromLine", base: 250, perSquare: 0 },
  { id: "special-inspection", name: "Special Inspections", icon: "HardHat", base: 250, perSquare: 0 },
  { id: "wind-mitigation", name: "Wind Mitigation (Roofing Permit)", icon: "Wind", base: 500, perSquare: 0 },
  { id: "asbestos-survey", name: "Asbestos Survey", icon: "TestTube2", base: 425, perSquare: 2.5 },
  { id: "other", name: "Other / Custom Request", icon: "MessageSquarePlus", base: 0, perSquare: 0 },
] as const;

export type OrderServiceId = (typeof ORDER_SERVICES)[number]["id"];

export const VARIABLE_RATE_SERVICES: OrderServiceId[] = ["tas-105", "tas-126", "asbestos-survey"];

export const SPECIAL_INSPECTION_TYPES = [
  "In Progress",
  "Missed Inspection",
  "Peel & Stick",
  "Hot Mop",
  "Tin Cap",
  "Truss Monitoring",
  "Shingle",
  "LWIC Spec. Inspector",
  "Sheathing",
  "Other",
] as const;

export const MOBILIZATION_FEE = 85;
export const SAME_DAY_FEE = 75;
export const REPORT_FEE = 20;
export const DISTANCE_FEE = 50;
export const DISTANCE_THRESHOLD_MILES = 25;

export function calculateServicePrice(serviceId: string, roofArea: number): number {
  const service = ORDER_SERVICES.find((s) => s.id === serviceId);
  if (!service) return 0;
  const areaPrice = service.perSquare > 0 ? service.perSquare * roofArea : 0;
  return service.base + areaPrice;
}

export function getDiscountPercentage(serviceCount: number): number {
  if (serviceCount >= 4) return 15;
  if (serviceCount === 3) return 10;
  if (serviceCount === 2) return 5;
  return 0;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
