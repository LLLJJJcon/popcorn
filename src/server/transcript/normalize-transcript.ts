import { createHash } from "node:crypto";

import type {
  NativeTranscriptSegment,
  NativeTranscriptSnapshot,
} from "./provider";

const ACCEPTED_LANGUAGES = new Set(["zh", "zh-CN", "zh-Hans"]);
const MAX_CHUNKS = 20_000;
const MAX_CHUNK_TEXT_LENGTH = 10_000;
const MAX_TOTAL_TEXT_LENGTH = 1_000_000;
const MAX_MILLISECONDS = 604_800_000;

export class NativeTranscriptError extends Error {
  constructor(
    message: string,
    readonly reason: "empty" | "language" | "invalid",
  ) {
    super(message);
    this.name = "NativeTranscriptError";
  }
}

type ProviderChunk = {
  readonly text: string;
  readonly offset: number;
  readonly duration: number;
  readonly lang?: string;
};

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requireNativeLanguage(value: unknown): asserts value is string {
  if (typeof value !== "string" || !ACCEPTED_LANGUAGES.has(value)) {
    throw new NativeTranscriptError(
      "Provider output is not native Simplified Chinese",
      "language",
    );
  }
}

function parseChunk(value: unknown, aggregateLanguage: string): ProviderChunk {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new NativeTranscriptError("Transcript chunk must be an object", "invalid");
  }
  const chunk = value as Record<string, unknown>;
  if (typeof chunk.text !== "string" || chunk.text.length > MAX_CHUNK_TEXT_LENGTH) {
    throw new NativeTranscriptError("Transcript chunk text is invalid", "invalid");
  }
  if (
    typeof chunk.offset !== "number" ||
    !Number.isFinite(chunk.offset) ||
    chunk.offset < 0 ||
    chunk.offset > MAX_MILLISECONDS
  ) {
    throw new NativeTranscriptError("Transcript chunk offset is invalid", "invalid");
  }
  if (
    typeof chunk.duration !== "number" ||
    !Number.isFinite(chunk.duration) ||
    chunk.duration < 0 ||
    chunk.duration > MAX_MILLISECONDS
  ) {
    throw new NativeTranscriptError("Transcript chunk duration is invalid", "invalid");
  }
  const language = chunk.lang ?? aggregateLanguage;
  requireNativeLanguage(language);
  return {
    text: chunk.text,
    offset: chunk.offset,
    duration: chunk.duration,
    lang: language,
  };
}

function canonicalSnapshotIdentity(
  segments: readonly Omit<NativeTranscriptSegment, "stableId">[],
): string {
  return JSON.stringify([
    "popcorn-native-transcript-v1",
    ...segments.map((segment) => [
      segment.position,
      segment.startSeconds,
      segment.endSeconds,
      segment.originalChinese,
      segment.language,
    ]),
  ]);
}

function stableId(
  transcriptHash: string,
  segment: Omit<NativeTranscriptSegment, "stableId">,
): string {
  const textHash = hash(segment.originalChinese);
  return hash(
    JSON.stringify([
      "popcorn-transcript-segment-v1",
      transcriptHash,
      segment.position,
      segment.startSeconds,
      segment.endSeconds,
      textHash,
    ]),
  );
}

function timestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function normalizeNativeTranscript(value: unknown): NativeTranscriptSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new NativeTranscriptError("Transcript response must be an object", "invalid");
  }
  const payload = value as Record<string, unknown>;
  requireNativeLanguage(payload.lang);
  if (!Array.isArray(payload.content) || payload.content.length > MAX_CHUNKS) {
    throw new NativeTranscriptError("Transcript content is invalid", "invalid");
  }

  const unkeyed: Omit<NativeTranscriptSegment, "stableId">[] = [];
  let totalTextLength = 0;
  for (const rawChunk of payload.content) {
    const chunk = parseChunk(rawChunk, payload.lang);
    const originalChinese = chunk.text.replace(/>> ?/g, "").trim();
    if (originalChinese.length === 0) continue;
    totalTextLength += originalChinese.length;
    if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
      throw new NativeTranscriptError("Transcript text is oversized", "invalid");
    }
    if (!/\p{Script=Han}/u.test(originalChinese)) {
      throw new NativeTranscriptError("Expected Chinese text in every transcript chunk", "language");
    }

    const startSeconds = Math.floor(chunk.offset / 1_000);
    const durationSeconds = Math.floor(chunk.duration / 1_000);
    const endSeconds = startSeconds + durationSeconds;
    if (endSeconds > 604_800) {
      throw new NativeTranscriptError("Transcript chunk duration exceeds video bounds", "invalid");
    }
    unkeyed.push({
      position: unkeyed.length,
      originalChinese,
      startSeconds,
      endSeconds,
      language: "zh-CN",
    });
  }

  if (unkeyed.length === 0) {
    throw new NativeTranscriptError("Provider returned an empty transcript", "empty");
  }

  const transcriptHash = hash(canonicalSnapshotIdentity(unkeyed));
  const segments = unkeyed.map((segment) => ({
    ...segment,
    stableId: stableId(transcriptHash, segment),
  }));

  return {
    language: "zh-CN",
    transcriptHash,
    segments,
    plainText: segments.map((segment) => segment.originalChinese).join(" "),
    timestampedText: segments
      .map(
        (segment) =>
          `[${timestamp(segment.startSeconds)}] ${segment.originalChinese}`,
      )
      .join("\n"),
  };
}
