import {
  createSourceDeletionPlanner,
  createSupabaseSourceDeletionRepository,
  type SourceDeletionRepository,
} from "@/server/domain/plan-source-deletion";
import {
  createSourceDeletionHttpHandlers,
  createSourceDeletionService,
} from "@/server/domain/delete-source";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-08-22T12:34:56.000Z";

function repository({
  savedCount = 3,
  affectedExpressionCount = 0,
  available = true,
}: {
  readonly savedCount?: number;
  readonly affectedExpressionCount?: number;
  readonly available?: boolean;
} = {}): SourceDeletionRepository & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async findOwnedSource(userId, videoSourceId) {
      calls.push(`source:${userId}:${videoSourceId}`);
      return available && userId === USER && videoSourceId === SOURCE
        ? { videoSourceId: SOURCE, videoTitle: "中文访谈" }
        : null;
    },
    async countSavedItems(userId, videoSourceId) {
      calls.push(`saves:${userId}:${videoSourceId}`);
      return savedCount;
    },
    async countPromotedExpressions(userId, videoSourceId) {
      calls.push(`expressions:${userId}:${videoSourceId}`);
      return affectedExpressionCount;
    },
    async deleteVideoSource(input) {
      calls.push(`rpc:${JSON.stringify(input)}`);
      return { deleted: true, retainedUserExpressionCount: affectedExpressionCount };
    },
  };
}

function handlers(repo: SourceDeletionRepository, now = () => NOW) {
  const planner = createSourceDeletionPlanner(repo);
  return createSourceDeletionHttpHandlers({
    authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })),
    service: createSourceDeletionService({ planner, repository: repo, now }),
    planner,
    requestId: () => "safe-request-id",
  });
}

