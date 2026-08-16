import { z } from "zod";

export const NativeLanguageSchema = z.literal("en");
export const TargetLanguageSchema = z.literal("zh-CN");

export const YouTubeVideoIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{11}$/, "Expected an 11-character YouTube video ID");

export const CanonicalYouTubeUrlSchema = z
  .string()
  .max(200)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "www.youtube.com" &&
        url.pathname === "/watch" &&
        url.username === "" &&
        url.password === "" &&
        url.port === "" &&
        url.hash === "" &&
        url.searchParams.size === 1 &&
        YouTubeVideoIdSchema.safeParse(url.searchParams.get("v")).success
      );
    } catch {
      return false;
    }
  }, "Expected a canonical https://www.youtube.com/watch?v=... URL")
  .refine((value) => {
    try {
      const url = new URL(value);
      const videoId = url.searchParams.get("v");

      return (
        YouTubeVideoIdSchema.safeParse(videoId).success &&
        value === `https://www.youtube.com/watch?v=${videoId}`
      );
    } catch {
      return false;
    }
  }, "Expected a canonical https://www.youtube.com/watch?v=... URL");

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const SecondSchema = z.number().finite().min(0).max(604_800);
const OffsetSchema = z.number().int().min(0).max(100_000);
const NonblankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, "Expected a nonblank string");
export const StableSegmentIdSchema = z
  .string()
  .min(1)
  .max(200)
  .refine(
    (value) => value.trim().length > 0 && value.trim() === value,
    "Expected a nonblank segment ID without surrounding whitespace",
  );
export const TargetChineseTextSchema = z
  .string()
  .min(1)
  .max(10_000)
  .refine((value) => value.trim().length > 0, "Expected nonblank Chinese text")
  .refine((value) => /\p{Script=Han}/u.test(value), "Expected Chinese text");
const isBasicLatinAsciiProse = (value: string) =>
  /[A-Za-z]/.test(value) &&
  [...value].every((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      ((codePoint >= 0x09 && codePoint <= 0x0d) ||
        (codePoint >= 0x20 && codePoint <= 0x7e))
    );
  });
export const EnglishTextSchema = z
  .string()
  .min(1)
  .max(10_000)
  .refine((value) => value.trim().length > 0, "Expected nonblank English text")
  .refine(isBasicLatinAsciiProse, "Expected Basic Latin/ASCII English prose");
const RawThumbnailUrlSchema = z
  .string()
  .min(1)
  .max(2_048)
  .refine((value) => value.trim() === value, "Expected a URL without surrounding whitespace")
  .refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "Expected a valid URL");
const SegmentIdsSchema = z.array(StableSegmentIdSchema).min(1).max(32);
const ContextSchema = z.array(TargetChineseTextSchema.max(2_000)).max(3);

