import { describe, expect, test } from "vitest";

import {
  NativeTranscriptError,
  normalizeNativeTranscript,
} from "./normalize-transcript";

const payload = {
  lang: "zh-CN",
  content: [
    { text: ">> 你好，世界", offset: 1_250, duration: 2_900, lang: "zh" },
    { text: ">>这个表达很常见。", offset: 65_999, duration: 1_999, lang: "zh-Hans" },
  ],
};

describe("normalizeNativeTranscript", () => {
  test("adapts caption cleanup, milliseconds, and plain/timestamped output", () => {
    const result = normalizeNativeTranscript(payload);

    expect(result.language).toBe("zh-CN");
    expect(result.segments.map(({ originalChinese, startSeconds, endSeconds }) => ({
      originalChinese,
      startSeconds,
      endSeconds,
    }))).toEqual([
      { originalChinese: "你好，世界", startSeconds: 1, endSeconds: 3 },
      { originalChinese: "这个表达很常见。", startSeconds: 65, endSeconds: 66 },
    ]);
    expect(result.plainText).toBe("你好，世界 这个表达很常见。");
    expect(result.timestampedText).toBe("[0:01] 你好，世界\n[1:05] 这个表达很常见。");
  });

  test("derives stable IDs from snapshot hash, ordinal, time, and exact cleaned text", () => {
    const first = normalizeNativeTranscript(payload);
    const same = normalizeNativeTranscript(structuredClone(payload));
    const textChanged = normalizeNativeTranscript({
      ...payload,
      content: [payload.content[0], { ...payload.content[1], text: "这个说法很常见。" }],
    });
    const timeChanged = normalizeNativeTranscript({
      ...payload,
      content: [payload.content[0], { ...payload.content[1], offset: 66_999 }],
    });

    expect(first).toEqual(same);
    expect(first.transcriptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.segments[0].stableId).toMatch(/^[a-f0-9]{64}$/);
    expect(first.segments[1].stableId).not.toBe(textChanged.segments[1].stableId);
    expect(first.segments[1].stableId).not.toBe(timeChanged.segments[1].stableId);
    expect(first.transcriptHash).not.toBe(textChanged.transcriptHash);
  });

  test("preserves exact cleaned Chinese rather than translating or normalizing it", () => {
    const exact = "臺灣用語與简体字   保留";
    const result = normalizeNativeTranscript({
      lang: "zh-Hans",
      content: [{ text: `>> ${exact}`, offset: 0, duration: 1000, lang: "zh-CN" }],
    });

    expect(result.segments[0].originalChinese).toBe(exact);
  });

  test.each(["en", "zh-TW", "zh-Hant"]) (
    "rejects aggregate language %s",
    (lang) => {
      expect(() => normalizeNativeTranscript({ ...payload, lang })).toThrow(
        NativeTranscriptError,
      );
    },
  );

  test("rejects mixed fallback and non-Han chunks", () => {
    expect(() =>
      normalizeNativeTranscript({
        lang: "zh",
        content: [{ text: "你好", offset: 0, duration: 1000, lang: "en" }],
      }),
    ).toThrow(/native simplified chinese/i);
    expect(() =>
      normalizeNativeTranscript({
        lang: "zh",
        content: [{ text: "hello", offset: 0, duration: 1000, lang: "zh" }],
      }),
    ).toThrow(/Chinese text/i);
  });

  test("rejects empty, invalid numeric, and oversized content deterministically", () => {
    expect(() => normalizeNativeTranscript({ lang: "zh", content: [] })).toThrow(
      /empty/i,
    );
    expect(() =>
      normalizeNativeTranscript({
        lang: "zh",
        content: [{ text: "你好", offset: -1, duration: 1000, lang: "zh" }],
      }),
    ).toThrow(/offset/i);
    expect(() =>
      normalizeNativeTranscript({
        lang: "zh",
        content: [{ text: "中".repeat(10_001), offset: 0, duration: 1000, lang: "zh" }],
      }),
    ).toThrow(/text/i);
  });
});
