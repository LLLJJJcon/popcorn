import { YouTubeVideoIdSchema } from "@/contracts/source";
import { getServerEnv } from "@/server/env";

import {
  NativeTranscriptError,
  normalizeNativeTranscript,
} from "./normalize-transcript";
import type {
  TranscriptFailure,
  TranscriptPollResult,
  TranscriptProvider,
  TranscriptRequestResult,
} from "./provider";

const SUPADATA_TRANSCRIPT_ENDPOINT = "https://api.supadata.ai/v1/transcript";
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000;
const MAX_PROVIDER_JOB_ID_LENGTH = 200;

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type ProviderOptions = {
  readonly apiKey: string;
  readonly fetchImpl?: Fetch;
  readonly maxResponseBytes?: number;
  readonly requestTimeoutMs?: number;
};

function providerFailure(
  code: TranscriptFailure["code"],
  retryable: boolean,
): TranscriptFailure {
  return { kind: "failure", code, retryable };
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > maximumBytes) {
    await response.body?.cancel();
    throw new NativeTranscriptError("Provider response is oversized", "invalid");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = response.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The bounded-read failure remains authoritative if cancellation fails.
        }
        throw new NativeTranscriptError("Provider response is oversized", "invalid");
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new NativeTranscriptError("Provider response is malformed JSON", "invalid");
  }
}

function normalizeResult(body: unknown): TranscriptRequestResult {
  try {
    return { kind: "ready", snapshot: normalizeNativeTranscript(body) };
  } catch (error) {
    if (error instanceof NativeTranscriptError) {
      if (error.reason === "language") {
        return { kind: "unsupported", code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED" };
      }
      if (error.reason === "empty") {
        return providerFailure("TRANSCRIPT_EMPTY", false);
      }
    }
    return providerFailure("PROVIDER_OUTPUT_INVALID", false);
  }
}

function parseProviderJobId(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const providerJobId = (body as Record<string, unknown>).jobId;
  if (
    typeof providerJobId !== "string" ||
    providerJobId.trim() !== providerJobId ||
    providerJobId.length === 0 ||
    providerJobId.length > MAX_PROVIDER_JOB_ID_LENGTH
  ) {
    return null;
  }
  return providerJobId;
}

function requestHeaders(apiKey: string): HeadersInit {
  return { "x-api-key": apiKey };
}

export function createSupadataTranscriptProvider({
  apiKey,
  fetchImpl = fetch,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  requestTimeoutMs = 4_000,
}: ProviderOptions): TranscriptProvider {
  if (apiKey.trim().length === 0) throw new TypeError("Supadata API key is required");
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1) {
    throw new RangeError("maxResponseBytes must be a positive integer");
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 30_000) {
    throw new RangeError("requestTimeoutMs must be between 1 and 30000");
  }

  async function request(videoId: string): Promise<TranscriptRequestResult> {
    YouTubeVideoIdSchema.parse(videoId);
    const url = new URL(SUPADATA_TRANSCRIPT_ENDPOINT);
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
    url.searchParams.set("text", "false");
    url.searchParams.set("lang", "zh");
    url.searchParams.set("mode", "native");

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: requestHeaders(apiKey),
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch {
      return providerFailure("PROVIDER_UNAVAILABLE", true);
    }

    if (response.status === 206 || response.status === 404) {
      return { kind: "unsupported", code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED" };
    }
    if (response.status === 401) return providerFailure("PROVIDER_UNAVAILABLE", false);
    if (response.status === 429) return providerFailure("PROVIDER_RATE_LIMITED", true);
    if (response.status === 202) {
      try {
        const providerJobId = parseProviderJobId(
          await readBoundedJson(response, maxResponseBytes),
        );
        return providerJobId
          ? { kind: "pending", providerJobId }
          : providerFailure("PROVIDER_OUTPUT_INVALID", false);
      } catch {
        return providerFailure("PROVIDER_OUTPUT_INVALID", false);
      }
    }
    if (!response.ok) return providerFailure("PROVIDER_UNAVAILABLE", true);

    try {
      return normalizeResult(await readBoundedJson(response, maxResponseBytes));
    } catch {
      return providerFailure("PROVIDER_OUTPUT_INVALID", false);
    }
  }

  async function poll(providerJobId: string): Promise<TranscriptPollResult> {
    if (parseProviderJobId({ jobId: providerJobId }) === null) {
      return providerFailure("PROVIDER_OUTPUT_INVALID", false);
    }
    let response: Response;
    try {
      response = await fetchImpl(
        `${SUPADATA_TRANSCRIPT_ENDPOINT}/${encodeURIComponent(providerJobId)}`,
        {
          method: "GET",
          headers: requestHeaders(apiKey),
          signal: AbortSignal.timeout(requestTimeoutMs),
        },
      );
    } catch {
      return providerFailure("PROVIDER_UNAVAILABLE", true);
    }
    if (response.status === 206 || response.status === 404) {
      return { kind: "unsupported", code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED" };
    }
    if (response.status === 401) return providerFailure("PROVIDER_UNAVAILABLE", false);
    if (response.status === 429) return providerFailure("PROVIDER_RATE_LIMITED", true);
    if (!response.ok) return providerFailure("PROVIDER_UNAVAILABLE", true);

    let body: unknown;
    try {
      body = await readBoundedJson(response, maxResponseBytes);
    } catch {
      return providerFailure("PROVIDER_OUTPUT_INVALID", false);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return providerFailure("PROVIDER_OUTPUT_INVALID", false);
    }
    const status = (body as Record<string, unknown>).status;
    if (status === "queued" || status === "active" || status === "pending") {
      return { kind: "pending" };
    }
    if (status === "failed") return providerFailure("PROVIDER_UNAVAILABLE", true);
    if (status !== "completed") return providerFailure("PROVIDER_OUTPUT_INVALID", false);
    return normalizeResult(body);
  }

  return { request, poll };
}

export function requestNativeChineseTranscript(
  videoId: string,
): Promise<TranscriptRequestResult> {
  const environment = getServerEnv();
  return createSupadataTranscriptProvider({
    apiKey: environment.SUPADATA_API_KEY,
  }).request(videoId);
}
