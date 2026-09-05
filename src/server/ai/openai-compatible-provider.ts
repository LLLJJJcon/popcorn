import { z } from "zod";

import {
  ModelGatewayError,
  type LearningArtifactEvidence,
  type LearningArtifactProvider,
} from "@/server/ai/provider";
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
  groupOverviewPromptBlocks,
  OverviewContentSchema,
  YOUTUBE_OVERVIEW_PROMPT_VERSION,
} from "@/server/ai/prompts/youtube-overview.v1";
import type { ModelGatewayRuntimeConfig } from "@/server/model-gateway/runtime-resolver";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REQUEST_BYTES = 65_536;
const DEFAULT_MAX_RESPONSE_BYTES = 524_288;

const GatewayEnvelopeSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      role: z.literal("assistant"),
      content: z.string().min(1),
    }).passthrough(),
  }).passthrough()).length(1),
}).passthrough();

const SegmentIndexSchema = z.number().int().nonnegative();
const GatewayOverviewSchema = z.strictObject({
  overview: z.string(),
  chapters: z.array(z.strictObject({
    title: z.string(),
    summary: z.string(),
    timestampSeconds: z.number(),
    sourceBlockIndex: SegmentIndexSchema,
  })),
  keyQuotes: z.array(z.strictObject({
    quote: z.string(),
    englishMeaning: z.string(),
    timestampSeconds: z.number(),
    sourceBlockIndex: SegmentIndexSchema,
  })),
});
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
  readonly maxRequestBytes?: number;
  readonly maxResponseBytes?: number;
};

export interface StructuredJsonCompletionClient {
  complete(promptVersion: string, prompt: string): Promise<unknown>;
}

function outputInvalid(): ModelGatewayError {
  return new ModelGatewayError("PROVIDER_OUTPUT_INVALID");
}

function unavailable(): ModelGatewayError {
  return new ModelGatewayError("PROVIDER_UNAVAILABLE");
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
  if (!response.body) throw outputInvalid();
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
        throw outputInvalid();
      }
      chunks.push(item.value);
    }
  } catch (error) {
    if (error instanceof ModelGatewayError) throw error;
    throw unavailable();
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
    throw outputInvalid();
  }
}

function parseAssistantJson(text: string): unknown {
  try {
    const envelope = GatewayEnvelopeSchema.parse(JSON.parse(text));
    const message = envelope.choices[0].message;
    if (
      "tool_calls" in message ||
      "function_call" in message ||
      message.content.trim() === "" ||
      message.content.trim().startsWith("```")
    ) {
      throw outputInvalid();
    }
    return JSON.parse(message.content);
  } catch (error) {
    if (error instanceof ModelGatewayError) throw error;
    throw outputInvalid();
  }
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

  async function complete(promptVersion: string, prompt: string): Promise<unknown> {
    const body = JSON.stringify({
      model: options.config.model,
      messages: [
        {
          role: "system",
          content: `Popcorn learning artifact task ${promptVersion}. Return only the requested JSON object.`,
        },
        { role: "user", content: prompt },
      ],
    });
    if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
      throw outputInvalid();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
      if (!response.ok) throw unavailable();
      return parseAssistantJson(
        await readBoundedResponse(response, maxResponseBytes),
      );
    } catch (error) {
      if (error instanceof ModelGatewayError) throw error;
      throw unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  return { complete };
}

export function createOpenAiCompatibleLearningArtifactProvider(
  options: OpenAiCompatibleAdapterOptions,
): LearningArtifactProvider {
  const { complete } = createOpenAiCompatibleStructuredJsonClient(options);

  return {
    async generateOverview(evidence) {
      const blocks = groupOverviewPromptBlocks(requestSegments(evidence.segments));
      const raw = await complete(
        YOUTUBE_OVERVIEW_PROMPT_VERSION,
        buildOverviewPrompt(evidence.title, blocks),
      );
      try {
        const gateway = GatewayOverviewSchema.parse(raw);
        const mapBlockIndex = (blockIndex: number): string[] => {
          const block = blocks[blockIndex];
          if (!block) throw outputInvalid();
          return block.segmentIndexes.map((segmentIndex) => {
            const segment = evidence.segments[segmentIndex];
            if (!segment) throw outputInvalid();
            return segment.stableId;
          });
        };
        return OverviewContentSchema.parse({
          overview: gateway.overview,
          chapters: gateway.chapters.map(({ sourceBlockIndex, ...chapter }) => ({
            ...chapter,
            sourceSegmentIds: mapBlockIndex(sourceBlockIndex),
          })),
          keyQuotes: gateway.keyQuotes.map(({ sourceBlockIndex, ...quote }) => ({
            ...quote,
            sourceSegmentIds: mapBlockIndex(sourceBlockIndex),
          })),
        });
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
