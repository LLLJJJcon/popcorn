import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { ProgressSummarySchema, type ProgressSummary } from "@/features/progress/schema";
import { failure, success } from "@/server/api/respond";
import {
  createNextCookieAdapter,
  createWebSessionAuthenticator,
  type WebSessionResult,
} from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import type { Database } from "@/types/database.generated";

const MAX_EVIDENCE_ROWS = 500;
const QUERY_LIMIT = MAX_EVIDENCE_ROWS + 1;
const REUSE_EVIDENCE = new Set(["successful_independent_transfer", "owned_threshold_met"]);

export type ProgressAttemptRow = {
  readonly id: string;
  readonly userId: string;
  readonly userExpressionId: string;
  readonly practiceTaskId: string;
  readonly passed: boolean;
  readonly independentUse: boolean;
  readonly assistanceLevel: string;
  readonly submittedAt: string;
};

export type ProgressPracticeTaskRow = {
  readonly id: string;
  readonly userId: string;
  readonly userExpressionId: string;
  readonly reviewTaskId: string | null;
  readonly kind: string;
};

export type ProgressMasteryEventRow = {
  readonly id: string;
  readonly userId: string;
  readonly userExpressionId: string;
  readonly attemptId: string | null;
  readonly evidenceKind: string;
  readonly occurredAt: string;
};

export type ProgressReviewRow = {
  readonly id: string;
  readonly userId: string;
  readonly userExpressionId: string;
  readonly status: string;
  readonly dueAt: string;
  readonly completedAt: string | null;
  readonly completedAttemptId: string | null;
};

export type ProgressUserExpressionRow = {
  readonly id: string;
  readonly userId: string;
  readonly masteryState: string;
};

type WindowQuery = {
  readonly userId: string;
  readonly start: string;
  readonly end: string;
  readonly limit: number;
};

export interface ProgressEvidenceSource {
  listAttempts(query: WindowQuery): Promise<readonly ProgressAttemptRow[]>;
  listPracticeTasks(query: {
    readonly userId: string;
    readonly ids: readonly string[];
    readonly reviewIds?: readonly string[];
    readonly limit: number;
  }): Promise<readonly ProgressPracticeTaskRow[]>;
  listMasteryEvents(query: WindowQuery & {
    readonly attemptIds: readonly string[];
  }): Promise<readonly ProgressMasteryEventRow[]>;
  listCompletedReviews(query: WindowQuery): Promise<readonly ProgressReviewRow[]>;
  listDueReviews(query: {
    readonly userId: string;
    readonly now: string;
    readonly limit: number;
  }): Promise<readonly ProgressReviewRow[]>;
  listUserExpressions(query: {
    readonly userId: string;
    readonly limit: number;
  }): Promise<readonly ProgressUserExpressionRow[]>;
}

export interface ProgressRepository {
  read(userId: string, now: string): Promise<ProgressSummary>;
}

function utcWeek(now: string): { readonly startsAt: string; readonly endsAt: string } {
  const milliseconds = Date.parse(now);
  if (!Number.isFinite(milliseconds)) throw new RangeError("progress clock must be valid");
  const date = new Date(milliseconds);
  const dayFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - dayFromMonday);
  const startsAt = date.toISOString();
  date.setUTCDate(date.getUTCDate() + 7);
  return { startsAt, endsAt: date.toISOString() };
}

function checkedRows<T extends { readonly userId: string }>(
  rows: readonly T[],
  userId: string,
): readonly T[] {
  if (rows.length > MAX_EVIDENCE_ROWS) throw new Error("progress evidence exceeds bound");
  if (rows.some((row) => row.userId !== userId)) throw new Error("owner relation mismatch");
  return rows;
}

function exactlyOne<T extends { readonly id: string }>(
  rows: readonly T[],
  label: string,
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const row of rows) {
    if (byId.has(row.id)) throw new Error(`duplicate ${label} evidence`);
    byId.set(row.id, row);
  }
  return byId;
}

