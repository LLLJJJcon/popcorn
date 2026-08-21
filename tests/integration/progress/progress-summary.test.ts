import {
  createProgressHttpHandlers,
  createProgressRepository,
  createSupabaseProgressEvidenceSource,
  type ProgressEvidenceSource,
} from "@/server/repositories/progress-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-08-19T12:00:00.000Z";
const WEEK_START = "2026-08-17T00:00:00.000Z";
const WEEK_END = "2026-08-24T00:00:00.000Z";

function evidenceSource(): ProgressEvidenceSource & {
  readonly savedItems: readonly unknown[];
  readonly explanationViews: readonly unknown[];
} {
  const attempts = [
    { id: "original", userId: USER, userExpressionId: "tried", practiceTaskId: "use-now", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: WEEK_START },
    { id: "reuse", userId: USER, userExpressionId: "reused", practiceTaskId: "due-reuse", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-18T08:00:00.000Z" },
    { id: "owned", userId: USER, userExpressionId: "owned", practiceTaskId: "due-owned", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-19T08:00:00.000Z" },
    { id: "assisted", userId: USER, userExpressionId: "reused", practiceTaskId: "due-assisted", passed: true, independentUse: false, assistanceLevel: "hint", submittedAt: "2026-08-19T09:00:00.000Z" },
    { id: "before", userId: USER, userExpressionId: "reused", practiceTaskId: "due-before", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-16T23:59:59.999Z" },
    { id: "next-week", userId: USER, userExpressionId: "reused", practiceTaskId: "due-next", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: WEEK_END },
    { id: "other", userId: OTHER, userExpressionId: "other-owned", practiceTaskId: "other-due", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-18T08:00:00.000Z" },
  ] as const;
  const practiceTasks = [
    { id: "use-now", userId: USER, userExpressionId: "tried", reviewTaskId: null, kind: "use_it_now" },
    { id: "due-reuse", userId: USER, userExpressionId: "reused", reviewTaskId: "completed-reuse", kind: "due_practice" },
    { id: "due-owned", userId: USER, userExpressionId: "owned", reviewTaskId: "completed-owned", kind: "due_practice" },
    { id: "due-assisted", userId: USER, userExpressionId: "reused", reviewTaskId: "due-now", kind: "due_practice" },
    { id: "due-before", userId: USER, userExpressionId: "reused", reviewTaskId: "completed-before", kind: "due_practice" },
    { id: "due-next", userId: USER, userExpressionId: "reused", reviewTaskId: "due-future", kind: "due_practice" },
    { id: "other-due", userId: OTHER, userExpressionId: "other-owned", reviewTaskId: "other-due", kind: "due_practice" },
  ] as const;
  const events = [
    { id: "event-original", userId: USER, userExpressionId: "tried", attemptId: "original", evidenceKind: "valid_original_attempt", occurredAt: WEEK_START },
    { id: "event-reuse", userId: USER, userExpressionId: "reused", attemptId: "reuse", evidenceKind: "successful_independent_transfer", occurredAt: "2026-08-18T08:00:00.000Z" },
    { id: "event-owned", userId: USER, userExpressionId: "owned", attemptId: "owned", evidenceKind: "owned_threshold_met", occurredAt: "2026-08-19T08:00:00.000Z" },
    { id: "event-assisted", userId: USER, userExpressionId: "reused", attemptId: "assisted", evidenceKind: "failed_or_assisted_reuse", occurredAt: "2026-08-19T09:00:00.000Z" },
    { id: "event-other", userId: OTHER, userExpressionId: "other-owned", attemptId: "other", evidenceKind: "successful_independent_transfer", occurredAt: "2026-08-18T08:00:00.000Z" },
  ] as const;
  const reviews = [
    { id: "completed-reuse", userId: USER, userExpressionId: "reused", status: "completed", dueAt: "2026-08-18T07:00:00.000Z", completedAt: "2026-08-18T08:00:00.000Z", completedAttemptId: "reuse" },
    { id: "completed-owned", userId: USER, userExpressionId: "owned", status: "completed", dueAt: "2026-08-19T07:00:00.000Z", completedAt: "2026-08-19T08:00:00.000Z", completedAttemptId: "owned" },
    { id: "completed-before", userId: USER, userExpressionId: "reused", status: "completed", dueAt: "2026-08-16T07:00:00.000Z", completedAt: "2026-08-16T08:00:00.000Z", completedAttemptId: "before" },
    { id: "due-now", userId: USER, userExpressionId: "reused", status: "pending", dueAt: NOW, completedAt: null, completedAttemptId: null },
    { id: "due-future", userId: USER, userExpressionId: "reused", status: "pending", dueAt: "2026-08-20T12:00:00.000Z", completedAt: null, completedAttemptId: null },
    { id: "other-due", userId: OTHER, userExpressionId: "other-owned", status: "pending", dueAt: "2026-08-18T12:00:00.000Z", completedAt: null, completedAttemptId: null },
  ] as const;
  const expressions = [
    { id: "tried", userId: USER, masteryState: "tried" },
    { id: "reused", userId: USER, masteryState: "reused" },
    { id: "owned", userId: USER, masteryState: "owned" },
    { id: "other-owned", userId: OTHER, masteryState: "owned" },
  ] as const;

  return {
    savedItems: Array.from({ length: 40 }, (_, id) => ({ id })),
    explanationViews: Array.from({ length: 30 }, (_, id) => ({ id })),
    async listAttempts({ userId, start, end }) {
      return attempts.filter((row) => row.userId === userId && row.submittedAt >= start && row.submittedAt < end);
    },
    async listPracticeTasks({ userId, ids }) {
      return practiceTasks.filter((row) => row.userId === userId && ids.includes(row.id));
    },
    async listMasteryEvents({ userId, start, end, attemptIds }) {
      return events.filter((row) => row.userId === userId && row.occurredAt >= start && row.occurredAt < end && row.attemptId !== null && attemptIds.includes(row.attemptId));
    },
    async listCompletedReviews({ userId, start, end }) {
      return reviews.filter((row) => row.userId === userId && row.status === "completed" && row.completedAt !== null && row.completedAt >= start && row.completedAt < end);
    },
    async listDueReviews({ userId, now }) {
      return reviews.filter((row) => row.userId === userId && row.status === "pending" && row.dueAt <= now);
    },
    async listUserExpressions({ userId }) {
      return expressions.filter((row) => row.userId === userId);
    },
  };
}

describe("evidence-based Progress summary", () => {
  test("uses a fixed UTC week and ignores saved volume and explanation views", async () => {
    const summary = await createProgressRepository(evidenceSource()).read(USER, NOW);

    expect(summary).toEqual({
      week: { startsAt: WEEK_START, endsAt: WEEK_END },
      weeklyAttemptCount: 4,
      dueCompletionCount: 2,
      independentReuseCount: 2,
      duePracticeCount: 1,
      masteryDistribution: { tried: 1, reused: 1, owned: 1 },
    });
  });

  test("counts assisted work as an attempt but never as independent reuse", async () => {
    const source = evidenceSource();
    const summary = await createProgressRepository(source).read(USER, NOW);

    expect(summary.weeklyAttemptCount).toBe(4);
    expect(summary.independentReuseCount).toBe(2);
  });

  test("keeps highest mastery distinct from weak recent performance", async () => {
    const source = evidenceSource();
    const originalAttempts = source.listAttempts;
    const originalEvents = source.listMasteryEvents;
    source.listAttempts = async (query) => [
      ...await originalAttempts(query),
      { id: "failed-recent", userId: USER, userExpressionId: "reused", practiceTaskId: "due-assisted", passed: false, independentUse: false, assistanceLevel: "model_answer", submittedAt: "2026-08-19T11:00:00.000Z" },
    ];
    source.listMasteryEvents = async (query) => [
      ...await originalEvents(query),
      { id: "event-failed-recent", userId: USER, userExpressionId: "reused", attemptId: "failed-recent", evidenceKind: "failed_or_assisted_reuse", occurredAt: "2026-08-19T11:00:00.000Z" },
    ];

    const summary = await createProgressRepository(source).read(USER, NOW);
    expect(summary.weeklyAttemptCount).toBe(5);
    expect(summary.independentReuseCount).toBe(2);
    expect(summary.masteryDistribution).toEqual({ tried: 1, reused: 1, owned: 1 });
  });

  test("fails closed if a bounded source returns another owner's row", async () => {
    const source = evidenceSource();
    source.listUserExpressions = async () => [{ id: "leak", userId: OTHER, masteryState: "owned" }];

    await expect(createProgressRepository(source).read(USER, NOW)).rejects.toThrow("owner relation mismatch");
  });

  test("fails instead of truncating when a source returns product bound plus one rows", async () => {
    const source = evidenceSource();
    source.listAttempts = async () => Array.from({ length: 501 }, (_, index) => ({
      id: `attempt-${index}`,
      userId: USER,
      userExpressionId: "tried",
      practiceTaskId: "use-now",
      passed: true,
      independentUse: true,
      assistanceLevel: "none",
      submittedAt: WEEK_START,
    }));

    await expect(createProgressRepository(source).read(USER, NOW)).rejects.toThrow("progress evidence exceeds bound");
  });

  test.each([
    ["missing task", (source: ProgressEvidenceSource) => {
      const original = source.listPracticeTasks;
      source.listPracticeTasks = async (query) => (await original(query)).filter(({ id }) => id !== "due-reuse");
    }],
    ["wrong task kind", (source: ProgressEvidenceSource) => {
      const original = source.listPracticeTasks;
      source.listPracticeTasks = async (query) => (await original(query)).map((row) =>
        row.id === "due-reuse" ? { ...row, kind: "use_it_now" } : row);
    }],
    ["wrong review link", (source: ProgressEvidenceSource) => {
      const original = source.listPracticeTasks;
      source.listPracticeTasks = async (query) => (await original(query)).map((row) =>
        row.id === "due-reuse" ? { ...row, reviewTaskId: "wrong-review" } : row);
    }],
    ["missing event", (source: ProgressEvidenceSource) => {
      const original = source.listMasteryEvents;
      source.listMasteryEvents = async (query) => (await original(query)).filter(({ id }) => id !== "event-reuse");
    }],
    ["unexpected event", (source: ProgressEvidenceSource) => {
      const original = source.listMasteryEvents;
      source.listMasteryEvents = async (query) => (await original(query)).map((row) =>
        row.id === "event-reuse" ? { ...row, evidenceKind: "valid_original_attempt" } : row);
    }],
    ["duplicate event", (source: ProgressEvidenceSource) => {
      const original = source.listMasteryEvents;
      source.listMasteryEvents = async (query) => [
        ...await original(query),
        { id: "event-reuse-copy", userId: USER, userExpressionId: "reused", attemptId: "reuse", evidenceKind: "successful_independent_transfer", occurredAt: "2026-08-18T08:00:00.000Z" },
      ];
    }],
    ["cross-owner task relation", (source: ProgressEvidenceSource) => {
      const original = source.listPracticeTasks;
      source.listPracticeTasks = async (query) => (await original(query)).map((row) =>
        row.id === "due-reuse" ? { ...row, userId: OTHER } : row);
    }],
  ])("fails closed for an incomplete evidence graph: %s", async (_name, corrupt) => {
    const source = evidenceSource();
    corrupt(source);

    await expect(createProgressRepository(source).read(USER, NOW)).rejects.toThrow();
  });

  test("the Supabase adapter fetches every referenced task and attempt event", async () => {
    const rowsByTable = {
      practice_tasks: [{ id: "use-now", user_id: USER, user_expression_id: "tried", review_task_id: null, kind: "use_it_now" }],
      mastery_events: [{ id: "event-original", user_id: USER, user_expression_id: "tried", attempt_id: "original", evidence_kind: "valid_original_attempt", occurred_at: WEEK_START }],
    };
    const fakeClient = {
      from(table: keyof typeof rowsByTable) {
        let rows = [...rowsByTable[table]] as Record<string, unknown>[];
        const query = {
          select() { return query; },
          eq(column: string, value: unknown) {
            rows = rows.filter((row) => row[column] === value);
            return query;
          },
          gte() { return query; },
          lt() { return query; },
          lte() { return query; },
          in(column: string, values: readonly string[]) {
            rows = rows.filter((row) => typeof row[column] === "string" && values.includes(row[column]));
            return query;
          },
          order() { return query; },
          async limit(limit: number) { return { data: rows.slice(0, limit), error: null }; },
        };
        return query;
      },
    };
    const source = createSupabaseProgressEvidenceSource(fakeClient as never);

    await expect(source.listPracticeTasks({ userId: USER, ids: ["use-now"], limit: 501 })).resolves.toHaveLength(1);
    await expect(source.listMasteryEvents({ userId: USER, start: WEEK_START, end: WEEK_END, attemptIds: ["original"], limit: 501 })).resolves.toHaveLength(1);
  });

  test("serves only the authenticated owner's summary", async () => {
    const repository = createProgressRepository(evidenceSource());
    const handlers = createProgressHttpHandlers({
      authenticate: async () => ({ ok: true as const, userId: USER }),
      repository,
      now: () => NOW,
      requestId: () => "progress-request",
    });

    const response = await handlers.get(new Request("https://popcorn.example/api/v1/progress"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      requestId: "progress-request",
      data: { weeklyAttemptCount: 4, duePracticeCount: 1 },
    });
  });

  test("maps repository failures to a generic retryable API error", async () => {
    const handlers = createProgressHttpHandlers({
      authenticate: async () => ({ ok: true as const, userId: USER }),
      repository: { read: async () => { throw new Error("database provider secret"); } },
      now: () => NOW,
      requestId: () => "progress-failure",
    });

    const response = await handlers.get(new Request("https://popcorn.example/api/v1/progress"));
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("database provider secret");
    expect(JSON.parse(body)).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Progress is temporarily unavailable",
        retryable: true,
      },
      requestId: "progress-failure",
    });
  });
});
