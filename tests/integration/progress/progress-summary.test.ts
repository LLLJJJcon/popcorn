import {
  createProgressHttpHandlers,
  createProgressRepository,
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
    { id: "original", userId: USER, practiceTaskId: "use-now", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: WEEK_START },
    { id: "reuse", userId: USER, practiceTaskId: "due-reuse", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-18T08:00:00.000Z" },
    { id: "owned", userId: USER, practiceTaskId: "due-owned", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-19T08:00:00.000Z" },
    { id: "assisted", userId: USER, practiceTaskId: "due-assisted", passed: true, independentUse: false, assistanceLevel: "hint", submittedAt: "2026-08-19T09:00:00.000Z" },
    { id: "before", userId: USER, practiceTaskId: "due-before", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-16T23:59:59.999Z" },
    { id: "next-week", userId: USER, practiceTaskId: "due-next", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: WEEK_END },
    { id: "other", userId: OTHER, practiceTaskId: "other-due", passed: true, independentUse: true, assistanceLevel: "none", submittedAt: "2026-08-18T08:00:00.000Z" },
  ] as const;
  const practiceTasks = [
    { id: "use-now", userId: USER, kind: "use_it_now" },
    { id: "due-reuse", userId: USER, kind: "due_practice" },
    { id: "due-owned", userId: USER, kind: "due_practice" },
    { id: "due-assisted", userId: USER, kind: "due_practice" },
    { id: "due-before", userId: USER, kind: "due_practice" },
    { id: "due-next", userId: USER, kind: "due_practice" },
    { id: "other-due", userId: OTHER, kind: "due_practice" },
  ] as const;
  const events = [
    { id: "event-original", userId: USER, attemptId: "original", evidenceKind: "valid_original_attempt", occurredAt: WEEK_START },
    { id: "event-reuse", userId: USER, attemptId: "reuse", evidenceKind: "successful_independent_transfer", occurredAt: "2026-08-18T08:00:00.000Z" },
    { id: "event-owned", userId: USER, attemptId: "owned", evidenceKind: "owned_threshold_met", occurredAt: "2026-08-19T08:00:00.000Z" },
    { id: "event-assisted", userId: USER, attemptId: "assisted", evidenceKind: "failed_or_assisted_reuse", occurredAt: "2026-08-19T09:00:00.000Z" },
    { id: "event-other", userId: OTHER, attemptId: "other", evidenceKind: "successful_independent_transfer", occurredAt: "2026-08-18T08:00:00.000Z" },
  ] as const;
  const reviews = [
    { id: "completed-reuse", userId: USER, status: "completed", dueAt: "2026-08-18T07:00:00.000Z", completedAt: "2026-08-18T08:00:00.000Z", completedAttemptId: "reuse" },
    { id: "completed-owned", userId: USER, status: "completed", dueAt: "2026-08-19T07:00:00.000Z", completedAt: "2026-08-19T08:00:00.000Z", completedAttemptId: "owned" },
    { id: "completed-before", userId: USER, status: "completed", dueAt: "2026-08-16T07:00:00.000Z", completedAt: "2026-08-16T08:00:00.000Z", completedAttemptId: "before" },
    { id: "due-now", userId: USER, status: "pending", dueAt: NOW, completedAt: null, completedAttemptId: null },
    { id: "due-future", userId: USER, status: "pending", dueAt: "2026-08-20T12:00:00.000Z", completedAt: null, completedAttemptId: null },
    { id: "other-due", userId: OTHER, status: "pending", dueAt: "2026-08-18T12:00:00.000Z", completedAt: null, completedAttemptId: null },
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
    const original = source.listAttempts;
    source.listAttempts = async (query) => [
      ...await original(query),
      { id: "failed-recent", userId: USER, practiceTaskId: "due-owned", passed: false, independentUse: false, assistanceLevel: "model_answer", submittedAt: "2026-08-19T11:00:00.000Z" },
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
});
