import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, expect, test } from "vitest";

const ARCHIVE = "dist/popcorn-extension.zip";
const CHECKSUM = "dist/popcorn-extension.sha256";
const EXPECTED_ENTRIES = [
  "LICENSE",
  "UPSTREAM.md",
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
  "third_party/youtube-digest/LICENSE",
].sort();

const publicEnvironment = {
  ...process.env,
  APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-anon-key",
};
const temporaryDirectories: string[] = [];

async function temporaryDirectory(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: "utf8",
  });
}

function packageExtension() {
  return run("bash", ["scripts/package-extension.sh"], { env: publicEnvironment });
}

function checkArchive(archive: string) {
  return run("bash", ["scripts/check-extension-release.sh", archive]);
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function archiveEntries(archive: string) {
  const result = run("unzip", ["-Z1", archive]);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim().split("\n").filter(Boolean).sort();
}

async function makeTamperedArchive(
  mutate: (directory: string) => Promise<void>,
): Promise<string> {
  const directory = await temporaryDirectory("popcorn-release-tamper-");
  const extracted = join(directory, "archive");
  const unpack = run("unzip", ["-q", ARCHIVE, "-d", extracted]);
  expect(unpack.status, unpack.stderr).toBe(0);
  await mutate(extracted);

  const archive = join(directory, "popcorn-extension.zip");
  const zipped = run("zip", ["-X", "-q", archive, ...EXPECTED_ENTRIES], { cwd: extracted });
  expect(zipped.status, zipped.stderr).toBe(0);
  const digest = sha256(await readFile(archive));
  await writeFile(
    join(directory, "popcorn-extension.sha256"),
    `${digest}  ${basename(archive)}\n`,
    "utf8",
  );
  return archive;
}

test("packages only the loadable extension release allowlist and records its checksum", async () => {
  const packaged = packageExtension();
  expect(packaged.status, `${packaged.stdout}\n${packaged.stderr}`).toBe(0);

  expect(await archiveEntries(ARCHIVE)).toEqual(EXPECTED_ENTRIES);
  const archive = await readFile(ARCHIVE);
  expect(await readFile(CHECKSUM, "utf8")).toBe(
    `${sha256(archive)}  popcorn-extension.zip\n`,
  );
  expect(checkArchive(ARCHIVE).status).toBe(0);
});

test("produces the same archive checksum from identical public inputs", async () => {
  const firstPackage = packageExtension();
  expect(firstPackage.status, `${firstPackage.stdout}\n${firstPackage.stderr}`).toBe(0);
  const first = sha256(await readFile(ARCHIVE));

  const secondPackage = packageExtension();
  expect(secondPackage.status, `${secondPackage.stdout}\n${secondPackage.stderr}`).toBe(0);
  const second = sha256(await readFile(ARCHIVE));

  expect(second).toBe(first);
});

test("rejects an archive whose bytes no longer match its recorded checksum", async () => {
  expect(packageExtension().status).toBe(0);
  const directory = await temporaryDirectory("popcorn-release-checksum-");
  const archive = join(directory, "popcorn-extension.zip");
  const original = await readFile(ARCHIVE);
  await writeFile(archive, Buffer.concat([original, Buffer.from("tampered")]));
  await writeFile(
    join(directory, "popcorn-extension.sha256"),
    await readFile(CHECKSUM),
  );

  const checked = checkArchive(archive);
  expect(checked.status).not.toBe(0);
  expect(checked.stderr).toContain("checksum");
});

test("rejects a direct model Provider host even with a matching checksum", async () => {
  expect(packageExtension().status).toBe(0);
  const archive = await makeTamperedArchive(async (directory) => {
    const path = join(directory, "manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.host_permissions.push("https://api.openai.com/*");
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });

  const checked = checkArchive(archive);
  expect(checked.status).not.toBe(0);
  expect(checked.stderr).toContain("host_permissions");
});

test("rejects a private credential embedded in an otherwise allowlisted runtime file", async () => {
  expect(packageExtension().status).toBe(0);
  const archive = await makeTamperedArchive(async (directory) => {
    const path = join(directory, "background.js");
    await writeFile(
      path,
      `${await readFile(path, "utf8")}\nconst poison = {"apiKey":"delivery-poison-secret-value"};\n`,
      "utf8",
    );
  });

  const checked = checkArchive(archive);
  expect(checked.status).not.toBe(0);
  expect(checked.stderr).toMatch(/credential|secret/i);
});

test("rejects an unexpected private archive entry", async () => {
  expect(packageExtension().status).toBe(0);
  const directory = await temporaryDirectory("popcorn-release-paths-");
  const extracted = join(directory, "archive");
  expect(run("unzip", ["-q", ARCHIVE, "-d", extracted]).status).toBe(0);
  await writeFile(join(extracted, ".env.local"), "MODEL_GATEWAY_API_KEY=poison\n", "utf8");
  const archive = join(directory, "popcorn-extension.zip");
  const zipped = run(
    "zip",
    ["-X", "-q", archive, ...EXPECTED_ENTRIES, ".env.local"],
    { cwd: extracted },
  );
  expect(zipped.status, zipped.stderr).toBe(0);
  await writeFile(
    join(directory, "popcorn-extension.sha256"),
    `${sha256(await readFile(archive))}  ${basename(archive)}\n`,
    "utf8",
  );

  const checked = checkArchive(archive);
  expect(checked.status).not.toBe(0);
  expect(checked.stderr).toMatch(/unexpected|private path/i);
});

test("rejects an allowlisted archive entry stored as a symbolic link", async () => {
  expect(packageExtension().status).toBe(0);
  const directory = await temporaryDirectory("popcorn-release-symlink-");
  const extracted = join(directory, "archive");
  expect(run("unzip", ["-q", ARCHIVE, "-d", extracted]).status).toBe(0);
  await rm(join(extracted, "LICENSE"));
  await symlink("background.js", join(extracted, "LICENSE"));
  const archive = join(directory, "popcorn-extension.zip");
  const zipped = run(
    "zip",
    ["-X", "-y", "-q", archive, ...EXPECTED_ENTRIES],
    { cwd: extracted },
  );
  expect(zipped.status, zipped.stderr).toBe(0);
  await writeFile(
    join(directory, "popcorn-extension.sha256"),
    `${sha256(await readFile(archive))}  ${basename(archive)}\n`,
    "utf8",
  );

  const checked = checkArchive(archive);
  expect(checked.status).not.toBe(0);
  expect(checked.stderr).toContain("symbolic link");
});
