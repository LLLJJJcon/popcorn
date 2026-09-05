import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { CandidateExpressionListSchema } from "@/contracts/knowledge";
import { MasteryStateSchema } from "@/contracts/memory";
import { CanonicalYouTubeUrlSchema } from "@/contracts/source";
import {
  PracticeMaterialViewSchema,
  type PracticeMaterialTask,
  type PracticeMaterialView,
} from "@/features/practice/material-schema";
import { ANALYZE_SAVED_ITEM_PROMPT_VERSION } from "@/server/ai/prompts/analyze-saved-item.v1";
import type { Database } from "@/types/database.generated";

const UuidSchema = z.string().uuid();
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const CandidateContentSchema = z.strictObject({ candidates: CandidateExpressionListSchema });

const DraftRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  video_source_id: UuidSchema,
  saved_item_id: UuidSchema,
  candidate_artifact_id: UuidSchema,
  candidate_index: z.number().int().min(0).max(2),
  future_user_expression_id: UuidSchema,
  native_language: z.literal("en"),
  target_language: z.literal("zh-CN"),
  target_expression: z.string(),
  prompt_chinese: z.string(),
  instructions_english: z.string(),
  goal_english: z.string(),
  status: z.enum(["active", "completed", "abandoned"]),
  created_at: IsoDateTimeSchema,
});

const ArtifactRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  video_source_id: UuidSchema,
  saved_item_id: UuidSchema,
  artifact_type: z.literal("saved_item_analysis"),
  prompt_version: z.literal(ANALYZE_SAVED_ITEM_PROMPT_VERSION),
  content: z.unknown(),
});

const SavedRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  video_source_id: UuidSchema,
  snapshot_id: UuidSchema,
});

const SnapshotRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  video_source_id: UuidSchema,
  title: z.string().min(1).max(300),
});

const SourceRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  canonical_url: CanonicalYouTubeUrlSchema,
});

const ReviewRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  user_expression_id: UuidSchema,
  mastery_state: MasteryStateSchema,
  status: z.enum(["pending", "completed", "cancelled"]),
  due_at: IsoDateTimeSchema,
});

const TaskRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  user_expression_id: UuidSchema,
  review_task_id: UuidSchema,
  kind: z.literal("due_practice"),
  native_language: z.literal("en"),
  target_language: z.literal("zh-CN"),
  target_expression: z.string(),
  prompt_chinese: z.string(),
  instructions_english: z.string(),
  goal_english: z.string(),
  due_at: IsoDateTimeSchema,
  created_at: IsoDateTimeSchema,
});

const UserExpressionRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  expression_sense_id: UuidSchema,
  mastery_state: MasteryStateSchema,
});

const SenseRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  video_source_id: UuidSchema,
  expression_text: z.string(),
  english_meaning: z.string(),
  english_explanation: z.string(),
  tone: z.string(),
  communicative_function: z.string(),
  register: z.string(),
});

const OccurrenceRowSchema = z.strictObject({
  id: UuidSchema,
  user_id: UuidSchema,
  video_source_id: UuidSchema,
  expression_sense_id: UuidSchema,
  snapshot_id: UuidSchema,
  evidence_text: z.string(),
  start_seconds: z.number().finite(),
  created_at: IsoDateTimeSchema,
});

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  order(column: string, options: { readonly ascending: boolean }): QueryBuilder;
  limit(value: number): QueryBuilder;
  maybeSingle(): Promise<{ readonly data: unknown; readonly error: unknown }>;
};