function deduplicatePracticeTasks(
  rows: readonly ProgressPracticeTaskRow[],
): readonly ProgressPracticeTaskRow[] {
  const byId = new Map<string, ProgressPracticeTaskRow>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, row);
      continue;
    }
    if (
      existing.userId !== row.userId ||
      existing.userExpressionId !== row.userExpressionId ||
      existing.reviewTaskId !== row.reviewTaskId ||
      existing.kind !== row.kind
    ) throw new Error("conflicting practice task evidence");
  }
  return [...byId.values()];
}

function validateEvidenceGraph(input: {
  readonly attempts: readonly ProgressAttemptRow[];
  readonly tasks: readonly ProgressPracticeTaskRow[];
  readonly events: readonly ProgressMasteryEventRow[];
  readonly completions: readonly ProgressReviewRow[];
  readonly due: readonly ProgressReviewRow[];
}) {
  const attemptsById = exactlyOne(input.attempts, "attempt");
  const tasksById = exactlyOne(input.tasks, "practice task");
  const eventsByAttemptId = new Map<string, ProgressMasteryEventRow>();
  const reviewsById = exactlyOne([...input.completions, ...input.due], "review");
  const tasksByReviewId = new Map<string, ProgressPracticeTaskRow>();

  for (const task of input.tasks) {
    if (task.kind !== "use_it_now" && task.kind !== "due_practice") {
      throw new Error("invalid practice task evidence");
    }
    if (task.reviewTaskId === null) {
      if (task.kind === "due_practice") throw new Error("incomplete practice task evidence");
      continue;
    }
    const review = reviewsById.get(task.reviewTaskId);
    if (
      task.kind !== "due_practice" || tasksByReviewId.has(task.reviewTaskId) || !review ||
      task.userExpressionId !== review.userExpressionId
    ) {
      throw new Error("incomplete practice task evidence");
    }
    tasksByReviewId.set(task.reviewTaskId, task);
  }

  for (const event of input.events) {
    if (!event.attemptId || eventsByAttemptId.has(event.attemptId)) {
      throw new Error("incomplete mastery evidence graph");
    }
    const attempt = attemptsById.get(event.attemptId);
    if (!attempt || event.userExpressionId !== attempt.userExpressionId) {
      throw new Error("incomplete mastery evidence graph");
    }
    eventsByAttemptId.set(event.attemptId, event);
  }

  for (const attempt of input.attempts) {
    const task = tasksById.get(attempt.practiceTaskId);
    const event = eventsByAttemptId.get(attempt.id);
    if (!task || !event || task.userExpressionId !== attempt.userExpressionId) {
      throw new Error("incomplete progress evidence graph");
    }

    if (task.kind === "use_it_now") {
      if (task.reviewTaskId !== null || event.evidenceKind !== "valid_original_attempt") {
        throw new Error("invalid original attempt evidence");
      }
      continue;
    }

    const review = task.reviewTaskId ? reviewsById.get(task.reviewTaskId) : undefined;
    const isCompletedAttempt = review?.status === "completed" &&
      review.completedAt === attempt.submittedAt && review.completedAttemptId === attempt.id;
    if (!review || review.userExpressionId !== attempt.userExpressionId || !isCompletedAttempt) {
      throw new Error("incomplete due practice evidence");
    }

    const isIndependentPass = attempt.passed && attempt.independentUse && attempt.assistanceLevel === "none";
    if (REUSE_EVIDENCE.has(event.evidenceKind)) {
      if (!isIndependentPass) {
        throw new Error("invalid independent reuse evidence");
      }
    } else if (event.evidenceKind === "failed_or_assisted_reuse") {
      if (isIndependentPass) {
        throw new Error("invalid assisted reuse evidence");
      }
    } else {
      throw new Error("unexpected mastery evidence");
    }
  }

  for (const review of input.completions) {
    const task = tasksByReviewId.get(review.id);
    const attempt = review.completedAttemptId ? attemptsById.get(review.completedAttemptId) : undefined;
    if (
      review.status !== "completed" || !review.completedAt || !attempt || !task ||
      review.userExpressionId !== task.userExpressionId ||
      attempt.userExpressionId !== review.userExpressionId || attempt.practiceTaskId !== task.id ||
      attempt.submittedAt !== review.completedAt
    ) throw new Error("incomplete due completion evidence");
  }

  for (const review of input.due) {
    const task = tasksByReviewId.get(review.id);
    if (
      review.status !== "pending" || review.completedAt || review.completedAttemptId
    ) throw new Error("invalid pending review evidence");
    if (
      task && (task.kind !== "due_practice" || task.reviewTaskId !== review.id ||
        review.userExpressionId !== task.userExpressionId)
    ) throw new Error("invalid pending review evidence");
  }

  return { attemptsById, eventsByAttemptId };
}

