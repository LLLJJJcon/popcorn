import type {
  StructuredJsonCompletionOptions,
  StructuredJsonGateway,
  StructuredJsonGatewayResolver,
} from "@/server/ai/structured-json-gateway";
import { ModelGatewayError } from "@/server/ai/provider";
import type { ModelOutputStage } from "@/server/ai/model-output";
import {
  ActivationOutputSchema,
  buildActivatePracticePrompt,
  createActivationFixtureGateway,
} from "@/server/ai/prompts/activate.v1";
import {
  createPracticeTaskHttpHandler,
  createPracticeTaskService,
  PracticeError,
  type CandidateArtifactRecord,
  type PracticeDraftRecord,
  type PracticeRepository,
} from "@/server/domain/create-practice-task";
import {
  createDuePracticeCompletionService,
  createDuePracticeHttpHandler,
  type DuePracticeCompletionRepository,
  type DueTransferTask,
} from "@/server/domain/complete-due-practice";
import {
  createPracticeAttemptHttpHandlers,
  createPracticeAttemptService,
  createSupabasePracticeRepository,
  RevisionConflictError,
  type PracticeDraftAttemptRecord,
} from "@/server/repositories/attempt-repository";
import type { PracticePromotionResult } from "@/server/domain/record-valid-attempt";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const SAVE = "44444444-4444-4444-8444-444444444444";
const ARTIFACT = "55555555-5555-4555-8555-555555555555";
const CONFIG = "66666666-6666-4666-8666-666666666666";
const ATTEMPT = "77777777-7777-4777-8777-777777777777";
const NOW = "2026-08-21T02:03:04.000Z";
const FINGERPRINT = "a".repeat(64);
const SAFE_REQUEST_ID = "safe-request";
const CANDIDATE_SELECT = "id,user_id,video_source_id,saved_item_id,artifact_type,prompt_version,content";
const DRAFT_SELECT = "id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,activation_prompt_version,activation_model,activation_gateway_config_id,activation_gateway_revision,activation_gateway_fingerprint,created_at,updated_at";
const ATTEMPT_SELECT = "id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,passed,accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at,evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,evaluation_gateway_revision,evaluation_gateway_fingerprint,created_at";

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

const activationWire = {
  promptChinese: "朋友告诉你一杯普通咖啡卖一百元。你会怎么回应？",
};

const activation = {
  ...activationWire,
  instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
  goalEnglish: "Use the target expression naturally in this new situation.",
};

const passingEvaluation = {
  passed: true,
  accuracy: { score: 5, englishFeedback: "The expression conveys the intended reaction." },
  naturalness: { score: 4, englishFeedback: "The sentence sounds natural in casual speech." },
  contextualFit: { score: 5, englishFeedback: "It directly fits the unreasonable-price situation." },
  independentUse: true,
  assistanceLevel: "none" as const,
};

