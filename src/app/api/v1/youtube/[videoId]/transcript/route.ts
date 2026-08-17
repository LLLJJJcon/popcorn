import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/env";
import {
  createTranscriptRoute,
  type TranscriptRouteStore,
} from "@/server/transcript/provider";
import { createSupadataTranscriptProvider } from "@/server/transcript/supadata-provider";
import type { Database, Json } from "@/types/database.generated";

type AuthenticatedUser = { readonly userId: string };
type RouteContext = { readonly params: Promise<{ videoId: string }> };

function bearerToken(request: Request): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

function createAuthenticator(): (request: Request) => Promise<AuthenticatedUser | null> {
  const environment = getServerEnv();
  return async (request) => {
    const token = bearerToken(request);
    if (!token) return null;
    const client = createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await client.auth.getUser(token);
    return error || !data.user ? null : { userId: data.user.id };
  };
}

function createServiceClient(): SupabaseClient<Database> {
  const environment = getServerEnv();
  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function ownedSourceId(
  client: SupabaseClient<Database>,
  expectedUserId: string,
  videoId: string,
): Promise<string> {
  const existing = await client
    .from("video_sources")
    .select("id")
    .eq("user_id", expectedUserId)
    .eq("youtube_video_id", videoId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const inserted = await client
    .from("video_sources")
    .insert({
      user_id: expectedUserId,
      youtube_video_id: videoId,
      canonical_url: `https://www.youtube.com/watch?v=${videoId}`,
    })
    .select("id")
    .single();
  if (!inserted.error) return inserted.data.id;

  const raced = await client
    .from("video_sources")
    .select("id")
    .eq("user_id", expectedUserId)
    .eq("youtube_video_id", videoId)
    .single();
  if (raced.error) throw inserted.error;
  return raced.data.id;
}

function createSupabaseTranscriptStore(): TranscriptRouteStore {
  const client = createServiceClient();
  return {
    async savePending(expectedUserId, videoId, providerJobId, resultKey) {
      const sourceId = await ownedSourceId(client, expectedUserId, videoId);
      const queued = await client
        .from("knowledge_jobs")
        .upsert(
          {
            user_id: expectedUserId,
            video_source_id: sourceId,
            saved_item_id: null,
            job_type: "resolve_snapshot",
            status: "pending",
            dedupe_key: resultKey,
          },
          { onConflict: "user_id,job_type,dedupe_key", ignoreDuplicates: true },
        );
      if (queued.error) throw queued.error;
      const job = await client
        .from("knowledge_jobs")
        .select("id,user_id,status")
        .eq("user_id", expectedUserId)
        .eq("job_type", "resolve_snapshot")
        .eq("dedupe_key", resultKey)
        .single();
      if (job.error || job.data.user_id !== expectedUserId) throw job.error ?? new Error("job owner mismatch");

      if (job.data.status !== "succeeded") {
        const privateWrite = await client.from("knowledge_job_internal").upsert({
          knowledge_job_id: job.data.id,
          user_id: expectedUserId,
          input: { providerJobId } satisfies Json,
          result: null,
        });
        if (privateWrite.error) throw privateWrite.error;
      }
      return { jobId: job.data.id };
    },

    async saveReady(expectedUserId, videoId, snapshot) {
      const sourceId = await ownedSourceId(client, expectedUserId, videoId);
      const capturedAt = new Date().toISOString();
      const durationSeconds = Math.max(...snapshot.segments.map((segment) => segment.endSeconds));
      const snapshotWrite = await client
        .from("video_snapshots")
        .upsert(
          {
            user_id: expectedUserId,
            video_source_id: sourceId,
            title: `YouTube video ${videoId}`,
            channel: "YouTube",
            thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration_seconds: durationSeconds,
            description: "",
            transcript_language: "zh-CN",
            transcript_hash: snapshot.transcriptHash,
            captured_at: capturedAt,
          },
          { onConflict: "video_source_id,transcript_hash", ignoreDuplicates: true },
        );
      if (snapshotWrite.error) throw snapshotWrite.error;
      const persisted = await client
        .from("video_snapshots")
        .select("id,user_id")
        .eq("user_id", expectedUserId)
        .eq("video_source_id", sourceId)
        .eq("transcript_hash", snapshot.transcriptHash)
        .single();
      if (persisted.error || persisted.data.user_id !== expectedUserId) {
        throw persisted.error ?? new Error("snapshot owner mismatch");
      }
      const segments = snapshot.segments.map((segment) => ({
        user_id: expectedUserId,
        snapshot_id: persisted.data.id,
        stable_id: segment.stableId,
        position: segment.position,
        original_chinese: segment.originalChinese,
        start_seconds: segment.startSeconds,
        end_seconds: segment.endSeconds,
        language: "zh-CN",
      }));
      const segmentWrite = await client
        .from("transcript_segments")
        .upsert(segments, { onConflict: "snapshot_id,stable_id", ignoreDuplicates: true });
      if (segmentWrite.error) throw segmentWrite.error;
      return { snapshotId: persisted.data.id };
    },
  };
}

function runtimeRoute() {
  const environment = getServerEnv();
  return createTranscriptRoute({
    authenticate: createAuthenticator(),
    provider: createSupadataTranscriptProvider({ apiKey: environment.SUPADATA_API_KEY }),
    store: createSupabaseTranscriptStore(),
    requestId: randomUUID,
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return runtimeRoute()(request, context);
}
