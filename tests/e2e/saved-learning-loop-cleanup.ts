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

type CleanupOptions = {
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

function localCleanupConnection(
  rawUrl: string,
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
    || databaseUrl.port !== "54322"
    || databaseUrl.pathname !== "/postgres"
    || databaseUrl.username !== "postgres"
    || databasePassword.length === 0
    || databaseUrl.search.length > 0
    || databaseUrl.hash.length > 0
  ) {
    throw new Error(
      "POPCORN_E2E_DATABASE_URL must target postgres on local port 54322 database postgres exactly",
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
  inheritedEnvironment = process.env,
  execute = defaultExecutor,
}: CleanupOptions): Promise<void> {
  try {
    await execute("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-c", cleanupSql], {
      env: localCleanupConnection(databaseUrl, inheritedEnvironment),
      maxBuffer: 1024 * 1024,
    });
  } catch {
    throw new Error("Local E2E database cleanup failed");
  }
}
