export const KANBAN_COLUMNS = [
  "pending_dispatch",
  "dispatched",
  "in_progress",
  "submitted",
  "pe_review",
  "signed",
  "rejected",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  pending_dispatch: "Pending Dispatch",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  submitted: "Submitted",
  pe_review: "PE Review",
  signed: "Signed & Complete",
  complete: "Complete",
  rejected: "Rejected",
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending_payment: "bg-muted text-muted-foreground",
  pending_dispatch: "bg-muted text-muted-foreground",
  dispatched: "bg-blue-50 text-blue-700 border border-blue-200",
  in_progress: "bg-hvhz-teal-light text-hvhz-teal border border-hvhz-teal/20",
  submitted: "bg-hvhz-amber-light text-hvhz-amber border border-hvhz-amber/20",
  pe_review: "bg-purple-50 text-purple-700 border border-purple-200",
  signed: "bg-hvhz-green-light text-hvhz-green border border-hvhz-green/20",
  complete: "bg-hvhz-green-light text-hvhz-green border border-hvhz-green/20",
  rejected: "bg-hvhz-red-light text-hvhz-red border border-hvhz-red/20",
};

export const TAS_SERVICES = ["tas-105", "tas-106", "tas-124", "tas-126"];

export function isOutsourced(serviceType: string) {
  return TAS_SERVICES.includes(serviceType);
}

export function daysSince(dateStr: string) {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}
