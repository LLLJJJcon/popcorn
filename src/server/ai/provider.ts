import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { KnowledgeJobType } from "@/contracts/knowledge";
import { YouTubeVideoIdSchema } from "@/contracts/source";
import { ExplanationContentSchema, type ExplanationContent } from "@/server/ai/prompts/explain-selection.v1";
import { TranslationContentSchema, type TranslationContent } from "@/server/ai/prompts/translate-segments.v1";
import { OverviewContentSchema, type OverviewContent } from "@/server/ai/prompts/youtube-overview.v1";
import { failure, success } from "@/server/api/respond";
import { createJobResultKey } from "@/server/domain/lease-job";
import type { Database, Json } from "@/types/database.generated";

const StableIdSchema = z.string().regex(/^[a-f0-9]{64}$/);
const GatewayFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
const SnapshotIdSchema = z.string().uuid();
const PromptModelSchema = z.string().trim().min(1).max(100);
const MAX_REQUEST_BYTES = 65_536;

const OverviewRequestSchema = z.strictObject({ snapshotId: SnapshotIdSchema });
const TranslationRequestSchema = z.strictObject({
  snapshotId: SnapshotIdSchema,
  segmentIds: z.array(StableIdSchema).min(1).max(4).refine(
    (ids) => new Set(ids).size === ids.length,
    "segment IDs must be unique",
  ),
});
const ExplanationRequestSchema = z.strictObject({
  videoId: YouTubeVideoIdSchema,
  snapshotId: SnapshotIdSchema,
  selectedChinese: z.string().trim().min(1).max(2_000),
  segmentIds: z.array(StableIdSchema).min(1).max(32).refine(
    (ids) => new Set(ids).size === ids.length,
    "segment IDs must be unique",
  ),
  utf16Start: z.number().int().min(0).max(16_000),
  utf16End: z.number().int().min(1).max(16_000),
  startSeconds: z.number().finite().min(0).max(604_800),
  endSeconds: z.number().finite().min(0).max(604_800),
  context: z.string().min(1).max(16_000),
}).superRefine((value, context) => {
  if (value.utf16End <= value.utf16Start || value.endSeconds < value.startSeconds) {
    context.addIssue({ code: "custom", message: "selection range is invalid" });
  }
  if (value.context.slice(value.utf16Start, value.utf16End) !== value.selectedChinese) {
    context.addIssue({ code: "custom", message: "UTF-16 offsets must select exact Chinese" });
  }
});

const JobMetadataSchema = {
  transcriptHash: z.string().regex(/^[a-f0-9]{64}$/),
  promptVersion: PromptModelSchema,
  gatewayConfigId: z.string().uuid(),
  gatewayRevision: z.number().int().positive(),
  gatewayFingerprint: GatewayFingerprintSchema,
};
export const OverviewJobInputSchema = z.strictObject({
  kind: z.literal("generate_overview"),
  snapshotId: SnapshotIdSchema,
  ...JobMetadataSchema,
});
export const TranslationJobInputSchema = z.strictObject({
  kind: z.literal("translate_segments"),
  snapshotId: SnapshotIdSchema,
  segmentIds: TranslationRequestSchema.shape.segmentIds,
  ...JobMetadataSchema,
});
export const ExplanationJobInputSchema = z.strictObject({
  kind: z.literal("explain_selection"),
  snapshotId: SnapshotIdSchema,
  selectedChinese: z.string().trim().min(1).max(2_000),
  segmentIds: z.array(StableIdSchema).min(1).max(32).refine((ids) => new Set(ids).size === ids.length),
  utf16Start: z.number().int().min(0).max(16_000),
  utf16End: z.number().int().min(1).max(16_000),
  startSeconds: z.number().finite().min(0).max(604_800),
  endSeconds: z.number().finite().min(0).max(604_800),
  context: z.string().min(1).max(16_000),
  ...JobMetadataSchema,
});

export type LearningArtifactJobType = Extract<KnowledgeJobType, "generate_overview" | "translate_segments" | "explain_selection">;

export type LearningArtifactEvidence = {
  readonly userId: string;
  readonly sourceId: string;
  readonly videoId: string;
  readonly snapshotId: string;
  readonly transcriptHash: string;
  readonly title: string;
  readonly segments: readonly {
    readonly stableId: string;
    readonly originalChinese: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
  }[];
};

export type ModelGatewayPin = {
  readonly configId: string;
  readonly revision: number;
  readonly fingerprint: string;
};

