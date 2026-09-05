import { describe, expect, test } from "vitest";

import {
  extractUniqueSemanticObject,
  normalizeEnglishPunctuation,
  safeModelFailureCode,
  type WireNormalizer,
} from "@/server/ai/model-output";
import { ModelGatewayError } from "@/server/ai/provider";

const scoreNormalizer: WireNormalizer<{ readonly score: number }> = (value) =>
  typeof value.score === "number" && Number.isInteger(value.score)
    ? { success: true, data: { score: value.score } }
    : { success: false, fieldPath: "score" };

describe("bounded task-aware model output", () => {
  test.each([
    ['{"score":4}', { score: 4 }],
    ['```json\n{"score":4}\n```', { score: 4 }],
    ['Result:\n{"score":4}\nDone.', { score: 4 }],
    ['{"result":{"score":4}}', { score: 4 }],
    ['Result: {"score":4,"note":"a { brace and \\"quote\\" }"}.', { score: 4 }],
  ])("extracts one semantic object from %s", (text, expected) => {
    expect(extractUniqueSemanticObject(text, scoreNormalizer)).toEqual({
      ok: true,
      value: expected,
    });
  });

  test("accepts one valid candidate when another parseable candidate is task-invalid", () => {
    expect(extractUniqueSemanticObject(
      '{"score":4}\n{"score":"bad"}',
      scoreNormalizer,
    )).toEqual({ ok: true, value: { score: 4 } });
  });

  test("rejects two task-valid candidates as ambiguous", () => {
    expect(extractUniqueSemanticObject(
      '{"score":4}\n{"score":5}',
      scoreNormalizer,
    )).toEqual({ ok: false, reason: "ambiguous" });
  });

  test("distinguishes absent JSON from a parseable object that fails the task schema", () => {
    expect(extractUniqueSemanticObject("not json", scoreNormalizer)).toEqual({
      ok: false,
      reason: "json_extract",
    });
    expect(extractUniqueSemanticObject('{"wrong":4}', scoreNormalizer)).toEqual({
      ok: false,
      reason: "wire_schema",
      fieldPath: "score",
    });
  });

  test.each([
    ["[1,2,3]", "json_extract"],
    ['[{"score":4}]', "json_extract"],
    ['Result: [{"score":4}]', "json_extract"],
    ['{"score":4', "json_extract"],
    [Array.from({ length: 9 }, (_, score) => `{"score":${score}}`).join("\n"), "json_extract"],
  ])("rejects unsafe candidate input %s", (text, reason) => {
    expect(extractUniqueSemanticObject(text, scoreNormalizer)).toEqual({
      ok: false,
      reason,
    });
  });

  test("retains only finite schema tokens and numeric indexes in field paths", () => {
    const schemaFailure: WireNormalizer<never> = () => ({
      success: false,
      fieldPath: "candidates.0.expression",
    });
    const extracted = extractUniqueSemanticObject("{}", schemaFailure);
    expect(extracted).toEqual({
      ok: false,
      reason: "wire_schema",
      fieldPath: "candidates.0.expression",
    });
    expect(safeModelFailureCode(new ModelGatewayError(
      "PROVIDER_OUTPUT_INVALID",
      "wire_schema",
      extracted.ok ? undefined : extracted.fieldPath,
    ))).toBe("PROVIDER_OUTPUT_INVALID:wire_schema:candidates.0.expression");
  });

  test.each([
    ["API-key-like value", "candidates.0.sk-proj-fixture-secret-that-must-not-leak"],
    ["UUID", "candidates.0.0a000000-0000-4000-8000-00000000a001"],
    ["user text", "candidates.0.The learner said this was hard"],
    ["raw model text", "candidates.0.Raw model output says the answer is correct"],
    ["long opaque identifier", `candidates.0.${"a".repeat(64)}`],
    ["arbitrary label", "candidates.0.private_value"],
  ])("omits %s from safe model failure codes", (_label, fieldPath) => {
    const unsafeNormalizer: WireNormalizer<never> = () => ({
      success: false,
      fieldPath,
    });
    expect(extractUniqueSemanticObject("{}", unsafeNormalizer)).toEqual({
      ok: false,
      reason: "wire_schema",
    });
    expect(safeModelFailureCode(new ModelGatewayError(
      "PROVIDER_OUTPUT_INVALID",
      "wire_schema",
      fieldPath,
    ))).toBe("PROVIDER_OUTPUT_INVALID:wire_schema");
  });

  test("normalizes only documented English punctuation", () => {
    expect(normalizeEnglishPunctuation("“That’s fine…” — really\u00a0fine"))
      .toBe('"That\'s fine..." - really fine');
    expect(normalizeEnglishPunctuation("而且高得要命")).toBe("而且高得要命");
  });

  test("serializes a persistence failure without exception text", () => {
    expect(safeModelFailureCode({ code: "INTERNAL", stage: "persistence" }))
      .toBe("INTERNAL:persistence");
  });
});
