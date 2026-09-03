import { createHash, randomUUID } from "node:crypto";
import { createServer, connect } from "node:net";
import { link, open, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const REQUIRED_FIELDS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPADATA_API_KEY",
  "APP_URL",
  "INTERNAL_JOB_SECRET",
];
const READY_TIMEOUT_MS = 30_000;
const READY_INTERVAL_MS = 500;
const CONTROL_TIMEOUT_MS = 2_000;
const STOP_TIMEOUT_MS = 30_000;

/** @typedef {{ exitCode: number | null | undefined, kill: (signal: NodeJS.Signals) => boolean, once: (event: string, listener: (...args: any[]) => void) => unknown }} ManagedChild */
/** @typedef {{ close: () => unknown }} ControlServer */
/** @typedef {{ listen: (handleMessage: (message: string) => Promise<string>) => Promise<{ port: number, server: ControlServer }>, request: (port: number, message: string, timeoutMs?: number) => Promise<string | null> }} ControlChannel */
/** @typedef {{ once: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown }} SignalProcess */
/** @typedef {{ start: () => Promise<void>, stop: () => Promise<void> }} Launcher */
/** @typedef {{ repositoryRoot?: string, environmentFile?: string, stateFile?: string, runCommand?: (command: string, args: string[]) => Promise<void>, spawnService?: (command: string, args: string[], environment: NodeJS.ProcessEnv) => ManagedChild, waitForReady?: (url: string, signal?: AbortSignal) => Promise<void>, openBrowser?: (url: string) => Promise<void>, controlTimeoutMs?: number, stopTimeoutMs?: number, readyTimeoutMs?: number, readyIntervalMs?: number, controlChannel?: ControlChannel }} LauncherOptions */

function runtimeStateFile(repositoryRoot) {
  const identifier = createHash("sha256").update(repositoryRoot).digest("hex").slice(0, 16);
  return path.join(tmpdir(), `popcorn-local-${identifier}.json`);
}

function parseEnvironment(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    values[name] = rawValue.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2").trim();
  }
  return values;
}

function exactApplicationUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol)
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}

function explicitApplicationPort(value) {
  return value.match(/^https?:\/\/(?:\[[^\]]+\]|[^/:]+):(\d+)(?:\/|$)/i)?.[1];
}