const providerPassingEvaluation = {
  accuracy: passingEvaluation.accuracy,
  naturalness: passingEvaluation.naturalness,
  contextualFit: passingEvaluation.contextualFit,
  naturalRevisionChinese: "这个价格也太离谱了吧。",
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

const draftRow = {
  id: ATTEMPT,
  user_id: USER_A,
  video_source_id: SOURCE,
  saved_item_id: SAVE,
  candidate_artifact_id: ARTIFACT,
  candidate_artifact_type: "saved_item_analysis",
  candidate_index: 0,
  future_user_expression_id: USER_B,
  native_language: "en",
  target_language: "zh-CN",
  target_expression: candidate.expression,
  prompt_chinese: activation.promptChinese,
  instructions_english: activation.instructionsEnglish,
  goal_english: activation.goalEnglish,
  status: "active",
  activation_prompt_version: "activate-practice-v1",
  activation_model: "mandarin-model",
  activation_gateway_config_id: CONFIG,
  activation_gateway_revision: 3,
  activation_gateway_fingerprint: FINGERPRINT,
  created_at: NOW,
  updated_at: NOW,
};

const attemptRow = {
  id: USER_B,
  user_id: USER_A,
  practice_draft_id: ATTEMPT,
  future_user_expression_id: USER_B,
  revision: 1,
  response_chinese: "这个价格也太离谱了。",
  passed: true,
  accuracy_score: 5,
  accuracy_feedback_english: passingEvaluation.accuracy.englishFeedback,
  naturalness_score: 4,
  naturalness_feedback_english: passingEvaluation.naturalness.englishFeedback,
  contextual_fit_score: 5,
  contextual_fit_feedback_english: passingEvaluation.contextualFit.englishFeedback,
  independent_use: true,
  assistance_level: "none",
  submitted_at: NOW,
  evaluation_prompt_version: "evaluate-practice-v1",
  evaluation_model: "mandarin-model",
  evaluation_gateway_config_id: CONFIG,
  evaluation_gateway_revision: 3,
  evaluation_gateway_fingerprint: FINGERPRINT,
  created_at: NOW,
};

type PlannedQuery = {
  readonly table: string;
  readonly terminal: "maybeSingle" | "single";
  readonly result: { readonly data: unknown; readonly error: unknown };
};

function supabaseQueryHarness(plans: PlannedQuery[]) {
  const calls: Array<readonly [string, ...unknown[]]> = [];
  const remaining = [...plans];
  const client = {
    from(table: string) {
      calls.push(["from", table]);
      let selectedColumns: string | null = null;
      const query = {
        select(columns: string) {
          selectedColumns = columns;
          calls.push(["select", table, columns]);
          return query;
        },
        eq(column: string, value: unknown) { calls.push(["eq", table, column, value]); return query; },
        order(column: string, options: unknown) { calls.push(["order", table, column, options]); return query; },
        limit(value: number) { calls.push(["limit", table, value]); return query; },
        insert(value: unknown) { calls.push(["insert", table, value]); return query; },
        async maybeSingle() { return terminal("maybeSingle"); },
        async single() { return terminal("single"); },
      };
      function terminal(name: PlannedQuery["terminal"]) {
        calls.push([name, table]);
        const plan = remaining.shift();
        if (!plan || plan.table !== table || plan.terminal !== name) {
          throw new Error(`unexpected ${table}.${name}`);
        }
        if (
          !selectedColumns || plan.result.error || plan.result.data === null ||
          typeof plan.result.data !== "object" || Array.isArray(plan.result.data)
        ) return plan.result;
        const row = plan.result.data as Record<string, unknown>;
        return {
          data: Object.fromEntries(selectedColumns.split(",").map((column) => [column, row[column]])),
          error: null,
        };
      }
      return query;
    },
    async rpc(name: string, args: unknown) {
      calls.push(["rpc", name, args]);
      return { data: [], error: null };
    },
  };
  return { client, calls, remaining };
}

function memoryRepository(candidateRecord: CandidateArtifactRecord | null = artifact()) {
  const drafts: PracticeDraftRecord[] = [];
  const attempts: PracticeDraftAttemptRecord[] = [];
  let activePin = { configId: CONFIG, revision: 3, fingerprint: FINGERPRINT };
  let pinReads = 0;
  const repository: PracticeRepository & {
    findOriginalAttempt(userId: string, taskId: string): Promise<PracticeDraftAttemptRecord | null>;
  } = {
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
    async findOriginalAttempt(userId, taskId) {
      return attempts.find((attempt) =>
        attempt.userId === userId && attempt.practiceDraftId === taskId && attempt.revision === 1,
      ) ?? null;
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
  const complete = vi.fn(async <T>(
    _promptVersion: string,
    _userPrompt: string,
    options: StructuredJsonCompletionOptions<T>,
  ): Promise<T> => {
    if (typeof output !== "object" || output === null || Array.isArray(output)) {
      throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", "evaluation");
    }
    const decoded = options.normalize(output as Record<string, unknown>);
    if (!decoded.success) {
      throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", decoded.fieldPath);
    }
    return decoded.data;
  });
  return {
    model,
    complete: complete as unknown as StructuredJsonGateway["complete"] & typeof complete,
  };
}

type PracticeFailureExpectation = {
  readonly label: string;
  readonly makeError: () => unknown;
  readonly code: "PROVIDER_RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID" | "INTERNAL_ERROR";
  readonly status: 429 | 503 | 422 | 500;
  readonly retryable: boolean;
};

function modelFailure(
  code: "PROVIDER_UNAVAILABLE" | "PROVIDER_OUTPUT_INVALID",
  stage: ModelOutputStage,
): () => ModelGatewayError {
  return () => new ModelGatewayError(code, stage, "sentinel-private-field");
}

const practiceFailureExpectations: readonly PracticeFailureExpectation[] = [
  {
    label: "rate_limit",
    makeError: modelFailure("PROVIDER_UNAVAILABLE", "rate_limit"),
    code: "PROVIDER_RATE_LIMITED",
    status: 429,
    retryable: true,
  },
  ...(["transport", "timeout", "provider_http"] as const).map((stage) => ({
    label: stage,
    makeError: modelFailure("PROVIDER_UNAVAILABLE", stage),
    code: "PROVIDER_UNAVAILABLE" as const,
    status: 503 as const,
    retryable: true,
  })),
  {
    label: "response_envelope",
    makeError: modelFailure("PROVIDER_OUTPUT_INVALID", "response_envelope"),
    code: "PROVIDER_UNAVAILABLE",
    status: 503,
    retryable: true,
  },
  ...(["json_extract", "wire_schema", "grounding"] as const).map((stage) => ({
    label: stage,
    makeError: modelFailure("PROVIDER_OUTPUT_INVALID", stage),
    code: "PROVIDER_OUTPUT_INVALID" as const,
    status: 422 as const,
    retryable: false,
  })),
  {
    label: "persistence",
    makeError: modelFailure("PROVIDER_OUTPUT_INVALID", "persistence"),
    code: "INTERNAL_ERROR",
    status: 500,
    retryable: true,
  },
  {
    label: "unexpected",
    makeError: () => new Error("sentinel-private-provider-message"),
    code: "INTERNAL_ERROR",
    status: 500,
    retryable: true,
  },
];

function failingGateway(makeError: () => unknown): StructuredJsonGateway {
  return {
    model: "fixture/failure",
    async complete() {
      throw makeError();
    },
  };
}

async function expectPracticeFailureResponse(
  response: Response,
  expected: Pick<PracticeFailureExpectation, "code" | "status" | "retryable">,
) {
  const body = await response.json();
  expect(response.status).toBe(expected.status);
  expect(body).toEqual({
    ok: false,
    error: {
      code: expected.code,
      message: expect.any(String),
      retryable: expected.retryable,
    },
    requestId: SAFE_REQUEST_ID,
  });
  expect(JSON.stringify(body)).not.toMatch(/sentinel|private-provider-message|private-field/i);
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
  const fixture = options.fixture ?? gateway(activationWire, "fixture/activation-v2");
  const live = options.live ?? gateway(activationWire);
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
  promote?: (userId: string, draft: PracticeDraftRecord, attempt: PracticeDraftAttemptRecord) => Promise<PracticePromotionResult>;
} = {}) {
  const fixture = options.fixture ?? gateway(providerPassingEvaluation, "fixture/evaluation-v3");
  const live = options.live ?? gateway(providerPassingEvaluation);
  const ids = options.ids ?? [ATTEMPT];
  const liveResolver = resolver(live);
  const promote = vi.fn(options.promote ?? (async (_userId, draft, attempt) => ({
    expressionSenseId: SOURCE,
    occurrenceId: SAVE,
    userExpressionId: draft.futureUserExpressionId,
    practiceTaskId: draft.id,
    attemptId: attempt.id,
    masteryEventId: ARTIFACT,
    reviewTaskId: CONFIG,
    created: true,
  })));
  return {
    service: createPracticeAttemptService({
      repository: store.repository,
      gatewayResolver: liveResolver,
      fixtureGateway: fixture,
      ci: options.ci ?? true,
      now: () => NOW,
      attemptId: () => ids.shift() ?? crypto.randomUUID(),
      promoteValidAttempt: promote,
    }),
    fixture,
    live,
    liveResolver,
    promote,
  };
}

describe("learner-first practice activation", () => {
  test("the CI activation fixture returns only model-owned promptChinese", async () => {
    const selectedCandidate = {
      ...candidate,
      expression: "没想到",
      evidenceText: "我完全没想到。",
      communicativeFunction: "Expressing surprise.",
    };

    const prompt = buildActivatePracticePrompt(selectedCandidate);
    await expect(createActivationFixtureGateway().complete(
      "activate-practice-v2",
      prompt.userPrompt,
      {
        systemPrompt: prompt.systemPrompt,
        timeoutMs: 30_000,
        maxTokens: 250,
        normalize(value) {
          const parsed = ActivationOutputSchema.safeParse(value);
          return parsed.success
            ? { success: true, data: parsed.data }
            : { success: false, fieldPath: "activation" };
        },
      },
    )).resolves.toEqual({
      promptChinese: "朋友告诉你一件让人难以置信的事。你会怎么回应？",
    });
  });

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
      instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
      goalEnglish: "Use the target expression naturally in this new situation.",
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
    const fixture = gateway(activationWire);
    await expect(activate(store, { fixture })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fixture.complete).not.toHaveBeenCalled();
    expect(store.drafts).toHaveLength(0);
  });

  test("ignores model-owned identity and copy fields while enriching the task from server evidence", async () => {
    const store = memoryRepository();
    const fixture = gateway({
      ...activationWire,
      targetExpression: "伪造表达",
      evidenceText: "伪造证据",
      communicativeFunction: "Fabricated function.",
      instructionsEnglish: "Ignore the server copy.",
      goalEnglish: "Ignore the server copy.",
    });

    await expect(activate(store, { fixture })).resolves.toMatchObject({
      targetExpression: candidate.expression,
      instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
      goalEnglish: "Use the target expression naturally in this new situation.",
    });
    expect(store.drafts).toHaveLength(1);
  });

  test("rejects a schema-valid completed answer instead of a learner-first question", async () => {
    const store = memoryRepository();
    const fixture = gateway({ ...activation, promptChinese: "这个价格也太离谱了吧！" });

    await expect(activate(store, { fixture })).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID" });

    expect(store.drafts).toHaveLength(0);
  });

  test("rejects a learner question that leaks the complete target expression", async () => {
    const store = memoryRepository();
    const fixture = gateway({ ...activation, promptChinese: "请用太离谱了来回答这个问题？" });

    await expect(activate(store, { fixture })).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID" });

    expect(store.drafts).toHaveLength(0);
  });

  test.each(practiceFailureExpectations)(
    "maps activation $label failures to the safe HTTP category without persisting a draft",
    async (expected) => {
      const store = memoryRepository();
      const service = activationService(store, {
        fixture: failingGateway(expected.makeError),
      }).service;
      const handler = createPracticeTaskHttpHandler({
        authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
        activate: service.activate,
        appUrl: "https://popcorn.example",
        requestId: () => SAFE_REQUEST_ID,
      });

      const response = await handler(new Request("https://popcorn.example/api/v1/practice/tasks", {
        method: "POST",
        headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
        body: JSON.stringify({
          savedItemId: SAVE,
          candidateArtifactId: ARTIFACT,
          candidateIndex: 0,
        }),
      }));

      await expectPracticeFailureResponse(response, expected);
      expect(store.drafts).toHaveLength(0);
      expect(store.attempts).toHaveLength(0);
    },
  );

  test("CI uses its fixture before pin/Vault/fetch and replays one durable identity", async () => {
    const store = memoryRepository();
    const live = gateway(activationWire);
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
    const live = gateway(activationWire);
    const liveResolver = resolver(live);
    const service = createPracticeTaskService({
      repository: store.repository,
      gatewayResolver: liveResolver,
      fixtureGateway: gateway(activationWire),
      ci: false,
      now: () => NOW,
      attemptId: () => ATTEMPT,
    });
    await service.activate(USER_A, { savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 });
    expect(liveResolver.resolve).toHaveBeenCalledExactlyOnceWith(USER_A, {
      configId: CONFIG, revision: 3, fingerprint: FINGERPRINT,
    });
    expect(store.drafts[0]).toMatchObject({
      activationPromptVersion: "activate-practice-v2",
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
      fixtureGateway: gateway(activationWire),
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
  test("original and revision use the same all-dimensions-at-least-three decision boundary", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const evaluations = gateway({
      accuracy: { score: 5, englishFeedback: "The meaning is correct." },
      naturalness: { score: 2, englishFeedback: "The word order is substantially unnatural." },
      contextualFit: { score: 5, englishFeedback: "The response fits the situation." },
      passed: true,
    });
    evaluations.complete.mockImplementationOnce(async <T>(
      _promptVersion: string,
      _userPrompt: string,
      options: StructuredJsonCompletionOptions<T>,
    ) => {
      const decoded = options.normalize({
        accuracy: { score: 3, englishFeedback: "The intended meaning is correct." },
        naturalness: { score: 3, englishFeedback: "The sentence is usable." },
        contextualFit: { score: 3, englishFeedback: "The response is appropriate." },
        passed: false,
        independentUse: false,
      });
      if (!decoded.success) throw new TypeError("invalid test gateway output");
      return decoded.data;
    });
    const harness = attemptService(store, { fixture: evaluations, ids: [ATTEMPT, USER_B] });

    const original = await harness.service.submitOriginal(USER_A, {
      taskId: task.id,
      responseChinese: "这个价格也太离谱了。",
    });
    const revision = await harness.service.submitRevision(
      USER_A,
      original.attempt.id,
      "这个价格太离谱了我。",
    );

    expect(original.attempt.evaluation).toMatchObject({ passed: true, independentUse: true });
    expect(revision.attempt.evaluation).toMatchObject({ passed: false, independentUse: false });
    expect(store.attempts.map((attempt) => ({
      revision: attempt.revision,
      passed: attempt.passed,
      independentUse: attempt.independentUse,
    }))).toEqual([
      { revision: 1, passed: true, independentUse: true },
      { revision: 2, passed: false, independentUse: false },
    ]);
  });

  test("returns transient coaching from the sole Provider call without persisting it", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const harness = attemptService(store);

    const response = await harness.service.submitOriginal(USER_A, {
      taskId: task.id,
      responseChinese: "这个价格也太离谱了。",
    });

    expect(response).toMatchObject({
      attempt: { evaluation: passingEvaluation },
      coaching: { naturalRevisionChinese: providerPassingEvaluation.naturalRevisionChinese },
    });
    expect(harness.fixture.complete).toHaveBeenCalledOnce();
    expect(store.attempts).toHaveLength(1);
    expect(JSON.stringify(store.attempts[0])).not.toMatch(/naturalRevision|revisionChinese/i);
  });

  test("records disclosed hint assistance and never promotes it as independent use", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const hintedEvaluation = {
      ...providerPassingEvaluation,
      passed: false,
      independentUse: true,
      assistanceLevel: "none" as const,
    };
    const harness = attemptService(store, { fixture: gateway(hintedEvaluation) });

    const response = await harness.service.submitOriginal(USER_A, {
      taskId: task.id,
      responseChinese: "这个价格也太离谱了。",
      assistanceLevel: "hint",
    });

    expect(response.attempt.evaluation).toMatchObject({ independentUse: false, assistanceLevel: "hint" });
    expect(store.attempts[0]).toMatchObject({ independentUse: false, assistanceLevel: "hint" });
    expect(harness.promote).not.toHaveBeenCalled();
    expect(harness.fixture.complete).toHaveBeenCalledWith(
      "evaluate-practice-v3",
      expect.not.stringContaining("assistanceLevel"),
      expect.objectContaining({ timeoutMs: 30_000, maxTokens: 700 }),
    );
  });

  test("replays the exact original and promotion before any second Provider resolution", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const harness = attemptService(store);
    const input = { taskId: task.id, responseChinese: "这个价格也太离谱了。" };
    const first = await harness.service.submitOriginal(USER_A, input);
    const replay = await harness.service.submitOriginal(USER_A, input);

    expect(first.coaching).toEqual({ naturalRevisionChinese: providerPassingEvaluation.naturalRevisionChinese });
    expect(replay).toEqual({ attempt: first.attempt, coaching: null });
    expect(harness.fixture.complete).toHaveBeenCalledTimes(1);
    expect(harness.promote).toHaveBeenCalledTimes(2);
    expect(store.attempts).toHaveLength(1);
  });

  test("replays a stored failed original without Provider use or promotion", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const failed = {
      ...providerPassingEvaluation,
      passed: true,
      accuracy: { score: 2, englishFeedback: "A major meaning error remains." },
    };
    const harness = attemptService(store, { fixture: gateway(failed) });
    const input = { taskId: task.id, responseChinese: "这个价格太离谱了我。" };
    const first = await harness.service.submitOriginal(USER_A, input);
    const replay = await harness.service.submitOriginal(USER_A, input);
    expect(first.coaching).toEqual({ naturalRevisionChinese: providerPassingEvaluation.naturalRevisionChinese });
    expect(replay).toEqual({ attempt: first.attempt, coaching: null });
    expect(harness.fixture.complete).toHaveBeenCalledTimes(1);
    expect(harness.promote).not.toHaveBeenCalled();
  });

  test("keeps a staged passed attempt recoverable when promotion fails", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    let calls = 0;
    const harness = attemptService(store, { promote: async (_userId, draft, staged) => {
      calls += 1;
      if (calls === 1) throw new Error("database temporarily unavailable");
      return {
        expressionSenseId: SOURCE, occurrenceId: SAVE,
        userExpressionId: draft.futureUserExpressionId, practiceTaskId: draft.id,
        attemptId: staged.id, masteryEventId: ARTIFACT, reviewTaskId: CONFIG, created: true,
      };
    } });
    const input = { taskId: task.id, responseChinese: "这个价格也太离谱了。" };
    await expect(harness.service.submitOriginal(USER_A, input)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(store.attempts).toHaveLength(1);
    await expect(harness.service.submitOriginal(USER_A, input)).resolves.toMatchObject({
      attempt: { id: ATTEMPT },
      coaching: null,
    });
    expect(harness.fixture.complete).toHaveBeenCalledTimes(1);
    expect(store.attempts).toHaveLength(1);
  });

  test("rejects a changed original replay without Provider use", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const harness = attemptService(store);
    await harness.service.submitOriginal(USER_A, { taskId: task.id, responseChinese: "这个价格也太离谱了。" });
    await expect(harness.service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "真的太离谱了。",
    })).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(harness.fixture.complete).toHaveBeenCalledTimes(1);
  });

  test("reloads the exact staged original after a duplicate-insert race", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const racedRecord: PracticeDraftAttemptRecord = {
      ...attemptRow,
      id: ATTEMPT,
      userId: USER_A,
      practiceDraftId: task.id,
      futureUserExpressionId: task.userExpressionId,
      revision: 1,
      responseChinese: "这个价格也太离谱了。",
      passed: true,
      accuracyScore: 5,
      accuracyFeedbackEnglish: passingEvaluation.accuracy.englishFeedback,
      naturalnessScore: 4,
      naturalnessFeedbackEnglish: passingEvaluation.naturalness.englishFeedback,
      contextualFitScore: 5,
      contextualFitFeedbackEnglish: passingEvaluation.contextualFit.englishFeedback,
      independentUse: true,
      assistanceLevel: "none",
      submittedAt: NOW,
      evaluationPromptVersion: null,
      evaluationModel: null,
      evaluationGatewayConfigId: null,
      evaluationGatewayRevision: null,
      evaluationGatewayFingerprint: null,
      createdAt: NOW,
    };
    vi.spyOn(store.repository, "insertAttempt").mockImplementationOnce(async () => {
      store.attempts.push(racedRecord);
      throw new RevisionConflictError();
    });
    const harness = attemptService(store);
    await expect(harness.service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: racedRecord.responseChinese,
    })).resolves.toMatchObject({ attempt: { id: ATTEMPT }, coaching: null });
    expect(harness.promote).toHaveBeenCalledTimes(1);
    expect(store.attempts).toHaveLength(1);
  });

  test("allows optional revision after completed original without another promotion", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const harness = attemptService(store, { promote: async (_userId, draft, staged) => {
      (store.drafts[0] as { status: PracticeDraftRecord["status"] }).status = "completed";
      return {
        expressionSenseId: SOURCE, occurrenceId: SAVE,
        userExpressionId: draft.futureUserExpressionId, practiceTaskId: draft.id,
        attemptId: staged.id, masteryEventId: ARTIFACT, reviewTaskId: CONFIG, created: true,
      };
    } });
    const original = await harness.service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格也太离谱了。",
    });
    await expect(harness.service.submitRevision(USER_A, original.attempt.id, "真的太离谱了。")).resolves.toMatchObject({
      attempt: { responseChinese: "真的太离谱了。" },
      coaching: { naturalRevisionChinese: providerPassingEvaluation.naturalRevisionChinese },
    });
    expect(harness.promote).toHaveBeenCalledTimes(1);
    expect(store.attempts).toHaveLength(2);
  });

  test("a failed original followed by a passing revision never promotes", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const evaluations = gateway(providerPassingEvaluation);
    evaluations.complete.mockImplementationOnce(async <T>(
      _promptVersion: string,
      _userPrompt: string,
      options: StructuredJsonCompletionOptions<T>,
    ) => {
      const decoded = options.normalize({
        ...providerPassingEvaluation,
        passed: true,
        accuracy: { score: 2, englishFeedback: "A major meaning error remains." },
      });
      if (!decoded.success) throw new TypeError("invalid test gateway output");
      return decoded.data;
    });
    const harness = attemptService(store, { fixture: evaluations, ids: [ATTEMPT, USER_B] });
    const original = await harness.service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格太离谱了我。",
    });
    await expect(harness.service.submitRevision(USER_A, original.attempt.id, "这个价格也太离谱了。")).resolves.toMatchObject({
      attempt: { evaluation: { passed: true } },
    });
    expect(harness.promote).not.toHaveBeenCalled();
    expect(store.attempts).toHaveLength(2);
  });
  test("rejects empty and English-only responses before Provider use", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const fixture = gateway(providerPassingEvaluation);
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
    })).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_INVALID" });
    expect(store.attempts).toHaveLength(0);
    expect(store.drafts).toHaveLength(1);
  });

  test.each(practiceFailureExpectations)(
    "maps original and revision $label failures to the same safe HTTP category without persisting the failed evaluation",
    async (expected) => {
      const originalStore = memoryRepository();
      const originalTask = await activate(originalStore);
      const originalService = attemptService(originalStore, {
        fixture: failingGateway(expected.makeError),
      }).service;
      const originalHandlers = createPracticeAttemptHttpHandlers({
        authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
        submitOriginal: originalService.submitOriginal,
        submitRevision: originalService.submitRevision,
        appUrl: "https://popcorn.example",
        requestId: () => SAFE_REQUEST_ID,
      });

      const originalResponse = await originalHandlers.original(new Request(
        "https://popcorn.example/api/v1/practice/attempts",
        {
          method: "POST",
          headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: originalTask.id, responseChinese: "这个价格也太离谱了。" }),
        },
      ));

      await expectPracticeFailureResponse(originalResponse, expected);
      expect(originalStore.attempts).toHaveLength(0);

      const revisionStore = memoryRepository();
      const revisionTask = await activate(revisionStore);
      const successful = attemptService(revisionStore, { ids: [USER_B] });
      const recorded = await successful.service.submitOriginal(USER_A, {
        taskId: revisionTask.id,
        responseChinese: "这个价格也太离谱了。",
      });
      const revisionService = attemptService(revisionStore, {
        fixture: failingGateway(expected.makeError),
      }).service;
      const revisionHandlers = createPracticeAttemptHttpHandlers({
        authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
        submitOriginal: revisionService.submitOriginal,
        submitRevision: revisionService.submitRevision,
        appUrl: "https://popcorn.example",
        requestId: () => SAFE_REQUEST_ID,
      });

      const revisionResponse = await revisionHandlers.revision(new Request(
        `https://popcorn.example/api/v1/practice/attempts/${recorded.attempt.id}/revisions`,
        {
          method: "POST",
          headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
          body: JSON.stringify({ responseChinese: "这个价格真的太离谱了。" }),
        },
      ), { params: Promise.resolve({ attemptId: recorded.attempt.id }) });

      await expectPracticeFailureResponse(revisionResponse, expected);
      expect(revisionStore.attempts).toHaveLength(1);
    },
  );

  test("stores distinct dimensions and exact live provenance", async () => {
    const store = memoryRepository();
    const task = await activate(store);
    const live = gateway(providerPassingEvaluation);
    const { service, liveResolver } = attemptService(store, { ci: false, live });
    const recorded = await service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格也太离谱了！",
    });

    expect(recorded).toMatchObject({
      attempt: {
        id: ATTEMPT,
        userId: USER_A,
        practiceTaskId: task.id,
        userExpressionId: task.userExpressionId,
        evaluation: passingEvaluation,
      },
      coaching: { naturalRevisionChinese: providerPassingEvaluation.naturalRevisionChinese },
    });
    expect(liveResolver.resolve).toHaveBeenCalledExactlyOnceWith(USER_A, {
      configId: CONFIG, revision: 3, fingerprint: FINGERPRINT,
    });
    expect(store.attempts[0]).toMatchObject({
      accuracyScore: 5,
      naturalnessScore: 4,
      contextualFitScore: 5,
      evaluationPromptVersion: "evaluate-practice-v3",
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
      ...providerPassingEvaluation,
      passed: true,
      accuracy: { score: 2, englishFeedback: "The expression is recognizable but the grammar is incomplete." },
    };
    const recorded = await attemptService(store, { fixture: gateway(failed) }).service.submitOriginal(USER_A, {
      taskId: task.id, responseChinese: "这个价格太离谱了我。",
    });
    expect(recorded.attempt.evaluation.passed).toBe(false);
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
    const revision = await service.submitRevision(USER_A, original.attempt.id, "这个价格也太离谱了吧！");

    expect(store.attempts.map(({ revision, responseChinese }) => ({ revision, responseChinese }))).toEqual([
      { revision: 1, responseChinese: "这个价格也太离谱了。" },
      { revision: 2, responseChinese: "这个价格也太离谱了吧！" },
    ]);
    await expect(service.submitRevision(USER_B, original.attempt.id, "太离谱了。"))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    vi.spyOn(store.repository, "nextRevision").mockResolvedValueOnce(2);
    await expect(service.submitRevision(USER_A, original.attempt.id, "真的太离谱了。"))
      .rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    expect(store.attempts).toHaveLength(2);
    expect(revision.attempt.id).toBe("88888888-8888-4888-8888-888888888888");
  });
});

