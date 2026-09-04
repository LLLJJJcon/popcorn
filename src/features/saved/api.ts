import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { SavedItemKind, SavedItemStatus } from "@/contracts/source";
import { failure, success } from "@/server/api/respond";
import {
  createNextCookieAdapter,
  createWebSessionAuthenticator,
  type WebSessionResult,
} from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import {
  createSourceDeletionPlanner,
  createSupabaseSourceDeletionRepository,
} from "@/server/domain/plan-source-deletion";
import type { Database, Json } from "@/types/database.generated";

type SourceRow = {
  readonly id: string;
  readonly userId: string;
  readonly youtubeVideoId: string;
  readonly canonicalUrl: string;
};

type SnapshotRow = {
  readonly id: string;
  readonly userId: string;
  readonly sourceId: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string;
  readonly capturedAt: string;
};

type SavedItemRow = {
  readonly id: string;
  readonly userId: string;
  readonly sourceId: string;
  readonly snapshotId: string | null;
  readonly youtubeVideoId: string;
  readonly kind: string;
  readonly status: string;
  readonly capturedAt: string;
  readonly startSeconds: number | null;
  readonly payload: Json;
};

type ArtifactRow = {
  readonly id: string;
  readonly userId: string;
  readonly sourceId: string;
  readonly savedItemId: string | null;
  readonly type: string;
  readonly promptVersion: string;
  readonly content: Json;
  readonly createdAt: string;
};

type JobRow = {
  readonly id: string;
  readonly userId: string;
  readonly sourceId: string;
  readonly savedItemId: string | null;
  readonly type: string;
  readonly status: string;
  readonly errorCode: string | null;
  readonly createdAt: string;
};

type EvidenceRow = {
  readonly id: string;
  readonly userId: string;
  readonly snapshotId: string;
  readonly originalChinese: string;
  readonly englishTranslation: string | null;
  readonly startSeconds: number;
  readonly endSeconds: number;
};

export type SavedLibraryRows = {
  readonly sources: readonly SourceRow[];
  readonly snapshots: readonly SnapshotRow[];
  readonly items: readonly SavedItemRow[];
  readonly artifacts: readonly ArtifactRow[];
  readonly jobs: readonly JobRow[];
  readonly evidence: readonly EvidenceRow[];
};

export type SavedItemView = {
  readonly id: string;
  readonly kind: SavedItemKind;
  readonly status: SavedItemStatus;
  readonly capturedAt: string;
  readonly startSeconds: number | null;
  readonly rawText: string;
  readonly englishTranslation: string | null;
  readonly youtubeUrl: string;
};

export type SavedVideoSummary = {
  readonly sourceId: string;
  readonly youtubeVideoId: string;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly channel: string;
  readonly thumbnailUrl: string;
  readonly savedCount: number;
  readonly latestSavedAt: string;
  readonly processingState: SavedItemStatus;
};

export type SavedArtifactView = {
  readonly artifactId: string;
  readonly savedItemId: string | null;
  readonly type: string;
  readonly promptVersion: string;
  readonly content: Json;
};

export type SavedVideoDetail = SavedVideoSummary & {
  readonly items: readonly SavedItemView[];
  readonly artifacts: readonly SavedArtifactView[];
  readonly processingErrors: readonly string[];
};

export interface SavedLibraryRepository {
  list(userId: string): Promise<SavedLibraryRows>;
  detail(userId: string, sourceId: string): Promise<SavedLibraryRows | null>;
  home(userId: string, now: string): Promise<{
    readonly duePracticeCount: number;
    readonly unsortedSaveCount: number;
  }>;
}

const emptyRows = (): SavedLibraryRows => ({
  sources: [], snapshots: [], items: [], artifacts: [], jobs: [], evidence: [],
});

