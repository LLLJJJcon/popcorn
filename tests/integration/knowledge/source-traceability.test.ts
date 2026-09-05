import { createCandidateHttpHandlers, createCandidateService } from "@/server/domain/confirm-candidate";
import {
  createSupabaseExpressionRepository,
  type CandidateAnalysisJobStatus,
} from "@/server/repositories/expression-repository";
import { createSupabaseSavedItemAnalysisRegistrar } from "@/server/jobs/process-jobs";

const productionRouteHarness = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [{ name: "sb-project-auth-token", value: "session" }],
    set: () => undefined,
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
        error: null,
      }),
    },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => productionRouteHarness.client,
}));

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const SOURCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SAVE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SNAPSHOT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ARTIFACT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONFIG_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const JOB_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const TRANSCRIPT_HASH = "a".repeat(64);
const FINGERPRINT = "b".repeat(64);
const NOW = "2026-08-21T00:00:00.000Z";

const candidate = {
  expression: "挺有意思的",
  englishMeaning: "pretty interesting",
  englishExplanation: "A measured expression of interest.",
  tone: "warm",
  communicativeFunction: "expressing interest",
  register: "conversational",
  evidenceText: "这个想法挺有意思的",
  segmentIds: ["seg-1"],
  startSeconds: 62,
  endSeconds: 65,
  confidence: 0.9,
};

function context(overrides: Record<string, unknown> = {}) {
  return {
    userId: USER_A,
    sourceId: SOURCE_ID,
    savedItemId: SAVE_ID,
    snapshotId: SNAPSHOT_ID,
    transcriptHash: TRANSCRIPT_HASH,
    youtubeVideoId: "dQw4w9WgXcQ",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    artifact: {
      artifactId: ARTIFACT_ID,
      userId: USER_A,
      sourceId: SOURCE_ID,
      savedItemId: SAVE_ID,
      type: "saved_item_analysis",
      promptVersion: "analyze-saved-item-v2",
      content: { candidates: [candidate] },
    },
    ...overrides,
  };
}

function repository(value: ReturnType<typeof context> | null = context()) {
  const read = vi.fn(async (_userId: string, _savedItemId: string) => value);
  const readAnalysisJobStatus = vi.fn(
    async (): Promise<CandidateAnalysisJobStatus | null> => null,
  );
  return { read, readAnalysisJobStatus };
}

