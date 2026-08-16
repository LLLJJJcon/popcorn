import {
  ApiFailureSchema,
  ApiErrorCodeSchema,
  CanonicalYouTubeUrlSchema,
  CandidateExpressionListSchema,
  CandidateExpressionSchema,
  EnglishTextSchema,
  EvaluationResultSchema,
  GeneratedArtifactSchema,
  KnowledgeJobSchema,
  KnowledgeJobTypeSchema,
  MasteryStateSchema,
  NativeLanguageSchema,
  PracticeTaskSchema,
  SavedItemSchema,
  SavedItemInputSchema,
  TargetLanguageSchema,
  TranscriptSegmentSchema,
  VideoSnapshotSchema,
  VideoSourceSchema,
} from "@/contracts";
import {
  makeCandidateExpression,
  makeEvaluationResult,
  makeGeneratedArtifact,
  makeKnowledgeJob,
  makePracticeTask,
} from "../factories/practice";
import {
  makeSavedItemInput,
  makeSavedVideoItem,
  makeVideoSavedItemInput,
  makeVideoSource,
} from "../factories/source";

const baseSave = {
  clientEventId: "00000000-0000-4000-8000-000000000101",
  youtubeVideoId: "dQw4w9WgXcQ",
  capturedAt: "2026-08-16T10:00:00.000Z",
};

