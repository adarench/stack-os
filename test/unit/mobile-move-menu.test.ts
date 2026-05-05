import { describe, expect, it } from "vitest";
import {
  WORK_ORDER_STATUSES,
  allowedNext,
  canTransition,
  type WorkOrderStatus,
} from "@contracts/state-machines/work-order";

/**
 * Mobile-safe status movement guarantee:
 * the "Move…" menu on a card and the kanban drag both feed the same
 * `allowedNext` / `canTransition` helpers. Drag is unreliable on touch;
 * this test asserts the menu surface is a strict subset of the FSM, so
 * touch users cannot reach states drag users cannot.
 */
describe("mobile move menu / allowedNext is in lockstep with canTransition", () => {
  it("for every status, every allowedNext target is canTransition-allowed", () => {
    for (const from of WORK_ORDER_STATUSES) {
      const next = allowedNext(from);
      for (const to of next) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("for every status, no canTransition-allowed target is missing from allowedNext", () => {
    for (const from of WORK_ORDER_STATUSES) {
      const next = new Set(allowedNext(from));
      for (const to of WORK_ORDER_STATUSES) {
        if (canTransition(from, to)) {
          expect(next.has(to)).toBe(true);
        }
      }
    }
  });

  it("the menu never exposes the same-state self-transition", () => {
    for (const s of WORK_ORDER_STATUSES) {
      expect(allowedNext(s)).not.toContain(s as WorkOrderStatus);
    }
  });

  it("terminal states (closed, cancelled) yield empty menus", () => {
    expect(allowedNext("closed")).toEqual([]);
    expect(allowedNext("cancelled")).toEqual([]);
  });
});
