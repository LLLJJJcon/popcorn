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
const SNAPSHOT_ID = "53000000-0000-4000-8000-000000000010";
const OCCURRENCE_ID = "53000000-0000-4000-8000-000000000012";
const SEGMENT_ID = "3".repeat(64);
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
delete from public.transcript_segments
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

async function gotoStable(page: Page, route: string) {
  try {
    await page.goto(route);
  } catch (error) {
    if (!String(error).includes("net::ERR_ABORTED")) throw error;
  }
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
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

  const snapshot = await admin.from("video_snapshots").insert({
    id: SNAPSHOT_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    title: "Returning learner Mandarin clip",
    channel: "Popcorn fixture",
    thumbnail_url: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
    duration_seconds: 180,
    description: "A fixed due Practice source.",
    transcript_language: "zh-CN",
    transcript_hash: "d".repeat(64),
    captured_at: createdAt,
    created_at: createdAt,
  });
  expect(snapshot.error).toBeNull();

  const segment = await admin.from("transcript_segments").insert({
    id: "53000000-0000-4000-8000-000000000013",
    user_id: USER_ID,
    snapshot_id: SNAPSHOT_ID,
    stable_id: SEGMENT_ID,
    position: 0,
    original_chinese: "这件事真的太离谱了。",
    english_translation: "This really is outrageous.",
    start_seconds: 42,
    end_seconds: 45,
    language: "zh-CN",
    created_at: createdAt,
  });
  expect(segment.error).toBeNull();

  const save = await admin.from("saved_items").insert({
    id: SAVE_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    snapshot_id: SNAPSHOT_ID,
    client_event_id: "53000000-0000-4000-8000-000000000011",
    youtube_video_id: "9bZkp7q19f0",
    kind: "subtitle_row",
    status: "ready",
    captured_at: createdAt,
    start_seconds: 42,
    payload: {
      segmentId: SEGMENT_ID,
      originalChinese: "这件事真的太离谱了。",
      englishTranslation: "This really is outrageous.",
      startSeconds: 42,
      endSeconds: 45,
      contextBefore: [],
      contextAfter: [],
    },
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

  const occurrence = await admin.from("expression_occurrences").insert({
    id: OCCURRENCE_ID,
    user_id: USER_ID,
    video_source_id: SOURCE_ID,
    expression_sense_id: SENSE_ID,
    snapshot_id: SNAPSHOT_ID,
    saved_item_id: SAVE_ID,
    evidence_text: "这件事真的太离谱了。",
    segment_ids: [SEGMENT_ID],
    start_seconds: 42,
    end_seconds: 45,
    confidence: 0.95,
    created_at: createdAt,
  });
  expect(occurrence.error).toBeNull();

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

test("the smart root sends a signed-out learner to the designed sign-in page", async ({ context, page }) => {
  await context.clearCookies();
  for (const width of [320, 899, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", {
      level: 1,
      name: "Turn the YouTube videos you watch into Mandarin practice.",
    })).toBeVisible();
    await expect(page.getByRole("form", { name: "Email and password sign in" })).toBeVisible();
    const overflow = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    );
    expect(overflow, `sign-in must not overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test("the authenticated workspace keeps one clear page and no horizontal overflow at every target width", async ({ page }) => {
  const routes = [
    "/home",
    "/saved",
    "/practice",
    "/vault",
    `/vault/${EXPRESSION_ID}`,
    "/progress",
    "/settings/model-gateway",
  ];
  for (const width of [320, 899, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await gotoStable(page, route);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
      const overflow = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      );
      expect(overflow, `${route} must not overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    await page.goto("/home");
    const shellDisplay = await page.locator('aside[aria-label="Popcorn workspace"]')
      .evaluate((element) => getComputedStyle(element).display);
    expect(shellDisplay).toBe(width <= 899 ? "grid" : "flex");
    const clippedNavigation = await page.getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => {
        const rect = link.getBoundingClientRect();
        return { label: link.textContent, left: rect.left, right: rect.right };
      }).filter((link) => link.left < 0 || link.right > window.innerWidth + 1));
    expect(clippedNavigation, `all navigation actions must be discoverable at ${width}px`).toEqual([]);
  }
});

test("a returning learner completes due Practice without increasing saved volume", async ({ page }) => {
  const savesBefore = await admin.from("saved_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", USER_ID);
  expect(savesBefore.error).toBeNull();
  expect(savesBefore.count).toBe(1);

  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Your Mandarin in use" })).toBeVisible();
  await expect(metric(page, "Weekly learning evidence", "Attempts this week")).toHaveText("0");
  await expect(metric(page, "Weekly learning evidence", "Due Practice completed")).toHaveText("0");
  await expect(metric(page, "Weekly learning evidence", "Independent reuse")).toHaveText("0");
  await expect(metric(page, "Weekly learning evidence", "Practice due now")).toHaveText("1");
  await expect(metric(page, "Current mastery distribution", "Tried")).toHaveText("1");
  await expect(metric(page, "Current mastery distribution", "Reused")).toHaveText("0");

  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(page.getByText(EXPRESSION, { exact: true })).toBeVisible();
  await expect(page.getByText(/tried/)).toBeVisible();

  const [transferResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "GET"
      && new URL(response.url()).pathname === `/api/v1/practice/due/${REVIEW_ID}`,
    ),
    page.getByRole("button", { name: "Start practice" }).click(),
  ]);
  expect(transferResponse.status()).toBe(200);
  await expect(page.getByRole("heading", { name: EXPRESSION, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Returning learner Mandarin clip/ })).toBeVisible();

  await page.getByLabel("Your Chinese response").fill("这个票价也太离谱了吧！");
  const [completionResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === "POST"
      && new URL(response.url()).pathname === `/api/v1/practice/due/${REVIEW_ID}`,
    ),
    page.getByRole("button", { name: "Check my response" }).click(),
  ]);
  expect(completionResponse.status()).toBe(201);
  await expect(page.getByText("Mastery moved from tried to reused.", { exact: false })).toBeVisible();

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
