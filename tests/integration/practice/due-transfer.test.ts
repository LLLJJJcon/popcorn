import { createHash } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { buildDueTransferTask } from "@/server/domain/create-transfer-task";
import {
  createDuePracticeCompletionService,
  createDuePracticeHttpHandler,
  createSupabaseDuePracticeRepository,
} from "@/server/domain/complete-due-practice";

const routeHarness = vi.hoisted(() => ({
  due: vi.fn(),
  cookies: vi.fn(),
  client: {} as unknown,
}));

vi.mock("next/headers", () => ({
  cookies: (...args: unknown[]) => routeHarness.cookies(...args),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => routeHarness.client,
}));

vi.mock("@/server/repositories/review-task-repository", () => ({
  createLearningMemoryRuntime: async () => ({ authenticate: vi.fn(), repository: {} }),
  createLearningMemoryHttpHandlers: () => ({
    due: (...args: unknown[]) => routeHarness.due(...args),
  }),
}));

const USER = "11111111-1111-4111-8111-111111111111";
const REVIEW = "22222222-2222-4222-8222-222222222222";
const REVIEW_TWO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REVIEW_THREE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EXPRESSION = "44444444-4444-4444-8444-444444444444";

function databaseContextFingerprint(input: {
  readonly target_expression: string;
  readonly prompt_chinese: string;
  readonly instructions_english: string;
  readonly goal_english: string;
}): string {
  const encoded = [
    input.target_expression,
    input.prompt_chinese,
    input.instructions_english,
    input.goal_english,
  ].map((part) => `${Array.from(part).length}:${part}`).join("");
  return createHash("sha256").update(encoded, "utf8").digest("hex");
}

function dueRepositoryHarness(originalPromptChinese = "朋友说演唱会门票贵得不合理。你会怎么回应？") {
  const attemptedFingerprints: string[] = [];
  let failInsert: (() => void) | null = null;
  const reviews = new Map<string, Record<string, unknown>>([
    [REVIEW, {
      id: REVIEW, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "tried",
      status: "pending", due_at: "2026-08-21T12:00:00.000Z",
      completed_attempt_id: null, completed_at: null,
    }],
  ]);
  const expressions = new Map<string, Record<string, unknown>>([[EXPRESSION, {
    id: EXPRESSION, user_id: USER, mastery_state: "tried",
  }]]);
  const tasks: Array<Record<string, unknown>> = [{
    id: "99999999-9999-4999-8999-999999999999", user_id: USER, user_expression_id: EXPRESSION,
    kind: "use_it_now", native_language: "en", target_language: "zh-CN", target_expression: "太离谱了",
    prompt_chinese: originalPromptChinese,
    instructions_english: "Reply naturally.", goal_english: "Use the expression.", due_at: null,
    review_task_id: null, context_fingerprint: "f".repeat(64), created_at: "2026-08-20T12:00:00.000Z",
    activation_gateway_config_id: null, activation_gateway_fingerprint: null,
    activation_gateway_revision: null, activation_model: null, activation_prompt_version: null,
  }];

  const client = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let inserted: Record<string, unknown> | null = null;
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        order() { return query; },
        limit() { return query; },
        insert(value: Record<string, unknown>) { inserted = value; return query; },
        async maybeSingle() {
          if (inserted) {
            attemptedFingerprints.push(String(inserted.context_fingerprint));
            if (failInsert) {
              const beforeFailure = failInsert;
              failInsert = null;
              beforeFailure();
              return { data: null, error: new Error("simulated insert race") };
            }
            const contextFingerprint = databaseContextFingerprint(inserted as Parameters<typeof databaseContextFingerprint>[0]);
            const duplicate = tasks.some((row) =>
              row.user_id === inserted?.user_id &&
              row.user_expression_id === inserted?.user_expression_id &&
              row.context_fingerprint === contextFingerprint,
            );
            if (duplicate) return { data: null, error: new Error("practice_task_expression_context_unique") };
            const row = {
              activation_gateway_config_id: null, activation_gateway_fingerprint: null,
              activation_gateway_revision: null, activation_model: null, activation_prompt_version: null,
              created_at: "2026-08-22T12:00:00.000Z",
              ...inserted,
              context_fingerprint: contextFingerprint,
            };
            tasks.push(row);
            return { data: row, error: null };
          }
          const matches = (row: Record<string, unknown>) => filters.every(([column, value]) => row[column] === value);
          if (table === "review_tasks") {
            const row = [...reviews.values()].find((candidate) => matches(candidate));
            return { data: row ?? null, error: null };
          }
          if (table === "user_expressions") {
            const row = [...expressions.values()].find((candidate) => matches(candidate));
            return { data: row ?? null, error: null };
          }
          if (table === "practice_tasks") {
            return { data: tasks.find(matches) ?? null, error: null };
          }
          throw new Error(`unexpected table ${table}`);
        },
        then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) {
          const matches = (row: Record<string, unknown>) => filters.every(([column, value]) => row[column] === value);
          return Promise.resolve(resolve({
            data: table === "practice_tasks" ? tasks.filter(matches) : [],
            error: null,
          }));
        },
      };
      return query;
    },
    rpc: vi.fn(),
  };
  return {
    repository: createSupabaseDuePracticeRepository(client as never), reviews, expressions, tasks, attemptedFingerprints,
    failNextInsert(beforeFailure: () => void) { failInsert = beforeFailure; },
  };
}

