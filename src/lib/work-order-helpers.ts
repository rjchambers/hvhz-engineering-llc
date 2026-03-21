export const KANBAN_COLUMNS = [
  "pending_dispatch",
  "dispatched",
  "in_progress",
  "submitted",
  "pe_review",
  "complete",
  "rejected",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  pending_dispatch: "Pending Dispatch",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  submitted: "Submitted",
  pe_review: "PE Review",
  complete: "Complete",
  rejected: "Rejected",
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending_dispatch: "bg-gray-100 text-gray-700",
  pending_payment: "bg-gray-100 text-gray-700",
  dispatched: "bg-blue-100 text-blue-700",
  in_progress: "bg-teal-100 text-teal-700",
  submitted: "bg-teal-100 text-teal-700",
  pe_review: "bg-amber-100 text-amber-700",
  complete: "bg-green-100 text-green-700",
  signed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
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
