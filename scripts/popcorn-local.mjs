import { createHash } from "node:crypto";
import { createServer, connect } from "node:net";
import { readFile, rm, writeFile } from "node:fs/promises";
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

/** @typedef {{ exitCode: number | null | undefined, kill: (signal: NodeJS.Signals) => boolean, once: (event: string, listener: (...args: any[]) => void) => unknown }} ManagedChild */
/** @typedef {{ close: () => unknown }} ControlServer */
/** @typedef {{ listen: (handleMessage: (message: string) => Promise<string>) => Promise<{ port: number, server: ControlServer }>, request: (port: number, message: string) => Promise<string | null> }} ControlChannel */
/** @typedef {{ once: (event: "SIGINT" | "SIGTERM", listener: () => void) => unknown }} SignalProcess */
/** @typedef {{ start: () => Promise<void>, stop: () => Promise<void> }} Launcher */
/** @typedef {{ repositoryRoot?: string, environmentFile?: string, stateFile?: string, runCommand?: (command: string, args: string[]) => Promise<void>, spawnService?: (command: string, args: string[], environment: NodeJS.ProcessEnv) => ManagedChild, waitForReady?: (url: string, signal?: AbortSignal) => Promise<void>, openBrowser?: (url: string) => Promise<void>, controlChannel?: ControlChannel }} LauncherOptions */

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

async function readState(stateFile) {
  try {
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    if (
      !Number.isSafeInteger(state?.port)
      || state.port < 1
      || state.port > 65_535
      || typeof state?.repositoryRoot !== "string"
    ) return null;
    return state;
  } catch {
    return null;
  }
}

/** @returns {Promise<string | null>} */
function sendControl(port, message) {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port });
    let response = "";
    socket.setEncoding("utf8");
    socket.once("error", () => resolve(null));
    socket.on("data", (chunk) => {
      response += chunk;
    });
    socket.once("end", () => resolve(response.trim()));
    socket.once("connect", () => socket.end(`${message}\n`));
  });
}

/** @returns {Promise<{ port: number, server: ControlServer }>} */
async function createControlServer(handleMessage) {
  const server = createServer((socket) => {
    let request = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      request += chunk;
    });
    socket.once("end", async () => {
      const response = await handleMessage(request.trim());
      socket.end(`${response}\n`);
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

async function defaultWaitForReady(url, signal) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Popcorn local launcher stopped");
    try {
      const response = await fetch(url, {
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(2_000)]) : AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
    } catch {
      // The development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, READY_INTERVAL_MS));
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
  runCommand = (command, args) => commandExit(command, args, { cwd: repositoryRoot, stdio: "inherit" }),
  spawnService = (command, args, environment) => spawn(command, args, {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
  }),
  waitForReady = defaultWaitForReady,
  openBrowser = defaultOpenBrowser,
  controlChannel = { listen: createControlServer, request: sendControl },
} = {}) {
  let controlServer;
  let children = [];
  let cleaningUp = false;
  let started = false;
  let readinessController;

  async function cleanup() {
    if (cleaningUp) return;
    cleaningUp = true;
    if (controlServer) controlServer.close();
    readinessController?.abort();
    await removeFile(stateFile);
    await Promise.all(children.map(terminate));
    children = [];
    await runCommand("pnpm", ["exec", "supabase", "stop"]);
  }

  async function start() {
    const environmentValues = await readRequiredEnvironment(environmentFile);
    const existing = await readState(stateFile);
    if (existing) {
      const response = await controlChannel.request(existing.port, "ping");
      if (response === "pong") throw new Error("Popcorn is already running for this repository");
      await removeFile(stateFile);
    }

    try {
      const control = await controlChannel.listen(async (message) => {
        if (message === "ping") return "pong";
        if (message === "stop") {
          await cleanup();
          return "stopped";
        }
        return "invalid";
      });
      controlServer = control.server;
      await writeFile(stateFile, JSON.stringify({ repositoryRoot, port: control.port }));
      await runCommand("pnpm", ["exec", "supabase", "start"]);
      if (cleaningUp) return;
      const environment = { ...process.env, ...environmentValues };
      children = [
        spawnService("pnpm", ["dev"], environment),
        spawnService("pnpm", ["worker:local"], environment),
      ];
      readinessController = new AbortController();
      await waitForReady(environmentValues.APP_URL, readinessController.signal);
      if (cleaningUp) return;
      await openBrowser(environmentValues.APP_URL);
      started = true;
    } catch (error) {
      await cleanup();
      throw error;
    }
  }

  async function stop() {
    if (started) {
      await cleanup();
      return;
    }
    const state = await readState(stateFile);
    if (state) {
      const response = await controlChannel.request(state.port, "stop");
      if (response === "stopped") return;
      await removeFile(stateFile);
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