function completedReplayRepositoryHarness() {
  const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const rows: Record<string, Array<Record<string, unknown>>> = {
    review_tasks: [{
      id: REVIEW, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "tried",
      status: "completed", due_at: "2026-08-21T12:00:00+00:00",
      completed_attempt_id: attemptId, completed_at: "2026-08-22T12:00:00+00:00",
    }],
    user_expressions: [{ id: EXPRESSION, user_id: USER, mastery_state: "reused" }],
    practice_tasks: [{
      id: "33333333-3333-4333-8333-333333333333", user_id: USER, user_expression_id: EXPRESSION,
      kind: "due_practice", native_language: "en", target_language: "zh-CN", target_expression: "太离谱了",
      prompt_chinese: "在新的午餐场景里自然回应。", instructions_english: "Reply naturally.",
      goal_english: "Use the expression independently.", due_at: "2026-08-21T12:00:00+00:00",
      review_task_id: REVIEW, context_fingerprint: "a".repeat(64), created_at: "2026-08-21T12:00:00.000Z",
      activation_gateway_config_id: null, activation_gateway_fingerprint: null,
      activation_gateway_revision: null, activation_model: null, activation_prompt_version: null,
    }],
    attempts: [{
      id: attemptId, user_id: USER, user_expression_id: EXPRESSION,
      practice_task_id: "33333333-3333-4333-8333-333333333333",
      response_chinese: "这也太离谱了吧。", assistance_level: "none", passed: true,
      independent_use: true, accuracy_score: 5, accuracy_feedback_english: "Accurate.",
      naturalness_score: 4, naturalness_feedback_english: "Natural.",
      contextual_fit_score: 5, contextual_fit_feedback_english: "Fits.",
      submitted_at: "2026-08-22T12:00:00+00:00",
      evaluation_prompt_version: "evaluate-practice-v1", evaluation_model: "model-a",
      evaluation_gateway_config_id: "55555555-5555-4555-8555-555555555555",
      evaluation_gateway_revision: 2, evaluation_gateway_fingerprint: "f".repeat(64),
    }],
    mastery_events: [{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", user_id: USER,
      user_expression_id: EXPRESSION, attempt_id: attemptId,
      prior_state: "tried", new_state: "reused",
      occurred_at: "2026-08-22T12:00:00+00:00",
    }],
  };
  const tablesRead: string[] = [];
  const rpc = vi.fn();
  const client = {
    from(table: string) {
      tablesRead.push(table);
      const filters: Array<[string, unknown]> = [];
      let rowLimit: number | null = null;
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        limit(value: number) { rowLimit = value; return query; },
        async maybeSingle() {
          const matches = (rows[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value));
          if (matches.length > 1) return { data: null, error: new Error("multiple rows") };
          return { data: matches[0] ?? null, error: null };
        },
        then(resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown) {
          const matches = (rows[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value));
          return Promise.resolve(resolve({ data: rowLimit === null ? matches : matches.slice(0, rowLimit), error: null }));
        },
      };
      return query;
    },
    rpc,
  };
  return { repository: createSupabaseDuePracticeRepository(client as never), tablesRead, rows, rpc };
}