export type ResolvedLearningArtifactProvider = {
  readonly provider: LearningArtifactProvider;
  readonly model: string;
};

export interface LearningArtifactProviderResolver {
  resolve(
    expectedUserId: string,
    pin: ModelGatewayPin,
  ): Promise<ResolvedLearningArtifactProvider>;
}

export type LearningArtifactRegistration = {
  readonly userId: string;
  readonly sourceId: string;
  readonly jobType: LearningArtifactJobType;
  readonly dedupeKey: string;
  readonly input: Record<string, Json | undefined>;
  readonly gatewayPin: ModelGatewayPin;
  readonly now: string;
};

export interface LearningArtifactRouteStore {
  resolveActiveGatewayPin(expectedUserId: string): Promise<ModelGatewayPin | null>;
  resolveEvidence(expectedUserId: string, videoId: string): Promise<LearningArtifactEvidence | null>;
  register(input: LearningArtifactRegistration): Promise<{ readonly jobId: string; readonly status: string; readonly created: boolean }>;
  readArtifact(expectedUserId: string, jobId: string, sourceId: string, jobType: LearningArtifactJobType): Promise<{ readonly artifactId: string; readonly content: unknown } | null>;
}

export interface LearningArtifactProvider {
  generateOverview(evidence: LearningArtifactEvidence): Promise<unknown>;
  translateSegments(evidence: LearningArtifactEvidence, segmentIds: readonly string[]): Promise<unknown>;
  explainSelection(evidence: LearningArtifactEvidence, selection: LearningArtifactSelection): Promise<unknown>;
}

export type LearningArtifactSelection = {
  readonly selectedChinese: string;
  readonly segmentIds: readonly string[];
  readonly utf16Start: number;
  readonly utf16End: number;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly context: string;
};

export function validateLearningArtifactSelectionEvidence(
  evidence: LearningArtifactEvidence,
  selection: LearningArtifactSelection,
): void {
  const byId = new Map(evidence.segments.map((segment) => [segment.stableId, segment]));
  const selected = selection.segmentIds.map((id) => byId.get(id));
  if (selected.some((segment) => !segment)) {
    throw new Error("selection references unknown persisted evidence");
  }
  const exactSegments = selected as LearningArtifactEvidence["segments"][number][];
  const exactContext = exactSegments.map((segment) => segment.originalChinese).join("\n");
  const earliest = Math.min(...exactSegments.map((segment) => segment.startSeconds));
  const latest = Math.max(...exactSegments.map((segment) => segment.endSeconds));
  if (
    selection.context !== exactContext ||
    selection.context.slice(selection.utf16Start, selection.utf16End) !== selection.selectedChinese ||
    selection.startSeconds !== earliest ||
    selection.endSeconds !== latest
  ) {
    throw new Error("selection is not exact persisted evidence");
  }
}

export type ModelGatewayErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_OUTPUT_INVALID";

export class ModelGatewayError extends Error {
  override readonly name = "ModelGatewayError";

  constructor(readonly code: ModelGatewayErrorCode) {
    super(code);
  }
}

function canonicalPayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalPayload).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalPayload(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function createLearningArtifactJobKey(
  jobType: LearningArtifactJobType,
  transcriptHash: string,
  payload: unknown,
  promptVersion: string,
  gatewayFingerprint: string,
): string {
  const fingerprint = GatewayFingerprintSchema.parse(gatewayFingerprint);
  const savedItemHash = createHash("sha256").update(canonicalPayload(payload)).digest("hex");
  return createJobResultKey({
    jobType,
    sourceHash: transcriptHash,
    savedItemHash,
    promptVersion,
    modelVersion: `gateway:${fingerprint}`,
  });
}

type RouteDependencies = {
  readonly jobType: LearningArtifactJobType;
  readonly authenticate: (request: Request) => Promise<{ readonly userId: string } | null>;
  readonly store: LearningArtifactRouteStore;
  readonly promptVersion: string;
  readonly requestId: () => string;
  readonly now?: () => string;
};
type RouteContext = { readonly params: Promise<{ readonly videoId?: string }> };

function noStoreJson(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function boundedBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) throw new RangeError("request body is too large");
  return JSON.parse(text);
}

function outputSchema(type: LearningArtifactJobType) {
  if (type === "generate_overview") return OverviewContentSchema;
  if (type === "translate_segments") return TranslationContentSchema;
  return ExplanationContentSchema;
}

