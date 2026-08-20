import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Route,
  type Worker,
} from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

declare const chrome: {
  readonly storage: {
    readonly local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
    readonly session: {
      get(key: string): Promise<Record<string, unknown>>;
    };
  };
  readonly runtime: {
    sendMessage(message: unknown): Promise<unknown>;
  };
  readonly alarms: {
    create(name: string, options: { when: number }): Promise<void>;
  };
};

const VIDEO_ID = "dQw4w9WgXcQ";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SNAPSHOT_ID = "00000000-0000-4000-8000-000000000301";
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000302";
const SOURCE_ID = "00000000-0000-4000-8000-000000000303";
const SEGMENT_ONE_ID = "1".repeat(64);
const SEGMENT_TWO_ID = "2".repeat(64);

type SavedEvent = {
  readonly clientEventId: string;
  readonly youtubeVideoId: string;
  readonly kind: string;
  readonly [key: string]: unknown;
};

const transcriptSegments = [
  {
    stableId: SEGMENT_ONE_ID,
    ordinal: 0,
    originalChinese: "这也太离谱了吧。",
    startSeconds: 10,
    endSeconds: 14,
    language: "zh-CN",
  },
  {
    stableId: SEGMENT_TWO_ID,
    ordinal: 1,
    originalChinese: "我完全没想到。",
    startSeconds: 20,
    endSeconds: 24,
    language: "zh-CN",
  },
] as const;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

export class MockPopcornCloud {
  private dropSyncResponses = false;
  private readonly rows = new Map<string, { savedItemId: string; event: SavedEvent }>();
  private readonly attempts = new Map<string, number>();
  private readonly videoParents = new Map<string, string>();
  private readonly unexpectedOrigins: string[] = [];

  noteRequest(url: string) {
    const parsed = new URL(url);
    if (
      parsed.protocol.startsWith("http") &&
      parsed.hostname !== "app.popcorn.local" &&
      parsed.hostname !== "www.youtube.com"
    ) {
      this.unexpectedOrigins.push(parsed.origin);
    }
  }

  setDropSyncResponses(value: boolean) {
    this.dropSyncResponses = value;
  }

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    const pathName = url.pathname;

    if (pathName === "/api/v1/extension/session/exchange") {
      return json(route, {
        data: {
          session: {
            accessToken: "fixture-access-token",
            refreshToken: "fixture-refresh-token",
            accessExpiresAt: Date.now() + 60 * 60 * 1000,
            user: { id: USER_ID, email: "learner@example.com" },
          },
        },
      });
    }

    if (pathName === `/api/v1/youtube/${VIDEO_ID}/transcript`) {
      return json(route, {
        ok: true,
        data: {
          snapshotId: SNAPSHOT_ID,
          snapshot: {
            transcriptHash: "a".repeat(64),
            language: "zh-CN",
            segments: transcriptSegments,
            plainText: transcriptSegments.map((segment) => segment.originalChinese).join("\n"),
            timestampedText: "[00:10] 这也太离谱了吧。\n[00:20] 我完全没想到。",
          },
        },
      });
    }

    if (pathName === `/api/v1/youtube/${VIDEO_ID}/translations`) {
      const body = request.postDataJSON() as { segmentIds?: string[] };
      const translations: Record<string, string> = {
        [SEGMENT_ONE_ID]: "That is way too absurd.",
        [SEGMENT_TWO_ID]: "I did not expect that at all.",
      };
      return json(route, {
        ok: true,
        data: {
          artifactId: ARTIFACT_ID,
          content: {
            segments: (body.segmentIds ?? []).map((id) => ({ id, english: translations[id] })),
          },
        },
      });
    }

    if (pathName === `/api/v1/youtube/${VIDEO_ID}/overview`) {
      return json(route, {
        ok: true,
        data: {
          artifactId: ARTIFACT_ID,
          content: {
            overview: "A short conversation reacting to something surprising.",
            chapters: [{
              title: "A surprising reaction",
              summary: "The speakers react to an absurd situation.",
              timestampSeconds: 10,
              sourceSegmentIds: [SEGMENT_ONE_ID],
            }],
            keyQuotes: [
              {
                quote: "这也太离谱了吧。",
                englishMeaning: "That is way too absurd.",
                timestampSeconds: 10,
                sourceSegmentIds: ["seg-popcorn-1"],
              },
              {
                quote: "我完全没想到。",
                englishMeaning: "I did not expect that at all.",
                timestampSeconds: 20,
              sourceSegmentIds: [SEGMENT_TWO_ID],
              },
              {
                quote: "这也太离谱了吧。",
                englishMeaning: "A strong informal reaction.",
                timestampSeconds: 11,
              sourceSegmentIds: [SEGMENT_ONE_ID],
              },
            ],
            keyMoments: [],
          },
        },
      });
    }