async function one(query: QueryBuilder): Promise<unknown | null> {
  const result = await query.limit(1).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

function belongs(row: { readonly user_id: string }, userId: string): boolean {
  return row.user_id === userId;
}

function youtubeTimeUrl(canonicalUrl: string, seconds: number): string {
  const url = new URL(canonicalUrl);
  url.searchParams.set("t", `${Math.max(0, Math.floor(seconds))}s`);
  return url.toString();
}

function immediateTask(row: z.infer<typeof DraftRowSchema>): PracticeMaterialTask {
  return {
    id: row.id,
    userExpressionId: row.future_user_expression_id,
    kind: "use_it_now",
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    targetExpression: row.target_expression,
    promptChinese: row.prompt_chinese,
    instructionsEnglish: row.instructions_english,
    goalEnglish: row.goal_english,
    dueAt: null,
    createdAt: row.created_at,
  };
}

function dueTask(row: z.infer<typeof TaskRowSchema>): PracticeMaterialTask {
  return {
    id: row.id,
    userExpressionId: row.user_expression_id,
    kind: "due_practice",
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    targetExpression: row.target_expression,
    promptChinese: row.prompt_chinese,
    instructionsEnglish: row.instructions_english,
    goalEnglish: row.goal_english,
    dueAt: row.due_at,
    createdAt: row.created_at,
  };
}

export type PracticeMaterialRepository = {
  findImmediateMaterial(userId: string, taskId: string): Promise<PracticeMaterialView | null>;
  findDueMaterial(userId: string, reviewTaskId: string): Promise<PracticeMaterialView | null>;
};

export function createPracticeMaterialRepository(
  client: SupabaseClient<Database>,
): PracticeMaterialRepository {
  const from = (table: string) => client.from(table as never) as unknown as QueryBuilder;

  return {
    async findImmediateMaterial(userIdValue, taskIdValue) {
      const userId = UuidSchema.safeParse(userIdValue);
      const taskId = UuidSchema.safeParse(taskIdValue);
      if (!userId.success || !taskId.success) return null;
      const draft = DraftRowSchema.safeParse(await one(from("practice_drafts")
        .select("id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,created_at")
        .eq("user_id", userId.data).eq("id", taskId.data)));
      if (
        !draft.success || !belongs(draft.data, userId.data) ||
        draft.data.id !== taskId.data || draft.data.status === "abandoned"
      ) return null;

      const artifact = ArtifactRowSchema.safeParse(await one(from("generated_artifacts")
        .select("id,user_id,video_source_id,saved_item_id,artifact_type,prompt_version,content")
        .eq("user_id", userId.data).eq("id", draft.data.candidate_artifact_id)
        .eq("video_source_id", draft.data.video_source_id).eq("saved_item_id", draft.data.saved_item_id)
        .eq("artifact_type", "saved_item_analysis")));
      if (
        !artifact.success || !belongs(artifact.data, userId.data) ||
        artifact.data.id !== draft.data.candidate_artifact_id ||
        artifact.data.video_source_id !== draft.data.video_source_id ||
        artifact.data.saved_item_id !== draft.data.saved_item_id
      ) return null;
      const content = CandidateContentSchema.safeParse(artifact.data.content);
      const candidate = content.success ? content.data.candidates[draft.data.candidate_index] : undefined;
      if (!candidate || candidate.expression !== draft.data.target_expression) return null;

      const saved = SavedRowSchema.safeParse(await one(from("saved_items")
        .select("id,user_id,video_source_id,snapshot_id")
        .eq("user_id", userId.data).eq("id", draft.data.saved_item_id)
        .eq("video_source_id", draft.data.video_source_id)));
      if (
        !saved.success || !belongs(saved.data, userId.data) ||
        saved.data.id !== draft.data.saved_item_id ||
        saved.data.video_source_id !== draft.data.video_source_id
      ) return null;
      const snapshot = SnapshotRowSchema.safeParse(await one(from("video_snapshots")
        .select("id,user_id,video_source_id,title")
        .eq("user_id", userId.data).eq("id", saved.data.snapshot_id)
        .eq("video_source_id", draft.data.video_source_id)));
      const source = SourceRowSchema.safeParse(await one(from("video_sources")
        .select("id,user_id,canonical_url")
        .eq("user_id", userId.data).eq("id", draft.data.video_source_id)));
      if (
        !snapshot.success || !source.success || !belongs(snapshot.data, userId.data) || !belongs(source.data, userId.data) ||
        snapshot.data.id !== saved.data.snapshot_id ||
        snapshot.data.video_source_id !== draft.data.video_source_id ||
        source.data.id !== draft.data.video_source_id
      ) {
        return null;
      }

      return PracticeMaterialViewSchema.parse({
        task: immediateTask(draft.data),
        masteryState: "tried",
        source: {
          videoTitle: snapshot.data.title,
          youtubeUrl: youtubeTimeUrl(source.data.canonical_url, candidate.startSeconds),
          evidenceText: candidate.evidenceText,
          startSeconds: candidate.startSeconds,
        },
        expression: {
          englishMeaning: candidate.englishMeaning,
          englishExplanation: candidate.englishExplanation,
          tone: candidate.tone,
          communicativeFunction: candidate.communicativeFunction,
          register: candidate.register,
        },
      });
    },

    async findDueMaterial(userIdValue, reviewTaskIdValue) {
      const userId = UuidSchema.safeParse(userIdValue);
      const reviewTaskId = UuidSchema.safeParse(reviewTaskIdValue);
      if (!userId.success || !reviewTaskId.success) return null;
      const review = ReviewRowSchema.safeParse(await one(from("review_tasks")
        .select("id,user_id,user_expression_id,mastery_state,status,due_at")
        .eq("user_id", userId.data).eq("id", reviewTaskId.data)));
      if (
        !review.success || !belongs(review.data, userId.data) ||
        review.data.id !== reviewTaskId.data || review.data.status === "cancelled"
      ) return null;
      const task = TaskRowSchema.safeParse(await one(from("practice_tasks")
        .select("id,user_id,user_expression_id,review_task_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,created_at")
        .eq("user_id", userId.data).eq("review_task_id", review.data.id)
        .eq("user_expression_id", review.data.user_expression_id).eq("kind", "due_practice")));
      const expression = UserExpressionRowSchema.safeParse(await one(from("user_expressions")
        .select("id,user_id,expression_sense_id,mastery_state")
        .eq("user_id", userId.data).eq("id", review.data.user_expression_id)));
      if (
        !task.success || !expression.success || !belongs(task.data, userId.data) || !belongs(expression.data, userId.data) ||
        task.data.review_task_id !== review.data.id ||
        task.data.user_expression_id !== review.data.user_expression_id ||
        expression.data.id !== review.data.user_expression_id ||
        expression.data.mastery_state !== review.data.mastery_state ||
        Date.parse(task.data.due_at) !== Date.parse(review.data.due_at)
      ) return null;
      const sense = SenseRowSchema.safeParse(await one(from("expression_senses")
        .select("id,user_id,video_source_id,expression_text,english_meaning,english_explanation,tone,communicative_function,register")
        .eq("user_id", userId.data).eq("id", expression.data.expression_sense_id)));
      if (
        !sense.success || !belongs(sense.data, userId.data) ||
        sense.data.id !== expression.data.expression_sense_id ||
        task.data.target_expression !== sense.data.expression_text
      ) return null;
      const occurrence = OccurrenceRowSchema.safeParse(await one(from("expression_occurrences")
        .select("id,user_id,video_source_id,expression_sense_id,snapshot_id,evidence_text,start_seconds,created_at")
        .eq("user_id", userId.data).eq("expression_sense_id", sense.data.id)
        .eq("video_source_id", sense.data.video_source_id)
        .order("created_at", { ascending: true }).order("id", { ascending: true })));
      if (
        !occurrence.success || !belongs(occurrence.data, userId.data) ||
        occurrence.data.expression_sense_id !== sense.data.id ||
        occurrence.data.video_source_id !== sense.data.video_source_id
      ) return null;
      const snapshot = SnapshotRowSchema.safeParse(await one(from("video_snapshots")
        .select("id,user_id,video_source_id,title")
        .eq("user_id", userId.data).eq("id", occurrence.data.snapshot_id)
        .eq("video_source_id", sense.data.video_source_id)));
      const source = SourceRowSchema.safeParse(await one(from("video_sources")
        .select("id,user_id,canonical_url")
        .eq("user_id", userId.data).eq("id", sense.data.video_source_id)));
      if (
        !snapshot.success || !source.success || !belongs(snapshot.data, userId.data) || !belongs(source.data, userId.data) ||
        snapshot.data.id !== occurrence.data.snapshot_id ||
        snapshot.data.video_source_id !== sense.data.video_source_id ||
        source.data.id !== sense.data.video_source_id
      ) {
        return null;
      }
      return PracticeMaterialViewSchema.parse({
        task: dueTask(task.data),
        masteryState: expression.data.mastery_state,
        source: {
          videoTitle: snapshot.data.title,
          youtubeUrl: youtubeTimeUrl(source.data.canonical_url, occurrence.data.start_seconds),
          evidenceText: occurrence.data.evidence_text,
          startSeconds: occurrence.data.start_seconds,
        },
        expression: {
          englishMeaning: sense.data.english_meaning,
          englishExplanation: sense.data.english_explanation,
          tone: sense.data.tone,
          communicativeFunction: sense.data.communicative_function,
          register: sense.data.register,
        },
      });
    },
  };
}
