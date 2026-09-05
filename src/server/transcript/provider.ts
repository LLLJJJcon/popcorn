import { createHash } from "node:crypto";

import { z } from "zod";

import type { ApiErrorCode } from "@/contracts/api";
import { YouTubeVideoIdSchema } from "@/contracts/source";
import { failure, success } from "@/server/api/respond";
import { createJobResultKey } from "@/server/domain/lease-job";

export const RESOLVE_SNAPSHOT_PROMPT_VERSION = "native-transcript-resolution-v1";
export const RESOLVE_SNAPSHOT_MODEL_VERSION = "supadata-native-v1";

export function createResolveSnapshotJobKey(videoId: string): string {
  const canonicalVideoId = YouTubeVideoIdSchema.parse(videoId);
  const sourceHash = createHash("sha256")
    .update(`https://www.youtube.com/watch?v=${canonicalVideoId}`)
    .digest("hex");
  return createJobResultKey({
    jobType: "resolve_snapshot",
    sourceHash,
    savedItemHash: null,
    promptVersion: RESOLVE_SNAPSHOT_PROMPT_VERSION,
    modelVersion: RESOLVE_SNAPSHOT_MODEL_VERSION,
  });
}

export type NativeTranscriptSegment = {
  readonly stableId: string;
  readonly position: number;
  readonly originalChinese: string;
  readonly englishTranslation?: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly language: "zh-CN";
};

export type NativeTranscriptSnapshot = {
  readonly language: "zh-CN";
  readonly transcriptHash: string;
  readonly plainText: string;
  readonly timestampedText: string;
  readonly segments: readonly NativeTranscriptSegment[];
};

export type TranscriptFailure = {
  readonly kind: "failure";
  readonly code: Extract<
    ApiErrorCode,
    | "TRANSCRIPT_EMPTY"
    | "PROVIDER_RATE_LIMITED"
    | "PROVIDER_UNAVAILABLE"
    | "PROVIDER_OUTPUT_INVALID"
  >;
  readonly retryable: boolean;
};

export type TranscriptRequestResult =
  | { readonly kind: "ready"; readonly snapshot: NativeTranscriptSnapshot }
  | { readonly kind: "pending"; readonly providerJobId: string }
  | {
      readonly kind: "unsupported";
      readonly code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED";
    }
  | TranscriptFailure;

export type TranscriptPollResult =
  | { readonly kind: "ready"; readonly snapshot: NativeTranscriptSnapshot }
  | { readonly kind: "pending" }
  | {
      readonly kind: "unsupported";
      readonly code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED";
    }
  | TranscriptFailure;

export interface TranscriptProvider {
  request(videoId: string): Promise<TranscriptRequestResult>;
  poll(providerJobId: string): Promise<TranscriptPollResult>;
}

type AuthenticatedUser = { readonly userId: string };
type TranscriptRouteContext = {
  readonly params: Promise<{ readonly videoId: string }>;
};

export interface TranscriptRouteStore {
  readLatestSnapshot(
    expectedUserId: string,
    videoId: string,
  ): Promise<{
    readonly snapshotId: string;
    readonly snapshot: NativeTranscriptSnapshot;
  } | null>;
  readSnapshot(
    expectedUserId: string,
    videoId: string,
    snapshotId: string,
  ): Promise<NativeTranscriptSnapshot | null>;
  saveReady(
    expectedUserId: string,
    videoId: string,
    snapshot: NativeTranscriptSnapshot,
  ): Promise<{ readonly snapshotId: string }>;
  savePending(
    expectedUserId: string,
    videoId: string,
    providerJobId: string,
    resultKey: string,
  ): Promise<{ readonly jobId: string }>;
}

type TranscriptRouteDependencies = {
  readonly authenticate: (request: Request) => Promise<AuthenticatedUser | null>;
  readonly provider: TranscriptProvider;
  readonly store: TranscriptRouteStore;
  readonly requestId: () => string;
};

function noStoreJson(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function unavailableSnapshot(requestId: string): Response {
  return noStoreJson(
    failure(
      {
        code: "TRANSCRIPT_UNAVAILABLE",
        message: "Transcript snapshot is unavailable",
        retryable: false,
      },
      requestId,
    ),
    404,
  );
}

/** Testable HTTP boundary kept outside Next's restricted route-module exports. */
export function createTranscriptRoute(dependencies: TranscriptRouteDependencies) {
  return async (
    request: Request,
    context: TranscriptRouteContext,
  ): Promise<Response> => {
    const requestId = dependencies.requestId();
    const authenticated = await dependencies.authenticate(request);
    if (!authenticated) {
      return noStoreJson(
        failure(
          { code: "AUTH_REQUIRED", message: "Authentication is required", retryable: false },
          requestId,
        ),
        401,
      );
    }

    const parsedVideoId = YouTubeVideoIdSchema.safeParse(
      (await context.params).videoId,
    );
    if (!parsedVideoId.success) {
      return noStoreJson(
        failure(
          { code: "INVALID_YOUTUBE_VIDEO", message: "Invalid YouTube video ID", retryable: false },
          requestId,
        ),
        400,
      );
    }

    const suppliedSnapshotId = new URL(request.url).searchParams.get("snapshotId");
    if (suppliedSnapshotId !== null) {
      const parsedSnapshotId = z.string().uuid().safeParse(suppliedSnapshotId);
      if (!parsedSnapshotId.success) return unavailableSnapshot(requestId);
      const snapshot = await dependencies.store.readSnapshot(
        authenticated.userId,
        parsedVideoId.data,
        parsedSnapshotId.data,
      );
      if (!snapshot) return unavailableSnapshot(requestId);
      return noStoreJson(
        success(
          {
            kind: "ready" as const,
            snapshotId: parsedSnapshotId.data,
            snapshot,
          },
          requestId,
        ),
        200,
      );
    }

    const cached = await dependencies.store.readLatestSnapshot(
      authenticated.userId,
      parsedVideoId.data,
    );
    if (cached) {
      return noStoreJson(
        success(
          {
            kind: "ready" as const,
            snapshotId: cached.snapshotId,
            snapshot: cached.snapshot,
          },
          requestId,
        ),
        200,
      );
    }

    const result = await dependencies.provider.request(parsedVideoId.data);
    if (result.kind === "ready") {
      const persisted = await dependencies.store.saveReady(
        authenticated.userId,
        parsedVideoId.data,
        result.snapshot,
      );
      return noStoreJson(
        success(
          {
            kind: "ready" as const,
            snapshotId: persisted.snapshotId,
            snapshot: result.snapshot,
          },
          requestId,
        ),
        200,
      );
    }
    if (result.kind === "pending") {
      const pending = await dependencies.store.savePending(
        authenticated.userId,
        parsedVideoId.data,
        result.providerJobId,
        createResolveSnapshotJobKey(parsedVideoId.data),
      );
      return noStoreJson(
        success({ kind: "pending" as const, jobId: pending.jobId }, requestId),
        202,
      );
    }
    if (result.kind === "unsupported") {
      return noStoreJson(
        failure(
          {
            code: result.code,
            message: "A native Simplified Chinese transcript is required",
            retryable: false,
          },
          requestId,
        ),
        422,
      );
    }
    const status = result.code === "PROVIDER_RATE_LIMITED" ? 429 : 502;
    return noStoreJson(
      failure(
        {
          code: result.code,
          message: "Transcript Provider request failed",
          retryable: result.retryable,
        },
        requestId,
      ),
      status,
    );
  };
}
