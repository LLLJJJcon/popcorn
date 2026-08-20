import { expect, test } from "./fixtures";

const VIDEO_ID = "dQw4w9WgXcQ";
const SEGMENT_ONE_ID = "1".repeat(64);

function expectExactEvent(
  event: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>,
) {
  const { clientEventId, capturedAt, ...payload } = event;
  expect(clientEventId).toEqual(expect.stringMatching(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ));
  expect(capturedAt).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/));
  expect(payload).toEqual(expected);
  expect(Object.keys(event).sort()).toEqual(["clientEventId", "capturedAt", ...Object.keys(expected)].sort());
  return clientEventId as string;
}

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

  const primary = popcorn.cloud.capturedEventsByKind();
  for (const kind of [
    "video", "player_moment", "subtitle_row", "subtitle_selection", "key_quote", "ai_explanation",
  ]) {
    expect(primary[kind]).toHaveLength(1);
  }
  const primaryIds = [
    expectExactEvent(primary.video[0], {
      youtubeVideoId: VIDEO_ID,
      kind: "video",
      canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
      durationSeconds: 120,
      description: "一段中文访谈。",
      currentTimeSeconds: 45,
      requestNativeSnapshot: true,
    }),
    expectExactEvent(primary.player_moment[0], {
      youtubeVideoId: VIDEO_ID,
      kind: "player_moment",
      capturedSecond: 42,
    }),
    expectExactEvent(primary.subtitle_row[0], {
      youtubeVideoId: VIDEO_ID,
      kind: "subtitle_row",
      segmentId: SEGMENT_ONE_ID,
      originalChinese: "这也太离谱了吧。",
      englishTranslation: "That is way too absurd.",
      startSeconds: 10,
      endSeconds: 14,
      contextBefore: [],
      contextAfter: ["我完全没想到。"],
    }),
    expectExactEvent(primary.subtitle_selection[0], {
      youtubeVideoId: VIDEO_ID,
      kind: "subtitle_selection",
      originalChinese: "这也太离谱了吧。",
      englishTranslation: "That is way too absurd.",
      segmentIds: [SEGMENT_ONE_ID],
      startSeconds: 10,
      endSeconds: 14,
      startOffset: 0,
      endOffset: 8,
      contextBefore: [],
      contextAfter: ["我完全没想到。"],
    }),
    expectExactEvent(primary.key_quote[0], {
      youtubeVideoId: VIDEO_ID,
      kind: "key_quote",
      exactQuote: "这也太离谱了吧。",
      quoteSeconds: 10,
      segmentIds: [SEGMENT_ONE_ID],
    }),
    expectExactEvent(primary.ai_explanation[0], {
      youtubeVideoId: VIDEO_ID,
      kind: "ai_explanation",
      selectedChinese: "这也太离谱了吧。",
      englishExplanation: [
        "Meaning: It means the situation is absurd or unreasonable.",
        "Tone: Informal and strongly reactive.",
        "Communicative function: It evaluates a surprising situation.",
        "Contextual fit: It fits the speaker's immediate reaction.",
      ].join("\n\n"),
      segmentIds: [SEGMENT_ONE_ID],
      startSeconds: 10,
      endSeconds: 14,
      contextBefore: [],
      contextAfter: ["我完全没想到。"],
    }),
  ];
  expect(new Set(primaryIds).size).toBe(6);

  const rapidIds = await popcorn.queueRapidMomentsWithDroppedResponses();
  expect(rapidIds).toHaveLength(2);
  expect(new Set(rapidIds).size).toBe(2);
  expect(rapidIds.every((id) => popcorn.cloud.attemptCount(id) >= 1)).toBe(true);
  await popcorn.stopWorkerAndRecoverFromAlarm();
  expect(rapidIds.every((id) =>
    popcorn.cloud.attemptCount(id) >= 2 && popcorn.cloud.successfulAckCount(id) >= 1,
  )).toBe(true);

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
