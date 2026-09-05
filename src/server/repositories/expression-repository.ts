import type { SupabaseClient } from "@supabase/supabase-js";

import { KnowledgeJobStatusSchema, type KnowledgeJobStatus } from "@/contracts/knowledge";
import { SavedItemAnalysisJobInputSchema } from "@/server/jobs/job-types";
import type { Database, Json } from "@/types/database.generated";

export type CandidateArtifactRecord = {
  readonly artifactId: string;
  readonly userId: string;
  readonly sourceId: string;
  readonly savedItemId: string;
  readonly type: string;
  readonly promptVersion: string;
  readonly content: Json;
};

export type CandidateSourceContext = {
  readonly userId: string;
  readonly sourceId: string;
  readonly savedItemId: string;
  readonly snapshotId: string;
  readonly transcriptHash: string;
  readonly youtubeVideoId: string;
  readonly canonicalUrl: string;
  readonly artifact: CandidateArtifactRecord | null;
};

export type CandidateAnalysisJobStatus = {
  readonly jobId: string;
  readonly status: KnowledgeJobStatus;
  readonly lastErrorCode: string | null;
};

export interface ExpressionRepository {
  read(userId: string, savedItemId: string): Promise<CandidateSourceContext | null>;
  readAnalysisJobStatus(
    userId: string,
    savedItemId: string,
    jobId: string,
  ): Promise<CandidateAnalysisJobStatus | null>;
}

function queryFailed(error: unknown) {
  if (error) throw new Error("candidate lookup failed");
}

export function createSupabaseExpressionRepository(
  client: SupabaseClient<Database>,
): ExpressionRepository {
  return {
    async read(userId, savedItemId) {
      const saved = await client.from("saved_items")
        .select("id,user_id,video_source_id,snapshot_id,youtube_video_id")
        .eq("user_id", userId)
        .eq("id", savedItemId)
        .limit(1)
        .maybeSingle();
      queryFailed(saved.error);
      if (!saved.data?.snapshot_id) return null;

      const sourceId = saved.data.video_source_id;
      const snapshotId = saved.data.snapshot_id;
      const [source, snapshot, artifact] = await Promise.all([
        client.from("video_sources")
          .select("id,user_id,youtube_video_id,canonical_url")
          .eq("user_id", userId)
          .eq("id", sourceId)
          .eq("youtube_video_id", saved.data.youtube_video_id)
          .limit(1)
          .maybeSingle(),
        client.from("video_snapshots")
          .select("id,user_id,video_source_id,transcript_hash")
          .eq("user_id", userId)
          .eq("id", snapshotId)
          .eq("video_source_id", sourceId)
          .limit(1)
          .maybeSingle(),
        client.from("generated_artifacts")
          .select("id,user_id,video_source_id,saved_item_id,artifact_type,prompt_version,content,created_at")
          .eq("user_id", userId)
          .eq("video_source_id", sourceId)
          .eq("saved_item_id", savedItemId)
          .eq("artifact_type", "saved_item_analysis")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      queryFailed(source.error ?? snapshot.error ?? artifact.error);
      if (!source.data || !snapshot.data) return null;
      return {
        userId: saved.data.user_id,
        sourceId,
        savedItemId: saved.data.id,
        snapshotId,
        transcriptHash: snapshot.data.transcript_hash,
        youtubeVideoId: saved.data.youtube_video_id,
        canonicalUrl: source.data.canonical_url,
        artifact: artifact.data ? {
          artifactId: artifact.data.id,
          userId: artifact.data.user_id,
          sourceId: artifact.data.video_source_id,
          savedItemId: artifact.data.saved_item_id!,
          type: artifact.data.artifact_type,
          promptVersion: artifact.data.prompt_version,
          content: artifact.data.content,
        } : null,
      };
    },
    async readAnalysisJobStatus(userId, savedItemId, jobId) {
      const job = await client.from("knowledge_jobs")
        .select("id,user_id,saved_item_id,job_type,status,last_error_code")
        .eq("user_id", userId)
        .eq("id", jobId)
        .eq("saved_item_id", savedItemId)
        .eq("job_type", "analyze_saved_item")
        .maybeSingle();
      queryFailed(job.error);
      if (
        !job.data || job.data.id !== jobId || job.data.user_id !== userId ||
        job.data.saved_item_id !== savedItemId || job.data.job_type !== "analyze_saved_item"
      ) return null;

      const internal = await client.from("knowledge_job_internal")
        .select("input,user_id")
        .eq("user_id", userId)
        .eq("knowledge_job_id", jobId)
        .maybeSingle();
      queryFailed(internal.error);
      if (!internal.data || internal.data.user_id !== userId) return null;
      const status = KnowledgeJobStatusSchema.safeParse(job.data.status);
      if (!status.success) return null;
      const input = SavedItemAnalysisJobInputSchema.safeParse(internal.data.input);
      const finalizedInputIsCleared = (
        status.data === "terminal_failed" || status.data === "succeeded"
      )
        && typeof internal.data.input === "object"
        && internal.data.input !== null
        && !Array.isArray(internal.data.input)
        && Object.keys(internal.data.input).length === 0;
      if (
        (!input.success && !finalizedInputIsCleared)
        || (input.success && input.data.savedItemId !== savedItemId)
      ) return null;
      return {
        jobId: job.data.id,
        status: status.data,
        lastErrorCode: job.data.last_error_code,
      };
    },
  };
}
