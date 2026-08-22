import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/types/database.generated";
import artifacts from "../tests/fixtures/demo/generated-artifacts.json";
import transcript from "../tests/fixtures/demo/transcript.zh-CN.json";
import { DEMO_VIDEO } from "../tests/fixtures/demo/youtube-video";

export const DEMO_TABLES = [
  "video_sources",
  "video_snapshots",
  "transcript_segments",
  "saved_items",
  "generated_artifacts",
  "expression_senses",
  "expression_occurrences",
  "user_expressions",
  "practice_tasks",
  "attempts",
  "mastery_events",
  "review_tasks",
] as const;

export type DemoTable = typeof DEMO_TABLES[number];
export type DemoSeedRow = Readonly<{ id: string; user_id: string; [key: string]: unknown }>;
export type DemoAccount = Readonly<{ id: string; email: string }>;

export type DemoSeedRepository = {
  findAccounts(selector: string): Promise<readonly DemoAccount[]>;
  writeOwned(input: {
    readonly ownerId: string;
    readonly table: DemoTable;
    readonly rows: readonly DemoSeedRow[];
    readonly insertOnly?: boolean;
  }): Promise<void>;
  readOwned(input: {
    readonly ownerId: string;
    readonly table: DemoTable;
    readonly ids: readonly string[];
  }): Promise<readonly DemoSeedRow[]>;
};

export type DemoSeedPlan = {
  readonly tables: Readonly<Record<DemoTable, readonly DemoSeedRow[]>>;
  readonly completedReviewPlaceholders: readonly DemoSeedRow[];
};

const FIXED_AT = DEMO_VIDEO.acquiredAt;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DemoSeedErrorCategory =
  | "invalid_arguments"
  | "local_configuration"
  | "account_lookup"
  | "database_write"
  | "database_verification";

class DemoSeedCliError extends Error {
  constructor(readonly category: DemoSeedErrorCategory, message: string) {
    super(message);
    this.name = "DemoSeedCliError";
  }
}

const CLI_ERROR_LABELS: Readonly<Record<DemoSeedErrorCategory, string>> = {
  invalid_arguments: "invalid arguments",
  local_configuration: "local configuration invalid",
  account_lookup: "account lookup failed",
  database_write: "database write failed",
  database_verification: "database verification failed",
};

