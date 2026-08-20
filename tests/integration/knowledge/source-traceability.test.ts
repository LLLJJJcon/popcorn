import { createCandidateHttpHandlers, createCandidateService } from "@/server/domain/confirm-candidate";
import { createSupabaseExpressionRepository } from "@/server/repositories/expression-repository";
import { createSupabaseSavedItemAnalysisRegistrar } from "@/server/jobs/process-jobs";

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
      promptVersion: "analyze-saved-item-v1",
      content: { candidates: [candidate] },
    },
    ...overrides,
  };
}

function repository(value: ReturnType<typeof context> | null = context()) {
  const read = vi.fn(async (_userId: string, _savedItemId: string) => value);
  return { read };
}

function request(method: "GET" | "POST", body?: unknown, origin = "https://popcorn.example") {
  return new Request(`https://popcorn.example/api/v1/saved-items/${SAVE_ID}/candidates`, {
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
        promptVersion: "analyze-saved-item-v1",
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
    const replayResponse = await handlers(repository(context({ artifact: null })), replay).post(request("POST", {}), SAVE_ID);
    expect(replayResponse.status).toBe(202);
    expect((await replayResponse.json()).data).toEqual({ state: "processing", jobId: JOB_ID, status: "pending", created: false });

    const existing = { register: vi.fn() };
    const existingResponse = await handlers(repository(), existing).post(request("POST", {}), SAVE_ID);
    expect(existingResponse.status).toBe(200);
    expect((await existingResponse.json()).data.state).toBe("ready");
    expect(existing.register).not.toHaveBeenCalled();
  });

  it("rejects cross-origin and non-empty recovery bodies before repository work", async () => {
    const repo = repository(context({ artifact: null }));
    const crossOrigin = await handlers(repo).post(request("POST", {}, "https://evil.example"), SAVE_ID);
    const nonEmpty = await handlers(repo).post(request("POST", { prompt: "leak me" }), SAVE_ID);

    expect(crossOrigin.status).toBe(403);
    expect(nonEmpty.status).toBe(400);
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
      generated_artifacts: { id: ARTIFACT_ID, user_id: USER_A, video_source_id: SOURCE_ID, saved_item_id: SAVE_ID, artifact_type: "saved_item_analysis", prompt_version: "analyze-saved-item-v1", content: { candidates: [candidate] }, created_at: NOW },
    };
    const client = {
      from(table: string) {
        const query = {
          select(columns: string) { calls.push(`${table}:select:${columns}`); return query; },
          eq(column: string, value: string) { calls.push(`${table}:eq:${column}:${value}`); return query; },
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
    ]));
  });
});
