import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn as spawnChild } from "node:child_process";
import { EventEmitter } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

import { afterEach, describe, expect, test } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

async function temporaryDirectory(prefix: string) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function localEnvironment(overrides: Record<string, string> = {}) {
  return Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon",
    SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
    SUPADATA_API_KEY: "local-supadata",
    APP_URL: "http://127.0.0.1:3010",
    INTERNAL_JOB_SECRET: "local-job-secret",
    ...overrides,
  }).map(([name, value]) => `${name}=${value}`).join("\n");
}

async function launcherModule() {
  return import("../../../scripts/popcorn-local.mjs");
}

function longRunningChild() {
  const child = new EventEmitter() as EventEmitter & {
    exitCode: number | null;
    kill: (signal: NodeJS.Signals) => boolean;
  };
  child.exitCode = null;
  child.kill = () => {
    child.exitCode = 0;
    queueMicrotask(() => child.emit("exit", 0));
    return true;
  };
  return child;
}

function memoryControlChannel() {
  let nextPort = 3011;
  const handlers = new Map<number, (message: string) => Promise<string>>();
  return {
    listen: async (nextHandler: (message: string) => Promise<string>) => {
      const port = nextPort++;
      handlers.set(port, nextHandler);
      return {
        port,
        server: { close: () => { handlers.delete(port); } },
      };
    },
    request: async (port: number, message: string) => handlers.get(port)?.(message) ?? null,
  };
}

function staleRecoveryRaceChannels(
  stalePort: number,
  firstOwnerStarted: { promise: Promise<void>; resolve: (value: void | PromiseLike<void>) => void },
) {
  let nextPort = stalePort + 1;
  const handlers = new Map<number, (message: string) => Promise<string>>();
  const secondContenderSawStale = deferred();
  return [0, 1].map((index) => ({
    listen: async (handler: (message: string) => Promise<string>) => {
      const port = nextPort++;
      handlers.set(port, handler);
      return {
        port,
        server: { close: () => { handlers.delete(port); } },
      };
    },
    request: async (port: number, message: string) => {
      if (port === stalePort) {
        if (index === 0) await secondContenderSawStale.promise;
        else {
          secondContenderSawStale.resolve();
          await firstOwnerStarted.promise;
        }
        return null;
      }
      return handlers.get(port)?.(message) ?? null;
    },
  }));
}

function deferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => {};
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

async function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  const child = spawnChild(command, args, { env: environment, stdio: "ignore" });
  const [exitCode] = await once(child, "exit") as [number | null];
  return exitCode ?? 1;
}

