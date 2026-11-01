import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { LEGACY_LEARNING_CARD_UPGRADE_VERSION, LegacyUpgradeError, LegacyUpgradeManifestSchema, LegacyUpgradeOutcomeSchema, LegacyUpgradeReasonSchema, LegacyUpgradeTargetSchema,
  type LegacyUpgradeOutcome, type LegacyUpgradePlanPage, type LegacyUpgradeRequest, type LegacyUpgradeTarget } from "../src/server/contracts/legacy-learning-card-upgrade";

type Options = { ownerId: string; apply: boolean; planPath?: string };
type Runtime = { plan(ownerId: string, page: { limit: number; afterSenseId?: string }): Promise<LegacyUpgradePlanPage>; upgrade(ownerId: string, request: LegacyUpgradeRequest): Promise<LegacyUpgradeOutcome> };
type Dependencies = { runtime: Runtime; now?: () => string; id?: () => string };
type SafeItem = { senseId: string; requestId?: string; status: string; reason?: string; code?: string; origin?: string };
type Report = { ok: boolean; mode?: "dry_run" | "apply"; ownerId?: string; counts?: Record<string, number>; items?: SafeItem[]; planWritten?: boolean; error?: { code: string } };
class CommandError extends Error { constructor(readonly code: string) { super(code); } }
const Id = z.string().uuid();

export function parseLegacyLearningCardUpgradeArguments(args: readonly string[]): Options {
  let ownerId: string | undefined, planPath: string | undefined, apply = false, dryRun = false;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i]!;
    if (seen.has(key)) throw new CommandError("INVALID_ARGUMENTS");
    seen.add(key);
    if (key === "--apply") apply = true;
    else if (key === "--dry-run") dryRun = true;
    else if (key === "--user" || key === "--plan") {
      const value = args[++i];
      if (!value?.trim() || value.startsWith("--")) throw new CommandError("INVALID_ARGUMENTS");
      if (key === "--user") ownerId = value; else planPath = value;
    } else throw new CommandError("INVALID_ARGUMENTS");
  }
  if (!Id.safeParse(ownerId).success || (apply && (dryRun || !planPath))) throw new CommandError("INVALID_ARGUMENTS");
  return { ownerId: ownerId!, apply, ...(planPath ? { planPath } : {}) };
}

async function readManifest(path: string) {
  let file;
  try { file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { throw new CommandError((error as NodeJS.ErrnoException).code === "ELOOP" ? "UNSAFE_PLAN_FILE" : "INVALID_MANIFEST"); }
  try {
    const metadata = await file.stat();
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) throw new CommandError("UNSAFE_PLAN_FILE");
    let input: unknown;
    try { input = JSON.parse(await file.readFile("utf8")); } catch { throw new CommandError("INVALID_MANIFEST"); }
    const parsed = LegacyUpgradeManifestSchema.safeParse(input);
    if (!parsed.success) throw new CommandError("INVALID_MANIFEST");
    return parsed.data;
  } finally { await file.close(); }
}

async function writeManifest(path: string, input: unknown) {
  let file;
  try { file = await open(path, "wx", 0o600); }
  catch (error) { throw new CommandError((error as NodeJS.ErrnoException).code === "EEXIST" ? "PLAN_EXISTS" : "PLAN_WRITE_FAILED"); }
  try { await file.writeFile(JSON.stringify(input, null, 2) + "\n"); await file.sync(); }
  finally { await file.close(); }
}