    if (pathName === "/api/v1/explanations") {
      return json(route, {
        ok: true,
        data: {
          artifactId: ARTIFACT_ID,
          content: {
            meaning: "It means the situation is absurd or unreasonable.",
            tone: "Informal and strongly reactive.",
            communicativeFunction: "It evaluates a surprising situation.",
            contextualFit: "It fits the speaker's immediate reaction.",
          },
        },
      });
    }

    if (pathName === "/api/v1/extension/sync") {
      const authorization = request.headers().authorization;
      if (authorization !== "Bearer fixture-access-token") {
        return json(route, {
          ok: false,
          error: { code: "AUTH_REQUIRED", message: "Authentication is required", retryable: false },
        }, 401);
      }
      const body = request.postDataJSON() as { events?: SavedEvent[] };
      const events = Array.isArray(body.events) ? body.events : [];
      const results = events.map((event) => {
        this.attempts.set(event.clientEventId, (this.attempts.get(event.clientEventId) ?? 0) + 1);
        if (!this.videoParents.has(event.youtubeVideoId)) {
          this.videoParents.set(event.youtubeVideoId, SOURCE_ID);
        }
        if (!this.rows.has(event.clientEventId)) {
          this.rows.set(event.clientEventId, {
            savedItemId: `00000000-0000-4000-9000-${String(this.rows.size + 1).padStart(12, "0")}`,
            event: structuredClone(event),
          });
        }
        const row = this.rows.get(event.clientEventId)!;
        return {
          clientEventId: event.clientEventId,
          ok: true,
          data: { videoSourceId: this.videoParents.get(event.youtubeVideoId), savedItemId: row.savedItemId, status: "saved" },
        };
      });
      if (this.dropSyncResponses) {
        return json(route, {
          ok: false,
          error: { code: "SYNC_RETRYING", message: "Fixture dropped acknowledgement", retryable: true },
        }, 503);
      }
      return json(route, { ok: true, data: { results } });
    }

    return json(route, {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Unexpected fixture route", retryable: false },
    }, 404);
  }

  savedKinds() {
    return [...new Set([...this.rows.values()].map(({ event }) => event.kind))].sort();
  }

  videoParentCount() {
    return this.videoParents.size;
  }

  hasIdempotentRetry() {
    return [...this.attempts.values()].some((count) => count > 1) &&
      this.rows.size === new Set(this.rows.keys()).size;
  }

  unapprovedEgress() {
    return [...new Set(this.unexpectedOrigins)].sort();
  }
}

function youtubeFixtureHtml() {
  return `<!doctype html>
  <html><head><meta charset="utf-8"><style>
    ytd-watch-metadata, #actions-inner, #top-level-buttons-computed { display:block; width:600px; height:48px; }
    #movie_player { position:relative; width:800px; height:450px; background:#111; }
    video { width:800px; height:450px; }
  </style></head><body>
    <div id="movie_player" class="html5-video-player"><video class="html5-main-video"></video></div>
    <ytd-watch-metadata>
      <h1 class="ytd-watch-metadata"><yt-formatted-string>中文访谈</yt-formatted-string></h1>
      <div id="channel-name"><yt-formatted-string><a>中文频道</a></yt-formatted-string></div>
      <div id="description-inner">一段中文访谈。</div>
      <div id="actions-inner"><div id="top-level-buttons-computed"></div></div>
    </ytd-watch-metadata>
    <script>
      const video = document.querySelector("video");
      video.currentTime = 45;
      Object.defineProperty(video, "duration", { configurable: true, value: 120 });
      Object.defineProperty(video, "paused", { configurable: true, get: () => false });
      document.getElementById("movie_player").getPlayerResponse = () => ({ videoDetails: {
        title: "中文访谈", author: "中文频道", shortDescription: "一段中文访谈。", lengthSeconds: "120"
      }});
    </script>
  </body></html>`;
}

