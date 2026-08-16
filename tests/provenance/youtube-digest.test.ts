import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function isIgnored(path: string): boolean {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--no-index", path], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status === 0;
}

test("pins and attributes the YouTube Digest intake", () => {
  const upstream = readFileSync("extension/UPSTREAM.md", "utf8");
  const license = readFileSync("third_party/youtube-digest/LICENSE", "utf8");
  expect(upstream).toContain("d03e1f61e017b032159ffd1821cac6e7693ce0c7");
  expect(upstream).toContain("content.js");
  expect(upstream).toContain("sidepanel.js");
  expect(license).toContain("MIT License");
  expect(license).toContain("Copyright (c) 2026 Zara Zhang");
});

test("keeps local environment files out of source control while allowing the template", () => {
  expect(isIgnored(".env")).toBe(true);
  expect(isIgnored(".env.local")).toBe(true);
  expect(isIgnored(".env.example")).toBe(false);
});

test("marks the vendored provider and export behaviors as downstream adaptation work", () => {
  const upstream = readFileSync("extension/UPSTREAM.md", "utf8");

  expect(upstream).toContain("This intake is non-shippable until adapted.");
  expect(upstream).toContain(
    "Batch A Task 3 replaces extension Provider calls in `extension/background.js` with Popcorn server/durable job APIs.",
  );
  expect(upstream).toContain(
    "Batch A Tasks 1 and 3 remove client provider-key storage and direct provider hosts from `extension/background.js` and its supporting settings/options files.",
  );
  expect(upstream).toContain(
    "Batch A Task 1 removes Supadata and DeepSeek direct Provider host permissions from `extension/manifest.json`, retaining only approved YouTube plus Popcorn API/auth hosts.",
  );
  expect(upstream).toContain(
    "Batch A Task 3 removes export behavior from `extension/sidepanel.js`; it is out of first-release scope.",
  );
});

test("uses webpack for the portable production build", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  expect(packageJson.scripts.build).toBe("next build --webpack");
});

test("runs the contract suite from the canonical root directory", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

  expect(packageJson.scripts["test:contract"]).toBe(
    "vitest run tests/contract",
  );
});
