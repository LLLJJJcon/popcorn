import {
  ApiErrorCodeSchema,
  CandidateExpressionListSchema,
  CandidateExpressionSchema,
  KnowledgeJobTypeSchema,
  MasteryStateSchema,
  PracticeTaskSchema,
  SavedItemInputSchema,
  TargetLanguageSchema,
  TranscriptSegmentSchema,
  VideoSourceSchema,
} from "@/contracts";
import { makeCandidateExpression, makePracticeTask } from "../factories/practice";
import { makeSavedItemInput, makeVideoSource } from "../factories/source";

const baseSave = {
  clientEventId: "00000000-0000-4000-8000-000000000101",
  youtubeVideoId: "dQw4w9WgXcQ",
  capturedAt: "2026-08-16T10:00:00.000Z",
};

describe("shared contracts", () => {
  it("accepts every exact YouTube save payload", () => {
    const saves = [
      {
        ...baseSave,
        kind: "video",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "中文访谈",
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        durationSeconds: 213,
        description: "一段中文访谈。",
        currentTimeSeconds: 42,
        requestNativeTranscript: true,
      },
      { ...baseSave, kind: "player_moment", capturedSecond: 42 },
      {
        ...baseSave,
        kind: "subtitle_row",
        segmentId: "seg-42",
        originalChinese: "这也太离谱了吧。",
        englishTranslation: "That is way too absurd.",
        startSeconds: 42,
        endSeconds: 48,
        contextBefore: ["你刚才看到了吗？"],
        contextAfter: ["我完全没想到。"],
      },
      {
        ...baseSave,
        kind: "subtitle_selection",
        startSeconds: 42,
        endSeconds: 48,
        originalChinese: "这也太离谱了吧。",
        englishTranslation: "That is way too absurd.",
        segmentIds: ["seg-42"],
        startOffset: 0,
        endOffset: 9,
        contextBefore: ["你刚才看到了吗？"],
        contextAfter: ["我完全没想到。"],
      },
      {
        ...baseSave,
        kind: "key_quote",
        exactQuote: "这也太离谱了吧。",
        quoteSeconds: 42,
        segmentIds: ["seg-42"],
      },
      {
        ...baseSave,
        kind: "ai_explanation",
        selectedChinese: "太离谱了",
        englishExplanation: "A colloquial way to say something is outrageously unreasonable.",
        segmentIds: ["seg-42"],
        startSeconds: 42,
        endSeconds: 48,
        contextBefore: ["你刚才看到了吗？"],
        contextAfter: ["我完全没想到。"],
      },
    ];

    expect(saves.map((save) => SavedItemInputSchema.parse(save).kind)).toEqual([
      "video",
      "player_moment",
      "subtitle_row",
      "subtitle_selection",
      "key_quote",
      "ai_explanation",
    ]);
  });

  it("accepts the required subtitle selection fixture", () => {
    expect(
      SavedItemInputSchema.parse({
        clientEventId: "00000000-0000-4000-8000-000000000101",
        youtubeVideoId: "dQw4w9WgXcQ",
        kind: "subtitle_selection",
        capturedAt: "2026-08-16T10:00:00.000Z",
        startSeconds: 42,
        endSeconds: 48,
        originalChinese: "这也太离谱了吧。",
        englishTranslation: "That is way too absurd.",
        segmentIds: ["seg-42"],
        startOffset: 0,
        endOffset: 9,
        contextBefore: ["你刚才看到了吗？"],
        contextAfter: ["我完全没想到。"],
      }),
    ).toMatchObject({ kind: "subtitle_selection" });
  });

  it("preserves subtitle-selection text and context byte-for-byte", () => {
    const save = {
      ...baseSave,
      kind: "subtitle_selection" as const,
      originalChinese: " \t这也太离谱了吧。\n",
      englishTranslation: "  That is way too absurd.  ",
      segmentIds: ["seg-42"],
      startSeconds: 42,
      endSeconds: 48,
      startOffset: 0,
      endOffset: 9,
      contextBefore: [" \n你刚才看到了吗？\t"],
      contextAfter: ["  我完全没想到。  "],
    };

    expect(SavedItemInputSchema.parse(save)).toEqual(save);
  });

  it("preserves a key quote byte-for-byte", () => {
    const save = {
      ...baseSave,
      kind: "key_quote" as const,
      exactQuote: " \t这也太离谱了吧。\n",
      quoteSeconds: 42,
      segmentIds: ["seg-42"],
    };

    expect(SavedItemInputSchema.parse(save)).toEqual(save);
  });

  it("preserves an AI explanation's selected text and explanation byte-for-byte", () => {
    const save = {
      ...baseSave,
      kind: "ai_explanation" as const,
      selectedChinese: " \t太离谱了\n",
      englishExplanation: "  A colloquial way to say something is unreasonable.  ",
      segmentIds: ["seg-42"],
      startSeconds: 42,
      endSeconds: 48,
      contextBefore: [" \n你刚才看到了吗？\t"],
      contextAfter: ["  我完全没想到。  "],
    };

    expect(SavedItemInputSchema.parse(save)).toEqual(save);
  });

  it("preserves candidate evidence and its English explanation byte-for-byte", () => {
    const candidate = makeCandidateExpression({
      evidenceText: " \t这也太离谱了吧。\n",
      englishExplanation: "  An emphatic reaction to something unreasonable.  ",
    });

    expect(CandidateExpressionSchema.parse(candidate)).toEqual(candidate);
  });

  it("rejects segment identifiers with surrounding whitespace", () => {
    expect(() =>
      SavedItemInputSchema.parse({
        ...makeSavedItemInput(),
        segmentIds: [" seg-42 "],
      }),
    ).toThrow();
    expect(() =>
      CandidateExpressionSchema.parse(
        makeCandidateExpression({ segmentIds: [" seg-42 "] }),
      ),
    ).toThrow();
  });

  it("rejects arbitrary URLs and deferred input kinds", () => {
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "video",
        canonicalUrl: "https://example.com/watch?v=dQw4w9WgXcQ",
        title: "中文访谈",
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        durationSeconds: 213,
        description: "一段中文访谈。",
        currentTimeSeconds: 42,
        requestNativeTranscript: true,
      }),
    ).toThrow();
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "web_page",
        url: "https://example.com/article",
      }),
    ).toThrow();
  });

  it("rejects a non-canonical YouTube watch URL fragment", () => {
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "video",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ#captions",
        title: "中文访谈",
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        durationSeconds: 213,
        description: "一段中文访谈。",
        currentTimeSeconds: 42,
        requestNativeTranscript: true,
      }),
    ).toThrow();
  });

  it("rejects a canonical URL whose video ID does not match the save identity", () => {
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "video",
        canonicalUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
        title: "中文访谈",
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        durationSeconds: 213,
        description: "一段中文访谈。",
        currentTimeSeconds: 42,
        requestNativeTranscript: true,
      }),
    ).toThrow();
  });

  it("rejects reversed subtitle character offsets", () => {
    expect(() =>
      SavedItemInputSchema.parse({
        ...makeSavedItemInput(),
        startOffset: 9,
        endOffset: 2,
      }),
    ).toThrow();
  });

  it("rejects a persisted source whose URL and video ID differ", () => {
    expect(() =>
      VideoSourceSchema.parse({
        ...makeVideoSource(),
        canonicalUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      }),
    ).toThrow();
  });

  it("rejects a reversed transcript segment range", () => {
    expect(() =>
      TranscriptSegmentSchema.parse({
        id: "seg-42",
        snapshotId: "00000000-0000-4000-8000-000000000003",
        position: 42,
        startSeconds: 48,
        endSeconds: 42,
        originalChinese: "这也太离谱了吧。",
      }),
    ).toThrow();
  });

  it("requires the exact acted-on fields and bounded source context", () => {
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "key_quote",
        quoteSeconds: 42,
        segmentIds: ["seg-42"],
      }),
    ).toThrow();
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "ai_explanation",
        selectedChinese: "太离谱了",
        englishExplanation: "这句话表示事情很荒唐。",
        segmentIds: ["seg-42"],
        startSeconds: 42,
        endSeconds: 48,
        contextBefore: [],
        contextAfter: [],
      }),
    ).toThrow();
    expect(() =>
      SavedItemInputSchema.parse({
        ...baseSave,
        kind: "subtitle_selection",
        originalChinese: "太离谱了",
        segmentIds: ["seg-42"],
        startSeconds: 42,
        endSeconds: 48,
        startOffset: 0,
        endOffset: 5,
        contextBefore: ["一", "二", "三", "四"],
        contextAfter: [],
      }),
    ).toThrow();
  });

  it("limits source-grounded expression candidates to three", () => {
    const candidate = makeCandidateExpression();
    expect(CandidateExpressionSchema.parse(candidate)).toEqual(candidate);
    expect(() =>
      CandidateExpressionListSchema.parse([candidate, candidate, candidate, candidate]),
    ).toThrow();
  });

  it("rejects a candidate with a reversed timestamp range", () => {
    expect(() =>
      CandidateExpressionSchema.parse(
        makeCandidateExpression({ startSeconds: 48, endSeconds: 42 }),
      ),
    ).toThrow();
  });

  it("requires Han text for a target-language candidate", () => {
    expect(() =>
      CandidateExpressionSchema.parse(
        makeCandidateExpression({ expression: "That is outrageous" }),
      ),
    ).toThrow();
  });

  it("fixes the target-language discriminator to zh-CN", () => {
    expect(TargetLanguageSchema.parse("zh-CN")).toBe("zh-CN");
    expect(TargetLanguageSchema.safeParse("zh-TW").success).toBe(false);
    expect(
      PracticeTaskSchema.safeParse({ ...makePracticeTask(), targetLanguage: "zh-TW" }).success,
    ).toBe(false);
  });

  it("freezes job, mastery, and API error taxonomies", () => {
    expect(KnowledgeJobTypeSchema.options).toEqual([
      "resolve_snapshot",
      "generate_overview",
      "translate_segments",
      "explain_selection",
      "analyze_saved_item",
    ]);
    expect(MasteryStateSchema.options).toEqual(["tried", "reused", "owned"]);
    expect(MasteryStateSchema.safeParse("seen").success).toBe(false);
    expect(MasteryStateSchema.safeParse("understood").success).toBe(false);
    expect(ApiErrorCodeSchema.options).toEqual([
      "AUTH_REQUIRED",
      "SESSION_EXPIRED",
      "FORBIDDEN",
      "UNSUPPORTED_YOUTUBE_PAGE",
      "INVALID_YOUTUBE_VIDEO",
      "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
      "TRANSCRIPT_UNAVAILABLE",
      "TRANSCRIPT_EMPTY",
      "SYNC_QUEUE_FULL",
      "SYNC_RETRYING",
      "IDEMPOTENCY_CONFLICT",
      "PROVIDER_RATE_LIMITED",
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_OUTPUT_INVALID",
      "JOB_LEASE_CONFLICT",
      "JOB_RETRY_EXHAUSTED",
      "VALIDATION_FAILED",
      "CONFLICT",
      "INTERNAL_ERROR",
    ]);
  });

  it("provides deterministic source and practice factories", () => {
    expect(makeVideoSource()).toEqual(makeVideoSource());
    expect(makeSavedItemInput()).toEqual(makeSavedItemInput());
    expect(makeCandidateExpression()).toEqual(makeCandidateExpression());
    expect(makePracticeTask()).toEqual(makePracticeTask());
  });
});
