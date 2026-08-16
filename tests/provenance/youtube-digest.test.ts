import { readFileSync } from "node:fs";

test("pins and attributes the YouTube Digest intake", () => {
  const upstream = readFileSync("extension/UPSTREAM.md", "utf8");
  const license = readFileSync("third_party/youtube-digest/LICENSE", "utf8");
  expect(upstream).toContain("d03e1f61e017b032159ffd1821cac6e7693ce0c7");
  expect(upstream).toContain("content.js");
  expect(upstream).toContain("sidepanel.js");
  expect(license).toContain("MIT License");
  expect(license).toContain("Copyright (c) 2026 Zara Zhang");
});