export class PopcornExtensionHarness {
  readonly cloud = new MockPopcornCloud();
  readonly options: Page;
  readonly youtube: Page;
  panel!: Page;

  constructor(
    readonly context: BrowserContext,
    readonly extensionId: string,
    readonly profileDir: string,
    options: Page,
    youtube: Page,
  ) {
    this.options = options;
    this.youtube = youtube;
  }

  private extensionUrl(pathName: string) {
    return `chrome-extension://${this.extensionId}/${pathName}`;
  }

  async signInAfterExplicitClick() {
    await this.options.goto(this.extensionUrl("options.html"));
    await expect(this.options.locator("#accountEmail")).toHaveText("Not signed in");
    const before = await this.options.evaluate(async () =>
      (await chrome.storage.local.get("popcorn_session")).popcorn_session ?? null,
    );
    expect(before).toBeNull();

    await this.options.locator("#signInBtn").click();
    await expect(this.options.locator("#authStatus")).toContainText("Opening Popcorn sign-in…");

    // Chromium's test build does not route the chrome.identity auth webview.
    // Prove the real explicit UI click reached the PKCE boundary, then seed the
    // deterministic server callback. auth.test.js separately proves the full
    // state/code exchange behavior.
    const worker = await this.activeWorker();
    await expect.poll(() => worker.evaluate(async () =>
      (await chrome.storage.session.get("popcorn_pkce")).popcorn_pkce ?? null,
    )).not.toBeNull();
    const storedSession = await worker.evaluate(async ({ userId }) => {
      await chrome.storage.local.set({
        popcorn_session: {
          accessToken: "fixture-access-token",
          refreshToken: "fixture-refresh-token",
          accessExpiresAt: Date.now() + 60 * 60 * 1000,
          user: { id: userId, email: "learner@example.com" },
        },
      });
      return (await chrome.storage.local.get("popcorn_session")).popcorn_session;
    }, { userId: USER_ID });
    expect(storedSession).toMatchObject({ user: { id: USER_ID, email: "learner@example.com" } });
    const authResponse = await this.options.evaluate(() =>
      chrome.runtime.sendMessage({ command: "popcorn-auth:session" }),
    );
    expect(authResponse).toMatchObject({ ok: true, account: { email: "learner@example.com" } });
    await this.options.reload();
    await expect(this.options.locator("#accountEmail")).toHaveText("learner@example.com");
  }

