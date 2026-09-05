import { z } from "zod";

import {
  ModelGatewayError,
  validateOverviewContent,
  type LearningArtifactEvidence,
  type LearningArtifactProvider,
} from "@/server/ai/provider";
import {
  extractUniqueSemanticObject,
  type ModelOutputStage,
  type WireNormalizer,
} from "@/server/ai/model-output";
import type { StructuredJsonCompletionOptions } from "@/server/ai/structured-json-gateway";
import {
  buildExplanationPrompt,
  ExplanationContentSchema,
  EXPLAIN_SELECTION_PROMPT_VERSION,
} from "@/server/ai/prompts/explain-selection.v1";
import {
  buildTranslationPrompt,
  TRANSLATE_SEGMENTS_PROMPT_VERSION,
  TranslationContentSchema,
} from "@/server/ai/prompts/translate-segments.v1";
import {
  buildOverviewPrompt,
  OverviewContentSchema,
  type OverviewContent,
  YOUTUBE_OVERVIEW_PROMPT_VERSION,
} from "@/server/ai/prompts/youtube-overview.v1";
import type { ModelGatewayRuntimeConfig } from "@/server/model-gateway/runtime-resolver";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_OVERVIEW_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_REQUEST_BYTES = 65_536;
const DEFAULT_MAX_RESPONSE_BYTES = 524_288;
const OVERVIEW_MAX_TOKENS = 900;

const GatewayEnvelopeSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      role: z.literal("assistant"),
      content: z.string().min(1),
    }).passthrough(),
  }).passthrough()).length(1),
}).passthrough();

const SegmentIndexSchema = z.number().int().nonnegative();
const GatewayOverviewSchema = z.object({
  overview: z.string().trim().min(1),
}).passthrough();
const GatewayChapterSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  sourceLineIndex: SegmentIndexSchema,
}).passthrough();
const GatewayQuoteSchema = z.object({
  quote: z.string().trim().min(1),
  englishMeaning: z.string().trim().min(1),
  sourceLineIndex: z.unknown().optional(),
}).passthrough();
const GatewayTranslationSchema = z.strictObject({
  translations: z.array(z.strictObject({
    segmentIndex: SegmentIndexSchema,
    english: z.string(),
  })).min(1),
});

export type OpenAiCompatibleAdapterOptions = {
  readonly config: ModelGatewayRuntimeConfig;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly overviewTimeoutMs?: number;
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
};

export interface StructuredJsonCompletionClient {
  complete<T>(
    promptVersion: string,
    userPrompt: string,
    options: StructuredJsonCompletionOptions<T>,
  ): Promise<T>;
  completeText(
    promptVersion: string,
    userPrompt: string,
    options: StructuredTextCompletionOptions,
  ): Promise<string>;
}

type StructuredTextCompletionOptions = {
  readonly systemPrompt: string;
  readonly timeoutMs: number;
  readonly maxTokens: number;
  readonly maxTransportRetries?: 0 | 1;
};

function outputInvalid(stage: ModelOutputStage = "wire_schema", fieldPath?: string): ModelGatewayError {
  return new ModelGatewayError("PROVIDER_OUTPUT_INVALID", stage, fieldPath);
}

function unavailable(stage: ModelOutputStage = "transport"): ModelGatewayError {
  return new ModelGatewayError("PROVIDER_UNAVAILABLE", stage);
}

function boundedPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value <= 0) throw outputInvalid();
  return value;
}

function requestSegments(
  segments: LearningArtifactEvidence["segments"],
): { segmentIndex: number; originalChinese: string; startSeconds: number; endSeconds: number }[] {
  return segments.map((segment, segmentIndex) => ({
    segmentIndex,
    originalChinese: segment.originalChinese,
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
  }));
}

async function readBoundedResponse(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) throw outputInvalid("response_envelope");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw outputInvalid("response_envelope");
      }
      chunks.push(item.value);
    }
  } catch (error) {
    if (error instanceof ModelGatewayError) throw error;
    if (isAbortError(error)) throw error;
    throw unavailable("transport");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw outputInvalid("response_envelope");
  }
}

function parseAssistantText(text: string): string {
  try {
    const envelope = GatewayEnvelopeSchema.parse(JSON.parse(text));
    const message = envelope.choices[0].message;
    if (
      "tool_calls" in message ||
      "function_call" in message ||
      message.content.trim() === ""
    ) {
      throw outputInvalid("response_envelope");
    }
    return message.content.trim();
  } catch (error) {
    if (error instanceof ModelGatewayError) throw error;
    throw outputInvalid("response_envelope");
  }
}

