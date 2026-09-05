import type { ModelGatewayError } from "@/server/ai/provider";

const MAX_JSON_CANDIDATES = 8;
const MAX_FIELD_PATH_LENGTH = 64;

export type WireDecodeResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly fieldPath?: string };

export type WireNormalizer<T> = (
  value: Record<string, unknown>,
) => WireDecodeResult<T>;

export type JsonExtractionResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: "json_extract" | "wire_schema" | "ambiguous";
      readonly fieldPath?: string;
    };

export type ModelOutputStage =
  | "transport"
  | "timeout"
  | "rate_limit"
  | "provider_http"
  | "response_envelope"
  | "json_extract"
  | "wire_schema"
  | "grounding"
  | "persistence";

export type SafeModelFailure = ModelGatewayError | {
  readonly code: "INTERNAL";
  readonly stage: "persistence";
  readonly fieldPath?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedFieldPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const safe = value
    .replace(/[^A-Za-z0-9_.[\]-]+/gu, "_")
    .slice(0, MAX_FIELD_PATH_LENGTH);
  return safe.length > 0 ? safe : undefined;
}

function parseRecord(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function wholeResponseFence(text: string): string | null {
  const match = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/iu.exec(text.trim());
  return match?.[1]?.trim() ?? null;
}

type ScannedCandidates = {
  readonly candidates: readonly Record<string, unknown>[];
  readonly unsafe: boolean;
};

function scanTopLevelObjects(text: string): ScannedCandidates {
  const candidates: Record<string, unknown>[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let overflow = false;
  let arrayDepth = 0;
  let outsideString = false;
  let outsideEscaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (start < 0) {
      if (outsideString) {
        if (outsideEscaped) {
          outsideEscaped = false;
        } else if (character === "\\") {
          outsideEscaped = true;
        } else if (character === '"') {
          outsideString = false;
        }
      } else if (character === '"') {
        outsideString = true;
      } else if (character === "[") {
        arrayDepth += 1;
      } else if (character === "]") {
        arrayDepth = Math.max(0, arrayDepth - 1);
      } else if (character === "{" && arrayDepth === 0) {
        start = index;
        depth = 1;
        inString = false;
        escaped = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        const parsed = parseRecord(text.slice(start, index + 1));
        if (parsed) {
          if (candidates.length === MAX_JSON_CANDIDATES) {
            overflow = true;
          } else {
            candidates.push(parsed);
          }
        }
        start = -1;
      }
    }
  }

  return {
    candidates,
    unsafe: overflow || start >= 0,
  };
}

export function unwrapKnownResultObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(value);
  if (keys.length !== 1 || !["result", "data", "output"].includes(keys[0])) {
    return value;
  }
  const nested = value[keys[0]];
  return isRecord(nested) ? nested : value;
}

export function extractUniqueSemanticObject<T>(
  text: string,
  normalize: WireNormalizer<T>,
): JsonExtractionResult<T> {
  const trimmed = text.trim();
  const direct = parseRecord(trimmed);
  const fencedText = direct ? null : wholeResponseFence(trimmed);
  const fenced = fencedText === null ? null : parseRecord(fencedText);
  const scanned = direct || fenced
    ? { candidates: [direct ?? fenced] as Record<string, unknown>[], unsafe: false }
    : scanTopLevelObjects(trimmed);

  if (scanned.unsafe || scanned.candidates.length === 0) {
    return { ok: false, reason: "json_extract" };
  }

  const valid: T[] = [];
  let firstFieldPath: string | undefined;
  for (const candidate of scanned.candidates) {
    let decoded: WireDecodeResult<T>;
    try {
      decoded = normalize(unwrapKnownResultObject(candidate));
    } catch {
      decoded = { success: false };
    }
    if (decoded.success) {
      valid.push(decoded.data);
    } else if (firstFieldPath === undefined) {
      firstFieldPath = boundedFieldPath(decoded.fieldPath);
    }
  }

  if (valid.length > 1) return { ok: false, reason: "ambiguous" };
  if (valid.length === 1) return { ok: true, value: valid[0] };
  return {
    ok: false,
    reason: "wire_schema",
    ...(firstFieldPath ? { fieldPath: firstFieldPath } : {}),
  };
}

export function normalizeEnglishPunctuation(value: string): string {
  return value
    .replace(/[’‘]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[—–]/gu, "-")
    .replace(/…/gu, "...")
    .replace(/\u00a0/gu, " ");
}

export function safeModelFailureCode(error: SafeModelFailure): string {
  const base = `${error.code}:${error.stage}`;
  const path = boundedFieldPath(error.fieldPath);
  return (path ? `${base}:${path}` : base).slice(0, 100);
}
