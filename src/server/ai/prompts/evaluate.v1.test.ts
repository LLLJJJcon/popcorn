import { describe, expect, test } from "vitest";

import { parsePracticeEvaluationOutput } from "./evaluate.v1";

const baseEvaluation = {
  passed: true,
  independentUse: true,
  assistanceLevel: "none",
  naturalRevisionChinese: "这个价格也太离谱了吧。",
};

describe("parsePracticeEvaluationOutput", () => {
  test("accepts provider feedback aliases for all evaluation dimensions", () => {
    const parsed = parsePracticeEvaluationOutput(
      {
        ...baseEvaluation,
        accuracy: { score: 4, feedback: "The meaning is accurate." },
        naturalness: { score: 3, feedback: "The sentence sounds natural." },
        contextualFit: { score: 5, feedback: "It fits the situation." },
      },
      "太离谱了",
      "none",
    );

    expect(parsed.evaluation).toEqual({
      passed: true,
      accuracy: { score: 4, englishFeedback: "The meaning is accurate." },
      naturalness: { score: 3, englishFeedback: "The sentence sounds natural." },
      contextualFit: { score: 5, englishFeedback: "It fits the situation." },
      independentUse: true,
      assistanceLevel: "none",
    });
  });

  test("preserves canonical englishFeedback output", () => {
    const parsed = parsePracticeEvaluationOutput(
      {
        ...baseEvaluation,
        accuracy: { score: 4, englishFeedback: "The meaning is accurate." },
        naturalness: { score: 3, englishFeedback: "The sentence sounds natural." },
        contextualFit: { score: 5, englishFeedback: "It fits the situation." },
      },
      "太离谱了",
      "none",
    );

    expect(parsed.evaluation.accuracy.englishFeedback).toBe("The meaning is accurate.");
  });

  test("rejects dimensions when neither feedback field is a string", () => {
    expect(() =>
      parsePracticeEvaluationOutput(
        {
          ...baseEvaluation,
          accuracy: { score: 4, feedback: 42 },
          naturalness: { score: 3, englishFeedback: "The sentence sounds natural." },
          contextualFit: { score: 5, englishFeedback: "It fits the situation." },
        },
        "太离谱了",
        "none",
      ),
    ).toThrow();
  });
});
