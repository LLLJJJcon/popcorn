import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";

import type { MasteryState } from "@/contracts/memory";
import { failure, success } from "@/server/api/respond";
import {
  createNextCookieAdapter,
  createWebSessionAuthenticator,
  type WebSessionResult,
} from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import type { Database } from "@/types/database.generated";

export type ExpressionAttemptView = {
  readonly id: string;
  readonly responseChinese: string;
  readonly passed: boolean;
  readonly accuracyScore: number;
  readonly accuracyFeedbackEnglish: string;
  readonly naturalnessScore: number;
  readonly naturalnessFeedbackEnglish: string;
  readonly contextualFitScore: number;
  readonly contextualFitFeedbackEnglish: string;
  readonly submittedAt: string;
};

export type ExpressionCardView = {
  readonly userExpressionId: string;
  readonly expression: string;
  readonly englishMeaning: string;
  readonly englishExplanation: string;
  readonly tone: string;
  readonly communicativeFunction: string;
  readonly register: string;
  readonly masteryState: MasteryState;
  readonly sourceDeleted: boolean;
  readonly sourceTitle: string | null;
  readonly occurrence: {
    readonly evidenceText: string;
    readonly segmentIds: readonly string[];
    readonly startSeconds: number;
    readonly endSeconds: number;
    readonly youtubeUrl: string;
  } | null;
  readonly attempts: readonly ExpressionAttemptView[];
};

export type ExpressionSuggestion = {
  readonly userExpressionId: string;
  readonly expression: string;
  readonly englishMeaning: string;
  readonly match: "exact" | "similar";
};

export type DuePracticeView = {
  readonly reviewTaskId: string;
  readonly userExpressionId: string;
  readonly expression: string;
  readonly englishMeaning: string;
  readonly masteryState: MasteryState;
  readonly dueAt: string;
  readonly intervalDays: number;
};

export type LearningMemoryRepository = {
  listVault(userId: string): Promise<readonly ExpressionCardView[]>;
  getVault(userId: string, userExpressionId: string): Promise<{
    readonly card: ExpressionCardView;
    readonly suggestions: readonly ExpressionSuggestion[];
  } | null>;
  listDue(userId: string, now: string): Promise<readonly DuePracticeView[]>;
};

type SuggestionCandidate = Omit<ExpressionSuggestion, "match">;

function trigrams(value: string): Set<string> {
  const normalized = value.normalize("NFKC").trim();
  const characters = [...normalized];
  const grams = new Set<string>();
  for (let index = 0; index <= characters.length - 3; index += 1) {
    grams.add(characters.slice(index, index + 3).join(""));
  }
  if (grams.size === 0 && normalized) grams.add(normalized);
  return grams;
}

function similarity(left: string, right: string): number {
  const leftText = left.normalize("NFKC").trim();
  const rightText = right.normalize("NFKC").trim();
  const shorter = [...leftText].length <= [...rightText].length ? leftText : rightText;
  const longer = shorter === leftText ? rightText : leftText;
  if ([...shorter].length < 3 && longer.includes(shorter)) {
    return (2 * [...shorter].length) / ([...leftText].length + [...rightText].length);
  }
  const a = trigrams(leftText);
  const b = trigrams(rightText);
  let overlap = 0;
  for (const item of a) if (b.has(item)) overlap += 1;
  return a.size + b.size === 0 ? 0 : (2 * overlap) / (a.size + b.size);
}

export function rankExpressionSuggestions(
  target: string,
  candidates: readonly SuggestionCandidate[],
  limit = 8,
): ExpressionSuggestion[] {
  const normalized = target.normalize("NFKC").trim();
  return candidates.map((candidate) => ({
    ...candidate,
    match: candidate.expression.normalize("NFKC").trim() === normalized
      ? "exact" as const
      : "similar" as const,
    score: similarity(normalized, candidate.expression),
  })).filter((candidate) => candidate.match === "exact" || candidate.score > 0)
    .toSorted((left, right) =>
      Number(right.match === "exact") - Number(left.match === "exact") ||
      right.score - left.score ||
      left.expression.localeCompare(right.expression, "zh-CN") ||
      left.userExpressionId.localeCompare(right.userExpressionId),
    ).slice(0, Math.max(0, Math.min(limit, 8))).map((candidate) => ({
      userExpressionId: candidate.userExpressionId,
      expression: candidate.expression,
      englishMeaning: candidate.englishMeaning,
      match: candidate.match,
    }));
}

type QueryResult = { readonly data: unknown[] | null; readonly error: unknown };