function request(
  method: "GET" | "POST",
  body?: unknown,
  origin = "https://popcorn.example",
  jobId?: string,
) {
  const query = jobId ? `?jobId=${encodeURIComponent(jobId)}` : "";
  return new Request(`https://popcorn.example/api/v1/saved-items/${SAVE_ID}/candidates${query}`, {
    method,
    headers: method === "POST" ? { Origin: origin, "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function handlers(repo = repository(), registrar: { register(value: unknown): Promise<unknown> } = { register: vi.fn() }) {
  return createCandidateHttpHandlers({
    authenticate: async () => ({ ok: true, userId: USER_A }),
    service: createCandidateService(repo, registrar as never, () => NOW),
    appUrl: "https://popcorn.example",
    requestId: () => "safe-request",
  });
}

describe("source-grounded candidate route", () => {
  afterEach(() => vi.restoreAllMocks());

  it("GET is owner-filtered and read-only and returns only a bounded artifact", async () => {
    const repo = repository();
    const registrar = { register: vi.fn() };
    const response = await handlers(repo, registrar).get(request("GET"), SAVE_ID);

    expect(response.status).toBe(200);
    expect(repo.read).toHaveBeenCalledExactlyOnceWith(USER_A, SAVE_ID);
    expect(registrar.register).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      ok: true,
      data: {
        state: "ready",
        artifactId: ARTIFACT_ID,
        savedItemId: SAVE_ID,
        youtubeVideoId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        candidates: [candidate],
      },
      requestId: "safe-request",
    });
  });

  it("GET returns an allowlisted Saved v1 artifact as ready without registering Provider work", async () => {
    const registrar = { register: vi.fn() };
    const historical = context({
      artifact: { ...context().artifact, promptVersion: "analyze-saved-item-v1" },
    });

    const response = await handlers(repository(historical), registrar).get(request("GET"), SAVE_ID);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { state: "ready", artifactId: ARTIFACT_ID, candidates: [candidate] },
    });
    expect(registrar.register).not.toHaveBeenCalled();
  });

  it.each([
    ["cross owner", context({ userId: USER_B })],
    ["cross source artifact", context({ artifact: { ...context().artifact, sourceId: "99999999-9999-4999-8999-999999999999" } })],
    ["cross save artifact", context({ artifact: { ...context().artifact, savedItemId: "99999999-9999-4999-8999-999999999999" } })],
    ["wrong artifact version", context({ artifact: { ...context().artifact, promptVersion: "analyze-saved-item-v0" } })],
    ["malformed artifact", context({ artifact: { ...context().artifact, content: { candidates: [{ expression: "不完整" }] } } })],
    ["too many candidates", context({ artifact: { ...context().artifact, content: { candidates: [candidate, candidate, candidate, candidate] } } })],
  ])("%s fails closed without activation", async (_label, leaked) => {
    const registrar = { register: vi.fn() };
    const response = await handlers(repository(leaked), registrar).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(422);
    expect(registrar.register).not.toHaveBeenCalled();
  });

  it("POST invokes the real Task 1 registrar with exact source identity and zero provider calls", async () => {
    const pinRpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ config_id: CONFIG_ID, revision: 4, config_fingerprint: FINGERPRINT, model: "other/model" }], error: null })
      .mockResolvedValueOnce({ data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }], error: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const registrar = createSupabaseSavedItemAnalysisRegistrar({ rpc: pinRpc } as never);
    const missing = context({ artifact: null });
    const response = await handlers(repository(missing), registrar).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(202);
    expect(pinRpc).toHaveBeenNthCalledWith(1, "resolve_active_user_model_gateway_pin", { p_user_id: USER_A });
    expect(pinRpc).toHaveBeenNthCalledWith(2, "register_gateway_learning_artifact_job", expect.objectContaining({
      p_user_id: USER_A,
      p_video_source_id: SOURCE_ID,
      p_job_type: "analyze_saved_item",
      p_input: {
        kind: "analyze_saved_item",
        savedItemId: SAVE_ID,
        snapshotId: SNAPSHOT_ID,
        transcriptHash: TRANSCRIPT_HASH,
        promptVersion: "analyze-saved-item-v2",
        gatewayConfigId: CONFIG_ID,
        gatewayRevision: 4,
        gatewayFingerprint: FINGERPRINT,
      },
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.data).toEqual({ state: "processing", jobId: JOB_ID, status: "pending", created: true });
    expect(JSON.stringify(body)).not.toMatch(/api.?key|vault|origin|header|private|provider|raw|mastery|due/i);
  });

  it("GET returns processing only for the exact owner/type/save-bound job", async () => {
    const repo = repository(context({ artifact: null }));
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "leased",
      lastErrorCode: null,
    });

    const response = await handlers(repo).get(request("GET", undefined, undefined, JOB_ID), SAVE_ID);

    expect(response.status).toBe(200);
    expect(repo.readAnalysisJobStatus).toHaveBeenCalledExactlyOnceWith(USER_A, SAVE_ID, JOB_ID);
    expect((await response.json()).data).toEqual({
      state: "processing",
      jobId: JOB_ID,
      status: "leased",
    });
  });

  it("GET validates the supplied job before returning an already-ready artifact", async () => {
    const repo = repository();
    repo.readAnalysisJobStatus.mockResolvedValueOnce(null);

    const response = await handlers(repo).get(
      request("GET", undefined, undefined, JOB_ID),
      SAVE_ID,
    );

    expect(response.status).toBe(404);
    expect(repo.readAnalysisJobStatus).toHaveBeenCalledExactlyOnceWith(USER_A, SAVE_ID, JOB_ID);
  });

  it("GET exposes only the safe terminal category for a bound failed job", async () => {
    const repo = repository(context({ artifact: null }));
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "terminal_failed",
      lastErrorCode: "PROVIDER_OUTPUT_INVALID:grounding:sourceLineIndices",
    });

    const response = await handlers(repo).get(request("GET", undefined, undefined, JOB_ID), SAVE_ID);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ state: "failed", jobId: JOB_ID, failureCategory: "model_output" });
    expect(JSON.stringify(body)).not.toContain("grounding");
    expect(JSON.stringify(body)).not.toContain("sourceLineIndices");
  });

  it.each(["cross-user job", "wrong job type", "wrong saved item", "wrong private savedItemId"])(
    "GET rejects %s status instead of exposing another job",
    async () => {
      const repo = repository(context({ artifact: null }));
      repo.readAnalysisJobStatus.mockResolvedValueOnce(null);

      const response = await handlers(repo).get(request("GET", undefined, undefined, JOB_ID), SAVE_ID);

      expect(response.status).toBe(404);
      expect(JSON.stringify(await response.json())).not.toMatch(/lastError|private|input|provider/i);
    },
  );

  it("explicit retry changes only dedupe identity and keeps retryId out of private input", async () => {
    const retryId = "99999999-9999-4999-8999-999999999999";
    const pinRow = [{
      config_id: CONFIG_ID,
      revision: 4,
      config_fingerprint: FINGERPRINT,
      model: "other/model",
    }];
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: pinRow, error: null })
      .mockResolvedValueOnce({ data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }], error: null })
      .mockResolvedValueOnce({ data: pinRow, error: null })
      .mockResolvedValueOnce({ data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }], error: null });
    const registrar = createSupabaseSavedItemAnalysisRegistrar({ rpc } as never);
    const missing = repository(context({ artifact: null }));

    await handlers(missing, registrar).post(request("POST", {}), SAVE_ID);
    await handlers(missing, registrar).post(request("POST", { retryId }), SAVE_ID);

    const first = rpc.mock.calls[1]![1] as Record<string, unknown>;
    const retried = rpc.mock.calls[3]![1] as Record<string, unknown>;
    expect(retried.p_dedupe_key).not.toBe(first.p_dedupe_key);
    expect(retried.p_input).toEqual(first.p_input);
    expect(JSON.stringify(retried.p_input)).not.toContain(retryId);
  });

  it("returns gateway-required without changing the raw save when the owner has no active pin", async () => {
    const registrar = { register: vi.fn(async () => null) };
    const repo = repository(context({ artifact: null }));
    const before = structuredClone(await repo.read(USER_A, SAVE_ID));
    repo.read.mockClear();
    const response = await handlers(repo, registrar).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ state: "gateway_required" });
    expect(await repo.read(USER_A, SAVE_ID)).toEqual(before);
  });

  it("replay returns the existing job while an existing artifact causes zero registration", async () => {
    const replay = { register: vi.fn(async () => ({ jobId: JOB_ID, status: "pending", created: false })) };
    const replayRepository = repository(context({ artifact: null }));
    replayRepository.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "pending",
      lastErrorCode: null,
    });
    const replayResponse = await handlers(replayRepository, replay).post(request("POST", {}), SAVE_ID);
    expect(replayResponse.status).toBe(202);
    expect((await replayResponse.json()).data).toEqual({ state: "processing", jobId: JOB_ID, status: "pending", created: false });

    const existing = { register: vi.fn() };
    const existingResponse = await handlers(repository(), existing).post(request("POST", {}), SAVE_ID);
    expect(existingResponse.status).toBe(200);
    expect((await existingResponse.json()).data.state).toBe("ready");
    expect(existing.register).not.toHaveBeenCalled();
  });

  it("registrar replay returns processing only for pending or leased jobs", async () => {
    for (const status of ["pending", "leased"] as const) {
      const repo = repository(context({ artifact: null }));
      repo.readAnalysisJobStatus.mockResolvedValueOnce({
        jobId: JOB_ID,
        status,
        lastErrorCode: null,
      });
      const replay = {
        register: vi.fn(async () => ({ jobId: JOB_ID, status, created: false })),
      };
      const response = await handlers(
        repo,
        replay,
      ).post(request("POST", {}), SAVE_ID);

      expect(response.status).toBe(202);
      expect((await response.json()).data).toEqual({
        state: "processing",
        jobId: JOB_ID,
        status,
        created: false,
      });
    }
  });

  it.each(["pending", "leased"])(
    "registrar %s replay fails closed when its job is not owner/save-bound",
    async (status) => {
      const replay = {
        register: vi.fn(async () => ({ jobId: JOB_ID, status, created: false })),
      };

      const response = await handlers(
        repository(context({ artifact: null })),
        replay,
      ).post(request("POST", {}), SAVE_ID);

      expect(response.status).toBe(404);
    },
  );

  it("registrar pending replay returns authoritative succeeded ready state", async () => {
    const missing = context({ artifact: null });
    const repo = repository(missing);
    repo.read
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(context());
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "succeeded",
      lastErrorCode: null,
    });
    const replay = {
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "pending", created: false })),
    };

    const response = await handlers(repo, replay).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      state: "ready",
      artifactId: ARTIFACT_ID,
    });
  });

  it("registrar terminal replay returns the bound safe failed state", async () => {
    const missing = context({ artifact: null });
    const repo = repository(missing);
    repo.read
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(context());
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "terminal_failed",
      lastErrorCode: "PROVIDER_UNAVAILABLE:timeout",
    });
    const replay = {
      register: vi.fn(async () => ({
        jobId: JOB_ID,
        status: "terminal_failed",
        created: false,
      })),
    };

    const response = await handlers(repo, replay).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      state: "failed",
      jobId: JOB_ID,
      failureCategory: "model_unavailable",
    });
  });

  it("registrar succeeded replay returns only the newly ready strict artifact", async () => {
    const missing = context({ artifact: null });
    const repo = repository(missing);
    repo.read
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(context());
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "succeeded",
      lastErrorCode: null,
    });
    const replay = {
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "succeeded", created: false })),
    };

    const response = await handlers(repo, replay).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({
      state: "ready",
      artifactId: ARTIFACT_ID,
      candidates: [candidate],
    });
  });

  it("registrar succeeded replay fails closed when its strict artifact is absent", async () => {
    const repo = repository(context({ artifact: null }));
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "succeeded",
      lastErrorCode: null,
    });
    const replay = {
      register: vi.fn(async () => ({ jobId: JOB_ID, status: "succeeded", created: false })),
    };

    const response = await handlers(repo, replay).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(422);
  });

  it("registrar terminal replay fails closed when the bound job status disagrees", async () => {
    const repo = repository(context({ artifact: null }));
    repo.readAnalysisJobStatus.mockResolvedValueOnce({
      jobId: JOB_ID,
      status: "pending",
      lastErrorCode: null,
    });
    const replay = {
      register: vi.fn(async () => ({
        jobId: JOB_ID,
        status: "terminal_failed",
        created: false,
      })),
    };

    const response = await handlers(repo, replay).post(request("POST", {}), SAVE_ID);

    expect(response.status).toBe(422);
  });

  it.each(["retryable_failed", "future_state"])(
    "registrar replay status %s fails closed",
    async (status) => {
      const replay = {
        register: vi.fn(async () => ({ jobId: JOB_ID, status, created: false })),
      };

      const response = await handlers(
        repository(context({ artifact: null })),
        replay,
      ).post(request("POST", {}), SAVE_ID);

      expect(response.status).toBe(422);
      expect(JSON.stringify(await response.json())).not.toContain(status);
    },
  );

  it("rejects cross-origin and non-empty recovery bodies before repository work", async () => {
    const repo = repository(context({ artifact: null }));
    const crossOrigin = await handlers(repo).post(request("POST", {}, "https://evil.example"), SAVE_ID);
    const nonEmpty = await handlers(repo).post(request("POST", { prompt: "leak me" }), SAVE_ID);

    expect(crossOrigin.status).toBe(403);
    expect(nonEmpty.status).toBe(400);
    expect(repo.read).not.toHaveBeenCalled();
  });

  it.each([undefined, "text/plain", "application/json-seq"])(
    "rejects missing or wrong recovery media type %s before repository work",
    async (contentType) => {
      const repo = repository(context({ artifact: null }));
      const headers = new Headers({ Origin: "https://popcorn.example" });
      if (contentType) headers.set("Content-Type", contentType);
      const response = await handlers(repo).post(new Request(
        `https://popcorn.example/api/v1/saved-items/${SAVE_ID}/candidates`,
        { method: "POST", headers, body: "{}" },
      ), SAVE_ID);

      expect(response.status).toBe(400);
      expect(repo.read).not.toHaveBeenCalled();
    },
  );

  it("accepts application/json with charset for bounded empty recovery", async () => {
    const repo = repository();
    const response = await handlers(repo).post(new Request(
      `https://popcorn.example/api/v1/saved-items/${SAVE_ID}/candidates`,
      {
        method: "POST",
        headers: {
          Origin: "https://popcorn.example",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: "{}",
      },
    ), SAVE_ID);

    expect(response.status).toBe(200);
    expect(repo.read).toHaveBeenCalledExactlyOnceWith(USER_A, SAVE_ID);
  });

  it("cancels an undeclared chunked body as soon as it crosses 256 bytes before repository work", async () => {
    const repo = repository(context({ artifact: null }));
    let cancelled = false;
    let pullCount = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount <= 3) controller.enqueue(new Uint8Array(129).fill(32));
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const response = await handlers(repo).post(new Request(
      `https://popcorn.example/api/v1/saved-items/${SAVE_ID}/candidates`,
      {
        method: "POST",
        headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    ), SAVE_ID);

    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
    expect(repo.read).not.toHaveBeenCalled();
  });
});

