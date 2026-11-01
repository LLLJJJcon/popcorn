import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type CleanupExecutor = (
  file: string,
  args: readonly string[],
  options: {
    env: Record<string, string | undefined>;
    maxBuffer: number;
  },
) => Promise<unknown>;

export type CleanupDatabasePort = "54322" | "54332";

type CleanupOptions = {
  expectedDatabasePort?: CleanupDatabasePort;
  cleanupSql: string;
  databaseUrl: string;
  inheritedEnvironment?: Readonly<Record<string, string | undefined>>;
  execute?: CleanupExecutor;
};

const execFileAsync = promisify(execFile);

const defaultExecutor: CleanupExecutor = async (file, args, options) => {
  await execFileAsync(file, [...args], {
    ...options,
    env: options.env as NodeJS.ProcessEnv,
  });
};

export function cleanupDatabasePortForApi(rawUrl: string): CleanupDatabasePort {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Expected an approved local Supabase test API"); }
  if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.username || url.password || (rawUrl !== url.origin && rawUrl !== `${url.origin}/`)) {
    throw new Error("Expected an approved local Supabase test API");
  }
  if (url.port === "54321") return "54322";
  if (url.port === "54331") return "54332";
  throw new Error("Expected an approved local Supabase test API");
}

function localCleanupConnection(
  rawUrl: string,
  expectedDatabasePort: CleanupDatabasePort,
  inheritedEnvironment: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  let databaseUrl: URL;
  let databasePassword: string;

  try {
    databaseUrl = new URL(rawUrl);
    databasePassword = decodeURIComponent(databaseUrl.password);
  } catch {
    throw new Error("POPCORN_E2E_DATABASE_URL must be a valid local PostgreSQL URL");
  }

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
    || !["127.0.0.1", "localhost"].includes(databaseUrl.hostname)
    || !["54322", "54332"].includes(expectedDatabasePort)
    || databaseUrl.port !== expectedDatabasePort
    || databaseUrl.pathname !== "/postgres"
    || databaseUrl.username !== "postgres"
    || databasePassword.length === 0
    || databaseUrl.search.length > 0
    || databaseUrl.hash.length > 0
  ) {
    throw new Error(
      "POPCORN_E2E_DATABASE_URL must match the selected local test database exactly",
    );
  }

  const environment: Record<string, string | undefined> = {
    PGHOST: databaseUrl.hostname,
    PGPORT: databaseUrl.port,
    PGDATABASE: databaseUrl.pathname.slice(1),
    PGUSER: databaseUrl.username,
    PGPASSWORD: databasePassword,
    PGCONNECT_TIMEOUT: "5",
    PGAPPNAME: "popcorn-saved-learning-loop-cleanup",
    PGSSLMODE: "disable",
  };

  for (const name of ["PATH", "LANG", "LC_ALL", "LC_CTYPE"] as const) {
    const value = inheritedEnvironment[name];
    if (value !== undefined) environment[name] = value;
  }

  return environment;
}

export async function runSavedLearningLoopCleanup({
  cleanupSql,
  databaseUrl,
  expectedDatabasePort = "54322",
  inheritedEnvironment = process.env,
  execute = defaultExecutor,
}: CleanupOptions): Promise<void> {
  try {
    await execute("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-c", cleanupSql], {
      env: localCleanupConnection(databaseUrl, expectedDatabasePort, inheritedEnvironment),
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new Error("Local E2E database cleanup failed");
  }
}
