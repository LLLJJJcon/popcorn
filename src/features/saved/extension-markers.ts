import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { YouTubeVideoIdSchema } from "@/contracts/source";
import { failure, success } from "@/server/api/respond";
import { getModelGatewaySettingsEnv } from "@/server/env";
import type { CaptureAuthentication } from "@/server/repositories/video-source-repository";
import type { Database, Json } from "@/types/database.generated";

/**
 * What the extension needs to restore "Saved" labels on transcript rows for
 * one video: saved subtitle rows (by segment ID, with their start time as a
 * fallback) and player moments (by captured second).
 */
export type ExtensionSavedMarkers = {
  readonly youtubeVideoId: string;
  readonly segmentIds: readonly string[];
  readonly rowStartSeconds: readonly number[];
  readonly capturedSeconds: readonly number[];
};

export type SavedMarkerRow = {
  readonly kind: string;
  readonly startSeconds: number | null;
  readonly payload: Json;
};

export interface SavedMarkerRepository {
  list(userId: string, youtubeVideoId: string): Promise<readonly SavedMarkerRow[]>;
}

const MAX_MARKER_ROWS = 1_000;

function objectPayload(payload: Json): Record<string, Json | undefined> {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, Json | undefined>
    : {};
}

const finiteSecond = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

export function toSavedMarkers(
  youtubeVideoId: string,
  rows: readonly SavedMarkerRow[],
): ExtensionSavedMarkers {
  const segmentIds = new Set<string>();
  const rowStartSeconds = new Set<number>();
  const capturedSeconds = new Set<number>();
  for (const row of rows) {
    const payload = objectPayload(row.payload);
    if (row.kind === "subtitle_row") {
      if (typeof payload.segmentId === "string" && payload.segmentId) {
        segmentIds.add(payload.segmentId);
      }
      const start = finiteSecond(payload.startSeconds) ?? finiteSecond(row.startSeconds);
      if (start !== null) rowStartSeconds.add(start);
    } else if (row.kind === "player_moment") {
      const second = finiteSecond(payload.capturedSecond) ?? finiteSecond(row.startSeconds);
      if (second !== null) capturedSeconds.add(Math.floor(second));
    }
  }
  return {
    youtubeVideoId,
    segmentIds: [...segmentIds],
    rowStartSeconds: [...rowStartSeconds],
    capturedSeconds: [...capturedSeconds],
  };
}

export function createSavedMarkerRepository(
  client: SupabaseClient<Database>,
): SavedMarkerRepository {
  return {
    async list(userId, youtubeVideoId) {
      const result = await client.from("saved_items")
        .select("kind,start_seconds,payload")
        .eq("user_id", userId)
        .eq("youtube_video_id", youtubeVideoId)
        .in("kind", ["subtitle_row", "player_moment"])
        .is("removed_from_saved_at", null)
        .order("captured_at", { ascending: false })
        .limit(MAX_MARKER_ROWS);
      if (result.error) throw new Error("Saved markers query failed");
      return (result.data ?? []).map((row) => ({
        kind: row.kind,
        startSeconds: row.start_seconds === null ? null : Number(row.start_seconds),
        payload: row.payload,
      }));
    },
  };
}

function noStore(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createExtensionSavedMarkersHandler({
  authenticate,
  repository,
  requestId,
}: {
  readonly authenticate: (request: Request) => Promise<CaptureAuthentication>;
  readonly repository: SavedMarkerRepository;
  readonly requestId: () => string;
}) {
  return async function get(request: Request) {
    const id = requestId();
    const authentication = await authenticate(request);
    if (!authentication.ok) {
      const missing = authentication.reason === "missing";
      return noStore(failure({
        code: missing ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
        message: missing ? "Sign in to view Saved." : "Your session expired. Sign in again.",
        retryable: false,
      }, id), 401);
    }
    const videoId = YouTubeVideoIdSchema.safeParse(
      new URL(request.url).searchParams.get("videoId"),
    );
    if (!videoId.success) {
      return noStore(failure({
        code: "INVALID_YOUTUBE_VIDEO",
        message: "A YouTube video ID is required.",
        retryable: false,
      }, id), 400);
    }
    try {
      const rows = await repository.list(authentication.userId, videoId.data);
      return noStore(success(toSavedMarkers(videoId.data, rows), id), 200);
    } catch {
      return noStore(failure({
        code: "INTERNAL_ERROR",
        message: "Saved markers are unavailable.",
        retryable: true,
      }, id), 500);
    }
  };
}

export function createSavedMarkerRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return { repository: createSavedMarkerRepository(client) };
}
