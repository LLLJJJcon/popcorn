import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";

export type SourceDeletionMode = "remove_unpracticed_source" | "remove_source_keep_evidence";

export type DeletionImpact = {
  readonly videoSourceId: string;
  readonly videoTitle: string;
  readonly savedCount: number;
  readonly affectedExpressionCount: number;
  readonly mode: SourceDeletionMode;
};

export type SourceDeletionResult = {
  readonly deleted: true;
  readonly retainedUserExpressionCount: number;
};

export interface SourceDeletionRepository {
  findOwnedSource(userId: string, videoSourceId: string): Promise<{
    readonly videoSourceId: string;
    readonly videoTitle: string;
  } | null>;
  countSavedItems(userId: string, videoSourceId: string): Promise<number>;
  countPromotedExpressions(userId: string, videoSourceId: string): Promise<number>;
  deleteVideoSource(input: {
    readonly userId: string;
    readonly videoSourceId: string;
    readonly mode: SourceDeletionMode;
    readonly now: string;
  }): Promise<SourceDeletionResult>;
}

function boundedCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("invalid deletion count");
  return value;
}

export function createSourceDeletionPlanner(repository: SourceDeletionRepository) {
  return {
    async preview(userId: string, videoSourceId: string): Promise<DeletionImpact | null> {
      const source = await repository.findOwnedSource(userId, videoSourceId);
      if (!source || source.videoSourceId !== videoSourceId) return null;
      const [savedCount, affectedExpressionCount] = await Promise.all([
        repository.countSavedItems(userId, videoSourceId),
        repository.countPromotedExpressions(userId, videoSourceId),
      ]);
      const promoted = boundedCount(affectedExpressionCount);
      return {
        videoSourceId,
        videoTitle: source.videoTitle,
        savedCount: boundedCount(savedCount),
        affectedExpressionCount: promoted,
        mode: promoted === 0 ? "remove_unpracticed_source" : "remove_source_keep_evidence",
      };
    },
  };
}

type QueryResult = {
  readonly data: unknown[] | null;
  readonly count: number | null;
  readonly error: unknown;
};

function queryRows(result: QueryResult): Record<string, unknown>[] {
  if (result.error) throw new Error("source deletion preview failed");
  return (result.data ?? []) as Record<string, unknown>[];
}

function queryCount(result: QueryResult): number {
  if (result.error || result.count === null) throw new Error("source deletion preview failed");
  return boundedCount(result.count);
}

export function createSupabaseSourceDeletionRepository(
  client: SupabaseClient<Database>,
): SourceDeletionRepository {
  const db = client as unknown as {
    from(table: string): {
      select(columns: string, options?: { readonly count: "exact"; readonly head: true }): ReturnType<typeof db["from"]>;
      eq(column: string, value: unknown): ReturnType<typeof db["from"]>;
      order(column: string, options: { readonly ascending: boolean }): ReturnType<typeof db["from"]>;
      limit(value: number): Promise<QueryResult>;
    };
    rpc(name: string, input: Record<string, unknown>): Promise<{
      readonly data: unknown[] | null;
      readonly error: unknown;
    }>;
  };

  return {
    async findOwnedSource(userId, videoSourceId) {
      const sourceRows = queryRows(await db.from("video_sources")
        .select("id,user_id").eq("user_id", userId).eq("id", videoSourceId).limit(1));
      const source = sourceRows[0];
      if (!source) return null;
      if (sourceRows.length !== 1 || source.id !== videoSourceId || source.user_id !== userId) {
        throw new Error("source deletion owner mismatch");
      }
      const snapshotRows = queryRows(await db.from("video_snapshots")
        .select("title,user_id").eq("user_id", userId).eq("video_source_id", videoSourceId)
        .order("captured_at", { ascending: false }).limit(1));
      const snapshot = snapshotRows[0];
      if (snapshot && snapshot.user_id !== userId) throw new Error("source deletion owner mismatch");
      const title = snapshot?.title;
      return {
        videoSourceId,
        videoTitle: typeof title === "string" && title.trim() ? title : "Saved YouTube video",
      };
    },
    async countSavedItems(userId, videoSourceId) {
      return queryCount(await db.from("saved_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("video_source_id", videoSourceId).limit(1));
    },
    async countPromotedExpressions(userId, videoSourceId) {
      return queryCount(await db.from("user_expressions")
        .select("id,expression_senses!inner(video_source_id,user_id)", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("expression_senses.user_id", userId)
        .eq("expression_senses.video_source_id", videoSourceId)
        .limit(1));
    },
    async deleteVideoSource(input) {
      const result = await db.rpc("delete_video_source", {
        p_user_id: input.userId,
        p_video_source_id: input.videoSourceId,
        p_mode: input.mode,
        p_now: input.now,
      });
      if (result.error) throw new Error("source deletion failed");
      const values = (result.data ?? []) as Record<string, unknown>[];
      const row = values[0];
      if (
        values.length !== 1 || row?.deleted !== true ||
        typeof row.retained_user_expression_count !== "number"
      ) throw new Error("source deletion returned an invalid receipt");
      return {
        deleted: true,
        retainedUserExpressionCount: boundedCount(row.retained_user_expression_count),
      };
    },
  };
}
