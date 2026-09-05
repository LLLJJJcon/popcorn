import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parsePublicLearningArtifactResult,
  parsePublicResolveSnapshotResult,
  publicFailureCategory,
  type PublicJobStatus,
} from "@/server/jobs/process-jobs";
import type { Database } from "@/types/database.generated";

type PublicJobStatusReader = (
  expectedUserId: string,
  jobId: string,
) => Promise<PublicJobStatus | null>;

export function createStatusReader(
  client: SupabaseClient<Database>,
): PublicJobStatusReader {
  return async (expectedUserId, jobId) => {
    const result = await client
      .from("knowledge_jobs")
      .select("id,user_id,status,job_type,last_error_code")
      .eq("user_id", expectedUserId)
      .eq("id", jobId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || result.data.user_id !== expectedUserId) return null;
    const status = result.data.status as PublicJobStatus["status"];
    let publicResult: PublicJobStatus["result"] = null;
    if (status === "succeeded") {
      const internal = await client
        .from("knowledge_job_internal")
        .select("result,user_id")
        .eq("user_id", expectedUserId)
        .eq("knowledge_job_id", jobId)
        .single();
      if (internal.error || internal.data.user_id !== expectedUserId) {
        throw internal.error ?? new Error("private job owner mismatch");
      }
      publicResult = result.data.job_type === "resolve_snapshot"
        ? parsePublicResolveSnapshotResult(internal.data.result)
        : parsePublicLearningArtifactResult(internal.data.result);
    }
    return {
      id: result.data.id,
      status,
      retryable: status === "pending" || status === "leased" || status === "retryable_failed",
      result: publicResult,
      failureCategory: publicFailureCategory(status, result.data.last_error_code),
    };
  };
}