describe("due Practice transfer boundary", () => {
  test("creates a different-context prompt that withholds a complete answer", () => {
    const originalPrompt = "这个价格也太离谱了吧，你会怎么说？";
    const transfer = buildDueTransferTask({
      id: "33333333-3333-4333-8333-333333333333", userId: USER, reviewTaskId: REVIEW,
      userExpressionId: "44444444-4444-4444-8444-444444444444", targetExpression: "太离谱了",
      originalPromptChinese: originalPrompt, dueAt: "2026-08-21T12:00:00.000Z", masteryState: "tried",
    });
    expect(transfer.promptChinese.normalize("NFKC")).not.toContain(originalPrompt.normalize("NFKC"));
    expect(JSON.stringify(transfer)).not.toContain("这个价格也太离谱了吧");
  });

  test("creates sequential due transfers in different everyday situations after the prior review completes", async () => {
    const harness = dueRepositoryHarness();

    const first = await harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z");
    harness.reviews.set(REVIEW, {
      ...harness.reviews.get(REVIEW)!, status: "completed",
      completed_attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      completed_at: "2026-08-22T12:00:00.000Z",
    });
    harness.expressions.set(EXPRESSION, { id: EXPRESSION, user_id: USER, mastery_state: "reused" });
    harness.reviews.set(REVIEW_TWO, {
      id: REVIEW_TWO, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "reused",
      status: "pending", due_at: "2026-08-29T12:00:00.000Z",
      completed_attempt_id: null, completed_at: null,
    });
    const second = await harness.repository.ensureTransferTask(USER, REVIEW_TWO, "2026-08-30T12:00:00.000Z");
    harness.reviews.set(REVIEW_TWO, {
      ...harness.reviews.get(REVIEW_TWO)!, status: "completed",
      completed_attempt_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      completed_at: "2026-08-30T12:00:00.000Z",
    });
    harness.expressions.set(EXPRESSION, { id: EXPRESSION, user_id: USER, mastery_state: "owned" });
    harness.reviews.set(REVIEW_THREE, {
      id: REVIEW_THREE, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "owned",
      status: "pending", due_at: "2026-09-29T12:00:00.000Z",
      completed_attempt_id: null, completed_at: null,
    });
    const maintenance = await harness.repository.ensureTransferTask(USER, REVIEW_THREE, "2026-09-30T12:00:00.000Z");

    expect(first.id).not.toBe(second.id);
    expect(first.promptChinese).toContain("午餐");
    expect(second.promptChinese).toContain("网购");
    expect(maintenance.promptChinese).toContain("出行");
    expect(first.contextFingerprint).not.toBe(second.contextFingerprint);
    expect(new Set([first.contextFingerprint, second.contextFingerprint, maintenance.contextFingerprint]).size).toBe(3);
    expect(harness.attemptedFingerprints).toEqual([
      databaseContextFingerprint({
        target_expression: first.targetExpression,
        prompt_chinese: first.promptChinese,
        instructions_english: first.instructionsEnglish,
        goal_english: first.goalEnglish,
      }),
      databaseContextFingerprint({
        target_expression: second.targetExpression,
        prompt_chinese: second.promptChinese,
        instructions_english: second.instructionsEnglish,
        goal_english: second.goalEnglish,
      }),
      databaseContextFingerprint({
        target_expression: maintenance.targetExpression,
        prompt_chinese: maintenance.promptChinese,
        instructions_english: maintenance.instructionsEnglish,
        goal_english: maintenance.goalEnglish,
      }),
    ]);
  });

  test("excludes the original lunch scenario and every prior due scenario before semantic reuse", async () => {
    const originalLunchPrompt = "午餐时，同事发现公司食堂一份普通套餐竟然要200元。请用“太离谱了”自然回应。";
    const harness = dueRepositoryHarness(originalLunchPrompt);

    const first = await harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z");
    harness.reviews.set(REVIEW, {
      ...harness.reviews.get(REVIEW)!, status: "completed",
      completed_attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      completed_at: "2026-08-22T12:00:00.000Z",
    });
    harness.expressions.set(EXPRESSION, { id: EXPRESSION, user_id: USER, mastery_state: "reused" });
    harness.reviews.set(REVIEW_TWO, {
      id: REVIEW_TWO, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "reused",
      status: "pending", due_at: "2026-08-29T12:00:00.000Z",
      completed_attempt_id: null, completed_at: null,
    });

    const second = await harness.repository.ensureTransferTask(USER, REVIEW_TWO, "2026-08-30T12:00:00.000Z");

    expect(first.promptChinese).toContain("网购");
    expect(second.promptChinese).toContain("出行");
    expect(second.promptChinese).not.toContain("网购");
    expect(first.contextFingerprint).not.toBe(second.contextFingerprint);
  });

  test("reuses a stable semantic scenario with a unique fingerprint after all finite scenarios are used", () => {
    const originalLunchPrompt = "午餐时，同事发现公司食堂一份普通套餐竟然要200元。请用“太离谱了”自然回应。";
    const priorPrompts = [
      "网购时，朋友发现一根普通充电线竟然标价200元。请用“太离谱了”自然回应。",
      "出行时，同学发现十分钟的普通打车行程竟然收费237元。请用“太离谱了”自然回应。",
      "下雨时，邻居发现租一把普通雨伞竟然要274元。请用“太离谱了”自然回应。",
    ];
    const reused = buildDueTransferTask({
      id: "33333333-3333-4333-8333-333333333333", userId: USER, reviewTaskId: REVIEW_THREE,
      userExpressionId: EXPRESSION, targetExpression: "太离谱了", originalPromptChinese: originalLunchPrompt,
      priorPromptChinese: priorPrompts, transferOrdinal: 3,
      dueAt: "2026-09-29T12:00:00.000Z", masteryState: "owned",
    });

    expect(reused.promptChinese).toContain("下雨");
    expect(reused.contextFingerprint).not.toBe(databaseContextFingerprint({
      target_expression: "太离谱了",
      prompt_chinese: priorPrompts[2]!,
      instructions_english: reused.instructionsEnglish,
      goal_english: reused.goalEnglish,
    }));
  });

  test.each([
    { status: "cancelled", dueAt: "2026-08-21T12:00:00.000Z", completedAttemptId: null, completedAt: null },
    { status: "completed", dueAt: "2026-08-21T12:00:00.000Z", completedAttemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", completedAt: "2026-08-22T12:00:00.000Z" },
    { status: "pending", dueAt: "2026-08-23T12:00:00.000Z", completedAttemptId: null, completedAt: null },
    { status: "pending", dueAt: "2026-08-21T12:00:00.000Z", completedAttemptId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", completedAt: "2026-08-22T12:00:00.000Z" },
  ])("rejects an already-created transfer when review eligibility is invalid: $status $dueAt", async ({ status, dueAt, completedAttemptId, completedAt }) => {
    const harness = dueRepositoryHarness();
    await harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z");
    harness.reviews.set(REVIEW, {
      ...harness.reviews.get(REVIEW)!, status, due_at: dueAt,
      completed_attempt_id: completedAttemptId, completed_at: completedAt,
    });

    await expect(harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects an already-created transfer when current expression mastery is stale", async () => {
    const harness = dueRepositoryHarness();
    await harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z");
    harness.expressions.set(EXPRESSION, { id: EXPRESSION, user_id: USER, mastery_state: "reused" });

    await expect(harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rechecks the review and expression eligibility after an insert race before returning any raced task", async () => {
    const harness = dueRepositoryHarness();
    harness.failNextInsert(() => {
      harness.reviews.set(REVIEW, {
        ...harness.reviews.get(REVIEW)!, status: "cancelled",
      });
    });

    await expect(harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("canonicalizes PostgREST completion instants at the RPC boundary", async () => {
    const rpc = vi.fn(async (_name: string, input: Record<string, unknown>) => ({
      data: [{
        review_task_id: REVIEW, practice_task_id: "33333333-3333-4333-8333-333333333333",
        attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        mastery_event_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        next_review_task_id: REVIEW_TWO,
        prior_state: "tried", new_state: "reused", next_due_at: "2026-08-29T12:00:00+00:00",
        interval_days: 7, created: true,
      }],
      error: null,
      input,
    }));
    const repository = createSupabaseDuePracticeRepository({ rpc } as never);

    await expect(repository.completeDuePractice({
      userId: USER, reviewTaskId: REVIEW, practiceTaskId: "33333333-3333-4333-8333-333333333333",
      requestKey: "a".repeat(64), responseChinese: "太离谱了。", assistanceLevel: "none", passed: true,
      accuracyScore: 5, accuracyFeedbackEnglish: "Accurate.", naturalnessScore: 5,
      naturalnessFeedbackEnglish: "Natural.", contextualFitScore: 5, contextualFitFeedbackEnglish: "Fits.",
      completedAt: "2026-08-22T12:00:00+00:00", evaluationPromptVersion: null, evaluationModel: null,
      evaluationGatewayConfigId: null, evaluationGatewayRevision: null, evaluationGatewayFingerprint: null,
    })).resolves.toMatchObject({ nextDueAt: "2026-08-29T12:00:00.000Z" });
    expect(rpc).toHaveBeenCalledWith("complete_due_practice", expect.objectContaining({
      p_completed_at: "2026-08-22T12:00:00.000Z",
    }));
  });

  test("loads an exact completion replay only from its owner-scoped immutable event graph", async () => {
    const harness = completedReplayRepositoryHarness();

    await expect(harness.repository.findCompletionState(USER, REVIEW)).resolves.toMatchObject({
      status: "completed",
      task: {
        userId: USER, reviewTaskId: REVIEW, masteryState: "tried",
        dueAt: "2026-08-21T12:00:00.000Z",
      },
      attempt: {
        responseChinese: "这也太离谱了吧。",
        submittedAt: "2026-08-22T12:00:00.000Z",
      },
    });
    expect(harness.tablesRead).toEqual(["review_tasks", "user_expressions", "practice_tasks", "attempts", "mastery_events"]);
  });

  test("replays an old tried-to-reused completion after current mastery advances to owned without Provider egress", async () => {
    const harness = completedReplayRepositoryHarness();
    harness.rows.user_expressions[0]!.mastery_state = "owned";
    harness.rpc.mockResolvedValue({
      data: [{
        review_task_id: REVIEW, practice_task_id: "33333333-3333-4333-8333-333333333333",
        attempt_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        mastery_event_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", next_review_task_id: REVIEW_TWO,
        prior_state: "tried", new_state: "reused", next_due_at: "2026-08-29T12:00:00+00:00",
        interval_days: 7, created: false,
      }],
      error: null,
    });
    const gateway = { model: "must-not-run", complete: vi.fn(async () => { throw new Error("Provider must be skipped"); }) };
    const gatewayResolver = { resolve: vi.fn(async () => gateway) };
    const service = createDuePracticeCompletionService({
      repository: harness.repository, gatewayResolver, fixtureGateway: gateway,
      ci: false, now: () => "2026-09-30T12:00:00.000Z",
    });

    await expect(service.complete(USER, REVIEW, {
      responseChinese: "这也太离谱了吧。", assistanceLevel: "none",
    })).resolves.toMatchObject({
      created: false, priorState: "tried", newState: "reused",
      transition: { from: "tried", to: "reused" },
    });
    expect(gatewayResolver.resolve).not.toHaveBeenCalled();
    expect(gateway.complete).not.toHaveBeenCalled();
    expect(harness.rpc).toHaveBeenCalledOnce();
  });

  test.each([
    { name: "missing", mutate: (rows: Record<string, Array<Record<string, unknown>>>) => { rows.mastery_events = []; } },
    { name: "wrong prior state", mutate: (rows: Record<string, Array<Record<string, unknown>>>) => { rows.mastery_events[0]!.prior_state = "reused"; } },
    { name: "illegal new state", mutate: (rows: Record<string, Array<Record<string, unknown>>>) => { rows.mastery_events[0]!.new_state = "owned"; } },
    { name: "mastery rollback", mutate: (rows: Record<string, Array<Record<string, unknown>>>) => { rows.user_expressions[0]!.mastery_state = "tried"; } },
    { name: "duplicate event", mutate: (rows: Record<string, Array<Record<string, unknown>>>) => {
      rows.mastery_events.push({ ...rows.mastery_events[0]!, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    } },
  ])("fails closed on a $name historical mastery event graph", async ({ mutate }) => {
    const harness = completedReplayRepositoryHarness();
    mutate(harness.rows);

    await expect(harness.repository.findCompletionState(USER, REVIEW)).resolves.toBeNull();
    expect(harness.tablesRead).toEqual(["review_tasks", "user_expressions", "practice_tasks", "attempts", "mastery_events"]);
  });

  test("keeps public errors generic and no-store without raw provider, database, or gateway detail", async () => {
    const complete = vi.fn(async () => { throw new Error("apiKey=x baseUrl=https://secret database detail"); });
    const handler = createDuePracticeHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })),
      complete,
      appUrl: "https://popcorn.example",
      requestId: () => "safe-request-id",
    });
    const response = await handler(new Request(`https://popcorn.example/api/v1/practice/due/${REVIEW}`, {
      method: "POST", headers: { origin: "https://popcorn.example", "content-type": "application/json" },
      body: JSON.stringify({ responseChinese: "太离谱了。", assistanceLevel: "none" }),
    }), { params: Promise.resolve({ reviewTaskId: REVIEW }) });
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toContain("safe-request-id");
    expect(body).not.toMatch(/api.?key|base.?url|provider|database|secret/i);
  });

  test("rejects an invalid route identity before completion", async () => {
    const complete = vi.fn();
    const handler = createDuePracticeHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })), complete,
      appUrl: "https://popcorn.example", requestId: () => "safe-request-id",
    });
    const response = await handler(new Request("https://popcorn.example/api/v1/practice/due/nope", {
      method: "POST", headers: { origin: "https://popcorn.example", "content-type": "application/json" },
      body: JSON.stringify({ responseChinese: "太离谱了。", assistanceLevel: "none" }),
    }), { params: Promise.resolve({ reviewTaskId: "nope" }) });

    expect(response.status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe("production due Practice route error boundaries", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      APP_URL: "https://popcorn.example",
    });
    routeHarness.client = {};
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnvironment);
  });

  test("the due list route catches an asynchronously rejected handler and returns a generic no-store response", async () => {
    routeHarness.due.mockRejectedValueOnce(new Error("database secret"));
    const route = await import("@/app/api/v1/practice/due/route");

    const response = await route.GET(new Request("https://popcorn.example/api/v1/practice/due"));
    const serialized = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(serialized).not.toMatch(/database|secret/i);
  });

  test.each(["GET", "POST"] as const)("the dynamic %s route catches asynchronous authentication rejection", async (method) => {
    routeHarness.cookies.mockRejectedValueOnce(new Error("cookie storage secret"));
    const route = await import("@/app/api/v1/practice/due/[reviewTaskId]/route");

    const response = await route[method](new Request(`https://popcorn.example/api/v1/practice/due/${REVIEW}`, {
      method,
      ...(method === "POST" ? {
        headers: { origin: "https://popcorn.example", "content-type": "application/json" },
        body: JSON.stringify({ responseChinese: "太离谱了。", assistanceLevel: "none" }),
      } : {}),
    }), { params: Promise.resolve({ reviewTaskId: REVIEW }) });
    const serialized = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(serialized).not.toMatch(/cookie|storage|secret/i);
  });
});
