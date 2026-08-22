import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import vm from "node:vm";

import {
  buildLocalExtension,
  buildLocalExtensionFromEnvironment,
  parseRuntimeOrigin,
} from "../../scripts/build-local-extension.mjs";

const APP_URL = "http://127.0.0.1:3000";
const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY = "public-anon";
const EXTENSION_ID = "meocnghfgmmcnnjiihpcgjnaameioddp";
const EXPECTED_FILES = [
  "auth.js",
  "background.js",
  "content.js",
  "icons/icon128.png",
  "icons/icon16.png",
  "icons/icon48.png",
  "manifest.json",
  "options.css",
  "options.html",
  "options.js",
  "prompts/analysis.md",
  "prompts/explain.md",
  "prompts/note-cleanup.md",
  "prompts/translation.md",
  "runtime-config.js",
  "settings.js",
  "sidepanel.css",
  "sidepanel.html",
  "sidepanel.js",
  "sync-queue.js",
];

async function outputDirectory(): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "popcorn-extension-test-"));
  return join(parent, "unpacked");
}

async function listFiles(directory: string, base = directory): Promise<string[]> {
  const entries = await readdir(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    if ((await stat(path)).isDirectory()) files.push(...await listFiles(path, base));
    else files.push(relative(base, path));
  }
  return files.sort();
}

async function fingerprint(directory: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const file of await listFiles(directory)) {
    result[file] = createHash("sha256").update(await readFile(join(directory, file))).digest("hex");
  }
  return result;
}

function extensionIdFromKey(key: string): string {
  const digest = createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16);
  return [...digest]
    .flatMap((byte) => [byte >> 4, byte & 15])
    .map((nibble) => String.fromCharCode(97 + nibble))
    .join("");
}

async function build(directory: string): Promise<void> {
  await buildLocalExtension({
    appUrl: APP_URL,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: ANON_KEY,
    outputDirectory: directory,
  });
}

test("generates only the explicit runtime allowlist with exact hosts and the stable public identity", async () => {
  const directory = await outputDirectory();
  await build(directory);

  expect(await listFiles(directory)).toEqual(EXPECTED_FILES);
  const sourceManifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  expect(manifest.host_permissions).toEqual([
    "https://www.youtube.com/*",
    "http://127.0.0.1:3000/*",
    "http://127.0.0.1:54321/*",
  ]);
  expect(manifest.permissions).toEqual(["sidePanel", "storage", "tabs", "scripting", "alarms"]);
  expect(manifest.key).toBe(sourceManifest.key);
  expect(extensionIdFromKey(manifest.key)).toBe(EXTENSION_ID);
  expect(await listFiles(directory)).not.toContain("runtime-config.template.js");
  expect(await listFiles(directory)).not.toContain("UPSTREAM.md");
});

test("writes only the exact public runtime configuration and ignores private environment values", async () => {
  const directory = await outputDirectory();
  await buildLocalExtensionFromEnvironment({
    outputDirectory: directory,
    environment: {
      APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-poison",
      SUPADATA_API_KEY: "supadata-poison",
      INTERNAL_JOB_SECRET: "job-poison",
      MODEL_GATEWAY_API_KEY: "gateway-poison",
      ACCOUNT_PASSWORD: "password-poison",
      ACCESS_TOKEN: "access-poison",
      REFRESH_TOKEN: "refresh-poison",
    },
  });

  const runtimeSource = await readFile(join(directory, "runtime-config.js"), "utf8");
  const context = vm.createContext({});
  vm.runInContext(runtimeSource, context);
  expect(JSON.parse(JSON.stringify(context.POPCORN_RUNTIME_CONFIG))).toEqual({
    appUrl: APP_URL,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: ANON_KEY,
  });
  expect(runtimeSource).toContain(ANON_KEY);
  expect(runtimeSource).not.toMatch(
    /service-role-poison|supadata-poison|job-poison|gateway-poison|password-poison|access-poison|refresh-poison/,
  );
  expect(runtimeSource).not.toContain(process.cwd());
});

