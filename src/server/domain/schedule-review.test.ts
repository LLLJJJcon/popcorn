import { describe, expect, test } from "vitest";

import { scheduleReview } from "./schedule-review";

const NOW = "2026-08-16T00:00:00.000Z";

describe("scheduleReview", () => {
  test.each([
    ["first_tried", 1, "2026-08-17T00:00:00.000Z"],
    ["failed_or_heavily_assisted_reuse", 1, "2026-08-17T00:00:00.000Z"],
    ["successful_independent_reuse", 7, "2026-08-23T00:00:00.000Z"],
    ["owned_maintenance", 30, "2026-09-15T00:00:00.000Z"],
  ] as const)("schedules %s with its fixed interval", (kind, intervalDays, dueAt) => {
    expect(scheduleReview({ kind, now: NOW })).toEqual({ intervalDays, dueAt });
  });

  test("uses UTC millisecond arithmetic across a daylight-saving boundary", () => {
    expect(
      scheduleReview({
        kind: "first_tried",
        now: "2026-03-08T09:30:00.000Z",
      }),
    ).toEqual({
      intervalDays: 1,
      dueAt: "2026-03-09T09:30:00.000Z",
    });
  });

  test("does not mutate its input", () => {
    const input = Object.freeze({ kind: "successful_independent_reuse" as const, now: NOW });

    scheduleReview(input);

    expect(input).toEqual({ kind: "successful_independent_reuse", now: NOW });
  });

  test.each(["not-a-date", "2026-02-30T00:00:00.000Z", ""])(
    "rejects invalid injected clock %j",
    (now) => {
      expect(() => scheduleReview({ kind: "first_tried", now })).toThrow(
        /valid ISO 8601/i,
      );
    },
  );

  test("does not accept client or AI schedule overrides", () => {
    if (false) {
      scheduleReview({
        kind: "first_tried",
        now: NOW,
        // @ts-expect-error Callers cannot choose the due date.
        dueAt: "2099-01-01T00:00:00.000Z",
      });
      scheduleReview({
        kind: "owned_maintenance",
        now: NOW,
        // @ts-expect-error Callers cannot choose the review interval.
        intervalDays: 365,
      });
    }

    expect(scheduleReview({ kind: "first_tried", now: NOW }).intervalDays).toBe(1);
  });
});
