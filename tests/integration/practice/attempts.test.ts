import type { StructuredJsonGateway, StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import {
  createPracticeTaskHttpHandler,
  createPracticeTaskService,
  PracticeError,
  type CandidateArtifactRecord,
  type PracticeDraftRecord,
  type PracticeRepository,
} from "@/server/domain/create-practice-task";
import {
  createPracticeAttemptHttpHandlers,
  createPracticeAttemptService,
  RevisionConflictError,
  type PracticeDraftAttemptRecord,
} from "@/server/repositories/attempt-repository";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const SAVE = "44444444-4444-4444-8444-444444444444";
const ARTIFACT = "55555555-5555-4555-8555-555555555555";
const CONFIG = "66666666-6666-4666-8666-666666666666";
const ATTEMPT = "77777777-7777-4777-8777-777777777777";
const NOW = "2026-08-21T02:03:04.000Z";
const FINGERPRINT = "a".repeat(64);

const candidate = {
  expression: "太离谱了",
  englishMeaning: "That is outrageous.",
  englishExplanation: "A spoken reaction to something unreasonable.",
  tone: "Surprised and critical.",
  communicativeFunction: "Reacting to an unreasonable situation.",
  register: "Informal spoken Mandarin.",
  evidenceText: "这个价格也太离谱了吧",
  segmentIds: ["segment-1"],
  startSeconds: 40,
  endSeconds: 43,
  confidence: 0.96,
};

const activation = {
  promptChinese: "朋友告诉你一杯普通咖啡卖一百元。你会怎么回应？",
  instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
  goalEnglish: "React critically to the unreasonable price using the target expression.",
};

const passingEvaluation = {
  passed: true,
  accuracy: { score: 5, englishFeedback: "The expression conveys the intended reaction." },
  naturalness: { score: 4, englishFeedback: "The sentence sounds natural in casual speech." },
  contextualFit: { score: 5, englishFeedback: "It directly fits the unreasonable-price situation." },
  independentUse: true,
  assistanceLevel: "none" as const,
};

function artifact(overrides: Partial<CandidateArtifactRecord> = {}): CandidateArtifactRecord {
  return {
    id: ARTIFACT,
    userId: USER_A,
    videoSourceId: SOURCE,
    savedItemId: SAVE,
    artifactType: "saved_item_analysis",
    content: { candidates: [candidate] },
    ...overrides,
  };
}

function memoryRepository(candidateRecord: CandidateArtifactRecord | null = artifact()) {
  const drafts: PracticeDraftRecord[] = [];
  const attempts: PracticeDraftAttemptRecord[] = [];
  let activePin = { configId: CONFIG, revision: 3, fingerprint: FINGERPRINT };
  let pinReads = 0;
  const repository: PracticeRepository = {
    async findCandidate(userId, selection) {
      if (
        !candidateRecord || candidateRecord.userId !== userId ||
        candidateRecord.id !== selection.candidateArtifactId ||
        candidateRecord.savedItemId !== selection.savedItemId
      ) return null;
      return candidateRecord;
    },
    async findDraftBySelection(userId, selection) {
      return drafts.find((draft) =>
        draft.userId === userId && draft.savedItemId === selection.savedItemId &&
        draft.candidateArtifactId === selection.candidateArtifactId &&
        draft.candidateIndex === selection.candidateIndex && draft.status === "active",
      ) ?? null;
    },
    async findDraft(userId, taskId) {
      return drafts.find((draft) => draft.userId === userId && draft.id === taskId) ?? null;
    },
    async insertDraft(input) {
      const existing = drafts.find((draft) => draft.id === input.id);
      if (existing) return existing;
      drafts.push(input);
      return input;
    },
    async resolveActiveGatewayPin(userId) {
      pinReads += 1;
      return userId === USER_A ? activePin : null;
    },
    async findAttempt(userId, attemptId) {
      return attempts.find((attempt) => attempt.userId === userId && attempt.id === attemptId) ?? null;
    },
    async nextRevision(userId, taskId) {
      return 1 + Math.max(0, ...attempts
        .filter((attempt) => attempt.userId === userId && attempt.practiceDraftId === taskId)
        .map((attempt) => attempt.revision));
    },
    async insertAttempt(input) {
      if (attempts.some((attempt) =>
        attempt.practiceDraftId === input.practiceDraftId && attempt.revision === input.revision,
      )) throw new RevisionConflictError();
      attempts.push(input);
      return input;
    },
  };
  return {
    repository,
    drafts,
    attempts,
    get pinReads() { return pinReads; },
    revoke() { activePin = null as never; },
  };
}

function gateway(output: unknown, model = "mandarin-model") {
  return { model, complete: vi.fn(async () => output) } satisfies StructuredJsonGateway;
}

function resolver(gatewayValue: StructuredJsonGateway) {
  return { resolve: vi.fn(async () => gatewayValue) } satisfies StructuredJsonGatewayResolver;
}

function activationService(store: ReturnType<typeof memoryRepository>, options: {
  ci?: boolean;
  fixture?: StructuredJsonGateway;
  live?: StructuredJsonGateway;
  events?: string[];
} = {}) {
  const fixture = options.fixture ?? gateway(activation, "fixture/activation-v1");
  const live = options.live ?? gateway(activation);
  return {
    service: createPracticeTaskService({
      repository: store.repository,
      gatewayResolver: resolver(live),
      fixtureGateway: fixture,
      ci: options.ci ?? true,
      now: () => NOW,
      attemptId: () => ATTEMPT,
      onPersisted: () => options.events?.push("persisted"),
    }),
    fixture,
    live,
  };
}

async function activate(store: ReturnType<typeof memoryRepository>, options: Parameters<typeof activationService>[1] = {}) {
  return activationService(store, options).service.activate(USER_A, {
    savedItemId: SAVE,
    candidateArtifactId: ARTIFACT,
    candidateIndex: 0,
  });
}

function attemptService(store: ReturnType<typeof memoryRepository>, options: {
  ci?: boolean;
  fixture?: StructuredJsonGateway;
  live?: StructuredJsonGateway;
  ids?: string[];
} = {}) {
  const fixture = options.fixture ?? gateway(passingEvaluation, "fixture/evaluation-v1");
  const live = options.live ?? gateway(passingEvaluation);
  const ids = options.ids ?? [ATTEMPT];
  const liveResolver = resolver(live);
  return {
    service: createPracticeAttemptService({
      repository: store.repository,
      gatewayResolver: liveResolver,
      fixtureGateway: fixture,
      ci: options.ci ?? true,
      now: () => NOW,
      attemptId: () => ids.shift() ?? crypto.randomUUID(),
    }),
    fixture,
    live,
    liveResolver,
  };
}

describe("learner-first practice activation", () => {
  test("persists an exact candidate task before returning it, without a model answer or canonical evidence", async () => {
    const store = memoryRepository();
    const events: string[] = [];
    const operation = activate(store, { events }).then((value) => {
      events.push("returned");
      return value;
    });

    await expect(operation).resolves.toMatchObject({
      kind: "use_it_now",
      userId: USER_A,
      targetExpression: "太离谱了",
      nativeLanguage: "en",
      targetLanguage: "zh-CN",
      dueAt: null,
    });
    expect(events).toEqual(["persisted", "returned"]);
    expect(store.drafts).toHaveLength(1);
    expect(store.attempts).toHaveLength(0);
    expect(JSON.stringify(store.drafts[0])).not.toMatch(/modelAnswer|exampleResponse|api.?key|vault/i);
  });

  test.each([
    ["wrong owner", USER_B, SAVE, ARTIFACT, 0],
    ["wrong save", USER_A, USER_B, ARTIFACT, 0],
    ["wrong artifact", USER_A, SAVE, USER_B, 0],
    ["wrong index", USER_A, SAVE, ARTIFACT, 2],
  ])("fails closed for %s", async (_label, userId, savedItemId, candidateArtifactId, candidateIndex) => {
    const store = memoryRepository();
    await expect(activationService(store).service.activate(userId as string, {
      savedItemId: savedItemId as string,
      candidateArtifactId: candidateArtifactId as string,
      candidateIndex: candidateIndex as number,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(store.drafts).toHaveLength(0);
  });

  test("rejects malformed candidate content before Provider use", async () => {
    const store = memoryRepository(artifact({ content: { candidates: [{ expression: "太离谱了" }] } }));
    const fixture = gateway(activation);
    await expect(activate(store, { fixture })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fixture.complete).not.toHaveBeenCalled();
    expect(store.drafts).toHaveLength(0);
  });

  test("CI uses its fixture before pin/Vault/fetch and replays one durable identity", async () => {
    const store = memoryRepository();
    const live = gateway(activation);
    const service = activationService(store, { ci: true, live }).service;
    const selection = { savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 };
    const first = await service.activate(USER_A, selection);
    const replay = await service.activate(USER_A, selection);

    expect(replay).toEqual(first);
    expect(store.drafts).toHaveLength(1);
    expect(store.pinReads).toBe(0);
    expect(live.complete).not.toHaveBeenCalled();
    expect(store.drafts[0]).toMatchObject({
      activationPromptVersion: null,
      activationModel: null,
      activationGatewayConfigId: null,
      activationGatewayRevision: null,
      activationGatewayFingerprint: null,
    });
  });

  test("live activation resolves the exact owner pin and revocation blocks the next egress", async () => {
    const store = memoryRepository();
    const live = gateway(activation);
    const liveResolver = resolver(live);
    const service = createPracticeTaskService({
      repository: store.repository,
      gatewayResolver: liveResolver,
      fixtureGateway: gateway(activation),
      ci: false,
      now: () => NOW,
      attemptId: () => ATTEMPT,
    });
    await service.activate(USER_A, { savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 });
    expect(liveResolver.resolve).toHaveBeenCalledExactlyOnceWith(USER_A, {
      configId: CONFIG, revision: 3, fingerprint: FINGERPRINT,
    });
    expect(store.drafts[0]).toMatchObject({
      activationModel: "mandarin-model",
      activationGatewayConfigId: CONFIG,
      activationGatewayRevision: 3,
      activationGatewayFingerprint: FINGERPRINT,
    });

    store.revoke();
    const other = memoryRepository(artifact({ id: USER_B }));
    other.revoke();
    const blocked = createPracticeTaskService({
      repository: other.repository,
      gatewayResolver: liveResolver,
      fixtureGateway: gateway(activation),
      ci: false,
      now: () => NOW,
      attemptId: () => USER_B,
    });
    await expect(blocked.activate(USER_A, {
      savedItemId: SAVE, candidateArtifactId: USER_B, candidateIndex: 0,
    })).rejects.toMatchObject({ code: "GATEWAY_REQUIRED" });
    expect(live.complete).toHaveBeenCalledTimes(1);
  });
});

describe("evaluation and append-only revisions", () => {
  test("rejects empty and English-only responses before Provider use", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const fixture = gateway(passingEvaluation);
    const service = attemptService(store, { fixture }).service;

    await expect(service.submitOriginal(USER_A, { taskId: task.id, responseChinese: "" }))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(service.submitOriginal(USER_A, { taskId: task.id, responseChinese: "That is absurd" }))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fixture.complete).not.toHaveBeenCalled();
    expect(store.attempts).toHaveLength(0);
  });

  test("schema-invalid Provider output persists no draft attempt or canonical evidence", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const service = attemptService(store, { fixture: gateway({ passed: true, score: 5 }) }).service;
    await expect(service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格也太离谱了！",
    })).rejects.toMatchObject({ code: "PROVIDER_FAILED" });
    expect(store.attempts).toHaveLength(0);
    expect(store.drafts).toHaveLength(1);
  });

  test("stores distinct dimensions and exact live provenance", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const live = gateway(passingEvaluation);
    const { service, liveResolver } = attemptService(store, { ci: false, live });
    const recorded = await service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格也太离谱了！",
    });

    expect(recorded).toMatchObject({
      id: ATTEMPT,
      userId: USER_A,
      practiceTaskId: task.id,
      userExpressionId: task.userExpressionId,
      evaluation: passingEvaluation,
    });
    expect(liveResolver.resolve).toHaveBeenCalledExactlyOnceWith(USER_A, {
      configId: CONFIG, revision: 3, fingerprint: FINGERPRINT,
    });
    expect(store.attempts[0]).toMatchObject({
      accuracyScore: 5,
      naturalnessScore: 4,
      contextualFitScore: 5,
      evaluationModel: "mandarin-model",
      evaluationGatewayConfigId: CONFIG,
      evaluationGatewayRevision: 3,
      evaluationGatewayFingerprint: FINGERPRINT,
    });
  });

  test("retains a valid failed learner evaluation as history without mastery state", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const failed = {
      ...passingEvaluation,
      passed: false,
      accuracy: { score: 2, englishFeedback: "The expression is recognizable but the grammar is incomplete." },
    };
    const recorded = await attemptService(store, { fixture: gateway(failed) }).service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格太离谱了我。",
    });
    expect(recorded.evaluation.passed).toBe(false);
    expect(store.attempts).toHaveLength(1);
    expect(JSON.stringify(store.attempts[0])).not.toMatch(/mastery|reviewTask|dueAt|vault/i);
  });

  test("appends a revision, preserves original history, isolates owners, and fails closed on collision", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const ids = [ATTEMPT, "88888888-8888-4888-8888-888888888888"];
    const service = attemptService(store, { ids }).service;
    const original = await service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格也太离谱了。",
    });
    const revision = await service.submitRevision(USER_A, original.id, "这个价格也太离谱了吧！");

    expect(store.attempts.map(({ revision, responseChinese }) => ({ revision, responseChinese }))).toEqual([
      { revision: 1, responseChinese: "这个价格也太离谱了。" },
      { revision: 2, responseChinese: "这个价格也太离谱了吧！" },
    ]);
    await expect(service.submitRevision(USER_B, original.id, "太离谱了。"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    vi.spyOn(store.repository, "nextRevision").mockResolvedValueOnce(2);
    await expect(service.submitRevision(USER_A, original.id, "真的太离谱了。"))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(store.attempts).toHaveLength(2);
    expect(revision.id).toBe("88888888-8888-4888-8888-888888888888");
  });
});

