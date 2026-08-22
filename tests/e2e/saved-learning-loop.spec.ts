import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

import { runSavedLearningLoopCleanup } from "./saved-learning-loop-cleanup";

const USER_ID = "52000000-0000-4000-8000-000000000001";
const SOURCE_ID = "52000000-0000-4000-8000-000000000002";
const SNAPSHOT_ID = "52000000-0000-4000-8000-000000000003";
const SEGMENT_ID = "e2e-saved-analysis-segment";
const ACTION_SAVE_ID = "52000000-0000-4000-8000-000000000011";
const IGNORED_SAVE_ID = "52000000-0000-4000-8000-000000000012";
const ARTIFACT_ID = "52000000-0000-4000-8000-000000000013";
const EVIDENCE_TEXT = "这个表达在口语里很常见。";
const EXPRESSION = "这个表达";
const FIXTURE_EMAIL = "learning-loop@popcorn.test";

const CLEANUP_SQL = String.raw`
begin;

do $guard$
begin
  if exists (
    select 1
    from auth.users
    where id = '52000000-0000-4000-8000-000000000001'::uuid
      and email is distinct from 'learning-loop@popcorn.test'
  ) then
    raise exception 'reserved E2E fixture identity mismatch';
  end if;
end
$guard$;

delete from private.practice_promotion_receipts
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from private.learning_artifact_gateway_pins
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.mastery_events
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.review_tasks
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.attempts
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.practice_tasks
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.practice_draft_attempts
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.practice_drafts
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.user_expressions
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.expression_occurrences
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.expression_senses
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.knowledge_job_internal
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.knowledge_jobs
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.generated_artifacts
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.transcript_segments
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.saved_items
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.video_snapshots
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from private.user_model_gateway_secrets
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.user_model_gateway_configs
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.profiles
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from public.video_sources
where user_id = '52000000-0000-4000-8000-000000000001'::uuid;
delete from auth.users
where id = '52000000-0000-4000-8000-000000000001'::uuid;

do $verify$
begin
  if exists (
    select 1 from auth.users
    where id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.profiles
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.video_sources
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.video_snapshots
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.transcript_segments
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.saved_items
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.generated_artifacts
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.knowledge_jobs
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.knowledge_job_internal
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.expression_senses
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.expression_occurrences
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.user_expressions
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.practice_tasks
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.attempts
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.mastery_events
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.review_tasks
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.practice_drafts
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.practice_draft_attempts
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from private.practice_promotion_receipts
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from private.learning_artifact_gateway_pins
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from private.user_model_gateway_secrets
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) or exists (
    select 1 from public.user_model_gateway_configs
    where user_id = '52000000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception 'E2E fixture cleanup left owned rows behind';
  end if;
end
$verify$;

commit;
`;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required local E2E environment: ${name}`);
  return value;
}

async function cleanupFixture() {
  await runSavedLearningLoopCleanup({
    cleanupSql: CLEANUP_SQL,
    databaseUrl: requiredEnvironment("POPCORN_E2E_DATABASE_URL"),
  });
}

const appUrl = requiredEnvironment("APP_URL");
const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ignoredBefore: Record<string, unknown>;

async function installSeedSession(context: BrowserContext) {
  const cookieJar = new Map<string, string>();
  const auth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) {
          if (cookie.value) cookieJar.set(cookie.name, cookie.value);
          else cookieJar.delete(cookie.name);
        }
      },
    },
    cookieOptions: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(appUrl).protocol === "https:",
    },
  });
  const signedIn = await auth.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: "password-e2e",
  });
  expect(signedIn.error).toBeNull();
  const verified = await auth.auth.getUser();
  expect(verified.error).toBeNull();
  expect(verified.data.user?.id).toBe(USER_ID);
  await context.addCookies([...cookieJar].map(([name, value]) => ({ name, value, url: appUrl })));
}

test.beforeAll(async () => {
  await cleanupFixture();

  const createdAt = "2026-08-20T10:00:00.000Z";
  const user = await admin.auth.admin.createUser({
    id: USER_ID,
    email: FIXTURE_EMAIL,
    password: "password-e2e",
    email_confirm: true,
  });
  expect(user.error).toBeNull();

  const createdProfile = await admin.from("profiles")
    .select("user_id,native_language,target_language")
    .eq("user_id", USER_ID)
    .single();
  expect(createdProfile.error).toBeNull();
  expect(createdProfile.data).toEqual({
    user_id: USER_ID,
    native_language: "en",
    target_language: "zh-CN",
  });

  const sourceGraph = await Promise.all([
    admin.from("video_sources").insert({
      id: SOURCE_ID,
      user_id: USER_ID,
      youtube_video_id: "dQw4w9WgXcQ",
      canonical_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      created_at: createdAt,
      updated_at: createdAt,
    }),
  ]);
  expect(sourceGraph.map((result) => result.error)).toEqual([null]);
  const snapshot = await admin.from("video_snapshots").insert({
    id: SNAPSHOT_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    title: "E2E 中文学习示例",
    channel: "爆米中文",
    thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    duration_seconds: 180,
    description: "A deterministic local browser fixture.",
    transcript_language: "zh-CN",
    transcript_hash: "c".repeat(64),
    captured_at: createdAt,
    created_at: createdAt,
  });
  expect(snapshot.error).toBeNull();
  const segment = await admin.from("transcript_segments").insert({
    id: "52000000-0000-4000-8000-000000000004",
    user_id: USER_ID,
    snapshot_id: SNAPSHOT_ID,
    stable_id: SEGMENT_ID,
    position: 0,
    original_chinese: EVIDENCE_TEXT,
    english_translation: "This expression is common in spoken language.",
    start_seconds: 4,
    end_seconds: 9,
    language: "zh-CN",
    created_at: createdAt,
  });
  expect(segment.error).toBeNull();
  const saves = await admin.from("saved_items").insert([
    {
      id: ACTION_SAVE_ID,
      user_id: USER_ID,
      video_source_id: SOURCE_ID,
      snapshot_id: SNAPSHOT_ID,
      client_event_id: "52000000-0000-4000-8000-000000000021",
      youtube_video_id: "dQw4w9WgXcQ",
      kind: "subtitle_row",
      status: "ready",
      captured_at: createdAt,
      start_seconds: 4,
      payload: {
        segmentId: SEGMENT_ID,
        originalChinese: EVIDENCE_TEXT,
        englishTranslation: "This expression is common in spoken language.",
        startSeconds: 4,
        endSeconds: 9,
        contextBefore: ["今天我们来学中文。"],
        contextAfter: ["请你试着用它造一个新句子。"],
      },
      created_at: createdAt,
      updated_at: createdAt,
    },
    {
      id: IGNORED_SAVE_ID,
      user_id: USER_ID,
      video_source_id: SOURCE_ID,
      snapshot_id: SNAPSHOT_ID,
      client_event_id: "52000000-0000-4000-8000-000000000022",
      youtube_video_id: "dQw4w9WgXcQ",
      kind: "player_moment",
      status: "saved",
      captured_at: "2026-08-20T10:01:00.000Z",
      start_seconds: 40,
      payload: { capturedSecond: 40 },
      created_at: createdAt,
      updated_at: createdAt,
    },
  ]);
  expect(saves.error).toBeNull();

  const artifact = await admin.from("generated_artifacts").insert({
    id: ARTIFACT_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    saved_item_id: ACTION_SAVE_ID,
    artifact_type: "saved_item_analysis",
    native_language: "en",
    target_language: "zh-CN",
    content: {
      candidates: [{
        expression: EXPRESSION,
        englishMeaning: "This expression.",
        englishExplanation: "A phrase highlighted as common in everyday spoken Mandarin.",
        tone: "Neutral and conversational.",
        communicativeFunction: "Referring to the expression under discussion.",
        register: "Everyday spoken Mandarin.",
        evidenceText: EVIDENCE_TEXT,
        segmentIds: [SEGMENT_ID],
        startSeconds: 4,
        endSeconds: 9,
        confidence: 0.9,
      }],
    },
    prompt_version: "analyze-saved-item-v1",
    model: "fixture/saved-analysis-v1",
    result_key: "b".repeat(64),
    created_at: createdAt,
  });
  expect(artifact.error).toBeNull();

  const ignored = await admin.from("saved_items")
    .select("status,payload,start_seconds,snapshot_id,updated_at")
    .eq("id", IGNORED_SAVE_ID).eq("user_id", USER_ID).single();
  expect(ignored.error).toBeNull();
  ignoredBefore = ignored.data!;
});

test.afterAll(async () => {
  await cleanupFixture();
});

test.beforeEach(async ({ context }) => installSeedSession(context));

test("one saved YouTube moment becomes tried knowledge and due Practice", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  for (const item of ["Home", "Saved", "Practice", "Vault", "Progress"]) {
    await expect(navigation.getByRole("link", { name: item, exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Organize 1 recent save" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
  await page.getByRole("link", { name: "E2E 中文学习示例" }).click();
  await expect(page.getByRole("heading", { name: "Saved moments" })).toBeVisible();
  await expect(page.getByTestId("raw-text").filter({ hasText: EVIDENCE_TEXT })).toBeVisible();
  const candidate = page.getByRole("heading", { name: EXPRESSION, exact: true }).locator("..");
  await expect(candidate.getByText(EVIDENCE_TEXT, { exact: true })).toBeVisible();
  await expect(candidate.getByRole("link", { name: "Watch at 0:04" })).toBeVisible();
  const activationButton = candidate.getByRole("button", { name: "Use It Now" });
  await expect(activationButton).toBeEnabled();

  const [activationResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/v1/practice/tasks",
    ),
    activationButton.click(),
  ]);
  const activationBody = await activationResponse.text();
  expect(
    activationResponse.status(),
    `POST /api/v1/practice/tasks returned ${activationResponse.status()}: ${activationBody}`,
  ).toBe(201);
  await expect(page).toHaveURL(/\/practice\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: `Use ${EXPRESSION} now` })).toBeVisible();

  const draft = await admin.from("practice_drafts")
    .select("id,future_user_expression_id")
    .eq("user_id", USER_ID).eq("saved_item_id", ACTION_SAVE_ID).single();
  expect(draft.error).toBeNull();
  const futureUserExpressionId = draft.data!.future_user_expression_id;
  const beforeAttempt = await Promise.all([
    admin.from("user_expressions").select("id", { count: "exact", head: true })
      .eq("user_id", USER_ID).eq("id", futureUserExpressionId),
    admin.from("mastery_events").select("id", { count: "exact", head: true })
      .eq("user_id", USER_ID).eq("user_expression_id", futureUserExpressionId),
    admin.from("review_tasks").select("id", { count: "exact", head: true })
      .eq("user_id", USER_ID).eq("user_expression_id", futureUserExpressionId),
  ]);
  expect(beforeAttempt.map((result) => result.count)).toEqual([0, 0, 0]);

  const original = "这个表达真的很常见。";
  await page.getByLabel("Your Chinese response").fill(original);
  const [originalResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/practice/attempts",
    ),
    page.getByRole("button", { name: "Check my response" }).click(),
  ]);
  expect(originalResponse.status()).toBe(201);
  await expect(page.getByText("This response passed.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Vault" })).toBeVisible();

  const revision = "我觉得这个表达在口语里很自然。";
  await page.getByLabel("Your Chinese response").fill(revision);
  const [revisionResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/revisions"),
    ),
    page.getByRole("button", { name: "Check revised response" }).click(),
  ]);
  expect(revisionResponse.status()).toBe(201);
  await expect.poll(async () => {
    const attempts = await admin.from("practice_draft_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", USER_ID).eq("practice_draft_id", draft.data!.id);
    return attempts.count;
  }).toBe(2);

  await page.getByRole("link", { name: "Open in Vault" }).click();
  await expect(page).toHaveURL(new RegExp(`/vault#expression-${futureUserExpressionId}$`));
  const card = page.locator(`#expression-${futureUserExpressionId}`);
  await expect(card.getByRole("heading", { name: EXPRESSION, exact: true })).toBeVisible();
  await expect(card.getByText("tried", { exact: true })).toBeVisible();
  await expect(card.getByRole("heading", { name: "Original occurrence" })).toBeVisible();
  await expect(card.getByText(EVIDENCE_TEXT, { exact: true })).toBeVisible();
  await expect(card.getByRole("heading", { name: "Attempt history" })).toBeVisible();
  await expect(card.getByText(original, { exact: true })).toBeVisible();
  await expect(card.getByText(revision, { exact: true })).toBeVisible();

  const review = await admin.from("review_tasks").select("id")
    .eq("user_id", USER_ID).eq("user_expression_id", futureUserExpressionId).single();
  expect(review.error).toBeNull();
  const due = await admin.from("review_tasks")
    .update({ due_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", review.data!.id).eq("user_id", USER_ID);
  expect(due.error).toBeNull();

  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("link", { name: `Practice ${EXPRESSION}` })).toBeVisible();
  await expect(page.getByText(/tried/)).toBeVisible();

  const ignoredAfter = await admin.from("saved_items")
    .select("status,payload,start_seconds,snapshot_id,updated_at")
    .eq("id", IGNORED_SAVE_ID).eq("user_id", USER_ID).single();
  expect(ignoredAfter.error).toBeNull();
  expect(ignoredAfter.data).toEqual(ignoredBefore);
  const ignoredRelations = await Promise.all([
    admin.from("generated_artifacts").select("id", { count: "exact", head: true })
      .eq("user_id", USER_ID).eq("saved_item_id", IGNORED_SAVE_ID),
    admin.from("practice_drafts").select("id", { count: "exact", head: true })
      .eq("user_id", USER_ID).eq("saved_item_id", IGNORED_SAVE_ID),
  ]);
  expect(ignoredRelations.map((result) => result.count)).toEqual([0, 0]);
});
