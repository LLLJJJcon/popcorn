import { beforeEach, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";
import { createTodayPracticeRepository } from "@/server/repositories/today-practice-repository";

const { createRuntime } = vi.hoisted(() => ({ createRuntime: vi.fn() }));
vi.mock("@/server/today-practice-runtime", () => ({ createTodayPracticeRuntime: createRuntime }));
import { GET as today } from "@/app/api/v1/practice/today/route";
import { GET as next, POST as postNext } from "@/app/api/v1/practice/today/next/route";
import { GET as material } from "@/app/api/v1/practice/tasks/[taskId]/route";

const owner = "29000000-0000-4000-8000-000000000001";
const at = "2026-11-01T00:00:00Z";
const summary = { reviewCount: 0, secondTryCount: 0, newCount: 0, estimatedMinutes: 0, needsAnalysisCount: 0, processingCount: 0, nextPracticeAt: null };
beforeEach(() => vi.clearAllMocks());

test.each([
  ["today", () => today(new Request("http://localhost/api/v1/practice/today"))],
  ["next GET", () => next(new Request("http://localhost/api/v1/practice/today/next"))],
  ["next POST", () => postNext(new Request("http://localhost/api/v1/practice/today/next", { method: "POST" }))],
  ["material", () => material(new Request("http://localhost"), { params: Promise.resolve({ taskId: owner }) })],
])("%s route preserves the failure envelope when runtime configuration fails", async (_name, invoke) => {
  createRuntime.mockRejectedValueOnce(new Error("invalid server configuration"));
  const response = await invoke();
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR", retryable: true } });
});

test("repository binds owner, time, unlimited exclusions and nullable refresh hints to typed RPCs", async () => {
  const result = { summary, item: null, remainingCount: 0, resumed: false };
  const rpc = vi.fn(async () => ({ data: result, error: null }));
  const repository = createTodayPracticeRepository({ rpc } as unknown as SupabaseClient<Database>);
  const exclude = Array.from({ length: 301 }, (_, n) => `29000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`);
  expect(await repository.next(owner, at, { exclude })).toEqual(result);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("get_today_practice_next", {
    p_user_id: owner, p_now: at, p_exclude: exclude, p_current_item_id: null, p_current_task_id: null,
  });
});

test("repository propagates SQL failures and rejects malformed projections", async () => {
  const error = { code: "42501", message: "permission denied" };
  const rpc = vi.fn().mockResolvedValueOnce({ data: null, error }).mockResolvedValueOnce({ data: {}, error: null });
  const repository = createTodayPracticeRepository({ rpc } as unknown as SupabaseClient<Database>);
  await expect(repository.summary(owner, at)).rejects.toEqual(error);
  await expect(repository.summary(owner, at)).rejects.toThrow();
});