/** CLI outcomes intentionally exclude the complete private card in service receipts. */
export async function runLegacyLearningCardUpgradeCommand(options: Options, dependencies: Dependencies): Promise<{ exitCode: number; report: Report }> {
  try {
    if (!Id.safeParse(options.ownerId).success || (options.apply && !options.planPath)) throw new CommandError("INVALID_ARGUMENTS");
    if (!options.apply) {
      const counts = { total: 0, eligible: 0, alreadyModern: 0, blocked: 0, existingCard: 0, sourceBased: 0 }, items: SafeItem[] = [], targets: LegacyUpgradeTarget[] = [];
      const seen = new Set<string>(); let cursor: string | undefined;
      do {
        const page = await dependencies.runtime.plan(options.ownerId, { limit: 200, ...(cursor ? { afterSenseId: cursor } : {}) });
        if (!Array.isArray(page.items)) throw new CommandError("PAGE_PROTOCOL_ERROR");
        for (const row of page.items) {
          if (!Id.safeParse(row.senseId).success || seen.has(row.senseId)) throw new CommandError("PAGE_PROTOCOL_ERROR");
          seen.add(row.senseId); counts.total++;
          if (row.status === "eligible") {
            const parsed = LegacyUpgradeTargetSchema.safeParse(row.target);
            if (!parsed.success || parsed.data.senseId !== row.senseId) throw new CommandError("PAGE_PROTOCOL_ERROR");
            targets.push(parsed.data); counts.eligible++; counts[parsed.data.source.kind === "existing_card" ? "existingCard" : "sourceBased"]++;
            items.push({ senseId: row.senseId, status: row.status });
          } else if (row.status === "already_modern") { counts.alreadyModern++; items.push({ senseId: row.senseId, status: row.status }); }
          else if (row.status === "blocked" && LegacyUpgradeReasonSchema.safeParse(row.reason).success) {
            counts.blocked++; items.push({ senseId: row.senseId, status: row.status, reason: row.reason });
          } else throw new CommandError("PAGE_PROTOCOL_ERROR");
        }
        if (page.nextCursor !== null && (!Id.safeParse(page.nextCursor).success || !page.items.length || (cursor && page.nextCursor <= cursor))) throw new CommandError("PAGE_PROTOCOL_ERROR");
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      if (options.planPath) {
        const manifest = LegacyUpgradeManifestSchema.safeParse({ version: LEGACY_LEARNING_CARD_UPGRADE_VERSION, ownerId: options.ownerId,
          createdAt: (dependencies.now ?? (() => new Date().toISOString()))(), requests: targets.map(target => ({ ...target, requestId: (dependencies.id ?? randomUUID)() })) });
        if (!manifest.success) throw new CommandError("INVALID_MANIFEST");
        await writeManifest(options.planPath, manifest.data);
      }
      return { exitCode: 0, report: { ok: true, mode: "dry_run", ownerId: options.ownerId, counts, items, ...(options.planPath ? { planWritten: true } : {}) } };
    }
    const manifest = await readManifest(options.planPath!);
    if (manifest.ownerId !== options.ownerId) throw new CommandError("OWNER_MISMATCH");
    const counts = { requested: manifest.requests.length, appliedReceipts: 0, alreadyModern: 0, needsReview: 0, blocked: 0, failed: 0, inProgress: 0 }, items: SafeItem[] = [];
    for (const request of manifest.requests) {
      let outcome: LegacyUpgradeOutcome;
      try {
        const parsed = LegacyUpgradeOutcomeSchema.safeParse(await dependencies.runtime.upgrade(options.ownerId, request));
        if (!parsed.success || parsed.data.requestId !== request.requestId || parsed.data.senseId !== request.senseId) throw new CommandError("OUTCOME_MISMATCH");
        outcome = parsed.data;
      } catch (error) {
        if (error instanceof CommandError) throw error;
        outcome = error instanceof LegacyUpgradeError && error.code === "REQUEST_IN_PROGRESS"
          ? { status: "in_progress", senseId: request.senseId, requestId: request.requestId, retryAfterMs: 1000 }
          : { status: "failed", senseId: request.senseId, requestId: request.requestId, code: error instanceof LegacyUpgradeError ? error.code : "INTERNAL_ERROR" };
      }
      const key = { applied: "appliedReceipts", already_modern: "alreadyModern", needs_review: "needsReview", blocked: "blocked", failed: "failed", in_progress: "inProgress" }[outcome.status] as keyof typeof counts;
      counts[key]++;
      items.push({ senseId: outcome.senseId, requestId: outcome.requestId, status: outcome.status,
        ...("origin" in outcome ? { origin: outcome.origin } : {}), ...("reason" in outcome ? { reason: outcome.reason } : {}), ...("code" in outcome ? { code: outcome.code } : {}) });
    }
    const incomplete = counts.needsReview + counts.blocked + counts.failed + counts.inProgress > 0;
    return { exitCode: incomplete ? 2 : 0, report: { ok: !incomplete, mode: "apply", ownerId: options.ownerId, counts, items } };
  } catch (error) { return { exitCode: 1, report: { ok: false, error: { code: error instanceof CommandError ? error.code : "INTERNAL_ERROR" } } }; }
}

async function main(args: readonly string[]) {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write("Usage: node --env-file=<local-env> --import tsx scripts/upgrade-legacy-learning-cards.ts --user UUID [--dry-run] [--plan PATH]\nApply: same command with --apply --plan PATH --user UUID. Plans are private and never overwritten.\n"); return;
  }
  let result;
  try {
    const options = parseLegacyLearningCardUpgradeArguments(args);
    let runtime: Runtime | undefined;
    const load = async () => runtime ??= (await import("../src/server/legacy-learning-card-upgrade-runtime")).createLegacyLearningCardUpgradeRuntime();
    result = await runLegacyLearningCardUpgradeCommand(options, { runtime: {
      plan: async (owner, page) => (await load()).plan(owner, page), upgrade: async (owner, request) => (await load()).upgrade(owner, request),
    } });
  } catch (error) { result = { exitCode: 1, report: { ok: false, error: { code: error instanceof CommandError ? error.code : "INTERNAL_ERROR" } } }; }
  process.stdout.write(JSON.stringify(result.report) + "\n"); process.exitCode = result.exitCode;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) void main(process.argv.slice(2));
