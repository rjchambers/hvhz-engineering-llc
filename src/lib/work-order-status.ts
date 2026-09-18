// Canonical work-order status model: the single source of truth for the
// status vocabulary, presentation (labels/badges), board layout, the ordered
// happy path, and which transitions the normal workflow allows.
//
// Statuses are plain TEXT in Postgres with no CHECK constraint, so this
// module is the only guard rail — every admin surface must go through it.

export const WORK_ORDER_STATUSES = [
  "pending_payment",
  "pending_dispatch",
  "dispatched",
  "in_progress",
  "submitted",
  "pe_review",
  "signed",
  "complete",
  "rejected",
  "archived",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

interface StatusMeta {
  label: string;
  /** Tailwind classes for the status badge. */
  badgeClass: string;
  /** Short admin-facing description of what the stage means. */
  description: string;
}

export const STATUS_META: Record<WorkOrderStatus, StatusMeta> = {
  pending_payment: {
    label: "Pending Payment",
    badgeClass: "bg-muted text-muted-foreground",
    description: "Order created but Stripe payment not confirmed yet.",
  },
  pending_dispatch: {
    label: "Pending Dispatch",
    badgeClass: "bg-muted text-muted-foreground",
    description: "Paid and waiting for a technician, engineer, or lab partner.",
  },
  dispatched: {
    label: "Dispatched",
    badgeClass: "bg-blue-50 text-blue-700 border border-blue-200",
    description: "Assigned to a technician or emailed to a lab partner.",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-hvhz-teal-light text-hvhz-teal border border-hvhz-teal/20",
    description: "Field work or lab testing underway.",
  },
  submitted: {
    label: "Submitted",
    badgeClass: "bg-hvhz-amber-light text-hvhz-amber border border-hvhz-amber/20",
    description: "Field data or lab results submitted, awaiting PE review.",
  },
  pe_review: {
    label: "PE Review",
    badgeClass: "bg-purple-50 text-purple-700 border border-purple-200",
    description: "A professional engineer is reviewing the submission.",
  },
  signed: {
    label: "Signed & Complete",
    badgeClass: "bg-hvhz-green-light text-hvhz-green border border-hvhz-green/20",
    description: "Report sealed and delivered to the client.",
  },
  complete: {
    label: "Complete",
    badgeClass: "bg-hvhz-green-light text-hvhz-green border border-hvhz-green/20",
    description: "Closed by an admin outside the signing flow.",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-hvhz-red-light text-hvhz-red border border-hvhz-red/20",
    description: "Sent back for revision by the PE.",
  },
  archived: {
    label: "Archived",
    badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
    description: "Removed from the active pipeline.",
  },
};

export function statusLabel(status: string): string {
  return STATUS_META[status as WorkOrderStatus]?.label ?? status;
}

export function statusBadgeClass(status: string): string {
  return (
    STATUS_META[status as WorkOrderStatus]?.badgeClass ??
    "bg-gray-100 text-gray-700"
  );
}

/** Columns shown on the pipeline board, in flow order. */
export const BOARD_COLUMNS: WorkOrderStatus[] = [
  "pending_dispatch",
  "dispatched",
  "in_progress",
  "submitted",
  "pe_review",
  "signed",
  "rejected",
];

/**
 * The ordered happy path, used by the stage timeline on the detail page.
 * `rejected`, `complete`, and `archived` sit outside the linear flow.
 */
export const PIPELINE_STEPS: WorkOrderStatus[] = [
  "pending_dispatch",
  "dispatched",
  "in_progress",
  "submitted",
  "pe_review",
  "signed",
];

/**
 * Transitions the normal workflow performs. Anything not listed here is an
 * admin override: still possible, but the UI must ask for confirmation
 * instead of silently skipping pipeline stages.
 */
const LEGAL_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  pending_payment: ["pending_dispatch", "archived"],
  pending_dispatch: ["dispatched", "archived"],
  // "submitted" directly from dispatched covers outsourced lab results
  // uploaded by an admin without a tech in-progress step.
  dispatched: ["in_progress", "submitted", "pending_dispatch", "archived"],
  in_progress: ["submitted", "dispatched", "archived"],
  submitted: ["pe_review", "rejected", "in_progress"],
  pe_review: ["signed", "rejected", "submitted"],
  signed: ["complete", "archived"],
  complete: ["archived", "pending_dispatch"],
  rejected: ["pending_dispatch", "dispatched", "archived"],
  archived: ["pending_dispatch"],
};

export function isLegalTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (
    LEGAL_TRANSITIONS[from as WorkOrderStatus]?.includes(
      to as WorkOrderStatus
    ) ?? false
  );
}

// ---------------------------------------------------------------------------
// Service categorization (unchanged semantics, moved here so all pipeline
// logic lives in one module).

/** Services that are physically TAS lab tests — used for TAS-specific UI. */
export const TAS_SERVICES = ["tas-105", "tas-106", "tas-124", "tas-126"];

/**
 * Services handled in-house by our tech/PE flow. Every other service is
 * dispatched to a third-party partner lab.
 */
export const IN_HOUSE_SERVICES = ["other"];

export function isOutsourced(serviceType: string) {
  return !IN_HOUSE_SERVICES.includes(serviceType);
}

export function daysSince(dateStr: string) {
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}