describe("source deletion preview and sole-RPC commit", () => {
  test("derives the exact unpracticed and keep-evidence modes from promoted expressions", async () => {
    await expect(createSourceDeletionPlanner(repository()).preview(USER, SOURCE)).resolves.toEqual({
      videoSourceId: SOURCE,
      videoTitle: "中文访谈",
      savedCount: 3,
      affectedExpressionCount: 0,
      mode: "remove_unpracticed_source",
    });
    await expect(createSourceDeletionPlanner(repository({ affectedExpressionCount: 2 })).preview(USER, SOURCE))
      .resolves.toEqual({
        videoSourceId: SOURCE,
        videoTitle: "中文访谈",
        savedCount: 3,
        affectedExpressionCount: 2,
        mode: "remove_source_keep_evidence",
      });
  });

  test("returns cross-owner and unknown sources as unavailable without querying their children", async () => {
    const repo = repository();
    await expect(createSourceDeletionPlanner(repo).preview(OTHER, SOURCE)).resolves.toBeNull();
    expect(repo.calls).toEqual([`source:${OTHER}:${SOURCE}`]);

    const missing = repository({ available: false });
    await expect(createSourceDeletionPlanner(missing).preview(USER, SOURCE)).resolves.toBeNull();
    expect(missing.calls).toEqual([`source:${USER}:${SOURCE}`]);
  });

  test("the Supabase preview adapter owner-filters every query including the promoted-expression join", async () => {
    const calls: Array<readonly [string, ...unknown[]]> = [];
    const plans = [
      { table: "video_sources", data: [{ id: SOURCE, user_id: USER }], count: null },
      { table: "video_snapshots", data: [{ title: "中文访谈", user_id: USER }], count: null },
      { table: "saved_items", data: [], count: 3 },
      { table: "user_expressions", data: [], count: 2 },
    ];
    const client = {
      from(table: string) {
        calls.push(["from", table]);
        const query = {
          select(columns: string, options?: unknown) { calls.push(["select", table, columns, options]); return query; },
          eq(column: string, value: unknown) { calls.push(["eq", table, column, value]); return query; },
          order(column: string, options: unknown) { calls.push(["order", table, column, options]); return query; },
          async limit(value: number) {
            calls.push(["limit", table, value]);
            const plan = plans.shift();
            if (!plan || plan.table !== table) throw new Error(`unexpected ${table}`);
            return { data: plan.data, count: plan.count, error: null };
          },
        };
        return query;
      },
      async rpc() { throw new Error("preview must not mutate"); },
    };

    const preview = await createSourceDeletionPlanner(createSupabaseSourceDeletionRepository(client as never))
      .preview(USER, SOURCE);
    expect(preview).toMatchObject({ savedCount: 3, affectedExpressionCount: 2 });
    expect(calls).toEqual(expect.arrayContaining([
      ["eq", "video_sources", "user_id", USER],
      ["eq", "video_sources", "id", SOURCE],
      ["eq", "video_snapshots", "user_id", USER],
      ["eq", "video_snapshots", "video_source_id", SOURCE],
      ["eq", "saved_items", "user_id", USER],
      ["eq", "saved_items", "video_source_id", SOURCE],
      ["eq", "user_expressions", "user_id", USER],
      ["eq", "user_expressions", "expression_senses.user_id", USER],
      ["eq", "user_expressions", "expression_senses.video_source_id", SOURCE],
    ]));
  });

  test("rejects a stale mode before the RPC and commits a matching mode exactly once with owner and time", async () => {
    const practiced = repository({ affectedExpressionCount: 2 });
    const stale = await handlers(practiced).remove(
      new Request(`https://popcorn.test/api/v1/saved/${SOURCE}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "remove_unpracticed_source" }),
      }),
      SOURCE,
    );
    expect(stale.status).toBe(409);
    expect(practiced.calls.some((call) => call.startsWith("rpc:"))).toBe(false);

    const matching = repository({ affectedExpressionCount: 2 });
    const response = await handlers(matching).remove(
      new Request(`https://popcorn.test/api/v1/saved/${SOURCE}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "remove_source_keep_evidence" }),
      }),
      SOURCE,
    );
    expect(response.status).toBe(200);
    expect(matching.calls.filter((call) => call.startsWith("rpc:"))).toEqual([
      `rpc:${JSON.stringify({
        userId: USER,
        videoSourceId: SOURCE,
        mode: "remove_source_keep_evidence",
        now: NOW,
      })}`,
    ]);
  });

  test("returns bounded no-store responses for preview, RPC, and repository failures", async () => {
    const previewResponse = await handlers(repository({ affectedExpressionCount: 1 })).preview(
      new Request(`https://popcorn.test/api/v1/saved/${SOURCE}/delete-preview`),
      SOURCE,
    );
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(await previewResponse.json()).toMatchObject({
      ok: true,
      data: {
        videoSourceId: SOURCE,
        videoTitle: "中文访谈",
        savedCount: 3,
        affectedExpressionCount: 1,
        mode: "remove_source_keep_evidence",
      },
      requestId: "safe-request-id",
    });

    const failed = repository();
    failed.countSavedItems = async () => { throw new Error("private relation details and key=secret"); };
    const failedResponse = await handlers(failed).preview(
      new Request(`https://popcorn.test/api/v1/saved/${SOURCE}/delete-preview`),
      SOURCE,
    );
    expect(failedResponse.status).toBe(500);
    expect(failedResponse.headers.get("Cache-Control")).toBe("no-store");
    const failedBody = await failedResponse.text();
    expect(failedBody).toContain("Source deletion is unavailable.");
    expect(failedBody).not.toMatch(/private relation|secret|rpc|database/i);

    const rpcFailure = repository();
    rpcFailure.deleteVideoSource = async () => { throw new Error("delete_video_source internal detail"); };
    const rpcResponse = await handlers(rpcFailure).remove(
      new Request(`https://popcorn.test/api/v1/saved/${SOURCE}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "remove_unpracticed_source" }),
      }),
      SOURCE,
    );
    expect(rpcResponse.status).toBe(500);
    expect(rpcResponse.headers.get("Cache-Control")).toBe("no-store");
    expect(await rpcResponse.text()).not.toMatch(/delete_video_source|internal detail/i);
  });
});
