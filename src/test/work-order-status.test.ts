import { describe, expect, it } from "vitest";
import {
  BOARD_COLUMNS,
  PIPELINE_STEPS,
  STATUS_META,
  WORK_ORDER_STATUSES,
  isLegalTransition,
  statusBadgeClass,
  statusLabel,
} from "@/lib/work-order-status";

describe("work-order status model", () => {
  it("has metadata for every status", () => {
    for (const s of WORK_ORDER_STATUSES) {
      expect(STATUS_META[s].label).toBeTruthy();
      expect(STATUS_META[s].badgeClass).toBeTruthy();
    }
  });

  it("board columns and pipeline steps are known statuses", () => {
    for (const s of [...BOARD_COLUMNS, ...PIPELINE_STEPS]) {
      expect(WORK_ORDER_STATUSES).toContain(s);
    }
  });

  it("falls back gracefully for unknown statuses", () => {
    expect(statusLabel("weird_status")).toBe("weird_status");
    expect(statusBadgeClass("weird_status")).toContain("bg-");
  });
});

describe("isLegalTransition", () => {
  it("allows the happy path", () => {
    expect(isLegalTransition("pending_payment", "pending_dispatch")).toBe(true);
    expect(isLegalTransition("pending_dispatch", "dispatched")).toBe(true);
    expect(isLegalTransition("dispatched", "in_progress")).toBe(true);
    expect(isLegalTransition("in_progress", "submitted")).toBe(true);
    expect(isLegalTransition("submitted", "pe_review")).toBe(true);
    expect(isLegalTransition("pe_review", "signed")).toBe(true);
    expect(isLegalTransition("signed", "complete")).toBe(true);
  });

  it("allows outsourced results to skip the tech step", () => {
    expect(isLegalTransition("dispatched", "submitted")).toBe(true);
  });

  it("allows rejection and re-dispatch", () => {
    expect(isLegalTransition("submitted", "rejected")).toBe(true);
    expect(isLegalTransition("pe_review", "rejected")).toBe(true);
    expect(isLegalTransition("rejected", "pending_dispatch")).toBe(true);
  });

  it("allows reopening archived/complete work", () => {
    expect(isLegalTransition("archived", "pending_dispatch")).toBe(true);
    expect(isLegalTransition("complete", "pending_dispatch")).toBe(true);
  });

  it("treats no-op moves as legal", () => {
    for (const s of WORK_ORDER_STATUSES) {
      expect(isLegalTransition(s, s)).toBe(true);
    }
  });

  it("flags stage-skipping moves as overrides", () => {
    expect(isLegalTransition("pending_dispatch", "signed")).toBe(false);
    expect(isLegalTransition("pending_dispatch", "pe_review")).toBe(false);
    expect(isLegalTransition("dispatched", "signed")).toBe(false);
    expect(isLegalTransition("signed", "pending_dispatch")).toBe(false);
    expect(isLegalTransition("in_progress", "pe_review")).toBe(false);
  });

  it("is safe for unknown statuses", () => {
    expect(isLegalTransition("mystery", "signed")).toBe(false);
    expect(isLegalTransition("mystery", "mystery")).toBe(true);
  });
});
