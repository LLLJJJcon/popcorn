import { describe, expect, it, vi } from "vitest";

import {
  runSavedLearningLoopCleanup,
  type CleanupExecutor,
} from "../../e2e/saved-learning-loop-cleanup";

const LOCAL_DATABASE_URL = "postgresql://postgres:local%20password@127.0.0.1:54322/postgres";

describe("saved learning-loop cleanup subprocess", () => {
  it("passes only the approved runtime, locale, and validated local PostgreSQL environment", async () => {
    const execute = vi.fn<CleanupExecutor>().mockResolvedValue(undefined);

    await runSavedLearningLoopCleanup({
      cleanupSql: "select 1",
      databaseUrl: LOCAL_DATABASE_URL,
      inheritedEnvironment: {
        PATH: "/fixture/bin",
        LANG: "en_US.UTF-8",
        LC_ALL: "C.UTF-8",
        LC_CTYPE: "zh_CN.UTF-8",
        HOME: "/sentinel/home",
        PGHOSTADDR: "203.0.113.20",
        PGSERVICE: "remote-production",
        PGSERVICEFILE: "/sentinel/pg_service.conf",
        SUPABASE_SERVICE_ROLE_KEY: "sentinel-service-secret",
        OPENAI_API_KEY: "sentinel-model-secret",
      },
      execute,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[2].env).toEqual({
      PATH: "/fixture/bin",
      LANG: "en_US.UTF-8",
      LC_ALL: "C.UTF-8",
      LC_CTYPE: "zh_CN.UTF-8",
      PGHOST: "127.0.0.1",
      PGPORT: "54322",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      PGPASSWORD: "local password",
      PGCONNECT_TIMEOUT: "5",
      PGAPPNAME: "popcorn-saved-learning-loop-cleanup",
      PGSSLMODE: "disable",
    });
  });

  it.each([
    "postgresql://postgres:secret@db.example.com:54322/postgres",
    "postgresql://postgres@127.0.0.1:54322/postgres",
    "postgresql://postgres:secret@127.0.0.1:54322/postgres?service=remote",
    "postgresql://postgres:secret@127.0.0.1:54322/postgres#remote",
  ])("fails closed before execution for invalid cleanup URL %s", async (databaseUrl) => {
    const execute = vi.fn<CleanupExecutor>().mockResolvedValue(undefined);

    await expect(runSavedLearningLoopCleanup({
      cleanupSql: "select 1",
      databaseUrl,
      inheritedEnvironment: { PATH: "/fixture/bin" },
      execute,
    })).rejects.toThrow("Local E2E database cleanup failed");
    expect(execute).not.toHaveBeenCalled();
  });
});
