import { describe, expect, test } from "vitest";

import { advanceMastery, type MasteryEvidence } from "./mastery";

describe("advanceMastery", () => {
  test("records a valid original attempt as tried", () => {
    expect(advanceMastery(null, { kind: "valid_original_attempt" })).toBe("tried");
  });

  test("advances tried after a successful independent transfer", () => {
    expect(
      advanceMastery("tried", { kind: "successful_independent_transfer" }),
    ).toBe("reused");
  });

  test("advances reused only after the full ownership threshold", () => {
    expect(
      advanceMastery("reused", {
        kind: "owned_threshold_met",
        distinctContexts: 2,
        distinctUtcDates: 2,
        includesDuePractice: true,
      }),
    ).toBe("owned");
  });

  test.each([
    {
      kind: "owned_threshold_met" as const,
      distinctContexts: 1,
      distinctUtcDates: 2,
      includesDuePractice: true,
    },
    {
      kind: "owned_threshold_met" as const,
      distinctContexts: 2,
      distinctUtcDates: 1,
      includesDuePractice: true,
    },
    {
      kind: "owned_threshold_met" as const,
      distinctContexts: 2,
      distinctUtcDates: 2,
      includesDuePractice: false,
    },
  ])("does not advance incomplete ownership evidence", (evidence) => {
    expect(advanceMastery("reused", evidence)).toBe("reused");
  });

  test.each<MasteryEvidence>([
    { kind: "saved_item_created" },
    { kind: "content_viewed", surface: "translation" },
    { kind: "content_viewed", surface: "overview" },
    { kind: "content_viewed", surface: "explanation" },
    { kind: "failed_or_assisted_reuse" },
  ])("does not treat interest or weak evidence as mastery", (evidence) => {
    expect(advanceMastery(null, evidence)).toBeNull();
    expect(advanceMastery("tried", evidence)).toBe("tried");
    expect(advanceMastery("reused", evidence)).toBe("reused");
  });

  test("never skips a mastery state", () => {
    expect(
      advanceMastery(null, { kind: "successful_independent_transfer" }),
    ).toBeNull();
    expect(
      advanceMastery("tried", {
        kind: "owned_threshold_met",
        distinctContexts: 4,
        distinctUtcDates: 4,
        includesDuePractice: true,
      }),
    ).toBe("tried");
  });

  test("owned is absorbing and lower repeated evidence never lowers mastery", () => {
    expect(advanceMastery("owned", { kind: "valid_original_attempt" })).toBe(
      "owned",
    );
    expect(
      advanceMastery("owned", { kind: "successful_independent_transfer" }),
    ).toBe("owned");
    expect(
      advanceMastery("owned", { kind: "failed_or_assisted_reuse" }),
    ).toBe("owned");
  });

  test("the evidence API excludes client targets and AI proposals", () => {
    if (false) {
      // @ts-expect-error Mastery transitions cannot be selected by a client.
      advanceMastery("tried", { kind: "client_target", target: "owned" });
      // @ts-expect-error AI output is not mastery evidence.
      advanceMastery("tried", { kind: "ai_mastery_proposal", target: "owned" });
    }

    expect(true).toBe(true);
  });
});
