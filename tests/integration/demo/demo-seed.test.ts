import {
  assertLocalSupabaseUrl,
  buildDemoSeedPlan,
  parseCliArguments,
  seedDemo,
  type DemoAccount,
  type DemoSeedRepository,
  type DemoSeedRow,
  type DemoTable,
} from "../../../scripts/seed-demo";
import { DEMO_VIDEO } from "../../fixtures/demo/youtube-video";
import transcript from "../../fixtures/demo/transcript.zh-CN.json";
import artifacts from "../../fixtures/demo/generated-artifacts.json";
import { validateOverviewContent } from "../../../src/server/ai/provider";
import { validateSavedItemAnalysisContent } from "../../../src/server/jobs/job-types";

const OWNER_A = "10000000-0000-4000-8000-000000000001";
const OWNER_B = "10000000-0000-4000-8000-000000000002";
const REFERENCE_NOW = "2026-08-23T12:00:00.000Z";

type Operation = {
  readonly kind: "write" | "read";
  readonly ownerId: string;
  readonly table: DemoTable;
  readonly rows?: readonly DemoSeedRow[];
  readonly ids?: readonly string[];
  readonly insertOnly?: boolean;
};

class MemoryRepository implements DemoSeedRepository {
  readonly operations: Operation[] = [];
  readonly rows = new Map<DemoTable, Map<string, DemoSeedRow>>();
  accounts: DemoAccount[];

  constructor(accounts: DemoAccount[]) {
    this.accounts = accounts;
  }

  async findAccounts(selector: string): Promise<readonly DemoAccount[]> {
    return this.accounts.filter((account) =>
      account.id === selector || account.email === selector,
    );
  }

  async writeOwned(input: {
    readonly ownerId: string;
    readonly table: DemoTable;
    readonly rows: readonly DemoSeedRow[];
    readonly insertOnly?: boolean;
  }): Promise<void> {
    this.operations.push({ kind: "write", ...input });
    const tableRows = this.rows.get(input.table) ?? new Map<string, DemoSeedRow>();
    for (const row of input.rows) {
      if (row.user_id !== input.ownerId) throw new Error("test repository owner mismatch");
      if (input.insertOnly && tableRows.has(row.id)) continue;
      tableRows.set(row.id, structuredClone(row));
      if (input.table === "review_tasks") {
        const pending = [...tableRows.values()].filter((candidate) =>
          candidate.user_id === input.ownerId
          && candidate.user_expression_id === row.user_expression_id
          && candidate.status === "pending",
        );
        if (pending.length > 1) throw new Error("review_tasks_one_pending_expression");
      }
    }
    this.rows.set(input.table, tableRows);
  }

  async readOwned(input: {
    readonly ownerId: string;
    readonly table: DemoTable;
    readonly ids: readonly string[];
  }): Promise<readonly DemoSeedRow[]> {
    this.operations.push({ kind: "read", ...input });
    const tableRows = this.rows.get(input.table) ?? new Map<string, DemoSeedRow>();
    return input.ids.flatMap((id) => {
      const row = tableRows.get(id);
      return row?.user_id === input.ownerId ? [structuredClone(row)] : [];
    });
  }
}

function rowsFor(plan: ReturnType<typeof buildDemoSeedPlan>, table: DemoTable) {
  return plan.tables[table] ?? [];
}

function idsByTable(repository: MemoryRepository): Record<string, string[]> {
  return Object.fromEntries(
    [...repository.rows.entries()].map(([table, rows]) => [table, [...rows.keys()].sort()]),
  );
}

