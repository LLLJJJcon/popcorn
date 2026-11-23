import { expect, test } from "./fixtures";

async function selectChinese(popcorn: { panel: import("@playwright/test").Page }, characters = 8) {
  await popcorn.panel.evaluate((length) => {
    const source = document.querySelector(".transcript-original, .transcript-text");
    if (!source?.firstChild) throw new Error("Chinese source is missing");
    const range = document.createRange();
    range.setStart(source.firstChild, 0);
    range.setEnd(source.firstChild, Math.min(length, source.textContent?.length ?? 0));
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, characters);
  await expect(popcorn.panel.locator("#explainTooltip")).toBeVisible();
}

test("selection actions stay reachable in a narrow sidebar and explanation recovers without losing source", async ({ popcorn }) => {
  await popcorn.options.setViewportSize({ width: 800, height: 960 });
  await popcorn.options.goto(`chrome-extension://${popcorn.extensionId}/options.html`);
  await expect(popcorn.options.locator("#signInBtn")).toBeVisible();
  await popcorn.options.screenshot({ path: test.info().outputPath("settings.png"), fullPage: true });
  await popcorn.signInAfterExplicitClick();
  await popcorn.openChineseVideoAndPanel();
  await popcorn.panel.setViewportSize({ width: 384, height: 960 });
  await popcorn.showEnglishAndBilingual();
  await selectChinese(popcorn, 1);
  const tools = await popcorn.panel.locator("#explainTooltip").boundingBox();
  expect(tools).not.toBeNull();
  expect(tools!.x).toBeGreaterThanOrEqual(0);
  expect(tools!.x + tools!.width).toBeLessThanOrEqual(384);
  await popcorn.panel.screenshot({ path: test.info().outputPath("transcript.png") });

  await selectChinese(popcorn);
  await popcorn.panel.locator(".explain-btn").click();
  await expect(popcorn.panel.locator(".explain-module.meaning")).toContainText("absurd");
  await expect(popcorn.panel.locator(".explain-module.context")).toContainText("immediate reaction");
  await popcorn.panel.screenshot({ path: test.info().outputPath("explanation.png") });
  await popcorn.panel.keyboard.press("Escape");
  await expect(popcorn.panel.locator("#explainModal")).toHaveCount(0);

  await popcorn.panel.locator('[data-tab="overview"]').click();
  await expect(popcorn.panel.locator(".quote-save-note-btn").first()).toBeVisible();
  await popcorn.panel.screenshot({ path: test.info().outputPath("overview.png") });
  await popcorn.panel.locator('[data-tab="saved"]').click();
  await popcorn.panel.locator("#saveVideoBtn").click();
  await expect(popcorn.panel.locator("#saveStatus")).toContainText("Saved to Popcorn");
  await popcorn.context.route("**/api/v1/extension/saved", route => {
    const saved = popcorn.cloud.capturedEventsByKind().video[0];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, data: [{ sourceId: "00000000-0000-4000-8000-000000000303",
        youtubeVideoId: saved.youtubeVideoId, title: saved.title, channel: saved.channel,
        savedCount: 1, processingState: "organizing" }],
    }) });
  });
  await popcorn.panel.locator('[data-tab="transcript"]').click();
  await popcorn.panel.locator('[data-tab="saved"]').click();
  await expect(popcorn.panel.locator(".saved-library-title")).toHaveText("中文访谈");
  await expect(popcorn.panel.locator("#explainTooltip")).toBeHidden();
  await popcorn.panel.screenshot({ path: test.info().outputPath("saved.png") });
  const contrast = await popcorn.panel.locator(".saved-filter .active").evaluate((el) => {
    const style = getComputedStyle(el);
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255);
      const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    };
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);

  // All cloud traffic remains intercepted by this fixture. No real account is used.
  const rejectExplanation = (route: import("@playwright/test").Route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required.", retryable: false } }),
  });
  await popcorn.context.route("**/api/v1/explanations", rejectExplanation);
  await popcorn.panel.locator('[data-tab="transcript"]').click();
  await selectChinese(popcorn);
  await popcorn.panel.locator(".explain-btn").click();
  await expect(popcorn.panel.locator(".explain-error")).toContainText("session expired");
  await expect(popcorn.panel.locator(".explain-selected-text")).toContainText("这也太离谱了吧。");
  await expect(popcorn.panel.locator(".explanation-sign-in-btn")).toBeVisible();
  await expect(popcorn.panel.locator(".explanation-retry-btn")).toBeVisible();
  await popcorn.panel.screenshot({ path: test.info().outputPath("explanation-recovery.png") });
  const reconnectOpened = popcorn.context.waitForEvent("page", { timeout: 3000 });
  await popcorn.panel.locator(".explanation-sign-in-btn").click();
  const reconnect = await reconnectOpened;
  await expect(reconnect.locator("#reauthBtn")).toBeVisible();
  await expect(popcorn.panel.locator("#explainModal")).toBeVisible();
  await reconnect.locator("#reauthBtn").click();
  await expect(reconnect.locator("#authEmail")).toHaveValue("");
  await expect(reconnect.locator("#authPassword")).toBeVisible();
  await expect(reconnect.locator("#signInBtn")).toBeVisible();
  await expect(reconnect.locator("#discardPendingBtn")).toBeHidden();
  await reconnect.locator("#authEmail").fill("learner@example.com");
  await reconnect.locator("#authPassword").fill("correct-horse");
  await reconnect.locator("#signInBtn").click();
  await expect(reconnect.locator("#authStatus")).toHaveText("Signed in.");
  await reconnect.close();
  await popcorn.youtube.bringToFront();
  await popcorn.context.unroute("**/api/v1/explanations", rejectExplanation);
  await popcorn.panel.locator(".explanation-retry-btn").click();
  await expect(popcorn.panel.locator(".explain-module.meaning")).toContainText("absurd");
  await expect(popcorn.panel.locator(".explain-selected-text")).toContainText("这也太离谱了吧。");
});

test("transcript session expiry opens sign-in recovery and retries the same video", async ({ popcorn }) => {
  await popcorn.signInAfterExplicitClick();
  await popcorn.openChineseVideoAndPanel();
  const rejectTranscript = (route: import("@playwright/test").Route) => route.fulfill({
    status: 401, contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required.", retryable: false } }),
  });
  await popcorn.context.route("**/api/v1/youtube/*/transcript", rejectTranscript);
  await popcorn.panel.reload();
  await expect(popcorn.panel.locator("#errorTitle")).toHaveText("Extension session expired");
  await expect(popcorn.panel.locator("#errorRecoveryBtn")).toBeVisible();
  const opened = popcorn.context.waitForEvent("page");
  await popcorn.panel.locator("#errorRecoveryBtn").click();
  const reconnect = await opened;
  await reconnect.locator("#reauthBtn").click();
  await reconnect.locator("#authEmail").fill("learner@example.com");
  await reconnect.locator("#authPassword").fill("correct-horse");
  await reconnect.locator("#signInBtn").click();
  await expect(reconnect.locator("#authStatus")).toHaveText("Signed in.");
  await reconnect.close();
  await popcorn.youtube.bringToFront();
  await popcorn.context.unroute("**/api/v1/youtube/*/transcript", rejectTranscript);
  await popcorn.panel.locator("#errorBtn").click();
  await expect(popcorn.panel.locator(".transcript-entry")).toHaveCount(2);
  await expect(popcorn.panel.locator("#errorRecoveryBtn")).toBeHidden();
});