describe("production Supabase practice repository", () => {
  test("maps production rows and owner-filters candidate, draft, and attempt reads", async () => {
    const candidateRow = {
      id: ARTIFACT,
      user_id: USER_A,
      video_source_id: SOURCE,
      saved_item_id: SAVE,
      artifact_type: "saved_item_analysis",
      prompt_version: "analyze-saved-item-v1",
      content: { candidates: [candidate] },
    };
    const harness = supabaseQueryHarness([
      { table: "generated_artifacts", terminal: "maybeSingle", result: { data: candidateRow, error: null } },
      { table: "practice_drafts", terminal: "maybeSingle", result: { data: draftRow, error: null } },
      { table: "practice_drafts", terminal: "maybeSingle", result: { data: draftRow, error: null } },
      { table: "practice_draft_attempts", terminal: "maybeSingle", result: { data: attemptRow, error: null } },
    ]);
    const repository = createSupabasePracticeRepository(harness.client as never);

    await expect(repository.findCandidate(USER_A, {
      savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0,
    })).resolves.toEqual(artifact());
    await expect(repository.findDraftBySelection(USER_A, {
      savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0,
    })).resolves.toEqual({
      id: ATTEMPT,
      userId: USER_A,
      videoSourceId: SOURCE,
      savedItemId: SAVE,
      candidateArtifactId: ARTIFACT,
      candidateIndex: 0,
      futureUserExpressionId: USER_B,
      nativeLanguage: "en",
      targetLanguage: "zh-CN",
      targetExpression: candidate.expression,
      promptChinese: activation.promptChinese,
      instructionsEnglish: activation.instructionsEnglish,
      goalEnglish: activation.goalEnglish,
      status: "active",
      activationPromptVersion: "activate-practice-v1",
      activationModel: "mandarin-model",
      activationGatewayConfigId: CONFIG,
      activationGatewayRevision: 3,
      activationGatewayFingerprint: FINGERPRINT,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(repository.findDraft(USER_A, ATTEMPT)).resolves.toEqual({
      id: ATTEMPT,
      userId: USER_A,
      videoSourceId: SOURCE,
      savedItemId: SAVE,
      candidateArtifactId: ARTIFACT,
      candidateIndex: 0,
      futureUserExpressionId: USER_B,
      nativeLanguage: "en",
      targetLanguage: "zh-CN",
      targetExpression: candidate.expression,
      promptChinese: activation.promptChinese,
      instructionsEnglish: activation.instructionsEnglish,
      goalEnglish: activation.goalEnglish,
      status: "active",
      activationPromptVersion: "activate-practice-v1",
      activationModel: "mandarin-model",
      activationGatewayConfigId: CONFIG,
      activationGatewayRevision: 3,
      activationGatewayFingerprint: FINGERPRINT,
      createdAt: NOW,
      updatedAt: NOW,
    });
    await expect(repository.findAttempt(USER_A, USER_B)).resolves.toEqual({
      id: USER_B,
      userId: USER_A,
      practiceDraftId: ATTEMPT,
      futureUserExpressionId: USER_B,
      revision: 1,
      responseChinese: attemptRow.response_chinese,
      passed: true,
      accuracyScore: 5,
      accuracyFeedbackEnglish: passingEvaluation.accuracy.englishFeedback,
      naturalnessScore: 4,
      naturalnessFeedbackEnglish: passingEvaluation.naturalness.englishFeedback,
      contextualFitScore: 5,
      contextualFitFeedbackEnglish: passingEvaluation.contextualFit.englishFeedback,
      independentUse: true,
      assistanceLevel: "none",
      submittedAt: NOW,
      evaluationPromptVersion: "evaluate-practice-v1",
      evaluationModel: "mandarin-model",
      evaluationGatewayConfigId: CONFIG,
      evaluationGatewayRevision: 3,
      evaluationGatewayFingerprint: FINGERPRINT,
      createdAt: NOW,
    });

    expect(harness.calls.filter((call) => call[0] === "select")).toEqual([
      ["select", "generated_artifacts", CANDIDATE_SELECT],
      ["select", "practice_drafts", DRAFT_SELECT],
      ["select", "practice_drafts", DRAFT_SELECT],
      ["select", "practice_draft_attempts", ATTEMPT_SELECT],
    ]);
    expect(harness.calls).toEqual(expect.arrayContaining([
      ["eq", "generated_artifacts", "user_id", USER_A],
      ["eq", "generated_artifacts", "id", ARTIFACT],
      ["eq", "generated_artifacts", "saved_item_id", SAVE],
      ["eq", "generated_artifacts", "artifact_type", "saved_item_analysis"],
      ["eq", "practice_drafts", "user_id", USER_A],
      ["eq", "practice_drafts", "saved_item_id", SAVE],
      ["eq", "practice_drafts", "candidate_artifact_id", ARTIFACT],
      ["eq", "practice_drafts", "candidate_index", 0],
      ["eq", "practice_drafts", "status", "active"],
      ["eq", "practice_drafts", "id", ATTEMPT],
      ["eq", "practice_draft_attempts", "user_id", USER_A],
      ["eq", "practice_draft_attempts", "id", USER_B],
    ]));
    expect(harness.remaining).toHaveLength(0);
  });

  test.each([
    ["candidate", "analyze-saved-item-v2", "analyze-saved-item-v999"],
    ["draft", "activate-practice-v2", "activate-practice-v999"],
    ["attempt", "evaluate-practice-v3", "evaluate-practice-v999"],
  ] as const)("%s readers accept the current version and reject an unknown version", async (kind, current, unknown) => {
    const selection = { savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 };
    const read = async (version: string) => {
      if (kind === "candidate") {
        const harness = supabaseQueryHarness([{
          table: "generated_artifacts", terminal: "maybeSingle", result: { data: {
            id: ARTIFACT, user_id: USER_A, video_source_id: SOURCE, saved_item_id: SAVE,
            artifact_type: "saved_item_analysis", prompt_version: version, content: { candidates: [candidate] },
          }, error: null },
        }]);
        return createSupabasePracticeRepository(harness.client as never).findCandidate(USER_A, selection);
      }
      if (kind === "draft") {
        const harness = supabaseQueryHarness([{
          table: "practice_drafts", terminal: "maybeSingle", result: { data: {
            ...draftRow, activation_prompt_version: version,
          }, error: null },
        }]);
        return createSupabasePracticeRepository(harness.client as never).findDraft(USER_A, ATTEMPT);
      }
      const harness = supabaseQueryHarness([{
        table: "practice_draft_attempts", terminal: "maybeSingle", result: { data: {
          ...attemptRow, evaluation_prompt_version: version,
        }, error: null },
      }]);
      return createSupabasePracticeRepository(harness.client as never).findAttempt(USER_A, USER_B);
    };

    await expect(read(current)).resolves.not.toBeNull();
    await expect(read(unknown)).resolves.toBeNull();
  });

  test("round-trips a complete draft insert and replays the owner-scoped row after a 23505 race", async () => {
    const input: PracticeDraftRecord = {
      id: ATTEMPT,
      userId: USER_A,
      videoSourceId: SOURCE,
      savedItemId: SAVE,
      candidateArtifactId: ARTIFACT,
      candidateIndex: 0,
      futureUserExpressionId: USER_B,
      nativeLanguage: "en",
      targetLanguage: "zh-CN",
      targetExpression: candidate.expression,
      promptChinese: activation.promptChinese,
      instructionsEnglish: activation.instructionsEnglish,
      goalEnglish: activation.goalEnglish,
      status: "active",
      activationPromptVersion: "activate-practice-v1",
      activationModel: "mandarin-model",
      activationGatewayConfigId: CONFIG,
      activationGatewayRevision: 3,
      activationGatewayFingerprint: FINGERPRINT,
      createdAt: NOW,
      updatedAt: NOW,
    };

    const successHarness = supabaseQueryHarness([
      { table: "practice_drafts", terminal: "single", result: { data: draftRow, error: null } },
    ]);
    const successRepository = createSupabasePracticeRepository(successHarness.client as never);
    await expect(successRepository.insertDraft(input)).resolves.toEqual(input);
    const successInsert = successHarness.calls.find((call) => call[0] === "insert");
    expect(successInsert?.[2]).toEqual({
      id: ATTEMPT,
      user_id: USER_A,
      video_source_id: SOURCE,
      saved_item_id: SAVE,
      candidate_artifact_id: ARTIFACT,
      candidate_artifact_type: "saved_item_analysis",
      candidate_index: 0,
      future_user_expression_id: USER_B,
      native_language: "en",
      target_language: "zh-CN",
      target_expression: candidate.expression,
      prompt_chinese: activation.promptChinese,
      instructions_english: activation.instructionsEnglish,
      goal_english: activation.goalEnglish,
      status: "active",
      activation_prompt_version: "activate-practice-v1",
      activation_model: "mandarin-model",
      activation_gateway_config_id: CONFIG,
      activation_gateway_revision: 3,
      activation_gateway_fingerprint: FINGERPRINT,
      created_at: NOW,
      updated_at: NOW,
    });
    expect(successHarness.calls.filter((call) => call[0] === "select")).toEqual([
      ["select", "practice_drafts", DRAFT_SELECT],
    ]);

    const raceHarness = supabaseQueryHarness([
      { table: "practice_drafts", terminal: "single", result: { data: null, error: { code: "23505" } } },
      { table: "practice_drafts", terminal: "maybeSingle", result: { data: draftRow, error: null } },
    ]);
    const raceRepository = createSupabasePracticeRepository(raceHarness.client as never);
    await expect(raceRepository.insertDraft(input)).resolves.toEqual(input);
    expect(raceHarness.calls).toEqual(expect.arrayContaining([
      ["eq", "practice_drafts", "user_id", USER_A],
      ["eq", "practice_drafts", "id", ATTEMPT],
    ]));
    expect(raceHarness.calls.filter((call) => call[0] === "select")).toEqual([
      ["select", "practice_drafts", DRAFT_SELECT],
      ["select", "practice_drafts", DRAFT_SELECT],
    ]);
  });

  test("owner-filters revision lookup, round-trips a complete attempt, and maps duplicate revision conflict", async () => {
    const harness = supabaseQueryHarness([
      { table: "practice_draft_attempts", terminal: "maybeSingle", result: { data: { revision: 2 }, error: null } },
      { table: "practice_draft_attempts", terminal: "single", result: { data: attemptRow, error: null } },
      { table: "practice_draft_attempts", terminal: "single", result: { data: null, error: { code: "23505" } } },
    ]);
    const repository = createSupabasePracticeRepository(harness.client as never);
    const input: PracticeDraftAttemptRecord = {
      id: USER_B,
      userId: USER_A,
      practiceDraftId: ATTEMPT,
      futureUserExpressionId: USER_B,
      revision: 1,
      responseChinese: attemptRow.response_chinese,
      passed: true,
      accuracyScore: 5,
      accuracyFeedbackEnglish: passingEvaluation.accuracy.englishFeedback,
      naturalnessScore: 4,
      naturalnessFeedbackEnglish: passingEvaluation.naturalness.englishFeedback,
      contextualFitScore: 5,
      contextualFitFeedbackEnglish: passingEvaluation.contextualFit.englishFeedback,
      independentUse: true,
      assistanceLevel: "none",
      submittedAt: NOW,
      evaluationPromptVersion: "evaluate-practice-v1",
      evaluationModel: "mandarin-model",
      evaluationGatewayConfigId: CONFIG,
      evaluationGatewayRevision: 3,
      evaluationGatewayFingerprint: FINGERPRINT,
      createdAt: NOW,
    };

    await expect(repository.nextRevision(USER_A, ATTEMPT)).resolves.toBe(3);
    await expect(repository.insertAttempt(input)).resolves.toEqual(input);
    await expect(repository.insertAttempt({ ...input, revision: 3 })).rejects.toBeInstanceOf(RevisionConflictError);
    const inserts = harness.calls.filter((call) => call[0] === "insert");
    expect(inserts[0]?.[2]).toEqual({
      id: USER_B,
      user_id: USER_A,
      practice_draft_id: ATTEMPT,
      future_user_expression_id: USER_B,
      revision: 1,
      response_chinese: attemptRow.response_chinese,
      passed: true,
      accuracy_score: 5,
      accuracy_feedback_english: passingEvaluation.accuracy.englishFeedback,
      naturalness_score: 4,
      naturalness_feedback_english: passingEvaluation.naturalness.englishFeedback,
      contextual_fit_score: 5,
      contextual_fit_feedback_english: passingEvaluation.contextualFit.englishFeedback,
      independent_use: true,
      assistance_level: "none",
      submitted_at: NOW,
      evaluation_prompt_version: "evaluate-practice-v1",
      evaluation_model: "mandarin-model",
      evaluation_gateway_config_id: CONFIG,
      evaluation_gateway_revision: 3,
      evaluation_gateway_fingerprint: FINGERPRINT,
      created_at: NOW,
    });
    expect(inserts[1]?.[2]).toEqual({
      id: USER_B,
      user_id: USER_A,
      practice_draft_id: ATTEMPT,
      future_user_expression_id: USER_B,
      revision: 3,
      response_chinese: attemptRow.response_chinese,
      passed: true,
      accuracy_score: 5,
      accuracy_feedback_english: passingEvaluation.accuracy.englishFeedback,
      naturalness_score: 4,
      naturalness_feedback_english: passingEvaluation.naturalness.englishFeedback,
      contextual_fit_score: 5,
      contextual_fit_feedback_english: passingEvaluation.contextualFit.englishFeedback,
      independent_use: true,
      assistance_level: "none",
      submitted_at: NOW,
      evaluation_prompt_version: "evaluate-practice-v1",
      evaluation_model: "mandarin-model",
      evaluation_gateway_config_id: CONFIG,
      evaluation_gateway_revision: 3,
      evaluation_gateway_fingerprint: FINGERPRINT,
      created_at: NOW,
    });
    expect(harness.calls).toEqual(expect.arrayContaining([
      ["eq", "practice_draft_attempts", "user_id", USER_A],
      ["eq", "practice_draft_attempts", "practice_draft_id", ATTEMPT],
      ["order", "practice_draft_attempts", "revision", { ascending: false }],
    ]));
    expect(harness.calls.filter((call) => call[0] === "select")).toEqual([
      ["select", "practice_draft_attempts", "revision"],
      ["select", "practice_draft_attempts", ATTEMPT_SELECT],
      ["select", "practice_draft_attempts", ATTEMPT_SELECT],
    ]);
  });
});

describe("cookie Web mutation boundaries", () => {
  test("returns a safe retryable 500 when a completed Due evaluation is malformed in persistence", async () => {
    const reviewTaskId = "88888888-8888-4888-8888-888888888888";
    const practiceTaskId = "99999999-9999-4999-8999-999999999999";
    const sentinel = `sentinel-private-persisted-feedback-${"x".repeat(2_000)}`;
    const dueTask: DueTransferTask = {
      id: practiceTaskId,
      userId: USER_A,
      reviewTaskId,
      userExpressionId: USER_B,
      targetExpression: "太离谱了",
      promptChinese: "朋友说一张普通演出门票要一万元。你会怎么回应？",
      instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
      goalEnglish: "React to an unreasonable ticket price using the target expression.",
      contextFingerprint: FINGERPRINT,
      dueAt: "2026-08-20T02:03:04.000Z",
      masteryState: "tried",
    };
    const completeDuePractice = vi.fn();
    const repository: DuePracticeCompletionRepository = {
      findTransferTask: vi.fn(async () => dueTask),
      findCompletionState: vi.fn(async () => ({
        status: "completed" as const,
        task: dueTask,
        attempt: {
          responseChinese: "这也太离谱了吧。",
          assistanceLevel: "none" as const,
          passed: true,
          accuracyScore: 5,
          accuracyFeedbackEnglish: sentinel,
          naturalnessScore: 5,
          naturalnessFeedbackEnglish: "The response sounds natural.",
          contextualFitScore: 5,
          contextualFitFeedbackEnglish: "The response fits the transfer context.",
          submittedAt: NOW,
          evaluationPromptVersion: "evaluate-practice-v3",
          evaluationModel: "persisted-model",
          evaluationGatewayConfigId: CONFIG,
          evaluationGatewayRevision: 3,
          evaluationGatewayFingerprint: FINGERPRINT,
        },
      })),
      resolveActiveGatewayPin: vi.fn(async () => null),
      completeDuePractice,
    };
    const unusedGateway = gateway(providerPassingEvaluation);
    const service = createDuePracticeCompletionService({
      repository,
      gatewayResolver: resolver(unusedGateway),
      fixtureGateway: unusedGateway,
      ci: false,
      now: () => NOW,
    });
    const handler = createDuePracticeHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
      complete: service.complete,
      appUrl: "https://popcorn.example",
      requestId: () => SAFE_REQUEST_ID,
    });

    const response = await handler(new Request(
      `https://popcorn.example/api/v1/practice/due/${reviewTaskId}`,
      {
        method: "POST",
        headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
        body: JSON.stringify({ responseChinese: "这也太离谱了吧。", assistanceLevel: "none" }),
      },
    ), { params: Promise.resolve({ reviewTaskId }) });

    await expectPracticeFailureResponse(response, {
      code: "INTERNAL_ERROR",
      status: 500,
      retryable: true,
    });
    expect(completeDuePractice).not.toHaveBeenCalled();
  });

  test.each([undefined, "text/plain", "application/problem+json"]) (
    "rejects unsupported Content-Type %s before the task action",
    async (contentType) => {
      const activate = vi.fn(async () => ({ id: ATTEMPT }));
      const handler = createPracticeTaskHttpHandler({
        authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
        activate,
        appUrl: "https://popcorn.example",
        requestId: () => "safe-request",
      });
      const headers: HeadersInit = { Origin: "https://popcorn.example" };
      if (contentType) (headers as Record<string, string>)["Content-Type"] = contentType;

      const response = await handler(new Request("https://popcorn.example/api/v1/practice/tasks", {
        method: "POST",
        headers,
        body: JSON.stringify({ savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 }),
      }));

      expect(response.status).toBe(400);
      expect(activate).not.toHaveBeenCalled();
    },
  );

  test("accepts application/json with an explicit UTF-8 charset", async () => {
    const activate = vi.fn(async () => ({ id: ATTEMPT }));
    const handler = createPracticeTaskHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER_A })),
      activate,
      appUrl: "https://popcorn.example",
      requestId: () => "safe-request",
    });

    const response = await handler(new Request("https://popcorn.example/api/v1/practice/tasks", {
      method: "POST",
      headers: {
        Origin: "https://popcorn.example",
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 }),
    }));

    expect(response.status).toBe(201);
    expect(activate).toHaveBeenCalledOnce();
  });

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