export function formatDemoSeedCliError(error: unknown): string {
  const label = error instanceof DemoSeedCliError
    ? CLI_ERROR_LABELS[error.category]
    : "unexpected failure";
  return `demo:seed failed: ${label}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fixtureUuid(userId: string, name: string): string {
  const hex = sha256(`popcorn-demo-v1\0${userId}\0${name}`).slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function at(referenceMillis: number, days: number, minutes = 0): string {
  return new Date(referenceMillis + days * 86_400_000 + minutes * 60_000).toISOString();
}

function validateSelector(selector: string): string {
  if (!UUID_PATTERN.test(selector) && !EMAIL_PATTERN.test(selector)) {
    throw new DemoSeedCliError("invalid_arguments", "--user must be an exact email or UUID");
  }
  return selector;
}

export function parseCliArguments(argumentsValue: readonly string[]): { readonly userSelector: string } {
  const normalized = argumentsValue[0] === "--" ? argumentsValue.slice(1) : argumentsValue;
  if (normalized.length !== 2 || normalized[0] !== "--user") {
    throw new DemoSeedCliError("invalid_arguments", "Expected arguments: --user <existing email or UUID>");
  }
  return { userSelector: validateSelector(normalized[1] ?? "") };
}

export function assertLocalSupabaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new DemoSeedCliError("local_configuration", "A local Supabase URL is required");
  }
  const hostname = parsed.hostname.toLowerCase();
  const loopbackV4 = /^127(?:[.]\d{1,3}){3}$/.test(hostname);
  const loopback = hostname === "localhost" || hostname === "[::1]" || hostname === "::1" || loopbackV4;
  const normalPath = parsed.pathname === "/";
  const exactOrigin = value === parsed.origin || value === `${parsed.origin}/`;
  if (
    !["http:", "https:"].includes(parsed.protocol)
    || !loopback
    || !normalPath
    || !exactOrigin
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.search !== ""
    || parsed.hash !== ""
  ) throw new DemoSeedCliError("local_configuration", "A local Supabase URL is required");
  return value;
}

function attemptRow(input: {
  ownerId: string;
  id: string;
  taskId: string;
  expressionId: string;
  response: string;
  submittedAt: string;
}): DemoSeedRow {
  return {
    id: input.id,
    user_id: input.ownerId,
    practice_task_id: input.taskId,
    user_expression_id: input.expressionId,
    response_chinese: input.response,
    passed: true,
    accuracy_score: 4,
    accuracy_feedback_english: "The target expression is used with the intended meaning.",
    naturalness_score: 4,
    naturalness_feedback_english: "The sentence sounds natural in everyday conversation.",
    contextual_fit_score: 4,
    contextual_fit_feedback_english: "The response fits the new situation.",
    independent_use: true,
    assistance_level: "none",
    submitted_at: input.submittedAt,
    created_at: input.submittedAt,
    evaluation_prompt_version: null,
    evaluation_model: null,
    evaluation_gateway_config_id: null,
    evaluation_gateway_revision: null,
    evaluation_gateway_fingerprint: null,
  };
}

function practiceRow(input: {
  ownerId: string;
  id: string;
  expressionId: string;
  expression: string;
  sequence: number;
  dueAt: string | null;
  createdAt: string;
  reviewId?: string;
}): DemoSeedRow {
  const situations = [
    "A friend suggests a practical plan for the weekend.",
    "A classmate feels frustrated while learning a new skill.",
    "Someone tells you an unexpectedly unreasonable price.",
  ];
  return {
    id: input.id,
    user_id: input.ownerId,
    user_expression_id: input.expressionId,
    kind: input.dueAt === null ? "use_it_now" : "due_practice",
    native_language: "en",
    target_language: "zh-CN",
    target_expression: input.expression,
    prompt_chinese: `情境${input.sequence + 1}：朋友请你用自然中文回应。`,
    instructions_english: `Reply in one natural Chinese sentence. Situation: ${situations[input.sequence % situations.length]}`,
    goal_english: "Use the target expression independently in a different context.",
    due_at: input.dueAt,
    review_task_id: input.reviewId ?? null,
    created_at: input.createdAt,
    activation_prompt_version: null,
    activation_model: null,
    activation_gateway_config_id: null,
    activation_gateway_revision: null,
    activation_gateway_fingerprint: null,
  };
}

export function buildDemoSeedPlan(ownerId: string, referenceNow: string): DemoSeedPlan {
  if (!UUID_PATTERN.test(ownerId)) {
    throw new DemoSeedCliError("account_lookup", "selected account has an invalid UUID");
  }
  const referenceMillis = Date.parse(referenceNow);
  if (!Number.isFinite(referenceMillis)) {
    throw new DemoSeedCliError("invalid_arguments", "reference clock must be an ISO timestamp");
  }
  const referenceDate = new Date(referenceMillis);
  const referenceDayMillis = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );

  const id = (name: string) => fixtureUuid(ownerId, name);
  const sourceId = id("source");
  const snapshotId = id("snapshot");
  const saveIds = [id("save-reliable"), id("save-patient"), id("save-outrageous")];
  const candidates = artifacts.expressionCandidates;
  const tables = Object.fromEntries(DEMO_TABLES.map((table) => [table, []])) as unknown as Record<DemoTable, DemoSeedRow[]>;

  tables.video_sources.push({
    id: sourceId, user_id: ownerId, youtube_video_id: DEMO_VIDEO.youtubeVideoId,
    canonical_url: DEMO_VIDEO.canonicalUrl, created_at: FIXED_AT, updated_at: FIXED_AT,
  });
  tables.video_snapshots.push({
    id: snapshotId, user_id: ownerId, video_source_id: sourceId, title: DEMO_VIDEO.title,
    channel: DEMO_VIDEO.channel, thumbnail_url: DEMO_VIDEO.thumbnailUrl,
    duration_seconds: DEMO_VIDEO.durationSeconds, description: DEMO_VIDEO.description,
    transcript_language: DEMO_VIDEO.transcriptLanguage, transcript_hash: DEMO_VIDEO.transcriptHash,
    captured_at: DEMO_VIDEO.acquiredAt, created_at: FIXED_AT,
  });
  for (const segment of transcript) {
    tables.transcript_segments.push({
      id: id(`segment:${segment.stableId}`), user_id: ownerId, snapshot_id: snapshotId,
      stable_id: segment.stableId, position: segment.position,
      original_chinese: segment.originalChinese, english_translation: segment.englishTranslation,
      start_seconds: segment.startSeconds, end_seconds: segment.endSeconds,
      language: segment.language, created_at: FIXED_AT,
    });
  }
  for (const index of candidates.keys()) {
    const segment = transcript[index];
    tables.saved_items.push({
      id: saveIds[index], user_id: ownerId, video_source_id: sourceId, snapshot_id: snapshotId,
      client_event_id: id(`save-event:${index}`), youtube_video_id: DEMO_VIDEO.youtubeVideoId,
      kind: index === 2 ? "key_quote" : "subtitle_row", status: "ready",
      captured_at: at(Date.parse(FIXED_AT), 0, index), start_seconds: segment.startSeconds,
      payload: index === 2 ? {
        exactQuote: segment.originalChinese,
        quoteSeconds: segment.startSeconds,
        segmentIds: [segment.stableId],
      } : {
        segmentId: segment.stableId,
        originalChinese: segment.originalChinese,
        englishTranslation: segment.englishTranslation,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        contextBefore: index === 0 ? [] : [transcript[index - 1].originalChinese],
        contextAfter: [transcript[index + 1].originalChinese],
      },
      created_at: FIXED_AT, updated_at: FIXED_AT,
    });
  }
  tables.generated_artifacts.push(
    {
      id: id("artifact-overview"), user_id: ownerId, video_source_id: sourceId,
      saved_item_id: null, artifact_type: "overview", native_language: "en",
      target_language: "zh-CN", content: artifacts.overview,
      prompt_version: "youtube-overview-v1", model: "fixture/cached-v1",
      result_key: sha256(`${ownerId}:fixture-overview-v1`), created_at: FIXED_AT,
    },
    {
      id: id("artifact-analysis"), user_id: ownerId, video_source_id: sourceId,
      saved_item_id: saveIds[0], artifact_type: "saved_item_analysis", native_language: "en",
      target_language: "zh-CN", content: artifacts.savedItemAnalysis,
      prompt_version: "analyze-saved-item-v1", model: "fixture/cached-v1",
      result_key: sha256(`${ownerId}:fixture-analysis-v1`), created_at: FIXED_AT,
    },
  );

  const states = ["tried", "reused", "owned"] as const;
  const originalDayOffsets = [-1, -2, -10] as const;
  const completedReviewPlaceholders: DemoSeedRow[] = [];
  for (const [index, state] of states.entries()) {
    const candidate = candidates[index];
    const senseId = id(`sense:${state}`);
    const expressionId = id(`expression:${state}`);
    tables.expression_senses.push({
      id: senseId, user_id: ownerId, video_source_id: sourceId, saved_item_id: saveIds[index],
      source_deleted_at: null, expression_text: candidate.expression,
      normalized_expression_text: candidate.expression, english_meaning: candidate.englishMeaning,
      english_explanation: candidate.englishExplanation, tone: candidate.tone,
      communicative_function: candidate.communicativeFunction, register: candidate.register,
      created_at: FIXED_AT, updated_at: FIXED_AT,
    });
    tables.expression_occurrences.push({
      id: id(`occurrence:${state}`), user_id: ownerId, video_source_id: sourceId,
      expression_sense_id: senseId, snapshot_id: snapshotId, saved_item_id: saveIds[index],
      evidence_text: candidate.evidenceText,
      segment_ids: candidate.segmentIds, start_seconds: candidate.startSeconds,
      end_seconds: candidate.endSeconds, confidence: candidate.confidence, created_at: FIXED_AT,
    });
    tables.user_expressions.push({
      id: expressionId, user_id: ownerId, expression_sense_id: senseId,
      mastery_state: state, created_at: FIXED_AT, updated_at: FIXED_AT,
    });

    const originalTaskId = id(`task:${state}:original`);
    const originalAttemptId = id(`attempt:${state}:original`);
    const originalCompletedAt = at(referenceDayMillis, originalDayOffsets[index]);
    tables.practice_tasks.push(practiceRow({
      ownerId, id: originalTaskId, expressionId, expression: candidate.expression,
      sequence: index * 3, dueAt: null,
      createdAt: at(Date.parse(originalCompletedAt), 0, -5),
    }));
    tables.attempts.push(attemptRow({
      ownerId, id: originalAttemptId, taskId: originalTaskId, expressionId,
      response: index === 0 ? "这个安排听起来挺靠谱的。" : index === 1
        ? "学习新东西要慢慢来。" : "这么高的票价太离谱了。",
      submittedAt: originalCompletedAt,
    }));
    tables.mastery_events.push({
      id: id(`event:${state}:original`), user_id: ownerId, user_expression_id: expressionId,
      attempt_id: originalAttemptId, prior_state: null, new_state: "tried",
      evidence_kind: "valid_original_attempt", occurred_at: originalCompletedAt, created_at: originalCompletedAt,
    });

    let precedingEvidenceAt = originalCompletedAt;
    for (let transfer = 1; transfer <= index; transfer += 1) {
      const reviewId = id(`review:${state}:completed:${transfer}`);
      const intervalDays = transfer === 1 ? 1 : 7;
      const dueAt = at(Date.parse(precedingEvidenceAt), intervalDays);
      const completedAt = at(Date.parse(dueAt), 0, 5);
      const dueTaskId = id(`task:${state}:due:${transfer}`);
      const dueAttemptId = id(`attempt:${state}:due:${transfer}`);
      const priorState = transfer === 1 ? "tried" : "reused";
      const newState = transfer === 1 ? "reused" : "owned";
      const completedReview: DemoSeedRow = {
        id: reviewId, user_id: ownerId, user_expression_id: expressionId,
        mastery_state: priorState, status: "completed", due_at: dueAt,
        interval_days: intervalDays, consecutive_successes: transfer - 1,
        completed_attempt_id: dueAttemptId, completed_at: completedAt,
        created_at: precedingEvidenceAt, updated_at: completedAt,
      };
      completedReviewPlaceholders.push({
        ...completedReview, status: "pending", completed_attempt_id: null, completed_at: null,
        updated_at: precedingEvidenceAt,
      });
      tables.review_tasks.push(completedReview);
      tables.practice_tasks.push(practiceRow({
        ownerId, id: dueTaskId, expressionId, expression: candidate.expression,
        sequence: index * 3 + transfer, dueAt, reviewId, createdAt: dueAt,
      }));
      tables.attempts.push(attemptRow({
        ownerId, id: dueAttemptId, taskId: dueTaskId, expressionId,
        response: transfer === 1 ? `新的情境里也可以说${candidate.expression}。` : `我又独立用了${candidate.expression}。`,
        submittedAt: completedAt,
      }));
      tables.mastery_events.push({
        id: id(`event:${state}:due:${transfer}`), user_id: ownerId, user_expression_id: expressionId,
        attempt_id: dueAttemptId, prior_state: priorState, new_state: newState,
        evidence_kind: transfer === 1 ? "successful_independent_transfer" : "owned_threshold_met",
        occurred_at: completedAt, created_at: completedAt,
      });
      precedingEvidenceAt = completedAt;
    }

    const intervalDays = state === "owned" ? 30 : state === "reused" ? 7 : 1;
    tables.review_tasks.push({
      id: id(`review:${state}:pending`), user_id: ownerId, user_expression_id: expressionId,
      mastery_state: state, status: "pending",
      due_at: at(Date.parse(precedingEvidenceAt), intervalDays),
      interval_days: intervalDays, consecutive_successes: index,
      completed_attempt_id: null, completed_at: null,
      created_at: precedingEvidenceAt, updated_at: precedingEvidenceAt,
    });
  }

  return { tables, completedReviewPlaceholders };
}

async function write(repository: DemoSeedRepository, ownerId: string, table: DemoTable, rows: readonly DemoSeedRow[], insertOnly = false) {
  if (rows.length === 0) return;
  if (rows.some((row) => row.user_id !== ownerId)) {
    throw new DemoSeedCliError("database_write", "demo fixture owner mismatch");
  }
  await repository.writeOwned({ ownerId, table, rows, insertOnly });
}

export async function seedDemo(input: {
  readonly repository: DemoSeedRepository;
  readonly userSelector: string;
  readonly referenceNow: string;
}): Promise<{
  readonly category: "demo_seeded";
  readonly ownerId: string;
  readonly counts: Readonly<Record<DemoTable, number>>;
  readonly ids: Readonly<Record<DemoTable, readonly string[]>>;
}> {
  const selector = validateSelector(input.userSelector);
  const accounts = await input.repository.findAccounts(selector);
  if (accounts.length !== 1) {
    throw new DemoSeedCliError("account_lookup", "Expected exactly one existing local account for --user");
  }
  const account = accounts[0];
  if (account.id !== selector && account.email !== selector) {
    throw new DemoSeedCliError("account_lookup", "Expected exactly one existing local account for --user");
  }
  const plan = buildDemoSeedPlan(account.id, input.referenceNow);
  const originalTaskIds = new Set(plan.tables.practice_tasks.filter((row) => row.kind === "use_it_now").map((row) => row.id));
  const originalAttemptIds = new Set(plan.tables.attempts.filter((row) => originalTaskIds.has(String(row.practice_task_id))).map((row) => row.id));

  for (const table of [
    "video_sources", "video_snapshots", "transcript_segments", "saved_items",
    "generated_artifacts", "expression_senses", "expression_occurrences", "user_expressions",
  ] as const) await write(input.repository, account.id, table, plan.tables[table]);
  await write(input.repository, account.id, "practice_tasks", plan.tables.practice_tasks.filter((row) => originalTaskIds.has(row.id)));
  await write(input.repository, account.id, "attempts", plan.tables.attempts.filter((row) => originalAttemptIds.has(row.id)));
  await write(input.repository, account.id, "mastery_events", plan.tables.mastery_events.filter((row) => originalAttemptIds.has(String(row.attempt_id))));
  for (const placeholder of plan.completedReviewPlaceholders.toSorted((left, right) =>
    String(left.due_at).localeCompare(String(right.due_at)) || left.id.localeCompare(right.id),
  )) {
    const finalReview = plan.tables.review_tasks.find((row) => row.id === placeholder.id);
    const dueTask = plan.tables.practice_tasks.find((row) => row.review_task_id === placeholder.id);
    const dueAttempt = dueTask && plan.tables.attempts.find((row) => row.practice_task_id === dueTask.id);
    const dueEvent = dueAttempt && plan.tables.mastery_events.find((row) => row.attempt_id === dueAttempt.id);
    if (!finalReview || !dueTask || !dueAttempt || !dueEvent) {
      throw new DemoSeedCliError("database_verification", "Demo completed review graph is incomplete");
    }
    await write(input.repository, account.id, "review_tasks", [placeholder], true);
    await write(input.repository, account.id, "practice_tasks", [dueTask]);
    await write(input.repository, account.id, "attempts", [dueAttempt]);
    await write(input.repository, account.id, "mastery_events", [dueEvent]);
    await write(input.repository, account.id, "review_tasks", [finalReview]);
  }
  await write(input.repository, account.id, "review_tasks", plan.tables.review_tasks.filter((row) => row.status === "pending"));

  const ids = {} as Record<DemoTable, readonly string[]>;
  const counts = {} as Record<DemoTable, number>;
  for (const table of DEMO_TABLES) {
    const expectedIds = plan.tables[table].map((row) => row.id).toSorted();
    const verified = await input.repository.readOwned({ ownerId: account.id, table, ids: expectedIds });
    if (verified.length !== expectedIds.length || verified.some((row) => row.user_id !== account.id)) {
      throw new DemoSeedCliError("database_verification", `Demo fixture verification failed for ${table}`);
    }
    ids[table] = expectedIds;
    counts[table] = verified.length;
  }
  return { category: "demo_seeded", ownerId: account.id, counts, ids };
}

type SeedQueryResult = { data: unknown[] | null; error: { message?: string } | null };
type SeedDb = {
  from(table: string): {
    upsert(rows: readonly DemoSeedRow[], options: { onConflict: string; ignoreDuplicates: boolean }): {
      select(columns: string): { eq(column: string, value: string): Promise<SeedQueryResult> };
    };
    select(columns: string): {
      eq(column: string, value: string): { in(column: string, values: readonly string[]): Promise<SeedQueryResult> };
    };
  };
};

export function createSupabaseDemoSeedRepository(
  client: ReturnType<typeof createClient<Database>>,
): DemoSeedRepository {
  const db = client as unknown as SeedDb;
  return {
    async findAccounts(selector) {
      if (UUID_PATTERN.test(selector)) {
        const result = await client.auth.admin.getUserById(selector);
        if (result.error) {
          throw new DemoSeedCliError("account_lookup", "Could not look up the selected local account");
        }
        if (!result.data.user?.email) return [];
        return [{ id: result.data.user.id, email: result.data.user.email }];
      }
      const matches: DemoAccount[] = [];
      for (let page = 1; page <= 100; page += 1) {
        const result = await client.auth.admin.listUsers({ page, perPage: 100 });
        if (result.error) {
          throw new DemoSeedCliError("account_lookup", "Could not look up the selected local account");
        }
        for (const user of result.data.users) {
          if (user.email === selector) matches.push({ id: user.id, email: user.email });
        }
        if (result.data.users.length < 100) return matches;
      }
      throw new DemoSeedCliError("account_lookup", "Local account lookup exceeded its bounded limit");
    },
    async writeOwned({ ownerId, table, rows, insertOnly = false }) {
      if (rows.some((row) => row.user_id !== ownerId)) {
        throw new DemoSeedCliError("database_write", "demo fixture owner mismatch");
      }
      const result = await db.from(table).upsert(rows, {
        onConflict: "id", ignoreDuplicates: insertOnly,
      }).select("id,user_id").eq("user_id", ownerId);
      if (result.error) {
        throw new DemoSeedCliError("database_write", "Could not write demo fixture rows");
      }
      if (!insertOnly && (result.data ?? []).some((row) => (row as DemoSeedRow).user_id !== ownerId)) {
        throw new DemoSeedCliError("database_verification", `Demo owner verification failed for ${table}`);
      }
    },
    async readOwned({ ownerId, table, ids }) {
      const result = await db.from(table).select("id,user_id").eq("user_id", ownerId).in("id", ids);
      if (result.error) {
        throw new DemoSeedCliError("database_verification", "Could not verify demo fixture rows");
      }
      return (result.data ?? []) as DemoSeedRow[];
    },
  };
}

async function runCli(): Promise<void> {
  const { userSelector } = parseCliArguments(process.argv.slice(2));
  const url = assertLocalSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new DemoSeedCliError(
      "local_configuration",
      "SUPABASE_SERVICE_ROLE_KEY is required in the server environment",
    );
  }
  const client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await seedDemo({
    repository: createSupabaseDemoSeedRepository(client),
    userSelector,
    referenceNow: new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  runCli().catch((error: unknown) => {
    process.stderr.write(`${formatDemoSeedCliError(error)}\n`);
    process.exitCode = 1;
  });
}