export function createLearningArtifactRoute(dependencies: RouteDependencies) {
  const promptVersion = PromptModelSchema.parse(dependencies.promptVersion);
  const now = dependencies.now ?? (() => new Date().toISOString());
  return async (request: Request, context: RouteContext): Promise<Response> => {
    const requestId = dependencies.requestId();
    const authenticated = await dependencies.authenticate(request);
    if (!authenticated) return noStoreJson(failure({ code: "AUTH_REQUIRED", message: "Authentication is required", retryable: false }, requestId), 401);

    let raw: unknown;
    try { raw = await boundedBody(request); }
    catch { return noStoreJson(failure({ code: "VALIDATION_FAILED", message: "Invalid bounded JSON body", retryable: false }, requestId), 400); }
    const parsed = dependencies.jobType === "generate_overview"
      ? OverviewRequestSchema.safeParse(raw)
      : dependencies.jobType === "translate_segments"
        ? TranslationRequestSchema.safeParse(raw)
        : ExplanationRequestSchema.safeParse(raw);
    if (!parsed.success) return noStoreJson(failure({ code: "VALIDATION_FAILED", message: "Invalid learning-artifact request", retryable: false }, requestId), 400);

    const routeVideoId = (await context.params).videoId;
    const videoIdValue = dependencies.jobType === "explain_selection"
      ? (parsed.data as z.infer<typeof ExplanationRequestSchema>).videoId
      : routeVideoId;
    const videoId = YouTubeVideoIdSchema.safeParse(videoIdValue);
    if (!videoId.success) return noStoreJson(failure({ code: "INVALID_YOUTUBE_VIDEO", message: "Invalid YouTube video ID", retryable: false }, requestId), 400);
    const owned = await dependencies.store.resolveEvidence(authenticated.userId, videoId.data);
    if (!owned || owned.userId !== authenticated.userId || owned.videoId !== videoId.data) {
      return noStoreJson(failure({ code: "FORBIDDEN", message: "Source not found", retryable: false }, requestId), 404);
    }
    if (parsed.data.snapshotId !== owned.snapshotId) {
      return noStoreJson(failure({ code: "FORBIDDEN", message: "Snapshot not found", retryable: false }, requestId), 404);
    }
    const segmentIds: string[] = dependencies.jobType === "translate_segments"
      ? [...(parsed.data as z.infer<typeof TranslationRequestSchema>).segmentIds]
      : dependencies.jobType === "explain_selection"
        ? [...(parsed.data as z.infer<typeof ExplanationRequestSchema>).segmentIds]
        : [];
    const knownIds = new Set(owned.segments.map((segment) => segment.stableId));
    if (segmentIds.some((id) => !knownIds.has(id))) {
      return noStoreJson(failure({ code: "VALIDATION_FAILED", message: "Unknown transcript segment", retryable: false }, requestId), 400);
    }
    if (dependencies.jobType === "explain_selection") {
      const selection = parsed.data as z.infer<typeof ExplanationRequestSchema>;
      try {
        validateLearningArtifactSelectionEvidence(owned, selection);
      } catch {
        return noStoreJson(failure({ code: "VALIDATION_FAILED", message: "Selection is not exact persisted evidence", retryable: false }, requestId), 400);
      }
    }

    const gatewayPin = await dependencies.store.resolveActiveGatewayPin(authenticated.userId);
    if (!gatewayPin) {
      return noStoreJson(failure({
        code: "MODEL_GATEWAY_CONFIGURATION_REQUIRED",
        message: "An active model gateway is required",
        retryable: false,
      }, requestId), 409);
    }
    const parsedPin = z.strictObject({
      configId: z.string().uuid(),
      revision: z.number().int().positive(),
      fingerprint: GatewayFingerprintSchema,
    }).parse(gatewayPin);

    const privateInput: Record<string, Json | undefined> = {
      kind: dependencies.jobType,
      snapshotId: owned.snapshotId,
      transcriptHash: owned.transcriptHash,
      promptVersion,
      gatewayConfigId: parsedPin.configId,
      gatewayRevision: parsedPin.revision,
      gatewayFingerprint: parsedPin.fingerprint,
    };
    if (dependencies.jobType === "translate_segments") privateInput.segmentIds = segmentIds;
    if (dependencies.jobType === "explain_selection") {
      const selection = parsed.data as z.infer<typeof ExplanationRequestSchema>;
      Object.assign(privateInput, {
        selectedChinese: selection.selectedChinese,
        segmentIds: selection.segmentIds,
        utf16Start: selection.utf16Start,
        utf16End: selection.utf16End,
        startSeconds: selection.startSeconds,
        endSeconds: selection.endSeconds,
        context: selection.context,
      });
    }
    const dedupePayload = dependencies.jobType === "generate_overview"
      ? { snapshotId: owned.snapshotId }
      : dependencies.jobType === "translate_segments"
        ? { snapshotId: owned.snapshotId, segmentIds }
        : parsed.data;
    const dedupeKey = createLearningArtifactJobKey(
      dependencies.jobType,
      owned.transcriptHash,
      dedupePayload,
      promptVersion,
      parsedPin.fingerprint,
    );
    const registration = await dependencies.store.register({
      userId: authenticated.userId,
      sourceId: owned.sourceId,
      jobType: dependencies.jobType,
      dedupeKey,
      input: privateInput,
      gatewayPin: parsedPin,
      now: now(),
    });
    if (registration.status === "succeeded") {
      const artifact = await dependencies.store.readArtifact(authenticated.userId, registration.jobId, owned.sourceId, dependencies.jobType);
      if (artifact) {
        const content = outputSchema(dependencies.jobType).parse(artifact.content);
        return noStoreJson(success({ artifactId: artifact.artifactId, content }, requestId), 200);
      }
    }
    return noStoreJson(success({ jobId: registration.jobId, status: registration.status }, requestId), 202);
  };
}