  async openChineseVideoAndPanel() {
    await this.youtube.goto(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    await this.youtube.locator("#ytd-note-button").waitFor();
    this.panel = await this.context.newPage();
    await this.youtube.bringToFront();
    await this.panel.goto(this.extensionUrl("sidepanel.html"));
    await this.panel.locator(".transcript-entry").first().waitFor({ timeout: 15_000 });
    await expect(this.panel.locator("#videoTitle")).toHaveText("中文访谈");
  }

  async showEnglishAndBilingual() {
    await this.panel.locator('[data-transcript-mode="en"]').click();
    await expect(this.panel.locator(".transcript-translation").first()).toContainText("absurd");
    await this.panel.locator('[data-transcript-mode="bilingual"]').click();
    await expect(this.panel.locator(".transcript-original").first()).toContainText("离谱");
    await expect(this.panel.locator(".transcript-translation").first()).toContainText("absurd");
  }

  private async selectFirstChineseRow() {
    await this.panel.evaluate(() => {
      const target = document.querySelector(".transcript-entry .transcript-original, .transcript-entry .transcript-text");
      const text = target?.firstChild;
      if (!target || !text) throw new Error("fixture transcript text missing");
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, text.textContent?.length ?? 0);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await expect(this.panel.locator("#explainTooltip")).toBeVisible();
  }

  private async waitForKind(kind: string) {
    await expect.poll(() => this.cloud.savedKinds()).toContain(kind);
  }

  async saveAllSixKindsWithoutChangingPlayback() {
    const before = await this.youtube.locator("video").evaluate((video: HTMLVideoElement) => ({
      currentTime: video.currentTime,
      paused: video.paused,
    }));

    await this.panel.locator("#saveVideoBtn").click();
    await this.waitForKind("video");

    await this.youtube.locator("#movie_player").hover();
    await this.youtube.locator("#ytd-note-button").click();
    await this.waitForKind("player_moment");

    await this.panel.locator(".transcript-save-btn").first().click();
    await this.waitForKind("subtitle_row");

    await this.selectFirstChineseRow();
    await this.panel.locator(".selection-save-btn").click();
    await this.waitForKind("subtitle_selection");

    await this.panel.locator('.tab[data-tab="overview"]').click();
    await this.panel.locator(".quote-save-note-btn").first().waitFor();
    await this.panel.locator(".quote-save-note-btn").first().click();
    await this.waitForKind("key_quote");

    await this.panel.locator('.tab[data-tab="transcript"]').click();
    await this.selectFirstChineseRow();
    await this.panel.locator(".explain-btn").click();
    await this.panel.locator(".explanation-save-btn").waitFor();
    await this.panel.locator(".explanation-save-btn").click();
    await this.waitForKind("ai_explanation");

    const after = await this.youtube.locator("video").evaluate((video: HTMLVideoElement) => ({
      currentTime: video.currentTime,
      paused: video.paused,
    }));
    expect(after).toEqual(before);
  }

  async queueRapidMomentsWithDroppedResponses() {
    this.cloud.setDropSyncResponses(true);
    await this.youtube.bringToFront();
    await this.youtube.locator("video").evaluate((video: HTMLVideoElement) => { video.currentTime = 51; });
    await this.youtube.keyboard.press("n");
    await this.youtube.keyboard.press("n");
    await expect.poll(() => this.pendingCount()).toBeGreaterThanOrEqual(2);
  }

  private async activeWorker(): Promise<Worker> {
    return this.context.serviceWorkers()[0] ?? this.context.waitForEvent("serviceworker");
  }

  private async stopActiveWorker() {
    const worker = await this.activeWorker();
    const cdp = await this.context.newCDPSession(this.options);
    const versions: Array<{ versionId: string; scriptURL: string; status: string }> = [];
    cdp.on("ServiceWorker.workerVersionUpdated", (event) => versions.push(...event.versions));
    await cdp.send("ServiceWorker.enable");
    await this.options.waitForTimeout(200);
    const version = [...versions].reverse().find((candidate) =>
      candidate.scriptURL === worker.url() && candidate.status === "activated",
    ) ?? [...versions].reverse().find((candidate) => candidate.scriptURL === worker.url());
    if (!version) throw new Error("active extension worker version not found");
    await cdp.send("ServiceWorker.stopWorker", { versionId: version.versionId });
    await cdp.detach();
  }

  async stopWorkerAndRecoverFromAlarm() {
    await this.stopActiveWorker();
    this.cloud.setDropSyncResponses(false);
    await this.options.evaluate(async () => {
      const stored = await chrome.storage.local.get("popcorn_pending_events");
      const events = Array.isArray(stored.popcorn_pending_events)
        ? stored.popcorn_pending_events.map((event: Record<string, unknown>) => ({ ...event, nextAttemptAt: Date.now() }))
        : [];
      await chrome.storage.local.set({ popcorn_pending_events: events });
      await chrome.alarms.create("popcorn-sync-retry", { when: Date.now() + 100 });
    });
    await expect.poll(() => this.pendingCount(), { timeout: 15_000 }).toBe(0);
  }

  async pendingCount() {
    return this.options.evaluate(async () => {
      const stored = await chrome.storage.local.get("popcorn_pending_events");
      return Array.isArray(stored.popcorn_pending_events) ? stored.popcorn_pending_events.length : 0;
    });
  }

  async close() {
    await this.context.close();
    fs.rmSync(this.profileDir, { recursive: true, force: true });
  }
}

type Fixtures = { popcorn: PopcornExtensionHarness };

export const test = base.extend<Fixtures>({
  popcorn: async ({}, provideFixture) => {
    const extensionPath = path.resolve(process.cwd(), "extension");
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "popcorn-extension-e2e-"));
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const extensionId = new URL(worker.url()).host;
    const options = await context.newPage();
    const youtube = await context.newPage();
    const harness = new PopcornExtensionHarness(context, extensionId, profileDir, options, youtube);

    context.on("request", (request) => harness.cloud.noteRequest(request.url()));
    await context.route("https://app.popcorn.local/**", (route) => harness.cloud.handle(route));
    await context.route("https://www.youtube.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: youtubeFixtureHtml() }),
    );

    try {
      await provideFixture(harness);
    } finally {
      await harness.close();
    }
  },
});

export { expect };