function unwrapMarkdownFence(text: string): string {
  const match = /^```(?:[\w-]+)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/u.exec(text);
  return (match?.[1] ?? text).trim();
}

function retryAfterMilliseconds(response: Response): number | null {
  const value = response.headers.get("retry-after")?.trim();
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 3) {
    return seconds * 1_000;
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  const delay = date - Date.now();
  return delay >= 0 && delay <= 3_000 ? delay : null;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "name" in error && error.name === "AbortError";
}

function zodNormalizer<T>(schema: z.ZodType<T>): WireNormalizer<T> {
  return (value) => {
    const parsed = schema.safeParse(value);
    if (parsed.success) return { success: true, data: parsed.data };
    const path = parsed.error.issues[0]?.path.join(".");
    return { success: false, ...(path ? { fieldPath: path } : {}) };
  };
}

export function createOpenAiCompatibleStructuredJsonClient(
  options: OpenAiCompatibleAdapterOptions,
): StructuredJsonCompletionClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = boundedPositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const maxRequestBytes = boundedPositiveInteger(
    options.maxRequestBytes,
    DEFAULT_MAX_REQUEST_BYTES,
  );
  const maxResponseBytes = boundedPositiveInteger(
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
  );
  const endpoint = `${options.config.canonicalOrigin}${options.config.basePath}/chat/completions`;

  async function requestAssistantText(
    _promptVersion: string,
    userPrompt: string,
    completionOptions: StructuredTextCompletionOptions,
  ): Promise<string> {
    const body = JSON.stringify({
      model: options.config.model,
      max_tokens: boundedPositiveInteger(completionOptions.maxTokens, 1),
      messages: [
        {
          role: "system",
          content: completionOptions.systemPrompt,
        },
        { role: "user", content: userPrompt },
      ],
    });
    if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
      throw outputInvalid();
    }

    const maxRetries = completionOptions.maxTransportRetries ?? 1;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      let responseReceived = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, boundedPositiveInteger(completionOptions.timeoutMs, timeoutMs));
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${options.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: controller.signal,
        });
        responseReceived = true;
        if (!response.ok) {
          const retryableStatus = [429, 502, 503, 504].includes(response.status);
          if (retryableStatus && attempt < maxRetries) {
            clearTimeout(timer);
            await wait(retryAfterMilliseconds(response) ?? 1_000);
            continue;
          }
          throw unavailable(response.status === 429 ? "rate_limit" : "provider_http");
        }
        return parseAssistantText(await readBoundedResponse(response, maxResponseBytes));
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        if (timedOut || isAbortError(error)) throw unavailable("timeout");
        if (!responseReceived && attempt < maxRetries) {
          clearTimeout(timer);
          await wait(1_000);
          continue;
        }
        throw unavailable("transport");
      } finally {
        clearTimeout(timer);
      }
    }
    throw unavailable("transport");
  }

  async function complete<T>(
    promptVersion: string,
    userPrompt: string,
    completionOptions: StructuredJsonCompletionOptions<T>,
  ): Promise<T> {
    const assistantText = await requestAssistantText(
      promptVersion,
      userPrompt,
      completionOptions,
    );
    const extracted = extractUniqueSemanticObject(assistantText, completionOptions.normalize);
    if (extracted.ok) return extracted.value;
    throw outputInvalid(
      extracted.reason === "wire_schema" ? "wire_schema" : "json_extract",
      extracted.fieldPath,
    );
  }

  function completeText(
    promptVersion: string,
    userPrompt: string,
    completionOptions: StructuredTextCompletionOptions,
  ): Promise<string> {
    return requestAssistantText(promptVersion, userPrompt, completionOptions);
  }

  return { complete, completeText };
}

export function createOpenAiCompatibleLearningArtifactProvider(
  options: OpenAiCompatibleAdapterOptions,
): LearningArtifactProvider {
  const { complete, completeText } = createOpenAiCompatibleStructuredJsonClient(options);
  const artifactTimeoutMs = boundedPositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const overviewTimeoutMs = boundedPositiveInteger(
    options.overviewTimeoutMs,
    DEFAULT_OVERVIEW_TIMEOUT_MS,
  );

  return {
    async generateOverview(evidence) {
      const text = unwrapMarkdownFence(await completeText(
        YOUTUBE_OVERVIEW_PROMPT_VERSION,
        buildOverviewPrompt(evidence.title, evidence.segments),
        {
          systemPrompt: `Popcorn learning artifact task ${YOUTUBE_OVERVIEW_PROMPT_VERSION}. Follow the requested response format.`,
          timeoutMs: overviewTimeoutMs,
          maxTokens: OVERVIEW_MAX_TOKENS,
          maxTransportRetries: 0,
        },
      ));
      try {
        let raw: unknown;
        let parsedJson = true;
        try {
          raw = JSON.parse(text);
        } catch {
          parsedJson = false;
        }
        if (!parsedJson) {
          return validateOverviewContent({ overview: text, chapters: [], keyQuotes: [] }, evidence);
        }
        const gateway = GatewayOverviewSchema.parse(raw);
        const mapSourceLine = (sourceLineIndex: number) => {
          const segment = evidence.segments[sourceLineIndex];
          if (!segment) throw outputInvalid();
          return {
            timestampSeconds: segment.startSeconds,
            sourceSegmentIds: [segment.stableId],
          };
        };
        const chapters: OverviewContent["chapters"] = [];
        const chapterCandidates = Array.isArray(gateway.chapters) ? gateway.chapters : [];
        for (const candidate of chapterCandidates) {
          if (chapters.length === 8) break;
          const parsed = GatewayChapterSchema.safeParse(candidate);
          if (!parsed.success || !evidence.segments[parsed.data.sourceLineIndex]) continue;
          const { sourceLineIndex, title, summary } = parsed.data;
          const grounded = OverviewContentSchema.shape.chapters.element.safeParse({
            title,
            summary,
            ...mapSourceLine(sourceLineIndex),
          });
          if (grounded.success) chapters.push(grounded.data);
        }
        const keyQuotes: OverviewContent["keyQuotes"] = [];
        const quoteCandidates = Array.isArray(gateway.keyQuotes) ? gateway.keyQuotes : [];
        for (const candidate of quoteCandidates) {
          if (keyQuotes.length === 5) break;
          const parsed = GatewayQuoteSchema.safeParse(candidate);
          if (!parsed.success) continue;
          const sourceLineIndex = SegmentIndexSchema.safeParse(parsed.data.sourceLineIndex);
          const requestedSegment = sourceLineIndex.success
            ? evidence.segments[sourceLineIndex.data]
            : undefined;
          const segment = requestedSegment?.originalChinese.includes(parsed.data.quote)
            ? requestedSegment
            : evidence.segments.find((item) => item.originalChinese.includes(parsed.data.quote));
          if (!segment) continue;
          const grounded = OverviewContentSchema.shape.keyQuotes.element.safeParse({
            quote: parsed.data.quote,
            englishMeaning: parsed.data.englishMeaning,
            timestampSeconds: segment.startSeconds,
            sourceSegmentIds: [segment.stableId],
          });
          if (grounded.success) keyQuotes.push(grounded.data);
        }
        return validateOverviewContent(OverviewContentSchema.parse({
          overview: gateway.overview,
          chapters,
          keyQuotes,
        }), evidence);
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        throw outputInvalid();
      }
    },

    async translateSegments(evidence, segmentIds) {
      const evidenceById = new Map(evidence.segments.map((segment) => [segment.stableId, segment]));
      const selected = segmentIds.map((id) => evidenceById.get(id));
      if (selected.some((segment) => !segment) || new Set(segmentIds).size !== segmentIds.length) {
        throw outputInvalid();
      }
      const requested = selected as LearningArtifactEvidence["segments"][number][];
      const raw = await complete(
        TRANSLATE_SEGMENTS_PROMPT_VERSION,
        buildTranslationPrompt(requestSegments(requested)),
        {
          systemPrompt: `Popcorn learning artifact task ${TRANSLATE_SEGMENTS_PROMPT_VERSION}. Return only the requested JSON object.`,
          timeoutMs: artifactTimeoutMs,
          maxTokens: 800,
          normalize: zodNormalizer(GatewayTranslationSchema),
        },
      );
      try {
        const gateway = GatewayTranslationSchema.parse(raw);
        if (
          gateway.translations.length !== segmentIds.length ||
          gateway.translations.some((item, index) => item.segmentIndex !== index)
        ) {
          throw outputInvalid();
        }
        return TranslationContentSchema.parse({
          segments: gateway.translations.map((item, index) => ({
            id: segmentIds[index],
            english: item.english,
          })),
        });
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        throw outputInvalid();
      }
    },

    async explainSelection(_evidence, selection) {
      const raw = await complete(
        EXPLAIN_SELECTION_PROMPT_VERSION,
        buildExplanationPrompt({
          selectedChinese: selection.selectedChinese,
          startSeconds: selection.startSeconds,
          endSeconds: selection.endSeconds,
          context: selection.context,
        }),
        {
          systemPrompt: `Popcorn learning artifact task ${EXPLAIN_SELECTION_PROMPT_VERSION}. Return only the requested JSON object.`,
          timeoutMs: artifactTimeoutMs,
          maxTokens: 500,
          normalize: zodNormalizer(ExplanationContentSchema),
        },
      );
      try {
        const parsed = ExplanationContentSchema.parse(raw);
        if (parsed.selectedChinese !== selection.selectedChinese) throw outputInvalid();
        return parsed;
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        throw outputInvalid();
      }
    },
  };
}
