import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseLegacyLearningCardUpgradeArguments, runLegacyLearningCardUpgradeCommand } from "../../scripts/upgrade-legacy-learning-cards";
import { LegacyUpgradeError, type LegacyUpgradeManifest, type LegacyUpgradeOutcome, type LegacyUpgradePlanRow, type LegacyUpgradeRequest } from "../../src/server/contracts/legacy-learning-card-upgrade";
import { MODERN_REVIEW_CARDS } from "../fixtures/demo/review-fixtures";

const id = (n: number) => `63000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const owner = id(1), clock = "2026-11-01T00:00:00.000Z";
const target = (sense: number, existing = false) => ({ senseId: id(sense), expectedBeforeHash: "a".repeat(64), expectedEvidenceHash: "b".repeat(64),
  source: existing ? { kind: "existing_card" as const, candidateKey: "l:save:artifact:0", artifactId: id(90), candidateIndex: 0 }
    : { kind: "source_occurrence" as const, sourceId: id(91), occurrenceId: id(92), snapshotId: id(93) } });
const card = { ...MODERN_REVIEW_CARDS["挺靠谱的"]!, meaningHere: "PERSONAL_METADATA_NEVER_PRINT" };
function fixture() {
  const applied: LegacyUpgradeRequest[] = [], pages: unknown[] = [];
  let sequence = 100;
  const runtime = {
    async plan(user: string, page: { afterSenseId?: string; limit?: number }) {
      pages.push({ user, ...page });
      const items: LegacyUpgradePlanRow[] = page.afterSenseId ? [{ status: "eligible", senseId: id(5), target: target(5, true) }]
        : [{ status: "eligible", senseId: id(2), target: target(2) }, { status: "already_modern", senseId: id(3) }, { status: "blocked", senseId: id(4), reason: "SOURCE_UNAVAILABLE" }];
      return { items, nextCursor: page.afterSenseId ? null : id(4) };
    },
    async upgrade(user: string, request: LegacyUpgradeRequest): Promise<LegacyUpgradeOutcome> {
      expect(user).toBe(owner); applied.push(structuredClone(request));
      return { status: "applied", requestId: request.requestId, senseId: request.senseId, origin: "model", card };
    },
  };
  return { runtime, applied, pages, now: () => clock, id: () => id(sequence++) };
}
let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "popcorn-upgrade-cli-")); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });
const options = (extra: string[] = []) => parseLegacyLearningCardUpgradeArguments(["--user", owner, ...extra]);
async function manifest(path: string) {
  const value: LegacyUpgradeManifest = { version: "learning-card-upgrade-v1", ownerId: owner, createdAt: clock,
    requests: [{ ...target(2), requestId: id(100) }, { ...target(5, true), requestId: id(101) }] };
  await writeFile(path, JSON.stringify(value), { mode: 0o600 }); return value;
}

describe("explicit legacy upgrade command", () => {
  it("defaults to read-only planning through every page without creating request IDs or applying", async () => {
    const f = fixture();
    const result = await runLegacyLearningCardUpgradeCommand(options(), { ...f, id: () => { throw Error("dry-run must not create apply requests"); } });
    expect(result.exitCode).toBe(0);
    expect(result.report).toMatchObject({ ok: true, mode: "dry_run", counts: { total: 4, eligible: 2, alreadyModern: 1, blocked: 1 } });
    expect(f.pages).toEqual([{ user: owner, limit: 200 }, { user: owner, limit: 200, afterSenseId: id(4) }]);
    expect(f.applied).toEqual([]);
  });
  it("creates an exclusive private manifest containing only eligible IDs/proofs and stable requests", async () => {
    const f = fixture(), path = join(dir, "plan.json");
    expect((await runLegacyLearningCardUpgradeCommand(options(["--plan", path]), f)).exitCode).toBe(0);
    const saved = JSON.parse(await readFile(path, "utf8"));
    expect(saved).toEqual({ version: "learning-card-upgrade-v1", ownerId: owner, createdAt: clock,
      requests: [{ ...target(2), requestId: id(100) }, { ...target(5, true), requestId: id(101) }] });
    expect((await stat(path)).mode & 0o077).toBe(0);
    const repeated = await runLegacyLearningCardUpgradeCommand(options(["--plan", path]), f);
    expect(repeated.report).toMatchObject({ ok: false, error: { code: "PLAN_EXISTS" } });
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(saved);
  });
  it("applies and resumes the exact saved UUIDs serially without re-planning or exposing full cards", async () => {
    const path = join(dir, "plan.json"), saved = await manifest(path), f = fixture();
    const deps = { ...f, id: () => { throw Error("apply must not mint IDs"); } };
    const first = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), deps);
    const second = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), deps);
    expect(first.exitCode).toBe(0); expect(second.exitCode).toBe(0);
    expect(f.applied).toEqual([...saved.requests, ...saved.requests]); expect(f.pages).toEqual([]);
    expect(first.report).toMatchObject({ counts: { requested: 2, appliedReceipts: 2 } });
    expect(JSON.stringify([first.report, second.report])).not.toContain(card.meaningHere);
    expect(JSON.stringify(first.report)).not.toContain('"card"');
  });
  it("rejects another owner's manifest before mutation", async () => {
    const path = join(dir, "plan.json"), saved = await manifest(path), f = fixture();
    await writeFile(path, JSON.stringify({ ...saved, ownerId: id(999) }));
    const result = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f);
    expect(result.report).toMatchObject({ ok: false, error: { code: "OWNER_MISMATCH" } }); expect(f.applied).toEqual([]);
  });
  it("keeps at most one saved request in flight", async () => {
    const path = join(dir, "plan.json"), f = fixture(); await manifest(path);
    let active = 0, maximum = 0;
    f.runtime.upgrade = async (_user, request) => {
      maximum = Math.max(maximum, ++active);
      await Promise.resolve();
      active--;
      return { status: "already_modern", requestId: request.requestId, senseId: request.senseId };
    };
    const result = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f);
    expect(result.exitCode).toBe(0); expect(maximum).toBe(1); expect(active).toBe(0);
  });
  it("rejects world-readable and symlink plans before mutation", async () => {
    const path = join(dir, "plan.json"), link = join(dir, "link.json"), f = fixture(); await manifest(path);
    await chmod(path, 0o644);
    expect((await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f)).report).toMatchObject({ error: { code: "UNSAFE_PLAN_FILE" } });
    await chmod(path, 0o600); await symlink(path, link);
    expect((await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", link]), f)).report).toMatchObject({ error: { code: "UNSAFE_PLAN_FILE" } });
    expect(f.applied).toEqual([]);
  });
  it("sanitizes invalid manifests without echoing their raw content", async () => {
    const path = join(dir, "plan.json"), f = fixture();
    await writeFile(path, '{"apiKey":"PRIVATE_INPUT_NEVER_PRINT"', { mode: 0o600 });
    const result = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f);
    expect(result.report).toMatchObject({ error: { code: "INVALID_MANIFEST" } });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_INPUT_NEVER_PRINT"); expect(f.applied).toEqual([]);
  });
  it("reports incomplete outcomes and safe errors without automatically retrying requests", async () => {
    const path = join(dir, "plan.json"), saved = await manifest(path), f = fixture();
    f.runtime.upgrade = async (_user, request) => { f.applied.push(request); if (request.senseId === id(2)) throw new LegacyUpgradeError("PROVIDER_RATE_LIMITED", true); throw Error("MODEL_KEY_NEVER_PRINT"); };
    const result = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f);
    expect(result.exitCode).toBe(2); expect(result.report).toMatchObject({ counts: { failed: 2 } });
    expect(f.applied).toEqual(saved.requests); expect(JSON.stringify(result)).not.toContain("MODEL_KEY_NEVER_PRINT");
    expect(JSON.stringify(result)).toContain("PROVIDER_RATE_LIMITED");
  });
  it("never prints a needs-review classification's complete private card", async () => {
    const path = join(dir, "plan.json"), f = fixture(); await manifest(path);
    f.runtime.upgrade = async (_user, request) => ({ status: "needs_review", requestId: request.requestId, senseId: request.senseId, reason: "NOT_EXPRESSION", card: { ...card, suitability: "not_expression", notExpressionReasonEn: "A basic context-bound word." } });
    const result = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f);
    expect(result.exitCode).toBe(2); expect(result.report).toMatchObject({ counts: { needsReview: 2 } });
    expect(JSON.stringify(result)).not.toContain(card.meaningHere);
  });
  it("rejects a mismatched response identity rather than attributing it to another sense", async () => {
    const path = join(dir, "plan.json"), f = fixture(); await manifest(path);
    f.runtime.upgrade = async (_user, request) => ({ status: "already_modern", requestId: request.requestId, senseId: id(888) });
    const result = await runLegacyLearningCardUpgradeCommand(options(["--apply", "--plan", path]), f);
    expect(result.exitCode).toBe(1); expect(result.report).toMatchObject({ error: { code: "OUTCOME_MISMATCH" } });
  });
  it("rejects a non-progressing pagination cursor without writing an incomplete manifest", async () => {
    const path = join(dir, "plan.json"), f = fixture();
    f.runtime.plan = async () => ({ items: [], nextCursor: id(4) });
    const result = await runLegacyLearningCardUpgradeCommand(options(["--plan", path]), f);
    expect(result.report).toMatchObject({ error: { code: "PAGE_PROTOCOL_ERROR" } });
    await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("has no total item cap while each planning query stays at200", async () => {
    const f = fixture(); let page = 0;
    f.runtime.plan = async (_user, input) => { expect(input.limit).toBe(200); const count = page < 2 ? 200 : 5, offset = page++ * 200;
      return { items: Array.from({ length: count }, (_, n) => ({ status: "eligible" as const, senseId: id(offset + n + 10), target: target(offset + n + 10) })), nextCursor: page < 3 ? id(offset + count + 9) : null }; };
    const result = await runLegacyLearningCardUpgradeCommand(options(), f);
    expect(result.report).toMatchObject({ counts: { total: 405, eligible: 405 } }); expect(page).toBe(3); expect(f.applied).toEqual([]);
  });
  it.each([["--user", "all"], ["--user", owner, "--apply"], ["--user", owner, "--user", owner], ["--user", owner, "--api-key", "PRIVATE_ARGUMENT_NEVER_PRINT"], ["--user", owner, "--apply", "--dry-run", "--plan", "x"]])("rejects unsafe command arguments %j", (...args: string[]) => {
    expect(() => parseLegacyLearningCardUpgradeArguments(args)).toThrow("INVALID_ARGUMENTS");
  });
});
