import { describe, expect, it } from "vitest";
import { SavedItemInputSchema } from "./source";

const base = {
  clientEventId: "00000000-0000-4000-8000-000000000101",
  youtubeVideoId: "dQw4w9WgXcQ",
  capturedAt: "2026-11-01T00:00:00.000Z",
};
const row = {
  ...base, kind: "subtitle_row", segmentId: "line-4", originalChinese: "这杯咖啡高得要命。",
  startSeconds: 4, endSeconds: 6,
  contextBefore: ["第一句。", "第二句。", "第三句。"],
  contextAfter: ["第五句。", "第六句。"],
};

describe("saved context window", () => {
  it("accepts three preceding and two following lines", () => {
    expect(SavedItemInputSchema.parse(row)).toEqual(row);
  });
  it("accepts a legacy third following line and keeps the two nearest", () => {
    const legacy = { ...row, contextAfter: [...row.contextAfter, "第七句。"] };
    expect(SavedItemInputSchema.parse(legacy)).toEqual(row);
  });
  it("rejects more than three following lines", () => {
    const tooMany = { ...row, contextAfter: [...row.contextAfter, "第七句。", "第八句。"] };
    expect(SavedItemInputSchema.safeParse(tooMany).success).toBe(false);
  });
  it("preserves key-quote context and accepts old clients without it", () => {
    const quote = { ...base, kind: "key_quote", exactQuote: row.originalChinese, quoteSeconds: 4, segmentIds: ["line-4"] };
    expect(SavedItemInputSchema.parse(quote)).toEqual(quote);
    const withContext = { ...quote, contextBefore: row.contextBefore, contextAfter: row.contextAfter };
    expect(SavedItemInputSchema.parse(withContext)).toEqual(withContext);
  });
});
