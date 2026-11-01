import { describe, expect, test } from "vitest";
import { createSavedLibraryRepository } from "@/features/saved/api";
import { practiceCandidateKey } from "@/server/domain/practice-rounds";

const user = "11111111-1111-4111-8111-111111111111";
const source = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const save = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const task = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const expression = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const at = "2026-11-01T00:00:00Z";
const card = {
  expression: "太离谱了", englishMeaning: "Outrageous.", englishExplanation: "React to something extreme.",
  tone: "Casual.", communicativeFunction: "React", register: "Casual", evidenceText: "这也太离谱了。",
  segmentIds: ["segment"], startSeconds: 1, endSeconds: 2, meaningHere: "Outrageous.",
  useItWhen: "React to something extreme.", comparedWith: "很奇怪 is neutral.", howItFits: "Use it in your clause.",
  toneAndWho: "Casual with friends.", watchOut: null, examples: null, functionCategories: ["react"],
  usageSettings: ["casual_chat"], suitability: "expression",
};
type ProjectionRow = { candidate_key: string; task_id: string | null; round_number: number | null; status: string | null; user_expression_id: string | null };

function harness(unique: boolean, count = 50) {
  const artifacts = Array.from({ length: count }, (_, index) => ({
    id: `cccccccc-cccc-4ccc-8ccc-${String(index).padStart(12, "0")}`,
    user_id: user, video_source_id: source, saved_item_id: save, artifact_type: "saved_item_analysis",
    prompt_version: "analyze-saved-item-v3", content: { candidates: Array.from({ length: 10 }, (_, n) => ({
      ...card, highlightKey: `stable-mark-${unique ? index * 10 + n : n}`,
    })) }, created_at: at,
  }));
  const tables: Record<string, unknown[]> = {
    video_sources: [{ id: source, user_id: user, youtube_video_id: "dQw4w9WgXcQ", canonical_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }],
    video_snapshots: [], saved_items: [{ id: save, user_id: user, video_source_id: source, snapshot_id: null,
      youtube_video_id: "dQw4w9WgXcQ", kind: "subtitle_row", status: "ready", captured_at: at,
      start_seconds: 1, payload: {}, highlight_status: "ready" }],
    knowledge_jobs: [], saved_item_highlights: [], user_model_gateway_configs: [], generated_artifacts: artifacts,
  };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const states = new Map<string, ProjectionRow>();
  let active = 0, peak = 0;
  let failure: Error | null = null;
  const client = {
    from(table: string) {
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "in", "order", "limit", "range"]) query[method] = () => query;
      query.then = (done: (value: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(done);
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> {
      calls.push({ name, args });
      active += 1; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active -= 1;
      if (failure) return { data: null, error: failure };
      const row = (key: string): ProjectionRow => states.get(key) ?? { candidate_key: key, task_id: null, round_number: null, status: null, user_expression_id: null };
      // Reproduce the current real single-candidate boundary as well as the new
      // batch boundary, so the RED is the cost assertion, not a fake-client error.
      if (name === "get_practice_candidate_state") {
        const state = row(args.p_candidate_key as string);
        return { data: { draft: state.task_id ? { id: state.task_id, round_number: state.round_number, status: state.status } : null,
          promotion: state.user_expression_id ? { userExpressionId: state.user_expression_id } : null, situations: [] }, error: null };
      }
      if (name === "get_practice_candidate_projection") return { data: (args.p_candidate_keys as string[]).map(row), error: null };
      throw new Error("Unexpected practice RPC");
    },
  };
  return { client, calls, states, artifacts, peak: () => peak, fail: () => { failure = new Error("projection unavailable"); } };
}
function key(artifactId: string, highlightKey: string) {
  return practiceCandidateKey({ savedItemId: save, candidateArtifactId: artifactId, candidateIndex: 0 }, { highlightKey });
}

describe("Saved practice state projection", () => {
  test("50 historical analyses sharing ten marks make one lightweight request and retain every card", async () => {
    const h = harness(false);
    const result = await createSavedLibraryRepository(h.client as never).detail(user, source);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ name: "get_practice_candidate_projection", args: { p_user_id: user } });
    expect(h.calls[0]!.args.p_candidate_keys).toHaveLength(10);
    expect(h.peak()).toBe(1);
    expect(result?.artifacts).toHaveLength(50);
    expect(result?.artifacts.flatMap(a => (a.content as { candidates: unknown[] }).candidates)).toHaveLength(500);
  });
  test("500 distinct marks use three batches of at most200, with bounded concurrency", async () => {
    const h = harness(true);
    await createSavedLibraryRepository(h.client as never).detail(user, source);
    expect(h.calls).toHaveLength(3);
    expect(h.calls.map(call => (call.args.p_candidate_keys as string[]).length)).toEqual([200, 200, 100]);
    expect(h.calls.every(call => call.name === "get_practice_candidate_projection" && call.args.p_user_id === user)).toBe(true);
    expect(h.peak()).toBe(1);
  });
  test("a card appearing only in an older artifact keeps its removed state while the latest is promoted", async () => {
    const h = harness(true, 2);
    const oldKey = key(h.artifacts[0]!.id, "stable-mark-0");
    const latestKey = key(h.artifacts[1]!.id, "stable-mark-10");
    h.states.set(oldKey, { candidate_key: oldKey, task_id: task, round_number: 2, status: "removed", user_expression_id: null });
    h.states.set(latestKey, { candidate_key: latestKey, task_id: null, round_number: null, status: null, user_expression_id: expression });
    const result = await createSavedLibraryRepository(h.client as never).detail(user, source);
    const oldCard = (result!.artifacts[0]!.content as { candidates: { practiceState: unknown }[] }).candidates[0]!;
    const latestCard = (result!.artifacts[1]!.content as { candidates: { practiceState: unknown }[] }).candidates[0]!;
    expect(oldCard.practiceState).toEqual({ status: "removed", taskId: task, roundNumber: 2 });
    expect(latestCard.practiceState).toEqual({ status: "promoted", userExpressionId: expression });
    expect(h.calls).toHaveLength(1);
  });
  test("database projection failures propagate instead of inventing unpracticed states", async () => {
    const h = harness(false); h.fail();
    await expect(createSavedLibraryRepository(h.client as never).detail(user, source)).rejects.toThrow("projection unavailable");
  });
  test("inconsistent database projection rows fail closed instead of inventing a practicing state", async () => {
    const h = harness(false);
    const candidateKey = key(h.artifacts[0]!.id, "stable-mark-0");
    h.states.set(candidateKey, { candidate_key: candidateKey, task_id: task, round_number: 2, status: null, user_expression_id: null });
    await expect(createSavedLibraryRepository(h.client as never).detail(user, source)).rejects.toThrow("Inconsistent practice candidate projection");
  });
  test("a partial batch response fails instead of silently dropping an older card's state", async () => {
    const h = harness(false);
    const originalRpc = h.client.rpc;
    h.client.rpc = async (name, args) => {
      const result = await originalRpc(name, args);
      return Array.isArray(result.data) ? { ...result, data: result.data.slice(1) } : result;
    };
    await expect(createSavedLibraryRepository(h.client as never).detail(user, source)).rejects.toThrow("Incomplete practice candidate projection");
  });
});