function rows(result: QueryResult): Record<string, unknown>[] {
  if (result.error) throw result.error;
  return (result.data ?? []) as Record<string, unknown>[];
}

function owned(rowsValue: readonly Record<string, unknown>[], userId: string): void {
  if (rowsValue.some((row) => row.user_id !== userId)) throw new Error("owner relation mismatch");
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`missing ${key}`);
  return value;
}

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number") throw new Error(`missing ${key}`);
  return value;
}

function attemptView(row: Record<string, unknown>): ExpressionAttemptView {
  return {
    id: text(row, "id"),
    responseChinese: text(row, "response_chinese"),
    passed: row.passed === true,
    accuracyScore: numberValue(row, "accuracy_score"),
    accuracyFeedbackEnglish: text(row, "accuracy_feedback_english"),
    naturalnessScore: numberValue(row, "naturalness_score"),
    naturalnessFeedbackEnglish: text(row, "naturalness_feedback_english"),
    contextualFitScore: numberValue(row, "contextual_fit_score"),
    contextualFitFeedbackEnglish: text(row, "contextual_fit_feedback_english"),
    submittedAt: text(row, "submitted_at"),
  };
}

function mergeAttemptHistory(
  ...groups: readonly (readonly Record<string, unknown>[])[]
): ExpressionAttemptView[] {
  const byId = new Map<string, ExpressionAttemptView>();
  for (const row of groups.flat()) {
    const attempt = attemptView(row);
    const existing = byId.get(attempt.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(attempt)) {
      throw new Error("attempt history mismatch");
    }
    byId.set(attempt.id, attempt);
  }
  return [...byId.values()].toSorted((left, right) =>
    left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id),
  );
}

