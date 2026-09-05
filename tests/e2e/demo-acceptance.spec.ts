import { expect, test } from "./extension/fixtures";

test("Open Popcorn targets the smart root and an unavailable Web sync keeps the raw save queued", async ({
  popcorn,
}) => {
  await popcorn.signInAfterExplicitClick();
  await popcorn.openChineseVideoAndPanel();

  popcorn.cloud.setDropSyncResponses(true);
  await popcorn.panel.locator(".transcript-save-btn").first().click();
  await expect(popcorn.panel.locator("#saveStatusMessage")).toContainText(
    "Popcorn is temporarily unavailable; queued and retrying automatically",
  );
  await expect(popcorn.panel.locator("#saveRawText")).toContainText("这也太离谱了吧。");
  await expect.poll(() => popcorn.pendingCount()).toBe(1);

  await popcorn.stopWorkerAndRecoverFromAlarm();
  await expect.poll(() => popcorn.pendingCount()).toBe(0);

  // Opening a foreground Web tab closes Chrome's side panel, so this belongs
  // after the queue assertions rather than before them.
  const [opened] = await Promise.all([
    popcorn.context.waitForEvent("page"),
    popcorn.panel.locator("#settingsBtn").click(),
  ]);
  // The extension session is intentionally separate from the Web session. The
  // smart root therefore resolves to sign-in in this isolated browser context.
  await expect.poll(() => new URL(opened.url()).pathname).toBe("/sign-in");
  await opened.close();
});
