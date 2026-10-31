// @vitest-environment node

import { createClient } from "@supabase/supabase-js";

import { createSavedLibraryRepository, createSavedLibraryService } from "@/features/saved/api";
import type { Database } from "@/types/database.generated";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const SOURCE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SNAPSHOT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_SNAPSHOT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc";
const CAPTURED_AT = "2026-10-28T03:04:53.000Z";

type Row = Record<string, unknown>;

// Keep the real Supabase client and repository; replace only the remote PostgREST service.
function postgrest(tables: Record<string, Row[]>) {
  return async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const table = url.pathname.split("/").at(-1)!;
    let result = [...(tables[table] ?? [])];
    for (const [column, filter] of url.searchParams) {
      if (["select", "order", "limit"].includes(column)) continue;
      const separator = filter.indexOf(".");
      const operator = filter.slice(0, separator);
      const operand = filter.slice(separator + 1);
      result = result.filter((row) => {
        if (column === "saved_items.removed_from_saved_at" && operator === "is" && operand === "null") {
          return (tables.saved_items ?? []).some((item) =>
            item.video_source_id === row.id && item.user_id === row.user_id && item.removed_from_saved_at === null,
          );
        }
        const value = row[column];
        if (operator === "eq") return String(value) === operand;
        if (operator === "in") return operand.slice(1, -1).split(",").includes(String(value));
        if (operator === "lte") return Number(value) <= Number(operand);
        if (operator === "gt") return Number(value) > Number(operand);
        if (operator === "is" && operand === "null") return value === null;
        throw new Error(`Unsupported PostgREST test filter: ${filter}`);
      });
    }
    const order = url.searchParams.get("order");
    if (order) {
      for (const clause of order.split(",").reverse()) {
        const [column, direction] = clause.split(".");
        result.sort((left, right) => {
          const a = left[column!];
          const b = right[column!];
          const difference = typeof a === "number" && typeof b === "number"
            ? a - b : String(a).localeCompare(String(b));
          return direction === "desc" ? -difference : difference;
        });
      }
    }
    const limit = url.searchParams.get("limit");
    if (limit) result = result.slice(0, Number(limit));
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  };
}

function fixture(includeSubtitle: boolean, timestamp = 38, snapshotId: string | null = SNAPSHOT) {
  const moment = {
    id: "player-moment", user_id: USER, video_source_id: SOURCE,
    snapshot_id: snapshotId, youtube_video_id: "HkN9wpiOnAg", kind: "player_moment",
    status: "ready", captured_at: CAPTURED_AT, start_seconds: timestamp,
    removed_from_saved_at: null,
    payload: { capturedSecond: timestamp },
  };
  return {
    video_sources: [{ id: SOURCE, user_id: USER, youtube_video_id: "HkN9wpiOnAg", canonical_url: "https://www.youtube.com/watch?v=HkN9wpiOnAg" }],
    video_snapshots: [{ id: SNAPSHOT, user_id: USER, video_source_id: SOURCE, title: "中文视频", channel: "频道", thumbnail_url: null, captured_at: CAPTURED_AT }],
    saved_items: [moment, ...(includeSubtitle ? [{ ...moment, id: "subtitle-save", kind: "subtitle_row", start_seconds: 50, payload: { segmentId: "later-line" } }] : [])],
    knowledge_jobs: [],
    generated_artifacts: [],
    transcript_segments: [
      { stable_id: "other-owner", user_id: OTHER_USER, snapshot_id: SNAPSHOT, original_chinese: "别人的字幕", english_translation: null, start_seconds: 38, end_seconds: 39 },
      { stable_id: "000-other-snapshot", user_id: USER, snapshot_id: OTHER_SNAPSHOT, original_chinese: "其他快照的字幕", english_translation: null, start_seconds: 38, end_seconds: 39 },
      { stable_id: "current-line", user_id: USER, snapshot_id: SNAPSHOT, original_chinese: "Nike跌落神壇的故事嗎", english_translation: "The story of Nike falling from grace?", start_seconds: 38, end_seconds: 39 },
      { stable_id: "later-line", user_id: USER, snapshot_id: SNAPSHOT, original_chinese: "另一句字幕", english_translation: "Another subtitle.", start_seconds: 50, end_seconds: 52 },
    ],
  };
}

async function detail(tables: Record<string, Row[]>) {
  const client = createClient<Database>("http://127.0.0.1:54321", "test-anon-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: postgrest(tables) },
  });
  return createSavedLibraryService(createSavedLibraryRepository(client)).detail(USER, SOURCE);
}

describe("Saved repository player-moment evidence", () => {
  it("does not let 100 removed videos hide an older video with a visible moment", async () => {
    const tables: Record<string, Row[]> = fixture(false);
    const source = tables.video_sources![0]!;
    const moment = tables.saved_items![0]!;
    tables.video_sources = [
      ...Array.from({ length: 100 }, (_, index) => ({ ...source, id: `removed-source-${index}` })),
      source,
    ];
    tables.saved_items = [
      ...Array.from({ length: 100 }, (_, index) => ({
        ...moment, id: `removed-item-${index}`, video_source_id: `removed-source-${index}`,
        removed_from_saved_at: CAPTURED_AT,
      })),
      moment,
    ];
    const client = createClient<Database>("http://127.0.0.1:54321", "test-anon-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: postgrest(tables) },
    });
    const result = await createSavedLibraryService(createSavedLibraryRepository(client)).list(USER);
    expect(result.map(({ sourceId }) => sourceId)).toEqual([SOURCE]);
    expect(result[0]?.savedCount).toBe(1);
  });

  it("excludes removed moments and their failed jobs from the visible count and detail", async () => {
    const tables: Record<string, Row[]> = fixture(false);
    tables.saved_items!.push({
      ...tables.saved_items![0], id: "removed-moment", removed_from_saved_at: CAPTURED_AT,
    });
    tables.knowledge_jobs!.push({
      id: "removed-job", user_id: USER, video_source_id: SOURCE, saved_item_id: "removed-moment",
      job_type: "analyze_saved_item", status: "terminal_failed", last_error_code: "FAILED", created_at: CAPTURED_AT,
    });
    const result = await detail(tables);
    expect(result?.items.map(({ id }) => id)).toEqual(["player-moment"]);
    expect(result?.savedCount).toBe(1);
    expect(result?.processingState).toBe("ready");
  });

  it.each([false, true])("loads timestamp evidence with an additional subtitle save: %s", async (includeSubtitle) => {
    const result = await detail(fixture(includeSubtitle));

    expect(result?.items.find(({ id }) => id === "player-moment")).toMatchObject({
      rawText: "Nike跌落神壇的故事嗎",
      englishTranslation: "The story of Nike falling from grace?",
    });
    if (includeSubtitle) {
      expect(result?.items.find(({ id }) => id === "subtitle-save")?.rawText).toBe("另一句字幕");
    }
  });

  it.each([
    [39, SNAPSHOT],
    [38, null],
  ])("keeps the fallback when no same-snapshot subtitle contains %s at snapshot %s", async (timestamp, snapshotId) => {
    const result = await detail(fixture(false, timestamp, snapshotId));

    expect(result?.items[0]).toMatchObject({ rawText: "Saved video moment", englishTranslation: null });
  });
});