describe("deterministic classroom demo seed", () => {
  it("uses a short fixture-only zh-CN YouTube snapshot with no media fields", () => {
    expect(DEMO_VIDEO).toMatchObject({
      youtubeVideoId: "PopcornD3mo",
      canonicalUrl: "https://www.youtube.com/watch?v=PopcornD3mo",
      transcriptLanguage: "zh-CN",
      acquiredAt: "2026-08-16T09:00:00.000Z",
    });
    expect(transcript).toHaveLength(4);
    expect(transcript.map((segment) => segment.stableId)).toEqual([
      "1".repeat(64), "2".repeat(64), "3".repeat(64), "4".repeat(64),
    ]);
    expect(transcript.map((segment) => segment.startSeconds)).toEqual([12, 21, 34, 49]);
    expect(transcript.every((segment) =>
      segment.language === "zh-CN" && segment.originalChinese.length <= 40,
    )).toBe(true);
    expect(JSON.stringify({ video: DEMO_VIDEO, transcript, artifacts }))
      .not.toMatch(/(?:videoBytes|mediaBytes|filePath|blob|base64)/i);
  });

  it("builds stable owner-bound IDs and a legal three-state evidence graph", () => {
    const first = buildDemoSeedPlan(OWNER_A, REFERENCE_NOW);
    const repeated = buildDemoSeedPlan(OWNER_A, REFERENCE_NOW);
    const anotherOwner = buildDemoSeedPlan(OWNER_B, REFERENCE_NOW);
    expect(first).toEqual(repeated);

    const firstIds = Object.values(first.tables).flat().map((row) => row.id);
    const otherIds = new Set(Object.values(anotherOwner.tables).flat().map((row) => row.id));
    expect(firstIds.every((id) => !otherIds.has(id))).toBe(true);
    expect(Object.values(first.tables).flat().every((row) => row.user_id === OWNER_A)).toBe(true);

    expect(rowsFor(first, "video_sources")).toHaveLength(1);
    expect(rowsFor(first, "video_snapshots")).toHaveLength(1);
    expect(rowsFor(first, "transcript_segments")).toHaveLength(4);
    expect(rowsFor(first, "saved_items").length).toBeGreaterThanOrEqual(2);
    expect(rowsFor(first, "generated_artifacts").some((row) =>
      row.artifact_type === "saved_item_analysis",
    )).toBe(true);
    expect(rowsFor(first, "expression_occurrences")).toHaveLength(3);
    expect(rowsFor(first, "expression_occurrences").every((row) =>
      !("source_deleted_at" in row),
    )).toBe(true);

    const expressions = rowsFor(first, "user_expressions");
    expect(expressions.map((row) => row.mastery_state).sort()).toEqual(["owned", "reused", "tried"]);
    expect(rowsFor(first, "practice_tasks").every((row) =>
      [row.instructions_english, row.goal_english].every((value) =>
        typeof value === "string" && /^[\x09-\x0d\x20-\x7e]+$/.test(value) && /[A-Za-z]/.test(value),
      ),
    )).toBe(true);
    const attempts = rowsFor(first, "attempts");
    const attemptIds = new Set(attempts.map((row) => row.id));
    const events = rowsFor(first, "mastery_events");
    const expectedTransitions = {
      tried: [[null, "tried", "valid_original_attempt"]],
      reused: [
        [null, "tried", "valid_original_attempt"],
        ["tried", "reused", "successful_independent_transfer"],
      ],
      owned: [
        [null, "tried", "valid_original_attempt"],
        ["tried", "reused", "successful_independent_transfer"],
        ["reused", "owned", "owned_threshold_met"],
      ],
    } as const;
    for (const expression of expressions) {
      const transitions = events
        .filter((event) => event.user_expression_id === expression.id)
        .toSorted((left, right) => String(left.occurred_at).localeCompare(String(right.occurred_at)))
        .map((event) => [event.prior_state, event.new_state, event.evidence_kind]);
      expect(transitions).toEqual(expectedTransitions[expression.mastery_state as keyof typeof expectedTransitions]);
      expect(events.filter((event) => event.user_expression_id === expression.id)
        .every((event) => typeof event.attempt_id === "string" && attemptIds.has(event.attempt_id))).toBe(true);
    }

    const reviews = rowsFor(first, "review_tasks");
    expect(reviews.filter((row) =>
      row.status === "pending" && String(row.due_at) <= REFERENCE_NOW,
    )).toHaveLength(1);
    expect(reviews.filter((row) => row.status === "completed").every((row) =>
      typeof row.completed_attempt_id === "string" && attemptIds.has(row.completed_attempt_id),
    )).toBe(true);
  });

  it("keeps cached fixture content free of credentials and Provider transport data", () => {
    const serialized = JSON.stringify(artifacts);
    expect(serialized).not.toMatch(
      /api.?key|provider.?response|base.?url|request|access.?token|refresh.?token|cookie|service.?secret|job.?secret/i,
    );
  });

  it("keeps cached artifacts valid and exactly grounded in persisted source evidence", () => {
    const sourceEvidence = {
      userId: OWNER_A,
      sourceId: "20000000-0000-4000-8000-000000000001",
      videoId: DEMO_VIDEO.youtubeVideoId,
      snapshotId: "20000000-0000-4000-8000-000000000002",
      transcriptHash: DEMO_VIDEO.transcriptHash,
      title: DEMO_VIDEO.title,
      segments: transcript.map((segment) => ({
        stableId: segment.stableId,
        originalChinese: segment.originalChinese,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
      })),
    };
    expect(validateOverviewContent(artifacts.overview, sourceEvidence)).toEqual(artifacts.overview);
    expect(validateSavedItemAnalysisContent(artifacts.savedItemAnalysis, {
      userId: OWNER_A,
      sourceId: sourceEvidence.sourceId,
      savedItemId: "20000000-0000-4000-8000-000000000003",
      snapshotId: sourceEvidence.snapshotId,
      transcriptHash: sourceEvidence.transcriptHash,
      kind: "subtitle_row",
      rawText: transcript[0].originalChinese,
      startSeconds: transcript[0].startSeconds,
      segments: [sourceEvidence.segments[0]],
    })).toEqual(artifacts.savedItemAnalysis);
  });

  it.each([
    "http://localhost:54321",
    "https://localhost/rest/v1",
    "http://127.12.4.8:54321",
    "http://[::1]:54321",
  ])("accepts loopback Supabase URL %s", (url) => {
    expect(assertLocalSupabaseUrl(url)).toBe(url);
  });

  it.each([
    "https://db.example.com",
    "ftp://localhost:54321",
    "http://user:pass@localhost:54321",
    "http://localhost:54321?secret=yes",
    "http://localhost:54321/#fragment",
    "not-a-url",
  ])("rejects non-local or malformed Supabase URL %s", (url) => {
    expect(() => assertLocalSupabaseUrl(url)).toThrow(/local Supabase URL/i);
  });

  it("requires exactly one existing email or UUID account", async () => {
    expect(() => parseCliArguments([])).toThrow(/--user/i);
    expect(parseCliArguments(["--", "--user", "owner@example.com"]))
      .toEqual({ userSelector: "owner@example.com" });
    expect(() => parseCliArguments(["--user", "not an account"])).toThrow(/email or UUID/i);
    expect(() => parseCliArguments(["--user", "owner@example.com", "--extra"])).toThrow(/arguments/i);

    await expect(seedDemo({
      repository: new MemoryRepository([]), userSelector: "missing@example.com", referenceNow: REFERENCE_NOW,
    })).rejects.toThrow(/exactly one existing local account/i);
    await expect(seedDemo({
      repository: new MemoryRepository([
        { id: OWNER_A, email: "duplicate@example.com" },
        { id: OWNER_B, email: "duplicate@example.com" },
      ]),
      userSelector: "duplicate@example.com",
      referenceNow: REFERENCE_NOW,
    })).rejects.toThrow(/exactly one existing local account/i);
  });

  it("is network-free, owner-scoped, idempotent, and leaves unrelated rows untouched", async () => {
    const repository = new MemoryRepository([{ id: OWNER_A, email: "owner@example.com" }]);
    const unrelated = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", user_id: OWNER_B, marker: "keep" };
    repository.rows.set("saved_items", new Map([[unrelated.id, unrelated]]));
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(() => { throw new Error("network forbidden"); });
    globalThis.fetch = fetchSpy as typeof fetch;
    try {
      const first = await seedDemo({
        repository, userSelector: "owner@example.com", referenceNow: REFERENCE_NOW,
      });
      const firstIds = idsByTable(repository);
      const second = await seedDemo({
        repository, userSelector: OWNER_A, referenceNow: REFERENCE_NOW,
      });
      expect(second.counts).toEqual(first.counts);
      expect(second.ids).toEqual(first.ids);
      expect(idsByTable(repository)).toEqual(firstIds);
      expect(repository.rows.get("saved_items")?.get(unrelated.id)).toEqual(unrelated);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(repository.operations.every((operation) => operation.ownerId === OWNER_A)).toBe(true);
      expect(repository.operations.filter((operation) => operation.kind === "write").every((operation) =>
        operation.rows?.every((row) => row.user_id === operation.ownerId),
      )).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