async function readRequiredEnvironment(environmentFile) {
  let contents;
  try {
    contents = await readFile(environmentFile, "utf8");
  } catch {
    throw new Error("Missing required .env.local fields: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPADATA_API_KEY, APP_URL, INTERNAL_JOB_SECRET");
  }

  const values = parseEnvironment(contents);
  const missing = REQUIRED_FIELDS.filter((field) => !values[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required .env.local fields: ${missing.join(", ")}`);
  }
  if (!exactApplicationUrl(values.APP_URL)) {
    throw new Error("APP_URL must be an exact HTTP(S) application URL");
  }
  return values;
}

async function removeFile(file) {
  try {
    await rm(file, { force: true });
  } catch {
    // Runtime state is best-effort cleanup only.
  }
}

async function publishStateWithoutOverwrite(stateFile, state) {
  const candidateFile = `${stateFile}.${randomUUID()}.candidate`;
  let candidateCreated = false;
  try {
    const candidate = await open(candidateFile, "wx", 0o600);
    candidateCreated = true;
    try {
      await candidate.writeFile(JSON.stringify(state), "utf8");
    } finally {
      await candidate.close();
    }
    await link(candidateFile, stateFile);
  } finally {
    if (candidateCreated) await removeFile(candidateFile);
  }
}

function sameState(left, right) {
  if (!left || !right) return left === right;
  return left.repositoryRoot === right.repositoryRoot
    && left.claimId === right.claimId
    && left.port === right.port
    && left.starting === right.starting
    && left.startedAt === right.startedAt;
}

async function discardStaleState(stateFile, expectedState) {
  const staleFile = `${stateFile}.${randomUUID()}.stale`;
  try {
    await rename(stateFile, staleFile);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const movedState = await readState(staleFile);
  if (!sameState(movedState, expectedState)) {
    try {
      await link(staleFile, stateFile);
      await removeFile(staleFile);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    return;
  }
  await removeFile(staleFile);
}

async function readState(stateFile) {
  try {
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    if (typeof state?.repositoryRoot !== "string") return null;
    if (state.port !== undefined && (!Number.isSafeInteger(state.port) || state.port < 1 || state.port > 65_535)) return null;
    return state;
  } catch {
    return null;
  }
}

function controlMessage(action, claimId) {
  return JSON.stringify({ action, claimId: typeof claimId === "string" ? claimId : null });
}

function parseControlMessage(message) {
  try {
    const request = JSON.parse(message);
    if (!["ping", "stop"].includes(request?.action)) return null;
    if (typeof request?.claimId !== "string") return null;
    return request;
  } catch {
    return null;
  }
}

/** @returns {Promise<string | null>} */
export function sendControl(port, message, timeoutMs = CONTROL_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    let response = "";
    let settled = false;
    const timeout = setTimeout(() => finish(null), timeoutMs);
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(value);
    };
    socket.setEncoding("utf8");
    socket.once("error", () => finish(null));
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.once("end", () => finish(response.trim()));
    socket.once("connect", () => socket.end(`${message}\n`));
  });
}

/** @returns {Promise<{ port: number, server: ControlServer }>} */
async function createControlServer(handleMessage) {
  const server = createServer({ allowHalfOpen: true }, (socket) => {
    let request = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      request += chunk;
    });
    socket.once("end", async () => {
      const response = await handleMessage(request.trim());
      if (!socket.destroyed) socket.end(`${response}\n`);
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Popcorn could not create its local control channel");
  return { port: address.port, server };
}

/** @returns {Promise<void>} */
function commandExit(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.once("error", () => reject(new Error("Popcorn could not run a local service command")));
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Popcorn local service command failed"));
    });
  });
}

async function defaultWaitForReady(url, signal, timeoutMs = READY_TIMEOUT_MS, intervalMs = READY_INTERVAL_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Popcorn local launcher stopped");
    try {
      const requestTimeoutMs = Math.max(1, Math.min(2_000, deadline - Date.now()));
      const response = await fetch(url, {
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)])
          : AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remainingMs)));
    }
  }
  throw new Error("Popcorn Web app did not become reachable in time");
}

async function defaultOpenBrowser(url) {
  const command = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
  child.unref();
}

async function terminate(child) {
  if (!child || child.exitCode != null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

/** @param {LauncherOptions} options */
export function createPopcornLauncher({
  repositoryRoot = process.cwd(),
  environmentFile = path.join(repositoryRoot, ".env.local"),
  stateFile = runtimeStateFile(repositoryRoot),
  controlTimeoutMs = CONTROL_TIMEOUT_MS,
  stopTimeoutMs = STOP_TIMEOUT_MS,
  readyTimeoutMs = READY_TIMEOUT_MS,
  readyIntervalMs = READY_INTERVAL_MS,
  runCommand = (command, args) => commandExit(command, args, { cwd: repositoryRoot, stdio: "ignore" }),
  spawnService = (command, args, environment) => spawn(command, args, {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  }),
  waitForReady = (url, signal) => defaultWaitForReady(url, signal, readyTimeoutMs, readyIntervalMs),
  openBrowser = defaultOpenBrowser,
  controlChannel = { listen: createControlServer, request: sendControl },
} = {}) {
  let controlServer;
  let children = [];
  let cleanupPromise;
  let started = false;
  let readinessController;
  let claimId;
  let ownedState;
  let ownsClaim = false;
  let starting = false;
  let cancelled = false;
  let rejectedByOwner = false;
  let supabaseStart;

  function closeControlServer() {
    if (!controlServer) return;
    const server = controlServer;
    controlServer = undefined;
    server.close();
  }

  function cleanup() {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      readinessController?.abort();
      try {
        await supabaseStart?.catch(() => {});
        await Promise.all(children.map(terminate));
        children = [];
        await runCommand("pnpm", ["exec", "supabase", "stop"]);
      } finally {
        if (ownsClaim && ownedState) await discardStaleState(stateFile, ownedState);
        closeControlServer();
        ownedState = undefined;
        ownsClaim = false;
        started = false;
      }
    })();
    return cleanupPromise;
  }

  async function acquireClaim(port) {
    claimId = randomUUID();
    const state = { repositoryRoot, claimId, port };
    while (!cancelled) {
      try {
        await publishStateWithoutOverwrite(stateFile, state);
        ownedState = state;
        ownsClaim = true;
        return;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }

      const existing = await readState(stateFile);
      if (
        existing?.repositoryRoot === repositoryRoot
        && existing.port
        && await controlChannel.request(
          existing.port,
          controlMessage("ping", existing.claimId),
          controlTimeoutMs,
        ) === "pong"
      ) {
        rejectedByOwner = true;
        closeControlServer();
        throw new Error("Popcorn is already running for this repository");
      }
      await discardStaleState(stateFile, existing);
    }
  }

  async function start() {
    starting = true;
    try {
      const environmentValues = await readRequiredEnvironment(environmentFile);
      const applicationUrl = new URL(environmentValues.APP_URL);
      const applicationPort = applicationUrl.port || explicitApplicationPort(environmentValues.APP_URL);
      if (cancelled) return;
      const control = await controlChannel.listen(async (message) => {
        const request = parseControlMessage(message);
        if (!claimId || request?.claimId !== claimId) return "invalid";
        if (request.action === "ping") return "pong";
        if (request.action === "stop") {
          try {
            await cleanup();
            return "stopped";
          } catch {
            return "failed";
          }
        }
        return "invalid";
      });
      controlServer = control.server;
      if (cancelled) {
        closeControlServer();
        return;
      }
      await acquireClaim(control.port);
      if (cancelled || cleanupPromise) {
        if (ownsClaim) await cleanup();
        else closeControlServer();
        return;
      }
      supabaseStart = runCommand("pnpm", ["exec", "supabase", "start"]);
      await supabaseStart;
      supabaseStart = undefined;
      if (cleanupPromise) {
        await cleanupPromise;
        return;
      }
      const environment = { ...process.env, ...environmentValues };
      const webArgs = ["dev", "--hostname", applicationUrl.hostname];
      if (applicationPort) webArgs.push("--port", applicationPort);
      children = [
        spawnService("pnpm", webArgs, environment),
        spawnService("pnpm", ["worker:local"], environment),
      ];
      readinessController = new AbortController();
      await waitForReady(environmentValues.APP_URL, readinessController.signal);
      if (cleanupPromise) {
        await cleanupPromise;
        return;
      }
      await openBrowser(environmentValues.APP_URL);
      started = true;
    } catch (error) {
      if (rejectedByOwner) {
        closeControlServer();
      } else if (ownsClaim || supabaseStart || children.length > 0 || cleanupPromise) {
        await cleanup();
      } else {
        closeControlServer();
      }
      throw error;
    } finally {
      starting = false;
    }
  }

  async function stop() {
    cancelled = true;
    if (rejectedByOwner) {
      closeControlServer();
      return;
    }
    if (starting) {
      if (ownsClaim || supabaseStart || cleanupPromise) await cleanup();
      else closeControlServer();
      return;
    }
    if (started || ownsClaim || cleanupPromise) {
      await cleanup();
      return;
    }
    let state = await readState(stateFile);
    while (state) {
      if (state.port) {
        const response = await controlChannel.request(
          state.port,
          controlMessage("stop", state.claimId),
          stopTimeoutMs,
        );
        if (response === "stopped") return;
        if (response === "failed") {
          throw new Error("Popcorn owner cleanup failed");
        }
        if (response === null) {
          const currentState = await readState(stateFile);
          if (!sameState(currentState, state)) {
            throw new Error("Popcorn owner cleanup status is unknown");
          }
          const ownerResponse = await controlChannel.request(
            state.port,
            controlMessage("ping", state.claimId),
            controlTimeoutMs,
          );
          if (ownerResponse === "pong") {
            throw new Error("Popcorn owner cleanup did not complete in time");
          }
        }
      }
      await discardStaleState(stateFile, state);
      const nextState = await readState(stateFile);
      if (sameState(nextState, state) || !nextState) break;
      state = nextState;
    }
    await runCommand("pnpm", ["exec", "supabase", "stop"]);
  }

  return { start, stop };
}

/** @param {{ action: string | undefined, launcher: Launcher, processRef?: SignalProcess }} options */
export async function runLauncherCommand({ action, launcher, processRef = process }) {
  const stop = () => launcher.stop().catch(() => {});
  processRef.once("SIGINT", stop);
  processRef.once("SIGTERM", stop);
  if (action === "start") await launcher.start();
  else if (action === "stop") await launcher.stop();
  else throw new Error("Use: node scripts/popcorn-local.mjs start|stop");
}

async function main() {
  const action = process.argv[2];
  const launcher = createPopcornLauncher();
  try {
    await runLauncherCommand({ action, launcher });
  } catch (error) {
    console.error(error instanceof Error && error.message.startsWith("Missing required")
      ? error.message
      : "Popcorn could not complete the local launcher command. Check .env.local and local services.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