function newestSnapshot(snapshots: readonly SnapshotRow[], sourceId: string) {
  return snapshots
    .filter((snapshot) => snapshot.sourceId === sourceId)
    .toSorted((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0];
}

function processingState(
  items: readonly Pick<SavedItemRow | SavedItemView, "status">[],
  jobs: readonly JobRow[],
): SavedItemStatus {
  if (items.some(({ status }) => status === "unsupported")) return "unsupported";
  if (
    items.some(({ status }) => status === "failed") ||
    jobs.some(({ status }) => status === "terminal_failed")
  ) return "failed";
  if (
    items.some(({ status }) => ["saved", "resolving_source", "organizing"].includes(status)) ||
    jobs.some(({ status }) => ["pending", "leased", "retryable_failed"].includes(status))
  ) return "organizing";
  return "ready";
}

export function groupSavedVideos({
  sources,
  snapshots,
  items,
  jobs,
}: {
  readonly sources: readonly Pick<SourceRow, "id" | "youtubeVideoId" | "canonicalUrl">[];
  readonly snapshots: readonly Pick<SnapshotRow, "id" | "sourceId" | "title" | "channel" | "thumbnailUrl" | "capturedAt">[];
  readonly items: readonly (SavedItemView & { readonly sourceId: string })[];
  readonly jobs: readonly JobRow[];
}): SavedVideoSummary[] {
  return sources.flatMap((source) => {
    const sourceItems = items.filter((item) => item.sourceId === source.id);
    if (sourceItems.length === 0) return [];
    const snapshot = newestSnapshot(
      snapshots.map((value) => ({ ...value, userId: "" })),
      source.id,
    );
    const videoSave = sourceItems.find((item) => item.kind === "video");
    const title = snapshot?.title ?? videoSave?.rawText ?? "Saved YouTube video";
    return [{
      sourceId: source.id,
      youtubeVideoId: source.youtubeVideoId,
      canonicalUrl: source.canonicalUrl,
      title,
      channel: snapshot?.channel ?? "YouTube",
      thumbnailUrl: snapshot?.thumbnailUrl ?? `https://i.ytimg.com/vi/${source.youtubeVideoId}/hqdefault.jpg`,
      savedCount: sourceItems.length,
      latestSavedAt: sourceItems.reduce(
        (latest, item) => item.capturedAt > latest ? item.capturedAt : latest,
        sourceItems[0]!.capturedAt,
      ),
      processingState: processingState(sourceItems, jobs.filter((job) => job.sourceId === source.id)),
    }];
  }).toSorted((left, right) =>
    right.latestSavedAt.localeCompare(left.latestSavedAt) || left.sourceId.localeCompare(right.sourceId),
  );
}

function objectPayload(payload: Json): Record<string, Json | undefined> {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, Json | undefined>
    : {};
}

function text(payload: Record<string, Json | undefined>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function rawSavedText(row: SavedItemRow, evidence: readonly EvidenceRow[]) {
  const payload = objectPayload(row.payload);
  const direct = text(payload, "originalChinese")
    ?? text(payload, "exactQuote")
    ?? text(payload, "selectedChinese")
    ?? text(payload, "title");
  if (direct) return direct;
  const segmentId = text(payload, "segmentId");
  const matched = segmentId ? evidence.find((entry) => entry.id === segmentId) : undefined;
  return matched?.originalChinese ?? (row.kind === "player_moment" ? "Saved video moment" : "Saved video");
}

function translation(row: SavedItemRow, evidence: readonly EvidenceRow[]) {
  const payload = objectPayload(row.payload);
  const direct = text(payload, "englishTranslation") ?? text(payload, "englishExplanation");
  if (direct) return direct;
  const segmentId = text(payload, "segmentId");
  return segmentId
    ? evidence.find((entry) => entry.id === segmentId)?.englishTranslation ?? null
    : null;
}

function timestampUrl(canonicalUrl: string, seconds: number | null) {
  if (seconds === null) return canonicalUrl;
  return `${canonicalUrl}&t=${Math.max(0, Math.floor(seconds))}s`;
}

function itemView(row: SavedItemRow, source: SourceRow, evidence: readonly EvidenceRow[]): SavedItemView {
  return {
    id: row.id,
    kind: row.kind as SavedItemKind,
    status: row.status as SavedItemStatus,
    capturedAt: row.capturedAt,
    startSeconds: row.startSeconds,
    rawText: rawSavedText(row, evidence),
    englishTranslation: translation(row, evidence),
    youtubeUrl: timestampUrl(source.canonicalUrl, row.startSeconds),
  };
}

export function sortSavedTimeline(items: readonly SavedItemView[]) {
  return [...items].sort((left, right) =>
    (left.startSeconds ?? 0) - (right.startSeconds ?? 0)
    || left.capturedAt.localeCompare(right.capturedAt)
    || left.id.localeCompare(right.id),
  );
}

function rowsBelongTo(userId: string, rows: SavedLibraryRows, expectedSourceId?: string) {
  const sources = rows.sources;
  if (sources.some((row) => row.userId !== userId)) return false;
  if (expectedSourceId && (sources.length !== 1 || sources[0]?.id !== expectedSourceId)) return false;
  const sourceIds = new Set(sources.map(({ id }) => id));
  const snapshots = new Map(rows.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  if (rows.snapshots.some((row) => row.userId !== userId || !sourceIds.has(row.sourceId))) return false;
  if (rows.items.some((row) =>
    row.userId !== userId || !sourceIds.has(row.sourceId)
    || (row.snapshotId !== null && snapshots.get(row.snapshotId)?.sourceId !== row.sourceId)
  )) return false;
  const items = new Map(rows.items.map((item) => [item.id, item]));
  if (rows.artifacts.some((row) =>
    row.userId !== userId
    || !sourceIds.has(row.sourceId)
    || (row.savedItemId !== null && items.get(row.savedItemId)?.sourceId !== row.sourceId)
  )) return false;
  if (rows.jobs.some((row) => row.userId !== userId || !sourceIds.has(row.sourceId))) return false;
  if (rows.evidence.some((row) => row.userId !== userId || !snapshots.has(row.snapshotId))) return false;
  return true;
}

function listRows(rows: SavedLibraryRows): SavedVideoSummary[] {
  const items = rows.items.map((item) => ({
    ...itemView(item, rows.sources.find(({ id }) => id === item.sourceId)!, rows.evidence),
    sourceId: item.sourceId,
  }));
  return groupSavedVideos({ sources: rows.sources, snapshots: rows.snapshots, items, jobs: rows.jobs });
}

export function createSavedLibraryService(repository: SavedLibraryRepository) {
  return {
    async list(userId: string): Promise<SavedVideoSummary[]> {
      const rows = await repository.list(userId);
      return rowsBelongTo(userId, rows) ? listRows(rows) : [];
    },
    async detail(userId: string, sourceId: string): Promise<SavedVideoDetail | null> {
      const rows = await repository.detail(userId, sourceId);
      if (!rows || !rowsBelongTo(userId, rows, sourceId)) return null;
      const summary = listRows(rows)[0];
      const source = rows.sources[0];
      if (!summary || !source) return null;
      const items = sortSavedTimeline(rows.items.map((row) => itemView(row, source, rows.evidence)));
      return {
        ...summary,
        items,
        artifacts: rows.artifacts
          .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
          .map(({ id: artifactId, savedItemId, type, promptVersion, content }) => ({
            artifactId,
            savedItemId,
            type,
            promptVersion,
            content,
          })),
        processingErrors: rows.jobs
          .filter(({ status }) => status === "terminal_failed")
          .map(() => "Popcorn could not organize this save. Your original saved text is still available."),
      };
    },
    home(userId: string, now: string) {
      return repository.home(userId, now);
    },
  };
}

type SavedLibraryService = ReturnType<typeof createSavedLibraryService>;

function noStore(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createSavedLibraryHttpHandlers({
  authenticate,
  service,
  requestId,
}: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly service: SavedLibraryService;
  readonly requestId: () => string;
}) {
  async function session(request: Request, id: string) {
    const result = await authenticate(request);
    if (result.ok) return result;
    return noStore(failure({
      code: result.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
      message: result.reason === "missing" ? "Sign in to view Saved." : "Your session expired. Sign in again.",
      retryable: false,
    }, id), 401);
  }

  return {
    async list(request: Request) {
      const id = requestId();
      const authorized = await session(request, id);
      if (authorized instanceof Response) return authorized;
      try {
        return noStore(success(await service.list(authorized.userId), id), 200);
      } catch {
        return noStore(failure({ code: "INTERNAL_ERROR", message: "Saved is unavailable.", retryable: true }, id), 500);
      }
    },
    async detail(request: Request, sourceId: string) {
      const id = requestId();
      const authorized = await session(request, id);
      if (authorized instanceof Response) return authorized;
      try {
        const detail = await service.detail(authorized.userId, sourceId);
        return detail
          ? noStore(success(detail, id), 200)
          : noStore(failure({ code: "FORBIDDEN", message: "Saved video is unavailable.", retryable: false }, id), 404);
      } catch {
        return noStore(failure({ code: "INTERNAL_ERROR", message: "Saved video is unavailable.", retryable: true }, id), 500);
      }
    },
  };
}

function throwQueryError(error: unknown) {
  if (error) throw new Error("Saved library query failed");
}

type VideoSourceDbRow = Pick<Database["public"]["Tables"]["video_sources"]["Row"], "id" | "user_id" | "youtube_video_id" | "canonical_url">;
type VideoSnapshotDbRow = Pick<Database["public"]["Tables"]["video_snapshots"]["Row"], "id" | "user_id" | "video_source_id" | "title" | "channel" | "thumbnail_url" | "captured_at">;
type SavedItemDbRow = Pick<Database["public"]["Tables"]["saved_items"]["Row"], "id" | "user_id" | "video_source_id" | "snapshot_id" | "youtube_video_id" | "kind" | "status" | "captured_at" | "start_seconds" | "payload">;
type ArtifactDbRow = Pick<Database["public"]["Tables"]["generated_artifacts"]["Row"], "id" | "user_id" | "video_source_id" | "saved_item_id" | "artifact_type" | "prompt_version" | "content" | "created_at">;
type JobDbRow = Pick<Database["public"]["Tables"]["knowledge_jobs"]["Row"], "id" | "user_id" | "video_source_id" | "saved_item_id" | "job_type" | "status" | "last_error_code" | "created_at">;

function mapSource(row: VideoSourceDbRow): SourceRow {
  return { id: row.id, userId: row.user_id, youtubeVideoId: row.youtube_video_id, canonicalUrl: row.canonical_url };
}

function mapSnapshot(row: VideoSnapshotDbRow): SnapshotRow {
  return { id: row.id, userId: row.user_id, sourceId: row.video_source_id, title: row.title, channel: row.channel, thumbnailUrl: row.thumbnail_url, capturedAt: row.captured_at };
}

function mapItem(row: SavedItemDbRow): SavedItemRow {
  return { id: row.id, userId: row.user_id, sourceId: row.video_source_id, snapshotId: row.snapshot_id, youtubeVideoId: row.youtube_video_id, kind: row.kind, status: row.status, capturedAt: row.captured_at, startSeconds: row.start_seconds, payload: row.payload };
}

function mapArtifact(row: ArtifactDbRow): ArtifactRow {
  return {
    id: row.id,
    userId: row.user_id,
    sourceId: row.video_source_id,
    savedItemId: row.saved_item_id,
    type: row.artifact_type,
    promptVersion: row.prompt_version,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapJob(row: JobDbRow): JobRow {
  return { id: row.id, userId: row.user_id, sourceId: row.video_source_id, savedItemId: row.saved_item_id, type: row.job_type, status: row.status, errorCode: row.last_error_code, createdAt: row.created_at };
}

function segmentIds(items: readonly SavedItemRow[]) {
  return [...new Set(items.flatMap(({ payload }) => {
    const value = objectPayload(payload);
    const one = text(value, "segmentId");
    const many = value.segmentIds;
    return [
      ...(one ? [one] : []),
      ...(Array.isArray(many) ? many.filter((entry): entry is string => typeof entry === "string") : []),
    ];
  }))].slice(0, 224);
}

export function createSavedLibraryRepository(client: SupabaseClient<Database>): SavedLibraryRepository {
  async function readSources(userId: string, sourceId?: string) {
    let query = client.from("video_sources").select("id,user_id,youtube_video_id,canonical_url")
      .eq("user_id", userId);
    if (sourceId) query = query.eq("id", sourceId);
    const result = await query.order("created_at", { ascending: false }).limit(sourceId ? 1 : 100);
    throwQueryError(result.error);
    return (result.data ?? []).map(mapSource);
  }

  async function readRows(userId: string, sources: readonly SourceRow[], includeDetail: boolean): Promise<SavedLibraryRows> {
    if (sources.length === 0) return emptyRows();
    const sourceIds = sources.map(({ id }) => id);
    const [snapshotResult, itemResult, jobResult] = await Promise.all([
      client.from("video_snapshots").select("id,user_id,video_source_id,title,channel,thumbnail_url,captured_at")
        .eq("user_id", userId).in("video_source_id", sourceIds)
        .order("captured_at", { ascending: false }).limit(100),
      client.from("saved_items").select("id,user_id,video_source_id,snapshot_id,youtube_video_id,kind,status,captured_at,start_seconds,payload")
        .eq("user_id", userId).in("video_source_id", sourceIds)
        .order("captured_at", { ascending: false }).limit(500),
      client.from("knowledge_jobs").select("id,user_id,video_source_id,saved_item_id,job_type,status,last_error_code,created_at")
        .eq("user_id", userId).in("video_source_id", sourceIds)
        .order("created_at", { ascending: false }).limit(500),
    ]);
    throwQueryError(snapshotResult.error ?? itemResult.error ?? jobResult.error);
    const snapshots = (snapshotResult.data ?? []).map(mapSnapshot);
    const items = (itemResult.data ?? []).map(mapItem);
    const jobs = (jobResult.data ?? []).map(mapJob);
    if (!includeDetail) return { sources, snapshots, items, jobs, artifacts: [], evidence: [] };

    const artifactResult = await client.from("generated_artifacts")
      .select("id,user_id,video_source_id,saved_item_id,artifact_type,prompt_version,content,created_at")
      .eq("user_id", userId).in("video_source_id", sourceIds)
      .order("created_at", { ascending: true }).limit(500);
    throwQueryError(artifactResult.error);
    const ids = segmentIds(items);
    const snapshotIds = [...new Set(items.flatMap(({ snapshotId }) => snapshotId ? [snapshotId] : []))];
    let evidence: EvidenceRow[] = [];
    if (ids.length > 0 && snapshotIds.length > 0) {
      const segmentResult = await client.from("transcript_segments")
        .select("stable_id,user_id,snapshot_id,original_chinese,english_translation,start_seconds,end_seconds")
        .eq("user_id", userId).in("snapshot_id", snapshotIds).in("stable_id", ids).limit(224);
      throwQueryError(segmentResult.error);
      evidence = (segmentResult.data ?? []).map((row) => ({
        id: row.stable_id,
        userId: row.user_id,
        snapshotId: row.snapshot_id,
        originalChinese: row.original_chinese,
        englishTranslation: row.english_translation,
        startSeconds: row.start_seconds,
        endSeconds: row.end_seconds,
      }));
    }
    return {
      sources, snapshots, items, jobs, evidence,
      artifacts: (artifactResult.data ?? []).map(mapArtifact),
    };
  }

  return {
    async list(userId) {
      const sources = await readSources(userId);
      return readRows(userId, sources, false);
    },
    async detail(userId, sourceId) {
      const sources = await readSources(userId, sourceId);
      return sources.length === 1 ? readRows(userId, sources, true) : null;
    },
    async home(userId, now) {
      const [due, unsorted] = await Promise.all([
        client.from("review_tasks").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("status", "pending").lte("due_at", now),
        client.from("saved_items").select("id", { count: "exact", head: true })
          .eq("user_id", userId).in("status", ["saved", "resolving_source", "organizing"]),
      ]);
      throwQueryError(due.error ?? unsorted.error);
      return { duePracticeCount: due.count ?? 0, unsortedSaveCount: unsorted.count ?? 0 };
    },
  };
}

export function createSavedLibraryRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return {
    service: createSavedLibraryService(createSavedLibraryRepository(client)),
  };
}

export async function createSavedRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const cookieStore = await cookies();
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:",
    cookieAdapter: async () => createNextCookieAdapter(cookieStore),
  });
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const deletionRepository = createSupabaseSourceDeletionRepository(client);
  return {
    authenticate,
    service: createSavedLibraryService(createSavedLibraryRepository(client)),
    deletionRepository,
    deletionPlanner: createSourceDeletionPlanner(deletionRepository),
    appUrl: environment.APP_URL,
  };
}