async function runCaptured(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) {
  const child = spawnChild(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
  const [exitCode] = await once(child, "exit") as [number | null];
  return { exitCode: exitCode ?? 1, stdout, stderr };
}

async function listenOnLoopback(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected a loopback TCP port");
  return address.port;
}

async function closeServer(server: Server, sockets: Set<Socket> = new Set()) {
  for (const socket of sockets) socket.destroy();
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe("Popcorn local launcher", () => {
  test("publishes the one-click start and stop commands through the root package", async () => {
    const packageManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

    expect(packageManifest.scripts).toMatchObject({
      "popcorn:start": "node scripts/popcorn-local.mjs start",
      "popcorn:stop": "node scripts/popcorn-local.mjs stop",
    });
  });

  test("rejects missing local fields before it starts any service", async () => {
    const directory = await temporaryDirectory("popcorn missing environment ");
    const environmentFile = path.join(directory, ".env.local");
    await writeFile(environmentFile, localEnvironment({ APP_URL: "", SUPADATA_API_KEY: "" }));
    const events: string[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      runCommand: async () => { events.push("command"); },
    });

    await expect(launcher.start()).rejects.toThrow(
      "Missing required .env.local fields: SUPADATA_API_KEY, APP_URL",
    );
    expect(events).toEqual([]);
  });

  test("starts Supabase before the Web app and worker, waits for the app, then opens APP_URL", async () => {
    const directory = await temporaryDirectory("popcorn start ordering ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(environmentFile, localEnvironment());
    const events: string[] = [];
    const children: ReturnType<typeof longRunningChild>[] = [];
    const controlChannel = memoryControlChannel();
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { events.push(`command ${args.join(" ")}`); },
      spawnService: (_command: string, args: string[]) => {
        events.push(`service ${args.join(" ")}`);
        const child = longRunningChild();
        children.push(child);
        return child;
      },
      waitForReady: async (url: string) => { events.push(`ready ${url}`); },
      openBrowser: async (url: string) => { events.push(`browser ${url}`); },
      controlChannel,
    });

    await launcher.start();

    expect(events).toEqual([
      "command exec supabase start",
      "service dev",
      "service worker:local",
      "ready http://127.0.0.1:3010",
      "browser http://127.0.0.1:3010",
    ]);
    expect(JSON.parse(await readFile(stateFile, "utf8"))).toMatchObject({ repositoryRoot: directory });

    await launcher.stop();
    expect(events).toContain("command exec supabase stop");
    await Promise.all(children.map(async (child) => {
      if (child.exitCode === null) await once(child, "exit");
    }));
  });

  test("rejects a duplicate live launcher for the same repository", async () => {
    const directory = await temporaryDirectory("popcorn duplicate launcher ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(environmentFile, localEnvironment());
    const firstEvents: string[] = [];
    const controlChannel = memoryControlChannel();
    const { createPopcornLauncher } = await launcherModule();
    const first = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { firstEvents.push(args.join(" ")); },
      spawnService: longRunningChild,
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlChannel,
    });
    const second = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async () => { firstEvents.push("unexpected command"); },
      controlChannel,
    });

    await first.start();
    await expect(second.start()).rejects.toThrow("Popcorn is already running for this repository");
    expect(firstEvents).toEqual(["exec supabase start"]);

    await second.stop();
    expect(firstEvents).toEqual(["exec supabase start"]);
    await first.stop();
    expect(firstEvents).toEqual(["exec supabase start", "exec supabase stop"]);
  });

  test("recovers a stale pre-control startup claim", async () => {
    const directory = await temporaryDirectory("popcorn stale startup claim ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(environmentFile, localEnvironment());
    await writeFile(stateFile, JSON.stringify({
      repositoryRoot: directory,
      claimId: "crashed-before-control",
      starting: true,
      startedAt: Date.now(),
    }));
    const events: string[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { events.push(args.join(" ")); },
      spawnService: longRunningChild,
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 50,
    });

    await launcher.start();

    expect(JSON.parse(await readFile(stateFile, "utf8"))).toMatchObject({
      repositoryRoot: directory,
      port: expect.any(Number),
    });
    expect(events).toEqual(["exec supabase start"]);
    await launcher.stop();
    expect(events).toEqual(["exec supabase start", "exec supabase stop"]);
  });

  test("an atomic live claim lets one concurrent owner start and prevents the loser from stopping it", async () => {
    const directory = await temporaryDirectory("popcorn atomic claim ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(environmentFile, localEnvironment());
    const events = [[], []] as string[][];
    const children = [[], []] as ReturnType<typeof longRunningChild>[][];
    const { createPopcornLauncher } = await launcherModule();
    const launchers = [0, 1].map((index) => createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { events[index].push(args.join(" ")); },
      spawnService: (_command: string, args: string[]) => {
        events[index].push(`service ${args.join(" ")}`);
        const child = longRunningChild();
        children[index].push(child);
        return child;
      },
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 50,
    }));

    const results = await Promise.allSettled(launchers.map((launcher) => launcher.start()));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: expect.objectContaining({ message: "Popcorn is already running for this repository" }) },
    ]);
    const winnerIndex = results.findIndex((result) => result.status === "fulfilled");
    const loserIndex = 1 - winnerIndex;
    const stateBeforeLoserStop = await readFile(stateFile, "utf8");

    await launchers[loserIndex].stop();

    expect(await readFile(stateFile, "utf8")).toBe(stateBeforeLoserStop);
    expect(events[loserIndex]).toEqual([]);
    expect(events[winnerIndex]).toEqual([
      "exec supabase start",
      "service dev",
      "service worker:local",
    ]);
    expect(children[winnerIndex].every((child) => child.exitCode === null)).toBe(true);

    await launchers[winnerIndex].stop();
    expect(events[winnerIndex].at(-1)).toBe("exec supabase stop");
  });

  test("stale recovery does not discard the live claim published after both contenders read stale state", async () => {
    const directory = await temporaryDirectory("popcorn stale claim race ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    const stalePort = 41_234;
    await writeFile(environmentFile, localEnvironment());
    await writeFile(stateFile, JSON.stringify({
      repositoryRoot: directory,
      claimId: "crashed-owner",
      port: stalePort,
    }));
    const firstOwnerStarted = deferred();
    const channels = staleRecoveryRaceChannels(stalePort, firstOwnerStarted);
    const events = [[], []] as string[][];
    const { createPopcornLauncher } = await launcherModule();
    const launchers = [0, 1].map((index) => createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      controlChannel: channels[index],
      runCommand: async (_command: string, args: string[]) => {
        events[index].push(args.join(" "));
        if (index === 0 && args.at(-1) === "start") firstOwnerStarted.resolve();
      },
      spawnService: longRunningChild,
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 50,
    }));

    const results = await Promise.allSettled(launchers.map((launcher) => launcher.start()));

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toMatchObject([
      { reason: expect.objectContaining({ message: "Popcorn is already running for this repository" }) },
    ]);
    expect(events[0]).toEqual(["exec supabase start"]);
    expect(events[1]).toEqual([]);
    await launchers[1].stop();
    expect(events[0]).toEqual(["exec supabase start"]);
    await launchers[0].stop();
    expect(events[0]).toEqual(["exec supabase start", "exec supabase stop"]);
  });

  test("a stale claim pointing at another live launcher cannot authenticate or stop that owner", async () => {
    const directoryA = await temporaryDirectory("popcorn stale repository A ");
    const directoryB = await temporaryDirectory("popcorn live repository B ");
    const stateFileA = path.join(directoryA, "runtime-state.json");
    const stateFileB = path.join(directoryB, "runtime-state.json");
    const environmentFileB = path.join(directoryB, ".env.local");
    await writeFile(environmentFileB, localEnvironment());
    const eventsA: string[] = [];
    const eventsB: string[] = [];
    const childrenB: ReturnType<typeof longRunningChild>[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const ownerB = createPopcornLauncher({
      environmentFile: environmentFileB,
      repositoryRoot: directoryB,
      stateFile: stateFileB,
      runCommand: async (_command: string, args: string[]) => { eventsB.push(args.join(" ")); },
      spawnService: () => {
        const child = longRunningChild();
        childrenB.push(child);
        return child;
      },
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 100,
    });
    await ownerB.start();
    const ownerStateBefore = await readFile(stateFileB, "utf8");
    const ownerState = JSON.parse(ownerStateBefore) as { port: number };
    await writeFile(stateFileA, JSON.stringify({
      repositoryRoot: directoryA,
      claimId: "stale-claim-for-repository-a",
      port: ownerState.port,
    }));
    const staleA = createPopcornLauncher({
      repositoryRoot: directoryA,
      stateFile: stateFileA,
      runCommand: async (_command: string, args: string[]) => { eventsA.push(args.join(" ")); },
      controlTimeoutMs: 100,
    });

    try {
      await staleA.stop();

      expect(eventsA).toEqual(["exec supabase stop"]);
      await expect(readFile(stateFileA, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(stateFileB, "utf8")).toBe(ownerStateBefore);
      expect(eventsB).toEqual(["exec supabase start"]);
      expect(childrenB.every((child) => child.exitCode === null)).toBe(true);
    } finally {
      await ownerB.stop();
    }
  });

  test("keeps the owner claim live through Supabase stop before a successor can acquire", async () => {
    const directory = await temporaryDirectory("popcorn teardown successor race ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(environmentFile, localEnvironment());
    const stopEntered = deferred();
    const stopCanFinish = deferred();
    const ownerEvents: string[] = [];
    const remoteStopEvents: string[] = [];
    const rejectedEvents: string[] = [];
    const successorEvents: string[] = [];
    const successorChildren: ReturnType<typeof longRunningChild>[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const owner = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => {
        if (args.at(-1) === "stop") {
          ownerEvents.push("supabase stop entered");
          stopEntered.resolve();
          await stopCanFinish.promise;
          ownerEvents.push("supabase stop complete");
          return;
        }
        ownerEvents.push(args.join(" "));
      },
      spawnService: (_command: string, args: string[]) => {
        ownerEvents.push(`service ${args.join(" ")}`);
        return longRunningChild();
      },
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 100,
    });
    await owner.start();
    const ownerStateBeforeStop = await readFile(stateFile, "utf8");
    const remoteStopper = createPopcornLauncher({
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { remoteStopEvents.push(args.join(" ")); },
      controlTimeoutMs: 100,
    });
    const pendingRemoteStop = remoteStopper.stop();
    await stopEntered.promise;
    await pendingRemoteStop;
    const duringTeardown = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { rejectedEvents.push(args.join(" ")); },
      spawnService: (_command: string, args: string[]) => {
        rejectedEvents.push(`service ${args.join(" ")}`);
        return longRunningChild();
      },
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 100,
    });
    let duringTeardownStarted = false;

    try {
      const outcome = await duringTeardown.start().then(
        () => { duringTeardownStarted = true; return "fulfilled"; },
        (error: unknown) => error,
      );

      expect(outcome).toMatchObject({ message: "Popcorn is already running for this repository" });
      expect(remoteStopEvents).toEqual([]);
      expect(rejectedEvents).toEqual([]);
      expect(await readFile(stateFile, "utf8")).toBe(ownerStateBeforeStop);
    } finally {
      stopCanFinish.resolve();
      await owner.stop();
      if (duringTeardownStarted) await duringTeardown.stop();
    }

    await expect(readFile(stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const successor = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { successorEvents.push(args.join(" ")); },
      spawnService: (_command: string, args: string[]) => {
        successorEvents.push(`service ${args.join(" ")}`);
        const child = longRunningChild();
        successorChildren.push(child);
        return child;
      },
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlTimeoutMs: 100,
    });
    await successor.start();
    const successorState = await readFile(stateFile, "utf8");

    await owner.stop();

    expect(await readFile(stateFile, "utf8")).toBe(successorState);
    expect(successorEvents).toEqual([
      "exec supabase start",
      "service dev",
      "service worker:local",
    ]);
    expect(successorChildren.every((child) => child.exitCode === null)).toBe(true);
    await successor.stop();
    expect(successorEvents.at(-1)).toBe("exec supabase stop");
    expect(ownerEvents).toEqual([
      "exec supabase start",
      "service dev",
      "service worker:local",
      "supabase stop entered",
      "supabase stop complete",
    ]);
  });

  test("a signal before the startup boundary prevents Supabase, Web, and worker launch", async () => {
    const directory = await temporaryDirectory("popcorn early signal ");
    const environmentFile = path.join(directory, ".env.local");
    await writeFile(environmentFile, localEnvironment());
    const firstBoundary = deferred();
    const signals = new EventEmitter();
    const events: string[] = [];
    const { createPopcornLauncher, runLauncherCommand } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile, repositoryRoot: directory, controlChannel: memoryControlChannel(),
      runCommand: async (_command: string, args: string[]) => { events.push(args.join(" ")); },
      spawnService: (_command: string, args: string[]) => { events.push(args.join(" ")); return longRunningChild(); },
      waitForReady: async () => {}, openBrowser: async () => {},
    });
    const originalStart = launcher.start;
    launcher.start = async () => { await firstBoundary.promise; await originalStart(); };
    const pending = runLauncherCommand({ action: "start", launcher, processRef: signals });
    signals.emit("SIGTERM");
    firstBoundary.resolve();
    await pending;
    expect(events).toEqual(["exec supabase stop"]);
  });

  test("SIGTERM requests the launcher cleanup path", async () => {
    const signals = new EventEmitter();
    const events: string[] = [];
    const { runLauncherCommand } = await launcherModule();

    await runLauncherCommand({
      action: "start",
      launcher: {
        start: async () => { events.push("start"); },
        stop: async () => { events.push("stop"); },
      },
      processRef: signals,
    });
    signals.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));

    expect(events).toEqual(["start", "stop"]);
  });

  test("waits for a pending Supabase start before signal cleanup and never spawns Web or worker", async () => {
    const directory = await temporaryDirectory("popcorn pending supabase signal ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(environmentFile, localEnvironment());
    const startEntered = deferred();
    const startCanFinish = deferred();
    const signals = new EventEmitter();
    const events: string[] = [];
    const { createPopcornLauncher, runLauncherCommand } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => {
        if (args.at(-1) === "start") {
          events.push("supabase start");
          startEntered.resolve();
          await startCanFinish.promise;
          events.push("supabase start complete");
          return;
        }
        events.push("supabase stop");
      },
      spawnService: (_command: string, args: string[]) => {
        events.push(`service ${args.join(" ")}`);
        return longRunningChild();
      },
      waitForReady: async () => {},
      openBrowser: async () => { events.push("browser"); },
    });

    const pending = runLauncherCommand({ action: "start", launcher, processRef: signals });
    await startEntered.promise;
    signals.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));
    expect(events).toEqual(["supabase start"]);

    startCanFinish.resolve();
    await pending;

    expect(events).toEqual(["supabase start", "supabase start complete", "supabase stop"]);
    await expect(readFile(stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("discards stale state without killing another process and still performs an ordinary Supabase stop", async () => {
    const directory = await temporaryDirectory("popcorn stale state ");
    const stateFile = path.join(directory, "runtime-state.json");
    await writeFile(stateFile, JSON.stringify({ repositoryRoot: directory, port: 1 }));
    const events: string[] = [];
    const unrelated = longRunningChild();
    const controlChannel = memoryControlChannel();
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      repositoryRoot: directory,
      stateFile,
      runCommand: async (_command: string, args: string[]) => { events.push(args.join(" ")); },
      controlChannel,
    });

    await launcher.stop();

    expect(unrelated.exitCode).toBeNull();
    expect(events).toEqual(["exec supabase stop"]);
    await expect(readFile(stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    unrelated.kill("SIGTERM");
    await once(unrelated, "exit");
  });

  test("bounds stop against an unrelated non-responsive TCP server without terminating it", async () => {
    const directory = await temporaryDirectory("popcorn bounded stale control ");
    const stateFile = path.join(directory, "runtime-state.json");
    const sockets = new Set<Socket>();
    const unrelatedServer = createServer({ allowHalfOpen: true }, (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
      socket.resume();
    });
    const port = await listenOnLoopback(unrelatedServer);
    await writeFile(stateFile, JSON.stringify({ repositoryRoot: directory, port }));
    const events: string[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      repositoryRoot: directory,
      stateFile,
      controlTimeoutMs: 50,
      runCommand: async (_command: string, args: string[]) => { events.push(args.join(" ")); },
    });

    try {
      const startedAt = Date.now();
      await launcher.stop();
      const elapsedMs = Date.now() - startedAt;

      expect(elapsedMs).toBeLessThan(1_000);
      expect(unrelatedServer.listening).toBe(true);
      expect(events).toEqual(["exec supabase stop"]);
      await expect(readFile(stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await closeServer(unrelatedServer, sockets);
    }
  });

  test("bounds default readiness failure and cleans up without opening the browser", async () => {
    const directory = await temporaryDirectory("popcorn bounded readiness ");
    const environmentFile = path.join(directory, ".env.local");
    const stateFile = path.join(directory, "runtime-state.json");
    const unusedPortServer = createServer();
    const unusedPort = await listenOnLoopback(unusedPortServer);
    await closeServer(unusedPortServer);
    await writeFile(environmentFile, localEnvironment({ APP_URL: `http://127.0.0.1:${unusedPort}` }));
    const events: string[] = [];
    const children: ReturnType<typeof longRunningChild>[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      readyTimeoutMs: 75,
      readyIntervalMs: 10,
      runCommand: async (_command: string, args: string[]) => { events.push(`command ${args.join(" ")}`); },
      spawnService: (_command: string, args: string[]) => {
        events.push(`service ${args.join(" ")}`);
        const child = longRunningChild();
        children.push(child);
        return child;
      },
      openBrowser: async () => { events.push("browser"); },
    });

    const pendingStart = launcher.start();
    const result = await Promise.race([
      pendingStart.then(() => "resolved", () => "rejected"),
      new Promise<"timed out">((resolve) => setTimeout(() => resolve("timed out"), 800)),
    ]);
    if (result === "timed out") {
      await launcher.stop();
      await pendingStart.catch(() => {});
    }

    expect(result).toBe("rejected");
    expect(events).toEqual([
      "command exec supabase start",
      "service dev",
      "service worker:local",
      "command exec supabase stop",
    ]);
    expect(children.every((child) => child.exitCode === 0)).toBe(true);
    await expect(readFile(stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("the real stop CLI suppresses child credential output while invoking ordinary Supabase stop", async () => {
    const directory = await temporaryDirectory("popcorn credential safe stop ");
    const binDirectory = path.join(directory, "bin");
    const commandLog = path.join(directory, "pnpm.log");
    const credentialSentinel = "SUPABASE_SERVICE_ROLE_KEY=do-not-print-this";
    await mkdir(binDirectory);
    await writeFile(path.join(binDirectory, "pnpm"), [
      "#!/bin/sh",
      `printf '%s\\n' '${credentialSentinel}'`,
      "printf '%s\\n' \"$*\" >> \"$POPCORN_TEST_COMMAND_LOG\"",
      "exit 0",
      "",
    ].join("\n"));
    await chmod(path.join(binDirectory, "pnpm"), 0o755);
    const environment = {
      ...process.env,
      PATH: `${binDirectory}${path.delimiter}${process.env.PATH}`,
      POPCORN_TEST_COMMAND_LOG: commandLog,
    };

    const result = await runCaptured(
      process.execPath,
      [path.join(root, "scripts/popcorn-local.mjs"), "stop"],
      { cwd: directory, env: environment },
    );

    expect(result.exitCode).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(credentialSentinel);
    expect((await readFile(commandLog, "utf8")).trim()).toBe("exec supabase stop");
  });

  test("uses wrappers from their own cloned directory, including spaces", async () => {
    const directory = await temporaryDirectory("Popcorn cloned directory ");
    const binDirectory = path.join(directory, "bin");
    const logFile = path.join(directory, "pnpm.log");
    await mkdir(binDirectory);
    await writeFile(path.join(directory, "Start Popcorn.command"), await readFile(path.join(root, "Start Popcorn.command"), "utf8"));
    await writeFile(path.join(directory, "Stop Popcorn.command"), await readFile(path.join(root, "Stop Popcorn.command"), "utf8"));
    await writeFile(path.join(directory, "bin-placeholder"), "");
    await writeFile(path.join(binDirectory, "pnpm"), `#!/bin/sh\nprintf '%s|%s\\n' \"$PWD\" \"$*\" >> \"${logFile}\"\n`);
    await chmod(path.join(directory, "Start Popcorn.command"), 0o755);
    await chmod(path.join(directory, "Stop Popcorn.command"), 0o755);
    await chmod(path.join(binDirectory, "pnpm"), 0o755);

    const environment = { ...process.env, PATH: `${binDirectory}${path.delimiter}${process.env.PATH}` };
    expect(await run(path.join(directory, "Start Popcorn.command"), [], environment)).toBe(0);
    expect(await run(path.join(directory, "Stop Popcorn.command"), [], environment)).toBe(0);
    expect((await readFile(logFile, "utf8")).trim().split("\n")).toEqual([
      `${directory}|popcorn:start`,
      `${directory}|popcorn:stop`,
    ]);
  });
});
