import { describe, expect, test } from "vitest";

import {
  ANALYZE_SAVED_ITEM_PROMPT_VERSION,
  buildAnalyzeSavedItemPrompt,
  createAnalyzeSavedItemFixtureGateway,
} from "@/server/ai/prompts/analyze-saved-item.v1";
import {
  SavedItemAnalysisContentSchema,
  type SavedItemAnalysisEvidence,
  validateSavedItemAnalysisContent,
} from "@/server/jobs/job-types";
import { makeCandidateExpression } from "../../factories/practice";

const USER_ID = "41000000-0000-4000-8000-000000000001";
const SOURCE_ID = "42000000-0000-4000-8000-000000000001";
const SAVE_ID = "43000000-0000-4000-8000-000000000001";
const SNAPSHOT_ID = "44000000-0000-4000-8000-000000000001";
const TRANSCRIPT_HASH = "a".repeat(64);

const cases = [
  {
    name: "informal reaction",
    evidenceText: "这也太离谱了吧。",
    expression: "太离谱了",
    englishMeaning: "That is outrageous.",
    englishExplanation: "A strong reaction to something unreasonable.",
    tone: "Incredulous and emphatic.",
    communicativeFunction: "Reacting to an unreasonable situation.",
    register: "Informal spoken Mandarin.",
  },
  {
    name: "polite request",
    evidenceText: "麻烦您再说一遍，可以吗？",
    expression: "麻烦您",
    englishMeaning: "May I trouble you to...",
    englishExplanation: "A courteous way to introduce a request.",
    tone: "Polite and considerate.",
    communicativeFunction: "Making a polite request.",
    register: "Polite spoken Mandarin.",
  },
  {
    name: "disagreement",
    evidenceText: "话虽如此，我还是不太同意。",
    expression: "话虽如此",
    englishMeaning: "Even so.",
    englishExplanation: "It acknowledges a point before presenting disagreement.",
    tone: "Measured and respectful.",
    communicativeFunction: "Introducing a disagreement after acknowledgment.",
    register: "Neutral spoken or written Mandarin.",
  },
  {
    name: "online slang",
    evidenceText: "这个操作真的绝绝子。",
    expression: "绝绝子",
    englishMeaning: "Absolutely amazing.",
    englishExplanation: "Internet slang used for an emphatic reaction.",
    tone: "Playful and enthusiastic.",
    communicativeFunction: "Giving an exaggerated positive reaction.",
    register: "Online slang.",
  },
  {
    name: "register ambiguity",
    evidenceText: "你可真行啊。",
    expression: "真行",
    englishMeaning: "You are really something.",
    englishExplanation: "Context and delivery determine whether it is praise or sarcasm.",
    tone: "Potentially admiring or sarcastic.",
    communicativeFunction: "Evaluating someone's action with context-dependent intent.",
    register: "Informal spoken Mandarin with ambiguous intent.",
  },
] as const;

function evidence(evidenceText: string, position: number): SavedItemAnalysisEvidence {
  return {
    userId: USER_ID,
    sourceId: SOURCE_ID,
    savedItemId: SAVE_ID,
    snapshotId: SNAPSHOT_ID,
    transcriptHash: TRANSCRIPT_HASH,
    kind: "subtitle_row",
    rawText: evidenceText,
    startSeconds: 20 + position,
    segments: [{
      stableId: `saved-analysis-fixture-${position}`,
      originalChinese: evidenceText,
      startSeconds: 20 + position,
      endSeconds: 22 + position,
    }],
  };
}

describe("saved-item analysis fixture contract", () => {
  test.each(cases)("keeps $name grounded through the frozen validator and CI gateway", async (fixture) => {
    const position = cases.indexOf(fixture);
    const source = evidence(fixture.evidenceText, position);
    const candidate = makeCandidateExpression({
      evidenceText: fixture.evidenceText,
      expression: fixture.expression,
      englishMeaning: fixture.englishMeaning,
      englishExplanation: fixture.englishExplanation,
      tone: fixture.tone,
      communicativeFunction: fixture.communicativeFunction,
      register: fixture.register,
      segmentIds: [source.segments[0]!.stableId],
      startSeconds: source.segments[0]!.startSeconds,
      endSeconds: source.segments[0]!.endSeconds,
      confidence: fixture.name === "register ambiguity" ? 0.6 : 0.9,
    });

    expect(validateSavedItemAnalysisContent({ candidates: [candidate] }, source)).toEqual({
      candidates: [candidate],
    });

    const fixtureOutput = await createAnalyzeSavedItemFixtureGateway().complete(
      ANALYZE_SAVED_ITEM_PROMPT_VERSION,
      buildAnalyzeSavedItemPrompt(source),
    );
    expect(validateSavedItemAnalysisContent(fixtureOutput, source)).toEqual(fixtureOutput);
  });

  test("rejects malformed structured output before publication", () => {
    const malformed = {
      candidates: [{
        ...makeCandidateExpression(),
        confidence: "high",
      }],
    };

    expect(SavedItemAnalysisContentSchema.safeParse(malformed).success).toBe(false);
    expect(() => validateSavedItemAnalysisContent(malformed, evidence("这也太离谱了吧。", 0))).toThrow();
  });

  test("rejects schema-valid evidence invented outside the persisted segment", () => {
    const source = evidence("这也太离谱了吧。", 0);
    const invented = {
      candidates: [makeCandidateExpression({
        expression: "凭空出现",
        evidenceText: "这是凭空出现的证据。",
        segmentIds: [source.segments[0]!.stableId],
        startSeconds: source.segments[0]!.startSeconds,
        endSeconds: source.segments[0]!.endSeconds,
      })],
    };

    expect(SavedItemAnalysisContentSchema.safeParse(invented).success).toBe(true);
    expect(() => validateSavedItemAnalysisContent(invented, source)).toThrow(
      "candidate text is not exact persisted Chinese evidence",
    );
  });
});
