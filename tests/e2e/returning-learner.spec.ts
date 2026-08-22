import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { runSavedLearningLoopCleanup } from "./saved-learning-loop-cleanup";

const USER_ID = "53000000-0000-4000-8000-000000000001";
const SOURCE_ID = "53000000-0000-4000-8000-000000000002";
const SAVE_ID = "53000000-0000-4000-8000-000000000003";
const SENSE_ID = "53000000-0000-4000-8000-000000000004";
const EXPRESSION_ID = "53000000-0000-4000-8000-000000000005";
const ORIGINAL_TASK_ID = "53000000-0000-4000-8000-000000000006";
const REVIEW_ID = "53000000-0000-4000-8000-000000000007";
const ORIGINAL_ATTEMPT_ID = "53000000-0000-4000-8000-000000000008";
const ORIGINAL_EVENT_ID = "53000000-0000-4000-8000-000000000009";
const FIXTURE_EMAIL = "returning-learner@popcorn.test";
const FIXTURE_PASSWORD = "password-e2e";
const EXPRESSION = "太离谱了";

const CLEANUP_SQL = String.raw`
begin;

do $guard$
begin
  if exists (
    select 1 from auth.users
    where id = '53000000-0000-4000-8000-000000000001'::uuid
      and email is distinct from 'returning-learner@popcorn.test'
  ) then
    raise exception 'reserved returning-learner E2E identity mismatch';
  end if;
end
$guard$;

delete from private.due_practice_completion_receipts
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.mastery_events
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
update public.review_tasks
set status = 'cancelled', completed_attempt_id = null, completed_at = null
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.attempts
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.practice_tasks
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.review_tasks
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.user_expressions
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.expression_occurrences
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.expression_senses
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.saved_items
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.video_snapshots
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.profiles
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from public.video_sources
where user_id = '53000000-0000-4000-8000-000000000001'::uuid;
delete from auth.users
where id = '53000000-0000-4000-8000-000000000001'::uuid;

commit;
`;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required local E2E environment: ${name}`);
  return value;
}

const appUrl = requiredEnvironment("APP_URL");
const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function cleanupFixture() {
  await runSavedLearningLoopCleanup({
    cleanupSql: CLEANUP_SQL,
    databaseUrl: requiredEnvironment("POPCORN_E2E_DATABASE_URL"),
  });
}

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
    password: FIXTURE_PASSWORD,
  });
  expect(signedIn.error).toBeNull();
  expect((await auth.auth.getUser()).data.user?.id).toBe(USER_ID);
  await context.addCookies([...cookieJar].map(([name, value]) => ({ name, value, url: appUrl })));
}

function metric(page: Page, listName: string, label: string) {
  return page.getByRole("list", { name: listName })
    .getByRole("listitem")
    .filter({ hasText: label })
    .locator("strong");
}

test.describe("returning learner", () => {
test.beforeAll(async () => {
  await cleanupFixture();
  const createdAt = "2026-08-20T10:00:00.000Z";
  const createdUser = await admin.auth.admin.createUser({
    id: USER_ID,
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
  });
  expect(createdUser.error).toBeNull();

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

  const roots = await Promise.all([
    admin.from("video_sources").insert({
      id: SOURCE_ID,
      user_id: USER_ID,
      youtube_video_id: "9bZkp7q19f0",
      canonical_url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
      created_at: createdAt,
      updated_at: createdAt,
    }),
  ]);
  expect(roots.map((result) => result.error)).toEqual([null]);

  const save = await admin.from("saved_items").insert({
    id: SAVE_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    snapshot_id: null,
    client_event_id: "53000000-0000-4000-8000-000000000011",
    youtube_video_id: "9bZkp7q19f0",
    kind: "player_moment",
    status: "saved",
    captured_at: createdAt,
    start_seconds: 42,
    payload: { capturedSecond: 42 },
    created_at: createdAt,
    updated_at: createdAt,
  });
  expect(save.error).toBeNull();

  const sense = await admin.from("expression_senses").insert({
    id: SENSE_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    saved_item_id: SAVE_ID,
    expression_text: EXPRESSION,
    normalized_expression_text: EXPRESSION,
    english_meaning: "That is absurd.",
    english_explanation: "A spoken reaction to something unreasonable or unbelievable.",
    tone: "Informal and emphatic.",
    communicative_function: "Reacting to an unreasonable or surprising situation.",
    register: "Everyday spoken Mandarin.",
    created_at: createdAt,
    updated_at: createdAt,
  });
  expect(sense.error).toBeNull();

  const expression = await admin.from("user_expressions").insert({
    id: EXPRESSION_ID,
    user_id: USER_ID,
    expression_sense_id: SENSE_ID,
    mastery_state: "tried",
    created_at: createdAt,
    updated_at: createdAt,
  });
  expect(expression.error).toBeNull();

  const originalTask = await admin.from("practice_tasks").insert({
    id: ORIGINAL_TASK_ID,
    user_id: USER_ID,
    user_expression_id: EXPRESSION_ID,
    kind: "use_it_now",
    native_language: "en",
    target_language: "zh-CN",
    target_expression: EXPRESSION,
    prompt_chinese: "朋友说演唱会门票贵得不合理。你会怎么回应？",
    instructions_english: "Reply with one natural Simplified Chinese sentence.",
    goal_english: "Use the target expression to react naturally.",
    due_at: null,
    created_at: createdAt,
  });
  expect(originalTask.error).toBeNull();

  const originalAttempt = await admin.from("attempts").insert({
    id: ORIGINAL_ATTEMPT_ID,
    user_id: USER_ID,
    practice_task_id: ORIGINAL_TASK_ID,
    user_expression_id: EXPRESSION_ID,
    response_chinese: "这件事真的太离谱了。",
    passed: true,
    accuracy_score: 4,
    accuracy_feedback_english: "The expression has the intended meaning.",
    naturalness_score: 4,
    naturalness_feedback_english: "The response sounds natural in conversation.",
    contextual_fit_score: 4,
    contextual_fit_feedback_english: "The response fits the original situation.",
    independent_use: true,
    assistance_level: "none",
    submitted_at: "2026-08-09T10:00:00.000Z",
    created_at: "2026-08-09T10:00:00.000Z",
  });
  expect(originalAttempt.error).toBeNull();

  const originalEvent = await admin.from("mastery_events").insert({
    id: ORIGINAL_EVENT_ID,
    user_id: USER_ID,
    user_expression_id: EXPRESSION_ID,
    attempt_id: ORIGINAL_ATTEMPT_ID,
    prior_state: null,
    new_state: "tried",
    evidence_kind: "valid_original_attempt",
    occurred_at: "2026-08-09T10:00:00.000Z",
    created_at: "2026-08-09T10:00:00.000Z",
  });
  expect(originalEvent.error).toBeNull();

  const review = await admin.from("review_tasks").insert({
    id: REVIEW_ID,
    user_id: USER_ID,
    user_expression_id: EXPRESSION_ID,
    mastery_state: "tried",
    status: "pending",
    due_at: "2026-08-20T12:00:00.000Z",
    interval_days: 1,
    consecutive_successes: 0,
    completed_attempt_id: null,
    completed_at: null,
    created_at: createdAt,
    updated_at: createdAt,
  });
  expect(review.error).toBeNull();
});

test.afterAll(async () => {
  await cleanupFixture();
});

test.beforeEach(async ({ context }) => installSeedSession(context));

test("a returning learner completes due Practice without increasing saved volume", async ({ page }) => {
  const savesBefore = await admin.from("saved_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", USER_ID);
  expect(savesBefore.error).toBeNull();
  expect(savesBefore.count).toBe(1);

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  await expect(metric(page, "Weekly learning evidence", "Attempts this week")).toHaveText("0");
  await expect(metric(page, "Weekly learning evidence", "Due Practice completed")).toHaveText("0");
  await expect(metric(page, "Weekly learning evidence", "Independent reuse")).toHaveText("0");
  await expect(metric(page, "Weekly learning evidence", "Practice due now")).toHaveText("1");
  await expect(metric(page, "Current mastery distribution", "Tried")).toHaveText("1");
  await expect(metric(page, "Current mastery distribution", "Reused")).toHaveText("0");

  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("link", { name: `Practice ${EXPRESSION}` })).toBeVisible();
  await expect(page.getByText(/tried/)).toBeVisible();

  const [transferResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/v1/practice/due/${REVIEW_ID}`,
    ),
    page.getByRole("button", { name: "Start due Practice" }).click(),
  ]);
  expect(transferResponse.status()).toBe(200);
  await expect(page.getByRole("heading", { name: `Use ${EXPRESSION} in a new situation` })).toBeVisible();

  await page.getByLabel("Your Chinese response").fill("这个票价也太离谱了吧！");
  const [completionResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/v1/practice/due/${REVIEW_ID}`,
    ),
    page.getByRole("button", { name: "Check my response" }).click(),
  ]);
  expect(completionResponse.status()).toBe(201);
  await expect(page.getByText("Practice moved from tried to reused.", { exact: false })).toBeVisible();

  await page.goto("/progress");
  await expect(metric(page, "Weekly learning evidence", "Attempts this week")).toHaveText("1");
  await expect(metric(page, "Weekly learning evidence", "Due Practice completed")).toHaveText("1");
  await expect(metric(page, "Weekly learning evidence", "Independent reuse")).toHaveText("1");
  await expect(metric(page, "Weekly learning evidence", "Practice due now")).toHaveText("0");
  await expect(metric(page, "Current mastery distribution", "Tried")).toHaveText("0");
  await expect(metric(page, "Current mastery distribution", "Reused")).toHaveText("1");
  await expect(metric(page, "Current mastery distribution", "Owned")).toHaveText("0");

  const [savesAfter, expressionAfter, completedReview, pendingReview] = await Promise.all([
    admin.from("saved_items").select("id", { count: "exact", head: true }).eq("user_id", USER_ID),
    admin.from("user_expressions").select("mastery_state").eq("user_id", USER_ID).eq("id", EXPRESSION_ID).single(),
    admin.from("review_tasks").select("completed_attempt_id").eq("user_id", USER_ID).eq("id", REVIEW_ID).eq("status", "completed").single(),
    admin.from("review_tasks").select("id", { count: "exact", head: true }).eq("user_id", USER_ID).eq("status", "pending"),
  ]);
  expect(savesAfter.error).toBeNull();
  expect(savesAfter.count).toBe(1);
  expect(expressionAfter.data?.mastery_state).toBe("reused");
  expect(completedReview.data?.completed_attempt_id).toBeTruthy();
  expect(pendingReview.count).toBe(1);
});
});
