import { createHash } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { buildDueTransferTask } from "@/server/domain/create-transfer-task";
import {
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

function dueRepositoryHarness() {
  const attemptedFingerprints: string[] = [];
  const reviews = new Map([
    [REVIEW, {
      id: REVIEW, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "tried",
      status: "pending", due_at: "2026-08-21T12:00:00.000Z",
    }],
    [REVIEW_TWO, {
      id: REVIEW_TWO, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "reused",
      status: "pending", due_at: "2026-08-29T12:00:00.000Z",
    }],
  ]);
  const tasks: Array<Record<string, unknown>> = [{
    id: "99999999-9999-4999-8999-999999999999", user_id: USER, user_expression_id: EXPRESSION,
    kind: "use_it_now", native_language: "en", target_language: "zh-CN", target_expression: "太离谱了",
    prompt_chinese: "朋友说演唱会门票贵得不合理。你会怎么回应？",
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
          if (table === "practice_tasks") {
            return { data: tasks.find(matches) ?? null, error: null };
          }
          throw new Error(`unexpected table ${table}`);
        },
      };
      return query;
    },
    rpc: vi.fn(),
  };
  return { repository: createSupabaseDuePracticeRepository(client as never), tasks, attemptedFingerprints };
}

function completedReplayRepositoryHarness() {
  const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const rows: Record<string, Array<Record<string, unknown>>> = {
    review_tasks: [{
      id: REVIEW, user_id: USER, user_expression_id: EXPRESSION, mastery_state: "tried",
      status: "completed", due_at: "2026-08-21T12:00:00.000Z",
      completed_attempt_id: attemptId, completed_at: "2026-08-22T12:00:00.000Z",
    }],
    practice_tasks: [{
      id: "33333333-3333-4333-8333-333333333333", user_id: USER, user_expression_id: EXPRESSION,
      kind: "due_practice", native_language: "en", target_language: "zh-CN", target_expression: "太离谱了",
      prompt_chinese: "在新的午餐场景里自然回应。", instructions_english: "Reply naturally.",
      goal_english: "Use the expression independently.", due_at: "2026-08-21T12:00:00.000Z",
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
      submitted_at: "2026-08-22T12:00:00.000Z",
      evaluation_prompt_version: "evaluate-practice-v1", evaluation_model: "model-a",
      evaluation_gateway_config_id: "55555555-5555-4555-8555-555555555555",
      evaluation_gateway_revision: 2, evaluation_gateway_fingerprint: "f".repeat(64),
    }],
  };
  const tablesRead: string[] = [];
  const client = {
    from(table: string) {
      tablesRead.push(table);
      const filters: Array<[string, unknown]> = [];
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        async maybeSingle() {
          const data = (rows[table] ?? []).find((row) => filters.every(([column, value]) => row[column] === value));
          return { data: data ?? null, error: null };
        },
      };
      return query;
    },
    rpc: vi.fn(),
  };
  return { repository: createSupabaseDuePracticeRepository(client as never), tablesRead };
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

  test("creates two sequential due transfers through the production repository without a database fingerprint collision", async () => {
    const harness = dueRepositoryHarness();

    const first = await harness.repository.ensureTransferTask(USER, REVIEW, "2026-08-22T12:00:00.000Z");
    const second = await harness.repository.ensureTransferTask(USER, REVIEW_TWO, "2026-08-30T12:00:00.000Z");

    expect(first.id).not.toBe(second.id);
    expect(first.promptChinese).not.toBe(second.promptChinese);
    expect(first.contextFingerprint).not.toBe(second.contextFingerprint);
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
    ]);
  });

  test("loads an exact completion replay only from owner-scoped public review, task, and attempt rows", async () => {
    const harness = completedReplayRepositoryHarness();

    await expect(harness.repository.findCompletionState(USER, REVIEW)).resolves.toMatchObject({
      status: "completed",
      task: { userId: USER, reviewTaskId: REVIEW, masteryState: "tried" },
      attempt: {
        responseChinese: "这也太离谱了吧。",
      },
    });
    expect(harness.tablesRead).toEqual(["review_tasks", "practice_tasks", "attempts"]);
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
