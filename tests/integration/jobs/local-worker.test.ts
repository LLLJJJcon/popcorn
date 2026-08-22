import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test, vi } from "vitest";

import {
  createProcessUrl,
  runLocalJobCycle,
  runLocalJobWorker,
} from "../../../scripts/process-local-jobs.mjs";

describe("local durable-job worker", () => {
  test("posts one authenticated bounded request to the existing processor", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({
        ok: true,
        claimed: 2,
        completed: 2,
        deferred: 0,
        failed: 0,
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    await expect(runLocalJobCycle({
      appUrl: "http://127.0.0.1:3000/app",
      secret: "local-secret",
      fetchImpl,
    })).resolves.toEqual({ status: "processed" });
    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      "http://127.0.0.1:3000/api/internal/jobs/process",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer local-secret",
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
  });

  test("reports only generic empty and failed statuses", async () => {
    const emptyFetch = vi.fn(async () =>
      new Response(JSON.stringify({
        ok: true,
        claimed: 0,
        completed: 0,
        deferred: 0,
        failed: 0,
        providerBody: "must-not-escape",
        apiKey: "must-not-escape",
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const failedFetch = vi.fn(async () =>
      new Response("provider body must not escape", { status: 503 }),
    );
    const throwingFetch = vi.fn(async () => {
      throw new Error("network detail must not escape");
    });

    await expect(runLocalJobCycle({
      appUrl: "https://popcorn.example",
      secret: "local-secret",
      fetchImpl: emptyFetch,
    })).resolves.toEqual({ status: "empty" });
    await expect(runLocalJobCycle({
      appUrl: "https://popcorn.example",
      secret: "local-secret",
      fetchImpl: failedFetch,
    })).resolves.toEqual({ status: "failed" });
    await expect(runLocalJobCycle({
      appUrl: "https://popcorn.example",
      secret: "local-secret",
      fetchImpl: throwingFetch,
    })).resolves.toEqual({ status: "failed" });
  });

  test.each([
    "file:///tmp/popcorn",
    "ftp://popcorn.example",
    "https://user:password@popcorn.example",
    "https://popcorn.example?secret=value",
    "https://popcorn.example#fragment",
  ])("rejects an unsafe APP_URL: %s", (appUrl) => {
    expect(() => createProcessUrl(appUrl)).toThrow();
  });

  test("runs sequential cycles after failures and stops through AbortSignal", async () => {
    const controller = new AbortController();
    let active = 0;
    let maximumActive = 0;
    const fetchImpl = vi.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      active -= 1;
      if (fetchImpl.mock.calls.length === 1) {
        throw new Error("transient failure");
      }
      return new Response(JSON.stringify({ ok: true, claimed: 0 }), { status: 200 });
    });
    const statuses: string[] = [];
    const sleep = vi.fn(async () => {
      if (statuses.length === 2) controller.abort();
    });

    await runLocalJobWorker({
      appUrl: "http://127.0.0.1:3000",
      secret: "local-secret",
      signal: controller.signal,
      fetchImpl,
      sleep,
      onStatus: (status: string) => statuses.push(status),
    });

    expect(statuses).toEqual(["failed", "empty"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(maximumActive).toBe(1);
  });

  test("retires global OpenAI configuration from local setup files", async () => {
    const [environmentExample, supabaseConfig] = await Promise.all([
      readFile(resolve(process.cwd(), ".env.example"), "utf8"),
      readFile(resolve(process.cwd(), "supabase/config.toml"), "utf8"),
    ]);

    expect(environmentExample).not.toContain("OPENAI_API_KEY");
    expect(environmentExample).not.toContain("OPENAI_MODEL");
    expect(supabaseConfig).not.toContain("openai_api_key");
    expect(environmentExample).toContain("SUPADATA_API_KEY");
    expect(environmentExample).toContain("INTERNAL_JOB_SECRET");
  });
});
