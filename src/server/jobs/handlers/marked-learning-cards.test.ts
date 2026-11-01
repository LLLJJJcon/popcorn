import { expect, test, vi } from "vitest";
import { generateMarkedLearningCards, highlightIdentity } from "./marked-learning-cards";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import type { SavedItemAnalysisEvidence } from "../job-types";

const highlight = { id: "10000000-0000-4000-8000-000000000001", savedItemId: "20000000-0000-4000-8000-000000000001", startSegmentId: "s1", startOffset: 2, endSegmentId: "s1", endOffset: 7, text: "高得要命", origin: "user" as const, reasonEn: null, status: "active" as const };
const evidence: SavedItemAnalysisEvidence = { userId: "u", sourceId: "s", savedItemId: highlight.savedItemId, snapshotId: "ss", transcriptHash: "hash", kind: "subtitle_row", rawText: "价格高得要命", startSeconds: 10, contextBefore: ["谈谈房价"], highlights: [highlight], segments: [{ stableId: "s1", originalChinese: "价格高得要命", startSeconds: 10, endSeconds: 12 }] };
function card(id = "h1") { return { id, meaningHere: "Ridiculously high.", useItWhen: "Complain about excessive things.", comparedWith: "很高 is neutral; this expresses frustration.", howItFits: "Use the original phrase in the clause.", toneAndWho: "Casual with friends.", watchOut: null, examples: [{ zh: "这里的气温高得要命。", en: "Temperatures here are unbearably high." }, { zh: "这杯咖啡高得要命。", en: "This coffee is ridiculously expensive." }], functionCategories: ["complain"], usageSettings: ["casual_chat"], suitability: "expression" }; }
function gateway(complete: ReturnType<typeof vi.fn>): StructuredJsonGateway { return { model: "fixture/test", complete: complete as StructuredJsonGateway["complete"] }; }

test("grounds every card in its selected mark and skips previously analyzed positions", async () => {
  const complete = vi.fn(async () => ({ cards: [card()] }));
  const content = await generateMarkedLearningCards({ gateway: gateway(complete), evidence });
  expect(content.candidates[0]).toMatchObject({ expression: highlight.text, highlightId: highlight.id, highlightKey: highlightIdentity(highlight), segmentIds: ["s1"], startSeconds: 10 });
  expect(complete.mock.calls).toHaveLength(1);
  expect(content.highlightStates).toEqual([{ highlightId: highlight.id, text: highlight.text, status: "ready" }]);
  const second = vi.fn();
  const repeated = await generateMarkedLearningCards({ gateway: gateway(second), evidence: { ...evidence, existingCandidates: content.candidates, highlights: [{ ...highlight, id: "10000000-0000-4000-8000-000000000002" }] } });
  expect(second).not.toHaveBeenCalled();
  expect(repeated.candidates).toHaveLength(1);
});

test("retries only bad cards and preserves successful cards when one mark keeps failing", async () => {
  const other = { ...highlight, id: "10000000-0000-4000-8000-000000000002", startOffset: 0, endOffset: 2, text: "价格" };
  const complete = vi.fn(async (_version: string, prompt: string) => {
    const { highlights } = JSON.parse(prompt);
    return { cards: highlights.map((mark: { id: string; text: string }) => mark.text === "价格" ? { id: mark.id, meaningHere: "bad" } : card(mark.id)) };
  });
  const content = await generateMarkedLearningCards({ gateway: gateway(complete), evidence: { ...evidence, highlights: [highlight, other] } });
  expect(content.candidates).toHaveLength(1);
  expect(content.highlightStates).toContainEqual({ highlightId: other.id, text: other.text, status: "failed" });
  expect(complete).toHaveBeenCalledTimes(4);
  expect(JSON.parse(complete.mock.calls[1]![1]).highlights).toHaveLength(1);
});

test("examples-only failures retry four times then produce a card with examples unavailable", async () => {
  const complete = vi.fn(async () => ({ cards: [{ ...card(), examples: [] }] }));
  const content = await generateMarkedLearningCards({ gateway: gateway(complete), evidence });
  expect(complete).toHaveBeenCalledTimes(4);
  expect(content.candidates[0]?.examples).toBeNull();
});

test("batches six marks as five then one with proportional token budgets", async () => {
  const marks = Array.from({ length: 6 }, (_, index) => ({ ...highlight, id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, startOffset: index, endOffset: index + 1, text: "高" }));
  const complete = vi.fn(async (_version: string, prompt: string) => ({ cards: JSON.parse(prompt).highlights.map((mark: { id: string }) => ({ ...card(mark.id), examples: [{ zh: "今天气温高。", en: "It is hot today." }, { zh: "那里的价格高。", en: "Prices are high there." }] })) }));
  await generateMarkedLearningCards({ gateway: gateway(complete), evidence: { ...evidence, highlights: marks } });
  expect(complete).toHaveBeenCalledTimes(2);
  const calls = complete.mock.calls as unknown[][];
  expect(calls[0]?.[2]).toMatchObject({ maxTokens: 2400 });
  expect(calls[1]?.[2]).toMatchObject({ maxTokens: 600 });
});

test("malformed JSON attempts stop at four and retain a per-mark failure", async () => {
  const { ModelGatewayError } = await import("@/server/ai/provider");
  const complete = vi.fn().mockRejectedValue(new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "json_extract"));
  const content = await generateMarkedLearningCards({ gateway: gateway(complete), evidence });
  expect(complete).toHaveBeenCalledTimes(4);
  expect(content.candidates).toEqual([]);
  expect(content.highlightStates).toEqual([{ highlightId: highlight.id, text: highlight.text, status: "failed" }]);
});

test("JSON and card failures share the same four-call budget", async () => {
  const { ModelGatewayError } = await import("@/server/ai/provider");
  let calls = 0;
  const complete = vi.fn(async () => {
    calls += 1;
    if (calls < 4) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "json_extract");
    return { cards: [{ id: "h1", meaningHere: "Missing required card fields." }] };
  });
  const content = await generateMarkedLearningCards({ gateway: gateway(complete), evidence });
  expect(complete).toHaveBeenCalledTimes(4);
  expect(content.candidates).toEqual([]);
  expect(content.highlightStates[0]?.status).toBe("failed");
});
