import type { SavedItemAnalysisEvidence } from "@/server/jobs/job-types";
import { ModelGatewayError } from "@/server/ai/provider";
import type {
  StructuredJsonCompletionOptions,
  StructuredJsonGateway,
} from "@/server/ai/structured-json-gateway";

export const ANALYZE_SAVED_ITEM_PROMPT_VERSION = "analyze-saved-item-v1";

export function buildAnalyzeSavedItemPrompt(evidence: SavedItemAnalysisEvidence): string {
  return [
    "You help an English-speaking learner understand and reuse Mandarin from one saved YouTube moment.",
    "Return JSON only: {\"candidates\":[...]}, with one to three candidates.",
    "Each candidate must include expression, englishMeaning, englishExplanation, tone, communicativeFunction, register, evidenceText, segmentIds, startSeconds, endSeconds, and confidence.",
    "Use only the supplied native Simplified Chinese evidence. Copy evidenceText exactly from the referenced segments. Use the exact minimum startSeconds and maximum endSeconds of those segments. Never invent evidence or analyze the whole video.",
    JSON.stringify({
      savedItem: {
        id: evidence.savedItemId,
        kind: evidence.kind,
        rawText: evidence.rawText,
        startSeconds: evidence.startSeconds,
      },
      segments: evidence.segments,
    }),
  ].join("\n");
}

export function createAnalyzeSavedItemFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/saved-analysis-v1",
    async complete<T>(
      _promptVersion: string,
      prompt: string,
      options: StructuredJsonCompletionOptions<T>,
    ): Promise<T> {
      const serializedEvidence = prompt.slice(prompt.lastIndexOf("\n") + 1);
      const parsed = JSON.parse(serializedEvidence) as {
        readonly segments?: readonly {
          readonly stableId?: unknown;
          readonly originalChinese?: unknown;
          readonly startSeconds?: unknown;
          readonly endSeconds?: unknown;
        }[];
      };
      const segment = parsed.segments?.[0];
      if (
        !segment ||
        typeof segment.stableId !== "string" ||
        typeof segment.originalChinese !== "string" ||
        typeof segment.startSeconds !== "number" ||
        typeof segment.endSeconds !== "number"
      ) {
        throw new TypeError("fixture requires one bounded persisted transcript segment");
      }
      const evidenceText = segment.originalChinese.slice(0, 2_000);
      const output = {
        candidates: [{
          expression: evidenceText.slice(0, 200),
          englishMeaning: "Meaning from this saved Mandarin moment.",
          englishExplanation: "A deterministic CI explanation grounded in the supplied subtitle.",
          tone: "Context-dependent spoken Mandarin.",
          communicativeFunction: "Reusing language from the saved moment.",
          register: "Spoken Mandarin.",
          evidenceText,
          segmentIds: [segment.stableId],
          startSeconds: segment.startSeconds,
          endSeconds: segment.endSeconds,
          confidence: 1,
        }],
      };
      const decoded = options.normalize(output);
      if (!decoded.success) {
        throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", decoded.fieldPath);
      }
      return decoded.data;
    },
  };
}