describe("cookie Web mutation boundaries", () => {
  test("task activation enforces exact origin and forwards only authenticated selection", async () => {
    const activate = vi.fn(async () => ({ id: ATTEMPT }));
    const handler = createPracticeTaskHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
      activate,
      appUrl: "https://popcorn.example",
      requestId: () => "safe-request",
    });
    const blocked = await handler(new Request("https://popcorn.example/api/v1/practice/tasks", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
      body: JSON.stringify({ savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 }),
    }));
    expect(blocked.status).toBe(403);
    expect(activate).not.toHaveBeenCalled();

    const allowed = await handler(new Request("https://popcorn.example/api/v1/practice/tasks", {
      method: "POST",
      headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
      body: JSON.stringify({ savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 }),
    }));
    expect(allowed.status).toBe(201);
    expect(allowed.headers.get("cache-control")).toBe("no-store");
    expect(activate).toHaveBeenCalledExactlyOnceWith(USER_A, {
      savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0,
    });
  });

  test("attempt routes reject extra client authority and return non-secret Provider errors", async () => {
    const submitOriginal = vi.fn(async () => { throw new PracticeError("PROVIDER_FAILED", true); });
    const submitRevision = vi.fn();
    const handlers = createPracticeAttemptHttpHandlers({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
      submitOriginal,
      submitRevision,
      appUrl: "https://popcorn.example",
      requestId: () => "safe-request",
    });
    const invalid = await handlers.original(new Request("https://popcorn.example/api/v1/practice/attempts", {
      method: "POST",
      headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: ATTEMPT, responseChinese: "太离谱了。", masteryState: "owned" }),
    }));
    expect(invalid.status).toBe(400);
    expect(submitOriginal).not.toHaveBeenCalled();

    const failed = await handlers.original(new Request("https://popcorn.example/api/v1/practice/attempts", {
      method: "POST",
      headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: ATTEMPT, responseChinese: "太离谱了。" }),
    }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).toBe(JSON.stringify({
      ok: false,
      error: { code: "PROVIDER_OUTPUT_INVALID", message: "Practice Provider is temporarily unavailable", retryable: true },
      requestId: "safe-request",
    }));
    expect(submitRevision).not.toHaveBeenCalled();
  });
});