describe("production candidate repository query boundaries", () => {
  it("filters every lookup by exact owner and save/source/snapshot identity", async () => {
    const calls: string[] = [];
    const rows: Record<string, unknown> = {
      saved_items: { id: SAVE_ID, user_id: USER_A, video_source_id: SOURCE_ID, snapshot_id: SNAPSHOT_ID, youtube_video_id: "dQw4w9WgXcQ" },
      video_sources: { id: SOURCE_ID, user_id: USER_A, youtube_video_id: "dQw4w9WgXcQ", canonical_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      video_snapshots: { id: SNAPSHOT_ID, user_id: USER_A, video_source_id: SOURCE_ID, transcript_hash: TRANSCRIPT_HASH },
      generated_artifacts: { id: ARTIFACT_ID, user_id: USER_A, video_source_id: SOURCE_ID, saved_item_id: SAVE_ID, artifact_type: "saved_item_analysis", prompt_version: "analyze-saved-item-v2", content: { candidates: [candidate] }, created_at: NOW },
    };
    const client = {
      from(table: string) {
        const query = {
          select(columns: string) { calls.push(`${table}:select:${columns}`); return query; },
          eq(column: string, value: string) { calls.push(`${table}:eq:${column}:${value}`); return query; },
          in(column: string, values: readonly string[]) { calls.push(`${table}:in:${column}:${values.join(",")}`); return query; },
          order(column: string, options: unknown) { calls.push(`${table}:order:${column}:${JSON.stringify(options)}`); return query; },
          limit(value: number) { calls.push(`${table}:limit:${value}`); return query; },
          maybeSingle() { calls.push(`${table}:maybeSingle`); return Promise.resolve({ data: rows[table], error: null }); },
        };
        return query;
      },
    };

    await expect(createSupabaseExpressionRepository(client as never).read(USER_A, SAVE_ID)).resolves.toMatchObject({
      userId: USER_A,
      sourceId: SOURCE_ID,
      savedItemId: SAVE_ID,
      snapshotId: SNAPSHOT_ID,
    });
    expect(calls).toEqual(expect.arrayContaining([
      `saved_items:eq:user_id:${USER_A}`,
      `saved_items:eq:id:${SAVE_ID}`,
      `video_sources:eq:user_id:${USER_A}`,
      `video_sources:eq:id:${SOURCE_ID}`,
      `video_sources:eq:youtube_video_id:dQw4w9WgXcQ`,
      `video_snapshots:eq:user_id:${USER_A}`,
      `video_snapshots:eq:id:${SNAPSHOT_ID}`,
      `video_snapshots:eq:video_source_id:${SOURCE_ID}`,
      `generated_artifacts:eq:user_id:${USER_A}`,
      `generated_artifacts:eq:video_source_id:${SOURCE_ID}`,
      `generated_artifacts:eq:saved_item_id:${SAVE_ID}`,
      `generated_artifacts:eq:artifact_type:saved_item_analysis`,
      `generated_artifacts:order:created_at:${JSON.stringify({ ascending: false })}`,
      `generated_artifacts:order:id:${JSON.stringify({ ascending: false })}`,
    ]));
  });

  it("returns job status only after owner, analysis type, save, and private input all bind", async () => {
    const calls: string[] = [];
    const rows: Record<string, unknown> = {
      knowledge_jobs: {
        id: JOB_ID,
        user_id: USER_A,
        saved_item_id: SAVE_ID,
        job_type: "analyze_saved_item",
        status: "terminal_failed",
        last_error_code: "INTERNAL:persistence",
      },
      knowledge_job_internal: {
        user_id: USER_A,
        input: {
          kind: "analyze_saved_item",
          savedItemId: SAVE_ID,
          snapshotId: SNAPSHOT_ID,
          transcriptHash: TRANSCRIPT_HASH,
          promptVersion: "analyze-saved-item-v2",
          gatewayConfigId: CONFIG_ID,
          gatewayRevision: 4,
          gatewayFingerprint: FINGERPRINT,
        },
      },
    };
    const client = {
      from(table: string) {
        const query = {
          select(columns: string) { calls.push(`${table}:select:${columns}`); return query; },
          eq(column: string, value: string) { calls.push(`${table}:eq:${column}:${value}`); return query; },
          maybeSingle() { return Promise.resolve({ data: rows[table], error: null }); },
        };
        return query;
      },
    };

    await expect(createSupabaseExpressionRepository(client as never)
      .readAnalysisJobStatus(USER_A, SAVE_ID, JOB_ID)).resolves.toEqual({
        jobId: JOB_ID,
        status: "terminal_failed",
        lastErrorCode: "INTERNAL:persistence",
      });
    expect(calls).toEqual(expect.arrayContaining([
      `knowledge_jobs:eq:user_id:${USER_A}`,
      `knowledge_jobs:eq:id:${JOB_ID}`,
      `knowledge_jobs:eq:saved_item_id:${SAVE_ID}`,
      "knowledge_jobs:eq:job_type:analyze_saved_item",
      `knowledge_job_internal:eq:user_id:${USER_A}`,
      `knowledge_job_internal:eq:knowledge_job_id:${JOB_ID}`,
    ]));
  });

  it.each([
    ["terminal_failed", "INTERNAL:persistence"],
    ["succeeded", null],
  ] as const)("returns a public-save-bound %s status after its private input is cleared", async (
    status,
    lastErrorCode,
  ) => {
    const rows: Record<string, unknown> = {
      knowledge_jobs: {
        id: JOB_ID,
        user_id: USER_A,
        saved_item_id: SAVE_ID,
        job_type: "analyze_saved_item",
        status,
        last_error_code: lastErrorCode,
      },
      knowledge_job_internal: {
        user_id: USER_A,
        input: {},
      },
    };
    const client = {
      from(table: string) {
        const query = {
          select() { return query; },
          eq() { return query; },
          maybeSingle() { return Promise.resolve({ data: rows[table], error: null }); },
        };
        return query;
      },
    };

    await expect(createSupabaseExpressionRepository(client as never)
      .readAnalysisJobStatus(USER_A, SAVE_ID, JOB_ID)).resolves.toEqual({
        jobId: JOB_ID,
        status,
        lastErrorCode,
      });
  });

  it.each([
    ["cross owner", USER_B, "analyze_saved_item", SAVE_ID, SAVE_ID],
    ["wrong type", USER_A, "generate_overview", SAVE_ID, SAVE_ID],
    ["wrong save", USER_A, "analyze_saved_item", SNAPSHOT_ID, SAVE_ID],
    ["wrong private save", USER_A, "analyze_saved_item", SAVE_ID, SNAPSHOT_ID],
  ])("rejects %s job status rows", async (
    _label,
    owner,
    type,
    savedItemId,
    privateSavedItemId,
  ) => {
    const rows: Record<string, unknown> = {
      knowledge_jobs: {
        id: JOB_ID,
        user_id: owner,
        saved_item_id: savedItemId,
        job_type: type,
        status: "pending",
        last_error_code: null,
      },
      knowledge_job_internal: {
        user_id: owner,
        input: {
          kind: "analyze_saved_item",
          savedItemId: privateSavedItemId,
          snapshotId: SNAPSHOT_ID,
          transcriptHash: TRANSCRIPT_HASH,
          promptVersion: "analyze-saved-item-v2",
          gatewayConfigId: CONFIG_ID,
          gatewayRevision: 4,
          gatewayFingerprint: FINGERPRINT,
        },
      },
    };
    const client = {
      from(table: string) {
        const query = {
          select() { return query; },
          eq() { return query; },
          maybeSingle() { return Promise.resolve({ data: rows[table], error: null }); },
        };
        return query;
      },
    };

    await expect(createSupabaseExpressionRepository(client as never)
      .readAnalysisJobStatus(USER_A, SAVE_ID, JOB_ID)).resolves.toBeNull();
  });
});

function productionClient(artifact: Record<string, unknown> | null) {
  const calls: string[] = [];
  const rows: Record<string, unknown> = {
    saved_items: {
      id: SAVE_ID,
      user_id: USER_A,
      video_source_id: SOURCE_ID,
      snapshot_id: SNAPSHOT_ID,
      youtube_video_id: "dQw4w9WgXcQ",
    },
    video_sources: {
      id: SOURCE_ID,
      user_id: USER_A,
      youtube_video_id: "dQw4w9WgXcQ",
      canonical_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    video_snapshots: {
      id: SNAPSHOT_ID,
      user_id: USER_A,
      video_source_id: SOURCE_ID,
      transcript_hash: TRANSCRIPT_HASH,
    },
    generated_artifacts: artifact,
  };
  const rpc = vi.fn(async (name: string) => {
    calls.push(`rpc:${name}`);
    if (name === "resolve_active_user_model_gateway_pin") {
      return {
        data: [{
          config_id: CONFIG_ID,
          revision: 4,
          config_fingerprint: FINGERPRINT,
          model: "other/model",
        }],
        error: null,
      };
    }
    return {
      data: [{ knowledge_job_id: JOB_ID, status: "pending", created: true }],
      error: null,
    };
  });
  const client = {
    from(table: string) {
      const query = {
        select(columns: string) { calls.push(`${table}:select:${columns}`); return query; },
        eq(column: string, value: string) { calls.push(`${table}:eq:${column}:${value}`); return query; },
        in(column: string, values: readonly string[]) { calls.push(`${table}:in:${column}:${values.join(",")}`); return query; },
        order(column: string, options: unknown) { calls.push(`${table}:order:${column}:${JSON.stringify(options)}`); return query; },
        limit(value: number) { calls.push(`${table}:limit:${value}`); return query; },
        maybeSingle() { calls.push(`${table}:maybeSingle`); return Promise.resolve({ data: rows[table], error: null }); },
      };
      return query;
    },
    rpc,
  };
  return { client, calls, rpc };
}

describe("production candidate route exports and assembly", () => {
  const originalEnvironment = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      APP_URL: "https://popcorn.example",
    });
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, originalEnvironment);
  });

  it("exports only GET and POST and production GET is read-only", async () => {
    const fake = productionClient({
      id: ARTIFACT_ID,
      user_id: USER_A,
      video_source_id: SOURCE_ID,
      saved_item_id: SAVE_ID,
      artifact_type: "saved_item_analysis",
      prompt_version: "analyze-saved-item-v2",
      content: { candidates: [candidate] },
      created_at: NOW,
    });
    productionRouteHarness.client = fake.client;
    const route = await import("@/app/api/v1/saved-items/[savedItemId]/candidates/route");

    expect(Object.keys(route).sort()).toEqual(["GET", "POST"]);
    const response = await route.GET(request("GET"), { params: Promise.resolve({ savedItemId: SAVE_ID }) });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ state: "ready", artifactId: ARTIFACT_ID });
    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.calls.some((entry) => /insert|update|delete|upsert/i.test(entry))).toBe(false);
  });

  it("production POST uses the real registrar with exact active pin RPCs and zero provider fetch", async () => {
    const fake = productionClient(null);
    productionRouteHarness.client = fake.client;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const route = await import("@/app/api/v1/saved-items/[savedItemId]/candidates/route");
    const response = await route.POST(request("POST", {}), {
      params: Promise.resolve({ savedItemId: SAVE_ID }),
    });

    expect(response.status).toBe(202);
    expect(fake.rpc).toHaveBeenNthCalledWith(1, "resolve_active_user_model_gateway_pin", {
      p_user_id: USER_A,
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, "register_gateway_learning_artifact_job", {
      p_user_id: USER_A,
      p_video_source_id: SOURCE_ID,
      p_job_type: "analyze_saved_item",
      p_dedupe_key: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_input: {
        kind: "analyze_saved_item",
        savedItemId: SAVE_ID,
        snapshotId: SNAPSHOT_ID,
        transcriptHash: TRANSCRIPT_HASH,
        promptVersion: "analyze-saved-item-v2",
        gatewayConfigId: CONFIG_ID,
        gatewayRevision: 4,
        gatewayFingerprint: FINGERPRINT,
      },
      p_config_id: CONFIG_ID,
      p_expected_config_revision: 4,
      p_expected_config_fingerprint: FINGERPRINT,
      p_now: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await response.json()).data).toEqual({
      state: "processing",
      jobId: JOB_ID,
      status: "pending",
      created: true,
    });
  });
});
