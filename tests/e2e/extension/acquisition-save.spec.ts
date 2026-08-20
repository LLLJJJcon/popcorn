import { expect, test } from "./fixtures";

test("explicit sign-in, Chinese learning artifacts, six saves, and worker recovery stay exact", async ({
  popcorn,
}) => {
  await popcorn.signInAfterExplicitClick();
  await popcorn.openChineseVideoAndPanel();

  await expect(popcorn.panel.getByRole("button", { name: "中文" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await popcorn.showEnglishAndBilingual();
  await popcorn.saveAllSixKindsWithoutChangingPlayback();

  await popcorn.queueRapidMomentsWithDroppedResponses();
  await popcorn.stopWorkerAndRecoverFromAlarm();

  expect(popcorn.cloud.savedKinds()).toEqual([
    "ai_explanation",
    "key_quote",
    "player_moment",
    "subtitle_row",
    "subtitle_selection",
    "video",
  ]);
  expect(popcorn.cloud.videoParentCount()).toBe(1);
  expect(popcorn.cloud.hasIdempotentRetry()).toBe(true);
  expect(popcorn.cloud.unapprovedEgress()).toEqual([]);
  await expect.poll(() => popcorn.pendingCount()).toBe(0);
});