describe("shared contracts", () => {
  it("returns the single canonical YouTube watch URL unchanged", () => {
    const canonicalUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

    expect(CanonicalYouTubeUrlSchema.parse(canonicalUrl)).toBe(canonicalUrl);
  });

  it.each([
    " https://www.youtube.com/watch?v=dQw4w9WgXcQ ",
    "https://www.youtube.com/foo/../watch?v=dQw4w9WgXcQ",
    "https://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com:443/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXc%51",
  ])("rejects a raw YouTube URL that only normalizes to canonical form: %s", (url) => {
    expect(CanonicalYouTubeUrlSchema.safeParse(url).success).toBe(false);
  });

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
        requestNativeSnapshot: true,
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

  it("accepts the frozen Batch A video-save snapshot request", () => {
    const save = makeVideoSavedItemInput();

    expect(SavedItemInputSchema.parse(save)).toEqual(save);
  });

  it.each([
    ["input", SavedItemInputSchema, makeVideoSavedItemInput()],
    ["persisted item", SavedItemSchema, makeSavedVideoItem()],
  ])("rejects requestNativeTranscript on a video %s", (_label, schema, value) => {
    const legacyValue = { ...value, requestNativeTranscript: true };
    Reflect.deleteProperty(legacyValue, "requestNativeSnapshot");

    expect(schema.safeParse(legacyValue).success).toBe(false);
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

  it("preserves video snapshot title and channel byte-for-byte", () => {
    const snapshot = {
      id: "00000000-0000-4000-8000-000000000011",
      sourceId: "00000000-0000-4000-8000-000000000001",
      title: " \t中文访谈\n",
      channel: "  中文频道  ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      durationSeconds: 213,
      description: "一段中文访谈。",
      transcriptLanguage: "zh-CN",
      transcriptHash: "hash-1",
      capturedAt: "2026-08-16T10:00:00.000Z",
    };

    expect(VideoSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("preserves video save title and channel byte-for-byte", () => {
    const save = {
      ...baseSave,
      kind: "video" as const,
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: " \t中文访谈\n",
      channel: "  中文频道  ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      durationSeconds: 213,
      description: "一段中文访谈。",
      currentTimeSeconds: 42,
      requestNativeSnapshot: true as const,
    };

    expect(SavedItemInputSchema.parse(save)).toEqual(save);
  });

  it("exports and preserves the exact derived YouTube thumbnail URL", async () => {
    const contracts = await import("@/contracts");
    const schema = Reflect.get(contracts, "YouTubeThumbnailUrlSchema") as
      | { parse: (value: string) => string }
      | undefined;
    const thumbnailUrl = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";

    expect(schema).toBeDefined();
    expect(schema?.parse(thumbnailUrl)).toBe(thumbnailUrl);
  });

  it("preserves the exact derived thumbnail on snapshots and video saves", () => {
    const thumbnailUrl = "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg";
    const snapshot = {
      id: "00000000-0000-4000-8000-000000000011",
      sourceId: "00000000-0000-4000-8000-000000000001",
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl,
      durationSeconds: 213,
      description: "一段中文访谈。",
      transcriptLanguage: "zh-CN",
      transcriptHash: "hash-1",
      capturedAt: "2026-08-16T10:00:00.000Z",
    };
    const save = {
      ...baseSave,
      kind: "video" as const,
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl,
      durationSeconds: 213,
      description: "一段中文访谈。",
      currentTimeSeconds: 42,
      requestNativeSnapshot: true as const,
    };

    expect(VideoSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(SavedItemInputSchema.parse(save)).toEqual(save);
  });

  it.each([
    ["unrelated host", "https://example.com/vi/dQw4w9WgXcQ/hqdefault.jpg"],
    ["HTTP", "http://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"],
    ["data scheme", "data:image/jpeg;base64,AAAA"],
    ["javascript scheme", "javascript:alert(1)"],
    ["alternate path", "https://i.ytimg.com/video/dQw4w9WgXcQ/hqdefault.jpg"],
    ["alternate size", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"],
    ["short video ID", "https://i.ytimg.com/vi/short/hqdefault.jpg"],
    ["encoded video ID", "https://i.ytimg.com/vi/dQw4w9WgXc%51/hqdefault.jpg"],
    ["query", "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg?size=large"],
    ["fragment", "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg#preview"],
    ["padding", " https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg "],
  ])("rejects a %s thumbnail URL", (_label, thumbnailUrl) => {
    const snapshot = {
      id: "00000000-0000-4000-8000-000000000011",
      sourceId: "00000000-0000-4000-8000-000000000001",
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl,
      durationSeconds: 213,
      description: "一段中文访谈。",
      transcriptLanguage: "zh-CN",
      transcriptHash: "hash-1",
      capturedAt: "2026-08-16T10:00:00.000Z",
    };

    expect(
      VideoSnapshotSchema.safeParse(snapshot).success,
    ).toBe(false);
  });

  it.each([
    ["input", SavedItemInputSchema, makeVideoSavedItemInput()],
    ["persisted item", SavedItemSchema, makeSavedVideoItem()],
  ])("rejects a thumbnail video-ID mismatch on a video %s", (_label, schema, value) => {
    expect(
      schema.safeParse({
        ...value,
        thumbnailUrl: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
      }).success,
    ).toBe(false);
  });

  it("preserves the bilingual practice roles byte-for-byte", () => {
    const task = makePracticeTask({
      promptChinese: " \t你的朋友刚遇到一件很离谱的事。\n",
      instructionsEnglish: "  Respond naturally in Chinese.  ",
      goalEnglish: "\nUse the target expression in context.\t",
    });

    expect(PracticeTaskSchema.parse(task)).toEqual(task);
  });

  it.each(["promptChinese", "instructionsEnglish", "goalEnglish"] as const)(
    "requires the practice %s role",
    (field) => {
      const incompleteTask = { ...makePracticeTask() };
      Reflect.deleteProperty(incompleteTask, field);

      expect(PracticeTaskSchema.safeParse(incompleteTask).success).toBe(false);
    },
  );

  it("rejects an English-only Chinese practice prompt", () => {
    expect(
      PracticeTaskSchema.safeParse(
        makePracticeTask({ promptChinese: "React to an unreasonable taxi price." }),
      ).success,
    ).toBe(false);
  });

  it("rejects legacy practice fields and model answers", () => {
    expect(
      PracticeTaskSchema.safeParse({
        ...makePracticeTask(),
        promptEnglish: "React to a friend.",
        contextEnglish: "You are chatting informally.",
      }).success,
    ).toBe(false);
    expect(
      PracticeTaskSchema.safeParse({
        ...makePracticeTask(),
        modelAnswerChinese: "这也太离谱了吧。",
      }).success,
    ).toBe(false);
  });

  it("preserves all three evaluation dimensions and feedback byte-for-byte", () => {
    const evaluation = makeEvaluationResult({
      accuracy: {
        score: 5,
        englishFeedback: " \tThe expression is accurate.\n",
      },
      naturalness: {
        score: 4,
        englishFeedback: "  The response sounds natural.  ",
      },
      contextualFit: {
        score: 5,
        englishFeedback: "\nThe expression fits this situation.\t",
      },
    });

    expect(EvaluationResultSchema.parse(evaluation)).toEqual(evaluation);
  });

  it.each(["accuracy", "naturalness", "contextualFit"] as const)(
    "requires the %s evaluation dimension",
    (dimension) => {
      const incompleteEvaluation = { ...makeEvaluationResult() };
      Reflect.deleteProperty(incompleteEvaluation, dimension);

      expect(EvaluationResultSchema.safeParse(incompleteEvaluation).success).toBe(false);
    },
  );

  it("rejects the legacy aggregate evaluation fields", () => {
    expect(
      EvaluationResultSchema.safeParse({
        passed: true,
        score: 0.98,
        englishFeedback: "That sounded natural.",
        independentUse: true,
        assistanceLevel: "none",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["accuracy", 0],
    ["naturalness", 6],
    ["contextualFit", 1.5],
  ] as const)("rejects an invalid %s evaluation score of %s", (dimension, score) => {
    const evaluation = makeEvaluationResult();

    expect(
      EvaluationResultSchema.safeParse({
        ...evaluation,
        [dimension]: { ...evaluation[dimension], score },
      }).success,
    ).toBe(false);
  });

  it.each(["accuracy", "naturalness", "contextualFit"] as const)(
    "keeps the %s evaluation dimension strict",
    (dimension) => {
      const evaluation = makeEvaluationResult();

      expect(
        EvaluationResultSchema.safeParse({
          ...evaluation,
          [dimension]: { ...evaluation[dimension], extra: true },
        }).success,
      ).toBe(false);
    },
  );

  it("preserves valid Basic Latin English prose byte-for-byte", () => {
    const english = " \tA clear explanation: score 5/5!\n";

    expect(EnglishTextSchema.parse(english)).toBe(english);
    expect(NativeLanguageSchema.parse("en")).toBe("en");
    expect(NativeLanguageSchema.safeParse("es").success).toBe(false);
  });

  it.each([
    ["accented Spanish", "Una explicación clara."],
    ["Cyrillic", "English intro: Это объяснение."],
    ["Han", "This means 很自然。"],
  ])("rejects %s in English explanations and feedback", (_label, value) => {
    const evaluation = makeEvaluationResult({
      accuracy: {
        score: 5,
        englishFeedback: value,
      },
    });

    expect(EnglishTextSchema.safeParse(value).success).toBe(false);
    expect(
      CandidateExpressionSchema.safeParse(
        makeCandidateExpression({ englishExplanation: value }),
      ).success,
    ).toBe(false);
    expect(EvaluationResultSchema.safeParse(evaluation).success).toBe(false);
  });

  it("preserves API failure messages byte-for-byte", () => {
    const failure = {
      ok: false as const,
      error: {
        code: "SYNC_RETRYING" as const,
        message: " \tThe save is queued for another attempt.\n",
        retryable: true,
      },
      requestId: "request-2",
    };

    expect(ApiFailureSchema.parse(failure)).toEqual(failure);
  });

  it("rejects raw values that exceed public text limits despite surrounding whitespace", () => {
    const overlongTitle = ` ${"中".repeat(300)} `;
    const overlongPrompt = ` ${"A".repeat(1_000)} `;
    const overlongChinesePrompt = "中".repeat(2_001);
    const overlongGoal = "A".repeat(1_001);
    const overlongMessage = ` ${"A".repeat(500)} `;

    expect(
      VideoSnapshotSchema.safeParse({
        id: "00000000-0000-4000-8000-000000000011",
        sourceId: "00000000-0000-4000-8000-000000000001",
        title: overlongTitle,
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        durationSeconds: 213,
        description: "一段中文访谈。",
        transcriptLanguage: "zh-CN",
        transcriptHash: "hash-1",
        capturedAt: "2026-08-16T10:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      PracticeTaskSchema.safeParse(
        makePracticeTask({ instructionsEnglish: overlongPrompt }),
      ).success,
    ).toBe(false);
    expect(
      PracticeTaskSchema.safeParse(
        makePracticeTask({ promptChinese: overlongChinesePrompt }),
      ).success,
    ).toBe(false);
    expect(
      PracticeTaskSchema.safeParse(makePracticeTask({ goalEnglish: overlongGoal })).success,
    ).toBe(false);
    expect(
      ApiFailureSchema.safeParse({
        ok: false,
        error: {
          code: "SYNC_RETRYING",
          message: overlongMessage,
          retryable: true,
        },
        requestId: "request-2",
      }).success,
    ).toBe(false);
  });

  it("preserves candidate evidence and its English explanation byte-for-byte", () => {
    const candidate = makeCandidateExpression({
      evidenceText: " \t这也太离谱了吧。\n",
      englishExplanation: "  An emphatic reaction to something unreasonable.  ",
    });

    expect(CandidateExpressionSchema.parse(candidate)).toEqual(candidate);
  });

  it("round-trips a user-owned artifact with its deterministic SHA-256 result key", () => {
    const artifact = makeGeneratedArtifact();

    expect(GeneratedArtifactSchema.parse(artifact)).toEqual(artifact);
  });

  it("round-trips a knowledge job with its deterministic SHA-256 dedupe key", () => {
    const job = makeKnowledgeJob();

    expect(KnowledgeJobSchema.parse(job)).toEqual(job);
  });

  it("requires artifact ownership and its deterministic SHA-256 result key", () => {
    const artifact = makeGeneratedArtifact();
    const artifactWithoutOwner = { ...artifact };
    const artifactWithoutResultKey = { ...artifact };
    Reflect.deleteProperty(artifactWithoutOwner, "userId");
    Reflect.deleteProperty(artifactWithoutResultKey, "resultKey");

    expect(GeneratedArtifactSchema.safeParse(artifactWithoutOwner).success).toBe(false);
    expect(GeneratedArtifactSchema.safeParse(artifactWithoutResultKey).success).toBe(false);
  });

  it("requires a knowledge job deterministic SHA-256 dedupe key", () => {
    const jobWithoutKey = { ...makeKnowledgeJob() };
    Reflect.deleteProperty(jobWithoutKey, "dedupeKey");

    expect(KnowledgeJobSchema.safeParse(jobWithoutKey).success).toBe(false);
  });

  it.each(["g".repeat(64), "A".repeat(64), "a".repeat(63), "a".repeat(65)])(
    "rejects malformed or non-lowercase SHA-256 key %s",
    (key) => {
      expect(
        GeneratedArtifactSchema.safeParse(makeGeneratedArtifact({ resultKey: key })).success,
      ).toBe(false);
      expect(KnowledgeJobSchema.safeParse(makeKnowledgeJob({ dedupeKey: key })).success).toBe(
        false,
      );
    },
  );

  it("rejects null deterministic SHA-256 keys", () => {
    expect(
      GeneratedArtifactSchema.safeParse({ ...makeGeneratedArtifact(), resultKey: null }).success,
    ).toBe(false);
    expect(
      KnowledgeJobSchema.safeParse({ ...makeKnowledgeJob(), dedupeKey: null }).success,
    ).toBe(false);
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
        requestNativeSnapshot: true,
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
        requestNativeSnapshot: true,
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
        requestNativeSnapshot: true,
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
    expect(makeVideoSavedItemInput()).toEqual(makeVideoSavedItemInput());
    expect(makeSavedVideoItem()).toEqual(makeSavedVideoItem());
    expect(makeCandidateExpression()).toEqual(makeCandidateExpression());
    expect(makePracticeTask()).toEqual(makePracticeTask());
    expect(makeEvaluationResult()).toEqual(makeEvaluationResult());
    expect(makeGeneratedArtifact()).toEqual(makeGeneratedArtifact());
    expect(makeKnowledgeJob()).toEqual(makeKnowledgeJob());
  });
});
