// Legacy shim — the canonical status model now lives in work-order-status.ts.
// Kept so tech/PE/portal pages importing the old names keep working.
import {
  BOARD_COLUMNS,
  STATUS_META,
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
} from "@/lib/work-order-status";

export {
  TAS_SERVICES,
  IN_HOUSE_SERVICES,
  isOutsourced,
  daysSince,
} from "@/lib/work-order-status";

export const KANBAN_COLUMNS = BOARD_COLUMNS;

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  WORK_ORDER_STATUSES.map((s: WorkOrderStatus) => [s, STATUS_META[s].label])
);

export const STATUS_BADGE_CLASSES: Record<string, string> = Object.fromEntries(
  WORK_ORDER_STATUSES.map((s: WorkOrderStatus) => [s, STATUS_META[s].badgeClass])
);
