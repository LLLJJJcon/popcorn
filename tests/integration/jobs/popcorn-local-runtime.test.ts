import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn as spawnChild } from "node:child_process";
import { EventEmitter } from "node:events";
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
  let handler: ((message: string) => Promise<string>) | undefined;
  return {
    listen: async (nextHandler: (message: string) => Promise<string>) => {
      handler = nextHandler;
      return {
        port: 3011,
        server: { close: () => { handler = undefined; } },
      };
    },
    request: async (_port: number, message: string) => handler ? handler(message) : null,
  };
}

async function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  const child = spawnChild(command, args, { env: environment, stdio: "ignore" });
  const [exitCode] = await once(child, "exit") as [number | null];
  return exitCode ?? 1;
}

describe("Popcorn local launcher", () => {
  test("rejects missing local fields before it starts any service", async () => {
    const directory = await temporaryDirectory("popcorn missing environment ");
    const environmentFile = path.join(directory, ".env.local");
    await writeFile(environmentFile, localEnvironment({ APP_URL: "", SUPADATA_API_KEY: "" }));
    const events: string[] = [];
    const { createPopcornLauncher } = await launcherModule();
    const launcher = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      runCommand: async () => events.push("command"),
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
      runCommand: async (_command: string, args: string[]) => events.push(`command ${args.join(" ")}`),
      spawnService: (_command: string, args: string[]) => {
        events.push(`service ${args.join(" ")}`);
        const child = longRunningChild();
        children.push(child);
        return child;
      },
      waitForReady: async (url: string) => events.push(`ready ${url}`),
      openBrowser: async (url: string) => events.push(`browser ${url}`),
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
      runCommand: async (_command: string, args: string[]) => firstEvents.push(args.join(" ")),
      spawnService: longRunningChild,
      waitForReady: async () => {},
      openBrowser: async () => {},
      controlChannel,
    });
    const second = createPopcornLauncher({
      environmentFile,
      repositoryRoot: directory,
      stateFile,
      runCommand: async () => firstEvents.push("unexpected command"),
      controlChannel,
    });

    await first.start();
    await expect(second.start()).rejects.toThrow("Popcorn is already running for this repository");
    expect(firstEvents).toEqual(["exec supabase start"]);

    await second.stop();
    expect(firstEvents).toEqual(["exec supabase start", "exec supabase stop"]);
  });

  test("SIGTERM requests the launcher cleanup path", async () => {
    const signals = new EventEmitter();
    const events: string[] = [];
    const { runLauncherCommand } = await launcherModule();

    await runLauncherCommand({
      action: "start",
      launcher: {
        start: async () => events.push("start"),
        stop: async () => events.push("stop"),
      },
      processRef: signals,
    });
    signals.emit("SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));

    expect(events).toEqual(["start", "stop"]);
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
      runCommand: async (_command: string, args: string[]) => events.push(args.join(" ")),
      controlChannel,
    });

    await launcher.stop();

    expect(unrelated.exitCode).toBeNull();
    expect(events).toEqual(["exec supabase stop"]);
    await expect(readFile(stateFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    unrelated.kill("SIGTERM");
    await once(unrelated, "exit");
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