export function createProgressRepository(source: ProgressEvidenceSource): ProgressRepository {
  return {
    async read(userId, now) {
      const week = utcWeek(now);
      const attempts = checkedRows(await source.listAttempts({
        userId,
        start: week.startsAt,
        end: week.endsAt,
        limit: QUERY_LIMIT,
      }), userId);
      const attemptIds = attempts.map(({ id }) => id);
      const [eventsValue, completionsValue, dueValue, expressionsValue] = await Promise.all([
        source.listMasteryEvents({
          userId,
          start: week.startsAt,
          end: week.endsAt,
          attemptIds,
          limit: QUERY_LIMIT,
        }),
        source.listCompletedReviews({
          userId,
          start: week.startsAt,
          end: week.endsAt,
          limit: QUERY_LIMIT,
        }),
        source.listDueReviews({ userId, now: new Date(Date.parse(now)).toISOString(), limit: QUERY_LIMIT }),
        source.listUserExpressions({ userId, limit: QUERY_LIMIT }),
      ]);
      const events = checkedRows(eventsValue, userId);
      const completions = checkedRows(completionsValue, userId);
      const due = checkedRows(dueValue, userId);
      const expressions = checkedRows(expressionsValue, userId);

      const tasks = checkedRows(await source.listPracticeTasks({
        userId,
        ids: [...new Set(attempts.map(({ practiceTaskId }) => practiceTaskId))],
        reviewIds: [...new Set([...completions, ...due].map(({ id }) => id))],
        limit: QUERY_LIMIT,
      }), userId);

      const { eventsByAttemptId } = validateEvidenceGraph({ attempts, tasks, events, completions, due });
      const independentReuseCount = [...eventsByAttemptId.values()]
        .filter((event) => REUSE_EVIDENCE.has(event.evidenceKind)).length;

      const masteryDistribution = { tried: 0, reused: 0, owned: 0 };
      for (const expression of expressions) {
        if (!(expression.masteryState in masteryDistribution)) {
          throw new Error("invalid mastery projection");
        }
        masteryDistribution[expression.masteryState as keyof typeof masteryDistribution] += 1;
      }

      return ProgressSummarySchema.parse({
        week,
        weeklyAttemptCount: attempts.length,
        dueCompletionCount: completions.length,
        independentReuseCount,
        duePracticeCount: due.length,
        masteryDistribution,
      });
    },
  };
}

function records<T>(result: { readonly data: readonly T[] | null; readonly error: unknown }): readonly T[] {
  if (result.error) throw new Error("progress evidence query failed");
  return result.data ?? [];
}