export function createSupabaseLearningArtifactRouteStore(client: SupabaseClient<Database>): LearningArtifactRouteStore {
  return {
    async resolveActiveGatewayPin(expectedUserId) {
      const result = await client.rpc("resolve_active_user_model_gateway_pin", {
        p_user_id: expectedUserId,
      });
      if (result.error) throw result.error;
      const row = result.data[0];
      if (!row || result.data.length !== 1) return null;
      return {
        configId: row.config_id,
        revision: row.revision,
        fingerprint: row.config_fingerprint,
      };
    },
    async resolveEvidence(expectedUserId, videoId) {
      const source = await client.from("video_sources").select("id,user_id,youtube_video_id")
        .eq("user_id", expectedUserId).eq("youtube_video_id", videoId).maybeSingle();
      if (source.error) throw source.error;
      if (!source.data || source.data.user_id !== expectedUserId) return null;
      const snapshot = await client.from("video_snapshots").select("id,user_id,video_source_id,transcript_hash,title")
        .eq("user_id", expectedUserId).eq("video_source_id", source.data.id)
        .order("captured_at", { ascending: false }).limit(1).maybeSingle();
      if (snapshot.error) throw snapshot.error;
      if (!snapshot.data || snapshot.data.user_id !== expectedUserId) return null;
      const segments = await client.from("transcript_segments").select("stable_id,original_chinese,start_seconds,end_seconds,user_id")
        .eq("user_id", expectedUserId).eq("snapshot_id", snapshot.data.id).order("position", { ascending: true });
      if (segments.error) throw segments.error;
      if (segments.data.some((segment) => segment.user_id !== expectedUserId)) throw new Error("transcript owner mismatch");
      return {
        userId: expectedUserId,
        sourceId: source.data.id,
        videoId: source.data.youtube_video_id,
        snapshotId: snapshot.data.id,
        transcriptHash: snapshot.data.transcript_hash,
        title: snapshot.data.title,
        segments: segments.data.map((segment) => ({
          stableId: segment.stable_id,
          originalChinese: segment.original_chinese,
          startSeconds: segment.start_seconds,
          endSeconds: segment.end_seconds,
        })),
      };
    },
    async register(input) {
      const result = await client.rpc("register_gateway_learning_artifact_job", {
        p_user_id: input.userId,
        p_video_source_id: input.sourceId,
        p_job_type: input.jobType,
        p_dedupe_key: input.dedupeKey,
        p_input: input.input as Json,
        p_config_id: input.gatewayPin.configId,
        p_expected_config_revision: input.gatewayPin.revision,
        p_expected_config_fingerprint: input.gatewayPin.fingerprint,
        p_now: input.now,
      });
      if (result.error) throw result.error;
      const row = result.data[0];
      if (!row || result.data.length !== 1) throw new Error("invalid learning-artifact registration");
      return { jobId: row.knowledge_job_id, status: row.status, created: row.created };
    },
    async readArtifact(expectedUserId, jobId, sourceId, jobType) {
      const internal = await client.from("knowledge_job_internal").select("result,user_id")
        .eq("user_id", expectedUserId).eq("knowledge_job_id", jobId).maybeSingle();
      if (internal.error) throw internal.error;
      if (!internal.data || internal.data.user_id !== expectedUserId) return null;
      const reference = z.strictObject({ artifactId: z.string().uuid() }).safeParse(internal.data.result);
      if (!reference.success) return null;
      const artifactType = jobType === "generate_overview" ? "overview" : jobType === "translate_segments" ? "segment_translation" : "selection_explanation";
      const artifact = await client.from("generated_artifacts").select("id,user_id,video_source_id,artifact_type,content")
        .eq("user_id", expectedUserId).eq("video_source_id", sourceId).eq("id", reference.data.artifactId)
        .eq("artifact_type", artifactType).maybeSingle();
      if (artifact.error) throw artifact.error;
      if (!artifact.data || artifact.data.user_id !== expectedUserId) return null;
      return { artifactId: artifact.data.id, content: artifact.data.content };
    },
  };
}

