import { ORDER_SERVICES, calculateServicePrice, formatCurrency as _formatCurrency } from "@/components/order/orderServices";

// Re-export ORDER_SERVICES as the single source of truth
// The "key" alias keeps existing consumers working
export const SERVICES = ORDER_SERVICES.map((s) => ({
  key: s.id,
  name: s.name,
  price: s.base, // base price (before area-based add-ons)
}));

export type ServiceKey = (typeof ORDER_SERVICES)[number]["id"];

export function getServicePrice(key: string): number {
  const svc = ORDER_SERVICES.find((s) => s.id === key);
  return svc?.base ?? 0;
}

export function getServiceName(key: string): string {
  return ORDER_SERVICES.find((s) => s.id === key)?.name ?? key;
}

export { calculateServicePrice, _formatCurrency as formatCurrency };