export function createSupabaseProgressEvidenceSource(
  client: SupabaseClient<Database>,
): ProgressEvidenceSource {
  return {
    async listAttempts({ userId, start, end, limit }) {
      const result = await client.from("attempts")
        .select("id,user_id,user_expression_id,practice_task_id,passed,independent_use,assistance_level,submitted_at")
        .eq("user_id", userId).gte("submitted_at", start).lt("submitted_at", end)
        .order("submitted_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: row.id,
        userId: row.user_id,
        userExpressionId: row.user_expression_id,
        practiceTaskId: row.practice_task_id,
        passed: row.passed,
        independentUse: row.independent_use,
        assistanceLevel: row.assistance_level,
        submittedAt: row.submitted_at,
      }));
    },
    async listPracticeTasks({ userId, ids, reviewIds = [], limit }) {
      const select = "id,user_id,user_expression_id,review_task_id,kind";
      const [byId, byReviewId] = await Promise.all([
        ids.length === 0
          ? Promise.resolve([])
          : client.from("practice_tasks").select(select).eq("user_id", userId).in("id", ids)
            .order("id", { ascending: true }).limit(limit).then(records),
        reviewIds.length === 0
          ? Promise.resolve([])
          : client.from("practice_tasks").select(select).eq("user_id", userId).in("review_task_id", reviewIds)
            .order("review_task_id", { ascending: true }).order("id", { ascending: true }).limit(limit).then(records),
      ]);
      return deduplicatePracticeTasks([...byId, ...byReviewId].map((row) => ({
        id: row.id,
        userId: row.user_id,
        userExpressionId: row.user_expression_id,
        reviewTaskId: row.review_task_id,
        kind: row.kind,
      })));
    },
    async listMasteryEvents({ userId, attemptIds, limit }) {
      if (attemptIds.length === 0) return [];
      const result = await client.from("mastery_events")
        .select("id,user_id,user_expression_id,attempt_id,evidence_kind,occurred_at")
        .eq("user_id", userId).in("attempt_id", attemptIds)
        .order("occurred_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: row.id,
        userId: row.user_id,
        userExpressionId: row.user_expression_id,
        attemptId: row.attempt_id,
        evidenceKind: row.evidence_kind,
        occurredAt: row.occurred_at,
      }));
    },
    async listCompletedReviews({ userId, start, end, limit }) {
      const result = await client.from("review_tasks")
        .select("id,user_id,user_expression_id,status,due_at,completed_at,completed_attempt_id")
        .eq("user_id", userId).eq("status", "completed")
        .gte("completed_at", start).lt("completed_at", end)
        .order("completed_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: row.id,
        userId: row.user_id,
        userExpressionId: row.user_expression_id,
        status: row.status,
        dueAt: row.due_at,
        completedAt: row.completed_at,
        completedAttemptId: row.completed_attempt_id,
      }));
    },
    async listDueReviews({ userId, now, limit }) {
      const result = await client.from("review_tasks")
        .select("id,user_id,user_expression_id,status,due_at,completed_at,completed_attempt_id")
        .eq("user_id", userId).eq("status", "pending").lte("due_at", now)
        .order("due_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: row.id,
        userId: row.user_id,
        userExpressionId: row.user_expression_id,
        status: row.status,
        dueAt: row.due_at,
        completedAt: row.completed_at,
        completedAttemptId: row.completed_attempt_id,
      }));
    },
    async listUserExpressions({ userId, limit }) {
      const result = await client.from("user_expressions").select("id,user_id,mastery_state")
        .eq("user_id", userId).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: row.id,
        userId: row.user_id,
        masteryState: row.mastery_state,
      }));
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

export function createProgressHttpHandlers(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly repository: ProgressRepository;
  readonly now: () => string;
  readonly requestId: () => string;
}) {
  return {
    async get(request: Request) {
      const requestId = dependencies.requestId();
      const session = await dependencies.authenticate(request);
      const denied = authFailure(session, requestId);
      if (!session.ok) return denied!;
      try {
        const data = await dependencies.repository.read(session.userId, dependencies.now());
        return Response.json(success(data, requestId), { headers: { "Cache-Control": "no-store" } });
      } catch {
        return Response.json(failure({
          code: "INTERNAL_ERROR",
          message: "Progress is temporarily unavailable",
          retryable: true,
        }, requestId), { status: 500, headers: { "Cache-Control": "no-store" } });
      }
    },
  };
}

export async function createProgressRuntime() {
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
  return {
    appUrl: environment.APP_URL,
    authenticate,
    repository: createProgressRepository(createSupabaseProgressEvidenceSource(client)),
  };
}
