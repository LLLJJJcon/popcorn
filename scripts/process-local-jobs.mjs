import { pathToFileURL } from "node:url";

const DEFAULT_INTERVAL_MS = 1_000;
const PROCESS_PATH = "/api/internal/jobs/process";

export function createProcessUrl(appUrl) {
  const parsed = new URL(appUrl);

  if (
    !["http:", "https:"].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    throw new Error("APP_URL must be an exact HTTP(S) application URL");
  }

  return new URL(PROCESS_PATH, parsed.origin).toString();
}

function classifyResponseBody(body) {
  if (
    typeof body !== "object"
    || body === null
    || body.ok !== true
    || typeof body.claimed !== "number"
    || !Number.isSafeInteger(body.claimed)
    || body.claimed < 0
  ) {
    return "failed";
  }

  return body.claimed === 0 ? "empty" : "processed";
}

export async function runLocalJobCycle({ appUrl, secret, fetchImpl = fetch }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("INTERNAL_JOB_SECRET is required");
  }

  const processUrl = createProcessUrl(appUrl);

  try {
    const response = await fetchImpl(processUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    if (!response.ok) return { status: "failed" };

    return { status: classifyResponseBody(await response.json()) };
  } catch {
    return { status: "failed" };
  }
}

function wait(intervalMs, signal) {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(finish, intervalMs);

    function finish() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function runLocalJobWorker({
  appUrl,
  secret,
  signal,
  fetchImpl = fetch,
  intervalMs = DEFAULT_INTERVAL_MS,
  sleep = wait,
  onStatus = (_status) => {},
}) {
  createProcessUrl(appUrl);
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("INTERNAL_JOB_SECRET is required");
  }

  while (!signal.aborted) {
    const result = await runLocalJobCycle({ appUrl, secret, fetchImpl });
    onStatus(result.status);
    if (!signal.aborted) await sleep(intervalMs, signal);
  }
}

async function main() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await runLocalJobWorker({
      appUrl: process.env.APP_URL,
      secret: process.env.INTERNAL_JOB_SECRET,
      signal: controller.signal,
      onStatus: (status) => console.log(`Popcorn local worker: ${status}`),
    });
  } catch {
    console.error("Popcorn local worker could not start. Check APP_URL and INTERNAL_JOB_SECRET.");
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
