import { describe, expect, test, vi } from "vitest";

import { createSupadataTranscriptProvider } from "@/server/transcript/supadata-provider";

const VIDEO_ID = "abc123XYZ00";
const API_KEY = "fixture-supadata-key";

const chineseResponse = {
  lang: "zh-CN",
  content: [
    { text: ">> 你好，世界", offset: 1_250, duration: 2_900, lang: "zh" },
    { text: "这个表达很常见。", offset: 4_500, duration: 1_500, lang: "zh-Hans" },
  ],
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Supadata native-Chinese provider", () => {
  test("uses the exact canonical request and keeps the key only in a header", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response(200, chineseResponse));
    const provider = createSupadataTranscriptProvider({ apiKey: API_KEY, fetchImpl });

    const result = await provider.request(VIDEO_ID);

    expect(result.kind).toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(rawUrl));
    expect(url.origin + url.pathname).toBe("https://api.supadata.ai/v1/transcript");
    expect([...url.searchParams.entries()]).toEqual([
      ["url", `https://www.youtube.com/watch?v=${VIDEO_ID}`],
      ["text", "false"],
      ["lang", "zh"],
      ["mode", "native"],
    ]);
    expect(url.toString()).not.toContain(API_KEY);
    expect(new Headers(init?.headers).get("x-api-key")).toBe(API_KEY);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  test("rejects an invalid video ID before fetch", async () => {
    const fetchImpl = vi.fn();
    const provider = createSupadataTranscriptProvider({ apiKey: API_KEY, fetchImpl });

    await expect(provider.request("https://youtube.com/watch?v=abc")).rejects.toThrow(
      /video id/i,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("returns a bounded provider reference for HTTP 202", async () => {
    const provider = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => response(202, { jobId: "provider-job-123" })),
    });

    await expect(provider.request(VIDEO_ID)).resolves.toEqual({
      kind: "pending",
      providerJobId: "provider-job-123",
    });
  });

  test.each([
    [206, "NATIVE_CHINESE_TRANSCRIPT_REQUIRED"],
    [404, "NATIVE_CHINESE_TRANSCRIPT_REQUIRED"],
  ] as const)("maps HTTP %s to unsupported native subtitles", async (status, code) => {
    const provider = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => response(status, {})),
    });

    await expect(provider.request(VIDEO_ID)).resolves.toEqual({
      kind: "unsupported",
      code,
    });
  });

  test.each([
    [401, "PROVIDER_UNAVAILABLE", false],
    [429, "PROVIDER_RATE_LIMITED", true],
    [503, "PROVIDER_UNAVAILABLE", true],
  ] as const)("maps HTTP %s to a typed failure", async (status, code, retryable) => {
    const provider = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => response(status, { message: "private detail" })),
    });

    await expect(provider.request(VIDEO_ID)).resolves.toEqual({
      kind: "failure",
      code,
      retryable,
    });
  });

  test("maps a network exception to a retryable failure without leaking it", async () => {
    const provider = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => {
        throw new Error("socket secret detail");
      }),
    });

    await expect(provider.request(VIDEO_ID)).resolves.toEqual({
      kind: "failure",
      code: "PROVIDER_UNAVAILABLE",
      retryable: true,
    });
  });

  test.each([
    { ...chineseResponse, lang: "en" },
    { ...chineseResponse, lang: "zh-TW" },
    { ...chineseResponse, lang: "zh-Hant" },
    {
      ...chineseResponse,
      content: [{ text: "你好", offset: 0, duration: 1000, lang: "en" }],
    },
    {
      lang: "zh",
      content: [{ text: "hello only", offset: 0, duration: 1000, lang: "zh" }],
    },
  ])("rejects fallback or non-Han Provider output", async (body) => {
    const provider = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => response(200, body)),
    });

    await expect(provider.request(VIDEO_ID)).resolves.toEqual({
      kind: "unsupported",
      code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
    });
  });

  test("rejects empty, malformed, and oversized Provider bodies", async () => {
    const empty = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => response(200, { lang: "zh", content: [] })),
    });
    const malformed = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      fetchImpl: vi.fn(async () => new Response("{", { status: 200 })),
    });
    const oversized = createSupadataTranscriptProvider({
      apiKey: API_KEY,
      maxResponseBytes: 32,
      fetchImpl: vi.fn(async () => response(200, chineseResponse)),
    });

    await expect(empty.request(VIDEO_ID)).resolves.toEqual({
      kind: "failure",
      code: "TRANSCRIPT_EMPTY",
      retryable: false,
    });
    await expect(malformed.request(VIDEO_ID)).resolves.toEqual({
      kind: "failure",
      code: "PROVIDER_OUTPUT_INVALID",
      retryable: false,
    });
    await expect(oversized.request(VIDEO_ID)).resolves.toEqual({
      kind: "failure",
      code: "PROVIDER_OUTPUT_INVALID",
      retryable: false,
    });
  });

  test("polls one durable Provider step without an in-process loop", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(200, { status: "active" }))
      .mockResolvedValueOnce(response(200, { status: "completed", ...chineseResponse }));
    const provider = createSupadataTranscriptProvider({ apiKey: API_KEY, fetchImpl });

    await expect(provider.poll("provider-job-123")).resolves.toEqual({ kind: "pending" });
    const completed = await provider.poll("provider-job-123");
    expect(completed.kind).toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toBe(
      "https://api.supadata.ai/v1/transcript/provider-job-123",
    );
  });
});