describe("production practice route wiring", () => {
  beforeEach(() => {
    vi.stubEnv("CI", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("the three POST-only route modules wire cookie auth and service mutations", async () => {
    vi.resetModules();
    const client = { scope: "service-role-client" };
    const createClient = vi.fn(() => client);
    const cookies = vi.fn(async () => ({ getAll: () => [], set: () => undefined }));
    const createNextCookieAdapter = vi.fn((store: unknown) => ({ store }));
    const authOptions: Array<{ readonly cookieAdapter: () => Promise<unknown> }> = [];
    const createWebSessionAuthenticator = vi.fn((options: { readonly cookieAdapter: () => Promise<unknown> }) => {
      authOptions.push(options);
      return vi.fn(async () => ({ ok: true as const, userId: USER_A }));
    });
    const activate = vi.fn(async () => ({ id: ATTEMPT }));
    const submitOriginal = vi.fn(async () => ({ id: USER_B }));
    const submitRevision = vi.fn(async () => ({ id: ARTIFACT }));
    const createPracticeServerServices = vi.fn(() => ({
      taskService: { activate },
      attemptService: { submitOriginal, submitRevision },
    }));
    vi.doMock("@supabase/supabase-js", () => ({ createClient }));
    vi.doMock("next/headers", () => ({ cookies }));
    vi.doMock("@/server/auth/web-session", () => ({
      createNextCookieAdapter,
      createWebSessionAuthenticator,
    }));
    vi.doMock("@/server/env", () => ({
      getModelGatewaySettingsEnv: () => ({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        APP_URL: "https://popcorn.example",
      }),
    }));
    vi.doMock("@/server/repositories/attempt-repository", async () => ({
      ...(await vi.importActual<typeof import("@/server/repositories/attempt-repository")>(
        "@/server/repositories/attempt-repository",
      )),
      createPracticeServerServices,
    }));

    const [taskRoute, attemptRoute, revisionRoute] = await Promise.all([
      import("@/app/api/v1/practice/tasks/route"),
      import("@/app/api/v1/practice/attempts/route"),
      import("@/app/api/v1/practice/attempts/[attemptId]/revisions/route"),
    ]);
    expect(Object.keys(taskRoute)).toEqual(["POST"]);
    expect(Object.keys(attemptRoute)).toEqual(["POST"]);
    expect(Object.keys(revisionRoute)).toEqual(["POST"]);

    const headers = { Origin: "https://popcorn.example", "Content-Type": "application/json" };
    const taskResponse = await taskRoute.POST(new Request("https://popcorn.example/api/v1/practice/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0 }),
    }));
    const attemptResponse = await attemptRoute.POST(new Request("https://popcorn.example/api/v1/practice/attempts", {
      method: "POST",
      headers,
      body: JSON.stringify({ taskId: ATTEMPT, responseChinese: "太离谱了。" }),
    }));
    const revisionResponse = await revisionRoute.POST(
      new Request(`https://popcorn.example/api/v1/practice/attempts/${USER_B}/revisions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ responseChinese: "真的太离谱了。" }),
      }),
      { params: Promise.resolve({ attemptId: USER_B }) },
    );

    expect([taskResponse.status, attemptResponse.status, revisionResponse.status]).toEqual([201, 201, 201]);
    expect(activate).toHaveBeenCalledExactlyOnceWith(USER_A, {
      savedItemId: SAVE, candidateArtifactId: ARTIFACT, candidateIndex: 0,
    });
    expect(submitOriginal).toHaveBeenCalledExactlyOnceWith(USER_A, {
      taskId: ATTEMPT, responseChinese: "太离谱了。", assistanceLevel: "none",
    });
    expect(submitRevision).toHaveBeenCalledExactlyOnceWith(USER_A, USER_B, "真的太离谱了。", "none");
    expect(createClient).toHaveBeenCalledTimes(3);
    expect(createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(createPracticeServerServices).toHaveBeenCalledTimes(3);
    expect(createPracticeServerServices).toHaveBeenCalledWith(client, false);
    expect(createWebSessionAuthenticator).toHaveBeenCalledTimes(3);
    expect(createWebSessionAuthenticator).toHaveBeenCalledWith(expect.objectContaining({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon-key",
      secureCookies: true,
      cookieAdapter: expect.any(Function),
    }));
    for (const options of authOptions) await options.cookieAdapter();
    expect(cookies).toHaveBeenCalledTimes(3);
    expect(createNextCookieAdapter).toHaveBeenCalledTimes(3);

    vi.doUnmock("@supabase/supabase-js");
    vi.doUnmock("next/headers");
    vi.doUnmock("@/server/auth/web-session");
    vi.doUnmock("@/server/env");
    vi.doUnmock("@/server/repositories/attempt-repository");
    vi.resetModules();
  });
});