export function createSupabaseReviewTaskRepository(
  client: SupabaseClient<Database>,
): LearningMemoryRepository {
  const db = client as unknown as {
    from(table: string): {
      select(columns: string): ReturnType<typeof db["from"]>;
      eq(column: string, value: unknown): ReturnType<typeof db["from"]>;
      in(column: string, values: readonly string[]): ReturnType<typeof db["from"]>;
      lte(column: string, value: string): ReturnType<typeof db["from"]>;
      order(column: string, options: { ascending: boolean }): ReturnType<typeof db["from"]>;
      limit(value: number): Promise<QueryResult>;
    };
  };

  async function queryVault(userId: string, userExpressionId?: string): Promise<ExpressionCardView[]> {
    let expressionQuery = db.from("user_expressions")
      .select("id,user_id,expression_sense_id,mastery_state,created_at")
      .eq("user_id", userId);
    if (userExpressionId) expressionQuery = expressionQuery.eq("id", userExpressionId);
    const expressions = rows(await expressionQuery.order("created_at", { ascending: false })
      .order("id", { ascending: true }).limit(100));
    owned(expressions, userId);
    if (expressions.length === 0) return [];
    const expressionIds = expressions.map((row) => text(row, "id"));
    const senseIds = expressions.map((row) => text(row, "expression_sense_id"));

    const senses = rows(await db.from("expression_senses")
      .select("id,user_id,video_source_id,source_deleted_at,expression_text,normalized_expression_text,english_meaning,english_explanation,tone,communicative_function,register")
      .eq("user_id", userId).in("id", senseIds).order("id", { ascending: true }).limit(100));
    owned(senses, userId);
    const activeSenseIds = senses.filter((row) => row.source_deleted_at === null)
      .map((row) => text(row, "id"));
    const activeSenseIdSet = new Set(activeSenseIds);
    const activeExpressionIds = expressions.filter((row) => activeSenseIdSet.has(text(row, "expression_sense_id")))
      .map((row) => text(row, "id"));
    const occurrences = activeSenseIds.length === 0 ? [] : rows(await db.from("expression_occurrences")
      .select("id,user_id,video_source_id,expression_sense_id,evidence_text,segment_ids,start_seconds,end_seconds,created_at")
      .eq("user_id", userId).in("expression_sense_id", activeSenseIds)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(300));
    const sourceIds = [...new Set(senses.flatMap((row) =>
      row.source_deleted_at === null && typeof row.video_source_id === "string" ? [row.video_source_id] : [],
    ))];
    const sources = sourceIds.length === 0 ? [] : rows(await db.from("video_sources")
      .select("id,user_id,canonical_url").eq("user_id", userId).in("id", sourceIds)
      .order("id", { ascending: true }).limit(100));
    const snapshots = sourceIds.length === 0 ? [] : rows(await db.from("video_snapshots")
      .select("id,user_id,video_source_id,title,captured_at")
      .eq("user_id", userId).in("video_source_id", sourceIds)
      .order("captured_at", { ascending: false }).order("id", { ascending: false }).limit(300));
    owned(snapshots, userId);
    const sourceIdSet = new Set(sourceIds);
    if (snapshots.some((row) => !sourceIdSet.has(text(row, "video_source_id")))) {
      throw new Error("incomplete expression evidence graph");
    }
    const latestSnapshotBySource = new Map<string, Record<string, unknown>>();
    for (const snapshot of snapshots) {
      const sourceId = text(snapshot, "video_source_id");
      text(snapshot, "id");
      text(snapshot, "captured_at");
      text(snapshot, "title");
      if (!latestSnapshotBySource.has(sourceId)) latestSnapshotBySource.set(sourceId, snapshot);
    }
    const draftAttempts = activeExpressionIds.length === 0 ? [] : rows(await db.from("practice_draft_attempts")
      .select("id,user_id,future_user_expression_id,response_chinese,passed,accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,submitted_at")
      .eq("user_id", userId).in("future_user_expression_id", activeExpressionIds)
      .order("submitted_at", { ascending: true }).order("id", { ascending: true }).limit(500));
    const canonicalAttempts = rows(await db.from("attempts")
      .select("id,user_id,user_expression_id,response_chinese,passed,accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,submitted_at")
      .eq("user_id", userId).in("user_expression_id", expressionIds)
      .order("submitted_at", { ascending: true }).order("id", { ascending: true }).limit(500));
    [occurrences, sources, canonicalAttempts, draftAttempts].forEach((value) => owned(value, userId));
    const expressionIdSet = new Set(expressionIds);
    const activeExpressionIdSet = new Set(activeExpressionIds);
    if (
      canonicalAttempts.some((row) => !expressionIdSet.has(text(row, "user_expression_id"))) ||
      draftAttempts.some((row) => !activeExpressionIdSet.has(text(row, "future_user_expression_id")))
    ) throw new Error("incomplete attempt history graph");

    return expressions.map((expression) => {
      const sense = senses.find((row) => row.id === expression.expression_sense_id);
      const occurrence = occurrences.find((row) => row.expression_sense_id === expression.expression_sense_id);
      const source = sense && sources.find((row) => row.id === sense.video_source_id);
      if (!sense || (sense.source_deleted_at !== null && typeof sense.source_deleted_at !== "string")) {
        throw new Error("incomplete expression evidence graph");
      }
      const sourceDeleted = typeof sense.source_deleted_at === "string";
      if (
        (sourceDeleted && (sense.video_source_id !== null || occurrence || source)) ||
        (!sourceDeleted && (!occurrence || !source || occurrence.video_source_id !== sense.video_source_id))
      ) throw new Error("incomplete expression evidence graph");
      const canonicalExpressionAttempts = canonicalAttempts
        .filter((row) => row.user_expression_id === expression.id);
      const expressionAttempts = sourceDeleted
        ? mergeAttemptHistory(canonicalExpressionAttempts)
        : mergeAttemptHistory(
          draftAttempts.filter((row) => row.future_user_expression_id === expression.id),
          canonicalExpressionAttempts,
        );
      const snapshot = sourceDeleted ? undefined : latestSnapshotBySource.get(text(sense, "video_source_id"));
      const sourceOccurrence = sourceDeleted ? null : (() => {
        const startSeconds = numberValue(occurrence!, "start_seconds");
        const canonicalUrl = text(source!, "canonical_url");
        return {
          evidenceText: text(occurrence!, "evidence_text"),
          segmentIds: occurrence!.segment_ids as string[],
          startSeconds,
          endSeconds: numberValue(occurrence!, "end_seconds"),
          youtubeUrl: `${canonicalUrl}&t=${Math.floor(startSeconds)}s`,
        };
      })();
      return {
        userExpressionId: text(expression, "id"),
        expression: text(sense, "expression_text"),
        englishMeaning: text(sense, "english_meaning"),
        englishExplanation: text(sense, "english_explanation"),
        tone: text(sense, "tone"),
        communicativeFunction: text(sense, "communicative_function"),
        register: text(sense, "register"),
        masteryState: text(expression, "mastery_state") as MasteryState,
        sourceDeleted,
        sourceTitle: snapshot ? text(snapshot, "title") : null,
        occurrence: sourceOccurrence,
        attempts: expressionAttempts,
      };
    });
  }

  return {
    listVault: queryVault,
    async getVault(userId, userExpressionId) {
      const card = (await queryVault(userId, userExpressionId))[0];
      if (!card) return null;
      const bounded = await queryVault(userId);
      return {
        card,
        suggestions: rankExpressionSuggestions(card.expression, bounded
          .filter((value) => value.userExpressionId !== card.userExpressionId)
          .map((value) => ({
            userExpressionId: value.userExpressionId,
            expression: value.expression,
            englishMeaning: value.englishMeaning,
          }))),
      };
    },
    async listDue(userId, now) {
      const reviewRows = rows(await db.from("review_tasks")
        .select("id,user_id,user_expression_id,mastery_state,status,due_at,interval_days")
        .eq("user_id", userId).eq("status", "pending").lte("due_at", now)
        .order("due_at", { ascending: true }).order("id", { ascending: true }).limit(100));
      owned(reviewRows, userId);
      if (reviewRows.length === 0) return [];
      const expressionIds = reviewRows.map((row) => text(row, "user_expression_id"));
      const expressions = rows(await db.from("user_expressions")
        .select("id,user_id,expression_sense_id,mastery_state").eq("user_id", userId)
        .in("id", expressionIds).order("id", { ascending: true }).limit(100));
      owned(expressions, userId);
      const senses = rows(await db.from("expression_senses")
        .select("id,user_id,expression_text,english_meaning").eq("user_id", userId)
        .in("id", expressions.map((row) => text(row, "expression_sense_id")))
        .order("id", { ascending: true }).limit(100));
      owned(senses, userId);
      return reviewRows.map((review) => {
        const expression = expressions.find((row) => row.id === review.user_expression_id);
        const sense = expression && senses.find((row) => row.id === expression.expression_sense_id);
        if (!expression || !sense || expression.mastery_state !== review.mastery_state) {
          throw new Error("incomplete due practice graph");
        }
        return {
          reviewTaskId: text(review, "id"),
          userExpressionId: text(expression, "id"),
          expression: text(sense, "expression_text"),
          englishMeaning: text(sense, "english_meaning"),
          masteryState: text(review, "mastery_state") as MasteryState,
          dueAt: text(review, "due_at"),
          intervalDays: numberValue(review, "interval_days"),
        };
      });
    },
  };
}

