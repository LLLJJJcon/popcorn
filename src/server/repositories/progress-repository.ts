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

const MAX_EVIDENCE_ROWS = 1_000;
const QUERY_LIMIT = MAX_EVIDENCE_ROWS + 1;
const REUSE_EVIDENCE = new Set(["successful_independent_transfer", "owned_threshold_met"]);

export type ProgressAttemptRow = {
  readonly id: string;
  readonly userId: string;
  readonly practiceTaskId: string;
  readonly passed: boolean;
  readonly independentUse: boolean;
  readonly assistanceLevel: string;
  readonly submittedAt: string;
};

export type ProgressPracticeTaskRow = {
  readonly id: string;
  readonly userId: string;
  readonly kind: string;
};

export type ProgressMasteryEventRow = {
  readonly id: string;
  readonly userId: string;
  readonly attemptId: string | null;
  readonly evidenceKind: string;
  readonly occurredAt: string;
};

export type ProgressReviewRow = {
  readonly id: string;
  readonly userId: string;
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
      const taskIds = [...new Set(attempts.map(({ practiceTaskId }) => practiceTaskId))];
      const [tasksValue, eventsValue, completionsValue, dueValue, expressionsValue] = await Promise.all([
        source.listPracticeTasks({ userId, ids: taskIds, limit: QUERY_LIMIT }),
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
      const tasks = checkedRows(tasksValue, userId);
      const events = checkedRows(eventsValue, userId);
      const completions = checkedRows(completionsValue, userId);
      const due = checkedRows(dueValue, userId);
      const expressions = checkedRows(expressionsValue, userId);

      const attemptsById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
      const dueTaskIds = new Set(tasks.filter(({ kind }) => kind === "due_practice").map(({ id }) => id));
      const reuseAttemptIds = new Set(events.flatMap((event) => {
        if (!REUSE_EVIDENCE.has(event.evidenceKind)) return [];
        if (!event.attemptId || !attemptsById.has(event.attemptId)) {
          throw new Error("incomplete mastery evidence graph");
        }
        return [event.attemptId];
      }));
      const independentReuseCount = [...reuseAttemptIds].filter((attemptId) => {
        const attempt = attemptsById.get(attemptId)!;
        return dueTaskIds.has(attempt.practiceTaskId) && attempt.passed && attempt.independentUse &&
          attempt.assistanceLevel === "none";
      }).length;

      for (const review of completions) {
        if (review.status !== "completed" || !review.completedAt || !review.completedAttemptId) {
          throw new Error("incomplete due completion evidence");
        }
        const attempt = attemptsById.get(review.completedAttemptId);
        if (!attempt || attempt.submittedAt !== review.completedAt) {
          throw new Error("incomplete due completion evidence");
        }
      }
      if (due.some((review) => review.status !== "pending" || review.completedAt || review.completedAttemptId)) {
        throw new Error("invalid pending review evidence");
      }

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

type QueryResult = { readonly data: unknown[] | null; readonly error: unknown };
type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  gte(column: string, value: string): QueryBuilder;
  lt(column: string, value: string): QueryBuilder;
  lte(column: string, value: string): QueryBuilder;
  in(column: string, values: readonly string[]): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(value: number): Promise<QueryResult>;
};

function records(result: QueryResult): Record<string, unknown>[] {
  if (result.error) throw new Error("progress evidence query failed");
  return (result.data ?? []) as Record<string, unknown>[];
}

function stringValue(row: Record<string, unknown>, key: string): string {
  if (typeof row[key] !== "string") throw new Error("malformed progress evidence");
  return row[key];
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  if (row[key] === null) return null;
  return stringValue(row, key);
}

function booleanValue(row: Record<string, unknown>, key: string): boolean {
  if (typeof row[key] !== "boolean") throw new Error("malformed progress evidence");
  return row[key];
}

export function createSupabaseProgressEvidenceSource(
  client: SupabaseClient<Database>,
): ProgressEvidenceSource {
  const db = client as unknown as { from(table: string): QueryBuilder };
  return {
    async listAttempts({ userId, start, end, limit }) {
      const result = await db.from("attempts")
        .select("id,user_id,practice_task_id,passed,independent_use,assistance_level,submitted_at")
        .eq("user_id", userId).gte("submitted_at", start).lt("submitted_at", end)
        .order("submitted_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: stringValue(row, "id"),
        userId: stringValue(row, "user_id"),
        practiceTaskId: stringValue(row, "practice_task_id"),
        passed: booleanValue(row, "passed"),
        independentUse: booleanValue(row, "independent_use"),
        assistanceLevel: stringValue(row, "assistance_level"),
        submittedAt: stringValue(row, "submitted_at"),
      }));
    },
    async listPracticeTasks({ userId, ids, limit }) {
      if (ids.length === 0) return [];
      const result = await db.from("practice_tasks").select("id,user_id,kind")
        .eq("user_id", userId).in("id", ids).eq("kind", "due_practice")
        .order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: stringValue(row, "id"),
        userId: stringValue(row, "user_id"),
        kind: stringValue(row, "kind"),
      }));
    },
    async listMasteryEvents({ userId, start, end, attemptIds, limit }) {
      if (attemptIds.length === 0) return [];
      const result = await db.from("mastery_events")
        .select("id,user_id,attempt_id,evidence_kind,occurred_at")
        .eq("user_id", userId).gte("occurred_at", start).lt("occurred_at", end)
        .in("attempt_id", attemptIds).in("evidence_kind", [...REUSE_EVIDENCE])
        .order("occurred_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: stringValue(row, "id"),
        userId: stringValue(row, "user_id"),
        attemptId: nullableString(row, "attempt_id"),
        evidenceKind: stringValue(row, "evidence_kind"),
        occurredAt: stringValue(row, "occurred_at"),
      }));
    },
    async listCompletedReviews({ userId, start, end, limit }) {
      const result = await db.from("review_tasks")
        .select("id,user_id,status,due_at,completed_at,completed_attempt_id")
        .eq("user_id", userId).eq("status", "completed")
        .gte("completed_at", start).lt("completed_at", end)
        .order("completed_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: stringValue(row, "id"),
        userId: stringValue(row, "user_id"),
        status: stringValue(row, "status"),
        dueAt: stringValue(row, "due_at"),
        completedAt: nullableString(row, "completed_at"),
        completedAttemptId: nullableString(row, "completed_attempt_id"),
      }));
    },
    async listDueReviews({ userId, now, limit }) {
      const result = await db.from("review_tasks")
        .select("id,user_id,status,due_at,completed_at,completed_attempt_id")
        .eq("user_id", userId).eq("status", "pending").lte("due_at", now)
        .order("due_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: stringValue(row, "id"),
        userId: stringValue(row, "user_id"),
        status: stringValue(row, "status"),
        dueAt: stringValue(row, "due_at"),
        completedAt: nullableString(row, "completed_at"),
        completedAttemptId: nullableString(row, "completed_attempt_id"),
      }));
    },
    async listUserExpressions({ userId, limit }) {
      const result = await db.from("user_expressions").select("id,user_id,mastery_state")
        .eq("user_id", userId).order("id", { ascending: true }).limit(limit);
      return records(result).map((row) => ({
        id: stringValue(row, "id"),
        userId: stringValue(row, "user_id"),
        masteryState: stringValue(row, "mastery_state"),
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
      const data = await dependencies.repository.read(session.userId, dependencies.now());
      return Response.json(success(data, requestId), { headers: { "Cache-Control": "no-store" } });
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