test("rebuilds deterministically and removes files outside the runtime allowlist", async () => {
  const directory = await outputDirectory();
  await build(directory);
  const first = await fingerprint(directory);
  await writeFile(join(directory, "credentials.txt"), "must disappear", "utf8");

  await build(directory);

  expect(await fingerprint(directory)).toEqual(first);
  expect(await listFiles(directory)).toEqual(EXPECTED_FILES);
});

test.each([
  ["remote plain HTTP", "http://example.com"],
  ["wildcard listener", "http://0.0.0.0:3000"],
  ["credentials", "https://user:pass@example.com"],
  ["query", "https://example.com?token=x"],
  ["fragment", "https://example.com/#fragment"],
  ["non-root path", "https://example.com/v1"],
  ["unsupported protocol", "file:///tmp/popcorn"],
])("rejects %s runtime origins", (_label, value) => {
  expect(() => parseRuntimeOrigin(value)).toThrow("Invalid extension runtime origin.");
});

test.each([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
  "https://popcorn.example",
])("accepts an exact HTTPS or loopback HTTP origin: %s", (value) => {
  expect(parseRuntimeOrigin(value)).toBe(value);
});

test("loads generated runtime configuration before auth/settings and uses its exact App origin", async () => {
  const directory = await outputDirectory();
  await build(directory);
  const imported: string[] = [];
  const requests: string[] = [];
  const event = { addListener() {} };
  const session = {
    accessToken: "session-access",
    refreshToken: "session-refresh",
    accessExpiresAt: Date.now() + 60_000,
    user: { id: "user-a", email: "a@example.com" },
  };
  const storageArea = {
    async get(key: string) { return key === "popcorn_session" ? { popcorn_session: session } : {}; },
    async set() {},
    async remove() {},
    async setAccessLevel() {},
  };
  const sandbox: Record<string, unknown> = {
    URL,
    console,
    setTimeout,
    clearTimeout,
    fetch: async (url: string) => {
      requests.push(url);
      return { status: 200, json: async () => ({ ok: true, data: { pong: true } }) };
    },
    chrome: {
      storage: { local: storageArea, session: storageArea },
      alarms: { onAlarm: event },
      runtime: {
        id: EXTENSION_ID,
        getURL: (file: string) => `chrome-extension://${EXTENSION_ID}/${file}`,
        onMessage: event,
        onStartup: event,
        onInstalled: event,
        sendMessage: async () => {},
        openOptionsPage() {},
      },
      action: { onClicked: event },
      sidePanel: { setOptions: async () => {}, open: async () => {}, setPanelBehavior() {} },
      tabs: { onUpdated: event, onActivated: event, query: async () => [], get: async () => ({}) },
      scripting: { executeScript: async () => [] },
    },
  };
  const context = vm.createContext(sandbox);
  context.globalThis = context;
  context.importScripts = (...files: string[]) => {
    for (const file of files) {
      imported.push(file);
      vm.runInContext(readFileSync(join(directory, file), "utf8"), context, { filename: file });
    }
  };

  vm.runInContext(await readFile(join(directory, "background.js"), "utf8"), context, { filename: "background.js" });
  const helpers = context.__POPCORN_CLOUD_TESTING__ as { apiFetch(path: string): Promise<unknown> };
  await helpers.apiFetch("/api/v1/ping");

  expect(imported).toEqual(["runtime-config.js", "settings.js", "auth.js", "sync-queue.js"]);
  expect(requests).toEqual([`${APP_URL}/api/v1/ping`]);
  expect(await readFile("extension/background.js", "utf8")).not.toMatch(
    /https:\/\/app\.popcorn\.local|https:\/\/project\.supabase\.co/,
  );
});

test("keeps exact local values out of the source template and source runtime files", async () => {
  const sourceFiles = [
    "extension/runtime-config.template.js",
    "extension/background.js",
    "extension/manifest.json",
  ];
  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    expect(source).not.toContain(APP_URL);
    expect(source).not.toContain(SUPABASE_URL);
    expect(source).not.toContain(ANON_KEY);
  }
});