export const VideoSourceSchema = z
  .strictObject({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    youtubeVideoId: YouTubeVideoIdSchema,
    canonicalUrl: CanonicalYouTubeUrlSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .refine(
    (source) => new URL(source.canonicalUrl).searchParams.get("v") === source.youtubeVideoId,
    {
      path: ["canonicalUrl"],
      message: "Canonical URL must match youtubeVideoId",
    },
  );

export const VideoSnapshotSchema = z.strictObject({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  title: NonblankStringSchema.max(300),
  channel: NonblankStringSchema.max(200),
  thumbnailUrl: RawThumbnailUrlSchema,
  durationSeconds: SecondSchema,
  description: z.string().max(5_000),
  transcriptLanguage: TargetLanguageSchema,
  transcriptHash: NonblankStringSchema.max(200),
  capturedAt: IsoDateTimeSchema,
});

export const TranscriptSegmentSchema = z
  .strictObject({
    id: StableSegmentIdSchema,
    snapshotId: z.string().uuid(),
    position: z.number().int().min(0).max(100_000),
    startSeconds: SecondSchema,
    endSeconds: SecondSchema,
    originalChinese: TargetChineseTextSchema,
    englishTranslation: EnglishTextSchema.optional(),
  })
  .refine((segment) => segment.endSeconds >= segment.startSeconds, {
    path: ["endSeconds"],
    message: "endSeconds must not precede startSeconds",
  });

export const SavedItemKindSchema = z.enum([
  "video",
  "player_moment",
  "subtitle_row",
  "subtitle_selection",
  "key_quote",
  "ai_explanation",
]);

export const SavedItemStatusSchema = z.enum([
  "saved",
  "resolving_source",
  "organizing",
  "ready",
  "unsupported",
  "failed",
]);

const saveInputBase = {
  clientEventId: z.string().uuid(),
  youtubeVideoId: YouTubeVideoIdSchema,
  capturedAt: IsoDateTimeSchema,
};

const saveVariants = {
  video: {
    kind: z.literal("video"),
    canonicalUrl: CanonicalYouTubeUrlSchema,
    title: NonblankStringSchema.max(300),
    channel: NonblankStringSchema.max(200),
    thumbnailUrl: RawThumbnailUrlSchema,
    durationSeconds: SecondSchema,
    description: z.string().max(5_000),
    currentTimeSeconds: SecondSchema,
    requestNativeTranscript: z.literal(true),
  },
  playerMoment: {
    kind: z.literal("player_moment"),
    capturedSecond: SecondSchema,
  },
  subtitleRow: {
    kind: z.literal("subtitle_row"),
    segmentId: StableSegmentIdSchema,
    originalChinese: TargetChineseTextSchema,
    englishTranslation: EnglishTextSchema.optional(),
    startSeconds: SecondSchema,
    endSeconds: SecondSchema,
    contextBefore: ContextSchema,
    contextAfter: ContextSchema,
  },
  subtitleSelection: {
    kind: z.literal("subtitle_selection"),
    originalChinese: TargetChineseTextSchema,
    englishTranslation: EnglishTextSchema.optional(),
    segmentIds: SegmentIdsSchema,
    startSeconds: SecondSchema,
    endSeconds: SecondSchema,
    startOffset: OffsetSchema,
    endOffset: OffsetSchema,
    contextBefore: ContextSchema,
    contextAfter: ContextSchema,
  },
  keyQuote: {
    kind: z.literal("key_quote"),
    exactQuote: TargetChineseTextSchema,
    quoteSeconds: SecondSchema,
    segmentIds: SegmentIdsSchema,
  },
  aiExplanation: {
    kind: z.literal("ai_explanation"),
    selectedChinese: TargetChineseTextSchema,
    englishExplanation: EnglishTextSchema,
    segmentIds: SegmentIdsSchema,
    startSeconds: SecondSchema,
    endSeconds: SecondSchema,
    contextBefore: ContextSchema,
    contextAfter: ContextSchema,
  },
};

export const SavedItemInputSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ ...saveInputBase, ...saveVariants.video }),
    z.strictObject({ ...saveInputBase, ...saveVariants.playerMoment }),
    z.strictObject({ ...saveInputBase, ...saveVariants.subtitleRow }),
    z.strictObject({ ...saveInputBase, ...saveVariants.subtitleSelection }),
    z.strictObject({ ...saveInputBase, ...saveVariants.keyQuote }),
    z.strictObject({ ...saveInputBase, ...saveVariants.aiExplanation }),
  ])
  .superRefine((save, context) => {
    if (
      save.kind === "video" &&
      new URL(save.canonicalUrl).searchParams.get("v") !== save.youtubeVideoId
    ) {
      context.addIssue({
        code: "custom",
        path: ["canonicalUrl"],
        message: "Canonical URL must match youtubeVideoId",
      });
    }
    if ("endSeconds" in save && save.endSeconds < save.startSeconds) {
      context.addIssue({
        code: "custom",
        path: ["endSeconds"],
        message: "endSeconds must not precede startSeconds",
      });
    }
    if (save.kind === "subtitle_selection" && save.endOffset <= save.startOffset) {
      context.addIssue({
        code: "custom",
        path: ["endOffset"],
        message: "endOffset must be greater than startOffset",
      });
    }
  });

const savedItemBase = {
  ...saveInputBase,
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sourceId: z.string().uuid(),
  snapshotId: z.string().uuid().nullable(),
  status: SavedItemStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
};

export const SavedItemSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ ...savedItemBase, ...saveVariants.video }),
    z.strictObject({ ...savedItemBase, ...saveVariants.playerMoment }),
    z.strictObject({ ...savedItemBase, ...saveVariants.subtitleRow }),
    z.strictObject({ ...savedItemBase, ...saveVariants.subtitleSelection }),
    z.strictObject({ ...savedItemBase, ...saveVariants.keyQuote }),
    z.strictObject({ ...savedItemBase, ...saveVariants.aiExplanation }),
  ])
  .superRefine((save, context) => {
    if (
      save.kind === "video" &&
      new URL(save.canonicalUrl).searchParams.get("v") !== save.youtubeVideoId
    ) {
      context.addIssue({
        code: "custom",
        path: ["canonicalUrl"],
        message: "Canonical URL must match youtubeVideoId",
      });
    }
    if ("endSeconds" in save && save.endSeconds < save.startSeconds) {
      context.addIssue({
        code: "custom",
        path: ["endSeconds"],
        message: "endSeconds must not precede startSeconds",
      });
    }
    if (save.kind === "subtitle_selection" && save.endOffset <= save.startOffset) {
      context.addIssue({
        code: "custom",
        path: ["endOffset"],
        message: "endOffset must be greater than startOffset",
      });
    }
  });

export type VideoSource = z.infer<typeof VideoSourceSchema>;
export type VideoSnapshot = z.infer<typeof VideoSnapshotSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type SavedItemKind = z.infer<typeof SavedItemKindSchema>;
export type SavedItemStatus = z.infer<typeof SavedItemStatusSchema>;
export type SavedItem = z.infer<typeof SavedItemSchema>;
export type SavedItemInput = z.infer<typeof SavedItemInputSchema>;