function authFailure(session: WebSessionResult, requestId: string): Response | null {
  if (session.ok) return null;
  return Response.json(failure({
    code: session.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
    message: session.reason === "missing" ? "Authentication is required" : "Your session has expired",
    retryable: false,
  }, requestId), { status: 401, headers: { "Cache-Control": "no-store" } });
}

export function createLearningMemoryHttpHandlers(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly repository: LearningMemoryRepository;
  readonly now: () => string;
  readonly requestId: () => string;
}) {
  async function session(request: Request) {
    const requestId = dependencies.requestId();
    const authenticated = await dependencies.authenticate(request);
    return { requestId, authenticated, failure: authFailure(authenticated, requestId) };
  }
  return {
    async vault(request: Request) {
      const current = await session(request);
      if (!current.authenticated.ok) return current.failure!;
      return Response.json(success(await dependencies.repository.listVault(current.authenticated.userId), current.requestId), {
        headers: { "Cache-Control": "no-store" },
      });
    },
    async vaultDetail(request: Request, context: { readonly params: Promise<{ readonly userExpressionId?: string }> }) {
      const current = await session(request);
      if (!current.authenticated.ok) return current.failure!;
      const id = z.string().uuid().safeParse((await context.params).userExpressionId);
      const result = id.success
        ? await dependencies.repository.getVault(current.authenticated.userId, id.data)
        : null;
      if (!result) return Response.json(failure({ code: "FORBIDDEN", message: "Vault expression not found", retryable: false }, current.requestId), {
        status: 404, headers: { "Cache-Control": "no-store" },
      });
      return Response.json(success(result, current.requestId), { headers: { "Cache-Control": "no-store" } });
    },
    async due(request: Request) {
      const current = await session(request);
      if (!current.authenticated.ok) return current.failure!;
      return Response.json(success(await dependencies.repository.listDue(current.authenticated.userId, dependencies.now()), current.requestId), {
        headers: { "Cache-Control": "no-store" },
      });
    },
  };
}

export async function createLearningMemoryRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:",
    cookieAdapter: async () => createNextCookieAdapter(await cookies()),
  });
  const client = createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { authenticate, repository: createSupabaseReviewTaskRepository(client), appUrl: environment.APP_URL };
}
