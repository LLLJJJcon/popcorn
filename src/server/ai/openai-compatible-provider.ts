import { z } from "zod";

import {
  ModelGatewayError,
  validateExplanationContent,
  validateOverviewContent,
  validateTranslationContent,
  type LearningArtifactEvidence,
  type LearningArtifactProvider,
} from "@/server/ai/provider";
import {
  extractUniqueSemanticObject,
  normalizeEnglishPunctuation,
  type ModelOutputStage,
} from "@/server/ai/model-output";
import type { StructuredJsonCompletionOptions } from "@/server/ai/structured-json-gateway";
import {
  buildExplanationPrompt,
  EXPLAIN_SELECTION_PROMPT_VERSION,
  normalizeExplanationWire,
} from "@/server/ai/prompts/explain-selection.v1";
import {
  buildTranslationPrompt,
  normalizeTranslationWire,
  TRANSLATE_SEGMENTS_PROMPT_VERSION,
} from "@/server/ai/prompts/translate-segments.v1";
import {
  buildOverviewPrompt,
  normalizeOverviewWire,
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
): { sourceLineIndex: number; originalChinese: string }[] {
  return segments.map((segment, sourceLineIndex) => ({
    sourceLineIndex,
    originalChinese: segment.originalChinese,
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

function plainOverviewFallback(text: string): OverviewContent | null {
  const trimmed = text.trim();
  if (
    !/[A-Za-z]/u.test(trimmed) ||
    /[\u3400-\u9fff]/u.test(trimmed) ||
    /[\[\]{}]/u.test(trimmed) ||
    /```|~~~/u.test(trimmed)
  ) return null;
  const overview = OverviewContentSchema.shape.overview.safeParse(
    normalizeEnglishPunctuation(trimmed),
  );
  return overview.success
    ? { overview: overview.data, chapters: [], keyQuotes: [] }
    : null;
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
      const prompt = buildOverviewPrompt({
        title: evidence.title,
        sourceLines: requestSegments(evidence.segments),
      });
      const text = await completeText(
        YOUTUBE_OVERVIEW_PROMPT_VERSION,
        prompt.userPrompt,
        {
          systemPrompt: prompt.systemPrompt,
          timeoutMs: overviewTimeoutMs,
          maxTokens: OVERVIEW_MAX_TOKENS,
          maxTransportRetries: 0,
        },
      );
      try {
        const extracted = extractUniqueSemanticObject(text, normalizeOverviewWire);
        if (!extracted.ok) {
          const fallback = plainOverviewFallback(text);
          if (fallback) return validateOverviewContent(fallback, evidence);
          throw outputInvalid(
            extracted.reason === "wire_schema" ? "wire_schema" : "json_extract",
            extracted.fieldPath,
          );
        }
        const gateway = extracted.value;
        const mapSourceLine = (sourceLineIndex: number) => {
          const segment = evidence.segments[sourceLineIndex];
          if (!segment) return null;
          return {
            timestampSeconds: segment.startSeconds,
            sourceSegmentIds: [segment.stableId],
          };
        };
        const chapters: OverviewContent["chapters"] = [];
        for (const { sourceLineIndex, title, summary } of gateway.chapters) {
          const source = mapSourceLine(sourceLineIndex);
          if (!source) continue;
          const grounded = OverviewContentSchema.shape.chapters.element.safeParse({
            title,
            summary,
            ...source,
          });
          if (grounded.success) chapters.push(grounded.data);
        }
        const keyQuotes: OverviewContent["keyQuotes"] = [];
        for (const { sourceLineIndex, quote, englishMeaning } of gateway.keyQuotes) {
          const segment = evidence.segments[sourceLineIndex];
          if (!segment?.originalChinese.includes(quote)) continue;
          const grounded = OverviewContentSchema.shape.keyQuotes.element.safeParse({
            quote,
            englishMeaning,
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
      const prompt = buildTranslationPrompt({ sourceLines: requestSegments(requested) });
      const raw = await complete(
        TRANSLATE_SEGMENTS_PROMPT_VERSION,
        prompt.userPrompt,
        {
          systemPrompt: prompt.systemPrompt,
          timeoutMs: artifactTimeoutMs,
          maxTokens: 800,
          normalize: normalizeTranslationWire,
        },
      );
      try {
        const segments = raw.translations
          .filter((item) => item.sourceLineIndex < segmentIds.length)
          .sort((left, right) => left.sourceLineIndex - right.sourceLineIndex)
          .map((item) => ({
            id: segmentIds[item.sourceLineIndex],
            english: item.english,
          }));
        if (segments.length === 0) throw outputInvalid("grounding", "translations");
        return validateTranslationContent({ segments }, segmentIds);
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        throw outputInvalid("grounding", "translations");
      }
    },

    async explainSelection(_evidence, selection) {
      const prompt = buildExplanationPrompt({
        selectedChinese: selection.selectedChinese,
        contextChinese: selection.context,
      });
      const raw = await complete(
        EXPLAIN_SELECTION_PROMPT_VERSION,
        prompt.userPrompt,
        {
          systemPrompt: prompt.systemPrompt,
          timeoutMs: artifactTimeoutMs,
          maxTokens: 500,
          normalize: normalizeExplanationWire,
        },
      );
      try {
        return validateExplanationContent({
          selectedChinese: selection.selectedChinese,
          ...raw,
        }, selection.selectedChinese);
      } catch (error) {
        if (error instanceof ModelGatewayError) throw error;
        throw outputInvalid("grounding");
      }
    },
  };
}