/** CI-safe fixture. Real Provider egress remains an explicit Delivery approval gate. */
export function createFixtureLearningArtifactProvider(): LearningArtifactProvider {
  return {
    async generateOverview(evidence) {
      const first = evidence.segments[0];
      return {
        overview: "A fixture overview grounded in the persisted native transcript.",
        chapters: first ? [{ title: "Opening", summary: "The video opens with the first persisted segment.", timestampSeconds: first.startSeconds, sourceSegmentIds: [first.stableId] }] : [],
        keyQuotes: first ? [1, 2, 3].map((index) => ({ quote: first.originalChinese, englishMeaning: `Fixture English meaning ${index}.`, timestampSeconds: first.startSeconds, sourceSegmentIds: [first.stableId] })) : [],
      };
    },
    async translateSegments(evidence, ids) {
      void evidence;
      return { segments: ids.map((id, index) => ({ id, english: `Fixture English translation ${index + 1}.` })) };
    },
    async explainSelection(_evidence, selection) {
      return { selectedChinese: selection.selectedChinese, meaning: "Fixture meaning.", tone: "Fixture tone.", communicativeFunction: "Fixture communicative function.", contextualFit: "Fixture contextual fit." };
    },
  };
}

export function createUnavailableLearningArtifactProvider(): LearningArtifactProvider {
  const unavailable = async (): Promise<never> => {
    throw new ModelGatewayError("PROVIDER_UNAVAILABLE");
  };
  return {
    generateOverview: unavailable,
    translateSegments: unavailable,
    explainSelection: unavailable,
  };
}

export function validateOverviewContent(value: unknown, evidence: LearningArtifactEvidence): OverviewContent {
  const parsed = OverviewContentSchema.parse(value);
  const segmentsById = new Map(
    evidence.segments.map((segment) => [segment.stableId, segment]),
  );
  for (const item of [...parsed.chapters, ...parsed.keyQuotes]) {
    const referenced = item.sourceSegmentIds.map((id) => segmentsById.get(id));
    if (referenced.some((segment) => !segment)) {
      throw new Error("unknown source segment");
    }
    if (!referenced.some((segment) =>
      segment &&
      item.timestampSeconds >= segment.startSeconds &&
      item.timestampSeconds <= segment.endSeconds)) {
      throw new Error("timestamp is outside referenced evidence");
    }
  }
  for (const quote of parsed.keyQuotes) {
    const referencedIds = new Set(quote.sourceSegmentIds);
    const referencedText = evidence.segments
      .filter((segment) => referencedIds.has(segment.stableId))
      .map((segment) => segment.originalChinese)
      .join("\n")
      .normalize("NFKC")
      .replace(/\s+/gu, "");
    const normalizedQuote = quote.quote.normalize("NFKC").replace(/\s+/gu, "");
    if (!referencedText.includes(normalizedQuote)) {
      throw new Error("key quote is not native evidence");
    }
  }
  return parsed;
}

export function validateTranslationContent(value: unknown, expectedIds: readonly string[]): TranslationContent {
  const parsed = TranslationContentSchema.parse(value);
  if (new Set(parsed.segments.map((item) => item.id)).size !== parsed.segments.length) throw new Error("duplicate translation ID");
  if (parsed.segments.length !== expectedIds.length || parsed.segments.some((item, index) => item.id !== expectedIds[index])) {
    throw new Error("translation IDs must match requested stable IDs in order");
  }
  return parsed;
}

export function validateExplanationContent(value: unknown, selectedChinese: string): ExplanationContent {
  const parsed = ExplanationContentSchema.parse(value);
  if (parsed.selectedChinese !== selectedChinese) throw new Error("explanation changed selected Chinese");
  return parsed;
}
